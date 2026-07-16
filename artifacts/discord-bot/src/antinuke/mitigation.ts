import type { Client, Guild } from "discord.js";
import { EmbedBuilder, TextChannel } from "discord.js";
import { clearActions, getConfig } from "./store.js";
import type { ActionType } from "./store.js";

const quarantineActive = new Set<string>();

export async function quarantine(
  client: Client,
  guild: Guild,
  executorId: string,
  isBotExecutor: boolean,
  action: ActionType,
  details: string,
): Promise<boolean> {
  const key = `${guild.id}:${executorId}`;
  if (quarantineActive.has(key)) return false;
  quarantineActive.add(key);
  clearActions(guild.id, executorId);

  console.warn(
    `[ANTINUKE] Quarantine | Guild: ${guild.name} (${guild.id}) | Executor: ${executorId} | Bot: ${isBotExecutor} | Action: ${action}`,
  );

  const config = await getConfig(guild.id);
  const effectivePunish = isBotExecutor ? "ban" : config.punishAction;
  const actionsTaken: string[] = [];

  // ── Punish ────────────────────────────────────────────────────────────────
  if (effectivePunish === "ban") {
    if (isBotExecutor) {
      try {
        await guild.bans.create(executorId, {
          reason: `Anti-Nuke: rogue bot — ${action}`,
          deleteMessageSeconds: 0,
        });
        actionsTaken.push("banned (bot — instant ban)");
      } catch (e) {
        console.error("[ANTINUKE] Bot ban failed:", (e as Error).message);
        actionsTaken.push("ban failed — check permissions / role hierarchy");
      }
    } else {
      const member = guild.members.cache.get(executorId)
        ?? await guild.members.fetch(executorId).catch(() => null);

      await Promise.all([
        member
          ? member.roles.set([], "Anti-Nuke: roles stripped").catch(() => {})
          : Promise.resolve(),
        guild.bans.create(executorId, {
          reason: `Anti-Nuke: threshold exceeded — ${action}`,
          deleteMessageSeconds: 0,
        }).catch((e) => {
          console.error("[ANTINUKE] Ban failed:", (e as Error).message);
        }),
      ]);
      actionsTaken.push("roles stripped and banned");
    }

  } else if (effectivePunish === "kick") {
    const member = guild.members.cache.get(executorId)
      ?? await guild.members.fetch(executorId).catch(() => null);

    if (member) {
      const stripped = member.roles.set([], "Anti-Nuke: instant strip before kick").catch(() => null);
      await stripped;
      await member.kick(`Anti-Nuke: threshold exceeded — ${action}`).catch(async () => {
        await member.roles.set([], "Anti-Nuke: kick failed, stripping as fallback").catch(() => {});
        actionsTaken.push("kick failed — stripped roles instead");
        return;
      });
      actionsTaken.push("roles stripped and kicked");
    } else {
      actionsTaken.push("member not found");
    }

  } else {
    // strip
    const member = guild.members.cache.get(executorId)
      ?? await guild.members.fetch(executorId).catch(() => null);

    if (member) {
      await member.roles.set([], "Anti-Nuke: automated quarantine — roles stripped").catch((e) => {
        console.error("[ANTINUKE] Strip failed:", (e as Error).message);
      });
      actionsTaken.push("all roles stripped");
    } else {
      actionsTaken.push("member not found");
    }
  }

  // ── Webhook cleanup ───────────────────────────────────────────────────────
  if (action === "webhookCreate") {
    try {
      const all    = await guild.fetchWebhooks();
      const cutoff = Date.now() - 120_000;
      let deleted  = 0;
      for (const wh of all.values()) {
        if (wh.createdTimestamp > cutoff) {
          await wh.delete("Anti-Nuke: rogue webhook cleanup").catch(() => {});
          deleted++;
        }
      }
      if (deleted > 0) actionsTaken.push(`deleted ${deleted} rogue webhook(s)`);
    } catch (e) {
      console.error("[ANTINUKE] Webhook cleanup failed:", e);
    }
  }

  // ── Log + DM — fully async, never blocks punishment ──────────────────────
  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle("someone tried to nuke the server")
    .addFields(
      { name: "who",          value: `<@${executorId}> (\`${executorId}\`)`, inline: false },
      { name: "what they did", value: details,                                inline: false },
      { name: "punishment",   value: effectivePunish,                         inline: false },
    )
    .setFooter({ text: guild.name })
    .setTimestamp();

  void (async () => {
    if (config.logChannelId) {
      try {
        const ch = await client.channels.fetch(config.logChannelId);
        if (ch && !ch.isDMBased() && ch.isTextBased()) {
          const pingIds = config.logPingIds ?? [];
          const content = pingIds.length > 0 ? pingIds.map(id => `<@${id}>`).join(" ") : undefined;
          await (ch as TextChannel).send({ content, embeds: [embed] });
        }
      } catch (e) {
        console.error("[ANTINUKE] Log channel send failed:", (e as Error).message);
      }
    }

    try {
      const owner = await guild.fetchOwner();
      await owner.send({
        content: `someone just tried to nuke **${guild.name}** and got caught`,
        embeds: [embed],
      });
    } catch { /* DMs closed */ }
  })();

  setTimeout(() => quarantineActive.delete(key), 60_000);
  return true;
}

