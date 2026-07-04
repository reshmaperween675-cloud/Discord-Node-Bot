import { Router, type IRouter } from "express";
import { db, botKvTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth.js";
import { writeAuditLog } from "../../lib/audit.js";

const router: IRouter = Router();
router.use(requireAuth);

type PresenceData = { status: string; activityType: string; activityText: string; customStatus?: string };

const PRESENCE_KEY = "dashboard:bot:presence";
const DEFAULT_PRESENCE: PresenceData = { status: "online", activityType: "Playing", activityText: "Last Stand" };

router.get("/bot/presence", async (req, res): Promise<void> => {
  const row = await db.select().from(botKvTable).where(eq(botKvTable.key, PRESENCE_KEY)).limit(1);
  const data = (row[0]?.value ?? DEFAULT_PRESENCE) as PresenceData;
  res.json(data);
});

router.put("/bot/presence", async (req, res): Promise<void> => {
  const { status, activityType, activityText } = req.body as PresenceData;
  if (!status || !activityType || activityText == null) {
    res.status(400).json({ error: "Missing required fields: status, activityType, activityText" });
    return;
  }

  const existing = (await db.select().from(botKvTable).where(eq(botKvTable.key, PRESENCE_KEY)).limit(1))[0]?.value ?? {};
  const updated: PresenceData = { status, activityType, activityText };

  await db
    .insert(botKvTable)
    .values({ key: PRESENCE_KEY, value: updated })
    .onConflictDoUpdate({ target: botKvTable.key, set: { value: updated } });

  await writeAuditLog({
    action: "bot.presence.updated",
    userId: req.session.userId!,
    username: req.session.username!,
    before: existing as Record<string, unknown>,
    after: updated as Record<string, unknown>,
  });

  res.json({ ok: true, message: "Presence updated. The bot will apply this on its next heartbeat." });
});

router.post("/bot/action", async (req, res): Promise<void> => {
  const { action } = req.body as { action: string; params?: Record<string, unknown> };
  const ALLOWED_ACTIONS = ["sync-commands", "clear-cache", "maintenance-on", "maintenance-off", "reload-modules"];

  if (!ALLOWED_ACTIONS.includes(action)) {
    res.status(400).json({ error: `Unknown action. Allowed: ${ALLOWED_ACTIONS.join(", ")}` });
    return;
  }

  // Queue the action for the bot to pick up
  const key = "dashboard:bot:pending-action";
  await db
    .insert(botKvTable)
    .values({ key, value: { action, requestedAt: new Date().toISOString(), requestedBy: req.session.userId } })
    .onConflictDoUpdate({
      target: botKvTable.key,
      set: { value: { action, requestedAt: new Date().toISOString(), requestedBy: req.session.userId } },
    });

  await writeAuditLog({
    action: `bot.action:${action}`,
    userId: req.session.userId!,
    username: req.session.username!,
    before: {},
    after: { action },
  });

  res.json({
    ok: true,
    message: `Action "${action}" queued. The bot will process it on its next heartbeat cycle.`,
  });
});

export default router;
