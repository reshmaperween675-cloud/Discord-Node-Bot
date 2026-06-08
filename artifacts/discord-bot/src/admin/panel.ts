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
  user_id:     string;
  guild_id:    string;
  token_expiry: Date;
  ip_address:  string | null;
  user_agent:  string | null;
  verified_at: Date | null;
}

export async function handleAdminPanel(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url   = new URL(req.url ?? "/", `https://${req.headers.host ?? "localhost"}`);
  const token = url.searchParams.get("token");

  if (token !== ADMIN_TOKEN) {
    res.writeHead(403, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>403 — Last Stand</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #060710;
      color: #e2e8f0;
      font-family: 'Inter', system-ui, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .orb {
      position: fixed;
      border-radius: 50%;
      filter: blur(80px);
      opacity: .15;
      pointer-events: none;
    }
    .o1 { width: 400px; height: 400px; background: radial-gradient(circle, #ff4444, transparent); top: -100px; left: -100px; }
    .o2 { width: 300px; height: 300px; background: radial-gradient(circle, #7c3aed, transparent); bottom: -80px; right: -80px; }
    .card {
      position: relative;
      z-index: 1;
      background: rgba(255,255,255,.035);
      backdrop-filter: blur(24px);
      border: 1px solid rgba(255,68,68,.15);
      border-radius: 20px;
      padding: 3rem 2.5rem;
      text-align: center;
      animation: fadeUp .4s cubic-bezier(.16,1,.3,1) both;
    }
    @keyframes fadeUp { from { opacity:0; transform: translateY(20px); } to { opacity:1; transform: translateY(0); } }
    .icon { font-size: 2.5rem; margin-bottom: 1rem; filter: drop-shadow(0 0 16px #ff444488); }
    h1 { font-size: 1.2rem; font-weight: 700; color: #ff6b6b; margin-bottom: .5rem; }
    p { color: #475569; font-size: .85rem; }
  </style>
</head>
<body>
  <div class="orb o1"></div>
  <div class="orb o2"></div>
  <div class="card">
    <div class="icon">🔒</div>
    <h1>403 — Access Denied</h1>
    <p>Invalid or missing token.</p>
  </div>
</body>
</html>`);
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

  const now      = new Date();
  const active   = rows.filter((r) => new Date(r.token_expiry) > now).length;
  const guilds   = new Set(rows.map((r) => r.guild_id)).size;
  const ipsLogged = rows.filter((r) => r.ip_address).length;

  const tableRows = rows.map((r, i) => {
    const expired    = new Date(r.token_expiry) < now;
    const verifiedAt = r.verified_at
      ? new Date(r.verified_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })
      : "—";
    const ua  = r.user_agent ? esc(r.user_agent.slice(0, 90)) : "—";
    const ip  = r.ip_address ? esc(r.ip_address) : "—";
    const statusClass = expired ? "badge-expired" : "badge-active";
    const statusText  = expired ? "Expired" : "Active";
    const delay = Math.min(i * 18, 400);
    return `<tr style="animation-delay:${delay}ms">
      <td><code class="id-code">${esc(r.user_id)}</code></td>
      <td><code class="id-code">${esc(r.guild_id)}</code></td>
      <td class="mono">${verifiedAt}</td>
      <td class="mono">${ip}</td>
      <td class="ua" title="${esc(r.user_agent ?? "")}">${ua}</td>
      <td><span class="${statusClass}">${statusText}</span></td>
    </tr>`;
  }).join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Last Stand — Admin Panel</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --cyan:  #00ffff;
      --bg:    #060710;
      --surface: rgba(255,255,255,.035);
      --border:  rgba(255,255,255,.07);
      --text:  #e2e8f0;
      --muted: #475569;
    }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Inter', system-ui, sans-serif;
      min-height: 100vh;
      padding: 2.5rem 2rem 4rem;
      overflow-x: hidden;
    }

    /* Background orbs */
    .orb {
      position: fixed;
      border-radius: 50%;
      filter: blur(100px);
      opacity: .12;
      pointer-events: none;
      z-index: 0;
      animation: drift linear infinite;
    }
    .o1 { width: 600px; height: 600px; background: radial-gradient(circle, #00ffff, transparent); top: -200px; left: -200px; animation-duration: 20s; }
    .o2 { width: 500px; height: 500px; background: radial-gradient(circle, #7c3aed, transparent); bottom: -150px; right: -150px; animation-duration: 25s; animation-direction: reverse; }
    @keyframes drift {
      0%,100% { transform: translate(0,0) scale(1); }
      50%      { transform: translate(30px,-20px) scale(1.04); }
    }

    /* Layout */
    .container { position: relative; z-index: 1; max-width: 1200px; margin: 0 auto; }

    /* Header */
    .header { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 2.5rem; animation: fadeUp .45s cubic-bezier(.16,1,.3,1) both; }
    .header-left .eyebrow { font-size: .65rem; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; color: var(--cyan); opacity: .55; margin-bottom: .3rem; }
    .header-left h1 { font-size: 1.6rem; font-weight: 800; color: #fff; letter-spacing: -.02em; }
    .header-left h1 span { color: var(--cyan); }
    .header-right { font-size: .75rem; color: var(--muted); }

    @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }

    /* Stats row */
    .stats { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 2rem; animation: fadeUp .45s cubic-bezier(.16,1,.3,1) .1s both; }
    .stat {
      flex: 1;
      min-width: 130px;
      background: var(--surface);
      backdrop-filter: blur(20px);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1.1rem 1.4rem;
      position: relative;
      overflow: hidden;
      transition: border-color .2s;
    }
    .stat::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(0,255,255,.05), transparent);
      pointer-events: none;
    }
    .stat:hover { border-color: rgba(0,255,255,.25); }
    .stat-val { font-size: 2rem; font-weight: 800; color: var(--cyan); line-height: 1; letter-spacing: -.03em; }
    .stat-label { font-size: .68rem; color: var(--muted); margin-top: .3rem; font-weight: 500; letter-spacing: .06em; text-transform: uppercase; }
    .stat-icon { position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); font-size: 1.4rem; opacity: .15; }

    /* Error banner */
    .err-banner {
      background: rgba(255,68,68,.08);
      border: 1px solid rgba(255,68,68,.2);
      border-radius: 10px;
      padding: .9rem 1.2rem;
      color: #ff6b6b;
      font-size: .82rem;
      margin-bottom: 1.5rem;
      animation: fadeUp .45s cubic-bezier(.16,1,.3,1) .15s both;
    }

    /* Search */
    .search-bar {
      margin-bottom: 1.2rem;
      animation: fadeUp .45s cubic-bezier(.16,1,.3,1) .2s both;
    }
    .search-bar input {
      width: 100%;
      max-width: 380px;
      background: var(--surface);
      backdrop-filter: blur(20px);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: .6rem 1rem;
      color: var(--text);
      font-family: inherit;
      font-size: .85rem;
      outline: none;
      transition: border-color .2s, box-shadow .2s;
    }
    .search-bar input::placeholder { color: var(--muted); }
    .search-bar input:focus {
      border-color: rgba(0,255,255,.35);
      box-shadow: 0 0 0 3px rgba(0,255,255,.08);
    }

    /* Table */
    .table-wrap {
      background: var(--surface);
      backdrop-filter: blur(24px);
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
      animation: fadeUp .45s cubic-bezier(.16,1,.3,1) .25s both;
      box-shadow: 0 24px 60px rgba(0,0,0,.4), 0 0 0 1px rgba(0,255,255,.04) inset;
    }

    table { width: 100%; border-collapse: collapse; font-size: .8rem; }

    thead th {
      background: rgba(0,0,0,.25);
      color: var(--cyan);
      padding: .85rem 1.1rem;
      text-align: left;
      font-weight: 600;
      font-size: .68rem;
      letter-spacing: .1em;
      text-transform: uppercase;
      white-space: nowrap;
      border-bottom: 1px solid var(--border);
    }

    tbody tr {
      border-bottom: 1px solid rgba(255,255,255,.04);
      opacity: 0;
      animation: rowIn .35s cubic-bezier(.16,1,.3,1) forwards;
      transition: background .15s;
    }
    @keyframes rowIn { from { opacity:0; transform:translateX(-8px); } to { opacity:1; transform:translateX(0); } }

    tbody tr:hover { background: rgba(0,255,255,.03); }
    tbody tr:last-child { border-bottom: none; }

    td { padding: .6rem 1.1rem; color: #64748b; vertical-align: middle; }
    td:first-child { color: #94a3b8; }

    .id-code {
      font-family: 'JetBrains Mono', monospace;
      background: rgba(0,255,255,.07);
      border-radius: 5px;
      padding: .1em .4em;
      color: #7ecfff;
      font-size: .75rem;
    }

    .mono { font-family: 'JetBrains Mono', monospace; font-size: .76rem; }

    .ua { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .badge-active {
      display: inline-flex;
      align-items: center;
      gap: .3em;
      background: rgba(0,255,255,.1);
      color: #00ffff;
      border: 1px solid rgba(0,255,255,.2);
      border-radius: 20px;
      padding: .15em .7em;
      font-size: .72rem;
      font-weight: 600;
    }
    .badge-active::before { content: ''; width: 5px; height: 5px; background: #00ffff; border-radius: 50%; box-shadow: 0 0 6px #00ffff; }
    .badge-expired {
      display: inline-flex;
      align-items: center;
      gap: .3em;
      background: rgba(255,107,107,.08);
      color: #ff6b6b;
      border: 1px solid rgba(255,107,107,.2);
      border-radius: 20px;
      padding: .15em .7em;
      font-size: .72rem;
      font-weight: 600;
    }
    .badge-expired::before { content: ''; width: 5px; height: 5px; background: #ff6b6b; border-radius: 50%; }

    .empty {
      text-align: center;
      padding: 4rem 2rem;
      color: var(--muted);
      font-size: .9rem;
    }
    .empty-icon { font-size: 2rem; margin-bottom: .75rem; opacity: .35; }
  </style>
</head>
<body>
  <div class="orb o1"></div>
  <div class="orb o2"></div>

  <div class="container">
    <div class="header">
      <div class="header-left">
        <div class="eyebrow">Last Stand</div>
        <h1>Admin <span>Panel</span></h1>
      </div>
      <div class="header-right">
        OAuth2 Verification Log &nbsp;·&nbsp; refreshed ${new Date().toLocaleTimeString("en-GB")}
      </div>
    </div>

    <div class="stats">
      <div class="stat">
        <div class="stat-icon">👥</div>
        <div class="stat-val">${rows.length}</div>
        <div class="stat-label">Total Verified</div>
      </div>
      <div class="stat">
        <div class="stat-icon">⚡</div>
        <div class="stat-val">${active}</div>
        <div class="stat-label">Active Tokens</div>
      </div>
      <div class="stat">
        <div class="stat-icon">🌐</div>
        <div class="stat-val">${guilds}</div>
        <div class="stat-label">Servers</div>
      </div>
      <div class="stat">
        <div class="stat-icon">📍</div>
        <div class="stat-val">${ipsLogged}</div>
        <div class="stat-label">IPs Logged</div>
      </div>
    </div>

    ${dbError ? `<div class="err-banner">⚠️ Database error: ${esc(dbError)}</div>` : ""}

    <div class="search-bar">
      <input type="text" id="search" placeholder="🔍  Filter by Discord ID, server ID, or IP…" oninput="filterTable(this.value)"/>
    </div>

    <div class="table-wrap">
      ${rows.length === 0 ? `<div class="empty"><div class="empty-icon">📭</div>No verification records yet.</div>` : `
      <table id="tbl">
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
        <tbody id="tbody">${tableRows}</tbody>
      </table>`}
    </div>
  </div>

  <script>
    function filterTable(q) {
      const rows = document.querySelectorAll('#tbody tr');
      const term = q.toLowerCase();
      rows.forEach(r => {
        r.style.display = r.textContent.toLowerCase().includes(term) ? '' : 'none';
      });
    }
  </script>
</body>
</html>`;

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

export async function handleAbcdAdmin(message: Message): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!(message.member as GuildMember).permissions.has(PermissionFlagsBits.ManageGuild)) return;

  const host     = process.env.PUBLIC_HOST ?? process.env.RAILWAY_PUBLIC_DOMAIN ?? "last-stand.up.railway.app";
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
