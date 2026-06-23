import type { Client, Guild, Message } from "discord.js";
import { Events, AuditLogEvent, EmbedBuilder } from "discord.js";
import { getConfig, getWhitelist, recordAction } from "./store.js";
import type { ActionType } from "./store.js";
import { quarantine } from "./mitigation.js";
import { recordChannelSnap, recordRoleSnap, recordBanSnap } from "./snapshot.js";
import { postAntiNukeLog } from "./logger.js";

// ── Webhook message spam tracking (per webhookId) ─────────────────────────────
// Two-layer detector:
//   Layer 1 — volume: 3+ messages from the same webhook in 8s (fast spam)
//   Layer 2 — duplicate content: same webhook sends identical text twice in 60s
//             catches slow steady spammers who stay under the rate-limit
const webhookMsgTimestamps = new Map<string, number[]>();
const WEBHOOK_MSG_LIMIT  = 3;    // messages
const WEBHOOK_MSG_WINDOW = 8_000; // ms

// Layer 2: webhookId → (normalised content → first-seen timestamp)
const webhookContentSeen = new Map<string, Map<string, number>>();
const WEBHOOK_DUPE_WINDOW = 60_000; // ms — 60s memory for duplicate content

// Discord audit log takes ~1–2 seconds to populate after an action.
const AUDIT_DELAY_MS = 1_500;

// Fetch the most recent audit log entry of a given type within 8 seconds.
async function resolveExecutor(
  guild: Guild,
  auditEvent: AuditLogEvent,
): Promise<string | null> {
  await new Promise<void>(res => setTimeout(res, AUDIT_DELAY_MS));
  try {
    const logs  = await guild.fetchAuditLogs({ type: auditEvent, limit: 5 });
    const entry = logs.entries.find(e => Date.now() - e.createdTimestamp < 8_000);
    return entry?.executor?.id ?? null;
  } catch { return null; }
}

// Central handler: check whitelist + config, record action, trigger quarantine.
// Returns true if quarantine was triggered.
async function handleAction(
  client: Client,
  guild: Guild,
  executorId: string,
  action: ActionType,
  details: string,
): Promise<boolean> {
  const config = await getConfig(guild.id);
  if (!config.enabled) return false;

  const botId = client.user!.id;
  if (executorId === guild.ownerId || executorId === botId) return false;

  const whitelist = await getWhitelist(guild.id);
  if (whitelist.has(executorId)) return false;

  const triggered = recordAction(guild.id, executorId, action, config);
  if (triggered) {
    await quarantine(client, guild, executorId, action, details);

    // Post a quarantine alert to the log channel
    const alertEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle("🚨 ANTI-NUKE — OFFENDER QUARANTINED")
      .setDescription(
        `<@${executorId}> crossed the **${action}** threshold and has been quarantined.\n\n` +
        `**Last action:** ${details}\n\n` +
        `All their roles have been stripped. Use \`?antinuke restore <@${executorId}>\` to undo the damage.`,
      )
      .setTimestamp();
    await postAntiNukeLog(client, guild, alertEmbed);
    return true;
  }
  return false;
}

