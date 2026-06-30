import { getPool } from "../persistence.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserData {
  xp: number;
  level: number;
  totalXp: number;
  weeklyXp: number;
  lastMessageAt: number;
  lastMessageContent: string;
}

export interface GuildConfig {
  enabled: boolean;
  xpMin: number;
  xpMax: number;
  cooldown: number;
  levelUpChannelId: string | null;
  announcements: boolean;
  pingOnLevelUp: boolean;
  keepOldRoles: boolean;
  blacklistedChannels: string[];
  whitelistedChannels: string[];
  serverMultiplier: number;
  roleMultipliers: Record<string, number>;
  eventMultiplier: number;
  antiSpamEnabled: boolean;
}

export interface WeeklyHistoryEntry {
  week: string;
  guildId: string;
  winners: Array<{ userId: string; weeklyXp: number }>;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: GuildConfig = {
  enabled: true,
  xpMin: 15,
  xpMax: 25,
  cooldown: 60,
  levelUpChannelId: null,
  announcements: true,
  pingOnLevelUp: true,
  keepOldRoles: true,
  blacklistedChannels: [],
  whitelistedChannels: [],
  serverMultiplier: 1.0,
  roleMultipliers: {},
  eventMultiplier: 1.0,
  antiSpamEnabled: true,
};

export const DEFAULT_LEVEL_ROLES: Record<string, string> = {
  "5":  "Rookie",
  "10": "Experienced",
  "15": "Active",
  "20": "Elite",
  "25": "Elite Active",
  "30": "Elite official member",
  "35": "Monarch",
  "40": "Divine general",
  "45": "Mystic",
  "50": "King 👑",
};

// ─── In-memory caches ─────────────────────────────────────────────────────────

const userCache    = new Map<string, UserData>();
const configCache  = new Map<string, GuildConfig>();
const rolesCache   = new Map<string, Record<string, string>>();
let weeklyResetCache: number | null = null;

function ukey(guildId: string, userId: string) { return `${guildId}:${userId}`; }

// ─── DB row converters ────────────────────────────────────────────────────────

function rowToUser(row: Record<string, unknown>): UserData {
  return {
    xp:                  Number(row.xp ?? 0),
    level:               Number(row.level ?? 0),
    totalXp:             Number(row.total_xp ?? 0),
    weeklyXp:            Number(row.weekly_xp ?? 0),
    lastMessageAt:       Number(row.last_message_at ?? 0),
    lastMessageContent:  String(row.last_message_content ?? ""),
  };
}

function rowToConfig(row: Record<string, unknown>): GuildConfig {
  return {
    enabled:             Boolean(row.enabled ?? true),
    xpMin:               Number(row.xp_min ?? 15),
    xpMax:               Number(row.xp_max ?? 25),
    cooldown:            Number(row.cooldown ?? 60),
    levelUpChannelId:    (row.level_up_channel_id as string | null) ?? null,
    announcements:       Boolean(row.announcements ?? true),
    pingOnLevelUp:       Boolean(row.ping_on_level_up ?? true),
    keepOldRoles:        Boolean(row.keep_old_roles ?? true),
    blacklistedChannels: (row.blacklisted_channels as string[]) ?? [],
    whitelistedChannels: (row.whitelisted_channels as string[]) ?? [],
    serverMultiplier:    Number(row.server_multiplier ?? 1.0),
    roleMultipliers:     (row.role_multipliers as Record<string, number>) ?? {},
    eventMultiplier:     Number(row.event_multiplier ?? 1.0),
    antiSpamEnabled:     Boolean(row.anti_spam_enabled ?? true),
  };
}

// ─── Config ───────────────────────────────────────────────────────────────────

export async function getGuildConfig(guildId: string): Promise<GuildConfig> {
  if (configCache.has(guildId)) return configCache.get(guildId)!;
  const { rows } = await getPool().query(
    `SELECT * FROM leveling_configs WHERE guild_id = $1 LIMIT 1`,
    [guildId]
  );
  const cfg = rows[0]
    ? rowToConfig(rows[0] as Record<string, unknown>)
    : { ...DEFAULT_CONFIG, blacklistedChannels: [], whitelistedChannels: [], roleMultipliers: {} };
  configCache.set(guildId, cfg);
  return cfg;
}

export async function patchGuildConfig(guildId: string, patch: Partial<GuildConfig>): Promise<void> {
  const cur = await getGuildConfig(guildId);
  const u = { ...cur, ...patch };
  configCache.set(guildId, u);
  await getPool().query(
    `INSERT INTO leveling_configs
       (guild_id, enabled, xp_min, xp_max, cooldown, level_up_channel_id,
        announcements, ping_on_level_up, keep_old_roles, blacklisted_channels,
        whitelisted_channels, server_multiplier, role_multipliers, event_multiplier, anti_spam_enabled)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (guild_id) DO UPDATE SET
       enabled             = EXCLUDED.enabled,
       xp_min              = EXCLUDED.xp_min,
       xp_max              = EXCLUDED.xp_max,
       cooldown            = EXCLUDED.cooldown,
       level_up_channel_id = EXCLUDED.level_up_channel_id,
       announcements       = EXCLUDED.announcements,
       ping_on_level_up    = EXCLUDED.ping_on_level_up,
       keep_old_roles      = EXCLUDED.keep_old_roles,
       blacklisted_channels= EXCLUDED.blacklisted_channels,
       whitelisted_channels= EXCLUDED.whitelisted_channels,
       server_multiplier   = EXCLUDED.server_multiplier,
       role_multipliers    = EXCLUDED.role_multipliers,
       event_multiplier    = EXCLUDED.event_multiplier,
       anti_spam_enabled   = EXCLUDED.anti_spam_enabled`,
    [
      guildId, u.enabled, u.xpMin, u.xpMax, u.cooldown, u.levelUpChannelId,
      u.announcements, u.pingOnLevelUp, u.keepOldRoles,
      u.blacklistedChannels, u.whitelistedChannels,
      u.serverMultiplier, JSON.stringify(u.roleMultipliers), u.eventMultiplier, u.antiSpamEnabled,
    ]
  );
}

// ─── Level Roles ──────────────────────────────────────────────────────────────

export async function getGuildLevelRoles(guildId: string): Promise<Record<string, string>> {
  if (rolesCache.has(guildId)) return rolesCache.get(guildId)!;
  const { rows } = await getPool().query(
    `SELECT level, role_name FROM leveling_level_roles WHERE guild_id = $1`,
    [guildId]
  );
  const roles: Record<string, string> = {};
  if (rows.length === 0) {
    Object.assign(roles, DEFAULT_LEVEL_ROLES);
    await _bulkUpsertRoles(guildId, roles);
  } else {
    for (const r of rows) roles[String((r as Record<string, unknown>).level)] = String((r as Record<string, unknown>).role_name);
  }
  rolesCache.set(guildId, roles);
  return roles;
}

async function _bulkUpsertRoles(guildId: string, roles: Record<string, string>): Promise<void> {
  const pool = getPool();
  for (const [lvl, name] of Object.entries(roles)) {
    await pool.query(
      `INSERT INTO leveling_level_roles (guild_id, level, role_name) VALUES ($1,$2,$3)
       ON CONFLICT (guild_id, level) DO UPDATE SET role_name = EXCLUDED.role_name`,
      [guildId, Number(lvl), name]
    );
  }
}

export async function setLevelRole(guildId: string, level: number, roleName: string): Promise<void> {
  const roles = await getGuildLevelRoles(guildId);
  roles[String(level)] = roleName;
  rolesCache.set(guildId, roles);
  await getPool().query(
    `INSERT INTO leveling_level_roles (guild_id, level, role_name) VALUES ($1,$2,$3)
     ON CONFLICT (guild_id, level) DO UPDATE SET role_name = EXCLUDED.role_name`,
    [guildId, level, roleName]
  );
}

export async function removeLevelRole(guildId: string, level: number): Promise<boolean> {
  const roles = await getGuildLevelRoles(guildId);
  if (!(String(level) in roles)) return false;
  delete roles[String(level)];
  rolesCache.set(guildId, roles);
  await getPool().query(
    `DELETE FROM leveling_level_roles WHERE guild_id = $1 AND level = $2`,
    [guildId, level]
  );
  return true;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUser(guildId: string, userId: string): Promise<UserData> {
  const k = ukey(guildId, userId);
  if (userCache.has(k)) return userCache.get(k)!;
  const { rows } = await getPool().query(
    `SELECT * FROM leveling_users WHERE guild_id = $1 AND user_id = $2 LIMIT 1`,
    [guildId, userId]
  );
  const user = rows[0]
    ? rowToUser(rows[0] as Record<string, unknown>)
    : { xp: 0, level: 0, totalXp: 0, weeklyXp: 0, lastMessageAt: 0, lastMessageContent: "" };
  userCache.set(k, user);
  return user;
}

export async function saveUser(guildId: string, userId: string, user: UserData): Promise<void> {
  userCache.set(ukey(guildId, userId), user);
  await getPool().query(
    `INSERT INTO leveling_users
       (guild_id, user_id, xp, level, total_xp, weekly_xp, last_message_at, last_message_content)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (guild_id, user_id) DO UPDATE SET
       xp                  = EXCLUDED.xp,
       level               = EXCLUDED.level,
       total_xp            = EXCLUDED.total_xp,
       weekly_xp           = EXCLUDED.weekly_xp,
       last_message_at     = EXCLUDED.last_message_at,
       last_message_content= EXCLUDED.last_message_content`,
    [guildId, userId, user.xp, user.level, user.totalXp, user.weeklyXp, user.lastMessageAt, user.lastMessageContent]
  );
}

export async function getAllUsers(guildId: string): Promise<Array<{ userId: string } & UserData>> {
  const { rows } = await getPool().query(
    `SELECT * FROM leveling_users WHERE guild_id = $1`,
    [guildId]
  );
  return rows.map((r) => {
    const row = r as Record<string, unknown>;
    return { userId: String(row.user_id), ...rowToUser(row) };
  });
}

export async function resetUser(guildId: string, userId: string): Promise<void> {
  const blank: UserData = { xp: 0, level: 0, totalXp: 0, weeklyXp: 0, lastMessageAt: 0, lastMessageContent: "" };
  userCache.set(ukey(guildId, userId), blank);
  await getPool().query(
    `INSERT INTO leveling_users
       (guild_id, user_id, xp, level, total_xp, weekly_xp, last_message_at, last_message_content)
     VALUES ($1,$2,0,0,0,0,0,'')
     ON CONFLICT (guild_id, user_id) DO UPDATE SET
       xp=0, level=0, total_xp=0, weekly_xp=0, last_message_at=0, last_message_content=''`,
    [guildId, userId]
  );
}

export async function modifyUserXp(
  guildId: string,
  userId: string,
  deltaOrAbsolute: number,
  mode: "add" | "remove" | "set",
): Promise<UserData> {
  const user = await getUser(guildId, userId);
  if (mode === "add")    user.totalXp = Math.max(0, user.totalXp + deltaOrAbsolute);
  else if (mode === "remove") user.totalXp = Math.max(0, user.totalXp - deltaOrAbsolute);
  else                   user.totalXp = Math.max(0, deltaOrAbsolute);
  await saveUser(guildId, userId, user);
  return user;
}

// ─── Weekly ───────────────────────────────────────────────────────────────────

export async function getLastWeeklyReset(): Promise<number> {
  if (weeklyResetCache !== null) return weeklyResetCache;
  const { rows } = await getPool().query(
    `SELECT int_val FROM leveling_meta WHERE key = 'last_weekly_reset' LIMIT 1`
  );
  const ts = rows[0] ? Number((rows[0] as Record<string, unknown>).int_val) : Date.now();
  weeklyResetCache = ts;
  return ts;
}

export async function setLastWeeklyReset(ts: number): Promise<void> {
  weeklyResetCache = ts;
  await getPool().query(
    `INSERT INTO leveling_meta (key, int_val) VALUES ('last_weekly_reset', $1)
     ON CONFLICT (key) DO UPDATE SET int_val = EXCLUDED.int_val`,
    [ts]
  );
}

export async function resetWeeklyXp(guildId: string): Promise<void> {
  await getPool().query(
    `UPDATE leveling_users SET weekly_xp = 0 WHERE guild_id = $1`,
    [guildId]
  );
  for (const [k, u] of userCache.entries()) {
    if (k.startsWith(`${guildId}:`)) u.weeklyXp = 0;
  }
}

export async function recordWeeklyHistory(entry: WeeklyHistoryEntry): Promise<void> {
  await getPool().query(
    `INSERT INTO leveling_meta (key, json_val) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET json_val =
       (COALESCE(leveling_meta.json_val, '[]'::jsonb) || EXCLUDED.json_val::jsonb)`,
    [`weekly_history_${entry.guildId}`, JSON.stringify([entry])]
  );
}
