import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Client,
  type Message,
} from "discord.js";
import { getPool } from "./persistence.js";
import { isLowoOwner } from "./utility/lowoOwner.js";

interface RobloxUser {
  id: number;
  name: string;
  displayName: string;
}

interface RobloxPresence {
  userPresenceType: number;
  placeId?: number;
  gameId?: string;
  universeId?: number;
  lastLocation?: string;
}

interface Tracker {
  username: string;
  userId: string;
  displayName: string;
  filter: string;
  guildId: string;
  channelId: string;
  messageId?: string;
  lastPresence?: string;
  lastJobId?: string;
  lastPlaceId?: number;
}

interface TrackerConfig {
  trackers: Tracker[];
  pingIds: string[];
}

const activePollers = new Map<string, NodeJS.Timeout>();

function kvKey(guildId: string, kind: string): string {
  return `roblox:${kind}:${guildId}`;
}

async function getJson(guildId: string, kind: string): Promise<any> {
  const result = await getPool().query<{ value: any }>(
    "SELECT value FROM bot_kv WHERE key = $1",
    [kvKey(guildId, kind)],
  );
  return result.rows[0]?.value ?? null;
}

async function setJson(guildId: string, kind: string, value: unknown): Promise<void> {
  await getPool().query(
    `INSERT INTO bot_kv (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
    [kvKey(guildId, kind), JSON.stringify(value)],
  );
}

async function getTrackerConfig(guildId: string): Promise<TrackerConfig> {
  const [trackers, pingIds] = await Promise.all([
    getJson(guildId, "trackers"),
    getJson(guildId, "ping"),
  ]);
  return {
    trackers: Array.isArray(trackers) ? trackers : [],
    pingIds: Array.isArray(pingIds) ? pingIds : [],
  };
}

async function resolveRobloxUser(username: string): Promise<RobloxUser | null> {
  const response = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
  });
  if (!response.ok) return null;
  const data = await response.json() as { data?: RobloxUser[] };
  return data.data?.[0] ?? null;
}

async function getPresence(userId: number): Promise<RobloxPresence | null> {
  const response = await fetch("https://presence.roblox.com/v1/presence/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userIds: [userId] }),
  });
  if (!response.ok) return null;
  const data = await response.json() as { userPresences?: RobloxPresence[] };
  return data.userPresences?.[0] ?? null;
}

async function getUniverseInfo(universeId: number): Promise<{ name?: string; rootPlaceId?: number } | null> {
  const response = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
  if (!response.ok) return null;
  const data = await response.json() as { data?: Array<{ name?: string; rootPlaceId?: number }> };
  return data.data?.[0] ?? null;
}

async function getAvatarUrl(userId: number): Promise<string | null> {
  const response = await fetch(
    `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`,
  );
  if (!response.ok) return null;
  const data = await response.json() as {
    data?: Array<{ imageUrl?: string; state?: string }>;
  };
  return data.data?.[0]?.state === "Completed" ? data.data[0].imageUrl ?? null : null;
}

function getMentionTokens(message: Message): string[] {
  const tokens = new Set<string>();
  for (const user of message.mentions.users.values()) tokens.add(`<@${user.id}>`);
  for (const role of message.mentions.roles.values()) tokens.add(`<@&${role.id}>`);
  return [...tokens];
}

async function isGranted(guildId: string, userId: string): Promise<boolean> {
  const value = await getJson(guildId, "access");
  return Array.isArray(value) && value.includes(userId);
}

async function hasAccess(message: Message): Promise<boolean> {
  if (isLowoOwner(message.author.id) || message.guild?.ownerId === message.author.id) return true;
  return message.guild ? await isGranted(message.guild.id, message.author.id) : false;
}

function rosealLink(placeId: number, jobId: string): string {
  return `https://www.roseal.live/join?placeId=${placeId}&gameInstanceId=${jobId}`;
}

function buildInfoEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: "EoNZ Sniper V1" });
}

async function resolvePresence(user: RobloxUser, presence: RobloxPresence | null) {
  let gameName = presence?.lastLocation?.trim() || "Unknown";
  let placeId = presence?.placeId;

  if (presence?.universeId) {
    const universe = await getUniverseInfo(presence.universeId).catch(() => null);
    if (universe?.name) gameName = universe.name;
    if (!placeId && universe?.rootPlaceId) placeId = universe.rootPlaceId;
  }

  return {
    online: presence?.userPresenceType === 2 || presence?.userPresenceType === 1,
    inGame: presence?.userPresenceType === 2,
    gameName,
    placeId,
    universeId: presence?.universeId,
    jobId: presence?.gameId,
  };
}

