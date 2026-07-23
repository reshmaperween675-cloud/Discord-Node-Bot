import {
  Message,
  TextChannel,
  PermissionFlagsBits,
  GuildMember,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  Collection,
} from "discord.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = resolve(__dirname, "../../data");
const CONFIG_FILE = join(DATA_DIR, "purge_config.json");

interface PurgeConfig {
  allowedUserIds: string[];
}

let cache: PurgeConfig | null = null;

function readConfig(): PurgeConfig {
  if (cache) return cache;
  try {
    if (existsSync(CONFIG_FILE)) {
      const parsed = JSON.parse(readFileSync(CONFIG_FILE, "utf-8")) as Partial<PurgeConfig>;
      cache = { allowedUserIds: Array.isArray(parsed.allowedUserIds) ? parsed.allowedUserIds : [] };
      return cache;
    }
  } catch { /* ignore */ }
  cache = { allowedUserIds: [] };
  return cache;
}

function writeConfig(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(cache ?? { allowedUserIds: [] }, null, 2), "utf-8");
}

// ─── Permission check ─────────────────────────────────────────────────────────
function memberCanPurge(member: GuildMember | null): boolean {
  if (!member) return false;

  // 1) Server admin
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

  // 2) Has ManageMessages (built-in mod permission)
  if (member.permissions.has(PermissionFlagsBits.ManageMessages)) return true;

  // 3) Allow-listed via /purgeconfig
  const cfg = readConfig();
  if (cfg.allowedUserIds.includes(member.id)) return true;

  // 4) Has a role named "Moderator" (case-insensitive) OR a role positioned at/above one
  const modRole = member.guild.roles.cache.find((r) => r.name.toLowerCase() === "moderator");
  if (modRole) {
    const highest = member.roles.highest;
    if (highest.position >= modRole.position && highest.id !== member.guild.id) return true;
  }

  return false;
}

// ─── Recovery cache (in-memory, last 100 deletions per channel) ───────────────
interface CachedDeleted {
  authorId: string;
  authorTag: string;
  content: string;
  attachmentUrls: string[];
  createdAt: number;
}

const recoveryCache = new Map<string, CachedDeleted[]>();
const RECOVERY_LIMIT = 100;

function pushRecoverable(channelId: string, msgs: CachedDeleted[]): void {
  const existing = recoveryCache.get(channelId) ?? [];
  // Newest first
  const merged = [...msgs, ...existing].slice(0, RECOVERY_LIMIT);
  recoveryCache.set(channelId, merged);
}

function snapshotMessage(m: Message): CachedDeleted {
  return {
    authorId: m.author.id,
    authorTag: m.author.tag,
    content: m.content ?? "",
    attachmentUrls: [...m.attachments.values()].map((a) => a.url),
    createdAt: m.createdTimestamp,
  };
}

// ─── Bulk delete helper (handles 14-day Discord limit) ────────────────────────
async function bulkDelete(channel: TextChannel, msgs: Message[]): Promise<number> {
  if (msgs.length === 0) return 0;
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const young = msgs.filter((m) => now - m.createdTimestamp < fourteenDays);
  const old   = msgs.filter((m) => now - m.createdTimestamp >= fourteenDays);

  let deleted = 0;
  if (young.length > 0) {
    try {
      const res = await channel.bulkDelete(young, true);
      deleted += res.size;
    } catch { /* ignore */ }
  }
  // Old messages must be deleted one at a time
  for (const m of old) {
    try {
      await m.delete();
      deleted += 1;
    } catch { /* ignore */ }
  }
  return deleted;
}

async function fetchRecent(channel: TextChannel, limit: number): Promise<Message[]> {
  // Discord caps at 100 per fetch
  const cap = Math.min(Math.max(1, limit), 100);
  const fetched = await channel.messages.fetch({ limit: cap });
  return [...fetched.values()];
}

async function fetchRecentFromUsers(
  channel: TextChannel,
  userIds: Set<string>,
  amountPerUser: number,
): Promise<Message[]> {
  // We scan up to 500 messages back to find enough matches
  const matched: Message[] = [];
  const counts = new Map<string, number>();
  let beforeId: string | undefined;
  let scanned = 0;

  while (scanned < 500) {
    const opts: { limit: number; before?: string } = { limit: 100 };
    if (beforeId) opts.before = beforeId;
    const batch: Collection<string, Message> = await channel.messages.fetch(opts);
    if (batch.size === 0) break;
    const arr = [...batch.values()];
    for (const m of arr) {
      if (userIds.has(m.author.id)) {
        const c = counts.get(m.author.id) ?? 0;
        if (c < amountPerUser) {
          matched.push(m);
          counts.set(m.author.id, c + 1);
        }
      }
    }
    scanned += batch.size;
    beforeId = arr[arr.length - 1].id;

    // Stop early once every user reached the cap
    let allDone = true;
    for (const id of userIds) if ((counts.get(id) ?? 0) < amountPerUser) { allDone = false; break; }
    if (allDone) break;
  }
  return matched;
}

