import type { IncomingMessage, ServerResponse } from "http";
import { getPool } from "../persistence.js";

const CLIENT_ID = process.env.DISCORD_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET ?? "";
const REDIRECT_URI = process.env.OAUTH_REDIRECT_URI ?? "";

function basicAuth(): string {
  return Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
}

interface DiscordRole { id: string; name: string; }

async function getGuildRoles(guildId: string, botToken: string): Promise<DiscordRole[]> {
  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (!res.ok) return [];
    return (await res.json()) as DiscordRole[];
  } catch { return []; }
}

function sendHtml(res: ServerResponse, status: number, title: string, body: string, isSuccess = false): void {
  const accentColor = isSuccess ? "#00ffff" : status >= 500 ? "#ff4444" : "#ffaa00";
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${title} — Last Stand</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{
      background:#0d0e10;
      color:#e0e0e0;
      font-family:'Inter',system-ui,sans-serif;
      display:flex;align-items:center;justify-content:center;
      min-height:100vh;padding:1.5rem;
    }
    .wrap{max-width:420px;width:100%;text-align:center}
    .clan{font-size:.75rem;font-weight:700;letter-spacing:.2em;color:${accentColor};
          margin-bottom:2rem;opacity:.7;text-transform:uppercase}
    .card{
      background:#16181c;
      border-radius:16px;
      padding:2.5rem 2rem;
      border:1px solid ${accentColor}33;
      box-shadow:0 0 60px ${accentColor}0d;
    }
    .icon{font-size:2.5rem;margin-bottom:1.2rem;display:block}
    h1{font-size:1.4rem;font-weight:700;color:#fff;margin-bottom:.75rem;line-height:1.3}
    p{line-height:1.65;color:#8a8f9a;font-size:.95rem}
    p strong{color:#c9cdd6}
    .divider{height:1px;background:${accentColor}22;margin:1.5rem 0}
    .hint{font-size:.8rem;color:#555;margin-top:1.5rem}
    a{color:${accentColor};text-decoration:none}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="clan">Last Stand</div>
    <div class="card">
      <span class="icon">${isSuccess ? "✅" : status >= 500 ? "⚠️" : "❌"}</span>
      <h1>${title}</h1>
      <div class="divider"></div>
      <p>${body}</p>
    </div>
    <div class="hint">Need help? Contact <strong>EoN</strong></div>
  </div>
</body>
</html>`;
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function sendConfirmPage(res: ServerResponse, code: string, guildId: string): void {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Verify — Last Stand</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{
      background:#0d0e10;
      color:#e0e0e0;
      font-family:'Inter',system-ui,sans-serif;
      display:flex;align-items:center;justify-content:center;
      min-height:100vh;padding:1.5rem;
    }
    .wrap{max-width:420px;width:100%;text-align:center}
    .clan{font-size:.75rem;font-weight:700;letter-spacing:.2em;color:#00ffff;
          margin-bottom:2rem;opacity:.7;text-transform:uppercase}
    .card{
      background:#16181c;
      border-radius:16px;
      padding:2.5rem 2rem;
      border:1px solid #00ffff33;
      box-shadow:0 0 60px #00ffff0d;
    }
    .icon{font-size:2.5rem;margin-bottom:1.2rem;display:block}
    h1{font-size:1.4rem;font-weight:700;color:#fff;margin-bottom:.75rem;line-height:1.3}
    p{line-height:1.65;color:#8a8f9a;font-size:.95rem;margin-bottom:1.75rem}
    .divider{height:1px;background:#00ffff22;margin:1.5rem 0}
    .buttons{display:flex;gap:.75rem;justify-content:center}
    button{
      flex:1;
      padding:.75rem 1rem;
      border:none;
      border-radius:10px;
      font-family:inherit;
      font-size:1rem;
      font-weight:700;
      cursor:pointer;
      transition:opacity .15s;
    }
    button:hover{opacity:.85}
    .yes{background:#00ffff;color:#0d0e10}
    .no{background:#1e2027;color:#8a8f9a;border:1px solid #2a2d35}
    .hint{font-size:.8rem;color:#555;margin-top:1.5rem}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="clan">Last Stand</div>
    <div class="card">
      <span class="icon">🛡️</span>
      <h1>Do you want to verify?</h1>
      <div class="divider"></div>
      <p>This will grant you access to the Last Stand server as a verified member.</p>
      <div class="buttons">
        <form method="POST" action="/api/oauth/confirm" style="flex:1">
          <input type="hidden" name="code" value="${escapeHtml(code)}"/>
          <input type="hidden" name="guild_id" value="${escapeHtml(guildId)}"/>
          <button type="submit" class="yes">✅ Yes</button>
        </form>
        <form method="GET" action="/api/oauth/cancel" style="flex:1">
          <button type="submit" class="no">❌ No</button>
        </form>
      </div>
    </div>
    <div class="hint">Need help? Contact <strong>EoN</strong></div>
  </div>
</body>
</html>`;
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── GET /api/oauth/callback ────────────────────────────────────────────────
// Shows the "Do you want to verify?" confirmation page.
export async function handleOAuthCallback(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? "/", `https://${req.headers.host}`);
  const code = url.searchParams.get("code");
  const guildId = url.searchParams.get("state");

  if (!code) {
    sendHtml(res, 400, "Verification Failed", "Something didn't go right. Head back to the server and try again.");
    return;
  }
  if (!guildId) {
    sendHtml(res, 400, "Invalid Link", "This verification link isn't valid. Ask an admin to re-post the verification panel.");
    return;
  }
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    sendHtml(res, 500, "Something Went Wrong", "Verification isn't set up correctly on our end. Contact <strong>EoN</strong>.");
    return;
  }

  sendConfirmPage(res, code, guildId);
}

// ── POST /api/oauth/confirm ────────────────────────────────────────────────
// Called when the user clicks "Yes" — performs the full verification flow.
export async function handleOAuthConfirm(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    sendHtml(res, 500, "Something Went Wrong", "Verification isn't set up correctly on our end. Contact <strong>EoN</strong>.");
    return;
  }

  // Read POST body
  const body = await new Promise<string>((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => { data += chunk.toString(); });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });

  const params = new URLSearchParams(body);
  const code = params.get("code");
  const guildId = params.get("guild_id");

  if (!code || !guildId) {
    sendHtml(res, 400, "Verification Failed", "Something didn't go right. Head back to the server and try again.");
    return;
  }

  try {
    // 1. Exchange code for tokens
    const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth()}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      console.error("[OAUTH] Token exchange failed:", tokenRes.status, await tokenRes.text());
      sendHtml(res, 400, "Verification Failed", "Couldn't complete the verification. Try clicking Verify again, or contact <strong>EoN</strong> if it keeps happening.");
      return;
    }

    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    // 2. Get user identity
    const userRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userRes.ok) {
      sendHtml(res, 400, "Verification Failed", "Couldn't reach your Discord profile. Try again, or contact <strong>EoN</strong>.");
      return;
    }
    const user = (await userRes.json()) as { id: string; username: string };

    // 2b. Check if already verified for this guild
    if (process.env.DATABASE_URL) {
      try {
        const existing = await getPool().query(
          `SELECT 1 FROM auth_backups WHERE user_id = $1 AND guild_id = $2 LIMIT 1`,
          [user.id, guildId],
        );
        if ((existing.rowCount ?? 0) > 0) {
          sendHtml(res, 200, "Already verified.", "You're already verified in this server — no action needed.", true);
          return;
        }
      } catch {
        // DB check failed — proceed with normal verification flow
      }
    }

    // 3. Store token backup (per user + guild) — including IP and UA for admin panel
    const expiry = new Date(Date.now() + tokens.expires_in * 1000);
    const ipAddress =
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
      req.socket.remoteAddress ??
      null;
    const userAgent = (req.headers["user-agent"] as string | undefined) ?? null;

    if (process.env.DATABASE_URL) {
      try {
        await getPool().query(
          `INSERT INTO auth_backups (user_id, access_token, refresh_token, token_expiry, guild_id, ip_address, user_agent, verified_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT (user_id, guild_id) DO UPDATE
           SET access_token  = EXCLUDED.access_token,
               refresh_token = EXCLUDED.refresh_token,
               token_expiry  = EXCLUDED.token_expiry,
               ip_address    = EXCLUDED.ip_address,
               user_agent    = EXCLUDED.user_agent,
               verified_at   = NOW()`,
          [user.id, tokens.access_token, tokens.refresh_token, expiry.toISOString(), guildId, ipAddress, userAgent],
        );
      } catch (dbErr) {
        console.error("[OAUTH] DB insert failed (verification still proceeds):", dbErr);
      }
    }

    const botToken = process.env.DISCORD_BOT_TOKEN ?? process.env.DISCORD_TOKEN ?? "";

    // 4. Look up roles by name so it works on any server
    const roles = await getGuildRoles(guildId, botToken);
    const memberRole = roles.find(
      (r) => r.name.toLowerCase() === "clan members" || r.name.toLowerCase() === "member",
    );
    const unverifiedRole = roles.find((r) => r.name.toLowerCase() === "unverified");

    // 5. Add user to guild
    const addBody: Record<string, unknown> = { access_token: tokens.access_token };
    if (memberRole) addBody.roles = [memberRole.id];

    const addRes = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${user.id}`,
      {
        method: "PUT",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(addBody),
      },
    );

    if (addRes.ok || addRes.status === 201 || addRes.status === 204) {
      if (memberRole) {
        await fetch(
          `https://discord.com/api/v10/guilds/${guildId}/members/${user.id}/roles/${memberRole.id}`,
          { method: "PUT", headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" }, body: "{}" },
        ).catch(() => {});
      }
      if (unverifiedRole) {
        await fetch(
          `https://discord.com/api/v10/guilds/${guildId}/members/${user.id}/roles/${unverifiedRole.id}`,
          { method: "DELETE", headers: { Authorization: `Bot ${botToken}` } },
        ).catch(() => {});
      }
    }

    console.log(`[OAUTH] Verified ${user.username} (${user.id}) for guild ${guildId}`);
    sendHtml(res, 200, "You're verified.", "Head back to the server — you're good to go.", true);
  } catch (err) {
    console.error("[OAUTH] Unexpected error:", err);
    sendHtml(res, 500, "Something Went Wrong", "Something on our end went wrong. Contact <strong>EoN</strong> and let them know.");
  }
}

// ── GET /api/oauth/cancel ──────────────────────────────────────────────────
// Called when the user clicks "No".
export function handleOAuthCancel(_req: IncomingMessage, res: ServerResponse): void {
  sendHtml(res, 200, "Verification Cancelled", "No problem — you can verify any time by clicking the button in the server.");
}
