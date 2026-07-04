import { Router, type IRouter } from "express";
import { db, botKvTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth.js";
import { writeAuditLog } from "../../lib/audit.js";

const router: IRouter = Router();
router.use(requireAuth);

const MODULE_REGISTRY = [
  { name: "economy", displayName: "Economy", description: "Balance, daily rewards, rob, invest, crime commands", category: "Games", commandCount: 8 },
  { name: "leveling", displayName: "XP & Leveling", description: "XP tracking, rank cards, level roles, leaderboards", category: "Progression", commandCount: 11 },
  { name: "moderation", displayName: "Moderation", description: "Kick, ban, mute, warn, purge, word censoring", category: "Server Management", commandCount: 8 },
  { name: "lowo", displayName: "Lowo System", description: "Full OwO-style RPG system with hunting, battles, economy, and more", category: "Games", commandCount: 40 },
  { name: "mewo", displayName: "Mewo System", description: "AI, fun, utility, roleplay, games, search, tags", category: "Fun", commandCount: 8 },
  { name: "raids", displayName: "Raids", description: "Raid management, announcements, logging", category: "Server Events", commandCount: 3 },
  { name: "training", displayName: "Training", description: "Training session hosting, logging, MVP tracking", category: "Server Events", commandCount: 1 },
  { name: "tournaments", displayName: "Tournaments", description: "Tournament creation, registration, management", category: "Server Events", commandCount: 2 },
  { name: "utility", displayName: "Utility", description: "Polls, announcements, promotions, attendance, MVP, suggestions", category: "Server Management", commandCount: 9 },
  { name: "antinuke", displayName: "Anti-Nuke", description: "Server protection against mass ban/kick/role deletion", category: "Security", commandCount: 0 },
  { name: "verification", displayName: "Verification", description: "Discord OAuth2-based member verification with role assignment", category: "Security", commandCount: 0 },
  { name: "leaderboard", displayName: "Leaderboards", description: "Kill, mobile, and universal leaderboards with pinned messages", category: "Progression", commandCount: 12 },
  { name: "rules", displayName: "Rules", description: "Server rules panel setup and management", category: "Server Management", commandCount: 1 },
  { name: "music", displayName: "Music", description: "Play, pause, skip, queue, volume control for voice channels", category: "Fun", commandCount: 11 },
  { name: "nsfw", displayName: "NSFW", description: "Age-restricted content commands (age-restricted channels only)", category: "Fun", commandCount: 1 },
];

type ModuleState = { enabled: boolean; errorCount?: number; lastError?: string };

router.get("/modules", async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(botKvTable)
      .where(sql`${botKvTable.key} LIKE 'dashboard:module:%' AND ${botKvTable.key} NOT LIKE 'dashboard:module:settings:%'`);

    const stateMap = new Map(rows.map((r: typeof rows[0]) => [r.key.replace("dashboard:module:", ""), r.value as ModuleState]));

    const modules = MODULE_REGISTRY.map((m) => {
      const state = stateMap.get(m.name) as ModuleState | undefined;
      return {
        name: m.name,
        displayName: m.displayName,
        description: m.description,
        enabled: state?.enabled !== false,
        commandCount: m.commandCount,
        category: m.category,
        errorCount: state?.errorCount ?? 0,
        lastError: state?.lastError ?? null,
      };
    });

    res.json(modules);
  } catch (err) {
    req.log.error({ err }, "Failed to list modules");
    res.status(500).json({ error: "Failed to list modules" });
  }
});

router.get("/modules/:name", async (req, res): Promise<void> => {
  const rawName = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
  const name = decodeURIComponent(rawName);
  const base = MODULE_REGISTRY.find((m) => m.name === name);
  if (!base) {
    res.status(404).json({ error: "Module not found" });
    return;
  }

  const stateRow = await db.select().from(botKvTable).where(eq(botKvTable.key, `dashboard:module:${name}`)).limit(1);
  const state = (stateRow[0]?.value ?? {}) as ModuleState;

  res.json({
    name: base.name,
    displayName: base.displayName,
    description: base.description,
    enabled: state.enabled !== false,
    commandCount: base.commandCount,
    category: base.category,
    errorCount: state.errorCount ?? 0,
    lastError: state.lastError ?? null,
  });
});

router.post("/modules/:name/toggle", async (req, res): Promise<void> => {
  const rawName = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
  const name = decodeURIComponent(rawName);
  const base = MODULE_REGISTRY.find((m) => m.name === name);
  if (!base) {
    res.status(404).json({ error: "Module not found" });
    return;
  }

  const { enabled } = req.body as { enabled: boolean };
  const key = `dashboard:module:${name}`;
  const existingRow = await db.select().from(botKvTable).where(eq(botKvTable.key, key)).limit(1);
  const existing = (existingRow[0]?.value ?? {}) as ModuleState;
  const updated = { ...existing, enabled };

  await db
    .insert(botKvTable)
    .values({ key, value: updated })
    .onConflictDoUpdate({ target: botKvTable.key, set: { value: updated } });

  await writeAuditLog({
    action: `module.${enabled ? "enabled" : "disabled"}:${name}`,
    userId: req.session.userId!,
    username: req.session.username!,
    before: { enabled: !enabled },
    after: { enabled },
  });

  res.json({ ok: true, message: `Module ${enabled ? "enabled" : "disabled"}` });
});

router.get("/modules/:name/settings", async (req, res): Promise<void> => {
  const rawName = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
  const name = decodeURIComponent(rawName);
  const base = MODULE_REGISTRY.find((m) => m.name === name);
  if (!base) {
    res.status(404).json({ error: "Module not found" });
    return;
  }

  const row = await db.select().from(botKvTable).where(eq(botKvTable.key, `dashboard:module:settings:${name}`)).limit(1);
  res.json({ moduleName: name, settings: (row[0]?.value ?? {}) as Record<string, unknown> });
});

router.patch("/modules/:name/settings", async (req, res): Promise<void> => {
  const rawName = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
  const name = decodeURIComponent(rawName);
  const base = MODULE_REGISTRY.find((m) => m.name === name);
  if (!base) {
    res.status(404).json({ error: "Module not found" });
    return;
  }

  const { settings } = req.body as { settings: Record<string, unknown> };
  const key = `dashboard:module:settings:${name}`;
  const existing = (await db.select().from(botKvTable).where(eq(botKvTable.key, key)).limit(1))[0]?.value ?? {};

  await db
    .insert(botKvTable)
    .values({ key, value: settings })
    .onConflictDoUpdate({ target: botKvTable.key, set: { value: settings } });

  await writeAuditLog({
    action: `module.settings.updated:${name}`,
    userId: req.session.userId!,
    username: req.session.username!,
    before: existing as Record<string, unknown>,
    after: settings,
  });

  res.json({ moduleName: name, settings });
});

export default router;
