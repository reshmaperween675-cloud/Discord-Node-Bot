# Last Stand / LOWO Control Center

A pnpm monorepo containing a Discord bot and its web-based control center dashboard.

## Architecture

| Package | Purpose |
|---|---|
| `artifacts/discord-bot` | discord.js v14 bot — deployed to Railway via Docker. **Do NOT run in Replit.** |
| `artifacts/api-server` | Express API server — serves all `/api/*` routes, handles Discord OAuth2 login, session auth |
| `artifacts/control-center` | React + Vite dashboard — Control Center UI, served at `/` |
| `lib/db` | Shared Drizzle ORM schema + pg pool |
| `lib/api-client-react` | Generated React Query hooks for the API |
| `lib/api-zod` | Generated Zod schemas |

## Running locally (Replit)

Two workflows run side by side:
- **Control Center** (`artifacts/control-center: web`) — Vite dev server on port 19463
- **API Server** (`artifacts/api-server: API Server`) — Express on port 8080

The Replit path proxy routes `/api/*` → API server and `/` → Control Center.

Login uses Discord OAuth2. After login, only users whose Discord ID is in `LOWO_OWNER_ID` get owner-level access.

## Discord bot

The bot lives in `artifacts/discord-bot/src/`. It is deployed separately on Railway.

**Only allowed local command:**
```
pnpm --filter @workspace/discord-bot run typecheck
```

## Required secrets / env vars

| Key | Where to get it |
|---|---|
| `SESSION_SECRET` | Any random string (already set) |
| `DATABASE_URL` | Auto-provisioned by Replit |
| `DISCORD_CLIENT_ID` | Discord Developer Portal |
| `DISCORD_CLIENT_SECRET` | Discord Developer Portal |
| `LOWO_OWNER_ID` | Your Discord user ID |

Railway also needs: `DISCORD_BOT_TOKEN`, `DANBOORU_*`, `OAUTH_REDIRECT_URI`, etc.

## Schema

Push the Drizzle schema to the Replit dev database:
```
pnpm --filter @workspace/db run push --force
```

## User preferences

- Do not run the discord bot in Replit — no workflows, no `pnpm run dev` for the bot
- The bot is deployed on Railway via Docker
