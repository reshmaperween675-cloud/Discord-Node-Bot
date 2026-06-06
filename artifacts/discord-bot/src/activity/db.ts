import { getPool } from "../persistence.js";

export async function upsertMessageActivity(userId: string): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  await getPool().query(
    `INSERT INTO activity_tracker (user_id, last_message, total_messages)
     VALUES ($1, NOW(), 1)
     ON CONFLICT (user_id) DO UPDATE
     SET last_message = NOW(), total_messages = activity_tracker.total_messages + 1`,
    [userId],
  );
}

export async function upsertVoiceActivity(userId: string): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  await getPool().query(
    `INSERT INTO activity_tracker (user_id, last_voice, total_messages)
     VALUES ($1, NOW(), 0)
     ON CONFLICT (user_id) DO UPDATE
     SET last_voice = NOW()`,
    [userId],
  );
}

export interface ActivityRow {
  user_id: string;
  last_message: Date | null;
  last_voice: Date | null;
  total_messages: number;
}

export async function getAllActivityRows(): Promise<ActivityRow[]> {
  if (!process.env.DATABASE_URL) return [];
  const res = await getPool().query<ActivityRow>(
    `SELECT user_id, last_message, last_voice, total_messages
     FROM activity_tracker
     ORDER BY GREATEST(last_message, last_voice) DESC NULLS LAST`,
  );
  return res.rows;
}

export async function getInactiveUserIds(days = 14): Promise<string[]> {
  if (!process.env.DATABASE_URL) return [];
  const res = await getPool().query<{ user_id: string }>(
    `SELECT user_id FROM activity_tracker
     WHERE (last_message IS NULL OR last_message < NOW() - ($1 || ' days')::INTERVAL)
       AND (last_voice   IS NULL OR last_voice   < NOW() - ($1 || ' days')::INTERVAL)`,
    [String(days)],
  );
  return res.rows.map((r) => r.user_id);
}
