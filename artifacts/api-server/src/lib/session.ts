import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { randomBytes } from "node:crypto";
import { pool } from "@workspace/db";

const PgStore = connectPgSimple(session);

const SECRET = process.env.SESSION_SECRET ?? (() => {
  console.warn(
    "[SESSION] SESSION_SECRET is not set — generating a random secret. " +
    "Sessions will not survive restarts. Set SESSION_SECRET in Railway env vars."
  );
  return randomBytes(32).toString("hex");
})();

// Build PgStore and immediately probe the DB. If the probe fails, fall back to
// MemoryStore so the API server starts cleanly even if Postgres is unavailable.
async function makeStore(): Promise<session.Store | undefined> {
  try {
    // Quick connectivity check — if this fails, skip PgStore entirely.
    await pool.query("SELECT 1");

    const store = new PgStore({
      pool,
      tableName: "dashboard_sessions",
      createTableIfMissing: true,
    });

    // Swallow store-level errors so a broken DB doesn't crash the process.
    (store as unknown as { on: (e: string, fn: (err: Error) => void) => void })
      .on?.("error", (err) => {
        console.warn("[SESSION] PgStore error:", err.message);
      });

    console.log("[SESSION] Using PostgreSQL session store (dashboard_sessions).");
    return store;
  } catch (err) {
    console.warn(
      "[SESSION] Could not reach DB — falling back to in-memory session store. " +
      "Sessions will not survive restarts.",
      err
    );
    return undefined; // express-session defaults to MemoryStore
  }
}

// Export an async factory so app.ts can await the store before attaching middleware.
export async function buildSessionMiddleware(): Promise<ReturnType<typeof session>> {
  const store = await makeStore();
  return session({
    store,
    secret: SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: "lax",
    },
  });
}

// Extend session type
declare module "express-session" {
  interface SessionData {
    userId: string;
    username: string;
    globalName: string | null;
    avatar: string | null;
    accessLevel: string;
  }
}