// ── Shared action pipeline for both spam detection layers ────────────────────
async function triggerWebhookSpamAction(
  client: Client,
  guild: Guild,
  channel: Message["channel"],
  webhookId: string,
  msgCount: number,
  triggerReason: string,
): Promise<void> {

  const config = await getConfig(guild.id);
  if (!config.enabled) {
    console.log(`[ANTINUKE/WEBHOOK-SPAM] antinuke DISABLED for guild=${guild.id} — no action. Run ?antinuke enable`);
    return;
  }

  let deletedWebhook  = false;
  let purgedMessages  = 0;
  let webhookName     = "Unknown";
  let installedById   = "Unknown";
  let installedByTag  = "Unknown";
  let usedByLine      = "*(sent by external app — no Discord user attached)*";

  const canFetchWebhooks = "fetchWebhooks" in channel;
  const canBulkDelete    = "bulkDelete" in channel;

  // 1. Collect author display names BEFORE deleting
  const webhookAuthorNames = new Set<string>();
  try {
    if ("messages" in channel) {
      type MsgLike = { webhookId: string | null; author: { username: string } };
      const fetched = await (channel as { messages: { fetch: (o: object) => Promise<Map<string, MsgLike>> } })
        .messages.fetch({ limit: 20 });
      (fetched as Map<string, MsgLike>).forEach(m => {
        if (m.webhookId === webhookId && m.author.username) webhookAuthorNames.add(m.author.username);
      });
    }
  } catch { /* non-critical */ }

  if (webhookAuthorNames.size > 0) {
    usedByLine = [...webhookAuthorNames].map(n => `\`${n}\``).join(", ") +
      " *(webhook display name set by the external app)*";
  }

  // 2. Fetch webhook info, then delete it
  try {
    if (canFetchWebhooks) {
      type WHLike = { id: string; name: string; owner: { id: string; tag?: string } | null; delete: (r: string) => Promise<void> };
      const webhooks = await (channel as { fetchWebhooks: () => Promise<Map<string, WHLike>> }).fetchWebhooks();
      const wh = webhooks.get(webhookId);
      if (wh) {
        webhookName = wh.name;
        if (wh.owner) { installedById = wh.owner.id; installedByTag = wh.owner.tag ?? wh.owner.id; }

        // Cross-confirm with audit log
        try {
          await new Promise<void>(res => setTimeout(res, 500));
          const logs  = await guild.fetchAuditLogs({ type: AuditLogEvent.WebhookCreate, limit: 10 });
          const entry = logs.entries.find(e => (e.target as { id?: string } | null)?.id === webhookId);
          if (entry?.executor) { installedById = entry.executor.id; installedByTag = entry.executor.tag ?? entry.executor.id; }
        } catch { /* optional */ }

        await wh.delete("Anti-Nuke: webhook message spam");
        deletedWebhook = true;
      }
    }
  } catch (e) { console.error("[ANTINUKE] Webhook fetch/delete failed:", e); }

  // 3. Bulk-delete spam messages
  try {
    if (canBulkDelete && "messages" in channel) {
      type MsgLite = { id: string; webhookId: string | null; createdTimestamp: number };
      const fetched = await (channel as { messages: { fetch: (o: object) => Promise<Map<string, MsgLite>> } })
        .messages.fetch({ limit: 50 });
      const spam = new Map(
        [...(fetched as Map<string, MsgLite>).entries()].filter(
          ([, m]) => m.webhookId === webhookId && Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1_000,
        ),
      );
      if (spam.size > 0) {
        await (channel as { bulkDelete: (msgs: Map<string, unknown>, filterOld?: boolean) => Promise<unknown> })
          .bulkDelete(spam, true);
        purgedMessages = spam.size;
      }
    }
  } catch (e) { console.error("[ANTINUKE] Bulk delete failed:", e); }

  // 4. Timeout + DM the webhook creator (1 hour)
  let timedOutLine = "Could not resolve creator as a guild member";
  if (installedById !== "Unknown") {
    try {
      const member = await guild.members.fetch(installedById).catch(() => null);
      if (member && member.id !== guild.ownerId && member.manageable) {
        await member.timeout(60 * 60 * 1_000, "Anti-Nuke: webhook spam");
        timedOutLine = `<@${installedById}> timed out for **1 hour**`;
        try { await member.send("You ain't doing shit 😂"); } catch { /* DMs closed */ }
      } else if (member) {
        timedOutLine = `<@${installedById}> not manageable (owner or higher role)`;
      }
    } catch (e) {
      console.error("[ANTINUKE] Timeout failed:", e);
      timedOutLine = "Timeout failed (missing permissions or member left)";
    }
  }

  // 5. Post log embed
  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle("🚨 Webhook Spam Blocked")
    .setDescription(`Triggered by: **${triggerReason}** (${msgCount} message${msgCount === 1 ? "" : "s"})`)
    .addFields(
      { name: "📎 Webhook Name",         value: `\`${webhookName}\``,                                                  inline: true },
      { name: "📍 Channel",              value: `<#${channel.id}>`,                                                    inline: true },
      { name: "🔧 Installed By",         value: installedById !== "Unknown" ? `<@${installedById}> (\`${installedByTag}\`)` : "Could not resolve", inline: false },
      { name: "💬 Used By (app name)",   value: usedByLine,                                                            inline: false },
      { name: "⏱️ Timeout",              value: timedOutLine,                                                          inline: false },
      { name: "🗑️ Actions Taken",        value: `• Webhook ${deletedWebhook ? "**deleted**" : "delete failed"}\n• **${purgedMessages}** message(s) bulk-deleted`, inline: false },
    )
    .setFooter({ text: "Last Stand Anti-Nuke — Webhook Spam Guard" })
    .setTimestamp();

  await postAntiNukeLog(client, guild, embed);
}

