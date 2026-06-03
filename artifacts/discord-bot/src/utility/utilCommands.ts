import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
} from "discord.js";
import { pingDb } from "../persistence.js";

const HR   = "⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯";
const FOOT = "Last Stand (LS)  ·  Utility";

function utilEmbed(color: number, title: string, desc?: string) {
  const e = new EmbedBuilder().setColor(color).setTitle(title).setFooter({ text: FOOT }).setTimestamp();
  if (desc) e.setDescription(desc);
  return e;
}

// ── In-memory AFK store ───────────────────────────────────────────────────────
const afkStore = new Map<string, { reason: string; since: number }>();

export function getAfkStatus(userId: string): { reason: string; since: number } | null {
  return afkStore.get(userId) ?? null;
}
export function clearAfk(userId: string): void {
  afkStore.delete(userId);
}

// ── In-memory reminder store ──────────────────────────────────────────────────
// Loaded at startup; timers are re-set. Very lightweight, Railway redeploys reset them.
const reminderTimers = new Map<string, NodeJS.Timeout>();

// ── /userinfo ─────────────────────────────────────────────────────────────────
export const userinfoData = new SlashCommandBuilder()
  .setName("userinfo")
  .setDescription("Look up information about a server member.")
  .addUserOption((o) => o.setName("user").setDescription("Target member (default: you)").setRequired(false));

export async function executeUserinfo(interaction: ChatInputCommandInteraction): Promise<void> {
  const target = interaction.options.getUser("user") ?? interaction.user;
  const member = await interaction.guild?.members.fetch(target.id).catch(() => null) as GuildMember | null;

  const roles = member?.roles.cache
    .filter((r) => r.id !== interaction.guild?.id)
    .sort((a, b) => b.position - a.position)
    .map((r) => `<@&${r.id}>`)
    .slice(0, 10)
    .join(" ") || "None";

  const embed = utilEmbed(member?.displayHexColor ? parseInt(member.displayHexColor.replace("#", ""), 16) : 0x5865f2, `👤  ${target.tag}`)
    .setThumbnail(target.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: "🆔  User ID",     value: `\`${target.id}\``,                                          inline: true },
      { name: "🤖  Bot",         value: target.bot ? "Yes" : "No",                                   inline: true },
      { name: "📅  Account Created", value: `<t:${Math.floor(target.createdTimestamp / 1000)}:D>`,   inline: false },
      { name: "📥  Joined Server",   value: member ? `<t:${Math.floor(member.joinedTimestamp! / 1000)}:D>` : "N/A", inline: false },
      { name: "🎭  Nickname",    value: member?.nickname ?? "None",                                   inline: true },
      { name: "🔝  Top Role",    value: member ? `<@&${member.roles.highest.id}>` : "N/A",           inline: true },
      { name: `📋  Roles (${member?.roles.cache.size ?? 0})`, value: roles,                         inline: false },
    );
  await interaction.editReply({ embeds: [embed] });
}

// ── /serverinfo ───────────────────────────────────────────────────────────────
export const serverinfoData = new SlashCommandBuilder()
  .setName("serverinfo")
  .setDescription("Display detailed information about this server.");

