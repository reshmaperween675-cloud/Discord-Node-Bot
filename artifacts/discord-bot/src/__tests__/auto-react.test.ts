import test from "node:test";
import assert from "node:assert/strict";

import { canManageAutoReact, isUnicodeEmoji } from "../commands/autoReact.js";

test("auto-react management is restricted to the Lowo owner and server owner", () => {
  process.env.LOWO_OWNER_ID = "lowo-owner";

  assert.equal(canManageAutoReact("lowo-owner", "guild-owner"), true);
  assert.equal(canManageAutoReact("guild-owner", "guild-owner"), true);
  assert.equal(canManageAutoReact("admin", "guild-owner"), false);
});

test("auto-react accepts common Unicode emoji sequences but rejects plain text", () => {
  assert.equal(isUnicodeEmoji("👍"), true);
  assert.equal(isUnicodeEmoji("👍🏽"), true);
  assert.equal(isUnicodeEmoji("🇺🇸"), true);
  assert.equal(isUnicodeEmoji("1️⃣"), true);
  assert.equal(isUnicodeEmoji("hello"), false);
  assert.equal(isUnicodeEmoji("👍hello"), false);
});
