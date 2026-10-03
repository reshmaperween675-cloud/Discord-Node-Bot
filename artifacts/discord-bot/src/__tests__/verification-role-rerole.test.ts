import test from "node:test";
import assert from "node:assert/strict";

import { getVerificationReroleTargets } from "../verification/setupAuthVerification.js";

test("verification rerole targets normal channels and categories while skipping verify channels", () => {
  const candidates = [
    { id: "cat-main", type: 1 },
    { id: "channel-a", type: 0 },
    { id: "verify", type: 0 },
    { id: "unverified-chat", type: 0 },
    { id: "cat-archive", type: 4 },
  ] as any[];

  const targets = getVerificationReroleTargets(candidates, new Set(["verify", "unverified-chat"]));

  assert.deepEqual(targets.map((channel: any) => channel.id), ["cat-main", "channel-a", "cat-archive"]);
});
