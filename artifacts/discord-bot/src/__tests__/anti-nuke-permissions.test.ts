import test from "node:test";
import assert from "node:assert/strict";

import { canManageAntiNuke } from "../antinuke/commands.js";

test("anti-nuke controls are restricted to the server owner and the Lowo owner", () => {
  process.env.LOWO_OWNER_ID = "lowo-owner";

  const guild = {
    id: "guild-1",
    ownerId: "guild-owner",
  } as any;

  const adminUser = {
    id: "admin-user",
    permissions: { has: () => true },
  } as any;

  const ownerUser = {
    id: "guild-owner",
    permissions: { has: () => true },
  } as any;

  const lowoOwnerUser = {
    id: "lowo-owner",
    permissions: { has: () => true },
  } as any;

  assert.equal(canManageAntiNuke({ guild, author: adminUser, member: adminUser } as any), false);
  assert.equal(canManageAntiNuke({ guild, author: ownerUser, member: ownerUser } as any), true);
  assert.equal(canManageAntiNuke({ guild, author: lowoOwnerUser, member: lowoOwnerUser } as any), true);
});
