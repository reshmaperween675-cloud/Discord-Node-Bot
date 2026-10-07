# Agent Prompt — Continue Building the mewo System

## Project Context

This is a **Node.js/TypeScript Discord bot** using **discord.js v14** and **pnpm monorepo**.
The bot is deployed on **Railway** via Docker. Do NOT run the bot in Replit — no workflows, no `pnpm run dev`.
Only allowed local command: `pnpm --filter @workspace/discord-bot run typecheck`

The bot is located at `artifacts/discord-bot/src/`.
TypeScript must typecheck cleanly before your work is done.

## What Has Been Built

The `mewo` prefix command system is fully scaffolded. All core infrastructure is complete:

| File | Status |
|------|--------|
| `src/mewo/store.ts` | ✅ Complete — JSON persistence, tags, timezones, colors, AI usage |
| `src/mewo/help.ts` | ✅ Complete — Module help panel, per-module command views |
| `src/mewo/router.ts` | ✅ Complete — Full routing tree, enable/disable, fallback stubs |
| `src/mewo/modules/fun.ts` | ✅ Complete — 18 fun commands |
| `src/mewo/modules/roleplay.ts` | ✅ Complete — 17 roleplay GIF commands via nekos.best |
| `src/mewo/modules/utility.ts` | ✅ Complete — 17 utility commands |
| `src/mewo/modules/ai.ts` | ✅ Complete — ChatGPT + LLaMA + usage + stubs |
| `src/mewo/modules/games.ts` | ✅ Complete — RPS, Cookie, TicTacToe, Blackjack, Snake stub |
| `src/mewo/modules/search.ts` | ✅ Complete — YouTube, GitHub, Minecraft, Steam |
| `src/mewo/modules/tags.ts` | ✅ Complete — Create, delete, edit, list, send |
| `src/index.ts` | ✅ Updated — mewo handler wired into MessageCreate |

## What Still Needs to be Built

The following features are currently stubs (they send a "coming soon" embed).
You need to implement them properly.

---

### 1. ASCII Art (`mewo asciify`)
**File:** `src/mewo/modules/fun.ts` — function `cmdAsciify`

Currently uses `artii.herokuapp.com` which may be unreliable. Consider:
- Using the `figlet` npm package (`pnpm --filter @workspace/discord-bot add figlet @types/figlet`)
- Or keep the API but add better error handling with a fallback
- Result should be in a code block inside an embed

---

### 2. Emoji Mix (`mewo emojimix`)
**File:** `src/mewo/modules/fun.ts` — function `cmdEmojimix`

Currently a stub. Implement using Google Emoji Kitchen:
- Endpoint format: `https://www.gstatic.com/android/keyboard/emojikitchen/20230301/u{hex1}/u{hex1}_u{hex2}.png`
- Parse the two emoji arguments, convert to hex codepoints, fetch the image URL
- Show the mixed emoji image in an embed
- Handle cases where the combination doesn't exist

---

### 3. OCR (`mewo ai ocr`)
**File:** `src/mewo/modules/ai.ts` — function `cmdOcr`

Currently a stub. Implement using:
- Check `msg.attachments.first()` for an image attachment
- If env var `OCR_API_KEY` is set, call `https://api.ocr.space/parse/url?url=<img_url>&apikey=<key>`
- Parse the response and return extracted text in an embed
- If no key, show setup instructions

---

### 4. Website Screenshot (`mewo ai screenshot <url>`)
**File:** `src/mewo/modules/ai.ts` — function `cmdScreenshot`

Implement using a free screenshot API:
- Try `https://api.screenshotone.com/take?url=<url>&access_key=<key>` (requires SCREENSHOT_ONE_API_KEY)
- Or use `https://shot.screenshotapi.net/screenshot?token=<TOKEN>&url=<url>` (requires SCREENSHOT_API_TOKEN)
- Or use `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=<url>&strategy=desktop` to get screenshots from Lighthouse
- If no API key configured, show setup instructions
- Display screenshot as embed image

---

### 5. Media Download (`mewo ai download <url>`)
**File:** `src/mewo/modules/ai.ts` — function `cmdDownload`

Implement using yt-dlp or a download API:
- Install `yt-dlp` binary in Dockerfile (already based on Debian bookworm)
- Or use a free download API
- Support: YouTube, TikTok, Twitter/X, Instagram (public posts)
- Upload downloaded file to Discord as attachment
- Show metadata (title, duration, quality) in embed

---

### 6. Shazam (`mewo shazam`)
**File:** `src/mewo/router.ts` — currently routes to `comingSoon("Shazam")`

Implement using:
- Accept an audio file attachment from the message
- Use RapidAPI Shazam endpoint: `https://shazam.p.rapidapi.com/songs/detect` (requires RAPIDAPI_KEY)
- Parse result and show song title, artist, album art in embed

---

### 7. SoundCloud (`mewo soundcloud <query>`)
**File:** `src/mewo/router.ts` — currently routes to `comingSoon("Soundcloud")`

Implement:
- Add new function `cmdSoundcloud` in `src/mewo/modules/search.ts`
- Use SoundCloud API or a scraper to search for tracks
- Show track title, artist, duration, play count, link in embed
- No API key needed if using the public resolve API: `https://api.soundcloud.com/resolve?url=<url>&client_id=<id>`