function buildTrackerEmbed(
  user: RobloxUser,
  state: Awaited<ReturnType<typeof resolvePresence>>,
  avatarUrl?: string | null,
): { embed: EmbedBuilder; row?: ActionRowBuilder<ButtonBuilder> } {
  const status = (state as { leftGame?: boolean }).leftGame
    ? "🟡 Left Game"
    : !state.online
      ? "🔴 Offline"
      : state.inGame
        ? "🟢 Online - In Game"
        : "🟢 Online";
  const embed = new EmbedBuilder()
    .setTitle(`EoNZ Sniper V1 — ${user.displayName || user.name}`)
    .setURL(`https://www.roblox.com/users/${user.id}/profile`)
    .addFields(
      { name: "Game", value: state.inGame ? state.gameName : "N/A", inline: false },
      { name: "Status", value: status, inline: true },
      { name: "Roblox User", value: user.name, inline: true },
      { name: "Job ID", value: state.jobId || "N/A", inline: false },
    )
    .setFooter({ text: "EoNZ Sniper V1" })
    .setTimestamp();
  if (avatarUrl) embed.setThumbnail(avatarUrl);

  if (state.placeId && state.jobId && state.inGame) {
    const link = rosealLink(state.placeId, state.jobId);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setLabel("Join Game").setStyle(ButtonStyle.Link).setURL(link),
    );
    return { embed, row };
  }
  return { embed };
}

