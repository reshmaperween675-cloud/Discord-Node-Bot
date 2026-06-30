import pg from "pg";

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const { rows } = await pool.query(`
    SELECT guild_id, COUNT(*) as user_count, MAX(total_xp) as top_xp
    FROM leveling_users
    GROUP BY guild_id
    ORDER BY user_count DESC
  `);
  console.log("\n=== All guild IDs in leveling_users ===");
  console.table(rows);

  const { rows: all } = await pool.query(`SELECT guild_id, user_id, level, total_xp FROM leveling_users ORDER BY total_xp DESC LIMIT 5`);
  console.log("\n=== Top 5 users across all guilds ===");
  console.table(all);

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
