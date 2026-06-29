import { test } from "node:test";
import assert from "node:assert/strict";
import { scan } from "../moderation/detector.js";

const MUST_FLAG: [string, string][] = [
  ["Niggeer",        "extended vowel bypass"],
  ["Niggerrr",       "extended consonant bypass"],
  ["Fuckslang",      "compound: fuck prefix"],
  ["Fuckface",       "compound: fuck prefix"],
  ["Choicefuck",     "compound: fuck suffix"],
  ["Assfuck",        "compound: fuck suffix"],
  ["Retarded",       "exact slur"],
  ["niqqer",         "q-for-g bypass"],
  ["nikker",         "k-for-g bypass"],
  ["n.i.g.g.e.r",   "separator bypass"],
  ["phuck",          "ph→f bypass"],
  ["f.u.c.k.i.n.g", "separator bypass: fucking"],
];

const MUST_PASS: [string, string][] = [
  ["Niger",    "country name"],
  ["Nigeria",  "country name"],
  ["snicker",  "innocent word"],
  ["trigger",  "innocent word"],
  ["flicker",  "innocent word"],
  ["ticker",   "innocent word"],
];

test("censor scanner catches known bypasses", async (t) => {
  for (const [word, desc] of MUST_FLAG) {
    await t.test(`flags "${word}" (${desc})`, () => {
      const result = scan(word);
      assert.ok(result !== null, `Expected "${word}" to be flagged but scanner returned null`);
      assert.ok(result.flagged, `Expected "${word}" to be flagged but flagged=false`);
    });
  }
});

test("censor scanner does not false-positive on safe words", async (t) => {
  for (const [word, desc] of MUST_PASS) {
    await t.test(`allows "${word}" (${desc})`, () => {
      const result = scan(word);
      assert.equal(
        result,
        null,
        `Expected "${word}" to be allowed but scanner flagged it as "${result?.matchedTerm}"`,
      );
    });
  }
});

test("scan() handles empty string without throwing", () => {
  assert.doesNotThrow(() => scan(""));
});

test("scan() handles very long strings without throwing", () => {
  const longString = "a".repeat(10_000);
  assert.doesNotThrow(() => scan(longString));
});

test("scan() handles special characters without throwing", () => {
  assert.doesNotThrow(() => scan("!@#$%^&*()_+{}|:<>?"));
});
