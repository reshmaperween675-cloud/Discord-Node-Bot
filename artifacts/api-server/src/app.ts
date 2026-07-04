import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { sessionMiddleware } from "./lib/session.js";

const app: Express = express();

// Trust the Replit/Railway reverse proxy so secure session cookies are set correctly
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

// ── Legal pages (required by Discord Developer Portal) ────────────────────

const STYLE = `
  body { margin: 0; background: #0f0f0f; color: #e0e0e0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .wrap { max-width: 780px; margin: 0 auto; padding: 60px 24px 80px; }
  h1 { font-size: 2rem; color: #fff; margin-bottom: 6px; }
  .sub { color: #888; font-size: 0.9rem; margin-bottom: 40px; }
  h2 { font-size: 1.15rem; color: #c0c0c0; margin-top: 36px; margin-bottom: 8px; }
  p, li { line-height: 1.7; color: #c8c8c8; font-size: 0.97rem; }
  ul { padding-left: 20px; }
  a { color: #7289da; text-decoration: none; }
  a:hover { text-decoration: underline; }
  hr { border: none; border-top: 1px solid #222; margin: 40px 0; }
`;

app.get("/terms", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html><html lang="en"><head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Terms of Service — Last Stand Bot</title>
    <style>${STYLE}</style>
  </head><body><div class="wrap">
    <h1>Terms of Service</h1>
    <p class="sub">Last Stand Discord Bot &nbsp;·&nbsp; Effective: 1 June 2025</p>

    <h2>1. Acceptance</h2>
    <p>By adding Last Stand Bot ("the Bot") to your Discord server or using any of its commands, you agree to these Terms of Service. If you do not agree, remove the Bot from your server immediately.</p>

    <h2>2. Eligibility</h2>
    <p>You must comply with <a href="https://discord.com/terms" target="_blank">Discord's Terms of Service</a> and be at least 13 years old (or the minimum age in your jurisdiction) to use the Bot.</p>

    <h2>3. Permitted Use</h2>
    <ul>
      <li>The Bot is provided for entertainment and server-management purposes within Discord.</li>
      <li>NSFW features are only accessible in channels marked as age-restricted by Discord.</li>
      <li>You may not use the Bot to harass, threaten, or harm others.</li>
      <li>You may not attempt to reverse-engineer, exploit, or abuse the Bot or its data.</li>
    </ul>

    <h2>4. Data</h2>
    <p>The Bot stores minimal data necessary to operate (e.g. server configuration, user activity counters). See our <a href="/privacy">Privacy Policy</a> for details. We do not sell your data.</p>

    <h2>5. Availability</h2>
    <p>The Bot is provided "as is" with no uptime guarantee. We may modify or discontinue features at any time without notice.</p>

    <h2>6. Limitation of Liability</h2>
    <p>The Bot operators are not liable for any damages arising from use or inability to use the Bot. Use it at your own risk.</p>

    <h2>7. Changes</h2>
    <p>We may update these Terms at any time. Continued use of the Bot after changes constitutes acceptance of the new Terms.</p>

    <h2>8. Contact</h2>
    <p>Questions? Reach us via the official Last Stand Discord server.</p>
  </div></body></html>`);
});

app.get("/privacy", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html><html lang="en"><head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Privacy Policy — Last Stand Bot</title>
    <style>${STYLE}</style>
  </head><body><div class="wrap">
    <h1>Privacy Policy</h1>
    <p class="sub">Last Stand Discord Bot &nbsp;·&nbsp; Effective: 1 June 2025</p>

    <h2>1. What We Collect</h2>
    <ul>
      <li><strong>Server configuration</strong> — antinuke settings, NSFW toggle, role/channel snapshots you explicitly create with <code>?copy</code>.</li>
      <li><strong>Activity counters</strong> — message counts and last-active timestamps per user, used for leaderboards.</li>
      <li><strong>OAuth2 tokens</strong> — if you authenticate via Discord OAuth (e.g. for admin panel access), your access token and refresh token are stored encrypted in our database and used only to act on your behalf.</li>
    </ul>

    <h2>2. What We Do Not Collect</h2>
    <ul>
      <li>Message content (the Bot reads commands but does not log or store message text).</li>
      <li>Voice audio.</li>
      <li>Private/DM message content.</li>
      <li>Passwords or payment information of any kind.</li>
    </ul>

    <h2>3. How We Use Data</h2>
    <p>Collected data is used exclusively to operate the Bot's features within your server. We do not sell, rent, or share your data with third parties.</p>

    <h2>4. Data Retention</h2>
    <p>Configuration data is retained until you remove the Bot from your server or explicitly delete it via Bot commands. Activity counters are retained indefinitely unless you request deletion.</p>

    <h2>5. Data Deletion</h2>
    <p>To request deletion of all data associated with your server or account, contact us through the official Last Stand Discord server and we will process your request within 7 days.</p>

    <h2>6. Security</h2>
    <p>Data is stored in a private PostgreSQL database hosted on Railway. Access is restricted to Bot operators only. We use TLS for all connections.</p>

    <h2>7. Third-Party Services</h2>
    <p>The Bot fetches content from public image boards (Danbooru, Gelbooru, Rule34, etc.) for NSFW features. No personal data is sent to these services.</p>

    <h2>8. Changes</h2>
    <p>We may update this policy at any time. Continued use of the Bot constitutes acceptance.</p>

    <h2>9. Contact</h2>
    <p>For privacy requests or questions, reach us through the official Last Stand Discord server.</p>
  </div></body></html>`);
});

app.use("/api", router);

export default app;
