---
name: Chatbot feature
description: AI chatbot in src/chatbot/ — architecture, hook points, DB tables, env vars, commands
---

## Architecture
8 files in `artifacts/discord-bot/src/chatbot/`:
- `config.ts` — per-guild config (enabledChannels, ignoredUsers, respondRate, model, botName, customPrompt)
- `memory.ts` — in-memory ring buffer + DB persistence for conversation, user memory, server memory
- `personality.ts` — system prompt builder (personality + server/user context)
- `engine.ts` — response decision engine (weighted probability, cooldowns, question detection)
- `ai.ts` — AI abstraction: OpenRouter → OpenAI → SambaNova → Groq fallback chain
- `vision.ts` — image understanding via vision model (gpt-4o)
- `typing.ts` — human-like typing delays with sendTyping indicator
- `commands.ts` — `?chatbot` management commands
- `index.ts` — main entry; hooked into lifecycle.ts

## Hook points in lifecycle.ts
1. `?chatbot` prefix check added BEFORE the Assyst handler (would have swallowed it)
2. Passive `handleChatbot(message)` call added after `runCustomModules` (non-blocking)

## DB tables (auto-created on first use)
- `chatbot_config` — per-guild settings
- `chatbot_memory` — user + server memory (JSONB)
- `chatbot_messages` — conversation history (last 500/channel, pruned automatically)

## Env vars
- `OPENROUTER_API_KEY` — primary (preferred, supports all models)
- Falls back to `OPENAI_API_KEY`, `SAMBANOVA_API_KEY`, `GROQ_API_KEY`

## Commands
`?chatbot enable/e` — enable in channel
`?chatbot disable/d` — disable in channel
`?chatbot status` — view config
`?chatbot respond <0-100>` — response rate
`?chatbot model <model>` — set model (OpenRouter model IDs)
`?chatbot name <name>` — persona name
`?chatbot prompt <text>` — custom personality
`?chatbot ignore/unignore @user`
`?chatbot memory [@user]` — view memory
`?chatbot clearmemory`

**Why:** `?chatbot` must be routed before assyst handler or assyst swallows it silently.
**How to apply:** Any new chatbot subcommands go in commands.ts switch block.
