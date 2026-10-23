---
name: Discord bot display-name styles
description: Native display-name styling for Discord bot accounts.
---

Discord's public API docs may not describe native display-name styles for bots, but Discord bot accounts can display a native font and gradient. Community references document applying the style through the bot's own guild-member REST update; discord.js does not provide a typed helper for these fields. Treat this behavior as undocumented and version-sensitive: use the bot's own token through its existing REST client, and only report success when the returned member data confirms the requested style. Do not substitute role colors or images.

**Why:** A supplied Discord screenshot showed a bot with an actual styled display name, contradicting the initial assumption that the feature was user-only. Public docs and older community field maps can lag behind current font and effect IDs.

**How to apply:** Check the current field/font map before changing the payload, keep the style scoped to each guild, and log API rejection or missing confirmation without claiming the style was applied.
