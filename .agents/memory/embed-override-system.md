---
name: Embed Override System
description: How the dashboard embed customisation pipeline works end-to-end (bot reads overrides, API stores them, CC edits them)
---

## Rule
`applyEmbedOverride(id, embed, vars)` must be called **after** every EmbedBuilder is fully constructed and **before** `editReply` / `send`. The override is fetched live from `bot_kv` on every call — no caching.

**Why:** User changes in CC take effect instantly without restarting the bot.

## bot_kv key conventions
| Type | Key pattern |
|------|-------------|
| Default embed override | `dashboard:embed:{id}` |
| Custom embed (full record) | `dashboard:custom-embed:{id}` |
| Custom module list | `dashboard:custom-modules` |

## Field override semantics
`ov.fields !== undefined` (not `?.length`) — an empty array explicitly clears all fields. `undefined` means "no override, keep original".

## Custom embed IDs
Always prefixed with `custom.` by the API. Example: user types `my-embed` → stored as `custom.my-embed`.

## Bot coverage (as of implementation)
- leveling/commands.ts: `leveling.rank`
- moderation/modActions.ts: all mod actions (kick, ban, tempban, mute, unmute, timeout, lock, unlock)
- antinuke/events.ts: `antinuke.alert`

## CC
- `useCreateEmbed` / `useCreateCustomModule` in `lib/api-client-react/src/custom-hooks.ts` (hand-written, not orval-generated)
- Fields editor in EmbedEditorDialog — add/remove/edit fields, live preview uses `form.fields` not `embed.fields`
- "New Embed" + "New Module" buttons in the embed library header

## How to apply
When adding a new bot embed to the system:
1. Pick or define its catalog ID (check DEFAULT_EMBEDS in api-server/src/routes/dashboard/embeds.ts)
2. Build the EmbedBuilder as normal with real runtime values
3. Call `await applyEmbedOverride("your.id", embed, { key: "value" })`
4. Send the embed
