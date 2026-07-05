import session from "express-session";
import { randomBytes } from "node:crypto";

const SECRET = process.env.SESSION_SECRET ?? (() => {
  console.warn(
    "[SESSION] SESSION_SECRET is not set — generating a random secret. " +
    "Sessions will not survive restarts. Set SESSION_SECRET in Railway env vars."
  );
  return randomBytes(32).toString("hex");
})();

// MemoryStore — no database dependency.
// Sessions live until the process restarts, which is fine for a single-owner dashboard.
export function buildSessionMiddleware(): ReturnType<typeof session> {
  return session({
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
