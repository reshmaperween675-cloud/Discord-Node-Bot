import pg from "pg";

const OLD_GUILD = "1479910330669990025";
const NEW_GUILD = "1492667977504526476";

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Users
    const { rowCount: userRows } = await client.query(`
      INSERT INTO leveling_users (guild_id, user_id, xp, level, total_xp, weekly_xp, last_message_at, last_message_content)
      SELECT $2, user_id, xp, level, total_xp, weekly_xp, last_message_at, last_message_content
      FROM leveling_users WHERE guild_id = $1
      ON CONFLICT (guild_id, user_id) DO UPDATE SET
        xp                   = EXCLUDED.xp,
        level                = EXCLUDED.level,
        total_xp             = EXCLUDED.total_xp,
        weekly_xp            = EXCLUDED.weekly_xp,
        last_message_at      = EXCLUDED.last_message_at,
        last_message_content = EXCLUDED.last_message_content
    `, [OLD_GUILD, NEW_GUILD]);
    console.log(`✓ ${userRows} user rows copied`);

    // Config
    const { rowCount: cfgRows } = await client.query(`
      INSERT INTO leveling_configs (guild_id, enabled, xp_min, xp_max, cooldown, level_up_channel_id,
        announcements, ping_on_level_up, keep_old_roles, blacklisted_channels, whitelisted_channels,
        server_multiplier, role_multipliers, event_multiplier, anti_spam_enabled)
      SELECT $2, enabled, xp_min, xp_max, cooldown, level_up_channel_id,
        announcements, ping_on_level_up, keep_old_roles, blacklisted_channels, whitelisted_channels,
        server_multiplier, role_multipliers, event_multiplier, anti_spam_enabled
      FROM leveling_configs WHERE guild_id = $1
      ON CONFLICT (guild_id) DO UPDATE SET
        enabled = EXCLUDED.enabled, xp_min = EXCLUDED.xp_min, xp_max = EXCLUDED.xp_max,
        cooldown = EXCLUDED.cooldown, announcements = EXCLUDED.announcements,
        ping_on_level_up = EXCLUDED.ping_on_level_up, keep_old_roles = EXCLUDED.keep_old_roles,
        server_multiplier = EXCLUDED.server_multiplier, role_multipliers = EXCLUDED.role_multipliers,
        event_multiplier = EXCLUDED.event_multiplier, anti_spam_enabled = EXCLUDED.anti_spam_enabled
    `, [OLD_GUILD, NEW_GUILD]);
    console.log(`✓ ${cfgRows} config rows copied`);

    // Level roles
    const { rowCount: roleRows } = await client.query(`
      INSERT INTO leveling_level_roles (guild_id, level, role_name)
      SELECT $2, level, role_name FROM leveling_level_roles WHERE guild_id = $1
      ON CONFLICT (guild_id, level) DO UPDATE SET role_name = EXCLUDED.role_name
    `, [OLD_GUILD, NEW_GUILD]);
    console.log(`✓ ${roleRows} level role rows copied`);

    await client.query("COMMIT");

    // Verify
    const { rows } = await pool.query(`
      SELECT user_id, level, total_xp FROM leveling_users
      WHERE guild_id = $1 ORDER BY total_xp DESC LIMIT 5
    `, [NEW_GUILD]);
    console.log(`\n✅ Done! Top 5 users now under guild ${NEW_GUILD}:`);
    console.table(rows);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
