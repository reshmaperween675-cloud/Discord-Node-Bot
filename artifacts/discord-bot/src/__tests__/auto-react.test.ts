import test from "node:test";
import assert from "node:assert/strict";

import {
  canManageAutoReact,
  isUnicodeEmoji,
  normalizeAutoReactConfig,
  upsertAutoReactTarget,
} from "../commands/autoReact.js";

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

test("auto-react supports multiple targets and updates only the selected target", () => {
  const first = { userId: "user-1", emoji: "👍" };
  const second = { userId: "user-2", emoji: "🔥" };

  assert.deepEqual(upsertAutoReactTarget([first], second), [first, second]);
  assert.deepEqual(upsertAutoReactTarget([first, second], { ...first, emoji: "🎉" }), [
    { ...first, emoji: "🎉" },
    second,
  ]);
});

test("auto-react loads legacy single-target settings", () => {
  assert.deepEqual(
    normalizeAutoReactConfig({ userId: "legacy-user", emoji: "👍" }),
    [{ userId: "legacy-user", emoji: "👍" }],
  );
  assert.deepEqual(normalizeAutoReactConfig({ targets: "invalid" }), []);
});
