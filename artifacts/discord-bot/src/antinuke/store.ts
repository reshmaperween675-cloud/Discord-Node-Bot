import { eq } from "drizzle-orm";
import { getDb } from "../db.js";
import {
  antiNukeConfigTable,
  antiNukeWhitelistTable,
} from "@workspace/db/schema";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ActionType =
  | "channelDelete"
  | "channelCreate"
  | "roleDelete"
  | "roleCreate"
  | "ban"
  | "kick"
  | "guildUpdate"
  | "webhookCreate"
  | "emojiDelete";

/**
 * What happens to an offender when they cross a threshold.
 *   ban   — permanently bans from the server (strongest, use for confirmed threats)
 *   kick  — kicks; they can rejoin but lose admin access immediately
 *   strip — removes all roles (default; reversible via ?antinuke restore)
 *
 * Bots are ALWAYS banned regardless of this setting — managed/integration
 * roles cannot be stripped, so ban is the only effective action.
 */
export type PunishAction = "ban" | "kick" | "strip";

/**
 * Whitelist tier for a user:
 *   immune  — completely ignored; no action ever taken regardless of what they do
 *   lenient — trusted staff with much higher thresholds; if triggered, always strips
 *   none    — normal user subject to default thresholds + configured punishment
 */
export type WhitelistStatus = "immune" | "lenient" | "none";

export interface WhitelistData {
  lenient: Set<string>;
  immune:  Set<string>;
}

export interface AntiNukeConfig {
  enabled: boolean;
  logChannelId: string | null;
  logPingIds: string[];
  punishAction: PunishAction;
  thresholds: Record<ActionType, { count: number; window: number }>;
}

/**
 * Default thresholds — tuned for fast detection:
 *   - 10 second sliding window
 *   - Destructive actions (delete) trigger on 2 events; creative (create)
 *     trigger on 4 since some legitimate bots do batch-create.
 */
export const DEFAULT_THRESHOLDS: AntiNukeConfig["thresholds"] = {
  channelDelete: { count: 1, window: 10_000 },
  channelCreate: { count: 3, window: 10_000 },
  roleDelete:    { count: 1, window: 10_000 },
  roleCreate:    { count: 3, window: 10_000 },
  ban:           { count: 2, window: 10_000 },
  kick:          { count: 2, window: 10_000 },
  guildUpdate:   { count: 1, window: 10_000 },
  webhookCreate: { count: 2, window: 10_000 },
  emojiDelete:   { count: 3, window: 10_000 },
};

/**
 * Lenient thresholds — applied to whitelisted trusted staff.
 * Only triggers on sustained mass-action (10+ destructive actions in 60 s).
 * Punishment is always "strip" — never ban/kick a trusted staff member.
 */
export const LENIENT_THRESHOLDS: AntiNukeConfig["thresholds"] = {
  channelDelete: { count: 10, window: 60_000 },
  channelCreate: { count: 20, window: 60_000 },
  roleDelete:    { count: 10, window: 60_000 },
  roleCreate:    { count: 20, window: 60_000 },
  ban:           { count: 10, window: 60_000 },
  kick:          { count: 10, window: 60_000 },
  guildUpdate:   { count:  5, window: 60_000 },
  webhookCreate: { count: 10, window: 60_000 },
  emojiDelete:   { count: 15, window: 60_000 },
};

// ── In-memory ctby grant list ─────────────────────────────────────────────────
// guildId → Set<userId> — users granted whitelist access by the lowo owner
const ctbyMap = new Map<string, Set<string>>();

export function addCtbyUser(guildId: string, userId: string): void {
  if (!ctbyMap.has(guildId)) ctbyMap.set(guildId, new Set());
  ctbyMap.get(guildId)!.add(userId);
}

export function removeCtbyUser(guildId: string, userId: string): void {
  ctbyMap.get(guildId)?.delete(userId);
}

export function isCtbyUser(guildId: string, userId: string): boolean {
  return ctbyMap.get(guildId)?.has(userId) ?? false;
}

export function getCtbyUsers(guildId: string): string[] {
  return [...(ctbyMap.get(guildId) ?? [])];
}

// ── In-memory sliding window ───────────────────────────────────────────────────
// guildId → executorId → actionType → timestamps[]
const actionMap = new Map<string, Map<string, Map<ActionType, number[]>>>();

// ── In-memory caches ──────────────────────────────────────────────────────────
const whitelistCache = new Map<string, WhitelistData>();
const configCache    = new Map<string, AntiNukeConfig>();

// ── Sliding-window counter ────────────────────────────────────────────────────

