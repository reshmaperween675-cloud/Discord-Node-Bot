import test from "node:test";
import assert from "node:assert/strict";

import { canPromoteMember } from "../promotions/index.js";

function makeRole(position: number) {
  return {
    position,
    comparePositionTo(other: { position: number }) {
      return position - other.position;
    },
  } as any;
}

function makeMember(id: string, highestPosition: number) {
  return {
    id,
    roles: { highest: makeRole(highestPosition) },
  } as any;
}

test("promotion cannot target the actor, even when they have Administrator", () => {
  const actor = makeMember("admin", 10);
  const bot = makeMember("bot", 20);
  actor.permissions = { has: () => true };

  assert.equal(canPromoteMember(actor, bot, actor.id, makeRole(2), makeRole(3)), false);
});

test("promotion cannot assign a role at or above the actor's highest role", () => {
  const actor = makeMember("moderator", 5);
  const bot = makeMember("bot", 20);

  assert.equal(canPromoteMember(actor, bot, "target", makeRole(2), makeRole(5)), false);
  assert.equal(canPromoteMember(actor, bot, "target", makeRole(2), makeRole(6)), false);
});

test("promotion cannot assign roles at or above the bot's highest role", () => {
  const actor = makeMember("moderator", 10);
  const bot = makeMember("bot", 5);

  assert.equal(canPromoteMember(actor, bot, "target", makeRole(2), makeRole(5)), false);
  assert.equal(canPromoteMember(actor, bot, "target", makeRole(2), makeRole(6)), false);
});

test("promotion requires a strictly higher destination role below actor and bot", () => {
  const actor = makeMember("moderator", 10);
  const bot = makeMember("bot", 20);

  assert.equal(canPromoteMember(actor, bot, "target", makeRole(4), makeRole(3)), false);
  assert.equal(canPromoteMember(actor, bot, "target", makeRole(4), makeRole(4)), false);
  assert.equal(canPromoteMember(actor, bot, "target", makeRole(3), makeRole(4)), true);
});
