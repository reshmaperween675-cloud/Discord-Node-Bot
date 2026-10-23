import { ActivityType, type Client, type Guild, type Message } from "discord.js";
import { getPool } from "../persistence.js";
import { isLowoOwner } from "../utility/lowoOwner.js";

const PROFILE_KEY = "botprofile:settings";
const DEFAULT_NAME = "EonZ Management Bot";
const DEFAULT_COLORS = [0x00ffff, 0xf0ffff, 0x00d6e8];

const FONT_OPTIONS = [
  { id: 1, name: "Bangers" },
  { id: 2, name: "BioRhyme" },
  { id: 3, name: "Sakura" },
  { id: 4, name: "Jellybean" },
  { id: 5, name: "Compagnon" },
  { id: 6, name: "Museo Moderno" },
  { id: 7, name: "Medieval" },
  { id: 8, name: "8Bit" },
  { id: 9, name: "Ribes" },
  { id: 10, name: "Vampyre" },
  { id: 11, name: "gg sans" },
  { id: 12, name: "Tempo" },
  { id: 13, name: "Monkey Bars" },
  { id: 14, name: "Mainframe" },
  { id: 15, name: "Headbang" },
  { id: 16, name: "Journal" },
] as const;

type ActivityName = "playing" | "watching" | "listening" | "competing";
type PresenceStatus = "online" | "idle" | "dnd" | "invisible";

interface BotProfile {
  name: string;
  fontId: number;
  colors: number[];
  status: PresenceStatus;
  activityType: ActivityName | null;
  activityText: string | null;
}

const DEFAULT_PROFILE: BotProfile = {
  name: DEFAULT_NAME,
  fontId: 14,
  colors: DEFAULT_COLORS,
  status: "online",
  activityType: null,
  activityText: null,
};

const ACTIVITY_TYPES: Record<ActivityName, ActivityType> = {
  playing: ActivityType.Playing,
  watching: ActivityType.Watching,
  listening: ActivityType.Listening,
  competing: ActivityType.Competing,
};

