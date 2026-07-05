import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { isOwner } from "../../lib/ownerIds.js";
import { logger } from "../../lib/logger.js";

const router: IRouter = Router();

const CLIENT_ID = process.env.DISCORD_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET ?? "";

function getRedirectUri(req: import("express").Request): string {
  // Support both Railway and Replit deployments
  const host = (req.headers["x-forwarded-host"] as string) || (req.headers.host as string);
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  return `${proto}://${host}/api/dashboard/auth/callback`;
}

// GET /api/dashboard/auth/login — redirect to Discord OAuth2
router.get("/login", (req, res): void => {
  if (!CLIENT_ID) {
    res.status(500).json({ error: "DISCORD_CLIENT_ID not configured" });
    return;
  }
  // Generate CSRF state token and store in session
  const state = randomBytes(24).toString("hex");
  req.session.oauthState = state;

  const redirectUri = encodeURIComponent(getRedirectUri(req));
  const scope = encodeURIComponent("identify");
  const url = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`;
  res.redirect(url);
});

// GET /api/dashboard/auth/callback — OAuth2 callback
router.get("/callback", async (req, res): Promise<void> => {
  const { code, state } = req.query;

  // Validate CSRF state
  const expectedState = req.session.oauthState;
  if (!state || !expectedState || state !== expectedState) {
    res.status(400).send(authPage("Error", "Invalid OAuth state — possible CSRF attempt."));
    return;
  }
  // Consume state — one use only
  delete req.session.oauthState;

  if (!code || typeof code !== "string") {
    res.status(400).send(authPage("Error", "No authorization code received."));
    return;
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    res.status(500).send(authPage("Error", "Discord OAuth not configured."));
    return;
  }

  const redirectUri = getRedirectUri(req);

  try {
    // Exchange code for access token
    const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      logger.error({ status: tokenRes.status, err }, "Discord token exchange failed");
      res.status(400).send(authPage("Error", "Failed to exchange authorization code."));
      return;
    }

    const tokens = (await tokenRes.json()) as { access_token: string };

    // Fetch user info
    const userRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userRes.ok) {
      res.status(400).send(authPage("Error", "Failed to fetch user info."));
      return;
    }

    const user = (await userRes.json()) as {
      id: string;
      username: string;
      global_name?: string;
      avatar?: string;
    };

    // Verify owner
    if (!isOwner(user.id)) {
      logger.warn({ userId: user.id, username: user.username }, "Unauthorized dashboard login attempt");
      res.status(403).send(authPage("Access Denied", "You are not authorized to access this dashboard. Only Lowo Owners are permitted."));
      return;
    }

    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.globalName = user.global_name ?? null;
    req.session.avatar = user.avatar ?? null;
    req.session.accessLevel = "Lowo Owner";

    logger.info({ userId: user.id, username: user.username }, "Successful dashboard login");

    // Redirect to dashboard
    res.redirect("/dashboard");
  } catch (err) {
    logger.error({ err }, "OAuth callback error");
    res.status(500).send(authPage("Error", "Internal server error during authentication."));
  }
});

// GET /api/dashboard/auth/me — return current user
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

function authPage(title: string, message: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${title} — Control Center</title>
  <style>body{margin:0;background:#0a0a0f;color:#e0e0e0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
  .box{text-align:center;padding:2rem}h1{color:#fff;font-size:1.5rem}p{color:#999;margin-top:.5rem}a{color:#5865f2;text-decoration:none}</style>
  </head><body><div class="box"><h1>${title}</h1><p>${message}</p><p style="margin-top:1rem"><a href="/dashboard">Back to Control Center</a></p></div></body></html>`;
}

export default router;
