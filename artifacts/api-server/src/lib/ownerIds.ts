/**
 * Returns the set of allowed Lowo Owner Discord user IDs.
 * Checks both LOWO_OWNER_IDS (comma-separated) and LOWO_OWNER_ID (single).
 */
export function getOwnerIds(): Set<string> {
  const ids = new Set<string>();

  const multi = process.env.LOWO_OWNER_IDS;
  if (multi) {
    for (const id of multi.split(",")) {
      const trimmed = id.trim();
      if (trimmed) ids.add(trimmed);
    }
  }

  const single = process.env.LOWO_OWNER_ID;
  if (single) {
    ids.add(single.trim());
  }

  return ids;
}

export function isOwner(userId: string): boolean {
  return getOwnerIds().has(userId);
}
