import {
  Message,
  GuildMember,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
} from "discord.js";
import { getPool } from "../persistence.js";
import { getCensorConfig } from "./store.js";

const HR = "⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯";

export interface BlacklistEntry {
  word: string;
  timeoutMs: number;
}

// ── In-memory cache: guildId -> Map<word, timeoutMs> ─────────────────────────
// Loaded lazily on first check, refreshed whenever the list is modified.
const cache = new Map<string, Map<string, number>>();

async function loadGuildWords(guildId: string): Promise<Map<string, number>> {
  const db = getPool();
  const res = await db.query<{ word: string; timeout_ms: string }>(
    "SELECT word, timeout_ms FROM blacklisted_words WHERE guild_id = $1",
    [guildId]
  );
  const map = new Map<string, number>();
  for (const row of res.rows) map.set(row.word, Number(row.timeout_ms));
  cache.set(guildId, map);
  return map;
}

async function getGuildWords(guildId: string): Promise<Map<string, number>> {
  if (cache.has(guildId)) return cache.get(guildId)!;
  return loadGuildWords(guildId);
}

export async function addBlacklistWords(
  guildId: string,
  words: string[],
  timeoutMs: number,
  addedBy: string
): Promise<void> {
  const db = getPool();
  const now = new Date().toISOString();
  for (const word of words) {
    await db.query(
      `INSERT INTO blacklisted_words (guild_id, word, timeout_ms, added_by, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (guild_id, word) DO UPDATE SET timeout_ms = $3, added_by = $4`,
      [guildId, word, timeoutMs, addedBy, now]
    );
  }
  await loadGuildWords(guildId);
}

export async function removeBlacklistWord(guildId: string, word: string): Promise<boolean> {
  const db = getPool();
  const res = await db.query(
    "DELETE FROM blacklisted_words WHERE guild_id = $1 AND word = $2",
    [guildId, word]
  );
  await loadGuildWords(guildId);
  return (res.rowCount ?? 0) > 0;
}

export async function clearBlacklistWords(guildId: string): Promise<void> {
  const db = getPool();
  await db.query("DELETE FROM blacklisted_words WHERE guild_id = $1", [guildId]);
  cache.set(guildId, new Map());
}

export async function listBlacklistWords(guildId: string): Promise<BlacklistEntry[]> {
  const map = await getGuildWords(guildId);
  return [...map.entries()].map(([word, timeoutMs]) => ({ word, timeoutMs }));
}

/**
 * Checks message content against the guild's blacklist.
 * Uses a simple case-insensitive substring match, consistent with the
 * SUBSTRING_CORES approach used by the main censor detector.
 */
export async function findBlacklistedWord(
  guildId: string,
  content: string
): Promise<BlacklistEntry | null> {
  const map = await getGuildWords(guildId);
  if (map.size === 0) return null;
  const lower = content.toLowerCase();
  for (const [word, timeoutMs] of map) {
    if (lower.includes(word)) return { word, timeoutMs };
  }
  return null;
}

// ── Duration parsing ──────────────────────────────────────────────────────────
// Accepts: "30s", "10m", "2h", "1d", or a bare number of minutes ("10").
// Discord's max timeout duration is 28 days.
const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

export function parseDuration(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  const match = /^(\d+)\s*(s|sec|secs|m|min|mins|h|hr|hrs|d|day|days)?$/.exec(s);
  if (!match) return null;
  const amount = parseInt(match[1], 10);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = match[2] ?? "m";
  let ms: number;
  if (unit.startsWith("s")) ms = amount * 1_000;
  else if (unit.startsWith("m")) ms = amount * 60_000;
  else if (unit.startsWith("h")) ms = amount * 3_600_000;
  else ms = amount * 86_400_000;
  if (ms > MAX_TIMEOUT_MS) return null;
  return ms;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds && parts.length === 0) parts.push(`${seconds}s`);
  return parts.length > 0 ? parts.join(" ") : "0s";
}

