import type { GuildChannel, Role, GuildBan } from "discord.js";
import { OverwriteType } from "discord.js";

// ─── Data shapes ──────────────────────────────────────────────────────────────

export interface OverwriteSnap {
  id: string;
  type: OverwriteType;
  allow: string; // bigint as string
  deny: string;
}

export interface ChannelSnap {
  id: string;         // original channel ID — used to remap parentId references
  name: string;
  type: number;       // ChannelType enum value
  topic: string | null;
  position: number;
  parentId: string | null;
  nsfw: boolean;
  rateLimitPerUser: number;
  bitrate: number | null;
  userLimit: number | null;
  overwrites: OverwriteSnap[];
}

export interface RoleSnap {
  id: string;         // original role ID — used to remap overwrite references
  name: string;
  color: number;
  hoist: boolean;
  mentionable: boolean;
  permissions: string; // bigint as string
  position: number;
  iconURL: string | null;
  unicodeEmoji: string | null;
}

export interface BanSnap {
  userId: string;
  username: string;
}

export interface OffenderSnap {
  channels: ChannelSnap[];
  roles: RoleSnap[];
  bans: BanSnap[];
  capturedAt: number;
}

// ─── In-memory store ─────────────────────────────────────────────────────────
// key = `${guildId}:${executorId}`
const store = new Map<string, OffenderSnap>();

function ensureSnap(guildId: string, executorId: string): OffenderSnap {
  const key = `${guildId}:${executorId}`;
  if (!store.has(key)) {
    store.set(key, { channels: [], roles: [], bans: [], capturedAt: Date.now() });
  }
  return store.get(key)!;
}

// ─── Capture helpers ──────────────────────────────────────────────────────────

export function recordChannelSnap(guildId: string, executorId: string, ch: GuildChannel): void {
  const snap = ensureSnap(guildId, executorId);
  // avoid duplicates (event can fire twice for same channel in edge cases)
  if (snap.channels.some((c) => c.id === ch.id)) return;

  snap.channels.push({
    id: ch.id,
    name: ch.name,
    type: ch.type,
    topic: "topic" in ch ? (ch.topic as string | null) : null,
    position: ch.rawPosition,
    parentId: ch.parentId ?? null,
    nsfw: "nsfw" in ch ? Boolean(ch.nsfw) : false,
    rateLimitPerUser: "rateLimitPerUser" in ch ? Number(ch.rateLimitPerUser) : 0,
    bitrate: "bitrate" in ch ? Number(ch.bitrate) : null,
    userLimit: "userLimit" in ch ? Number(ch.userLimit) : null,
    overwrites: ch.permissionOverwrites.cache.map((ow) => ({
      id: ow.id,
      type: ow.type,
      allow: ow.allow.bitfield.toString(),
      deny: ow.deny.bitfield.toString(),
    })),
  });
}

export function recordRoleSnap(guildId: string, executorId: string, role: Role): void {
  const snap = ensureSnap(guildId, executorId);
  if (snap.roles.some((r) => r.id === role.id)) return;

  snap.roles.push({
    id: role.id,
    name: role.name,
    color: role.color,
    hoist: role.hoist,
    mentionable: role.mentionable,
    permissions: role.permissions.bitfield.toString(),
    position: role.rawPosition,
    iconURL: role.iconURL() ?? null,
    unicodeEmoji: role.unicodeEmoji ?? null,
  });
}

export function recordBanSnap(guildId: string, executorId: string, ban: GuildBan): void {
  const snap = ensureSnap(guildId, executorId);
  if (snap.bans.some((b) => b.userId === ban.user.id)) return;
  snap.bans.push({ userId: ban.user.id, username: ban.user.username });
}

// ─── Read / clear ─────────────────────────────────────────────────────────────

export function getSnap(guildId: string, executorId: string): OffenderSnap | null {
  return store.get(`${guildId}:${executorId}`) ?? null;
}

export function clearSnap(guildId: string, executorId: string): void {
  store.delete(`${guildId}:${executorId}`);
}
