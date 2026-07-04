import { Router, type IRouter } from "express";
import { db, botKvTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth.js";
import { logger } from "../../lib/logger.js";

const router: IRouter = Router();
router.use(requireAuth);

const BOT_KNOWLEDGE = `
The Lowo bot is a Node.js/TypeScript Discord bot using discord.js v14, deployed on Railway via Docker.

Key Systems:
- Leveling: XP tracking, rank cards (@napi-rs/canvas), level roles, leaderboards. Files: leveling/
- Lowo: Full OwO-style RPG (hunting, battles, gambling, economy, shop, forge, prestige). Files: lowo/
- Mewo: AI (ChatGPT/LLaMA), fun, utility, roleplay GIFs, games, search, tags. Files: mewo/
- Moderation: Kick, ban, mute, warn, purge, word censoring. Files: moderation/
- Anti-Nuke: Server protection with configurable thresholds. Files: antinuke/
- Raids: Raid session management, announcements, logging. Files: raids/
- Tournaments: Tournament creation, registration, management. Files: tournament/
- Training: Training session logging, MVP tracking. Files: training/
- Verification: Discord OAuth2 member verification. Files: verification/
- Economy: Balance, daily, weekly, work, rob, invest (standalone). Files: economy/

Database: PostgreSQL via Drizzle ORM. Tables: bot_kv (general KV store), leveling tables, economy_users, tournament_*, training_logs, warns, etc.

The bot stores dashboard overrides in bot_kv with keys like:
- dashboard:cmd:override:{name} — command enable/disable + description override
- dashboard:embed:{id} — embed text overrides
- dashboard:module:{name} — module enable/disable state
- dashboard:bot:presence — bot presence/status config
- dashboard:bot:heartbeat — bot writes this every 30s with online status, servers, users, ping, uptime

Entry point: artifacts/discord-bot/src/index.ts
Command registry: artifacts/discord-bot/src/bot/registry.ts
Lowo router: artifacts/discord-bot/src/lowo/router.ts
`;

router.post("/assistant", async (req, res): Promise<void> => {
  const { message, context } = req.body as { message: string; context?: string };
  if (!message?.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  try {
    // Try OpenAI if configured
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (OPENAI_KEY) {
      const prompt = `You are a helpful assistant for the Lowo Discord bot Control Center. Answer questions about the bot's systems, modules, commands, and codebase. Be concise and technical.

Bot knowledge base:
${BOT_KNOWLEDGE}

${context ? `Additional context: ${context}\n` : ""}
User question: ${message}`;

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 500,
          temperature: 0.3,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
        const reply = data.choices[0]?.message?.content ?? "No response generated.";
        res.json({ reply, sources: ["OpenAI GPT-4o-mini"] });
        return;
      }
    }

    // Fallback: rule-based answers
    const msg = message.toLowerCase();
    let reply = "I can help you understand the Lowo bot. Try asking about specific modules, commands, the database schema, or how to configure settings.";

    if (msg.includes("lowo") && (msg.includes("what") || msg.includes("how"))) {
      reply = "The Lowo system is a full OwO-style RPG with hunting, battles, economy, gambling, forge, prestige, aquarium, and more. It uses message-based prefix commands routed through `lowo/router.ts`. Data is stored in PostgreSQL via Drizzle ORM.";
    } else if (msg.includes("leveling") || msg.includes("xp")) {
      reply = "The leveling system tracks XP per message, generates rank cards using @napi-rs/canvas, supports level roles, and has leaderboards. Files are in `leveling/`. The main command handler is in `leveling/commands.ts`.";
    } else if (msg.includes("database") || msg.includes("db")) {
      reply = "The bot uses PostgreSQL via Drizzle ORM. The schema is defined in `lib/db/src/schema/index.ts`. Key tables: `bot_kv` (general KV store), `leveling_*`, `economy_users`, `dashboard_audit_logs`, `warns`, `tournaments`, and more.";
    } else if (msg.includes("embed")) {
      reply = "Embeds are created inline within command handlers. The Control Center stores overrides in `bot_kv` with keys like `dashboard:embed:{id}`. The bot checks these overrides at runtime to use custom text.";
    } else if (msg.includes("antinuke") || msg.includes("anti-nuke")) {
      reply = "Anti-Nuke monitors audit logs for mass bans, kicks, channel deletions, and role deletions. It's configured per-guild in `antinuke_config` table with customizable thresholds and a whitelist of trusted users.";
    } else if (msg.includes("error") || msg.includes("broken")) {
      reply = "For errors, check: 1) The audit logs page for recent changes, 2) The bot_kv table for `dashboard:bot:errors`, 3) Railway deployment logs. Common issues: missing env vars (DISCORD_BOT_TOKEN, DATABASE_URL), stale slash command registration.";
    } else if (msg.includes("command")) {
      reply = "Slash commands are registered in `bot/registry.ts` and deployed via the Discord API. Prefix commands (lowo/mewo) are routed through message handlers. Use the Command Manager to enable/disable commands or override descriptions without editing code.";
    }

    res.json({ reply, sources: ["Built-in knowledge base"] });
  } catch (err) {
    logger.error({ err }, "Assistant error");
    res.json({ reply: "I'm having trouble generating a response right now. Try again in a moment.", sources: [] });
  }
});

export default router;
