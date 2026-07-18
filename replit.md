# mewo Discord Bot — Monorepo

## Project Overview

A pnpm monorepo containing a Discord bot and its supporting infrastructure.

| Artifact | Description |
|----------|-------------|
| `artifacts/discord-bot` | Main Discord bot (discord.js v14, TypeScript) — deployed on Railway |
| `artifacts/api-server` | Express API backend |
| `artifacts/control-center` | React/Vite control-center dashboard |
| `artifacts/db` | Shared Drizzle ORM database package |

## Working on the Discord Bot

The bot is deployed on **Railway** via Docker and must **not** be run on Replit.

The only allowed local command is:
```
pnpm --filter @workspace/discord-bot run typecheck
```

TypeScript must typecheck with 0 errors before any change is considered done.

## Running on Replit

- **API server**: `pnpm --filter @workspace/api-server run dev` (port 8080)
- **Control center**: `PORT=19463 BASE_PATH=/ pnpm --filter @workspace/control-center run dev` (port 19463)

## User Preferences

- Work on Discord bot code only (typecheck, no running the bot on Replit)
- Push to GitHub → Railway auto-deploys the bot
