import {
  Message,
  Client,
  TextChannel,
  GuildMember,
  PermissionFlagsBits,
  AttachmentBuilder,
} from "discord.js";
import {
  getGuildConfig,
  getUser,
  saveUser,
  getGuildLevelRoles,
  GuildConfig,
} from "./db.js";
import { generateLevelUpCard } from "./card.js";

// ─── XP Formula (Arcane-style) ────────────────────────────────────────────────

export function xpForLevel(level: number): number {
  return 5 * level * level + 50 * level + 100;
}

export function totalXpToReachLevel(target: number): number {
  let sum = 0;
  for (let i = 0; i < target; i++) sum += xpForLevel(i);
  return sum;
}

export function computeLevel(totalXp: number): {
  level: number;
  currentXp: number;
  neededXp: number;
} {
  let level = 0;
  let remaining = totalXp;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  return { level, currentXp: remaining, neededXp: xpForLevel(level) };
}

export function progressBar(current: number, total: number, length = 16): string {
  const pct = total > 0 ? Math.min(current / total, 1) : 0;
  const filled = Math.round(pct * length);
  return "█".repeat(filled) + "░".repeat(length - filled);
}

// ─── Anti-Spam ────────────────────────────────────────────────────────────────

function isSpam(content: string, lastContent: string): boolean {
  const c = content.trim();
  if (c.length < 3) return true;
  if (c === lastContent) return true;
  if (/^(.)\1{5,}$/.test(c)) return true;
  if (c.length < 6 && c === c.toUpperCase() && /[A-Z]/.test(c)) return true;
  return false;
}

// ─── Multiplier Calculation ───────────────────────────────────────────────────

function computeXpGain(config: GuildConfig, memberRoleIds: string[]): number {
  const base =
    Math.floor(Math.random() * (config.xpMax - config.xpMin + 1)) + config.xpMin;
  let roleBonus = 1.0;
  for (const roleId of memberRoleIds) {
    const m = config.roleMultipliers[roleId];
    if (m && m > roleBonus) roleBonus = m;
  }
  const total = config.serverMultiplier * config.eventMultiplier * roleBonus;
  return Math.max(1, Math.round(base * total));
}

// ─── Main message processor ───────────────────────────────────────────────────

export async function processMessage(message: Message, client: Client): Promise<void> {
  if (!message.guild || message.author.bot) return;
  if (message.content.startsWith("/")) return;

  const guildId = message.guild.id;
  const userId = message.author.id;
  const config = await getGuildConfig(guildId);

  if (!config.enabled) return;

  if (config.blacklistedChannels.includes(message.channelId)) return;
  if (
    config.whitelistedChannels.length > 0 &&
    !config.whitelistedChannels.includes(message.channelId)
  )
    return;

  const now = Date.now();
  const user = await getUser(guildId, userId);

  if ((now - user.lastMessageAt) / 1000 < config.cooldown) return;

  const content = message.content.trim();
  if (config.antiSpamEnabled !== false && isSpam(content, user.lastMessageContent)) return;

  const memberRoleIds = message.member
    ? [...message.member.roles.cache.keys()]
    : [];
  const xpGain = computeXpGain(config, memberRoleIds);

  const oldTotalXp = user.totalXp;
  const oldLevel = computeLevel(oldTotalXp).level;

  user.totalXp += xpGain;
  user.weeklyXp += xpGain;
  user.lastMessageAt = now;
  user.lastMessageContent = content;

  const { level: newLevel, currentXp, neededXp } = computeLevel(user.totalXp);
  user.level = newLevel;
  user.xp = currentXp;

  await saveUser(guildId, userId, user);

  if (newLevel > oldLevel && message.member) {
    handleLevelUp(
      message.member,
      oldLevel,
      newLevel,
      config,
      client,
      guildId,
    ).catch((err) => console.error("[LEVELING] Level-up handler error:", err));
  }
}

// ─── Role Assignment (with full permission + hierarchy checks) ─────────────────

