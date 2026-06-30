import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "../../artifacts/discord-bot/data/leveling.json");

interface UserData {
  xp: number;
  level: number;
  totalXp: number;
  weeklyXp: number;
  lastMessageAt: number;
  lastMessageContent: string;
}

interface GuildConfig {
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
}

interface LevelingData {
  configs: Record<string, GuildConfig>;
  users: Record<string, Record<string, UserData>>;
  levelRoles: Record<string, Record<string, string>>;
  lastWeeklyReset: number;
  weeklyHistory: unknown[];
}

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error("❌  DATABASE_URL is not set. Export it and re-run.");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes("sslmode=disable")
      ? false
      : { rejectUnauthorized: false },
  });

  console.log("📂  Reading leveling.json …");
  const raw = readFileSync(DATA_PATH, "utf8");
  const data: LevelingData = JSON.parse(raw);

  const client = await pool.connect();
  try {
    // ── 0. Ensure tables exist ────────────────────────────────────────────────
    console.log("🛠️   Ensuring leveling tables exist …");
    await client.query(`
      CREATE TABLE IF NOT EXISTS leveling_users (
        guild_id             TEXT   NOT NULL,
        user_id              TEXT   NOT NULL,
        xp                   INT    NOT NULL DEFAULT 0,
        level                INT    NOT NULL DEFAULT 0,
        total_xp             INT    NOT NULL DEFAULT 0,
        weekly_xp            INT    NOT NULL DEFAULT 0,
        last_message_at      BIGINT NOT NULL DEFAULT 0,
        last_message_content TEXT   NOT NULL DEFAULT '',
        PRIMARY KEY (guild_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS leveling_configs (
        guild_id              TEXT    PRIMARY KEY,
        enabled               BOOLEAN NOT NULL DEFAULT true,
        xp_min                INT     NOT NULL DEFAULT 15,
        xp_max                INT     NOT NULL DEFAULT 25,
        cooldown              INT     NOT NULL DEFAULT 60,
        level_up_channel_id   TEXT,
        announcements         BOOLEAN NOT NULL DEFAULT true,
        ping_on_level_up      BOOLEAN NOT NULL DEFAULT true,
        keep_old_roles        BOOLEAN NOT NULL DEFAULT true,
        blacklisted_channels  TEXT[]  NOT NULL DEFAULT '{}',
        whitelisted_channels  TEXT[]  NOT NULL DEFAULT '{}',
        server_multiplier     FLOAT   NOT NULL DEFAULT 1.0,
        role_multipliers      JSONB   NOT NULL DEFAULT '{}',
        event_multiplier      FLOAT   NOT NULL DEFAULT 1.0,
        anti_spam_enabled     BOOLEAN NOT NULL DEFAULT true
      );
      CREATE TABLE IF NOT EXISTS leveling_level_roles (
        guild_id  TEXT NOT NULL,
        level     INT  NOT NULL,
        role_name TEXT NOT NULL,
        PRIMARY KEY (guild_id, level)
      );
      CREATE TABLE IF NOT EXISTS leveling_meta (
        key      TEXT   PRIMARY KEY,
        int_val  BIGINT,
        json_val JSONB
      );
    `);
    console.log("   ✓ Tables ready");

    await client.query("BEGIN");

    // ── 1. Guild configs ─────────────────────────────────────────────────────
    console.log("⚙️   Restoring guild configs …");
    for (const [guildId, cfg] of Object.entries(data.configs)) {
      await client.query(
        `INSERT INTO leveling_configs
           (guild_id, enabled, xp_min, xp_max, cooldown, level_up_channel_id,
            announcements, ping_on_level_up, keep_old_roles, blacklisted_channels,
            whitelisted_channels, server_multiplier, role_multipliers, event_multiplier,
            anti_spam_enabled)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (guild_id) DO UPDATE SET
           enabled              = EXCLUDED.enabled,
           xp_min               = EXCLUDED.xp_min,
           xp_max               = EXCLUDED.xp_max,
           cooldown             = EXCLUDED.cooldown,
           level_up_channel_id  = EXCLUDED.level_up_channel_id,
           announcements        = EXCLUDED.announcements,
           ping_on_level_up     = EXCLUDED.ping_on_level_up,
           keep_old_roles       = EXCLUDED.keep_old_roles,
           blacklisted_channels = EXCLUDED.blacklisted_channels,
           whitelisted_channels = EXCLUDED.whitelisted_channels,
           server_multiplier    = EXCLUDED.server_multiplier,
           role_multipliers     = EXCLUDED.role_multipliers,
           event_multiplier     = EXCLUDED.event_multiplier,
           anti_spam_enabled    = EXCLUDED.anti_spam_enabled`,
        [
          guildId,
          cfg.enabled,
          cfg.xpMin,
          cfg.xpMax,
          cfg.cooldown,
          cfg.levelUpChannelId ?? null,
          cfg.announcements,
          cfg.pingOnLevelUp,
          cfg.keepOldRoles,
          cfg.blacklistedChannels,
          cfg.whitelistedChannels,
          cfg.serverMultiplier,
          JSON.stringify(cfg.roleMultipliers ?? {}),
          cfg.eventMultiplier,
          true, // anti_spam_enabled default
        ]
      );
      console.log(`   ✓ Config for guild ${guildId}`);
    }

    // ── 2. Level roles ────────────────────────────────────────────────────────
    console.log("🎖️   Restoring level roles …");
    for (const [guildId, roles] of Object.entries(data.levelRoles)) {
      for (const [level, roleName] of Object.entries(roles)) {
        await client.query(
          `INSERT INTO leveling_level_roles (guild_id, level, role_name)
           VALUES ($1,$2,$3)
           ON CONFLICT (guild_id, level) DO UPDATE SET role_name = EXCLUDED.role_name`,
          [guildId, Number(level), roleName]
        );
      }
      console.log(`   ✓ ${Object.keys(roles).length} level roles for guild ${guildId}`);
    }

    // ── 3. Users ──────────────────────────────────────────────────────────────
    console.log("👥  Restoring user XP / levels …");
    let userCount = 0;
    for (const [guildId, users] of Object.entries(data.users)) {
      for (const [userId, u] of Object.entries(users)) {
        await client.query(
          `INSERT INTO leveling_users
             (guild_id, user_id, xp, level, total_xp, weekly_xp,
              last_message_at, last_message_content)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (guild_id, user_id) DO UPDATE SET
             xp                   = EXCLUDED.xp,
             level                = EXCLUDED.level,
             total_xp             = EXCLUDED.total_xp,
             weekly_xp            = EXCLUDED.weekly_xp,
             last_message_at      = EXCLUDED.last_message_at,
             last_message_content = EXCLUDED.last_message_content`,
          [
            guildId,
            userId,
            u.xp,
            u.level,
            u.totalXp,
            u.weeklyXp,
            u.lastMessageAt,
            u.lastMessageContent,
          ]
        );
        userCount++;
      }
    }
    console.log(`   ✓ ${userCount} user rows restored`);

    // ── 4. Weekly reset timestamp ─────────────────────────────────────────────
    if (data.lastWeeklyReset) {
      console.log("📅  Restoring last weekly reset timestamp …");
      await client.query(
        `INSERT INTO leveling_meta (key, int_val)
         VALUES ('last_weekly_reset', $1)
         ON CONFLICT (key) DO UPDATE SET int_val = EXCLUDED.int_val`,
        [data.lastWeeklyReset]
      );
      console.log(`   ✓ lastWeeklyReset = ${data.lastWeeklyReset}`);
    }

    await client.query("COMMIT");
    console.log("\n✅  Restore complete! All leveling data is back in PostgreSQL.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌  Restore failed — rolled back.", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