---

### 8. Fake Commands (`mewo fake message`, `mewo fake convo`, `mewo fake quote`, etc.)
**File:** `src/mewo/router.ts` — currently routes to `comingSoon("Fake Media Generation")`

These require image generation using `@napi-rs/canvas` (already installed!).

Implement these canvas-based commands:
- `mewo fake message @user <text>` — generate a fake Discord message screenshot
- `mewo fake quote @user <text>` — generate a fake quote card
- `mewo fake reply @reply_user <reply_text> @user <text>` — fake reply message

Use `@napi-rs/canvas` (already in dependencies) to:
1. Create a canvas (e.g., 600x100 for a message)
2. Draw Discord-like dark background
3. Draw user avatar (fetched from Discord)
4. Draw username and message text
5. Export as PNG and send as file attachment

Example canvas setup:
```typescript
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
const canvas = createCanvas(600, 100);
const ctx = canvas.getContext("2d");
// draw background, avatar, text...
const buffer = canvas.toBuffer("image/png");
await msg.reply({ files: [{ attachment: buffer, name: "fake-message.png" }] });
```

---

### 9. AI Horde Image Generation (`mewo ai imagine <prompt>`)
**File:** `src/mewo/modules/ai.ts` — function exported and referenced in router

Implement using:
- AI Horde async API: `https://stablehorde.net/api/v2/generate/async`
- Free community-powered workers; requests are queued and completion time varies
- Optional `AI_HORDE_API_KEY` for a registered account; anonymous key is the default
- Optional `AI_HORDE_MODEL`; defaults to `Juggernaut XL`
- Set `nsfw: true` for NSFW-capable workers; do not disable prompt safety filters
- Show the generated image in an embed
- Poll the request status endpoint before fetching the completed image

---

### 10. Perplexity Search (`mewo ai perplexity <query>`)
**File:** `src/mewo/modules/ai.ts`

Implement:
- Add new export `cmdPerplexity` 
- Use Perplexity Sonar API: `https://api.perplexity.ai/chat/completions`
- Model: `sonar`
- Requires `PERPLEXITY_API_KEY` environment variable
- Show answer + citations in embed
- Wire into `AI_CMDS.perplexity` in `src/mewo/router.ts`

---

### 11. Text to Speech (`mewo ai tts openai`, `mewo ai tts elevenlabs`)
**File:** `src/mewo/modules/ai.ts`

Implement:
- Add `cmdTtsOpenai` and `cmdTtsElevenlabs` functions
- OpenAI TTS: POST to `https://api.openai.com/v1/audio/speech` (requires OPENAI_API_KEY)
  - body: `{ model: "tts-1", voice: "alloy", input: "<text>" }`
  - Returns audio buffer → attach as `.mp3` file
- ElevenLabs: POST to `https://api.elevenlabs.io/v1/text-to-speech/<voice_id>` (requires ELEVENLABS_API_KEY)
- Wire into `AI_TTS_CMDS` in router.ts

---

### 12. IP Ping (`mewo ip ping <host>`)
**File:** `src/mewo/modules/utility.ts`

Implement:
- Add `cmdIpPing` function
- Use a free global ping API: `https://api.globalping.io/v1/measurements` (free, no auth for basic)
- Or use `net.connect()` to check if a port is open
- Show ping results from multiple locations in embed
- Wire into `IP_CMDS.ping` in router.ts

---

### 13. Global Ping from Multiple Locations (`mewo ip ping <host>`)
See #12 above.

---

## Important Conventions

1. **Every response MUST be a rich embed** — never plain text replies
2. **Error embeds**: color `0xED4245`, description `❌ <message>`
3. **Success embeds**: color `0x57F287`
4. **Info/neutral embeds**: color `0x5865F2`
5. **Footer**: always `"mewo • <module>"` or `"mewo • <module> • <source>"`
6. **No bot token leaking** — never log or display the token
7. **TypeScript strict** — all code must typecheck cleanly

## Path Conventions

```
src/mewo/store.ts        → data dir: resolve(__dirname, "../../data")
src/mewo/modules/*.ts    → import store: import { ... } from "../store.js"
All imports use .js extension (ES modules)
```

## API Keys (all via Railway env vars)

| Command | Env Var | Source |
|---------|---------|--------|
| chatgpt | `OPENAI_API_KEY` | platform.openai.com |
| llama | `GROQ_API_KEY` | console.groq.com (free) |
| mewo ai imagine | `AI_HORDE_API_KEY` | AI Horde (optional; anonymous key is used by default) |
| perplexity | `PERPLEXITY_API_KEY` | perplexity.ai |
| tts elevenlabs | `ELEVENLABS_API_KEY` | elevenlabs.io |
| ocr | `OCR_API_KEY` | ocr.space (free) |
| screenshot | `SCREENSHOT_API_TOKEN` | screenshotapi.net |
| shazam | `RAPIDAPI_KEY` | rapidapi.com |

## After Each Change

Run: `pnpm --filter @workspace/discord-bot run typecheck`

If it passes with 0 errors, you're done. Push to GitHub — Railway auto-deploys.
