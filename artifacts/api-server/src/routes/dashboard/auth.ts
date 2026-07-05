import { Router, type IRouter } from "express";
import { isOwner } from "../../lib/ownerIds.js";
import { logger } from "../../lib/logger.js";

const router: IRouter = Router();

// POST /api/dashboard/auth/login
// Body: { discordId: string, password: string }
router.post("/login", async (req, res): Promise<void> => {
  const { discordId, password } = req.body as {
    discordId?: string;
    password?: string;
  };

  const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;
  if (!DASHBOARD_PASSWORD) {
    res.status(500).json({ error: "DASHBOARD_PASSWORD is not configured on the server." });
    return;
  }

  if (!discordId || !password) {
    res.status(400).json({ error: "Discord ID and password are required." });
    return;
  }

  const id = discordId.trim();

  // Both checks must pass — wrong ID or wrong password gives the same generic error
  // so an attacker can't tell which field was wrong.
  if (!isOwner(id) || password !== DASHBOARD_PASSWORD) {
    logger.warn({ discordId: id }, "Failed dashboard login attempt");
    res.status(401).json({ error: "Invalid credentials." });
    return;
  }

  // Store auth data in session.
  req.session.userId = id;
  req.session.username = id;
  req.session.globalName = null;
  req.session.avatar = null;
  req.session.accessLevel = "Lowo Owner";

  // Explicitly save so the cookie is written before we respond.
  // If the store fails (e.g. Postgres unreachable) we still return 200 —
  // the session lives in memory for this server lifetime.
  req.session.save((saveErr) => {
    if (saveErr) {
      logger.warn({ saveErr }, "Session save to store failed — session is memory-only");
    }
    logger.info({ discordId: id }, "Successful dashboard login");
    res.json({ ok: true });
  });
});

// GET /api/dashboard/auth/me — return current session user
router.get("/me", (req, res): void => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({
    id: req.session.userId,
    username: req.session.username,
    globalName: req.session.globalName ?? null,
    avatar: req.session.avatar ?? null,
    accessLevel: req.session.accessLevel ?? "Lowo Owner",
    permissions: "FULL CONTROL",
  });
});

// POST /api/dashboard/auth/logout
router.post("/logout", (req, res): void => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true, message: "Logged out" });
  });
});

export default router;
