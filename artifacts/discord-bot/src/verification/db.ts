import { getPool } from "../persistence.js";

export interface AuthBackupRow {
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: Date;
  guild_id: string;
}

export async function upsertAuthBackup(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
  guildId: string,
): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const expiry = new Date(Date.now() + expiresIn * 1000);
  await getPool().query(
    `INSERT INTO auth_backups (user_id, access_token, refresh_token, token_expiry, guild_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, guild_id) DO UPDATE
     SET access_token  = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         token_expiry  = EXCLUDED.token_expiry`,
    [userId, accessToken, refreshToken, expiry.toISOString(), guildId],
  );
}

export async function updateAuthTokens(
  userId: string,
  guildId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const expiry = new Date(Date.now() + expiresIn * 1000);
  await getPool().query(
    `UPDATE auth_backups
     SET access_token  = $3,
         refresh_token = $4,
         token_expiry  = $5
     WHERE user_id = $1 AND guild_id = $2`,
    [userId, guildId, accessToken, refreshToken, expiry.toISOString()],
  );
}

export async function getAllAuthBackups(guildId: string): Promise<AuthBackupRow[]> {
  if (!process.env.DATABASE_URL) return [];
  const res = await getPool().query<AuthBackupRow>(
    `SELECT user_id, access_token, refresh_token, token_expiry, guild_id
     FROM auth_backups
     WHERE guild_id = $1`,
    [guildId],
  );
  return res.rows;
}

export async function getAuthBackupCount(guildId: string): Promise<number> {
  if (!process.env.DATABASE_URL) return 0;
  const res = await getPool().query<{ count: string }>(
    `SELECT COUNT(*)::TEXT AS count FROM auth_backups WHERE guild_id = $1`,
    [guildId],
  );
  return parseInt(res.rows[0]?.count ?? "0", 10);
}
