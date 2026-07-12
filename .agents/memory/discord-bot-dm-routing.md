---
    name: Discord bot DM routing
    description: How direct messages to the bot are routed, distinct from guild messages
    ---

    - In `artifacts/discord-bot/src/bot/lifecycle.ts`, the `MessageCreate` handler checks `if (!message.guild)` immediately after the bot-author check and routes ALL DMs to `handleOwnerDM` (src/admin/serverControl.ts), then returns — DMs never reach the guild-oriented command/moderation logic below that point.
    - **Why:** an owner-only DM control system (`$serverlist`, `.control <server_id>`, then `.ban`/`.kick`/`.massban`/`.admin`/`.setname`/`.invite`/etc.) needed a clean separation from guild logic that assumes `message.guild` is non-null.
    - **How to apply:** any new feature that must work in DMs has to be added inside `handleOwnerDM`'s dispatch (or a new DM branch before the `!message.guild` early return) — adding a `?`/`.` prefix handler further down in the same listener will NOT fire for DMs.
    - Owner gating uses `requireLowoOwnerMessage()` / `LOWO_OWNER_ID` env var (utility/lowoOwner.ts) — same "Lowo owner" concept used elsewhere in the bot.
    