// ── ?blwords command ──────────────────────────────────────────────────────────
//
// Usage:
//   ?blwords <word1, word2, ...> <duration>   — blacklist words + timeout duration
//   ?blwords list                              — show the current blacklist
//   ?blwords remove <word>                     — remove a single word
//   ?blwords clear                             — remove all blacklisted words
export async function handleBlacklistCommand(message: Message): Promise<void> {
  if (!message.guild) {
    await message.reply("This command can only be used in a server.").catch(() => {});
    return;
  }

  const member = message.member as GuildMember | null;
  if (!member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply("❌ You need **Manage Server** permission to configure the word blacklist.").catch(() => {});
    return;
  }

  const guildId = message.guild.id;
  const rest = message.content.trim().slice("?blwords".length).trim();
  const firstToken = rest.split(/\s+/)[0]?.toLowerCase();

  if (rest === "" || firstToken === "help") {
    await sendUsage(message);
    return;
  }

  if (firstToken === "list") {
    const entries = await listBlacklistWords(guildId);
    if (entries.length === 0) {
      await message.reply("ℹ️ No words are currently blacklisted in this server.").catch(() => {});
      return;
    }
    const lines = entries
      .map((e) => `▸ \`${e.word}\` — timeout **${formatDuration(e.timeoutMs)}**`)
      .join("\n");
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setAuthor({ name: "LAST STAND  ·  MODERATION" })
      .setTitle("🚫  Blacklisted Words")
      .setDescription(`${HR}\n${lines}\n${HR}`)
      .setFooter({ text: `${entries.length} word(s)` })
      .setTimestamp();
    await message.reply({ embeds: [embed] }).catch(() => {});
    return;
  }

  if (firstToken === "clear") {
    await clearBlacklistWords(guildId);
    await message.reply("✅ Cleared the entire word blacklist for this server.").catch(() => {});
    return;
  }

  if (firstToken === "remove") {
    const word = rest.slice("remove".length).trim().toLowerCase();
    if (!word) {
      await message.reply("❌ Please specify a word to remove. Example: `?blwords remove fuck`").catch(() => {});
      return;
    }
    const removed = await removeBlacklistWord(guildId, word);
    await message.reply(
      removed ? `✅ Removed \`${word}\` from the blacklist.` : `ℹ️ \`${word}\` was not on the blacklist.`
    ).catch(() => {});
    return;
  }

  // ── Add/update mode: ?blwords word1, word2, ... <duration> ──────────────────
  const lastSpace = rest.lastIndexOf(" ");
  if (lastSpace === -1) {
    await sendUsage(message);
    return;
  }
  const wordsPart = rest.slice(0, lastSpace).trim();
  const durationPart = rest.slice(lastSpace + 1).trim();

  const timeoutMs = parseDuration(durationPart);
  if (!timeoutMs) {
    await message.reply(
      "❌ Invalid timeout duration. Use something like `10m`, `1h`, `2d`, or `30s` (max 28 days).\n" +
      "**Usage:** `?blwords word1, word2, word3 10m`"
    ).catch(() => {});
    return;
  }

  const words = wordsPart
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 0);

  if (words.length === 0) {
    await sendUsage(message);
    return;
  }

  await addBlacklistWords(guildId, words, timeoutMs, message.author.id);

  const wordList = words.map((w) => `\`${w}\``).join(", ");
  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setAuthor({ name: "LAST STAND  ·  MODERATION" })
    .setTitle("🚫  Words Blacklisted")
    .setDescription(
      `${HR}\n▸  **WORDS** ${wordList}\n▸  **TIMEOUT** \`${formatDuration(timeoutMs)}\`\n▸  **SET BY** <@${message.author.id}>\n${HR}\nAnyone who sends a message containing these words will have it deleted and be timed out for **${formatDuration(timeoutMs)}**.`
    )
    .setFooter({ text: "Last Stand (LS)  ·  Moderation" })
    .setTimestamp();
  await message.reply({ embeds: [embed] }).catch(() => {});
}

async function sendUsage(message: Message): Promise<void> {
  await message.reply(
    "**Word Blacklist — Usage:**\n" +
    "`?blwords word1, word2, word3 10m` — Blacklist words, timeout duration on use\n" +
    "`?blwords list` — Show all blacklisted words\n" +
    "`?blwords remove <word>` — Remove a single word\n" +
    "`?blwords clear` — Remove all blacklisted words\n\n" +
    "Duration accepts `s`/`m`/`h`/`d` suffixes (e.g. `30s`, `10m`, `2h`, `1d`), max 28 days."
  ).catch(() => {});
}

// ── Message enforcement ───────────────────────────────────────────────────────
// Called on every non-bot message, independent of the main slur censor toggle.
export async function handleBlacklistMessage(message: Message): Promise<void> {
  if (!message.guild || message.author.bot) return;

  const match = await findBlacklistedWord(message.guild.id, message.content).catch(() => null);
  if (!match) return;

  let messageDeleted = false;
  try {
    await message.delete();
    messageDeleted = true;
  } catch (err: any) {
    console.error(`[BLACKLIST] Failed to delete message — check Manage Messages permission. Error: ${err?.message ?? err}`);
  }

  const member = message.member as GuildMember | null;
  let timedOut = false;
  if (member && message.guild.ownerId !== message.author.id && member.moderatable) {
    try {
      await member.timeout(match.timeoutMs, `Used blacklisted word: ${match.word}`);
      timedOut = true;
    } catch (err: any) {
      console.error(`[BLACKLIST] Timeout failed — ensure Moderate Members permission and role hierarchy. Error: ${err?.message ?? err}`);
    }
  }

  try {
    await (message.channel as TextChannel).send({
      content: `<@${message.author.id}> ⚠️ Your message was removed for using a blacklisted word${timedOut ? ` and you've been timed out for **${formatDuration(match.timeoutMs)}**` : ""}.`,
    });
  } catch {
    /* channel not sendable */
  }

  console.log(
    `[BLACKLIST] "${match.word}" from ${message.author.tag} in #${(message.channel as TextChannel).name ?? "?"} — deleted=${messageDeleted}, timedOut=${timedOut}`
  );

  // Reuse the censor system's mod-log channel if one is configured.
  try {
    const config = await getCensorConfig(message.guild.id);
    if (config.modLogChannelId) {
      const logChannel = message.guild.channels.cache.get(config.modLogChannelId) as TextChannel | undefined;
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("🚫  Blacklisted Word Used")
          .addFields(
            { name: "👤  User", value: `<@${message.author.id}> (${message.author.tag})`, inline: true },
            { name: "📍  Channel", value: `<#${message.channel.id}>`, inline: true },
            { name: "⏱️  Timeout", value: timedOut ? formatDuration(match.timeoutMs) : "Failed to apply", inline: true },
            { name: "🏷️  Matched Word", value: `\`${match.word}\``, inline: false },
            { name: "💬  Original Message", value: `\`\`\`${message.content.slice(0, 300)}\`\`\``, inline: false },
          )
          .setFooter({ text: "Last Stand Management · Word Blacklist" })
          .setTimestamp();
        await logChannel.send({ embeds: [embed] }).catch(() => {});
      }
    }
  } catch {
    /* config lookup failed — non-fatal */
  }
}
