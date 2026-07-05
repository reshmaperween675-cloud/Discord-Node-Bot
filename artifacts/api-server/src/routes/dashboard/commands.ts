import { Router, type IRouter } from "express";
import { db, botKvTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth.js";
import { writeAuditLog } from "../../lib/audit.js";

const router: IRouter = Router();
router.use(requireAuth);

// ─── Complete command registry built directly from the bot source files ────────
// Sources: lowo/router.ts, mewo/router.ts, fun/data.ts, fun/commands.ts,
//          leveling/commands.ts, economy/commands.ts, activity/commands.ts,
//          antinuke/commands.ts, moderation/, raids/, training/, tournament/,
//          leaderboard/, killLeaderboard/
// ─────────────────────────────────────────────────────────────────────────────
const COMMAND_REGISTRY = [
  // ── Slash: Leveling ──────────────────────────────────────────────────────────
  { name: "/rank",               description: "View your XP rank card (or another member's)", category: "Leveling", isSlash: true, fileLocation: "leveling/commands.ts" },
  { name: "/levellb",            description: "All-time XP leaderboard", category: "Leveling", isSlash: true, fileLocation: "leveling/commands.ts" },
  { name: "/weeklylb",           description: "This week's XP leaderboard", category: "Leveling", isSlash: true, fileLocation: "leveling/commands.ts" },
  { name: "/addxp",              description: "Add XP to a member (admin)", category: "Leveling", isSlash: true, fileLocation: "leveling/commands.ts" },
  { name: "/removexp",           description: "Remove XP from a member (admin)", category: "Leveling", isSlash: true, fileLocation: "leveling/commands.ts" },
  { name: "/setxp",              description: "Set a member's total XP to an exact value (admin)", category: "Leveling", isSlash: true, fileLocation: "leveling/commands.ts" },
  { name: "/resetxp",            description: "Fully reset a member's XP and level (admin)", category: "Leveling", isSlash: true, fileLocation: "leveling/commands.ts" },
  { name: "/exportdata",         description: "Export leveling/censor data as files (admin)", category: "Leveling", isSlash: true, fileLocation: "leveling/commands.ts" },
  { name: "/setlevelrole",       description: "Assign a role to be granted at a specific level (admin)", category: "Leveling", isSlash: true, fileLocation: "leveling/commands.ts" },
  { name: "/removelevelrole",    description: "Remove the role assignment from a level (admin)", category: "Leveling", isSlash: true, fileLocation: "leveling/commands.ts" },
  { name: "/setxpcooldown",      description: "Set XP gain cooldown in seconds (admin)", category: "Leveling", isSlash: true, fileLocation: "leveling/commands.ts" },
  { name: "/setxprange",         description: "Set the min/max XP awarded per message (admin)", category: "Leveling", isSlash: true, fileLocation: "leveling/commands.ts" },
  { name: "/setxpchannel",       description: "Configure level-up notification channel and ping (admin)", category: "Leveling", isSlash: true, fileLocation: "leveling/commands.ts" },
  { name: "/setmultiplier",      description: "Set an XP multiplier: Server / Event / Role (admin)", category: "Leveling", isSlash: true, fileLocation: "leveling/commands.ts" },
  { name: "/blacklistchannel",   description: "Block XP gain in a channel (admin)", category: "Leveling", isSlash: true, fileLocation: "leveling/commands.ts" },
  { name: "/whitelistchannel",   description: "Restrict XP gain to specific channels (admin)", category: "Leveling", isSlash: true, fileLocation: "leveling/commands.ts" },
  { name: "/xpconfig",           description: "View current XP system configuration", category: "Leveling", isSlash: true, fileLocation: "leveling/commands.ts" },
  { name: "/levelroles",         description: "View all configured level-up roles", category: "Leveling", isSlash: true, fileLocation: "leveling/commands.ts" },
  { name: "/startlsxpsystem",    description: "Enable the XP system (admin)", category: "Leveling", isSlash: true, fileLocation: "leveling/commands.ts" },
  { name: "/stoplsxpsystem",     description: "Disable the XP system (admin)", category: "Leveling", isSlash: true, fileLocation: "leveling/commands.ts" },

  // ── Slash: Economy ───────────────────────────────────────────────────────────
  { name: "/balance",            description: "Check your coin balance", category: "Economy", isSlash: true, fileLocation: "economy/commands.ts" },
  { name: "/daily",              description: "Claim your daily coin reward", category: "Economy", isSlash: true, fileLocation: "economy/commands.ts" },
  { name: "/weekly",             description: "Claim your weekly coin reward", category: "Economy", isSlash: true, fileLocation: "economy/commands.ts" },
  { name: "/work",               description: "Work a job to earn coins", category: "Economy", isSlash: true, fileLocation: "economy/commands.ts" },
  { name: "/shop",               description: "Browse the coin shop", category: "Economy", isSlash: true, fileLocation: "economy/commands.ts" },
  { name: "/buy",                description: "Purchase an item from the shop", category: "Economy", isSlash: true, fileLocation: "economy/commands.ts" },
  { name: "/transfer",           description: "Send coins to another user", category: "Economy", isSlash: true, fileLocation: "economy/commands.ts" },
  { name: "/rob",                description: "Attempt to rob another user's wallet", category: "Economy", isSlash: true, fileLocation: "economy/commands.ts" },
  { name: "/invest",             description: "Invest coins for a chance to multiply them (24h lockup)", category: "Economy", isSlash: true, fileLocation: "economy/commands.ts" },
  { name: "/crime",              description: "Commit a crime for high-risk high-reward payout", category: "Economy", isSlash: true, fileLocation: "economy/commands.ts" },
  { name: "/inventory",          description: "View your item inventory", category: "Economy", isSlash: true, fileLocation: "economy/commands.ts" },
  { name: "/ecotop",             description: "Show the top richest users", category: "Economy", isSlash: true, fileLocation: "economy/commands.ts" },

  // ── Slash: Moderation ────────────────────────────────────────────────────────
  { name: "/warn",               description: "Warn a member", category: "Moderation", isSlash: true, fileLocation: "moderation/commands.ts" },
  { name: "/clearwarns",         description: "Clear all warnings for a member", category: "Moderation", isSlash: true, fileLocation: "moderation/commands.ts" },
  { name: "/kick",               description: "Kick a member from the server", category: "Moderation", isSlash: true, fileLocation: "moderation/modActions.ts" },
  { name: "/ban",                description: "Ban a member from the server", category: "Moderation", isSlash: true, fileLocation: "moderation/modActions.ts" },
  { name: "/tempban",            description: "Temporarily ban a member", category: "Moderation", isSlash: true, fileLocation: "moderation/modActions.ts" },
  { name: "/mute",               description: "Mute (timeout) a member", category: "Moderation", isSlash: true, fileLocation: "moderation/modActions.ts" },
  { name: "/unmute",             description: "Remove timeout from a member", category: "Moderation", isSlash: true, fileLocation: "moderation/modActions.ts" },
  { name: "/purge",              description: "Bulk delete messages from a channel", category: "Moderation", isSlash: true, fileLocation: "moderation/purge.ts" },
  { name: "/censor",             description: "Enable server word censor", category: "Moderation", isSlash: true, fileLocation: "moderation/commands.ts" },
  { name: "/stopcensor",         description: "Disable server word censor", category: "Moderation", isSlash: true, fileLocation: "moderation/commands.ts" },

  // ── Slash: Server ────────────────────────────────────────────────────────────
  { name: "/announce",           description: "Send an announcement", category: "Server", isSlash: true, fileLocation: "utility/index.ts" },
  { name: "/promote",            description: "Promote a member", category: "Server", isSlash: true, fileLocation: "utility/index.ts" },
  { name: "/demote",             description: "Demote a member", category: "Server", isSlash: true, fileLocation: "utility/index.ts" },
  { name: "/attendance",         description: "Mark attendance for a member", category: "Server", isSlash: true, fileLocation: "utility/index.ts" },
  { name: "/poll",               description: "Create a poll in the current channel", category: "Server", isSlash: true, fileLocation: "utility/index.ts" },
  { name: "/mvp",                description: "Vote for MVP", category: "Server", isSlash: true, fileLocation: "utility/index.ts" },
  { name: "/suggestion",         description: "Submit a suggestion", category: "Server", isSlash: true, fileLocation: "utility/index.ts" },
  { name: "/setuprules",         description: "Set up the server rules panel", category: "Server", isSlash: true, fileLocation: "rules/index.ts" },
  { name: "/setupchallengepanel",description: "Set up challenge verification panel", category: "Server", isSlash: true, fileLocation: "commands/setupChallengePanel.ts" },
  { name: "/tournament",         description: "Open a tournament", category: "Server", isSlash: true, fileLocation: "tournament/index.ts" },
  { name: "/closetournament",    description: "Close a tournament", category: "Server", isSlash: true, fileLocation: "tournament/index.ts" },
  { name: "/training",           description: "Start a training session", category: "Server", isSlash: true, fileLocation: "training/index.ts" },
  { name: "/setupleaderboard",   description: "Deploy the TSB leaderboard (admin)", category: "Server", isSlash: true, fileLocation: "leaderboard/commands.ts" },
  { name: "/addleaderboardplayer",    description: "Add a player to the leaderboard (admin)", category: "Server", isSlash: true, fileLocation: "leaderboard/commands.ts" },
  { name: "/removeleaderboardplayer", description: "Remove a player from the leaderboard (admin)", category: "Server", isSlash: true, fileLocation: "leaderboard/commands.ts" },
  { name: "/editleaderboardplayer",   description: "Edit leaderboard player details (admin)", category: "Server", isSlash: true, fileLocation: "leaderboard/commands.ts" },
  { name: "/addkillplayer",      description: "Add player to kill leaderboard (admin)", category: "Server", isSlash: true, fileLocation: "killLeaderboard/commands.ts" },
  { name: "/editkillplayer",     description: "Edit kill leaderboard player (admin)", category: "Server", isSlash: true, fileLocation: "killLeaderboard/commands.ts" },
  { name: "/removekillplayer",   description: "Remove player from kill leaderboard (admin)", category: "Server", isSlash: true, fileLocation: "killLeaderboard/commands.ts" },
  { name: "/movek",              description: "Move kill leaderboard player to new rank (admin)", category: "Server", isSlash: true, fileLocation: "killLeaderboard/commands.ts" },

  // ── Slash: Raids ─────────────────────────────────────────────────────────────
  { name: "/startraid",          description: "Start a raid against an opponent", category: "Raids", isSlash: true, fileLocation: "raids/index.ts" },
  { name: "/endraid",            description: "End the active raid", category: "Raids", isSlash: true, fileLocation: "raids/index.ts" },
  { name: "/raidannounce",       description: "Announce a raid", category: "Raids", isSlash: true, fileLocation: "raids/announce.ts" },

  // ── Slash: General ───────────────────────────────────────────────────────────
  { name: "/help",               description: "View bot capabilities", category: "General", isSlash: true, fileLocation: "commands/help.ts" },

  // ── Slash: Lowo Admin ────────────────────────────────────────────────────────
  { name: "/lowoenable",         description: "Enable the Lowo game system", category: "Lowo Admin", isSlash: true, fileLocation: "lowo/slashCommands.ts" },
  { name: "/lowodisable",        description: "Disable the Lowo game system", category: "Lowo Admin", isSlash: true, fileLocation: "lowo/slashCommands.ts" },
  { name: "/lowoadmin",          description: "Grant or revoke Lowo admin for a user", category: "Lowo Admin", isSlash: true, fileLocation: "lowo/slashCommands.ts" },
  { name: "/lowodynamicenable",  description: "Enable Lowo Dynamic Mode", category: "Lowo Admin", isSlash: true, fileLocation: "lowo/slashCommands.ts" },
  { name: "/lowodynamicdisable", description: "Disable Lowo Dynamic Mode", category: "Lowo Admin", isSlash: true, fileLocation: "lowo/slashCommands.ts" },

  // ── Slash: Fun — Social (prefix /social <sub>) ───────────────────────────────
  { name: "/social hug",         description: "Hug someone", category: "Slash Social", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/social slap",        description: "Slap someone", category: "Slash Social", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/social kiss",        description: "Kiss someone", category: "Slash Social", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/social pat",         description: "Pat someone on the head", category: "Slash Social", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/social cuddle",      description: "Cuddle someone", category: "Slash Social", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/social poke",        description: "Poke someone", category: "Slash Social", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/social bite",        description: "Bite someone", category: "Slash Social", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/social highfive",    description: "High-five someone", category: "Slash Social", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/social handhold",    description: "Hold hands with someone", category: "Slash Social", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/social stare",       description: "Stare at someone", category: "Slash Social", isSlash: true, fileLocation: "fun/commands.ts" },

  // ── Slash: Fun — Troll ───────────────────────────────────────────────────────
  { name: "/troll roast",        description: "Roast someone", category: "Slash Troll", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/troll insult",       description: "Insult someone (playfully)", category: "Slash Troll", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/troll toxicrate",    description: "Rate someone's toxicity level", category: "Slash Troll", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/troll cancel",       description: "Cancel someone", category: "Slash Troll", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/troll ratio",        description: "Ratio someone", category: "Slash Troll", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/troll clown",        description: "Clown someone", category: "Slash Troll", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/troll expose",       description: "Expose someone", category: "Slash Troll", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/troll skillissue",   description: "Call out a skill issue", category: "Slash Troll", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/troll noobrate",     description: "Rate someone's noob level", category: "Slash Troll", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/troll sus",          description: "Call someone sus", category: "Slash Troll", isSlash: true, fileLocation: "fun/commands.ts" },

  // ── Slash: Fun — Relationship ────────────────────────────────────────────────
  { name: "/relationship love",    description: "Show love to someone", category: "Slash Relationship", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/relationship marry",   description: "Propose to someone", category: "Slash Relationship", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/relationship divorce", description: "Divorce someone", category: "Slash Relationship", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/relationship crush",   description: "Reveal a crush", category: "Slash Relationship", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/relationship ship",    description: "Ship two users together", category: "Slash Relationship", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/relationship rizz",    description: "Rate someone's rizz", category: "Slash Relationship", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/relationship simp",    description: "Call someone a simp", category: "Slash Relationship", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/relationship date",    description: "Ask someone on a date", category: "Slash Relationship", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/relationship gf",      description: "Get a random girlfriend name", category: "Slash Relationship", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/relationship bf",      description: "Get a random boyfriend name", category: "Slash Relationship", isSlash: true, fileLocation: "fun/commands.ts" },

  // ── Slash: Fun — Answer ──────────────────────────────────────────────────────
  { name: "/answer ask",          description: "Ask anything — get a random answer", category: "Slash Answer", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/answer eightball",    description: "Ask the magic 8-ball", category: "Slash Answer", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/answer advice",       description: "Get random advice", category: "Slash Answer", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/answer truth",        description: "Get a truth question", category: "Slash Answer", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/answer dare",         description: "Get a dare", category: "Slash Answer", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/answer confession",   description: "Get a random confession", category: "Slash Answer", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/answer pickup",       description: "Get a pickup line", category: "Slash Answer", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/answer compliment",   description: "Compliment someone", category: "Slash Answer", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/answer chat",         description: "Get a random chat line", category: "Slash Answer", isSlash: true, fileLocation: "fun/commands.ts" },

  // ── Slash: Fun — Meme ────────────────────────────────────────────────────────
  { name: "/meme meme",           description: "Send a random meme", category: "Slash Meme", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/meme shitpost",       description: "Send a shitpost", category: "Slash Meme", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/meme randomfact",     description: "Send a random fact", category: "Slash Meme", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/meme joke",           description: "Tell a joke", category: "Slash Meme", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/meme darkjoke",       description: "Tell a dark joke", category: "Slash Meme", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/meme brainrot",       description: "Pure brainrot energy", category: "Slash Meme", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/meme quote",          description: "Random anime quote", category: "Slash Meme", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/meme copypasta",      description: "Random copypasta line", category: "Slash Meme", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/meme triggered",      description: "Get triggered", category: "Slash Meme", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/meme cringe",         description: "Cringe at something", category: "Slash Meme", isSlash: true, fileLocation: "fun/commands.ts" },

  // ── Slash: Fun — Game ────────────────────────────────────────────────────────
  { name: "/game coinflip",       description: "Flip a coin", category: "Slash Game", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/game dice",           description: "Roll a dice", category: "Slash Game", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/game rps",            description: "Play rock paper scissors", category: "Slash Game", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/game guess",          description: "Bot guesses a number 1–10", category: "Slash Game", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/game fight",          description: "Fight someone", category: "Slash Game", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/game duel",           description: "Duel someone", category: "Slash Game", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/game gamble",         description: "Gamble your luck", category: "Slash Game", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/game slots",          description: "Spin the slots", category: "Slash Game", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/game trivia",         description: "Get a random trivia question", category: "Slash Game", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/game clickspeed",     description: "Random click speed test", category: "Slash Game", isSlash: true, fileLocation: "fun/commands.ts" },

  // ── Slash: Fun — LS ──────────────────────────────────────────────────────────
  { name: "/ls raidcall",         description: "Call a raid — get in voice!", category: "Slash LS", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/ls teamup",           description: "Team up with someone", category: "Slash LS", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/ls lstarget",         description: "Mark a target for elimination", category: "Slash LS", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/ls backup",           description: "Call for backup", category: "Slash LS", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/ls clutch",           description: "Clutch moment", category: "Slash LS", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/ls rankme",           description: "Rate your overall vibe", category: "Slash LS", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/ls lsrate",           description: "Rate someone as an LS member", category: "Slash LS", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/ls toxicmode",        description: "Toggle (fake) toxic mode", category: "Slash LS", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/ls warcry",           description: "Unleash a war cry", category: "Slash LS", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/ls laststand",        description: "Make your last stand", category: "Slash LS", isSlash: true, fileLocation: "fun/commands.ts" },

  // ── Slash: Fun — Bonus ───────────────────────────────────────────────────────
  { name: "/bonus ego",           description: "Rate ego level", category: "Slash Bonus", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/bonus aura",          description: "Check someone's aura", category: "Slash Bonus", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/bonus drip",          description: "Rate someone's drip", category: "Slash Bonus", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/bonus npc",           description: "Call someone an NPC", category: "Slash Bonus", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/bonus maincharacter", description: "Main character moment", category: "Slash Bonus", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/bonus villain",       description: "Villain arc", category: "Slash Bonus", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/bonus glaze",         description: "Glaze someone", category: "Slash Bonus", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/bonus mid",           description: "Call something mid", category: "Slash Bonus", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/bonus peak",          description: "Call something peak", category: "Slash Bonus", isSlash: true, fileLocation: "fun/commands.ts" },
  { name: "/bonus fallen",        description: "You fell off", category: "Slash Bonus", isSlash: true, fileLocation: "fun/commands.ts" },

  // ── Lowo: Economy ────────────────────────────────────────────────────────────
  { name: "lowo cowoncy",    description: "Check your cowoncy balance (aliases: bal, balance, money)", category: "Lowo Economy", isSlash: false, fileLocation: "lowo/economy.ts" },
  { name: "lowo cash",       description: "Check your Lowo Cash (alias: c)", category: "Lowo Economy", isSlash: false, fileLocation: "lowo/economy.ts" },
  { name: "lowo daily",      description: "Claim your daily cowoncy reward (alias: d)", category: "Lowo Economy", isSlash: false, fileLocation: "lowo/economy.ts" },
  { name: "lowo give",       description: "Give cowoncy to another user (alias: send)", category: "Lowo Economy", isSlash: false, fileLocation: "lowo/economy.ts" },
  { name: "lowo vote",       description: "Vote for the bot for bonus cowoncy", category: "Lowo Economy", isSlash: false, fileLocation: "lowo/economy.ts" },
  { name: "lowo rep",        description: "Give reputation points to a user", category: "Lowo Economy", isSlash: false, fileLocation: "lowo/economy.ts" },
  { name: "lowo tag",        description: "Set a tag message (shown on your profile)", category: "Lowo Economy", isSlash: false, fileLocation: "lowo/economy.ts" },

  // ── Lowo: Hunt & Zoo ─────────────────────────────────────────────────────────
  { name: "lowo hunt",       description: "Hunt for animals in your current area (alias: h)", category: "Lowo Hunt", isSlash: false, fileLocation: "lowo/hunt.ts" },
  { name: "lowo zoo",        description: "View your animal collection (alias: z)", category: "Lowo Hunt", isSlash: false, fileLocation: "lowo/hunt.ts" },
  { name: "lowo sell",       description: "Sell an animal from your zoo (alias: s)", category: "Lowo Hunt", isSlash: false, fileLocation: "lowo/hunt.ts" },
  { name: "lowo sacrifice",  description: "Sacrifice an animal for essence (alias: sac)", category: "Lowo Hunt", isSlash: false, fileLocation: "lowo/hunt.ts" },
  { name: "lowo lowodex",    description: "View the Lowodex — all catchable animals (alias: dex)", category: "Lowo Hunt", isSlash: false, fileLocation: "lowo/hunt.ts" },
  { name: "lowo autosell",   description: "Toggle auto-sell for a rarity (alias: as)", category: "Lowo Hunt", isSlash: false, fileLocation: "lowo/autoSell.ts" },
  { name: "lowo bulk",       description: "Bulk sell all animals of a rarity (alias: bulksell)", category: "Lowo Hunt", isSlash: false, fileLocation: "lowo/autoSell.ts" },
  { name: "lowo animalstat", description: "Look up an animal's full stats (alias: astat, animal, info)", category: "Lowo Hunt", isSlash: false, fileLocation: "lowo/autoSell.ts" },
  { name: "lowo area",       description: "View or switch hunt area (Forest/Volcanic/Space/Heaven/Void) (alias: areas, region)", category: "Lowo Hunt", isSlash: false, fileLocation: "lowo/areas.ts" },
  { name: "lowo autohunt",   description: "Toggle auto-hunt (2-min interval) (alias: ah)", category: "Lowo Hunt", isSlash: false, fileLocation: "lowo/extra.ts" },
  { name: "lowo mutation",   description: "View your animal mutations (alias: mutations, mut)", category: "Lowo Hunt", isSlash: false, fileLocation: "lowo/opItems.ts" },

  // ── Lowo: Fishing & Aquarium ─────────────────────────────────────────────────
  { name: "lowo fish",       description: "Go fishing — fish go to your aquarium (alias: f)", category: "Lowo Fishing", isSlash: false, fileLocation: "lowo/fish.ts" },
  { name: "lowo aquarium",   description: "View your aquarium / fish tank (alias: aq, tank)", category: "Lowo Fishing", isSlash: false, fileLocation: "lowo/aquarium.ts" },
  { name: "lowo fishdex",    description: "View the fish-only dex (alias: fd)", category: "Lowo Fishing", isSlash: false, fileLocation: "lowo/aquarium.ts" },

  // ── Lowo: Mining & Crafting ──────────────────────────────────────────────────
  { name: "lowo mine",        description: "Mine for minerals (need a Pickaxe from shop) (alias: m)", category: "Lowo Mining", isSlash: false, fileLocation: "lowo/mine.ts" },
  { name: "lowo minerals",    description: "View your mineral inventory (alias: ore, ores)", category: "Lowo Mining", isSlash: false, fileLocation: "lowo/mine.ts" },
  { name: "lowo sellmineral", description: "Sell a mineral (alias: sm, sellore)", category: "Lowo Mining", isSlash: false, fileLocation: "lowo/mine.ts" },
  { name: "lowo craft",       description: "Craft items from recipes (alias: recipes, recipe)", category: "Lowo Mining", isSlash: false, fileLocation: "lowo/crafting.ts" },

  // ── Lowo: Battle ─────────────────────────────────────────────────────────────
  { name: "lowo team",        description: "Manage your battle team: add/remove/view (alias: t)", category: "Lowo Battle", isSlash: false, fileLocation: "lowo/battle.ts" },
  { name: "lowo battle",      description: "Battle another user's team for Battle Tokens (alias: b)", category: "Lowo Battle", isSlash: false, fileLocation: "lowo/battle.ts" },
  { name: "lowo skillbattle", description: "Challenge someone to a PvP skill battle (alias: sb)", category: "Lowo Battle", isSlash: false, fileLocation: "lowo/skillBattle.ts" },
  { name: "lowo sbattack",    description: "Attack during a skill battle (alias: sba)", category: "Lowo Battle", isSlash: false, fileLocation: "lowo/skillBattle.ts" },
  { name: "lowo attackboss",  description: "Attack the co-op world boss (alias: ab, hitboss)", category: "Lowo Battle", isSlash: false, fileLocation: "lowo/bosses.ts" },
  { name: "lowo boss",        description: "View world boss info (alias: bossinfo)", category: "Lowo Battle", isSlash: false, fileLocation: "lowo/bosses.ts" },
  { name: "lowo battlesetting", description: "Toggle battle reply style (instant/normal) (alias: bs)", category: "Lowo Battle", isSlash: false, fileLocation: "lowo/extra.ts" },
  { name: "lowo rename",      description: "Rename a pet in your team", category: "Lowo Battle", isSlash: false, fileLocation: "lowo/extra.ts" },
  { name: "lowo dismantle",   description: "Dismantle a weapon or item", category: "Lowo Battle", isSlash: false, fileLocation: "lowo/extra.ts" },

  // ── Lowo: Gear & Weapons ─────────────────────────────────────────────────────
  { name: "lowo weapon",      description: "View your weapons (alias: weapons, w)", category: "Lowo Gear", isSlash: false, fileLocation: "lowo/battle.ts" },
  { name: "lowo equip",       description: "Equip weapon/armor/accessory to a pet (alias: eq)", category: "Lowo Gear", isSlash: false, fileLocation: "lowo/battle.ts" },
  { name: "lowo crate",       description: "Open a weapon crate (costs 2500 cwn)", category: "Lowo Gear", isSlash: false, fileLocation: "lowo/battle.ts" },
  { name: "lowo enchant",     description: "Apply or view enchantments on a pet (alias: ench, enchantments)", category: "Lowo Gear", isSlash: false, fileLocation: "lowo/enchant.ts" },
  { name: "lowo reroll",      description: "Reroll a pet's attribute (alias: rr)", category: "Lowo Gear", isSlash: false, fileLocation: "lowo/opItems.ts" },
  { name: "lowo op_open",     description: "Open an OP item chest (alias: opopen)", category: "Lowo Gear", isSlash: false, fileLocation: "lowo/opItems.ts" },

  // ── Lowo: Pets & Skills ──────────────────────────────────────────────────────
  { name: "lowo skills",      description: "View a pet's skill tree (alias: skill, sk)", category: "Lowo Pets", isSlash: false, fileLocation: "lowo/skills.ts" },
  { name: "lowo skillshop",   description: "Browse learnable pet skills", category: "Lowo Pets", isSlash: false, fileLocation: "lowo/petSkills.ts" },
  { name: "lowo learnskill",  description: "Learn a skill for a pet (alias: learn)", category: "Lowo Pets", isSlash: false, fileLocation: "lowo/petSkills.ts" },
  { name: "lowo myskills",    description: "View your owned pet skills", category: "Lowo Pets", isSlash: false, fileLocation: "lowo/petSkills.ts" },
  { name: "lowo equipskill",  description: "Equip a skill to a pet slot", category: "Lowo Pets", isSlash: false, fileLocation: "lowo/petSkills.ts" },
  { name: "lowo petskills",   description: "View skills equipped on a pet (alias: ps)", category: "Lowo Pets", isSlash: false, fileLocation: "lowo/petSkills.ts" },
  { name: "lowo recycle",     description: "Recycle a pet into Pet Materials (alias: rec, breakdown)", category: "Lowo Pets", isSlash: false, fileLocation: "lowo/pets.ts" },
  { name: "lowo materials",   description: "View your Pet Materials count (alias: mats, mat)", category: "Lowo Pets", isSlash: false, fileLocation: "lowo/pets.ts" },
  { name: "lowo fuse",        description: "Fuse two pets into a fusion pet (alias: fusion)", category: "Lowo Pets", isSlash: false, fileLocation: "lowo/pets.ts" },
  { name: "lowo interact",    description: "Play or talk to your sentient pet (alias: play, talk)", category: "Lowo Pets", isSlash: false, fileLocation: "lowo/sentientPets.ts" },
  { name: "lowo petmood",     description: "View a pet's mood and loyalty stats (alias: mood, loyalty)", category: "Lowo Pets", isSlash: false, fileLocation: "lowo/sentientPets.ts" },
  { name: "lowo prestige",    description: "Prestige a pet at level cap for permanent stat doubling (alias: ascend, ascension)", category: "Lowo Pets", isSlash: false, fileLocation: "lowo/prestige.ts" },

  // ── Lowo: Gambling ───────────────────────────────────────────────────────────
  { name: "lowo slots",       description: "Play the slot machine (alias: slot)", category: "Lowo Gambling", isSlash: false, fileLocation: "lowo/gambling.ts" },
  { name: "lowo coinflip",    description: "Flip a coin — heads or tails (alias: cf)", category: "Lowo Gambling", isSlash: false, fileLocation: "lowo/gambling.ts" },
  { name: "lowo blackjack",   description: "Play blackjack against the dealer (alias: bj)", category: "Lowo Gambling", isSlash: false, fileLocation: "lowo/gambling.ts" },
  { name: "lowo lottery",     description: "Buy lottery tickets or check the jackpot", category: "Lowo Gambling", isSlash: false, fileLocation: "lowo/gambling.ts" },

  // ── Lowo: Shop & Inventory ───────────────────────────────────────────────────
  { name: "lowo shop",        description: "Browse the Lowo shop (items/equips/pets/premium/gamepasses/…)", category: "Lowo Shop", isSlash: false, fileLocation: "lowo/shop.ts" },
  { name: "lowo buy",         description: "Purchase an item from the shop", category: "Lowo Shop", isSlash: false, fileLocation: "lowo/shop.ts" },
  { name: "lowo setbg",       description: "Set your profile background (alias: background)", category: "Lowo Shop", isSlash: false, fileLocation: "lowo/shop.ts" },
  { name: "lowo inv",         description: "View your item inventory (alias: inventory, i)", category: "Lowo Shop", isSlash: false, fileLocation: "lowo/extra.ts" },
  { name: "lowo lootbox",     description: "Open a lootbox from your inventory (alias: lb2)", category: "Lowo Shop", isSlash: false, fileLocation: "lowo/extra.ts" },
  { name: "lowo box",         description: "Open a box (bronze/silver/gold) (alias: boxes, open)", category: "Lowo Shop", isSlash: false, fileLocation: "lowo/extra.ts" },

  // ── Lowo: Profile ────────────────────────────────────────────────────────────
  { name: "lowo profile",     description: "View your Lowo profile card (alias: p)", category: "Lowo Profile", isSlash: false, fileLocation: "lowo/profile.ts" },
  { name: "lowo card",        description: "View your compact stats card", category: "Lowo Profile", isSlash: false, fileLocation: "lowo/profile.ts" },
  { name: "lowo level",       description: "View your Lowo level (alias: lvl)", category: "Lowo Profile", isSlash: false, fileLocation: "lowo/profile.ts" },
  { name: "lowo top",         description: "Leaderboard — cowoncy/essence/dex/animals/rep/streak (alias: leaderboard, lb)", category: "Lowo Profile", isSlash: false, fileLocation: "lowo/profile.ts" },
  { name: "lowo avatar",      description: "View a user's avatar (alias: av)", category: "Lowo Profile", isSlash: false, fileLocation: "lowo/profile.ts" },
  { name: "lowo wallpaper",   description: "Set or view your wallpaper", category: "Lowo Profile", isSlash: false, fileLocation: "lowo/profile.ts" },
  { name: "lowo emoji",       description: "Set a custom emoji for your profile", category: "Lowo Profile", isSlash: false, fileLocation: "lowo/profile.ts" },
  { name: "lowo cookie",      description: "Give a cookie to someone", category: "Lowo Profile", isSlash: false, fileLocation: "lowo/profile.ts" },
  { name: "lowo pray",        description: "Pray for someone for a small cwn boost", category: "Lowo Profile", isSlash: false, fileLocation: "lowo/profile.ts" },
  { name: "lowo curse",       description: "Curse someone (negative effect)", category: "Lowo Profile", isSlash: false, fileLocation: "lowo/profile.ts" },
  { name: "lowo my",          description: "Quick view of your own profile stats", category: "Lowo Profile", isSlash: false, fileLocation: "lowo/profile.ts" },

  // ── Lowo: Quests & Events ────────────────────────────────────────────────────
  { name: "lowo quest",       description: "View and track your daily quests (alias: quests, q)", category: "Lowo Quests", isSlash: false, fileLocation: "lowo/quests.ts" },
  { name: "lowo checklist",   description: "View your daily checklist (alias: cl)", category: "Lowo Quests", isSlash: false, fileLocation: "lowo/quests.ts" },
  { name: "lowo event",       description: "View active global events (alias: events, ev)", category: "Lowo Quests", isSlash: false, fileLocation: "lowo/events.ts" },
  { name: "lowo updatelogs",  description: "View recent Lowo update changelogs (alias: changelog, news)", category: "Lowo Quests", isSlash: false, fileLocation: "lowo/updateLogs.ts" },

  // ── Lowo: Market & Trade ─────────────────────────────────────────────────────
  { name: "lowo market",      description: "Browse the global pet marketplace (alias: mk, mkt, marketplace)", category: "Lowo Market", isSlash: false, fileLocation: "lowo/market.ts" },
  { name: "lowo trade",       description: "Trade pets/cowoncy/essence with another user (alias: tr)", category: "Lowo Market", isSlash: false, fileLocation: "lowo/trade.ts" },

  // ── Lowo: Void Ascension (v6) ────────────────────────────────────────────────
  { name: "lowo forge",       description: "Forge relics from materials (alias: smelt, relic, relics)", category: "Lowo Void", isSlash: false, fileLocation: "lowo/forge.ts" },
  { name: "lowo corrupt",     description: "Corrupt a pet with Void energy (alias: corruption, void)", category: "Lowo Void", isSlash: false, fileLocation: "lowo/corrupt.ts" },
  { name: "lowo voidshop",    description: "Browse the Void / Shard shop (alias: vshop, shardshop)", category: "Lowo Void", isSlash: false, fileLocation: "lowo/voidshop.ts" },
  { name: "lowo elements",    description: "View Eternal Elements (alias: el, eternalelements)", category: "Lowo Void", isSlash: false, fileLocation: "lowo/elements.ts" },
  { name: "lowo summon",      description: "Summon an Eternal Element", category: "Lowo Void", isSlash: false, fileLocation: "lowo/elements.ts" },
  { name: "lowo eternalboard",description: "View the Eternal Elements board (alias: elboard, elementsboard)", category: "Lowo Void", isSlash: false, fileLocation: "lowo/elements.ts" },

  // ── Lowo: Social ─────────────────────────────────────────────────────────────
  { name: "lowo hug",         description: "Hug someone (social features toggle required)", category: "Lowo Social", isSlash: false, fileLocation: "lowo/social.ts" },
  { name: "lowo kiss",        description: "Kiss someone (social features toggle required)", category: "Lowo Social", isSlash: false, fileLocation: "lowo/social.ts" },
  { name: "lowo slap",        description: "Slap someone", category: "Lowo Social", isSlash: false, fileLocation: "lowo/social.ts" },
  { name: "lowo pat",         description: "Pat someone on the head", category: "Lowo Social", isSlash: false, fileLocation: "lowo/social.ts" },
  { name: "lowo cuddle",      description: "Cuddle with someone", category: "Lowo Social", isSlash: false, fileLocation: "lowo/social.ts" },
  { name: "lowo poke",        description: "Poke someone", category: "Lowo Social", isSlash: false, fileLocation: "lowo/social.ts" },
  { name: "lowo propose",     description: "Propose to someone (alias: marry)", category: "Lowo Social", isSlash: false, fileLocation: "lowo/social.ts" },
  { name: "lowo divorce",     description: "Divorce your partner", category: "Lowo Social", isSlash: false, fileLocation: "lowo/social.ts" },
  { name: "lowo lowoify",     description: "Convert text to UwU/OwO style", category: "Lowo Social", isSlash: false, fileLocation: "lowo/social.ts" },
  { name: "lowo ship",        description: "Ship two users together", category: "Lowo Social", isSlash: false, fileLocation: "lowo/social.ts" },

  // ── Lowo: Emotes ─────────────────────────────────────────────────────────────
  { name: "lowo blush",       description: "Blush emote", category: "Lowo Emotes", isSlash: false, fileLocation: "lowo/emotes.ts" },
  { name: "lowo cry",         description: "Cry emote", category: "Lowo Emotes", isSlash: false, fileLocation: "lowo/emotes.ts" },
  { name: "lowo dance",       description: "Dance emote", category: "Lowo Emotes", isSlash: false, fileLocation: "lowo/emotes.ts" },
  { name: "lowo lewd",        description: "Lewd emote (censor required off)", category: "Lowo Emotes", isSlash: false, fileLocation: "lowo/emotes.ts" },
  { name: "lowo pout",        description: "Pout emote", category: "Lowo Emotes", isSlash: false, fileLocation: "lowo/emotes.ts" },
  { name: "lowo shrug",       description: "Shrug emote", category: "Lowo Emotes", isSlash: false, fileLocation: "lowo/emotes.ts" },
  { name: "lowo sleepy",      description: "Sleepy emote", category: "Lowo Emotes", isSlash: false, fileLocation: "lowo/emotes.ts" },
  { name: "lowo smile",       description: "Smile emote", category: "Lowo Emotes", isSlash: false, fileLocation: "lowo/emotes.ts" },
  { name: "lowo smug",        description: "Smug emote", category: "Lowo Emotes", isSlash: false, fileLocation: "lowo/emotes.ts" },
  { name: "lowo thumbsup",    description: "Thumbs up emote (alias: thumbs)", category: "Lowo Emotes", isSlash: false, fileLocation: "lowo/emotes.ts" },
  { name: "lowo wag",         description: "Wag emote", category: "Lowo Emotes", isSlash: false, fileLocation: "lowo/emotes.ts" },
  { name: "lowo thinking",    description: "Thinking emote", category: "Lowo Emotes", isSlash: false, fileLocation: "lowo/emotes.ts" },
  { name: "lowo triggered",   description: "Triggered emote", category: "Lowo Emotes", isSlash: false, fileLocation: "lowo/emotes.ts" },
  { name: "lowo teehee",      description: "Teehee emote", category: "Lowo Emotes", isSlash: false, fileLocation: "lowo/emotes.ts" },
  { name: "lowo deredere",    description: "Deredere emote", category: "Lowo Emotes", isSlash: false, fileLocation: "lowo/emotes.ts" },
  { name: "lowo thonking",    description: "Thonking emote", category: "Lowo Emotes", isSlash: false, fileLocation: "lowo/emotes.ts" },
  { name: "lowo scoff",       description: "Scoff emote", category: "Lowo Emotes", isSlash: false, fileLocation: "lowo/emotes.ts" },
  { name: "lowo happy",       description: "Happy emote", category: "Lowo Emotes", isSlash: false, fileLocation: "lowo/emotes.ts" },
  { name: "lowo grin",        description: "Grin emote", category: "Lowo Emotes", isSlash: false, fileLocation: "lowo/emotes.ts" },

  // ── Lowo: Actions ────────────────────────────────────────────────────────────
  { name: "lowo lick",        description: "Lick a target user", category: "Lowo Actions", isSlash: false, fileLocation: "lowo/actions.ts" },
  { name: "lowo nom",         description: "Nom a target user", category: "Lowo Actions", isSlash: false, fileLocation: "lowo/actions.ts" },
  { name: "lowo stare",       description: "Stare at a target user", category: "Lowo Actions", isSlash: false, fileLocation: "lowo/actions.ts" },
  { name: "lowo highfive",    description: "High-five a target user", category: "Lowo Actions", isSlash: false, fileLocation: "lowo/actions.ts" },
  { name: "lowo bite",        description: "Bite a target user", category: "Lowo Actions", isSlash: false, fileLocation: "lowo/actions.ts" },
  { name: "lowo greet",       description: "Greet a target user", category: "Lowo Actions", isSlash: false, fileLocation: "lowo/actions.ts" },
  { name: "lowo punch",       description: "Punch a target user", category: "Lowo Actions", isSlash: false, fileLocation: "lowo/actions.ts" },
  { name: "lowo handholding", description: "Hold hands with a target user", category: "Lowo Actions", isSlash: false, fileLocation: "lowo/actions.ts" },
  { name: "lowo tickle",      description: "Tickle a target user", category: "Lowo Actions", isSlash: false, fileLocation: "lowo/actions.ts" },
  { name: "lowo kill",        description: "Dramatically kill a target user (censor required off)", category: "Lowo Actions", isSlash: false, fileLocation: "lowo/actions.ts" },
  { name: "lowo hold",        description: "Hold a target user", category: "Lowo Actions", isSlash: false, fileLocation: "lowo/actions.ts" },
  { name: "lowo pats",        description: "Give pats to a target user", category: "Lowo Actions", isSlash: false, fileLocation: "lowo/actions.ts" },
  { name: "lowo wave",        description: "Wave at a target user", category: "Lowo Actions", isSlash: false, fileLocation: "lowo/actions.ts" },
  { name: "lowo boop",        description: "Boop a target user", category: "Lowo Actions", isSlash: false, fileLocation: "lowo/actions.ts" },
  { name: "lowo snuggle",     description: "Snuggle with a target user", category: "Lowo Actions", isSlash: false, fileLocation: "lowo/actions.ts" },
  { name: "lowo bully",       description: "Bully a target user (censor required off)", category: "Lowo Actions", isSlash: false, fileLocation: "lowo/actions.ts" },
  { name: "lowo fuck",        description: "…you know (censor required off) (alias: frick, fk)", category: "Lowo Actions", isSlash: false, fileLocation: "lowo/actions.ts" },

  // ── Lowo: Memes ──────────────────────────────────────────────────────────────
  { name: "lowo drake",            description: "Drake meme generator", category: "Lowo Memes", isSlash: false, fileLocation: "lowo/memes.ts" },
  { name: "lowo spongebobchicken", description: "Spongebob chicken meme", category: "Lowo Memes", isSlash: false, fileLocation: "lowo/memes.ts" },
  { name: "lowo slapcar",          description: "Slap car meme", category: "Lowo Memes", isSlash: false, fileLocation: "lowo/memes.ts" },
  { name: "lowo isthisa",          description: "Is this a… meme", category: "Lowo Memes", isSlash: false, fileLocation: "lowo/memes.ts" },
  { name: "lowo distractedbf",     description: "Distracted boyfriend meme", category: "Lowo Memes", isSlash: false, fileLocation: "lowo/memes.ts" },
  { name: "lowo communismcat",     description: "Communism cat meme", category: "Lowo Memes", isSlash: false, fileLocation: "lowo/memes.ts" },
  { name: "lowo eject",            description: "Among Us eject meme", category: "Lowo Memes", isSlash: false, fileLocation: "lowo/memes.ts" },
  { name: "lowo emergencymeeting", description: "Among Us emergency meeting meme", category: "Lowo Memes", isSlash: false, fileLocation: "lowo/memes.ts" },
  { name: "lowo headpat",          description: "Headpat meme", category: "Lowo Memes", isSlash: false, fileLocation: "lowo/memes.ts" },
  { name: "lowo tradeoffer",       description: "Trade offer meme", category: "Lowo Memes", isSlash: false, fileLocation: "lowo/memes.ts" },
  { name: "lowo waddle",           description: "Waddle meme", category: "Lowo Memes", isSlash: false, fileLocation: "lowo/memes.ts" },

  // ── Lowo: Minigames ──────────────────────────────────────────────────────────
  { name: "lowo piku",        description: "Interact with Piku — your mini-pet garden", category: "Lowo Minigames", isSlash: false, fileLocation: "lowo/minigames.ts" },
  { name: "lowo pikureset",   description: "Reset your Piku garden", category: "Lowo Minigames", isSlash: false, fileLocation: "lowo/minigames.ts" },
  { name: "lowo pet",         description: "Pet your companion", category: "Lowo Minigames", isSlash: false, fileLocation: "lowo/minigames.ts" },
  { name: "lowo feed",        description: "Feed your companion", category: "Lowo Minigames", isSlash: false, fileLocation: "lowo/minigames.ts" },

  // ── Lowo: Utility ────────────────────────────────────────────────────────────
  { name: "lowo 8ball",       description: "Ask the 8-ball a question (alias: 8b)", category: "Lowo Utility", isSlash: false, fileLocation: "lowo/utility.ts" },
  { name: "lowo roll",        description: "Roll a random number", category: "Lowo Utility", isSlash: false, fileLocation: "lowo/utility.ts" },
  { name: "lowo choose",      description: "Choose from a list (a, b, c, …)", category: "Lowo Utility", isSlash: false, fileLocation: "lowo/utility.ts" },
  { name: "lowo define",      description: "Look up a word definition", category: "Lowo Utility", isSlash: false, fileLocation: "lowo/utility.ts" },
  { name: "lowo gif",         description: "Search for a GIF", category: "Lowo Utility", isSlash: false, fileLocation: "lowo/utility.ts" },
  { name: "lowo pic",         description: "Get a random image", category: "Lowo Utility", isSlash: false, fileLocation: "lowo/utility.ts" },
  { name: "lowo translate",   description: "Translate text", category: "Lowo Utility", isSlash: false, fileLocation: "lowo/utility.ts" },
  { name: "lowo bell",        description: "Ring the bell timer", category: "Lowo Utility", isSlash: false, fileLocation: "lowo/utility.ts" },
  { name: "lowo math",        description: "Solve a math expression", category: "Lowo Utility", isSlash: false, fileLocation: "lowo/utility.ts" },
  { name: "lowo color",       description: "Show info about a color hex", category: "Lowo Utility", isSlash: false, fileLocation: "lowo/utility.ts" },
  { name: "lowo ping",        description: "Check bot latency", category: "Lowo Utility", isSlash: false, fileLocation: "lowo/utility.ts" },
  { name: "lowo stats",       description: "View bot global stats", category: "Lowo Utility", isSlash: false, fileLocation: "lowo/utility.ts" },
  { name: "lowo censor",      description: "Toggle lowo censor mode on/off (admin)", category: "Lowo Utility", isSlash: false, fileLocation: "lowo/router.ts" },
  { name: "lowo socials",     description: "Toggle social/emote/action commands on/off (admin)", category: "Lowo Utility", isSlash: false, fileLocation: "lowo/router.ts" },
  { name: "lowo enable",      description: "Enable Lowo in this channel", category: "Lowo Utility", isSlash: false, fileLocation: "lowo/router.ts" },
  { name: "lowo disable",     description: "Disable Lowo in this channel", category: "Lowo Utility", isSlash: false, fileLocation: "lowo/router.ts" },
  { name: "lowo channel",     description: "List Lowo-enabled channels on this server", category: "Lowo Utility", isSlash: false, fileLocation: "lowo/router.ts" },

  // ── Mewo: Fun ────────────────────────────────────────────────────────────────
  { name: "mewo 8ball",        description: "Ask the magic 8-ball a question", category: "Mewo Fun", isSlash: false, fileLocation: "mewo/modules/fun.ts" },
  { name: "mewo coinflip",     description: "Flip a coin — heads or tails", category: "Mewo Fun", isSlash: false, fileLocation: "mewo/modules/fun.ts" },
  { name: "mewo rate",         description: "Rate something out of 10", category: "Mewo Fun", isSlash: false, fileLocation: "mewo/modules/fun.ts" },
  { name: "mewo hotcalc",      description: "Calculate how hot someone is", category: "Mewo Fun", isSlash: false, fileLocation: "mewo/modules/fun.ts" },
  { name: "mewo howgay",       description: "How gay are you?", category: "Mewo Fun", isSlash: false, fileLocation: "mewo/modules/fun.ts" },
  { name: "mewo howautistic",  description: "How autistic are you?", category: "Mewo Fun", isSlash: false, fileLocation: "mewo/modules/fun.ts" },
  { name: "mewo ppsize",       description: "Check pp size", category: "Mewo Fun", isSlash: false, fileLocation: "mewo/modules/fun.ts" },
  { name: "mewo ship",         description: "Ship two users together", category: "Mewo Fun", isSlash: false, fileLocation: "mewo/modules/fun.ts" },
  { name: "mewo say",          description: "Make the bot say something", category: "Mewo Fun", isSlash: false, fileLocation: "mewo/modules/fun.ts" },
  { name: "mewo rizz",         description: "Get a rizz line", category: "Mewo Fun", isSlash: false, fileLocation: "mewo/modules/fun.ts" },
  { name: "mewo roast",        description: "Roast a user", category: "Mewo Fun", isSlash: false, fileLocation: "mewo/modules/fun.ts" },
  { name: "mewo math",         description: "Solve a math expression", category: "Mewo Fun", isSlash: false, fileLocation: "mewo/modules/fun.ts" },
  { name: "mewo asciify",      description: "Convert text or image to ASCII art", category: "Mewo Fun", isSlash: false, fileLocation: "mewo/modules/fun.ts" },
  { name: "mewo urban",        description: "Look up a word on Urban Dictionary", category: "Mewo Fun", isSlash: false, fileLocation: "mewo/modules/fun.ts" },
  { name: "mewo lyrics",       description: "Get song lyrics", category: "Mewo Fun", isSlash: false, fileLocation: "mewo/modules/fun.ts" },
  { name: "mewo nitro",        description: "Generate a (fake) Nitro gift link for laughs", category: "Mewo Fun", isSlash: false, fileLocation: "mewo/modules/fun.ts" },
  { name: "mewo badtranslate", description: "Badly translate text through random languages", category: "Mewo Fun", isSlash: false, fileLocation: "mewo/modules/fun.ts" },
  { name: "mewo emojimix",     description: "Mix two emojis together (Google emoji kitchen)", category: "Mewo Fun", isSlash: false, fileLocation: "mewo/modules/fun.ts" },

  // ── Mewo: AI ─────────────────────────────────────────────────────────────────
  { name: "mewo chatgpt",      description: "Chat with GPT-4 (alias: mewo ai chatgpt)", category: "Mewo AI", isSlash: false, fileLocation: "mewo/modules/ai.ts" },
  { name: "mewo llama",        description: "Chat with LLaMA AI (alias: mewo ai llama)", category: "Mewo AI", isSlash: false, fileLocation: "mewo/modules/ai.ts" },
  { name: "mewo deepseek",     description: "Chat with DeepSeek (alias: mewo ai deepseek)", category: "Mewo AI", isSlash: false, fileLocation: "mewo/modules/ai.ts" },
  { name: "mewo perplexity",   description: "Search with Perplexity AI (alias: mewo ai perplexity)", category: "Mewo AI", isSlash: false, fileLocation: "mewo/modules/ai.ts" },
  { name: "mewo imagine",      description: "Generate an AI image with Grok Imagine (alias: generate)", category: "Mewo AI", isSlash: false, fileLocation: "mewo/modules/ai.ts" },
  { name: "mewo ocr",          description: "Extract text from an image (alias: mewo ai ocr)", category: "Mewo AI", isSlash: false, fileLocation: "mewo/modules/ai.ts" },
  { name: "mewo screenshot",   description: "Screenshot a URL (alias: mewo ai screenshot)", category: "Mewo AI", isSlash: false, fileLocation: "mewo/modules/ai.ts" },
  { name: "mewo download",     description: "Download media from a URL", category: "Mewo AI", isSlash: false, fileLocation: "mewo/modules/ai.ts" },
  { name: "mewo geolocate",    description: "Deep AI geolocate an image (alias: mewo ai geolocate)", category: "Mewo AI", isSlash: false, fileLocation: "mewo/modules/ai.ts" },
  { name: "mewo tts",          description: "Text-to-speech — openai or elevenlabs (mewo tts openai/elevenlabs)", category: "Mewo AI", isSlash: false, fileLocation: "mewo/modules/ai.ts" },
  { name: "mewo ai usage",     description: "Check your AI usage this month", category: "Mewo AI", isSlash: false, fileLocation: "mewo/modules/ai.ts" },

  // ── Mewo: Utility ────────────────────────────────────────────────────────────
  { name: "mewo ping",         description: "Check bot latency", category: "Mewo Utility", isSlash: false, fileLocation: "mewo/modules/utility.ts" },
  { name: "mewo avatar",       description: "Get a user's avatar", category: "Mewo Utility", isSlash: false, fileLocation: "mewo/modules/utility.ts" },
  { name: "mewo banner",       description: "Get a user's profile banner", category: "Mewo Utility", isSlash: false, fileLocation: "mewo/modules/utility.ts" },
  { name: "mewo me",           description: "View your own Discord profile info", category: "Mewo Utility", isSlash: false, fileLocation: "mewo/modules/utility.ts" },
  { name: "mewo about",        description: "Info about mewo bot (alias: settings)", category: "Mewo Utility", isSlash: false, fileLocation: "mewo/modules/utility.ts" },
  { name: "mewo invite",       description: "Get the bot's invite link", category: "Mewo Utility", isSlash: false, fileLocation: "mewo/modules/utility.ts" },
  { name: "mewo translate",    description: "Translate text to another language", category: "Mewo Utility", isSlash: false, fileLocation: "mewo/modules/utility.ts" },
  { name: "mewo timezone",     description: "Set or view your timezone (mewo timezone set/view)", category: "Mewo Utility", isSlash: false, fileLocation: "mewo/modules/utility.ts" },
  { name: "mewo qr",           description: "Generate or scan a QR code (mewo qr generate/scan)", category: "Mewo Utility", isSlash: false, fileLocation: "mewo/modules/utility.ts" },
  { name: "mewo ip",           description: "Look up or ping an IP address (mewo ip lookup/ping)", category: "Mewo Utility", isSlash: false, fileLocation: "mewo/modules/utility.ts" },
  { name: "mewo domain",       description: "Look up a domain (mewo domain lookup)", category: "Mewo Utility", isSlash: false, fileLocation: "mewo/modules/utility.ts" },
  { name: "mewo base64",       description: "Encode or decode Base64 (mewo base64 encode/decode)", category: "Mewo Utility", isSlash: false, fileLocation: "mewo/modules/utility.ts" },
  { name: "mewo convert",      description: "Convert between Discord user ID and username", category: "Mewo Utility", isSlash: false, fileLocation: "mewo/modules/utility.ts" },
  { name: "mewo discord",      description: "Look up a Discord user by ID (mewo discord user)", category: "Mewo Utility", isSlash: false, fileLocation: "mewo/modules/utility.ts" },
  { name: "mewo customize",    description: "Customize your mewo profile (color, wallet)", category: "Mewo Utility", isSlash: false, fileLocation: "mewo/modules/utility.ts" },

  // ── Mewo: Games ──────────────────────────────────────────────────────────────
  { name: "mewo rps",          description: "Play rock-paper-scissors (mewo games rps)", category: "Mewo Games", isSlash: false, fileLocation: "mewo/modules/games.ts" },
  { name: "mewo tictactoe",    description: "Play tic-tac-toe (mewo games tictactoe)", category: "Mewo Games", isSlash: false, fileLocation: "mewo/modules/games.ts" },
  { name: "mewo blackjack",    description: "Play blackjack (mewo games blackjack)", category: "Mewo Games", isSlash: false, fileLocation: "mewo/modules/games.ts" },
  { name: "mewo cookie",       description: "Click the cookie clicker game (mewo games cookie)", category: "Mewo Games", isSlash: false, fileLocation: "mewo/modules/games.ts" },
  { name: "mewo snake",        description: "Play Snake in Discord (mewo games snake)", category: "Mewo Games", isSlash: false, fileLocation: "mewo/modules/games.ts" },

  // ── Mewo: Roleplay ───────────────────────────────────────────────────────────
  { name: "mewo hug",          description: "Hug someone (shortcut for mewo roleplay hug)", category: "Mewo Roleplay", isSlash: false, fileLocation: "mewo/modules/roleplay.ts" },
  { name: "mewo kiss",         description: "Kiss someone (shortcut for mewo roleplay kiss)", category: "Mewo Roleplay", isSlash: false, fileLocation: "mewo/modules/roleplay.ts" },
  { name: "mewo pat",          description: "Pat someone (shortcut for mewo roleplay pat)", category: "Mewo Roleplay", isSlash: false, fileLocation: "mewo/modules/roleplay.ts" },
  { name: "mewo slap",         description: "Slap someone (shortcut for mewo roleplay slap)", category: "Mewo Roleplay", isSlash: false, fileLocation: "mewo/modules/roleplay.ts" },
  { name: "mewo bite",         description: "Bite someone (shortcut for mewo roleplay bite)", category: "Mewo Roleplay", isSlash: false, fileLocation: "mewo/modules/roleplay.ts" },
  { name: "mewo cuddle",       description: "Cuddle someone (shortcut for mewo roleplay cuddle)", category: "Mewo Roleplay", isSlash: false, fileLocation: "mewo/modules/roleplay.ts" },
  { name: "mewo poke",         description: "Poke someone (shortcut for mewo roleplay poke)", category: "Mewo Roleplay", isSlash: false, fileLocation: "mewo/modules/roleplay.ts" },
  { name: "mewo highfive",     description: "High-five someone (shortcut for mewo roleplay highfive)", category: "Mewo Roleplay", isSlash: false, fileLocation: "mewo/modules/roleplay.ts" },
  { name: "mewo punch",        description: "Punch someone (shortcut for mewo roleplay punch)", category: "Mewo Roleplay", isSlash: false, fileLocation: "mewo/modules/roleplay.ts" },
  { name: "mewo cry",          description: "Cry (shortcut for mewo roleplay cry)", category: "Mewo Roleplay", isSlash: false, fileLocation: "mewo/modules/roleplay.ts" },
  { name: "mewo shoot",        description: "Shoot someone (shortcut for mewo roleplay shoot)", category: "Mewo Roleplay", isSlash: false, fileLocation: "mewo/modules/roleplay.ts" },
  { name: "mewo kick",         description: "Kick someone (shortcut for mewo roleplay kick)", category: "Mewo Roleplay", isSlash: false, fileLocation: "mewo/modules/roleplay.ts" },
  { name: "mewo baka",         description: "Call someone baka", category: "Mewo Roleplay", isSlash: false, fileLocation: "mewo/modules/roleplay.ts" },
  { name: "mewo feed",         description: "Feed someone", category: "Mewo Roleplay", isSlash: false, fileLocation: "mewo/modules/roleplay.ts" },
  { name: "mewo handhold",     description: "Hold hands with someone", category: "Mewo Roleplay", isSlash: false, fileLocation: "mewo/modules/roleplay.ts" },
  { name: "mewo handshake",    description: "Shake hands with someone", category: "Mewo Roleplay", isSlash: false, fileLocation: "mewo/modules/roleplay.ts" },
  { name: "mewo peck",         description: "Peck someone on the cheek", category: "Mewo Roleplay", isSlash: false, fileLocation: "mewo/modules/roleplay.ts" },

  // ── Mewo: Search ─────────────────────────────────────────────────────────────
  { name: "mewo youtube",      description: "Search YouTube for a video", category: "Mewo Search", isSlash: false, fileLocation: "mewo/modules/search.ts" },
  { name: "mewo github",       description: "Search GitHub for a repo or user", category: "Mewo Search", isSlash: false, fileLocation: "mewo/modules/search.ts" },
  { name: "mewo steam",        description: "Search Steam for a game", category: "Mewo Search", isSlash: false, fileLocation: "mewo/modules/search.ts" },
  { name: "mewo soundcloud",   description: "Search SoundCloud for a track", category: "Mewo Search", isSlash: false, fileLocation: "mewo/modules/search.ts" },
  { name: "mewo minecraft",    description: "Look up Minecraft server, user, skin, or randomserver", category: "Mewo Search", isSlash: false, fileLocation: "mewo/modules/search.ts" },

  // ── Mewo: Social / Scan ──────────────────────────────────────────────────────
  { name: "mewo shazam",       description: "Identify a song from audio", category: "Mewo Social", isSlash: false, fileLocation: "mewo/modules/social.ts" },
  { name: "mewo bypass",       description: "Bypass a paywall URL", category: "Mewo Social", isSlash: false, fileLocation: "mewo/modules/social.ts" },
  { name: "mewo socialscan",   description: "Scan a username across social platforms", category: "Mewo Social", isSlash: false, fileLocation: "mewo/modules/social.ts" },
  { name: "mewo sherlock",     description: "Sherlock OSINT username lookup", category: "Mewo Social", isSlash: false, fileLocation: "mewo/modules/social.ts" },

  // ── Mewo: Fake Media ─────────────────────────────────────────────────────────
  { name: "mewo fake message", description: "Generate a fake Discord message image", category: "Mewo Fake", isSlash: false, fileLocation: "mewo/modules/fake.ts" },
  { name: "mewo fake reply",   description: "Generate a fake Discord reply image", category: "Mewo Fake", isSlash: false, fileLocation: "mewo/modules/fake.ts" },
  { name: "mewo fake quote",   description: "Generate a fake Discord quote card", category: "Mewo Fake", isSlash: false, fileLocation: "mewo/modules/fake.ts" },

  // ── Mewo: Tags ───────────────────────────────────────────────────────────────
  { name: "mewo tags create",  description: "Create a custom tag (mewo tags create <name> <content>)", category: "Mewo Tags", isSlash: false, fileLocation: "mewo/modules/tags.ts" },
  { name: "mewo tags delete",  description: "Delete one of your tags", category: "Mewo Tags", isSlash: false, fileLocation: "mewo/modules/tags.ts" },
  { name: "mewo tags edit",    description: "Edit an existing tag", category: "Mewo Tags", isSlash: false, fileLocation: "mewo/modules/tags.ts" },
  { name: "mewo tags list",    description: "List all your tags", category: "Mewo Tags", isSlash: false, fileLocation: "mewo/modules/tags.ts" },
  { name: "mewo tags send",    description: "Send a tag into the channel", category: "Mewo Tags", isSlash: false, fileLocation: "mewo/modules/tags.ts" },

  // ── Mewo: Wallet ─────────────────────────────────────────────────────────────
  { name: "mewo wallet",       description: "View your mewo wallet balance (alias: mewo wallet balance)", category: "Mewo Wallet", isSlash: false, fileLocation: "mewo/modules/wallet.ts" },
  { name: "mewo wallet daily", description: "Claim your daily mewo coins (cooldown 24h)", category: "Mewo Wallet", isSlash: false, fileLocation: "mewo/modules/wallet.ts" },
  { name: "mewo wallet pay",   description: "Pay coins to another user", category: "Mewo Wallet", isSlash: false, fileLocation: "mewo/modules/wallet.ts" },
  { name: "mewo wallet gamble",description: "Gamble your mewo coins (alias: mewo wallet bet)", category: "Mewo Wallet", isSlash: false, fileLocation: "mewo/modules/wallet.ts" },
  { name: "mewo wallet lb",    description: "View the mewo wallet leaderboard (alias: mewo wallet leaderboard)", category: "Mewo Wallet", isSlash: false, fileLocation: "mewo/modules/wallet.ts" },

  // ── Mewo: Help ───────────────────────────────────────────────────────────────
  { name: "mewo help",         description: "Show the mewo help panel (mewo help <module> for module detail)", category: "Mewo", isSlash: false, fileLocation: "mewo/help.ts" },
  { name: "mewo enable",       description: "Enable mewo in this channel (admin)", category: "Mewo", isSlash: false, fileLocation: "mewo/router.ts" },
  { name: "mewo disable",      description: "Disable mewo in this channel (admin)", category: "Mewo", isSlash: false, fileLocation: "mewo/router.ts" },
];

type CommandOverrideData = {
  enabled?: boolean;
  description?: string;
  cooldown?: number | null;
  hidden?: boolean;
  usageCount?: number;
};

async function getOverrides(): Promise<Map<string, CommandOverrideData>> {
  const rows = await db
    .select()
    .from(botKvTable)
    .where(sql`${botKvTable.key} LIKE 'dashboard:cmd:override:%'`);
  const map = new Map<string, CommandOverrideData>();
  for (const row of rows) {
    const name = row.key.replace("dashboard:cmd:override:", "");
    map.set(name, row.value as CommandOverrideData);
  }
  return map;
}

function mergeCommand(base: typeof COMMAND_REGISTRY[0], override: CommandOverrideData | undefined) {
  return {
    name: base.name,
    description: base.description,
    category: base.category,
    type: base.isSlash ? "slash" : "prefix",
    isSlash: base.isSlash,
    enabled: override?.enabled !== false,
    overrideName: null,
    overrideDescription: override?.description ?? null,
    cooldown: override?.cooldown ?? null,
    hidden: override?.hidden ?? false,
    fileLocation: base.fileLocation,
    usageCount: override?.usageCount ?? 0,
  };
}

router.get("/commands", async (req, res): Promise<void> => {
  try {
    const overrides = await getOverrides();
    const commands = COMMAND_REGISTRY.map((cmd) => mergeCommand(cmd, overrides.get(cmd.name)));
    res.json(commands);
  } catch (err) {
    req.log.error({ err }, "Failed to list commands");
    res.status(500).json({ error: "Failed to list commands" });
  }
});

router.get("/commands/:name", async (req, res): Promise<void> => {
  const rawName = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
  const name = decodeURIComponent(rawName);
  const base = COMMAND_REGISTRY.find((c) => c.name === name);
  if (!base) {
    res.status(404).json({ error: "Command not found" });
    return;
  }
  const overrideRow = await db
    .select()
    .from(botKvTable)
    .where(eq(botKvTable.key, `dashboard:cmd:override:${name}`))
    .limit(1);
  const override = overrideRow[0]?.value as CommandOverrideData | undefined;
  res.json(mergeCommand(base, override));
});

router.patch("/commands/:name", async (req, res): Promise<void> => {
  const rawName = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
  const name = decodeURIComponent(rawName);
  const base = COMMAND_REGISTRY.find((c) => c.name === name);
  if (!base) {
    res.status(404).json({ error: "Command not found" });
    return;
  }

  const { description, cooldown, hidden } = req.body as {
    description?: string;
    cooldown?: number | null;
    hidden?: boolean;
  };

  const key = `dashboard:cmd:override:${name}`;
  const existingRow = await db.select().from(botKvTable).where(eq(botKvTable.key, key)).limit(1);
  const existing = (existingRow[0]?.value ?? {}) as CommandOverrideData;

  const before = { ...existing };
  const updated: CommandOverrideData = {
    ...existing,
    ...(description !== undefined && { description }),
    ...(cooldown !== undefined && { cooldown }),
    ...(hidden !== undefined && { hidden }),
  };

  await db
    .insert(botKvTable)
    .values({ key, value: updated })
    .onConflictDoUpdate({ target: botKvTable.key, set: { value: updated } });

  await writeAuditLog({
    action: `command.updated:${name}`,
    userId: req.session.userId!,
    username: req.session.username!,
    before,
    after: updated,
  });

  res.json(mergeCommand(base, updated));
});

router.post("/commands/:name/toggle", async (req, res): Promise<void> => {
  const rawName = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
  const name = decodeURIComponent(rawName);
  const { enabled } = req.body as { enabled: boolean };
  const key = `dashboard:cmd:override:${name}`;
  const existingRow = await db.select().from(botKvTable).where(eq(botKvTable.key, key)).limit(1);
  const existing = (existingRow[0]?.value ?? {}) as CommandOverrideData;
  const updated = { ...existing, enabled };

  await db
    .insert(botKvTable)
    .values({ key, value: updated })
    .onConflictDoUpdate({ target: botKvTable.key, set: { value: updated } });

  await writeAuditLog({
    action: `command.${enabled ? "enabled" : "disabled"}:${name}`,
    userId: req.session.userId!,
    username: req.session.username!,
    before: { enabled: !enabled },
    after: { enabled },
  });

  res.json({ ok: true, message: `Command ${enabled ? "enabled" : "disabled"}` });
});

router.get("/commands/:name/history", async (req, res): Promise<void> => {
  const rawName = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
  const name = decodeURIComponent(rawName);
  const { desc } = await import("drizzle-orm");
  const { dashboardAuditLogsTable } = await import("@workspace/db");

  const logs = await db
    .select()
    .from(dashboardAuditLogsTable)
    .where(sql`${dashboardAuditLogsTable.action} LIKE ${`command.%:${name}`}`)
    .orderBy(desc(dashboardAuditLogsTable.createdAt))
    .limit(50);

  res.json(
    logs.map((l) => ({
      id: l.id,
      changedBy: l.userId,
      changedByUsername: l.username,
      before: l.before as Record<string, unknown>,
      after: l.after as Record<string, unknown>,
      timestamp: l.createdAt.toISOString(),
    })),
  );
});

export default router;