async function assignLevelRoles(
  member: GuildMember,
  newLevel: number,
  config: GuildConfig,
  guildId: string,
): Promise<string | undefined> {
  const guild = member.guild;

  try {
    await guild.roles.fetch();
  } catch (err) {
    console.error("[LEVELING] Failed to fetch guild roles:", err);
  }

  const me = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
  if (!me) {
    console.error("[LEVELING] Could not fetch bot member object.");
    return undefined;
  }
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    console.error(
      `[LEVELING] Bot is MISSING ManageRoles permission in guild ${guildId}. Role assignment skipped.`
    );
    return undefined;
  }

  const botHighestPosition = me.roles.highest.position;
  const levelRoles = await getGuildLevelRoles(guildId);

  const rolesToAdd: string[] = [];
  const rolesToRemove: string[] = [];
  let unlockedRoleName: string | undefined;

  for (const [lvlStr, roleName] of Object.entries(levelRoles)) {
    const lvl = Number(lvlStr);

    const role = guild.roles.cache.find(
      (r) => r.name.toLowerCase() === roleName.toLowerCase()
    );

    if (!role) {
      if (lvl <= newLevel) {
        console.error(
          `[LEVELING] Role not found: "${roleName}" (level ${lvl}) in guild ${guildId}. ` +
          `Make sure the role name matches exactly (case-insensitive).`
        );
      }
      continue;
    }

    if (role.position >= botHighestPosition) {
      console.error(
        `[LEVELING] Cannot manage role "${roleName}" (position ${role.position}) — ` +
        `bot's highest role is position ${botHighestPosition}. ` +
        `Move the bot's role ABOVE "${roleName}" in server settings.`
      );
      continue;
    }

    if (lvl === newLevel) {
      unlockedRoleName = roleName;
      if (!member.roles.cache.has(role.id)) {
        rolesToAdd.push(role.id);
        console.log(
          `[LEVELING] Queuing role ADD: "${roleName}" (${role.id}) for ${member.user.tag} reaching level ${newLevel}`
        );
      } else {
        console.log(
          `[LEVELING] "${roleName}" already on ${member.user.tag} — skipping add`
        );
      }
    } else if (!config.keepOldRoles && lvl < newLevel) {
      if (member.roles.cache.has(role.id)) {
        rolesToRemove.push(role.id);
        console.log(
          `[LEVELING] Queuing role REMOVE: "${roleName}" (${role.id}) from ${member.user.tag}`
        );
      }
    }
  }

  if (rolesToRemove.length > 0) {
    try {
      await member.roles.remove(rolesToRemove, `Level-up to ${newLevel} — replacing old role`);
      console.log(`[LEVELING] Removed ${rolesToRemove.length} old role(s) from ${member.user.tag}`);
    } catch (err) {
      console.error("[LEVELING] Failed to remove old roles:", err);
    }
  }

  if (rolesToAdd.length > 0) {
    try {
      await member.roles.add(rolesToAdd, `Reached level ${newLevel}`);
      console.log(
        `[LEVELING] ✅ Granted role "${unlockedRoleName}" to ${member.user.tag} at level ${newLevel}`
      );
    } catch (err) {
      console.error("[LEVELING] ❌ Failed to add role:", err);
    }
  }

  return unlockedRoleName;
}

// ─── Level-up handler ─────────────────────────────────────────────────────────

export async function handleLevelUp(
  member: GuildMember,
  oldLevel: number,
  newLevel: number,
  config: GuildConfig,
  client: Client,
  guildId: string,
  triggeredBy?: { tag: string; command: string },
): Promise<void> {
  const unlockedRoleName = await assignLevelRoles(member, newLevel, config, guildId);

  if (!config.announcements) return;

  let cardBuffer: Buffer | null = null;
  try {
    const avatarURL = member.user.displayAvatarURL({ extension: "png", size: 128 });
    cardBuffer = await generateLevelUpCard(avatarURL, oldLevel, newLevel);
  } catch (err) {
    console.error("[LEVELING] Failed to generate level-up card:", err);
  }

  const guild = member.guild;
  let channel: TextChannel | null = null;
  if (config.levelUpChannelId) {
    try {
      channel = (await guild.channels.fetch(config.levelUpChannelId)) as TextChannel | null;
    } catch {
      // channel may have been deleted
    }
  }
  if (!channel) {
    channel =
      (guild.channels.cache.find(
        (c) =>
          c.isTextBased() &&
          (c.name.includes("general") ||
            c.name.includes("level") ||
            c.name.includes("chat"))
      ) as TextChannel | undefined) ?? null;
  }

  if (!channel) return;

  const pingPart = config.pingOnLevelUp ? `<@${member.user.id}> ` : "";
  const contentLine = `${pingPart}good job, keep it up **${newLevel}**. GG!`;

  const triggerLine = triggeredBy
    ? `\n*Triggered by ${triggeredBy.command} from ${triggeredBy.tag}*`
    : "";

  try {
    if (cardBuffer) {
      const attachment = new AttachmentBuilder(cardBuffer, { name: "levelup.png" });
      await channel.send({
        content: contentLine + triggerLine,
        files: [attachment],
      });
    } else {
      await channel.send({
        content:
          contentLine +
          (unlockedRoleName ? `\n🎖️ Role unlocked: **${unlockedRoleName}**` : "") +
          triggerLine,
      });
    }
  } catch (err) {
    console.error("[LEVELING] Failed to post level-up message:", err);
  }
}