export async function handleRobloxCommand(message: Message, client: Client): Promise<void> {
  if (!message.guild) return;
  const content = message.content.trim();
  const lower = content.toLowerCase();

  if (lower === "?t" || lower.startsWith("?t ")) {
    if (!isLowoOwner(message.author.id)) return;
    const rest = content.slice("?t".length).trim();
    if (!rest.toLowerCase().startsWith("access")) return;
    const ids = [...message.mentions.users.values()].map((u) => u.id);

    if (/^access\s+list$/i.test(rest)) {
      const current = await getJson(message.guild.id, "access");
      const access: string[] = Array.isArray(current)
        ? current.filter((id) => typeof id === "string")
        : [];
      await message.reply({
        embeds: [buildInfoEmbed(
          "Track Access",
          access.length
            ? access.map((id) => `<@${id}>`).join("\n")
            : "No users currently have tracking access.",
        )],
      });
      return;
    }

    if (!ids.length) return;

    const current = await getJson(message.guild.id, "access");
    let access: string[] = Array.isArray(current) ? current.filter((id) => typeof id === "string") : [];
    const remove = /\bremove\b/i.test(rest);
    access = remove
      ? access.filter((id) => !ids.includes(id))
      : [...new Set([...access, ...ids])];
    await setJson(message.guild.id, "access", access);
    await message.reply({
      embeds: [buildInfoEmbed(remove ? "Tracking Access Removed" : "Tracking Access Added", "Donoo✅")],
    });
    return;
  }

  if (lower === "?track" || lower.startsWith("?track ") ||
      lower === "?snipe" || lower.startsWith("?snipe ") ||
      lower === "?untrack" || lower.startsWith("?untrack ")) {
    if (!(await hasAccess(message))) return;

    if (lower === "?untrack" || lower.startsWith("?untrack ")) {
      const username = content.trim().replace(/^\?untrack\s+/i, "").replace(/^@/, "").trim();
      if (!username) {
        await message.reply({
          embeds: [buildInfoEmbed("Untrack Player", "Usage: `?untrack RobloxUsername`")],
        });
        return;
      }
      const config = await getTrackerConfig(message.guild.id);
      const user = await resolveRobloxUser(username);
      const keep = config.trackers.filter((tracker) =>
        user ? tracker.userId !== String(user.id) : tracker.username.toLowerCase() !== username.toLowerCase(),
      );
      if (keep.length === config.trackers.length) {
        await message.reply({
          embeds: [buildInfoEmbed("Untrack Player", "That player is not being tracked.")],
        });
        return;
      }
      await setJson(message.guild.id, "trackers", keep);
      await message.reply({
        embeds: [buildInfoEmbed("Untracked", `✅ Stopped tracking **${user?.displayName || username}**.`)],
      });
      return;
    }

    if (lower === "?track help" || lower === "?track modules") {
      await message.reply({
        embeds: [buildInfoEmbed("Roblox Tracker Help",
        "?track setup - use this channel for tracker messages\n" +
        "?track ping @user/@role - choose who gets pinged when someone joins a tracked game\n" +
        "?track ping list - show current tracking pings\n" +
        "?track ping remove - stop tracking pings\n" +
        "?track username - track a player in The Strongest Battlegrounds\n" +
        "?track username all - track them in any game\n" +
        "?track username game name - track them only while in that game\n" +
        "?snipe username - check where a player is right now\n" +
        "?snipe username all games - check them in any game\n" +
        "?track list - show everyone currently being tracked\n" +
        "?untrack username - stop tracking a player\n" +
        "?t access @user, @user1 - give track and snipe access to multiple users\n" +
        "?t access remove @user - remove track and snipe access\n" +
        "?t access list - show who has access\n\n" +
        "Only the eon can manage access.",
        )],
      });
      return;
    }

    if (lower === "?track setup" || lower.startsWith("?track setup ")) {
      if (!isLowoOwner(message.author.id) && message.guild.ownerId !== message.author.id) return;
      await setJson(message.guild.id, "channel", message.channelId);
      await message.reply({
        embeds: [buildInfoEmbed("Track Channel", "✅ Track channel configured.")],
      });
      return;
    }

    if (lower === "?track ping" || lower.startsWith("?track ping ")) {
      if (!isLowoOwner(message.author.id) && message.guild.ownerId !== message.author.id) return;
      const pingLower = lower.trim();
      if (pingLower === "?track ping list") {
        const targets = await getJson(message.guild.id, "ping");
        await message.reply({
          embeds: [buildInfoEmbed(
            "Tracking Pings",
            Array.isArray(targets) && targets.length
              ? targets.join("\n")
              : "No tracking pings are configured.",
          )],
        });
        return;
      }
      if (pingLower === "?track ping remove") {
        await setJson(message.guild.id, "ping", []);
        await message.reply({
          embeds: [buildInfoEmbed("Tracking Ping Removed", "✅ Tracking ping removed.")],
        });
        return;
      }
      const tokens = getMentionTokens(message);
      await setJson(message.guild.id, "ping", tokens);
      await message.reply({
        embeds: [buildInfoEmbed(
          "Tracking Ping",
          tokens.length ? `✅ Tracking ping configured for ${tokens.join(", ")}.` : "✅ Tracking ping disabled.",
        )],
      });
      return;
    }

    if (lower === "?track list") {
      const config = await getTrackerConfig(message.guild.id);
      const embed = new EmbedBuilder()
        .setTitle("Tracked Players")
        .setDescription(
          config.trackers.length
            ? config.trackers.map((tracker) =>
                `• **${tracker.displayName || tracker.username}** (${tracker.username}) — ${
                  tracker.filter === "all"
                    ? "all games"
                    : tracker.filter === "default"
                      ? "The Strongest Battlegrounds"
                      : tracker.filter
                }`
              ).join("\n")
            : "No players are currently being tracked.",
        )
        .setFooter({ text: "EoNZ Sniper V1" });
      await message.reply({ embeds: [embed] });
      return;
    }

    const isSnipe = lower === "?snipe" || lower.startsWith("?snipe ");
    const rawArgs = content.trim().replace(/^\?(?:track|snipe)\s+/i, "").trim();
    if (!rawArgs) {
      await message.reply({
        embeds: [buildInfoEmbed(
          isSnipe ? "Snipe Usage" : "Track Usage",
          isSnipe ? "Usage: `?snipe RobloxUsername`" : "Usage: `?track RobloxUsername <all|default|game name>`",
        )],
      });
      return;
    }

    let filter = "default";
    let username = rawArgs;
    if (!isSnipe) {
      const tokens = rawArgs.split(/\s+/);
      username = tokens.shift() ?? rawArgs;
      const remainder = tokens.join(" ").trim();
      if (/^all(?:\s+games)?$/i.test(remainder)) filter = "all";
      else if (remainder) filter = remainder.toLowerCase();
    } else {
      username = rawArgs.split(/\s+/)[0] ?? rawArgs;
    }

    username = username.replace(/^@/, "").trim();
    const user = await resolveRobloxUser(username);
    if (!user) {
      await message.reply({
        embeds: [buildInfoEmbed("Roblox User", "❌ Roblox user not found.")],
      });
      return;
    }
    const presence = await getPresence(user.id);
    const state = await resolvePresence(user, presence);
    const avatarUrl = await getAvatarUrl(user.id);

    if (isSnipe) {
      const { embed, row } = buildTrackerEmbed(user, state, avatarUrl);
      await message.reply({ embeds: [embed], components: row ? [row] : [] });
      return;
    }

    const configuredChannelId = (await getJson(message.guild.id, "channel")) as string | undefined;
    const channelId = configuredChannelId || message.channelId;
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !(channel instanceof Object) || !("send" in channel) || typeof channel.send !== "function") {
      await message.reply({
        embeds: [buildInfoEmbed("Track Channel", "❌ Tracking channel is not configured or accessible. Use `?track setup`.")],
      });
      return;
    }

    const { embed, row } = buildTrackerEmbed(user, state, avatarUrl);
    const sent = await channel.send({ embeds: [embed], components: row ? [row] : [] });
    const existingConfig = await getTrackerConfig(message.guild.id);
    const tracker: Tracker = {
      username,
      userId: String(user.id),
      displayName: user.displayName || user.name,
      filter,
      guildId: message.guild.id,
      channelId,
      messageId: sent.id,
      lastPresence: state.online ? (state.inGame ? "in-game" : "online") : "offline",
      lastJobId: state.jobId,
      lastPlaceId: state.placeId,
    };
    const trackers = existingConfig.trackers.filter((item) =>
      !(item.guildId === message.guild!.id && item.userId === tracker.userId),
    );
    trackers.push(tracker);
    await setJson(message.guild.id, "trackers", trackers);
    await message.reply({
      embeds: [buildInfoEmbed("Tracking Started", `✅ Tracking **${user.displayName || user.name}**.`)],
    });
  }
}