// ─── Reply helpers ────────────────────────────────────────────────────────────
async function ephemeralReply(channel: TextChannel, text: string): Promise<void> {
  try {
    const reply = await channel.send(text);
    setTimeout(() => reply.delete().catch(() => {}), 6000);
  } catch { /* ignore */ }
}

// ─── Main .purge handler ──────────────────────────────────────────────────────
export async function handlePurgeCommand(message: Message): Promise<boolean> {
  const content = message.content.trim();
  if (!content.toLowerCase().startsWith(".purge")) return false;
  if (!message.guild || !message.member) return false;
  if (!(message.channel instanceof TextChannel)) return false;

  const channel = message.channel;

  if (!memberCanPurge(message.member)) {
    await ephemeralReply(channel, "🚫 You don't have permission to use `.purge`.");
    try { await message.delete(); } catch { /* ignore */ }
    return true;
  }
  const args = content.slice(".purge".length).trim().split(/\s+/).filter(Boolean);

  // Delete the invoking command message itself
  try { await message.delete(); } catch { /* ignore */ }

  // ── .purge all  → max 100 most recent
  if (args[0]?.toLowerCase() === "all") {
    const msgs = await fetchRecent(channel, 100);
    pushRecoverable(channel.id, msgs.map(snapshotMessage));
    const n = await bulkDelete(channel, msgs);
    await ephemeralReply(channel, `🧹 Purged **${n}** message(s).`);
    return true;
  }

  // ── .purge <@user> [@user2] <amount>
  const userMentions = [...message.mentions.users.values()];
  const amountToken = args.find((a) => /^\d+$/.test(a));
  const amount = amountToken ? parseInt(amountToken, 10) : NaN;

  if (!amountToken || isNaN(amount) || amount < 1) {
    await ephemeralReply(
      channel,
      "Usage:\n" +
      "`.purge <amount>` — delete N recent messages\n" +
      "`.purge <@user> [@user2 …] <amount>` — delete N from each user\n" +
      "`.purge all` — delete the last 100",
    );
    return true;
  }
  const capped = Math.min(amount, 100);

  if (userMentions.length === 0) {
    // Plain count purge
    const msgs = await fetchRecent(channel, capped);
    pushRecoverable(channel.id, msgs.map(snapshotMessage));
    const n = await bulkDelete(channel, msgs);
    await ephemeralReply(channel, `🧹 Purged **${n}** message(s).`);
    return true;
  }

  // Targeted purge
  const ids = new Set(userMentions.map((u) => u.id));
  const msgs = await fetchRecentFromUsers(channel, ids, capped);
  pushRecoverable(channel.id, msgs.map(snapshotMessage));
  const n = await bulkDelete(channel, msgs);
  const names = userMentions.map((u) => `@${u.username}`).join(", ");
  await ephemeralReply(channel, `🧹 Purged **${n}** message(s) from ${names}.`);
  return true;
}

// ─── /purgeconfig slash command ───────────────────────────────────────────────
export const purgeConfigData = new SlashCommandBuilder()
  .setName("purgeconfig")
  .setDescription("Allow or remove a user's permission to use .purge")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((o) =>
    o.setName("user").setDescription("User to allow / remove").setRequired(true),
  )
  .addStringOption((o) =>
    o.setName("action")
     .setDescription("add or remove (default: toggle)")
     .setRequired(false)
     .addChoices(
       { name: "add",    value: "add" },
       { name: "remove", value: "remove" },
       { name: "list",   value: "list" },
     ),
  );

export async function executePurgeConfig(interaction: ChatInputCommandInteraction): Promise<void> {
  const action = interaction.options.getString("action") ?? "toggle";
  const target = interaction.options.getUser("user", true);
  const cfg = readConfig();

  if (action === "list") {
    if (cfg.allowedUserIds.length === 0) {
      await interaction.editReply({ content: "📋 No users currently allow-listed for `.purge`." });
      return;
    }
    const mentions = cfg.allowedUserIds.map((id) => `<@${id}>`).join(", ");
    await interaction.editReply({
      content: `📋 Allow-listed for \`.purge\`:\n${mentions}`,
    });
    return;
  }

  const has = cfg.allowedUserIds.includes(target.id);
  let added: boolean;
  if (action === "add" || (action === "toggle" && !has)) {
    if (!has) cfg.allowedUserIds.push(target.id);
    added = true;
  } else {
    cfg.allowedUserIds = cfg.allowedUserIds.filter((id) => id !== target.id);
    added = false;
  }
  cache = cfg;
  writeConfig();

  await interaction.editReply({
    content: added
      ? `✅ <@${target.id}> can now use \`.purge\`.`
      : `🚫 <@${target.id}> can no longer use \`.purge\`.`,
  });
}
