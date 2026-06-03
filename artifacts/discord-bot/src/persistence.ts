import { existsSync, mkdirSync, readFileSync, writeFileSync, watch, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = resolve(__dirname, "../data");
const DATABASE_URL = process.env.DATABASE_URL;
const useDb = !!DATABASE_URL;

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL?.includes("sslmode=disable")
        ? false
        : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

async function ensureSchema(): Promise<void> {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS bot_kv (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function uploadFile(filename: string): Promise<void> {
  const filePath = join(DATA_DIR, filename);
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`[PERSISTENCE] Skipping ${filename} — invalid JSON:`, err);
    return;
  }
  await getPool().query(
    `INSERT INTO bot_kv (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [filename, JSON.stringify(parsed)]
  );
}

async function downloadAll(): Promise<Set<string>> {
  const res = await getPool().query<{ key: string; value: unknown }>(
    "SELECT key, value FROM bot_kv"
  );
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const downloaded = new Set<string>();
  for (const row of res.rows) {
    const filePath = join(DATA_DIR, row.key);
    writeFileSync(filePath, JSON.stringify(row.value, null, 2), "utf-8");
    downloaded.add(row.key);
  }
  return downloaded;
}

const pendingUploads = new Map<string, NodeJS.Timeout>();

function scheduleUpload(filename: string): void {
  const existing = pendingUploads.get(filename);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    pendingUploads.delete(filename);
    uploadFile(filename).catch((err) =>
      console.error(`[PERSISTENCE] Failed to upload ${filename}:`, err)
    );
  }, 1500);
  pendingUploads.set(filename, t);
}

export async function initPersistence(): Promise<void> {
  if (!useDb) {
    console.log("[PERSISTENCE] DATABASE_URL not set — using local files (data will be lost on redeploy).");
    return;
  }

  console.log("[PERSISTENCE] Initializing Postgres-backed persistence...");
  await ensureSchema();

  // Pull every existing key from DB → write as files
  const downloaded = await downloadAll();
  console.log(`[PERSISTENCE] Hydrated ${downloaded.size} file(s) from Postgres.`);

  // Seed: any JSON file in DATA_DIR not yet in DB → upload
  if (existsSync(DATA_DIR)) {
    for (const name of readdirSync(DATA_DIR)) {
      const full = join(DATA_DIR, name);
      if (!statSync(full).isFile() || !name.endsWith(".json")) continue;
      if (!downloaded.has(name)) {
        await uploadFile(name);
        console.log(`[PERSISTENCE] Seeded ${name} from repo into Postgres.`);
      }
    }
  }

  // Watch for any future writes to the data dir → push to Postgres
  if (existsSync(DATA_DIR)) {
    watch(DATA_DIR, { persistent: false }, (event, filename) => {
      if (!filename) return;
      const name = basename(filename);
      if (!name.endsWith(".json")) return;
      const filePath = join(DATA_DIR, name);
      if (!existsSync(filePath)) return;
      scheduleUpload(name);
    });
    console.log(`[PERSISTENCE] Watching ${DATA_DIR} for changes.`);
  }
}

export async function flushAll(): Promise<void> {
  if (!useDb) return;
  for (const [filename, t] of pendingUploads) {
    clearTimeout(t);
    pendingUploads.delete(filename);
    await uploadFile(filename).catch((err) =>
      console.error(`[PERSISTENCE] Final flush failed for ${filename}:`, err)
    );
  }
}

export function isUsingDatabase(): boolean {
  return useDb;
}

export async function pingDb(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  if (!useDb) return { ok: false, error: "DATABASE_URL not set" };
  try {
    const start = Date.now();
    await getPool().query("SELECT 1");
    return { ok: true, latencyMs: Date.now() - start };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