async function saveProfile(profile: BotProfile): Promise<void> {
  await getPool().query(
    `INSERT INTO bot_kv (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
    [PROFILE_KEY, JSON.stringify(profile)],
  );
}

export async function getBotProfile(): Promise<BotProfile> {
  const result = await getPool().query<{ value: Partial<BotProfile> }>(
    "SELECT value FROM bot_kv WHERE key = $1",
    [PROFILE_KEY],
  );
  const saved = result.rows[0]?.value;
  if (!saved) return { ...DEFAULT_PROFILE, colors: [...DEFAULT_COLORS] };
  return {
    ...DEFAULT_PROFILE,
    ...saved,
    name: typeof saved.name === "string" && saved.name.trim() ? saved.name : DEFAULT_NAME,
    colors: Array.isArray(saved.colors) && saved.colors.length >= 2 ? saved.colors : [...DEFAULT_COLORS],
  };
}

export async function applyBotProfileToGuild(
  guild: Guild,
  profile: BotProfile,
): Promise<{ nameConfirmed: boolean; styleConfirmed: boolean }> {
  let nameConfirmed = false;
  try {
    const member = await guild.members.fetchMe();
    if (member.displayName !== profile.name) {
      const updatedMember = await member.setNickname(profile.name, "Bot profile manager");
      nameConfirmed = updatedMember.displayName === profile.name;
    } else {
      nameConfirmed = true;
    }
  } catch (error) {
    console.error(`[BOT PROFILE] Could not update the nickname in guild ${guild.id}:`, error);
  }

  try {
    const expected = {
      display_name_font_id: profile.fontId,
      display_name_effect_id: 2,
      display_name_colors: profile.colors,
    };
    const updated = await guild.client.rest.patch(`/guilds/${guild.id}/members/@me`, {
      body: expected,
    }) as {
      display_name_styles?: { font_id?: number; effect_id?: number; colors?: number[] } | null;
    };

    const applied = updated?.display_name_styles;
    const confirmed =
      applied?.font_id === expected.display_name_font_id &&
      applied.effect_id === expected.display_name_effect_id &&
      applied.colors?.length === expected.display_name_colors.length &&
      applied.colors.every((color, index) => color === expected.display_name_colors[index]);
    if (!confirmed) {
      console.warn(`[BOT PROFILE] Discord did not confirm display-name style for guild ${guild.id}.`);
    }
    return { nameConfirmed, styleConfirmed: !!confirmed };
  } catch (error) {
    console.error(`[BOT PROFILE] Could not update display-name style in guild ${guild.id}:`, error);
    return { nameConfirmed, styleConfirmed: false };
  }
}

export function applyBotPresence(client: Client, profile: BotProfile): void {
  client.user?.setPresence({
    status: profile.status,
    activities: profile.activityType && profile.activityText
      ? [{ name: profile.activityText, type: ACTIVITY_TYPES[profile.activityType] }]
      : [],
  });
}

function parseColor(value: string): number | null {
  const normalized = value.trim().replace(/^#/, "").replace(/^0x/i, "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  return Number.parseInt(normalized, 16);
}

function getFont(value: string): (typeof FONT_OPTIONS)[number] | undefined {
  const normalized = value.trim().toLowerCase();
  return FONT_OPTIONS.find((font) =>
    String(font.id) === normalized || font.name.toLowerCase() === normalized,
  );
}

async function updateGuildProfiles(
  client: Client,
  profile: BotProfile,
): Promise<{ nameConfirmed: number; styleConfirmed: number }> {
  const results = await Promise.all(
    [...client.guilds.cache.values()].map((guild) => applyBotProfileToGuild(guild, profile)),
  );
  return {
    nameConfirmed: results.filter((result) => result.nameConfirmed).length,
    styleConfirmed: results.filter((result) => result.styleConfirmed).length,
  };
}

async function sendHelp(message: Message): Promise<void> {
  const guide =
    "**Bot Profile Editor — owner guide**\n\n" +
    "Use these commands in a server or DM. Changes are saved and restored after a restart.\n\n" +
    "`?botprofile edit name <name>` — set the bot's server nickname.\n" +
    "`?botprofile edit font <font name or ID>` — choose a display-name font.\n" +
    "`?botprofile edit gradient <color> <color> [color]` — set the gradient, for example `#00FFFF #F0FFFF #00D6E8`.\n" +
    "`?botprofile edit status <online|idle|dnd|invisible>` — set the bot's presence status.\n" +
    "`?botprofile edit activity <playing|watching|listening|competing> <text>` — set its activity.\n" +
    "`?botprofile edit activity off` — clear the activity.\n" +
    "`?botprofile edit help` — send this guide again.\n\n" +
    "**Available fonts**\n" +
    FONT_OPTIONS.map((font) => `\`${font.id}\` ${font.name}`).join(" · ");
  try {
    await message.author.send(guide);
    if (message.guild) await message.reply("📬 I sent the bot profile editor guide to your DMs.");
  } catch {
    if (message.guild) {
      await message.reply("I couldn't DM you the guide. Please enable DMs from server members and try again.");
    } else {
      await message.reply("I couldn't send the guide. Please check that your DMs are open.");
    }
  }
}

export async function handleBotProfileCommand(message: Message, client: Client): Promise<void> {
  if (!isLowoOwner(message.author.id)) {
    await message.reply("🚫 This command is restricted to the Lowo owner.");
    return;
  }

  const match = message.content.trim().match(/^\?botprofile(?:\s+edit)?(?:\s+([\s\S]*))?$/i);
  if (!match) return;
  const input = (match[1] ?? "").trim();
  if (!input || input.toLowerCase() === "help") {
    await sendHelp(message);
    return;
  }

  const splitAt = input.indexOf(" ");
  const action = (splitAt < 0 ? input : input.slice(0, splitAt)).toLowerCase();
  const value = splitAt < 0 ? "" : input.slice(splitAt + 1).trim();
  const profile = await getBotProfile();

  if (action === "name") {
    if (!value || value.length > 32) {
      await message.reply("Usage: `?botprofile edit name <name>` (1–32 characters).");
      return;
    }
    profile.name = value;
    await saveProfile(profile);
    const result = await updateGuildProfiles(client, profile);
    await message.reply(
      `✅ Saved the bot name. Discord confirmed the nickname in ${result.nameConfirmed}/${client.guilds.cache.size} servers and the font/gradient in ${result.styleConfirmed}/${client.guilds.cache.size}.`,
    );
    return;
  }

  if (action === "font") {
    const font = getFont(value);
    if (!font) {
      await message.reply(`Unknown font. Choose a font name or ID:\n${FONT_OPTIONS.map((item) => `\`${item.id}\` ${item.name}`).join(" · ")}`);
      return;
    }
    profile.fontId = font.id;
    await saveProfile(profile);
    const result = await updateGuildProfiles(client, profile);
    await message.reply(`✅ Saved font **${font.name}**. Discord confirmed the style in ${result.styleConfirmed}/${client.guilds.cache.size} servers.`);
    return;
  }

  if (action === "gradient") {
    const colors = value.split(/[\s,]+/).filter(Boolean).map(parseColor);
    if (colors.length < 2 || colors.length > 3 || colors.some((color) => color === null)) {
      await message.reply("Usage: `?botprofile edit gradient <#RRGGBB> <#RRGGBB> [#RRGGBB]` (2–3 colors).");
      return;
    }
    profile.colors = colors as number[];
    await saveProfile(profile);
    const result = await updateGuildProfiles(client, profile);
    await message.reply(`✅ Saved gradient \`${colors.map((color) => `#${color!.toString(16).padStart(6, "0").toUpperCase()}`).join(" → ")}\`. Discord confirmed the style in ${result.styleConfirmed}/${client.guilds.cache.size} servers.`);
    return;
  }

  if (action === "status") {
    if (!["online", "idle", "dnd", "invisible"].includes(value.toLowerCase())) {
      await message.reply("Usage: `?botprofile edit status <online|idle|dnd|invisible>`.");
      return;
    }
    profile.status = value.toLowerCase() as PresenceStatus;
    await saveProfile(profile);
    applyBotPresence(client, profile);
    await message.reply(`✅ Bot status set to **${profile.status}**.`);
    return;
  }

  if (action === "activity") {
    if (value.toLowerCase() === "off") {
      profile.activityType = null;
      profile.activityText = null;
      await saveProfile(profile);
      applyBotPresence(client, profile);
      await message.reply("✅ Bot activity cleared.");
      return;
    }
    const activityMatch = value.match(/^(playing|watching|listening|competing)\s+([\s\S]+)$/i);
    if (!activityMatch || activityMatch[2]!.length > 128) {
      await message.reply("Usage: `?botprofile edit activity <playing|watching|listening|competing> <text>` or `activity off`.");
      return;
    }
    profile.activityType = activityMatch[1]!.toLowerCase() as ActivityName;
    profile.activityText = activityMatch[2]!;
    await saveProfile(profile);
    applyBotPresence(client, profile);
    await message.reply(`✅ Bot activity set to **${profile.activityType} ${profile.activityText}**.`);
    return;
  }

  await message.reply("Unknown editor setting. Use `?botprofile edit help` for the available options.");
}
