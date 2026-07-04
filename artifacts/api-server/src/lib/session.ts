import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";

const PgStore = connectPgSimple(session);

const SECRET = process.env.SESSION_SECRET;
if (!SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}

export const sessionMiddleware = session({
  store: new PgStore({
    pool,
    tableName: "dashboard_sessions",
    createTableIfMissing: true,
  }),
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
    oauthState?: string;
  }
}
