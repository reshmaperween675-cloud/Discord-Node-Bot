import { db, dashboardAuditLogsTable } from "@workspace/db";
import { randomUUID } from "crypto";

export async function writeAuditLog(params: {
  action: string;
  userId: string;
  username: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(dashboardAuditLogsTable).values({
    id: randomUUID(),
    action: params.action,
    userId: params.userId,
    username: params.username,
    before: params.before ?? {},
    after: params.after ?? {},
    metadata: params.metadata ?? {},
  });
}
