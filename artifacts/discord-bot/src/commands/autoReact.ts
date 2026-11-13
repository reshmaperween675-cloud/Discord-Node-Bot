import { parseEmoji, type Message } from "discord.js";
import { getPool } from "../persistence.js";
import { isLowoOwner } from "../utility/lowoOwner.js";

export interface AutoReactTarget {
  userId: string;
  emoji: string;
}

interface CachedConfig {
  config: AutoReactTarget[];
  expiresAt: number;
}

const CACHE_TTL_MS = 5_000;
const configCache = new Map<string, CachedConfig>();

function configKey(guildId: string): string {
  return `autoreact:${guildId}`;
}

export function canManageAutoReact(userId: string, guildOwnerId: string): boolean {
  return isLowoOwner(userId) || userId === guildOwnerId;
}

export function isUnicodeEmoji(value: string): boolean {
  return /^(?:\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier}|\u200D\p{Extended_Pictographic})*|\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3)$/u.test(value);
}

function resolveEmoji(message: Message, input: string): string | null {
  if (input.includes("%")) return null;
  const customMatch = input.match(/^<a?:[A-Za-z0-9_]{2,32}:(\d{17,19})>$/);
  if (customMatch) {
    return message.guild?.emojis.cache.get(customMatch[1]!)?.toString() ?? null;
  }

  const parsed = parseEmoji(input);
  return parsed?.name && !parsed.id && isUnicodeEmoji(parsed.name) ? parsed.name : null;
}

export function normalizeAutoReactConfig(value: unknown): AutoReactTarget[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const targets = Array.isArray(record.targets)
    ? record.targets
    : typeof record.userId === "string" && typeof record.emoji === "string"
      ? [{ userId: record.userId, emoji: record.emoji }]
      : [];

  return targets.filter(
    (target): target is AutoReactTarget =>
      !!target &&
      typeof target === "object" &&
      typeof target.userId === "string" &&
      typeof target.emoji === "string",
  );
}

export function upsertAutoReactTarget(
  targets: AutoReactTarget[],
  target: AutoReactTarget,
): AutoReactTarget[] {
  const index = targets.findIndex((entry) => entry.userId === target.userId);
  if (index === -1) return [...targets, target];
  return targets.map((entry, entryIndex) => entryIndex === index ? target : entry);
}

async function loadConfig(guildId: string): Promise<AutoReactTarget[]> {
  const cached = configCache.get(guildId);
  if (cached && cached.expiresAt > Date.now()) return cached.config;

  const result = await getPool().query<{ value: unknown }>(
    "SELECT value FROM bot_kv WHERE key = $1",
    [configKey(guildId)],
  );
  const config = normalizeAutoReactConfig(result.rows[0]?.value);
  configCache.set(guildId, { config, expiresAt: Date.now() + CACHE_TTL_MS });
  return config;
}

async function saveConfig(guildId: string, config: AutoReactTarget[]): Promise<void> {
  await getPool().query(
    `INSERT INTO bot_kv (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
    [configKey(guildId), JSON.stringify({ targets: config })],
  );
  configCache.set(guildId, { config, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function disableConfig(guildId: string): Promise<void> {
  await getPool().query("DELETE FROM bot_kv WHERE key = $1", [configKey(guildId)]);
  configCache.set(guildId, { config: [], expiresAt: Date.now() + CACHE_TTL_MS });
}

export async function handleAutoReactMessage(message: Message): Promise<boolean> {
  const guild = message.guild;
  if (!guild) return false;

  const commandMatch = message.content.trim().match(/^\?autoreact(?:\s+([\s\S]*))?$/i);
  if (commandMatch) {
    if (!canManageAutoReact(message.author.id, guild.ownerId)) {
      await message.reply("no ez 😂🤣🤣🤣");
      return true;
    }

    const args = (commandMatch[1] ?? "").trim().split(/\s+/).filter(Boolean);
    if (args.length === 1 && args[0]?.toLowerCase() === "disable") {
      try {
        await disableConfig(guild.id);
        await message.reply("✅ Auto-react disabled for this server.");
      } catch (error) {
        console.error("[AUTOREACT] Failed to disable auto-react:", error);
        await message.reply("❌ Could not disable auto-react. Please try again.");
      }
      return true;
    }

    const target = message.mentions.users.first();
    const emojiInput = args[1];
    if (
      args.length !== 2 ||
      message.mentions.users.size !== 1 ||
      !target ||
      target.bot ||
      !emojiInput
    ) {
      await message.reply("Usage: `?autoreact @user <emoji>` or `?autoreact disable`");
      return true;
    }

    const emoji = resolveEmoji(message, emojiInput);
    if (!emoji) {
      await message.reply("❌ Use a valid Unicode emoji or an emoji from this server.");
      return true;
    }

    try {
      const currentTargets = await loadConfig(guild.id);
      const updatedTargets = upsertAutoReactTarget(currentTargets, {
        userId: target.id,
        emoji,
      });
      await saveConfig(guild.id, updatedTargets);
      await message.reply(`✅ I'll react with ${emoji} to ${target}'s messages in this server.`);
    } catch (error) {
      console.error("[AUTOREACT] Failed to save auto-react:", error);
      await message.reply("❌ Could not configure auto-react. Please try again.");
    }
    return true;
  }

  const config = await loadConfig(guild.id);
  const target = config.find((entry) => entry.userId === message.author.id);
  if (target) {
    await message.react(target.emoji);
  }
  return false;
}
