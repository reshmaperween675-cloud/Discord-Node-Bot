import { Router, type IRouter } from "express";
import os from "node:os";
import { pool, db, botKvTable, economyUsersTable, activityTrackerTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth.js";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/stats", async (req, res): Promise<void> => {
  try {
    // Memory usage
    const memUsage = process.memoryUsage();
    const memMb = Math.round(memUsage.heapUsed / 1024 / 1024 * 10) / 10;

    // CPU estimate (normalize load avg by cpu count)
    const cpuLoad = os.loadavg()[0] ?? 0;
    const cpuCount = os.cpus().length || 1;
    const cpuPercent = Math.min(100, Math.round((cpuLoad / cpuCount) * 100 * 10) / 10);

    // Bot stats from bot_kv
    let botStatus = "unknown";
    let uptime = 0;
    let ping: number | null = null;
    let servers = 0;
    let users = 0;

    const botStatsRow = await db
      .select()
      .from(botKvTable)
      .where(eq(botKvTable.key, "dashboard:bot:heartbeat"))
      .limit(1);

    if (botStatsRow[0]) {
      const data = botStatsRow[0].value as Record<string, unknown>;
      botStatus = (data.status as string) ?? "online";
      uptime = (data.uptime as number) ?? 0;
      ping = (data.ping as number) ?? null;
      servers = (data.servers as number) ?? 0;
      users = (data.users as number) ?? 0;

      // Consider bot offline if heartbeat is older than 3 minutes
      const updatedAt = botStatsRow[0].updatedAt;
      if (updatedAt && Date.now() - new Date(updatedAt).getTime() > 3 * 60 * 1000) {
        botStatus = "offline";
      }
    }

    // DB status
    let dbStatus = "healthy";
    try {
      await pool.query("SELECT 1");
    } catch {
      dbStatus = "degraded";
    }

    // Module count from bot_kv module states
    const moduleRows = await db
      .select()
      .from(botKvTable)
      .where(sql`${botKvTable.key} LIKE 'dashboard:module:%' AND ${botKvTable.key} NOT LIKE 'dashboard:module:settings:%'`);
    const activeModules = moduleRows.filter((r) => (r.value as { enabled?: boolean })?.enabled !== false).length;

    // Command count (static + enabled overrides)
    const cmdRows = await db
      .select()
      .from(botKvTable)
      .where(sql`${botKvTable.key} LIKE 'dashboard:cmd:override:%'`);
    const disabledCmds = cmdRows.filter((r) => (r.value as { enabled?: boolean })?.enabled === false).length;
    const loadedCommands = Math.max(0, 120 - disabledCmds); // approx total

    // Recent errors from bot_kv
    const errorsRow = await db
      .select()
      .from(botKvTable)
      .where(eq(botKvTable.key, "dashboard:bot:errors"))
      .limit(1);
    const recentErrorCount = errorsRow[0]
      ? ((errorsRow[0].value as number[]) ?? []).length
      : 0;

    res.json({
      bot: {
        status: botStatus,
        uptime,
        ping,
        servers,
        users,
        memoryMb: memMb,
        cpuPercent,
      },
      system: {
        dbStatus,
        activeModules: activeModules || 15,
        loadedCommands,
        recentErrorCount,
        nodeVersion: process.version,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard stats");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

router.get("/stats/activity", async (req, res): Promise<void> => {
  try {
    // Pull recent activity from audit logs
    const { dashboardAuditLogsTable } = await import("@workspace/db");
    const { desc } = await import("drizzle-orm");

    const logs = await db
      .select()
      .from(dashboardAuditLogsTable)
      .orderBy(desc(dashboardAuditLogsTable.createdAt))
      .limit(20);

    const activity = logs.map((log) => ({
      id: log.id,
      type: log.action,
      message: `${log.username} — ${log.action}`,
      timestamp: log.createdAt.toISOString(),
    }));

    // Pad with system events if sparse
    if (activity.length === 0) {
      activity.push({
        id: "sys-1",
        type: "system",
        message: "Control Center initialized",
        timestamp: new Date().toISOString(),
      });
    }

    res.json(activity);
  } catch (err) {
    req.log.error({ err }, "Failed to get activity");
    res.json([]);
  }
});

export default router;
