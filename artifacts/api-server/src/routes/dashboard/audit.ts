import { Router, type IRouter } from "express";
import { db, dashboardAuditLogsTable } from "@workspace/db";
import { desc, like, and } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth.js";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/audit-logs", async (req, res): Promise<void> => {
  try {
    const limit = Math.min(200, parseInt((req.query.limit as string) ?? "50", 10) || 50);
    const offset = parseInt((req.query.offset as string) ?? "0", 10) || 0;
    const action = typeof req.query.action === "string" ? req.query.action : undefined;

    const conditions = action ? [like(dashboardAuditLogsTable.action, `${action}%`)] : [];

    const logs = await db
      .select()
      .from(dashboardAuditLogsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(dashboardAuditLogsTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(
      logs.map((l: typeof logs[0]) => ({
        id: l.id,
        action: l.action,
        userId: l.userId,
        username: l.username,
        before: l.before as Record<string, unknown>,
        after: l.after as Record<string, unknown>,
        metadata: l.metadata as Record<string, unknown>,
        timestamp: l.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to list audit logs");
    res.status(500).json({ error: "Failed to list audit logs" });
  }
});

export default router;
