import type { Client, Guild } from "discord.js";
import { EmbedBuilder, TextChannel } from "discord.js";
import { clearActions, getConfig } from "./store.js";
import type { ActionType } from "./store.js";

// Tracks guilds currently mid-quarantine to avoid re-entry
const quarantineActive = new Set<string>(); // `${guildId}:${executorId}`

export async function quarantine(
  client: Client,
  guild: Guild,
  executorId: string,
  action: ActionType,
  details: string,
): Promise<void> {
  const key = `${guild.id}:${executorId}`;
  if (quarantineActive.has(key)) return; // prevent re-entry
  quarantineActive.add(key);

  clearActions(guild.id, executorId);
  console.warn(
    `[ANTINUKE] 🚨 Quarantine | Guild: ${guild.name} (${guild.id}) | Executor: ${executorId} | Action: ${action}`,
  );

  // ── 1. Fetch executor ────────────────────────────────────────────────────
  let tag = `Unknown (${executorId})`;
  try {
    const member = await guild.members.fetch(executorId);
    tag = `${member.user.tag} (${executorId})`;

    // ── 2. Strip all roles immediately ──────────────────────────────────
    try {
      await member.roles.set([], "Anti-Nuke: automated quarantine");
    } catch (e) {
      console.error("[ANTINUKE] Role strip failed:", (e as Error).message);
    }
  } catch {
    // Member already left or bot can't fetch — still attempt ban below
  }

  // ── 3. Ban ───────────────────────────────────────────────────────────────
  try {
    await guild.members.ban(executorId, {
      reason: `Anti-Nuke: automated ban — ${action} threshold exceeded`,
      deleteMessageSeconds: 0,
    });
  } catch (e) {
    console.error("[ANTINUKE] Ban failed:", (e as Error).message);
  }

  // ── 4. Build esports-style embed ─────────────────────────────────────────
  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setAuthor({ name: "⚡ ANTI-NUKE SYSTEM — THREAT NEUTRALIZED" })
    .setTitle("🚨 Rogue Staff Quarantined")
    .setDescription(
      "A staff member exceeded the action threshold and has been **immediately quarantined**.\n" +
      "All roles have been stripped and the account has been banned.",
    )
    .addFields(
      { name: "👤 Threat Actor",    value: `<@${executorId}>\n\`${tag}\``, inline: true },
      { name: "⚡ Trigger",         value: `\`${action}\``,                inline: true },
      { name: "📋 Details",         value: details,                        inline: false },
      { name: "🔒 Actions Taken",   value: "• All roles stripped\n• Account banned", inline: false },
    )
    .setFooter({ text: `Last Stand Anti-Nuke • ${guild.name}` })
    .setTimestamp();

  // ── 5. Send to log channel ───────────────────────────────────────────────
  const config = await getConfig(guild.id);
  if (config.logChannelId) {
    try {
      const ch = await client.channels.fetch(config.logChannelId);
      if (ch && !ch.isDMBased() && ch.isTextBased()) {
        await (ch as TextChannel).send({ embeds: [embed] });
      }
    } catch (e) {
      console.error("[ANTINUKE] Log channel send failed:", (e as Error).message);
    }
  }

  // ── 6. DM server owner ───────────────────────────────────────────────────
  try {
    const owner = await guild.fetchOwner();
    await owner.send({
      content: `🚨 **Anti-Nuke alert on \`${guild.name}\`!** A rogue staff member has been automatically banned.`,
      embeds: [embed],
    });
  } catch (e) {
    console.error("[ANTINUKE] Owner DM failed:", (e as Error).message);
  }

  // Allow re-entry after 60 seconds (in case ban gets reversed)
  setTimeout(() => quarantineActive.delete(key), 60_000);
}
