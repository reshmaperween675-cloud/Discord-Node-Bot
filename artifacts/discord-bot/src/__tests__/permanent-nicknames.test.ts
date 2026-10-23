import { test } from "node:test";
import assert from "node:assert/strict";

import {
  setPermanentNickname,
  removePermanentNickname,
  applyPermanentNickname,
} from "../moderation/permanentNicknames.js";

test("setPermanentNickname preserves the original nickname and re-enforces it", async () => {
  const store: Record<string, Record<string, { originalNickname: string | null; enforcedNickname: string }>> = {};
  const member = {
    id: "user-1",
    nickname: "Josh",
    displayName: "Josh",
    guild: { id: "guild-1" },
    async setNickname(name: string) {
      this.nickname = name;
      this.displayName = name;
      return this;
    },
  } as any;

  const saved = setPermanentNickname({
    guildId: "guild-1",
    userId: "user-1",
    nickname: "Josh",
    originalNickname: "Old Name",
    store,
  });

  assert.equal(saved.originalNickname, "Old Name");
  assert.equal(saved.enforcedNickname, "Josh");

  member.nickname = "Yosh";
  member.displayName = "Yosh";

  await applyPermanentNickname({
    guildId: "guild-1",
    userId: "user-1",
    member,
    store,
  });

  assert.equal(member.nickname, "Josh");
  assert.equal(member.displayName, "Josh");
});

test("removePermanentNickname restores the original nickname and clears the override", async () => {
  const store: Record<string, Record<string, { originalNickname: string | null; enforcedNickname: string }>> = {
    "guild-1": {
      "user-1": {
        originalNickname: "Old Name",
        enforcedNickname: "Josh",
      },
    },
  };

  const member = {
    id: "user-1",
    nickname: "Josh",
    displayName: "Josh",
    guild: { id: "guild-1" },
    async setNickname(name: string | null) {
      this.nickname = name ?? null;
      this.displayName = name ?? "";
      return this;
    },
  } as any;

  const restored = await removePermanentNickname({
    guildId: "guild-1",
    userId: "user-1",
    member,
    store,
  });

  assert.equal(restored, "Old Name");
  assert.equal(member.nickname, "Old Name");
  assert.equal(member.displayName, "Old Name");
  assert.equal(store["guild-1"]?.["user-1"], undefined);
});

test("permanent nickname enforcement cannot overwrite the bot's configured nickname", async () => {
  const store: Record<string, Record<string, { originalNickname: string | null; enforcedNickname: string }>> = {
    "guild-1": {
      "bot-1": {
        originalNickname: "EonZ Management Bot",
        enforcedNickname: "Last Stand Management",
      },
    },
  };
  const member: {
    nickname: string | null;
    displayName: string;
    setNickname: (name: string | null) => Promise<unknown>;
  } = {
    nickname: "EonZ Management Bot",
    displayName: "EonZ Management Bot",
    async setNickname(name: string | null) {
      this.nickname = name;
      this.displayName = name ?? "";
      return this;
    },
  };

  const applied = await applyPermanentNickname({
    guildId: "guild-1",
    userId: "bot-1",
    botUserId: "bot-1",
    member,
    store,
  });

  assert.equal(applied, false);
  assert.equal(member.nickname, "EonZ Management Bot");
  assert.equal(member.displayName, "EonZ Management Bot");
});