async function pollTrackers(client: Client): Promise<void> {
  const guilds = [...client.guilds.cache.values()];
  for (const guild of guilds) {
    const config = await getTrackerConfig(guild.id).catch(() => null);
    if (!config?.trackers.length) continue;

    let changed = false;
    const next = [...config.trackers];
    for (let index = 0; index < next.length; index++) {
      const tracker = next[index];
      const user: RobloxUser = {
        id: Number(tracker.userId),
        name: tracker.username,
        displayName: tracker.displayName,
      };
      const presence = await getPresence(user.id).catch(() => null);
      const state = await resolvePresence(user, presence);
      const presenceKey = state.online ? (state.inGame ? `in-game:${state.jobId || ""}` : "online") : "offline";
      const wasInGame = tracker.lastPresence?.startsWith("in-game:");

      const allowedByFilter =
        tracker.filter === "all" ||
        (tracker.filter === "default"
          ? state.gameName.toLowerCase().includes("strongest battlegrounds")
          : state.gameName.toLowerCase().includes(tracker.filter));

      if (!state.inGame || !allowedByFilter) {
        if (tracker.lastPresence !== "offline" && tracker.lastPresence) {
          tracker.lastPresence = "offline";
          changed = true;
        }
      } else if (tracker.lastPresence !== presenceKey) {
        tracker.lastPresence = presenceKey;
        tracker.lastJobId = state.jobId;
        tracker.lastPlaceId = state.placeId;
        changed = true;

        const ping = config.pingIds.length
          ? `${config.pingIds.join(" ")} `
          : "";
        const channel = await client.channels.fetch(tracker.channelId).catch(() => null);
        if (channel && "send" in channel && typeof channel.send === "function") {
          await channel.send({
            content: ping ? `${ping}${user.displayName || user.name} joined a game!` : undefined,
            embeds: [buildInfoEmbed("Player Joined", `${user.displayName || user.name} joined a game`)],
          }).catch(() => {});
        }
      }

      const channel = await client.channels.fetch(tracker.channelId).catch(() => null);
      if (!channel || !("messages" in channel) || !tracker.messageId) continue;
      const message = await channel.messages.fetch(tracker.messageId).catch(() => null);
      if (!message) continue;
      const visibleState = !allowedByFilter
        ? { ...state, inGame: false, gameName: "Filtered game", leftGame: wasInGame }
        : !state.inGame && wasInGame
          ? { ...state, inGame: false, gameName: "N/A", leftGame: true }
          : { ...state, leftGame: false };
      const avatarUrl = await getAvatarUrl(user.id);
      const { embed, row } = buildTrackerEmbed(user, visibleState, avatarUrl);
      await message.edit({ embeds: [embed], components: row ? [row] : [] }).catch(() => {});
    }

    if (changed) await setJson(guild.id, "trackers", next);
  }
}

export function startRobloxTracker(client: Client): void {
  if (activePollers.has(client.user?.id || "roblox-tracker")) return;
  void pollTrackers(client).catch((err) => console.error("[ROBLOX TRACKER] Initial poll failed:", err));
  const timer = setInterval(() => {
    void pollTrackers(client).catch((err) => console.error("[ROBLOX TRACKER] Poll failed:", err));
  }, 15_000);
  activePollers.set(client.user?.id || "roblox-tracker", timer);
}
