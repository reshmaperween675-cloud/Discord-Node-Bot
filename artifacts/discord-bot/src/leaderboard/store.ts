import { eq, asc } from "drizzle-orm";
import { getDb } from "../db.js";
import { leaderboardPlayersTable, leaderboardPinnedMessagesTable } from "@workspace/db/schema";

export type StageRank =
  | "1 High Strong"
  | "1 High Stable"
  | "1 High Weak"
  | "1 Mid Strong"
  | "1 Mid Stable"
  | "1 Mid Weak"
  | "1 Low Strong"
  | "1 Low Stable"
  | "1 Low Weak"
  | "2 High Strong"
  | "2 High Stable"
  | "2 High Weak"
  | "2 Mid Strong"
  | "2 Mid Stable"
  | "2 Mid Weak"
  | "2 Low Strong"
  | "2 Low Stable"
  | "2 Low Weak"
  | "3 High Strong"
  | "3 High Stable"
  | "3 High Weak"
  | "3 Mid Strong"
  | "3 Mid Stable"
  | "3 Mid Weak"
  | "3 Low Strong";

export const STAGE_RANKS: StageRank[] = [
  "1 High Strong", "1 High Stable", "1 High Weak",
  "1 Mid Strong",  "1 Mid Stable",  "1 Mid Weak",
  "1 Low Strong",  "1 Low Stable",  "1 Low Weak",
  "2 High Strong", "2 High Stable", "2 High Weak",
  "2 Mid Strong",  "2 Mid Stable",  "2 Mid Weak",
  "2 Low Strong",  "2 Low Stable",  "2 Low Weak",
  "3 High Strong", "3 High Stable", "3 High Weak",
  "3 Mid Strong",  "3 Mid Stable",  "3 Mid Weak",
  "3 Low Strong",
];

export const STAGE_RANK_COLORS: Record<StageRank, number> = {
  "1 High Strong": 0xffd700,
  "1 High Stable": 0xf0c000,
  "1 High Weak":   0xe0b000,
  "1 Mid Strong":  0x3498db,
  "1 Mid Stable":  0x2980b9,
  "1 Mid Weak":    0x1a6fa0,
  "1 Low Strong":  0x9b59b6,
  "1 Low Stable":  0x8e44ad,
  "1 Low Weak":    0x7d3c98,
  "2 High Strong": 0xf39c12,
  "2 High Stable": 0xe08e0b,
  "2 High Weak":   0xcc8000,
  "2 Mid Strong":  0x27ae60,
  "2 Mid Stable":  0x219a52,
  "2 Mid Weak":    0x1a7a42,
  "2 Low Strong":  0xe74c3c,
  "2 Low Stable":  0xd44332,
  "2 Low Weak":    0xc0392b,
  "3 High Strong": 0x95a5a6,
  "3 High Stable": 0x85959a,
  "3 High Weak":   0x75858e,
  "3 Mid Strong":  0x7f8c8d,
  "3 Mid Stable":  0x6f7c7d,
  "3 Mid Weak":    0x5f6c6d,
  "3 Low Strong":  0x4f5c5d,
};

export const STAGE_RANK_EMOJI: Record<StageRank, string> = {
  "1 High Strong": "🏆",
  "1 High Stable": "🥇",
  "1 High Weak":   "🌟",
  "1 Mid Strong":  "⚡",
  "1 Mid Stable":  "💎",
  "1 Mid Weak":    "🔹",
  "1 Low Strong":  "🔸",
  "1 Low Stable":  "🔷",
  "1 Low Weak":    "🔶",
  "2 High Strong": "🥈",
  "2 High Stable": "✨",
  "2 High Weak":   "💫",
  "2 Mid Strong":  "🎯",
  "2 Mid Stable":  "🎖️",
  "2 Mid Weak":    "🏅",
  "2 Low Strong":  "🔔",
  "2 Low Stable":  "🌙",
  "2 Low Weak":    "⭐",
  "3 High Strong": "🥉",
  "3 High Stable": "🌿",
  "3 High Weak":   "🍃",
  "3 Mid Strong":  "🎲",
  "3 Mid Stable":  "🎮",
  "3 Mid Weak":    "🎳",
  "3 Low Strong":  "⚔️",
};

export interface LeaderboardPlayer {
  position: number;
  displayName: string;
  robloxUsername: string;
  discordUsername: string;
  country: string;
  avatarUrl: string;
  stageRank: StageRank;
}

export interface PinnedMessage {
  guildId: string;
  channelId: string;
  messageId: string;
}

export async function getPlayers(): Promise<LeaderboardPlayer[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(leaderboardPlayersTable)
    .orderBy(asc(leaderboardPlayersTable.position));
  return rows.map(r => ({
    position:        r.position,
    displayName:     r.displayName,
    robloxUsername:  r.robloxUsername,
    discordUsername: r.discordUsername,
    country:         r.country,
    avatarUrl:       r.avatarUrl,
    stageRank:       r.stageRank as StageRank,
  }));
}

export async function addPlayer(player: LeaderboardPlayer): Promise<void> {
  const db = getDb();
  await db.insert(leaderboardPlayersTable).values(player);
}

export async function removePlayerByPosition(position: number): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(leaderboardPlayersTable)
    .where(eq(leaderboardPlayersTable.position, position));
  return (result.rowCount ?? 0) > 0;
}

export async function editPlayer(position: number, updates: Partial<LeaderboardPlayer>): Promise<boolean> {
  const db = getDb();
  const result = await db
    .update(leaderboardPlayersTable)
    .set(updates)
    .where(eq(leaderboardPlayersTable.position, position));
  return (result.rowCount ?? 0) > 0;
}

export async function playerExistsAtPosition(position: number): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ position: leaderboardPlayersTable.position })
    .from(leaderboardPlayersTable)
    .where(eq(leaderboardPlayersTable.position, position))
    .limit(1);
  return rows.length > 0;
}

export async function getPinnedMessage(): Promise<PinnedMessage | undefined> {
  const db = getDb();
  const rows = await db.select().from(leaderboardPinnedMessagesTable).limit(1);
  return rows[0];
}

export async function setPinnedMessage(pinned: PinnedMessage): Promise<void> {
  const db = getDb();
  await db
    .insert(leaderboardPinnedMessagesTable)
    .values(pinned)
    .onConflictDoUpdate({
      target: leaderboardPinnedMessagesTable.guildId,
      set: { channelId: pinned.channelId, messageId: pinned.messageId },
    });
}

export async function clearPinnedMessage(): Promise<void> {
  const db = getDb();
  await db.delete(leaderboardPinnedMessagesTable);
}
