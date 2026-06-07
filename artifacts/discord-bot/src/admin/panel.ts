import type { IncomingMessage, ServerResponse } from "http";
import { Message, PermissionFlagsBits, GuildMember, TextChannel } from "discord.js";
import { getPool } from "../persistence.js";

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let t = "";
  for (let i = 0; i < 40; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}

export const ADMIN_TOKEN: string =
  process.env.ADMIN_PANEL_TOKEN ?? generateToken();

export function logAdminToken(): void {
  if (!process.env.ADMIN_PANEL_TOKEN) {
    console.log(`[ADMIN] Auto-generated panel token: ${ADMIN_TOKEN}`);
    console.log(`[ADMIN] Set ADMIN_PANEL_TOKEN in Railway env to keep it stable across restarts.`);
  }
}

function esc(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

interface VerifiedRow {
  user_id: string;
  guild_id: string;
  token_expiry: Date;
  ip_address: string | null;
  user_agent: string | null;
  verified_at: Date | null;
}

export async function handleAdminPanel(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? "/", `https://${req.headers.host ?? "localhost"}`);
  const token = url.searchParams.get("token");

  if (token !== ADMIN_TOKEN) {
    res.writeHead(403, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!DOCTYPE html><html><head><title>403</title><style>
      body{background:#0d0e10;color:#ff4444;font-family:monospace;
           display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
    </style></head><body><h2>403 — Access Denied</h2></body></html>`);
    return;
  }

  let rows: VerifiedRow[] = [];
  let dbError: string | null = null;

  try {
    const result = await getPool().query<VerifiedRow>(
      `SELECT user_id, guild_id, token_expiry, ip_address, user_agent, verified_at
       FROM auth_backups
       ORDER BY verified_at DESC NULLS LAST
       LIMIT 500`,
    );
    rows = result.rows;
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  const now = new Date();
  const active = rows.filter((r) => new Date(r.token_expiry) > now).length;
  const guilds = new Set(rows.map((r) => r.guild_id)).size;
  const ipsLogged = rows.filter((r) => r.ip_address).length;

  const tableRows = rows
    .map((r) => {
      const expired = new Date(r.token_expiry) < now;
      const verifiedAt = r.verified_at
        ? new Date(r.verified_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })
        : "—";
      const ua = r.user_agent ? esc(r.user_agent.slice(0, 90)) : "—";
      const ip = r.ip_address ? esc(r.ip_address) : "—";
      const status = expired
        ? `<span style="color:#ff6b6b">Expired</span>`
        : `<span style="color:#00ffff">Active</span>`;
      return `<tr>
        <td><code>${esc(r.user_id)}</code></td>
        <td><code>${esc(r.guild_id)}</code></td>
        <td>${verifiedAt}</td>
        <td>${ip}</td>
        <td class="ua" title="${esc(r.user_agent ?? "")}">${ua}</td>
        <td>${status}</td>
      </tr>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Last Stand — Admin Panel</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0d0e10;color:#e0e0e0;font-family:'Inter',system-ui,sans-serif;padding:2rem 2.5rem}
    h1{color:#00ffff;font-size:1.3rem;font-weight:700;letter-spacing:.08em;margin-bottom:.2rem}
    .sub{color:#444;font-size:.8rem;margin-bottom:2rem}
    .stats{display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:2rem}
    .stat{background:#16181c;border:1px solid #00ffff1a;border-radius:10px;
          padding:.9rem 1.4rem;min-width:110px}
    .stat-val{font-size:1.6rem;font-weight:700;color:#00ffff}
    .stat-label{font-size:.7rem;color:#555;margin-top:.15rem;letter-spacing:.05em;text-transform:uppercase}
    .err{background:#ff444415;border:1px solid #ff4444;border-radius:8px;
         padding:.9rem 1.2rem;color:#ff6b6b;margin-bottom:1.5rem;font-size:.85rem}
    table{width:100%;border-collapse:collapse;font-size:.82rem}
    thead th{background:#16181c;color:#00ffff;padding:.6rem 1rem;text-align:left;
             border-bottom:1px solid #00ffff22;font-weight:600;letter-spacing:.04em;
             white-space:nowrap}
    td{padding:.5rem 1rem;border-bottom:1px solid #1a1c20;color:#9a9da8;vertical-align:middle}
    tr:hover td{background:#131417}
    code{background:#1e2025;border-radius:4px;padding:.1em .4em;color:#7ecfff;font-size:.78rem}
    .ua{max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .empty{color:#333;padding:3rem;text-align:center;font-size:.9rem}
  </style>
</head>
<body>
  <h1>LAST STAND — ADMIN PANEL</h1>
  <div class="sub">OAuth2 Verification Log · ${rows.length} record${rows.length !== 1 ? "s" : ""} · refreshed ${new Date().toLocaleTimeString("en-GB")}</div>

  ${dbError ? `<div class="err">⚠️ Database error: ${esc(dbError)}</div>` : ""}

  <div class="stats">
    <div class="stat"><div class="stat-val">${rows.length}</div><div class="stat-label">Total Verified</div></div>
    <div class="stat"><div class="stat-val">${active}</div><div class="stat-label">Active Tokens</div></div>
    <div class="stat"><div class="stat-val">${guilds}</div><div class="stat-label">Servers</div></div>
    <div class="stat"><div class="stat-val">${ipsLogged}</div><div class="stat-label">IPs Logged</div></div>
  </div>

  ${
    rows.length === 0
      ? `<p class="empty">No verification records yet.</p>`
      : `<table>
    <thead>
      <tr>
        <th>Discord ID</th>
        <th>Server ID</th>
        <th>Verified At</th>
        <th>IP Address</th>
        <th>User Agent</th>
        <th>Token</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>`
  }
</body>
</html>`;

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

export async function handleAbcdAdmin(message: Message): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!(message.member as GuildMember).permissions.has(PermissionFlagsBits.ManageGuild)) return;

  const host = process.env.PUBLIC_HOST ?? process.env.RAILWAY_PUBLIC_DOMAIN ?? "last-stand.up.railway.app";
  const panelUrl = `https://${host}/admin/panel?token=${ADMIN_TOKEN}`;

  try {
    await message.author.send(
      `🛡️ **Last Stand — Admin Panel**\n\n${panelUrl}\n\n⚠️ Keep this link private — it gives full access to verification logs.`,
    );
  } catch {
    await (message.channel as TextChannel).send({
      content: `<@${message.author.id}> Couldn't DM you — enable DMs from server members and try again.`,
    });
  }

  await message.delete().catch(() => {});
}
