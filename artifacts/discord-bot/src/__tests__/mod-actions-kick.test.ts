import test from "node:test";
import assert from "node:assert/strict";
import { PermissionFlagsBits } from "discord.js";

import { canKickMember } from "../moderation/modActions.js";

function makeMember(
  id: string,
  rolePosition: number,
  hasKickPermission = true,
  ownerId = "guild-owner",
) {
  return {
    id,
    guild: { ownerId },
    permissions: {
      has: (permission: bigint) =>
        permission === PermissionFlagsBits.KickMembers && hasKickPermission,
    },
    roles: {
      highest: {
        comparePositionTo: (other: { position: number }) =>
          rolePosition - other.position,
        position: rolePosition,
      },
    },
  } as any;
}

test("kick requires the Kick Members permission", () => {
  const moderator = makeMember("moderator", 2, false);
  const target = makeMember("target", 1);

  assert.equal(canKickMember(moderator, target), false);
});

test("kick cannot target members with an equal or higher role", () => {
  const moderator = makeMember("moderator", 2);

  assert.equal(canKickMember(moderator, makeMember("higher", 3)), false);
  assert.equal(canKickMember(moderator, makeMember("equal", 2)), false);
  assert.equal(canKickMember(moderator, makeMember("lower", 1)), true);
});

test("only the server owner can bypass role hierarchy and the owner cannot be kicked", () => {
  const owner = makeMember("guild-owner", 1);
  const highRoleMember = makeMember("higher", 10);
  const moderator = makeMember("moderator", 2);
  const guildOwnerTarget = makeMember("guild-owner", 1);

  assert.equal(canKickMember(owner, highRoleMember), true);
  assert.equal(canKickMember(moderator, guildOwnerTarget), false);
});