export function registerAntiNukeEvents(client: Client): void {

  // ── Channel Delete ────────────────────────────────────────────────────────
  client.on(Events.ChannelDelete, (channel) => {
    if (channel.isDMBased()) return;
    const guild = channel.guild;
    const chSnap = channel;
    void (async () => {
      const executorId = await resolveExecutor(guild, AuditLogEvent.ChannelDelete);
      if (!executorId) return;
      recordChannelSnap(guild.id, executorId, chSnap);
      const name = "name" in channel ? String(channel.name) : "unknown";

      const embed = new EmbedBuilder()
        .setColor(0xFF6B35)
        .setTitle("🗑️ Channel Deleted")
        .addFields(
          { name: "Channel",  value: `**#${name}**`,        inline: true },
          { name: "By",       value: `<@${executorId}>`,    inline: true },
          { name: "Type",     value: `\`${channel.type}\``, inline: true },
        )
        .setFooter({ text: `Executor ID: ${executorId}` })
        .setTimestamp();
      await postAntiNukeLog(client, guild, embed);

      await handleAction(client, guild, executorId, "channelDelete", `Deleted channel: **#${name}**`);
    })().catch(err => console.error("[ANTINUKE] channelDelete handler:", err));
  });

  // ── Role Delete ───────────────────────────────────────────────────────────
  client.on(Events.GuildRoleDelete, (role) => {
    const guild = role.guild;
    void (async () => {
      const executorId = await resolveExecutor(guild, AuditLogEvent.RoleDelete);
      if (!executorId) return;
      recordRoleSnap(guild.id, executorId, role);

      const embed = new EmbedBuilder()
        .setColor(0xFF6B35)
        .setTitle("🗑️ Role Deleted")
        .addFields(
          { name: "Role",     value: `**${role.name}**`,   inline: true },
          { name: "By",       value: `<@${executorId}>`,   inline: true },
          { name: "Color",    value: role.hexColor,         inline: true },
        )
        .setFooter({ text: `Executor ID: ${executorId}` })
        .setTimestamp();
      await postAntiNukeLog(client, guild, embed);

      await handleAction(client, guild, executorId, "roleDelete", `Deleted role: **${role.name}**`);
    })().catch(err => console.error("[ANTINUKE] roleDelete handler:", err));
  });

  // ── Ban Add ───────────────────────────────────────────────────────────────
  client.on(Events.GuildBanAdd, (ban) => {
    const guild = ban.guild;
    void (async () => {
      const executorId = await resolveExecutor(guild, AuditLogEvent.MemberBanAdd);
      if (!executorId) return;
      recordBanSnap(guild.id, executorId, ban);
      const tag = ban.user.tag ?? ban.user.id;

      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle("🔨 Member Banned")
        .setThumbnail(ban.user.displayAvatarURL({ size: 64 }))
        .addFields(
          { name: "User",   value: `<@${ban.user.id}> (${tag})`, inline: true },
          { name: "By",     value: `<@${executorId}>`,           inline: true },
          { name: "Reason", value: ban.reason ?? "*No reason provided*", inline: false },
        )
        .setFooter({ text: `User ID: ${ban.user.id}` })
        .setTimestamp();
      await postAntiNukeLog(client, guild, embed);

      await handleAction(client, guild, executorId, "ban", `Banned user: **${tag}**`);
    })().catch(err => console.error("[ANTINUKE] guildBanAdd handler:", err));
  });

  // ── Kick ──────────────────────────────────────────────────────────────────
  client.on(Events.GuildMemberRemove, (member) => {
    const guild = member.guild;
    void (async () => {
      await new Promise<void>(res => setTimeout(res, AUDIT_DELAY_MS));
      try {
        const logs  = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 5 });
        const entry = logs.entries.find(
          e => e.target?.id === member.id && Date.now() - e.createdTimestamp < 8_000,
        );
        if (!entry?.executor) return; // was a leave, not a kick

        const executorId = entry.executor.id;
        const tag = member.user?.tag ?? member.id;

        const embed = new EmbedBuilder()
          .setColor(0xFF8C00)
          .setTitle("👢 Member Kicked")
          .setThumbnail(member.user?.displayAvatarURL({ size: 64 }) ?? null)
          .addFields(
            { name: "User",   value: `<@${member.id}> (${tag})`,    inline: true },
            { name: "By",     value: `<@${executorId}>`,             inline: true },
            { name: "Reason", value: entry.reason ?? "*No reason provided*", inline: false },
          )
          .setFooter({ text: `User ID: ${member.id}` })
          .setTimestamp();
        await postAntiNukeLog(client, guild, embed);

        await handleAction(client, guild, executorId, "kick", `Kicked user: **${tag}**`);
      } catch { /* ignore */ }
    })().catch(err => console.error("[ANTINUKE] kick handler:", err));
  });

  // ── Guild Update ──────────────────────────────────────────────────────────
  client.on(Events.GuildUpdate, (oldGuild, newGuild) => {
    void (async () => {
      const changes: string[] = [];
      if (oldGuild.name !== newGuild.name)
        changes.push(`Name: \`${oldGuild.name}\` → \`${newGuild.name}\``);
      if (oldGuild.mfaLevel !== newGuild.mfaLevel)
        changes.push("MFA requirement changed");
      if (oldGuild.verificationLevel !== newGuild.verificationLevel)
        changes.push("Verification level changed");
      if (changes.length === 0) return;

      const executorId = await resolveExecutor(newGuild, AuditLogEvent.GuildUpdate);
      if (!executorId) return;

      const embed = new EmbedBuilder()
        .setColor(0xFFAA00)
        .setTitle("⚠️ Server Settings Updated")
        .addFields(
          { name: "Changes",  value: changes.join("\n"), inline: false },
          { name: "By",       value: `<@${executorId}>`, inline: true  },
        )
        .setFooter({ text: `Executor ID: ${executorId}` })
        .setTimestamp();
      await postAntiNukeLog(client, newGuild, embed);

      await handleAction(client, newGuild, executorId, "guildUpdate", changes.join("\n"));
    })().catch(err => console.error("[ANTINUKE] guildUpdate handler:", err));
  });

  // ── Webhook Create ────────────────────────────────────────────────────────
  client.on(Events.WebhooksUpdate, (channel) => {
    if (channel.isDMBased()) return;
    const guild = channel.guild;
    void (async () => {
      const executorId = await resolveExecutor(guild, AuditLogEvent.WebhookCreate);
      if (!executorId) return;
      const name = "name" in channel ? String(channel.name) : "unknown";

      const embed = new EmbedBuilder()
        .setColor(0xAA44FF)
        .setTitle("🪝 Webhook Created")
        .addFields(
          { name: "Channel", value: `**#${name}**`,     inline: true },
          { name: "By",      value: `<@${executorId}>`, inline: true },
        )
        .setFooter({ text: `Executor ID: ${executorId}` })
        .setTimestamp();
      await postAntiNukeLog(client, guild, embed);

      await handleAction(client, guild, executorId, "webhookCreate", `Webhook created in **#${name}**`);
    })().catch(err => console.error("[ANTINUKE] webhookCreate handler:", err));
  });

  // ── Emoji Delete ──────────────────────────────────────────────────────────
  client.on(Events.GuildEmojiDelete, (emoji) => {
    const guild = emoji.guild;
    void (async () => {
      const executorId = await resolveExecutor(guild, AuditLogEvent.EmojiDelete);
      if (!executorId) return;

      const embed = new EmbedBuilder()
        .setColor(0xFF6B35)
        .setTitle("🗑️ Emoji Deleted")
        .addFields(
          { name: "Emoji", value: `**:${emoji.name}:**`, inline: true },
          { name: "By",    value: `<@${executorId}>`,    inline: true },
        )
        .setFooter({ text: `Executor ID: ${executorId}` })
        .setTimestamp();
      await postAntiNukeLog(client, guild, embed);

      await handleAction(client, guild, executorId, "emojiDelete", `Deleted emoji: **:${emoji.name}:**`);
    })().catch(err => console.error("[ANTINUKE] emojiDelete handler:", err));
  });

  // ── Webhook Message Spam ──────────────────────────────────────────────────
  // Two-layer detector. Shared action pipeline extracted to triggerWebhookSpamAction().
  client.on(Events.MessageCreate, (message) => {
    if (!message.webhookId || !message.guild) return;
    const webhookId = message.webhookId;
    const now       = Date.now();

    // ── Layer 2: duplicate-content (slow steady spammer staying under rate limit)
    const rawContent = (message.content ?? "").toLowerCase().replace(/\s+/g, " ").trim();
    const contentKey = rawContent.slice(0, 200);
    if (contentKey.length > 0) {
      const dupeCutoff = now - WEBHOOK_DUPE_WINDOW;
      let seen = webhookContentSeen.get(webhookId);
      if (!seen) { seen = new Map(); webhookContentSeen.set(webhookId, seen); }
      for (const [k, t] of seen) { if (t < dupeCutoff) seen.delete(k); }

      if (seen.has(contentKey)) {
        console.log(`[ANTINUKE/WEBHOOK-SPAM] DUPLICATE CONTENT — webhookId=${webhookId} guild=${message.guild.id}`);
        seen.delete(contentKey);
        webhookMsgTimestamps.delete(webhookId);
        triggerWebhookSpamAction(client, message.guild, message.channel, webhookId, 2, "duplicate content — same message sent twice within 60s");
        return;
      }
      seen.set(contentKey, now);
    }

    // ── Layer 1: volume (fast spammer)
    const cutoff = now - WEBHOOK_MSG_WINDOW;
    const times  = (webhookMsgTimestamps.get(webhookId) ?? []).filter(t => t > cutoff);
    times.push(now);
    webhookMsgTimestamps.set(webhookId, times);

    console.log(`[ANTINUKE/WEBHOOK-SPAM] volume=${times.length}/${WEBHOOK_MSG_LIMIT} webhookId=${webhookId} guild=${message.guild.id}`);
    if (times.length < WEBHOOK_MSG_LIMIT) return;

    console.log(`[ANTINUKE/WEBHOOK-SPAM] VOLUME THRESHOLD HIT — triggering action`);
    webhookMsgTimestamps.delete(webhookId);
    triggerWebhookSpamAction(client, message.guild, message.channel, webhookId, times.length, `volume — ${times.length} messages in ${WEBHOOK_MSG_WINDOW / 1_000}s`);
  });

  console.log("[ANTINUKE] Event listeners registered (channelDelete, roleDelete, ban, kick, guildUpdate, webhookCreate, emojiDelete, webhookMsgSpam)");
}