export function recordAction(
  guildId: string,
  executorId: string,
  action: ActionType,
  config: AntiNukeConfig,
  overrideThresholds?: AntiNukeConfig["thresholds"],
): boolean {
  const { count, window } = (overrideThresholds ?? config.thresholds)[action];
  const now    = Date.now();
  const cutoff = now - window;

  if (!actionMap.has(guildId)) actionMap.set(guildId, new Map());
  const byGuild = actionMap.get(guildId)!;
  if (!byGuild.has(executorId)) byGuild.set(executorId, new Map());
  const byUser = byGuild.get(executorId)!;
  if (!byUser.has(action)) byUser.set(action, []);
  const timestamps = byUser.get(action)!;

  const fresh = timestamps.filter(t => t > cutoff);
  fresh.push(now);
  byUser.set(action, fresh);
  return fresh.length >= count;
}

export function clearActions(guildId: string, executorId: string): void {
  actionMap.get(guildId)?.delete(executorId);
}

// ── Whitelist ──────────────────────────────────────────────────────────────────

export async function getWhitelistData(guildId: string): Promise<WhitelistData> {
  if (whitelistCache.has(guildId)) return whitelistCache.get(guildId)!;
  try {
    const db   = getDb();
    const rows = await db
      .select()
      .from(antiNukeWhitelistTable)
      .where(eq(antiNukeWhitelistTable.guildId, guildId))
      .limit(1);
    const row = rows[0];
    const data: WhitelistData = {
      lenient: new Set<string>(row?.userIds   ?? []),
      immune:  new Set<string>(row?.immuneIds ?? []),
    };
    whitelistCache.set(guildId, data);
    return data;
  } catch {
    return { lenient: new Set(), immune: new Set() };
  }
}

export async function saveWhitelistData(guildId: string, data: WhitelistData): Promise<void> {
  whitelistCache.set(guildId, data);
  const db = getDb();
  await db
    .insert(antiNukeWhitelistTable)
    .values({ guildId, userIds: [...data.lenient], immuneIds: [...data.immune] })
    .onConflictDoUpdate({
      target: antiNukeWhitelistTable.guildId,
      set: { userIds: [...data.lenient], immuneIds: [...data.immune] },
    });
}

/**
 * Returns the whitelist tier for a given user in a guild.
 * "immune"  — in the immune list (full bypass)
 * "lenient" — in the lenient list (higher thresholds, always strip)
 * "none"    — not whitelisted
 */
export async function getWhitelistStatus(guildId: string, userId: string): Promise<WhitelistStatus> {
  const data = await getWhitelistData(guildId);
  if (data.immune.has(userId))  return "immune";
  if (data.lenient.has(userId)) return "lenient";
  return "none";
}

// ── Config ─────────────────────────────────────────────────────────────────────
//
// punishAction is stored inside the JSONB thresholds column under the
// reserved key "_punishAction". This avoids a schema migration while keeping
// it persistent. It is extracted at read time and never merged into thresholds.

const PUNISH_KEY = "_punishAction";

export async function getConfig(guildId: string): Promise<AntiNukeConfig> {
  if (configCache.has(guildId)) return configCache.get(guildId)!;
  try {
    const db   = getDb();
    const rows = await db
      .select()
      .from(antiNukeConfigTable)
      .where(eq(antiNukeConfigTable.guildId, guildId))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return {
        enabled: false,
        logChannelId: null,
        logPingIds: [],
        punishAction: "strip",
        thresholds: { ...DEFAULT_THRESHOLDS },
      };
    }

    const raw = (row.thresholds ?? {}) as Record<string, unknown>;
    const punishAction = (raw[PUNISH_KEY] as PunishAction | undefined) ?? "strip";

    const { [PUNISH_KEY]: _removed, ...thresholdBlob } = raw;

    const cfg: AntiNukeConfig = {
      enabled:      row.enabled,
      logChannelId: row.logChannelId ?? null,
      logPingIds:   row.logPingIds ?? [],
      punishAction,
      thresholds:   {
        ...DEFAULT_THRESHOLDS,
        ...(thresholdBlob as Partial<AntiNukeConfig["thresholds"]>),
      },
    };
    configCache.set(guildId, cfg);
    return cfg;
  } catch {
    return {
      enabled: false,
      logChannelId: null,
      logPingIds: [],
      punishAction: "strip",
      thresholds: { ...DEFAULT_THRESHOLDS },
    };
  }
}

export async function saveConfig(guildId: string, cfg: AntiNukeConfig): Promise<void> {
  configCache.set(guildId, cfg);
  const db = getDb();

  const thresholdsBlob = {
    ...cfg.thresholds,
    [PUNISH_KEY]: cfg.punishAction,
  };

  await db
    .insert(antiNukeConfigTable)
    .values({
      guildId,
      enabled:      cfg.enabled,
      logChannelId: cfg.logChannelId,
      logPingIds:   cfg.logPingIds,
      thresholds:   thresholdsBlob as Record<string, unknown>,
    })
    .onConflictDoUpdate({
      target: antiNukeConfigTable.guildId,
      set: {
        enabled:      cfg.enabled,
        logChannelId: cfg.logChannelId,
        logPingIds:   cfg.logPingIds,
        thresholds:   thresholdsBlob as Record<string, unknown>,
      },
    });
}
