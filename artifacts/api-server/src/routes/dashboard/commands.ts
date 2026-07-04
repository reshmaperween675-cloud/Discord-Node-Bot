import { Router, type IRouter } from "express";
import { db, botKvTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth } from "../../middlewares/requireAuth.js";
import { writeAuditLog } from "../../lib/audit.js";

const router: IRouter = Router();
router.use(requireAuth);

// Static registry of all known commands
const COMMAND_REGISTRY = [
  // Slash commands
  { name: "rank", description: "View your XP rank card", category: "Leveling", type: "slash", isSlash: true, fileLocation: "leveling/commands.ts" },
  { name: "leaderboard", description: "View the XP leaderboard", category: "Leveling", type: "slash", isSlash: true, fileLocation: "leveling/commands.ts" },
  { name: "addxp", description: "Add XP to a user", category: "Leveling", type: "slash", isSlash: true, fileLocation: "leveling/commands.ts" },
  { name: "removexp", description: "Remove XP from a user", category: "Leveling", type: "slash", isSlash: true, fileLocation: "leveling/commands.ts" },
  { name: "setxp", description: "Set a user's XP", category: "Leveling", type: "slash", isSlash: true, fileLocation: "leveling/commands.ts" },
  { name: "resetxp", description: "Reset a user's XP", category: "Leveling", type: "slash", isSlash: true, fileLocation: "leveling/commands.ts" },
  { name: "setlevelrole", description: "Set a role reward for a level", category: "Leveling", type: "slash", isSlash: true, fileLocation: "leveling/commands.ts" },
  { name: "xpconfig", description: "View XP system configuration", category: "Leveling", type: "slash", isSlash: true, fileLocation: "leveling/commands.ts" },
  { name: "levelroles", description: "View all level roles", category: "Leveling", type: "slash", isSlash: true, fileLocation: "leveling/commands.ts" },
  { name: "dashboard", description: "View the XP dashboard", category: "Leveling", type: "slash", isSlash: true, fileLocation: "leveling/dashboard.ts" },
  { name: "universalleaderboard", description: "View cross-server leaderboard", category: "Leveling", type: "slash", isSlash: true, fileLocation: "leveling/universalLeaderboard.ts" },
  { name: "announce", description: "Make an announcement", category: "Utility", type: "slash", isSlash: true, fileLocation: "utility/index.ts" },
  { name: "warn", description: "Warn a member", category: "Utility", type: "slash", isSlash: true, fileLocation: "utility/index.ts" },
  { name: "clearwarns", description: "Clear a member's warnings", category: "Utility", type: "slash", isSlash: true, fileLocation: "utility/index.ts" },
  { name: "promote", description: "Promote a member", category: "Utility", type: "slash", isSlash: true, fileLocation: "utility/index.ts" },
  { name: "demote", description: "Demote a member", category: "Utility", type: "slash", isSlash: true, fileLocation: "utility/index.ts" },
  { name: "attendance", description: "Mark attendance", category: "Utility", type: "slash", isSlash: true, fileLocation: "utility/index.ts" },
  { name: "poll", description: "Create a poll", category: "Utility", type: "slash", isSlash: true, fileLocation: "utility/index.ts" },
  { name: "mvp", description: "Award MVP", category: "Utility", type: "slash", isSlash: true, fileLocation: "utility/index.ts" },
  { name: "suggestion", description: "Submit a suggestion", category: "Utility", type: "slash", isSlash: true, fileLocation: "utility/index.ts" },
  { name: "backupdb", description: "Backup the database", category: "Utility", type: "slash", isSlash: true, fileLocation: "utility/backup.ts" },
  { name: "purge", description: "Purge messages", category: "Moderation", type: "slash", isSlash: true, fileLocation: "moderation/purge.ts" },
  { name: "censor", description: "Enable word censoring", category: "Moderation", type: "slash", isSlash: true, fileLocation: "moderation/commands.ts" },
  { name: "stopcensor", description: "Disable word censoring", category: "Moderation", type: "slash", isSlash: true, fileLocation: "moderation/commands.ts" },
  { name: "kick", description: "Kick a member", category: "Moderation", type: "slash", isSlash: true, fileLocation: "moderation/modActions.ts" },
  { name: "ban", description: "Ban a member", category: "Moderation", type: "slash", isSlash: true, fileLocation: "moderation/modActions.ts" },
  { name: "tempban", description: "Temporarily ban a member", category: "Moderation", type: "slash", isSlash: true, fileLocation: "moderation/modActions.ts" },
  { name: "mute", description: "Mute a member", category: "Moderation", type: "slash", isSlash: true, fileLocation: "moderation/modActions.ts" },
  { name: "unmute", description: "Unmute a member", category: "Moderation", type: "slash", isSlash: true, fileLocation: "moderation/modActions.ts" },
  { name: "setuprules", description: "Set up the server rules panel", category: "Server", type: "slash", isSlash: true, fileLocation: "rules/index.ts" },
  { name: "tournament", description: "Manage tournaments", category: "Server", type: "slash", isSlash: true, fileLocation: "tournament/index.ts" },
  { name: "closetournament", description: "Close a tournament", category: "Server", type: "slash", isSlash: true, fileLocation: "tournament/index.ts" },
  { name: "training", description: "Manage training sessions", category: "Server", type: "slash", isSlash: true, fileLocation: "training/index.ts" },
  { name: "startraid", description: "Start a raid", category: "Raids", type: "slash", isSlash: true, fileLocation: "raids/index.ts" },
  { name: "endraid", description: "End a raid", category: "Raids", type: "slash", isSlash: true, fileLocation: "raids/index.ts" },
  { name: "raidannounce", description: "Announce a raid", category: "Raids", type: "slash", isSlash: true, fileLocation: "raids/announce.ts" },
  { name: "help", description: "View bot help", category: "General", type: "slash", isSlash: true, fileLocation: "commands/help.ts" },
  { name: "lowoenable", description: "Enable lowo commands", category: "Lowo", type: "slash", isSlash: true, fileLocation: "lowo/slashCommands.ts" },
  { name: "lowodisable", description: "Disable lowo commands", category: "Lowo", type: "slash", isSlash: true, fileLocation: "lowo/slashCommands.ts" },
  { name: "lowoadmin", description: "Lowo admin panel", category: "Lowo", type: "slash", isSlash: true, fileLocation: "lowo/slashCommands.ts" },
  // Prefix commands (lowo)
  { name: "lowo hunt", description: "Hunt for animals", category: "Lowo", type: "prefix", isSlash: false, fileLocation: "lowo/hunt.ts" },
  { name: "lowo battle", description: "Battle other users", category: "Lowo", type: "prefix", isSlash: false, fileLocation: "lowo/battle.ts" },
  { name: "lowo slots", description: "Play slots", category: "Lowo", type: "prefix", isSlash: false, fileLocation: "lowo/gambling.ts" },
  { name: "lowo coinflip", description: "Flip a coin", category: "Lowo", type: "prefix", isSlash: false, fileLocation: "lowo/gambling.ts" },
  { name: "lowo blackjack", description: "Play blackjack", category: "Lowo", type: "prefix", isSlash: false, fileLocation: "lowo/gambling.ts" },
  { name: "lowo daily", description: "Claim daily cowoncy", category: "Lowo", type: "prefix", isSlash: false, fileLocation: "lowo/economy.ts" },
  { name: "lowo shop", description: "View the lowo shop", category: "Lowo", type: "prefix", isSlash: false, fileLocation: "lowo/shop.ts" },
  { name: "lowo profile", description: "View your lowo profile", category: "Lowo", type: "prefix", isSlash: false, fileLocation: "lowo/profile.ts" },
  { name: "lowo zoo", description: "View your zoo", category: "Lowo", type: "prefix", isSlash: false, fileLocation: "lowo/hunt.ts" },
  { name: "lowo market", description: "Browse the market", category: "Lowo", type: "prefix", isSlash: false, fileLocation: "lowo/market.ts" },
  { name: "lowo forge", description: "Forge items", category: "Lowo", type: "prefix", isSlash: false, fileLocation: "lowo/forge.ts" },
  { name: "lowo prestige", description: "Prestige your account", category: "Lowo", type: "prefix", isSlash: false, fileLocation: "lowo/prestige.ts" },
  { name: "lowo aquarium", description: "View your aquarium", category: "Lowo", type: "prefix", isSlash: false, fileLocation: "lowo/aquarium.ts" },
  { name: "lowo mine", description: "Mine for minerals", category: "Lowo", type: "prefix", isSlash: false, fileLocation: "lowo/mine.ts" },
  // Mewo commands
  { name: "mewo help", description: "Mewo help panel", category: "Mewo", type: "prefix", isSlash: false, fileLocation: "mewo/help.ts" },
  { name: "mewo ai", description: "AI assistant commands", category: "Mewo", type: "prefix", isSlash: false, fileLocation: "mewo/modules/ai.ts" },
  { name: "mewo fun", description: "Fun commands", category: "Mewo", type: "prefix", isSlash: false, fileLocation: "mewo/modules/fun.ts" },
  { name: "mewo utility", description: "Utility commands", category: "Mewo", type: "prefix", isSlash: false, fileLocation: "mewo/modules/utility.ts" },
  { name: "mewo games", description: "Mini-game commands", category: "Mewo", type: "prefix", isSlash: false, fileLocation: "mewo/modules/games.ts" },
  { name: "mewo search", description: "Search commands", category: "Mewo", type: "prefix", isSlash: false, fileLocation: "mewo/modules/search.ts" },
  { name: "mewo roleplay", description: "Roleplay GIF commands", category: "Mewo", type: "prefix", isSlash: false, fileLocation: "mewo/modules/roleplay.ts" },
  { name: "mewo tags", description: "Custom tag commands", category: "Mewo", type: "prefix", isSlash: false, fileLocation: "mewo/modules/tags.ts" },
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
    type: base.type,
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
