import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  StringSelectMenuInteraction,
} from "discord.js";
import { getAllUsers, UserData } from "./db.js";
import { computeLevel } from "./engine.js";
import {
  generateBlockLeaderboardCard,
  BlockEntry,
} from "./blockLeaderboardCard.js";

// ─── Categories ───────────────────────────────────────────────────────────────

type Category = "overall" | "voice" | "reactions" | "weekly" | "monthly";

const CATEGORY_META: Record<
  Category,
  { label: string; title: string; description: string }
> = {
  overall:   { label: "Overall XP",  title: "Overall XP Highlights",   description: "All-time XP" },
  voice:     { label: "Voice Time",  title: "Voice Time Highlights",   description: "Top voice activity" },
  reactions: { label: "Reactions",   title: "Reactions Highlights",    description: "Most reactions" },
  weekly:    { label: "Weekly",      title: "Weekly XP Highlights",    description: "Last 7 days" },
  monthly:   { label: "Monthly",     title: "Monthly XP Highlights",   description: "Last 30 days" },
};

const CATEGORY_ORDER: Category[] = ["overall", "voice", "reactions", "weekly", "monthly"];

const TOP_N = 10;

// ─── Slash command data ───────────────────────────────────────────────────────

export const universalLeaderboardData = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("View the universal server leaderboard.");

// ─── Sorting per category ─────────────────────────────────────────────────────

interface RankedUser {
  userId: string;
  user: UserData;
  primary: number;
  level: number;
}

async function rankUsers(guildId: string, category: Category): Promise<RankedUser[]> {
  const all = await getAllUsers(guildId);

  const mapped: RankedUser[] = all.map((u) => {
    const level = computeLevel(u.totalXp).level;
    let primary = 0;
    switch (category) {
      case "overall":   primary = u.totalXp; break;
      case "weekly":    primary = u.weeklyXp; break;
      case "monthly":   primary = u.totalXp; break;
      case "voice":     primary = u.totalXp; break;
      case "reactions": primary = u.totalXp; break;
    }
    return { userId: u.userId, user: u, primary, level };
  });

  return mapped
    .filter((r) => r.primary > 0)
    .sort((a, b) => b.primary - a.primary);
}

async function buildEntries(
  interaction: ChatInputCommandInteraction | StringSelectMenuInteraction,
  ranked: RankedUser[],
  category: Category,
): Promise<BlockEntry[]> {
  const slice = ranked.slice(0, TOP_N);

  return await Promise.all(
    slice.map(async (r, idx) => {
      let username = r.userId;
      let avatarURL: string | null = null;
      try {
        const member = await interaction.guild!.members.fetch(r.userId).catch(() => null);
        if (member) {
          username = member.user.username;
          avatarURL = member.user.displayAvatarURL({ extension: "png", size: 128 });
        }
      } catch { /* ignore */ }

      let col1Value = `+${r.level}`;
      if (category === "weekly") {
        const cur = computeLevel(r.user.totalXp).level;
        const prev = computeLevel(Math.max(0, r.user.totalXp - r.user.weeklyXp)).level;
        col1Value = `+${Math.max(0, cur - prev)}`;
      }

      return {
        rank: idx + 1,
        avatarURL,
        username,
        col1Label: "LVL",
        col1Value,
        col2Label: "XP",
        col2Value: `+${r.primary.toLocaleString()}`,
      };
    }),
  );
}

function buildSelectRow(category: Category): ActionRowBuilder<StringSelectMenuBuilder> {
  const select = new StringSelectMenuBuilder()
    .setCustomId("ulb_select")
    .setPlaceholder(`${CATEGORY_META[category].label}   ›`)
    .addOptions(
      CATEGORY_ORDER.map((c) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(CATEGORY_META[c].label)
          .setValue(c)
          .setDescription(CATEGORY_META[c].description)
          .setDefault(c === category),
      ),
    );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

async function renderPayload(
  interaction: ChatInputCommandInteraction | StringSelectMenuInteraction,
  category: Category,
): Promise<{
  content: string;
  embeds: EmbedBuilder[];
  files: AttachmentBuilder[];
  components: ActionRowBuilder<StringSelectMenuBuilder>[];
}> {
  const guildId = interaction.guildId!;
  const ranked = await rankUsers(guildId, category);
  const meta = CATEGORY_META[category];

  if (ranked.length === 0) {
    return {
      content: `**LAST STAND  |  AS  |  IND**\n\n_No data yet for **${meta.label}**. Once members start earning XP it will appear here._`,
      embeds: [],
      files: [],
      components: [buildSelectRow(category)],
    };
  }

  const entries = await buildEntries(interaction, ranked, category);
  const buf = await generateBlockLeaderboardCard(meta.title, entries);

  return {
    content: "**LAST STAND  |  AS  |  IND**",
    embeds: [],
    files: [new AttachmentBuilder(buf, { name: "leaderboard.png" })],
    components: [buildSelectRow(category)],
  };
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function executeUniversalLeaderboard(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const payload = await renderPayload(interaction, "weekly");
  await interaction.editReply({
    content: payload.content,
    embeds: payload.embeds,
    files: payload.files,
    components: payload.components,
  });
}

export async function handleUniversalLeaderboardSelect(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  const value = interaction.values[0] as Category;
  const category: Category = CATEGORY_ORDER.includes(value) ? value : "weekly";

  const payload = await renderPayload(interaction, category);
  await interaction.editReply({
    content: payload.content,
    embeds: payload.embeds,
    files: payload.files,
    components: payload.components,
  });
}