/**
 * Lenient quarantine — applied when a WHITELISTED user crosses the higher
 * lenient threshold. Always strips roles (never bans or kicks).
 * Posts a distinct warning embed to the log channel.
 * Does NOT trigger auto-restore — owner should review manually.
 */
export async function lenientQuarantine(
  client: Client,
  guild: Guild,
  executorId: string,
  action: ActionType,
  details: string,
): Promise<boolean> {
  const key = `lenient:${guild.id}:${executorId}`;
  if (quarantineActive.has(key)) return false;
  quarantineActive.add(key);
  clearActions(guild.id, executorId);

  console.warn(
    `[ANTINUKE] Lenient quarantine | Guild: ${guild.name} (${guild.id}) | Executor: ${executorId} | Action: ${action}`,
  );

  const config = await getConfig(guild.id);

  // Always strip — never ban/kick a whitelisted user
  const member = guild.members.cache.get(executorId)
    ?? await guild.members.fetch(executorId).catch(() => null);

  if (member) {
    await member.roles.set([], "Anti-Nuke: whitelisted user exceeded lenient threshold — roles stripped").catch((e) => {
      console.error("[ANTINUKE] Lenient strip failed:", (e as Error).message);
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0xFF8C00)
    .setTitle("a whitelisted user went rogue")
    .setDescription(
      `<@${executorId}> is on the lenient whitelist but crossed the extended threshold for \`${action}\`\n\n` +
      `**what they did:** ${details}\n\n` +
      `their roles have been stripped — review this manually and use \`?antinuke restore <@${executorId}>\` if you want to give them back`,
    )
    .addFields(
      { name: "user",       value: `<@${executorId}> (\`${executorId}\`)`, inline: true },
      { name: "trigger",    value: `\`${action}\``,                         inline: true },
      { name: "punishment", value: "roles stripped (whitelist — strip only)", inline: false },
    )
    .setFooter({ text: guild.name })
    .setTimestamp();

  void (async () => {
    if (config.logChannelId) {
      try {
        const ch = await client.channels.fetch(config.logChannelId);
        if (ch && !ch.isDMBased() && ch.isTextBased()) {
          const pingIds = config.logPingIds ?? [];
          const content = pingIds.length > 0 ? pingIds.map(id => `<@${id}>`).join(" ") : undefined;
          await (ch as TextChannel).send({ content, embeds: [embed] });
        }
      } catch (e) {
        console.error("[ANTINUKE] Lenient log send failed:", (e as Error).message);
      }
    }

    try {
      const owner = await guild.fetchOwner();
      await owner.send({
        content: `heads up — a whitelisted staff member went rogue in **${guild.name}** and their roles got stripped`,
        embeds: [embed],
      });
    } catch { /* DMs closed */ }
  })();

  setTimeout(() => quarantineActive.delete(key), 60_000);
  return true;
}
