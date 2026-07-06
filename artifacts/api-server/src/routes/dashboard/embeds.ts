import { Router, type IRouter } from "express";
import { db, botKvTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth.js";
import { writeAuditLog } from "../../lib/audit.js";

const router: IRouter = Router();
router.use(requireAuth);

type EmbedFieldData = { name: string; value: string; inline: boolean };
type EmbedData = {
  id: string;
  module: string;
  title: string | null;
  description: string | null;
  color: number | null;
  footer: string | null;
  thumbnail: string | null;
  image: string | null;
  fields: EmbedFieldData[];
};

// ─── Real embed catalog — sourced from bot source files ────────────────────
// Every entry below was read directly from the Discord bot's TypeScript source.
// Colors match the constants in lowo/embeds.ts (COLOR object) and each
// command/event file.  {placeholder} values show what variable data goes there.
// isError embeds (⚠️/❌) shown with their actual warning/error colors.
const DEFAULT_EMBEDS: EmbedData[] = [

  // ════════════════════════════════════════════════════════════════
  //  LEVELING  (slash commands — leveling/commands.ts + engine.ts)
  // ════════════════════════════════════════════════════════════════
  {
    id: "leveling.rank",
    module: "Leveling",
    title: "◇  RANK CARD",
    description: null,
    color: 0x5865f2,
    footer: "Last Stand Management  ·  Leveling System",
    thumbnail: null,
    image: null,
    fields: [
      { name: "Level",       value: "**{level}**",                        inline: true  },
      { name: "Server Rank", value: "**#{rank}**",                        inline: true  },
      { name: "Weekly XP",   value: "**{weeklyXp}**",                     inline: true  },
      { name: "XP Progress  ·  {currentXp} / {neededXp}", value: "`{bar}`", inline: false },
      { name: "Total XP",    value: "{totalXp} XP",                       inline: true  },
    ],
  },
  {
    id: "leveling.levelup",
    module: "Leveling",
    title: null,
    description: "🎉 Congratulations **{user}**! You reached **Level {level}**!",
    color: 0x22c55e,
    footer: "Last Stand Management  ·  Leveling System",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "leveling.leaderboard",
    module: "Leveling",
    title: "XP Leaderboard",
    description: "Top members by XP in this server.  *(canvas image)*",
    color: 0x5865f2,
    footer: "Last Stand Management  ·  Page {page}/{total}",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "leveling.weekly_lb",
    module: "Leveling",
    title: "Weekly XP Leaderboard",
    description: "Top members by XP earned this week.  *(canvas image)*",
    color: 0x5865f2,
    footer: "Last Stand Management  ·  Resets every Monday",
    thumbnail: null,
    image: null,
    fields: [],
  },

  // ════════════════════════════════════════════════════════════════
  //  MODERATION  (modActions.ts — shared modEmbed helper)
  //  Author: "LAST STAND  ·  MODERATION"
  //  Footer: "Last Stand (LS)  ·  Moderation"
  // ════════════════════════════════════════════════════════════════
  {
    id: "mod.kick",
    module: "Moderation",
    title: "👢  MEMBER KICKED",
    description: "⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n▸  **MEMBER** · · · · · <@{target}>\n▸  **ACTIONED BY** · · · <@{moderator}>\n⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n**REASON**\n> {reason}",
    color: 0xe74c3c,
    footer: "Last Stand (LS)  ·  Moderation",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mod.kick.dm",
    module: "Moderation",
    title: "👢  YOU WERE KICKED",
    description: "**Server:** {guildName}\n**Reason:** {reason}",
    color: 0xe74c3c,
    footer: "Last Stand (LS)  ·  Moderation",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mod.ban",
    module: "Moderation",
    title: "🔨  MEMBER BANNED",
    description: "⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n▸  **MEMBER** · · · · · <@{target}>\n▸  **ACTIONED BY** · · · <@{moderator}>\n⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n**REASON**\n> {reason}",
    color: 0x8b0000,
    footer: "Last Stand (LS)  ·  Moderation",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mod.ban.dm",
    module: "Moderation",
    title: "🔨  YOU WERE BANNED",
    description: "**Server:** {guildName}\n**Reason:** {reason}",
    color: 0x8b0000,
    footer: "Last Stand (LS)  ·  Moderation",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mod.tempban",
    module: "Moderation",
    title: "⏳  MEMBER TEMP-BANNED",
    description: "⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n▸  **MEMBER** · · · · · <@{target}>\n▸  **ACTIONED BY** · · · <@{moderator}>\n▸  **DURATION** · · · · {hours}h\n⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n**REASON**\n> {reason}",
    color: 0x8b0000,
    footer: "Last Stand (LS)  ·  Moderation",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mod.mute",
    module: "Moderation",
    title: "🔇  MEMBER MUTED",
    description: "⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n▸  **MEMBER** · · · · · <@{target}>\n▸  **ACTIONED BY** · · · <@{moderator}>\n▸  **DURATION** · · · · {duration}\n⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n**REASON**\n> {reason}",
    color: 0xffa500,
    footer: "Last Stand (LS)  ·  Moderation",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mod.unmute",
    module: "Moderation",
    title: "🔊  MEMBER UNMUTED",
    description: "⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n▸  **MEMBER** · · · · · <@{target}>\n▸  **ACTIONED BY** · · · <@{moderator}>\n⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯",
    color: 0x57f287,
    footer: "Last Stand (LS)  ·  Moderation",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mod.warn",
    module: "Moderation",
    title: "⚠️  WARNING ISSUED",
    description: "⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n▸  **MEMBER** · · · · · <@{target}>\n▸  **ACTIONED BY** · · · <@{moderator}>\n⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n**REASON**\n> {reason}",
    color: 0xfee75c,
    footer: "Last Stand (LS)  ·  Moderation",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mod.purge",
    module: "Moderation",
    title: "🗑️  MESSAGES PURGED",
    description: "⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n▸  **CHANNEL** · · · · <#{channel}>\n▸  **ACTIONED BY** · · <@{moderator}>\n▸  **DELETED** · · · · {count} messages\n⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯",
    color: 0xe74c3c,
    footer: "Last Stand (LS)  ·  Moderation",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mod.timeout",
    module: "Moderation",
    title: "⏱️  MEMBER TIMED OUT",
    description: "⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n▸  **MEMBER** · · · · · <@{target}>\n▸  **ACTIONED BY** · · · <@{moderator}>\n▸  **DURATION** · · · · {duration}\n⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n**REASON**\n> {reason}",
    color: 0xffa500,
    footer: "Last Stand (LS)  ·  Moderation",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mod.slowmode",
    module: "Moderation",
    title: "🐢  SLOWMODE SET",
    description: "⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n▸  **CHANNEL** · · · · <#{channel}>\n▸  **DELAY** · · · · · {seconds}s\n⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯",
    color: 0x3498db,
    footer: "Last Stand (LS)  ·  Moderation",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mod.lock",
    module: "Moderation",
    title: "🔒  CHANNEL LOCKED",
    description: "⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n▸  **CHANNEL** · · · · <#{channel}>\n▸  **ACTIONED BY** · · <@{moderator}>\n⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯",
    color: 0xe74c3c,
    footer: "Last Stand (LS)  ·  Moderation",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mod.unlock",
    module: "Moderation",
    title: "🔓  CHANNEL UNLOCKED",
    description: "⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n▸  **CHANNEL** · · · · <#{channel}>\n▸  **ACTIONED BY** · · <@{moderator}>\n⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯",
    color: 0x57f287,
    footer: "Last Stand (LS)  ·  Moderation",
    thumbnail: null,
    image: null,
    fields: [],
  },

  // ════════════════════════════════════════════════════════════════
  //  UTILITY  (utility/index.ts + utility/utilCommands.ts)
  // ════════════════════════════════════════════════════════════════
  {
    id: "utility.announce",
    module: "Utility",
    title: "Announcement",
    description: "{content}",
    color: 0x5865f2,
    footer: "Announced by {author}",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "utility.poll",
    module: "Utility",
    title: "{question}",
    description: "React to vote!",
    color: 0x2f3136,
    footer: "Poll by {author}",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "utility.attendance",
    module: "Utility",
    title: "Attendance Marked",
    description: "Attendance recorded for {user}.",
    color: 0x57f287,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [{ name: "Event", value: "{event}", inline: true }],
  },
  {
    id: "utility.mvp",
    module: "Utility",
    title: "🏆 MVP",
    description: "{user} has been named MVP!",
    color: 0xffd700,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [],
  },

  // ════════════════════════════════════════════════════════════════
  //  RAIDS  (raids/index.ts + raids/announce.ts)
  // ════════════════════════════════════════════════════════════════
  {
    id: "raids.start",
    module: "Raids",
    title: "Raid Started",
    description: "A raid has begun against **\"{opponent}\"**!",
    color: 0xed4245,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [
      { name: "Raid #",      value: "{number}", inline: true },
      { name: "Started By",  value: "{author}", inline: true },
    ],
  },
  {
    id: "raids.end",
    module: "Raids",
    title: "Raid Ended",
    description: "The raid against **\"{opponent}\"** has concluded.",
    color: 0x57f287,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [
      { name: "Result",         value: "{result}",     inline: true  },
      { name: "Top Performers", value: "{performers}", inline: false },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  //  TRAINING  (training/index.ts)
  // ════════════════════════════════════════════════════════════════
  {
    id: "training.session",
    module: "Training",
    title: "Training Session",
    description: "Training session #{number} is in progress.",
    color: 0x00b0f4,
    footer: "Hosted by {host}",
    thumbnail: null,
    image: null,
    fields: [
      { name: "Duration", value: "{duration}", inline: true },
      { name: "MVP",      value: "{mvp}",      inline: true },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  //  TOURNAMENTS  (tournament/index.ts)
  // ════════════════════════════════════════════════════════════════
  {
    id: "tournament.open",
    module: "Tournaments",
    title: "{about}",
    description: "{rules}",
    color: 0xffd700,
    footer: "Tournament by {host}",
    thumbnail: null,
    image: null,
    fields: [
      { name: "Date",             value: "{date}",  inline: true },
      { name: "Prize",            value: "{prize}", inline: true },
      { name: "Max Participants", value: "{max}",   inline: true },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  //  ANTI-NUKE  (antinuke/events.ts + antinuke/mitigation.ts)
  // ════════════════════════════════════════════════════════════════
  {
    id: "antinuke.alert",
    module: "Anti-Nuke",
    title: "🚨 Anti-Nuke Alert",
    description: "Suspicious activity detected from {user}.",
    color: 0xff0000,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [
      { name: "Action",         value: "{action}",           inline: true },
      { name: "Count",          value: "{count}/{threshold}", inline: true },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  //  VERIFICATION  (verification/commands.ts)
  // ════════════════════════════════════════════════════════════════
  {
    id: "verification.panel",
    module: "Verification",
    title: "✅ Server Verification",
    description: "Click the button below to verify yourself and gain access to the server.",
    color: 0x5865f2,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "verification.success",
    module: "Verification",
    title: "Verification Complete",
    description: "Welcome, {user}! You have been verified.",
    color: 0x57f287,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [],
  },

  // ════════════════════════════════════════════════════════════════
  //  LOWO — ECONOMY  (lowo/economy.ts)
  //  Base color: 0xff7a3c (COLOR.brand)
  // ════════════════════════════════════════════════════════════════
  {
    id: "lowo.balance",
    module: "Lowo",
    title: "Balance",
    description: null,
    color: 0xff7a3c,
    footer: "{username}  •  Hunts: {huntsTotal}  •  Cwn: {cowoncy}  •  Ess: {essence}  •  Pets: {animalCount}",
    thumbnail: null,
    image: null,
    fields: [
      { name: "Cowoncy",    value: "`{cowoncy}`",   inline: true },
      { name: "Essence",    value: "`{essence}`",   inline: true },
      { name: "Lowo Cash",  value: "`{lowoCash}`",  inline: true },
    ],
  },
  {
    id: "lowo.cash",
    module: "Lowo",
    title: "Lowo Cash",
    description: "{username} has `{lowoCash}` Lowo Cash *(premium currency)*.",
    color: 0xff7a3c,
    footer: "{username}  •  session footer",
    thumbnail: null,
    image: null,
    fields: [
      { name: "How to earn",  value: "+1 every **50 hunts**",       inline: true },
      { name: "How to spend", value: "`lowo shop premium`",         inline: true },
    ],
  },
  {
    id: "lowo.daily.claimed",
    module: "Lowo",
    title: "✅ Daily Claimed!",
    description: "+`{reward}` cowoncy\n*Milestone bonus: **+{milestone}** (if applicable)*\n\n**Streak:** {streak} days  *(+{bonusPct}% bonus)*\n`{streakBar}`",
    color: 0x22c55e,
    footer: "{username}  •  session footer",
    thumbnail: null,
    image: null,
    fields: [
      { name: "Total Earned", value: "{total}",   inline: true },
      { name: "New Balance",  value: "{balance}", inline: true },
      { name: "Next Claim",   value: "in 24h",    inline: true },
    ],
  },
  {
    id: "lowo.daily.cooldown",
    module: "Lowo",
    title: "⚠️ Daily Already Claimed",
    description: "Come back in **{h}h {m}m** for your next reward.",
    color: 0xfacc15,
    footer: "{username}  •  session footer",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "lowo.give.success",
    module: "Lowo",
    title: "✅ Transfer Complete",
    description: "Sent `{amount}` cowoncy to **{target}**.",
    color: 0x22c55e,
    footer: "{username}  •  session footer",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "lowo.give.error.broke",
    module: "Lowo",
    title: "❌ Insufficient funds",
    description: "You only have `{balance}` cowoncy.",
    color: 0xef4444,
    footer: "{username}  •  session footer",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "lowo.give.error.usage",
    module: "Lowo",
    title: "❌ Usage",
    description: "`lowo give @user <amount>`",
    color: 0xef4444,
    footer: "{username}  •  session footer",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "lowo.vote",
    module: "Lowo",
    title: "✅ Thanks for voting!",
    description: "+`250` cowoncy.",
    color: 0x22c55e,
    footer: "{username}  •  session footer",
    thumbnail: null,
    image: null,
    fields: [],
  },

  // ════════════════════════════════════════════════════════════════
  //  LOWO — HUNT  (lowo/hunt.ts + lowo/embeds.ts catchCardEmbed)
  // ════════════════════════════════════════════════════════════════
  {
    id: "lowo.hunt.cooldown",
    module: "Lowo",
    title: "⚠️ Slow Down!",
    description: "Hunt again in **{seconds}s**.",
    color: 0xfacc15,
    footer: "{username}  •  session footer",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "lowo.hunt.snatched",
    module: "Lowo",
    title: "🦊 SNATCHED!",
    description: "*A wild Lowo darts in and snatches your catch right out of your hands!*\n> \"Tee-hee! You forgot `lowo daily` again — finder's keepers!\"",
    color: 0xfacc15,
    footer: "{username}  •  session footer",
    thumbnail: null,
    image: null,
    fields: [
      { name: "Tip", value: "Claim `lowo daily` regularly so the bot doesn't get hungry.", inline: false },
    ],
  },
  {
    id: "lowo.hunt.void_reject",
    module: "Lowo",
    title: "⚠️ 👾 The Void Rejects You",
    description: "*The Infinite Void recoils — none of your pets are corrupted enough to enter.*\n\nAdd at least one **👾 corrupted pet** to your team *(`lowo team add <pet>`)*, or run `lowo corrupt <pet>` first.",
    color: 0xfacc15,
    footer: "{username}  •  session footer",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "lowo.hunt.catch",
    module: "Lowo",
    title: "✨ CATCH ✨",
    description: "### {emoji} {animalName}\n*{areaTag}*\n─────────────────────\n*{rarityFlavor}*\n🎯 **PITY!** *(if pity triggered)*  •  💸 *auto-sold* *(if autosell)*",
    color: 0xb9bbbe,
    footer: "{username}  •  Hunts: {total}  •  session footer",
    thumbnail: null,
    image: null,
    fields: [
      { name: "Rarity",     value: "`[ {RARITY} ]`",         inline: true },
      { name: "💰 Sells",   value: "`{sellPrice}` cwn",       inline: true },
      { name: "✨ Essence", value: "`{essence}`",             inline: true },
      { name: "❤️ HP",      value: "`{hp}`",                  inline: true },
      { name: "⚔️ ATK",     value: "`{atk}`",                 inline: true },
      { name: "\u200b",     value: "\u200b",                  inline: true },
      { name: "🛡️ DEF",     value: "`{def}`",                 inline: true },
      { name: "🔮 MAG",     value: "`{mag}`",                 inline: true },
      { name: "\u200b",     value: "\u200b",                  inline: true },
    ],
  },
  {
    id: "lowo.hunt.ultra_rare",
    module: "Lowo",
    title: null,
    description: "🌌 **[ULTRA RARE CATCH]** 🌌\n🏹 [{areaEmoji} {area}] **{username}** caught **{emoji} {name}** `[ {RARITY} ]`\n❤️ `{hp}` ⚔️ `{atk}` 🛡️ `{def}` 🔮 `{mag}` • 💰 `{sellPrice}` cwn • ✨ `{essence}` ess\n\n{notes}",
    color: 0xf97316,
    footer: "{username}  •  Pity: {pity}/{pityMax}  •  session footer",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "lowo.zoo",
    module: "Lowo",
    title: "{target}'s Zoo",
    description: "Paginated animal collection.  ◀️ Prev · Page {page}/{total} · ▶️ Next · ✖️ Close",
    color: 0xff7a3c,
    footer: "{username}  •  session footer",
    thumbnail: null,
    image: null,
    fields: [],
  },

  // ════════════════════════════════════════════════════════════════
  //  LOWO — SOCIAL  (lowo/social.ts — plain text + GIF, no embed)
  // ════════════════════════════════════════════════════════════════
  {
    id: "lowo.social.hug",
    module: "Lowo",
    title: null,
    description: "🤗 **{author}** hugs **{target}** 🤗  *(+ anime GIF attached)*",
    color: 0xff7a3c,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "lowo.social.kiss",
    module: "Lowo",
    title: null,
    description: "💋 **{author}** kisss **{target}** 💋  *(+ anime GIF)*",
    color: 0xff7a3c,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "lowo.social.slap",
    module: "Lowo",
    title: null,
    description: "🖐️ **{author}** slaps **{target}** 🖐️  *(+ anime GIF — can be censored per-server)*",
    color: 0xff7a3c,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "lowo.social.pat",
    module: "Lowo",
    title: null,
    description: "🫶 **{author}** pats **{target}** 🫶  *(+ anime GIF)*",
    color: 0xff7a3c,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "lowo.social.cuddle",
    module: "Lowo",
    title: null,
    description: "🥰 **{author}** cuddles **{target}** 🥰  *(+ anime GIF)*",
    color: 0xff7a3c,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "lowo.social.poke",
    module: "Lowo",
    title: null,
    description: "👉 **{author}** pokes **{target}** 👉  *(+ anime GIF)*",
    color: 0xff7a3c,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "lowo.social.propose",
    module: "Lowo",
    title: null,
    description: "💍 **{author}** proposed to **{target}** — they're now married! 💕",
    color: 0xff7a3c,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "lowo.social.divorce",
    module: "Lowo",
    title: null,
    description: "💔 You divorced <@{partnerId}>.",
    color: 0xff7a3c,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "lowo.social.ship",
    module: "Lowo",
    title: null,
    description: "{heart} **{user1}** + **{user2}** = **{score}%** compatible {heart}",
    color: 0xff7a3c,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "lowo.social.lowoify",
    module: "Lowo",
    title: null,
    description: "{uwuText} owo *(or uwu / >w< / ^-^ / :3 / (◕‿◕) suffix, random)*",
    color: 0xff7a3c,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "lowo.social.censored",
    module: "Lowo",
    title: null,
    description: "🤫 `lowo {action}` is censored on this server.",
    color: 0xff7a3c,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [],
  },

  // ════════════════════════════════════════════════════════════════
  //  LOWO — BATTLE  (lowo/battle.ts)
  // ════════════════════════════════════════════════════════════════
  {
    id: "lowo.battle.cooldown",
    module: "Lowo",
    title: null,
    description: "Cooling down — battle again in **{seconds}s**.",
    color: 0xfacc15,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "lowo.battle.no_team",
    module: "Lowo",
    title: null,
    description: "Build a team first: `lowo team add <name>`",
    color: 0xef4444,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "lowo.battle.win",
    module: "Lowo",
    title: null,
    description: "🏆 **{author}** beat **{opponent}**! +{reward} 🪙 Battle Tokens\n_+25 XP to each team animal._\n```{battleLog}```",
    color: 0xff7a3c,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "lowo.battle.lose",
    module: "Lowo",
    title: null,
    description: "💀 **{author}** lost to **{opponent}**.\n```{battleLog}```",
    color: 0xff7a3c,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "lowo.battle.draw",
    module: "Lowo",
    title: null,
    description: "🤝 Draw with **{opponent}**.\n```{battleLog}```",
    color: 0xff7a3c,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "lowo.crate.open",
    module: "Lowo",
    title: null,
    description: "📦 Opened a crate! {weaponEmoji} **{weaponName}** *({rarity})* — ATK +{atk}, DEF +{def}, MAG +{mag}",
    color: 0xff7a3c,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [],
  },

  // ════════════════════════════════════════════════════════════════
  //  LOWO — SHOP  (lowo/embeds.ts shopButtonsRows)
  //  Shop color = COLOR.shop = 0xeab308
  //  Buttons: Items / Equips / Pets / Premium / Gamepasses (row 1)
  //           Events / Essence / Mining / Skills / Team Slots (row 2)
  // ════════════════════════════════════════════════════════════════
  {
    id: "lowo.shop",
    module: "Lowo",
    title: "🛒 Lowo Shop",
    description: "Select a category to browse items.",
    color: 0xeab308,
    footer: "{username}  •  session footer",
    thumbnail: null,
    image: null,
    fields: [],
  },

  // ════════════════════════════════════════════════════════════════
  //  MEWO — AI  (mewo/modules/ai.ts)
  // ════════════════════════════════════════════════════════════════
  {
    id: "mewo.ai.thinking",
    module: "Mewo",
    title: null,
    description: "💭 Processing your request...",
    color: 0x00b4ff,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mewo.ai.chatgpt",
    module: "Mewo",
    title: "AI Chat",
    description: null,
    color: 0x00b4ff,
    footer: "mewo • ai • {model} • {used}/{limit} today",
    thumbnail: null,
    image: null,
    fields: [
      { name: "Question", value: "{prompt}", inline: false },
      { name: "Answer",   value: "{reply}",  inline: false },
    ],
  },
  {
    id: "mewo.ai.llama",
    module: "Mewo",
    title: "LLaMA",
    description: null,
    color: 0x00b4ff,
    footer: "mewo • ai • LLaMA 3.x • {used}/{limit} today",
    thumbnail: null,
    image: null,
    fields: [
      { name: "Question", value: "{prompt}", inline: false },
      { name: "Answer",   value: "{reply}",  inline: false },
    ],
  },
  {
    id: "mewo.ai.deepseek",
    module: "Mewo",
    title: "DeepSeek",
    description: null,
    color: 0x4b5cc4,
    footer: "mewo • ai • DeepSeek-V3 • {used}/{limit} today",
    thumbnail: null,
    image: null,
    fields: [
      { name: "Prompt", value: "{prompt}", inline: false },
      { name: "Answer", value: "{reply}",  inline: false },
    ],
  },
  {
    id: "mewo.ai.imagine.thinking",
    module: "Mewo",
    title: null,
    description: "🎨 Generating image... (this may take a few seconds)",
    color: 0x00b4ff,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mewo.ai.imagine",
    module: "Mewo",
    title: "AI Image Generation",
    description: "> {prompt}",
    color: 0x00b4ff,
    footer: "mewo • ai • FLUX Realism  (or FLUX.1-schnell if HF key set)",
    thumbnail: null,
    image: "{generatedImageAttachment}",
    fields: [],
  },
  {
    id: "mewo.ai.ocr",
    module: "Mewo",
    title: "OCR — Extracted Text",
    description: "```\n{extractedText}\n```",
    color: 0x00b4ff,
    footer: "mewo • ai • OCR.space",
    thumbnail: "{attachmentUrl}",
    image: null,
    fields: [],
  },
  {
    id: "mewo.ai.screenshot",
    module: "Mewo",
    title: "Website Screenshot",
    description: "📸 **[{url}]({url})**",
    color: 0x00b4ff,
    footer: "mewo • ai • thum.io",
    thumbnail: null,
    image: "{screenshotUrl}",
    fields: [],
  },
  {
    id: "mewo.ai.download.single",
    module: "Mewo",
    title: "Media Download — Ready",
    description: "**[Click here to download]({downloadUrl})**\n\n`{originalUrl}`\n\n> Link expires in a few minutes. Download quickly!",
    color: 0x57f287,
    footer: "mewo • ai • cobalt.tools",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mewo.ai.download.multi",
    module: "Mewo",
    title: "Media Download — Multiple Files",
    description: "**{originalUrl}**\n\n[Media 1]({url1})\n[Media 2]({url2})\n...\n\n> Right-click → Save as to download",
    color: 0x00b4ff,
    footer: "mewo • ai • cobalt.tools",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mewo.ai.perplexity.thinking",
    module: "Mewo",
    title: null,
    description: "🔎 Searching the web...",
    color: 0x20b2aa,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mewo.ai.perplexity",
    module: "Mewo",
    title: "Web Search",
    description: "{answer}",
    color: 0x20b2aa,
    footer: "mewo • ai • Perplexity Sonar",
    thumbnail: null,
    image: null,
    fields: [
      { name: "Query",   value: "{query}",   inline: false },
      { name: "Sources", value: "{sources}", inline: false },
    ],
  },
  {
    id: "mewo.ai.tts.thinking",
    module: "Mewo",
    title: null,
    description: "🔊 Generating speech... / 🎙️ Generating speech...",
    color: 0x00b4ff,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mewo.ai.tts.openai",
    module: "Mewo",
    title: "Text to Speech",
    description: "> {textPreview}",
    color: 0x00b4ff,
    footer: "mewo • ai • OpenAI TTS (alloy)",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mewo.ai.tts.elevenlabs",
    module: "Mewo",
    title: "Text to Speech",
    description: "> {textPreview}",
    color: 0x9b59b6,
    footer: "mewo • ai • ElevenLabs",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mewo.ai.geolocate.thinking",
    module: "Mewo",
    title: null,
    description: "🌍 Geolocating...",
    color: 0x00b4ff,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mewo.ai.geolocate",
    module: "Mewo",
    title: "Geolocation — {ip}",
    description: null,
    color: 0x00b4ff,
    footer: "mewo • ai • ipapi.co",
    thumbnail: null,
    image: null,
    fields: [
      { name: "City",        value: "{city}",        inline: true },
      { name: "Region",      value: "{region}",      inline: true },
      { name: "Country",     value: "{country}",     inline: true },
      { name: "ISP / Org",   value: "{org}",         inline: false },
      { name: "Timezone",    value: "{timezone}",    inline: true },
      { name: "Coordinates", value: "{lat}, {lon}",  inline: true },
    ],
  },
  {
    id: "mewo.ai.usage",
    module: "Mewo",
    title: "AI Usage — Today",
    description: null,
    color: 0x00b4ff,
    footer: "mewo • ai",
    thumbnail: null,
    image: null,
    fields: [
      { name: "AI Chat",  value: "`{bar}` {chatgptUsed}/{limit}", inline: false },
      { name: "LLaMA",    value: "`{bar}` {llamaUsed}/{limit}",   inline: false },
      { name: "DeepSeek", value: "`{bar}` {dsUsed}/{limit}",      inline: false },
      { name: "Resets",   value: "Daily at **midnight UTC**",     inline: false },
    ],
  },
  {
    id: "mewo.ai.limit",
    module: "Mewo",
    title: null,
    description: "❌ Daily limit reached (25 requests). Resets at midnight UTC.",
    color: 0xed4245,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mewo.ai.unavailable",
    module: "Mewo",
    title: null,
    description: "❌ This feature is currently unavailable.",
    color: 0xed4245,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mewo.ai.error",
    module: "Mewo",
    title: null,
    description: "❌ {errorMessage}",
    color: 0xed4245,
    footer: null,
    thumbnail: null,
    image: null,
    fields: [],
  },

  // ════════════════════════════════════════════════════════════════
  //  MEWO — COOLDOWN & ERRORS  (mewo/router.ts)
  // ════════════════════════════════════════════════════════════════
  {
    id: "mewo.cooldown",
    module: "Mewo",
    title: null,
    description: "⏳ Slow down! Wait **{seconds}s** before using this command again.",
    color: 0xfee75c,
    footer: "mewo • cooldown",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mewo.error.unknown_cmd",
    module: "Mewo",
    title: null,
    description: "Unknown command `{cmd}`. Use `mewo help` to see all available commands.",
    color: 0xfee75c,
    footer: "mewo",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mewo.error.unknown_sub",
    module: "Mewo",
    title: null,
    description: "❌ Unknown `{group}` subcommand. Try `mewo help {group}`",
    color: 0xed4245,
    footer: "mewo",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mewo.error.generic",
    module: "Mewo",
    title: null,
    description: "❌ An unexpected error occurred. Please try again.",
    color: 0xed4245,
    footer: "mewo",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mewo.channel.disabled",
    module: "Mewo",
    title: null,
    description: "❌ mewo is not enabled in this channel. Ask an admin to use `/lowoenable` in this channel.",
    color: 0x5865f2,
    footer: "mewo",
    thumbnail: null,
    image: null,
    fields: [],
  },

  // ════════════════════════════════════════════════════════════════
  //  MEWO — HELP  (mewo/help.ts)
  // ════════════════════════════════════════════════════════════════
  {
    id: "mewo.help",
    module: "Mewo",
    title: "Mewo Help",
    description: "Available modules and commands.",
    color: 0x5865f2,
    footer: "mewo help <module> for details",
    thumbnail: null,
    image: null,
    fields: [],
  },

  // ════════════════════════════════════════════════════════════════
  //  MEWO — FAKE  (mewo/modules/fake.ts)
  // ════════════════════════════════════════════════════════════════
  {
    id: "mewo.fake.help",
    module: "Mewo",
    title: "Fake Media Generation",
    description: "`mewo fake message @user <text>` — Fake Discord message\n`mewo fake reply @replied_to @author <text>` — Fake reply\n`mewo fake quote @user <text>` — Fake quote card",
    color: 0x5865f2,
    footer: "mewo • fake",
    thumbnail: null,
    image: null,
    fields: [],
  },

  // ════════════════════════════════════════════════════════════════
  //  MEWO — WALLET  (mewo/modules/wallet.ts)
  // ════════════════════════════════════════════════════════════════
  {
    id: "mewo.wallet.daily",
    module: "Mewo",
    title: null,
    description: "💰 Daily coins claimed! +{amount} {currency}",
    color: 0x57f287,
    footer: "mewo • wallet",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mewo.wallet.daily.cooldown",
    module: "Mewo",
    title: null,
    description: "⏳ Slow down! Wait **{seconds}s** before using this command again.",
    color: 0xfee75c,
    footer: "mewo • cooldown",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mewo.wallet.gamble.win",
    module: "Mewo",
    title: null,
    description: "🎉 You won **{amount}** {currency}!",
    color: 0x57f287,
    footer: "mewo • wallet",
    thumbnail: null,
    image: null,
    fields: [],
  },
  {
    id: "mewo.wallet.gamble.lose",
    module: "Mewo",
    title: null,
    description: "💸 You lost **{amount}** {currency}.",
    color: 0xed4245,
    footer: "mewo • wallet",
    thumbnail: null,
    image: null,
    fields: [],
  },

  // ════════════════════════════════════════════════════════════════
  //  MEWO — ROLEPLAY  (mewo/modules/roleplay.ts — embeds with GIFs)
  // ════════════════════════════════════════════════════════════════
  {
    id: "mewo.roleplay.action",
    module: "Mewo",
    title: null,
    description: "{author} {verb}s {target}",
    color: 0x5865f2,
    footer: "mewo • roleplay",
    thumbnail: null,
    image: "{actionGif}",
    fields: [],
  },

  // ════════════════════════════════════════════════════════════════
  //  MEWO — SEARCH  (mewo/modules/search.ts)
  // ════════════════════════════════════════════════════════════════
  {
    id: "mewo.search.github",
    module: "Mewo",
    title: "{username} — GitHub",
    description: "{bio}",
    color: 0x24292e,
    footer: "mewo • search • GitHub",
    thumbnail: "{avatarUrl}",
    image: null,
    fields: [
      { name: "Repos",     value: "{repos}",     inline: true },
      { name: "Followers", value: "{followers}", inline: true },
      { name: "Following", value: "{following}", inline: true },
    ],
  },
  {
    id: "mewo.search.youtube",
    module: "Mewo",
    title: "{videoTitle}",
    description: "{description}",
    color: 0xff0000,
    footer: "mewo • search • YouTube",
    thumbnail: "{thumbnail}",
    image: null,
    fields: [
      { name: "Channel", value: "{channel}", inline: true },
      { name: "Views",   value: "{views}",   inline: true },
      { name: "Likes",   value: "{likes}",   inline: true },
    ],
  },
  {
    id: "mewo.search.minecraft.server",
    module: "Mewo",
    title: "{serverAddress} — Minecraft Server",
    description: "{motd}",
    color: 0x4caf50,
    footer: "mewo • search • Minecraft",
    thumbnail: null,
    image: null,
    fields: [
      { name: "Players", value: "{online}/{max}", inline: true },
      { name: "Version", value: "{version}",       inline: true },
      { name: "Status",  value: "{status}",        inline: true },
    ],
  },
  {
    id: "mewo.search.minecraft.user",
    module: "Mewo",
    title: "{username} — Minecraft",
    description: null,
    color: 0x4caf50,
    footer: "mewo • search • Minecraft",
    thumbnail: "{skinUrl}",
    image: null,
    fields: [
      { name: "UUID", value: "{uuid}", inline: false },
    ],
  },
  {
    id: "mewo.search.steam",
    module: "Mewo",
    title: "{displayName} — Steam",
    description: null,
    color: 0x1b2838,
    footer: "mewo • search • Steam",
    thumbnail: "{avatarUrl}",
    image: null,
    fields: [
      { name: "Status",      value: "{status}",      inline: true },
      { name: "Steam Level", value: "{level}",        inline: true },
      { name: "Games",       value: "{gameCount}",    inline: true },
    ],
  },
];

async function getOverride(id: string): Promise<Partial<EmbedData> | null> {
  const row = await db
    .select()
    .from(botKvTable)
    .where(eq(botKvTable.key, `dashboard:embed:${id}`))
    .limit(1);
  return row[0] ? (row[0].value as Partial<EmbedData>) : null;
}

function mergeEmbed(base: EmbedData, override: Partial<EmbedData> | null, lastModifiedAt?: Date, lastModifiedBy?: string) {
  return {
    id: base.id,
    module: base.module,
    title: override?.title !== undefined ? override.title : base.title,
    description: override?.description !== undefined ? override.description : base.description,
    color: override?.color !== undefined ? override.color : base.color,
    footer: override?.footer !== undefined ? override.footer : base.footer,
    thumbnail: override?.thumbnail !== undefined ? override.thumbnail : base.thumbnail,
    image: override?.image !== undefined ? override.image : base.image,
    fields: override?.fields !== undefined ? override.fields : base.fields,
    isDefault: override === null,
    lastModified: lastModifiedAt ? lastModifiedAt.toISOString() : null,
    lastModifiedBy: lastModifiedBy ?? null,
  };
}

router.get("/embeds", async (req, res): Promise<void> => {
  try {
    const overrideRows = await db
      .select()
      .from(botKvTable)
      .where(sql`${botKvTable.key} LIKE 'dashboard:embed:%'`);

    const overrideMap = new Map(
      overrideRows.map((r: typeof overrideRows[0]) => [r.key.replace("dashboard:embed:", ""), { value: r.value as Partial<EmbedData>, updatedAt: r.updatedAt }]),
    );

    const embeds = DEFAULT_EMBEDS.map((base) => {
      const ov = overrideMap.get(base.id);
      return mergeEmbed(base, ov?.value ?? null, ov?.updatedAt ?? undefined);
    });

    res.json(embeds);
  } catch (err) {
    req.log.error({ err }, "Failed to list embeds");
    res.status(500).json({ error: "Failed to list embeds" });
  }
});

router.get("/embeds/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = decodeURIComponent(rawId);
  const base = DEFAULT_EMBEDS.find((e) => e.id === id);
  if (!base) {
    res.status(404).json({ error: "Embed not found" });
    return;
  }
  const override = await getOverride(id);
  res.json(mergeEmbed(base, override));
});

router.put("/embeds/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = decodeURIComponent(rawId);
  const base = DEFAULT_EMBEDS.find((e) => e.id === id);
  if (!base) {
    res.status(404).json({ error: "Embed not found" });
    return;
  }

  const key = `dashboard:embed:${id}`;
  const existingRow = await db.select().from(botKvTable).where(eq(botKvTable.key, key)).limit(1);
  const before = existingRow[0]?.value ?? {};

  const updated = req.body as Partial<EmbedData>;

  await db
    .insert(botKvTable)
    .values({ key, value: updated })
    .onConflictDoUpdate({ target: botKvTable.key, set: { value: updated } });

  await writeAuditLog({
    action: `embed.updated:${id}`,
    userId: req.session.userId!,
    username: req.session.username!,
    before: before as Record<string, unknown>,
    after: updated as Record<string, unknown>,
  });

  res.json(mergeEmbed(base, updated, new Date(), req.session.username));
});

router.delete("/embeds/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = decodeURIComponent(rawId);
  const key = `dashboard:embed:${id}`;

  const existingRow = await db.select().from(botKvTable).where(eq(botKvTable.key, key)).limit(1);
  if (existingRow[0]) {
    await db.delete(botKvTable).where(eq(botKvTable.key, key));
    await writeAuditLog({
      action: `embed.reset:${id}`,
      userId: req.session.userId!,
      username: req.session.username!,
      before: existingRow[0].value as Record<string, unknown>,
      after: {},
    });
  }

  res.json({ ok: true, message: "Embed reset to default" });
});

export default router;
