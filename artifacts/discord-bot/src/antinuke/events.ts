import type { Client, Guild } from "discord.js";
import { Events, AuditLogEvent } from "discord.js";
import { getConfig, getWhitelist, recordAction } from "./store.js";
import type { ActionType } from "./store.js";
import { quarantine } from "./mitigation.js";
import { recordChannelSnap, recordRoleSnap, recordBanSnap } from "./snapshot.js";

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
async function handleAction(
  client: Client,
  guild: Guild,
  executorId: string,
  action: ActionType,
  details: string,
): Promise<void> {
  const config = await getConfig(guild.id);
  if (!config.enabled) return;

  // Never act against: bot itself, guild owner, whitelisted users
  const botId  = client.user!.id;
  if (executorId === guild.ownerId || executorId === botId) return;

  const whitelist = await getWhitelist(guild.id);
  if (whitelist.has(executorId)) return;

  const triggered = recordAction(guild.id, executorId, action, config);
  if (triggered) {
    await quarantine(client, guild, executorId, action, details);
  }
}

export function registerAntiNukeEvents(client: Client): void {

  // ── Channel Delete ────────────────────────────────────────────────────────
  client.on(Events.ChannelDelete, (channel) => {
    if (channel.isDMBased()) return;
    const guild = channel.guild;
    const chSnap = channel; // hold reference before async gap
    void (async () => {
      const executorId = await resolveExecutor(guild, AuditLogEvent.ChannelDelete);
      if (!executorId) return;
      // Snapshot the channel attributed to this executor (data still available on object)
      recordChannelSnap(guild.id, executorId, chSnap);
      const name = "name" in channel ? String(channel.name) : "unknown";
      await handleAction(client, guild, executorId, "channelDelete", `Deleted channel: **#${name}**`);
    })().catch(err => console.error("[ANTINUKE] channelDelete handler:", err));
  });

  // ── Role Delete ───────────────────────────────────────────────────────────
  client.on(Events.GuildRoleDelete, (role) => {
    const guild = role.guild;
    void (async () => {
      const executorId = await resolveExecutor(guild, AuditLogEvent.RoleDelete);
      if (!executorId) return;
      // Snapshot the role
      recordRoleSnap(guild.id, executorId, role);
      await handleAction(client, guild, executorId, "roleDelete", `Deleted role: **${role.name}**`);
    })().catch(err => console.error("[ANTINUKE] roleDelete handler:", err));
  });

  // ── Ban Add ───────────────────────────────────────────────────────────────
  client.on(Events.GuildBanAdd, (ban) => {
    const guild = ban.guild;
    void (async () => {
      const executorId = await resolveExecutor(guild, AuditLogEvent.MemberBanAdd);
      if (!executorId) return;
      // Snapshot the ban (so we can unban + DM on restore)
      recordBanSnap(guild.id, executorId, ban);
      const tag = ban.user.tag ?? ban.user.id;
      await handleAction(client, guild, executorId, "ban", `Banned user: **${tag}**`);
    })().catch(err => console.error("[ANTINUKE] guildBanAdd handler:", err));
  });

  // ── Guild Update ──────────────────────────────────────────────────────────
  client.on(Events.GuildUpdate, (oldGuild, newGuild) => {
    void (async () => {
      const changes: string[] = [];
      if (oldGuild.name !== newGuild.name)
        changes.push(`Name: \`${oldGuild.name}\` → \`${newGuild.name}\``);
      if (oldGuild.mfaLevel !== newGuild.mfaLevel)
        changes.push(`MFA requirement changed`);
      if (oldGuild.verificationLevel !== newGuild.verificationLevel)
        changes.push(`Verification level changed`);
      if (changes.length === 0) return;

      const executorId = await resolveExecutor(newGuild, AuditLogEvent.GuildUpdate);
      if (!executorId) return;
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
      await handleAction(client, guild, executorId, "webhookCreate", `Webhook created in **#${name}**`);
    })().catch(err => console.error("[ANTINUKE] webhookCreate handler:", err));
  });

  // ── Emoji Delete ──────────────────────────────────────────────────────────
  client.on(Events.GuildEmojiDelete, (emoji) => {
    const guild = emoji.guild;
    void (async () => {
      const executorId = await resolveExecutor(guild, AuditLogEvent.EmojiDelete);
      if (!executorId) return;
      await handleAction(client, guild, executorId, "emojiDelete", `Deleted emoji: **:${emoji.name}:**`);
    })().catch(err => console.error("[ANTINUKE] emojiDelete handler:", err));
  });

  console.log("[ANTINUKE] Event listeners registered (channelDelete, roleDelete, ban, guildUpdate, webhookCreate, emojiDelete)");
}
