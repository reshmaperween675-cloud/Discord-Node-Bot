import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../../middlewares/requireAuth.js";

const router: IRouter = Router();
router.use(requireAuth);

const ALLOWED_TABLES = [
  "bot_kv", "activity_tracker", "auth_backups", "bot_sequences",
  "economy_users", "kill_leaderboard_players", "kill_pinned_messages",
  "leaderboard_players", "leaderboard_pinned_messages",
  "mewo_enabled_channels", "mewo_tags", "mewo_timezones", "mewo_embed_colors",
  "mewo_ai_usage", "mewo_wallets", "censor_guild_config", "censor_user_flags",
  "raid_results", "rules_messages", "tournaments", "tournament_participants",
  "training_logs", "warns", "promotions", "attendances", "mvps",
  "antinuke_whitelist", "antinuke_config", "lowo_guild_settings",
  "lowo_emoji_overrides", "dashboard_audit_logs", "mobile_leaderboard_players",
];

router.get("/db/tables", async (req, res): Promise<void> => {
  try {
    const { rows: tableRows } = await pool.query<{
      table_name: string;
      row_count: string;
      size_bytes: string;
      columns: string;
    }>(`
      SELECT
        t.table_name,
        COALESCE(s.n_live_tup, 0)::text AS row_count,
        COALESCE(pg_total_relation_size(quote_ident(t.table_name)), 0)::text AS size_bytes,
        json_agg(json_build_object('name', c.column_name, 'type', c.data_type, 'nullable', c.is_nullable = 'YES') ORDER BY c.ordinal_position)::text AS columns
      FROM information_schema.tables t
      LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
      LEFT JOIN information_schema.columns c ON c.table_name = t.table_name AND c.table_schema = 'public'
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      GROUP BY t.table_name, s.n_live_tup
      ORDER BY t.table_name
    `);

    const tables = tableRows
      .filter((r) => ALLOWED_TABLES.includes(r.table_name))
      .map((r) => ({
        name: r.table_name,
        rowCount: parseInt(r.row_count, 10) || 0,
        sizeBytes: parseInt(r.size_bytes, 10) || 0,
        columns: JSON.parse(r.columns || "[]") as Array<{ name: string; type: string; nullable: boolean }>,
      }));

    res.json(tables);
  } catch (err) {
    req.log.error({ err }, "Failed to list tables");
    res.status(500).json({ error: "Failed to list tables" });
  }
});

router.get("/db/tables/:tableName/rows", async (req, res): Promise<void> => {
  const rawName = Array.isArray(req.params.tableName) ? req.params.tableName[0] : req.params.tableName;
  const tableName = decodeURIComponent(rawName);

  if (!ALLOWED_TABLES.includes(tableName)) {
    res.status(403).json({ error: "Access denied to this table" });
    return;
  }

  const limit = Math.min(200, parseInt((req.query.limit as string) ?? "50", 10) || 50);
  const offset = parseInt((req.query.offset as string) ?? "0", 10) || 0;

  try {
    const { rows: countRows } = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM "${tableName}"`,
    );
    const total = parseInt(countRows[0]?.count ?? "0", 10);

    const { rows, fields } = await pool.query(
      `SELECT * FROM "${tableName}" ORDER BY 1 LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    const columns = fields.map((f) => f.name);

    res.json({ rows, total, columns });
  } catch (err) {
    req.log.error({ err }, "Failed to get table rows");
    res.status(500).json({ error: "Failed to get table rows" });
  }
});

export default router;
