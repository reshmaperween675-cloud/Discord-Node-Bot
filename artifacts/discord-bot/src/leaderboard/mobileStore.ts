import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../../data");
const DATA_FILE = resolve(DATA_DIR, "mobile-leaderboard.json");

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

interface LeaderboardData {
  players: LeaderboardPlayer[];
  pinnedMessage?: PinnedMessage;
}

function load(): LeaderboardData {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DATA_FILE)) {
    writeFileSync(DATA_FILE, JSON.stringify({ players: [] }, null, 2));
    return { players: [] };
  }
  try {
    return JSON.parse(readFileSync(DATA_FILE, "utf-8")) as LeaderboardData;
  } catch {
    return { players: [] };
  }
}

function save(data: LeaderboardData): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

export function getMobilePlayers(): LeaderboardPlayer[] {
  return load().players.sort((a, b) => a.position - b.position);
}

export function addMobilePlayer(player: LeaderboardPlayer): void {
  const data = load();
  data.players.push(player);
  data.players.sort((a, b) => a.position - b.position);
  save(data);
}

export function removeMobilePlayerByPosition(position: number): boolean {
  const data = load();
  const before = data.players.length;
  data.players = data.players.filter((p) => p.position !== position);
  save(data);
  return data.players.length < before;
}

export function editMobilePlayer(
  position: number,
  updates: Partial<LeaderboardPlayer>
): boolean {
  const data = load();
  const idx = data.players.findIndex((p) => p.position === position);
  if (idx === -1) return false;
  data.players[idx] = { ...data.players[idx], ...updates };
  data.players.sort((a, b) => a.position - b.position);
  save(data);
  return true;
}

export function mobilePlayerExistsAtPosition(position: number): boolean {
  return load().players.some((p) => p.position === position);
}

export function getMobilePinnedMessage(): PinnedMessage | undefined {
  return load().pinnedMessage;
}

export function setMobilePinnedMessage(pinned: PinnedMessage): void {
  const data = load();
  data.pinnedMessage = pinned;
  save(data);
}

export function clearMobilePinnedMessage(): void {
  const data = load();
  delete data.pinnedMessage;
  save(data);
}
