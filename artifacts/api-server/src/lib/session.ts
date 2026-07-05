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

// Try to use the Postgres session store; fall back to in-memory if it fails.
function makeStore(): session.Store | undefined {
  try {
    return new PgStore({
      pool,
      tableName: "dashboard_sessions",
      createTableIfMissing: true,
    });
  } catch (err) {
    console.warn("[SESSION] Failed to create PgStore — using in-memory store:", err);
    return undefined; // express-session defaults to MemoryStore
  }
}

export const sessionMiddleware = session({
  store: makeStore(),
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