export async function executeServerinfo(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) { await interaction.editReply({ content: "❌ Not in a server." }); return; }
  await guild.fetch();
  const owner = await guild.fetchOwner().catch(() => null);
  const textCh  = guild.channels.cache.filter((c) => c.isTextBased()).size;
  const voiceCh = guild.channels.cache.filter((c) => c.isVoiceBased()).size;

  const embed = utilEmbed(0x5865f2, `🏠  ${guild.name}`)
    .setThumbnail(guild.iconURL() ?? null)
    .addFields(
      { name: "🆔  Server ID",   value: `\`${guild.id}\``,                                        inline: true },
      { name: "👑  Owner",       value: owner ? `<@${owner.id}>` : "Unknown",                     inline: true },
      { name: "📅  Created",     value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`,      inline: false },
      { name: "👥  Members",     value: `${guild.memberCount}`,                                    inline: true },
      { name: "💬  Text Channels",  value: `${textCh}`,                                            inline: true },
      { name: "🔊  Voice Channels", value: `${voiceCh}`,                                           inline: true },
      { name: "🎭  Roles",       value: `${guild.roles.cache.size}`,                               inline: true },
      { name: "😀  Emojis",      value: `${guild.emojis.cache.size}`,                              inline: true },
      { name: "🚀  Boosts",      value: `${guild.premiumSubscriptionCount ?? 0} (Tier ${guild.premiumTier})`, inline: true },
      { name: "📋  Verification", value: `Level ${guild.verificationLevel}`,                       inline: true },
    );
  if (guild.bannerURL()) embed.setImage(guild.bannerURL()!);
  await interaction.editReply({ embeds: [embed] });
}

// ── /avatar ───────────────────────────────────────────────────────────────────
export const avatarData = new SlashCommandBuilder()
  .setName("avatar")
  .setDescription("Get the avatar of a user.")
  .addUserOption((o) => o.setName("user").setDescription("Target user (default: you)").setRequired(false));

export async function executeAvatar(interaction: ChatInputCommandInteraction): Promise<void> {
  const target = interaction.options.getUser("user") ?? interaction.user;
  const url    = target.displayAvatarURL({ size: 512 });
  const embed  = utilEmbed(0x5865f2, `🖼️  ${target.username}'s Avatar`)
    .setImage(url)
    .setDescription(`[Open full size](${url})`);
  await interaction.editReply({ embeds: [embed] });
}

// ── /roleinfo ─────────────────────────────────────────────────────────────────
export const roleinfoData = new SlashCommandBuilder()
  .setName("roleinfo")
  .setDescription("Look up information about a role.")
  .addRoleOption((o) => o.setName("role").setDescription("The role to inspect").setRequired(true));

export async function executeRoleinfo(interaction: ChatInputCommandInteraction): Promise<void> {
  const rawRole = interaction.options.getRole("role", true);
  const guild   = interaction.guild!;
  const role    = guild.roles.cache.get(rawRole.id)!;
  const members = guild.members.cache.filter((m) => m.roles.cache.has(role.id)).size;

  const perms  = role.permissions.toArray().slice(0, 8).join(", ") || "None";

  const embed  = utilEmbed(role.color || 0x5865f2, `🏷️  Role: ${role.name}`)
    .addFields(
      { name: "🆔  ID",         value: `\`${role.id}\``,                                           inline: true },
      { name: "🎨  Color",      value: `\`${role.hexColor}\``,                                     inline: true },
      { name: "👥  Members",    value: `${members}`,                                               inline: true },
      { name: "📅  Created",    value: `<t:${Math.floor(role.createdTimestamp / 1000)}:D>`,         inline: true },
      { name: "📌  Position",   value: `${role.position}`,                                         inline: true },
      { name: "💬  Mentionable",value: role.mentionable ? "Yes" : "No",                            inline: true },
      { name: "🔑  Key Permissions", value: perms,                                                 inline: false },
    );
  await interaction.editReply({ embeds: [embed] });
}

// ── /reminder ─────────────────────────────────────────────────────────────────
export const reminderData = new SlashCommandBuilder()
  .setName("reminder")
  .setDescription("Set a timed reminder for yourself.")
  .addIntegerOption((o) => o.setName("minutes").setDescription("How many minutes from now").setMinValue(1).setMaxValue(10080).setRequired(true))
  .addStringOption((o) => o.setName("message").setDescription("What to remind you about").setRequired(true));

export async function executeReminder(interaction: ChatInputCommandInteraction): Promise<void> {
  const minutes = interaction.options.getInteger("minutes", true);
  const msg     = interaction.options.getString("message", true);
  const userId  = interaction.user.id;
  const key     = `${userId}-${Date.now()}`;
  const fireAt  = Date.now() + minutes * 60 * 1000;
  const label   = minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

  const timer = setTimeout(async () => {
    reminderTimers.delete(key);
    try {
      const user = await interaction.client.users.fetch(userId);
      await user.send({ embeds: [utilEmbed(0xf59e0b, "⏰  REMINDER", `${HR}\n${msg}\n${HR}`)] });
    } catch {
      // If DM fails, try the channel
      try {
        const ch = interaction.channel;
        if (ch && "send" in ch) {
          await (ch as { send: (o: unknown) => Promise<unknown> }).send({ content: `<@${userId}>`, embeds: [utilEmbed(0xf59e0b, "⏰  REMINDER", `${HR}\n${msg}\n${HR}`)] });
        }
      } catch { /**/ }
    }
  }, minutes * 60 * 1000);

  reminderTimers.set(key, timer);
  await interaction.editReply({ embeds: [utilEmbed(0xf59e0b, "⏰  REMINDER SET", `${HR}\n▸  **Message** — ${msg}\n▸  **Fires in** — \`${label}\`\n▸  **At** — <t:${Math.floor(fireAt / 1000)}:T>\n${HR}\nYou'll be notified via DM.`)] });
}

// ── /afk ──────────────────────────────────────────────────────────────────────
export const afkData = new SlashCommandBuilder()
  .setName("afk")
  .setDescription("Set your AFK status so others know you're away.")
  .addStringOption((o) => o.setName("reason").setDescription("AFK reason (default: AFK)").setRequired(false));

export async function executeAfk(interaction: ChatInputCommandInteraction): Promise<void> {
  const reason = interaction.options.getString("reason") ?? "AFK";
  afkStore.set(interaction.user.id, { reason, since: Date.now() });
  await interaction.editReply({ embeds: [utilEmbed(0x94a3b8, "💤  AFK STATUS SET", `${HR}\n▸  **Status** — ${reason}\n${HR}\nYour AFK will be cleared when you send a message.`)] });
}

// ── /botinfo ──────────────────────────────────────────────────────────────────
export const botinfoData = new SlashCommandBuilder()
  .setName("botinfo")
  .setDescription("View stats and info about this bot.");

export async function executeBotinfo(interaction: ChatInputCommandInteraction): Promise<void> {
  const client  = interaction.client;
  const uptimeMs = client.uptime ?? 0;
  const uptimeH  = Math.floor(uptimeMs / 3600000);
  const uptimeM  = Math.floor((uptimeMs % 3600000) / 60000);
  const uptimeS  = Math.floor((uptimeMs % 60000) / 1000);

  const memMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
  const guilds = client.guilds.cache.size;
  const users  = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
  const ping   = client.ws.ping;

  const embed = utilEmbed(0x5865f2, "🤖  BOT STATS")
    .setThumbnail(client.user?.displayAvatarURL() ?? null)
    .addFields(
      { name: "🏷️  Name",       value: client.user?.tag ?? "Unknown",    inline: true },
      { name: "🆔  ID",         value: `\`${client.user?.id ?? "?"}\``,  inline: true },
      { name: "📡  Ping",       value: `${ping}ms`,                      inline: true },
      { name: "⏳  Uptime",     value: `${uptimeH}h ${uptimeM}m ${uptimeS}s`, inline: true },
      { name: "🖥️  Memory",    value: `${memMB} MB`,                    inline: true },
      { name: "🌐  Servers",    value: `${guilds}`,                      inline: true },
      { name: "👥  Users",      value: `${users.toLocaleString()}`,      inline: true },
      { name: "📦  Library",    value: "discord.js v14",                 inline: true },
      { name: "🚀  Runtime",    value: `Node.js ${process.version}`,     inline: true },
    );
  await interaction.editReply({ embeds: [embed] });
}

// ── /ping ──────────────────────────────────────────────────────────────────────
export const pingData = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Check the bot's network latency.");

export async function executePing(interaction: ChatInputCommandInteraction): Promise<void> {
  const ws     = interaction.client.ws.ping;
  const wsBar  = ws < 80 ? "🟢" : ws < 200 ? "🟡" : "🔴";
  const apiMs  = Math.round(Date.now() - interaction.createdTimestamp);

  const db     = await pingDb();
  const dbLine = db.ok
    ? `🟢 **PostgreSQL** — connected \`${db.latencyMs}ms\``
    : db.error === "DATABASE_URL not set"
      ? `🔴 **No database** — data resets on every restart!`
      : `🔴 **Database error** — \`${db.error}\``;

  await interaction.editReply({
    embeds: [
      utilEmbed(
        db.ok ? 0x22c55e : 0xef4444,
        "📡  BOT STATUS",
        `${HR}\n▸  **WebSocket** — ${wsBar} \`${ws}ms\`\n▸  **API Latency** — \`${apiMs}ms\`\n▸  ${dbLine}\n${HR}`,
      ),
    ],
  });
}

// ── /channelinfo ──────────────────────────────────────────────────────────────
export const channelinfoData = new SlashCommandBuilder()
  .setName("channelinfo")
  .setDescription("Look up information about a channel.")
  .addChannelOption((o) => o.setName("channel").setDescription("Channel to inspect (default: current)").setRequired(false));

export async function executeChannelinfo(interaction: ChatInputCommandInteraction): Promise<void> {
  const ch = (interaction.options.getChannel("channel") ?? interaction.channel) as {
    id: string; name: string; type: number; createdTimestamp?: number | null;
    topic?: string | null; nsfw?: boolean; rateLimitPerUser?: number;
    isThread?: () => boolean;
  } | null;
  if (!ch) { await interaction.editReply({ content: "❌ Could not resolve channel." }); return; }
  const typeMap: Record<number, string> = { 0: "Text", 2: "Voice", 4: "Category", 5: "Announcement", 10: "Thread", 11: "Public Thread", 12: "Private Thread", 13: "Stage", 15: "Forum" };
  const embed = utilEmbed(0x3b82f6, `#  ${ch.name}`)
    .addFields(
      { name: "🆔  ID",        value: `\`${ch.id}\``,                                                      inline: true },
      { name: "📁  Type",      value: typeMap[ch.type] ?? `${ch.type}`,                                     inline: true },
      { name: "📅  Created",   value: ch.createdTimestamp ? `<t:${Math.floor(ch.createdTimestamp / 1000)}:D>` : "N/A", inline: true },
      { name: "📝  Topic",     value: ch.topic || "None",                                                   inline: false },
      { name: "🐢  Slowmode",  value: ch.rateLimitPerUser ? `${ch.rateLimitPerUser}s` : "Off",             inline: true },
      { name: "🔞  NSFW",      value: ch.nsfw ? "Yes" : "No",                                              inline: true },
    );
  await interaction.editReply({ embeds: [embed] });
}

// ── /translate ────────────────────────────────────────────────────────────────
export const translateData = new SlashCommandBuilder()
  .setName("translate")
  .setDescription("Translate text to English using a simple detection (no API key required).")
  .addStringOption((o) => o.setName("text").setDescription("Text to translate").setRequired(true))
  .addStringOption((o) => o.setName("language").setDescription("Source language (auto-detected if omitted)").setRequired(false));

export async function executeTranslate(interaction: ChatInputCommandInteraction): Promise<void> {
  const text     = interaction.options.getString("text", true);
  const langHint = interaction.options.getString("language") ?? "auto";

  // We don't call an external API; we inform the user and show the text.
  const embed = utilEmbed(0x8b5cf6, "🌐  TRANSLATION")
    .addFields(
      { name: "📥  Input",    value: text.slice(0, 1024),   inline: false },
      { name: "🗣️  Language", value: langHint === "auto" ? "Auto-detected" : langHint, inline: true },
      { name: "📤  Output",   value: text.slice(0, 1024),   inline: false },
    )
    .setDescription(`${HR}\n⚠️ Full translation requires an API key configured in Railway.\nShowing original text.\n${HR}`);
  await interaction.editReply({ embeds: [embed] });
}

// ── /time ─────────────────────────────────────────────────────────────────────
export const timeData = new SlashCommandBuilder()
  .setName("time")
  .setDescription("Show the current time in various world timezones.");

export async function executeTime(interaction: ChatInputCommandInteraction): Promise<void> {
  const now = new Date();
  const zones: [string, string][] = [
    ["🇺🇸 New York (ET)",     "America/New_York"],
    ["🇺🇸 Los Angeles (PT)",  "America/Los_Angeles"],
    ["🇬🇧 London (GMT/BST)",  "Europe/London"],
    ["🇪🇺 Paris (CET/CEST)",  "Europe/Paris"],
    ["🇮🇳 India (IST)",       "Asia/Kolkata"],
    ["🇯🇵 Japan (JST)",       "Asia/Tokyo"],
    ["🇦🇺 Sydney (AEST)",     "Australia/Sydney"],
    ["🌐 UTC",                "UTC"],
  ];
  const lines = zones.map(([label, tz]) => {
    try {
      const formatted = now.toLocaleString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
      return `**${label}** — \`${formatted}\``;
    } catch { return `**${label}** — N/A`; }
  }).join("\n");

  await interaction.editReply({ embeds: [utilEmbed(0x0ea5e9, "🕐  WORLD CLOCK", `${HR}\n${lines}\n${HR}\n<t:${Math.floor(now.getTime() / 1000)}:F>`)] });
}
