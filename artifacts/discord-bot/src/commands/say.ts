import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  type Message,
} from "discord.js";
import { isLowoOwner } from "../utility/lowoOwner.js";
import { getPool } from "../persistence.js";

export const sayData = new SlashCommandBuilder()
  .setName("say")
  .setDescription("Post a message to the current channel (owner only)")
  .addStringOption((o) =>
    o.setName("message").setDescription("The message to post").setRequired(true),
  )
  .addBooleanOption((o) =>
    o.setName("embed").setDescription("Post as embed (default: false)").setRequired(false),
  )
  .setDMPermission(false);

function sayWhitelistKey(guildId: string): string {
  return `say:whitelist:${guildId}`;
}

async function getSayWhitelist(guildId: string): Promise<string[]> {
  const result = await getPool().query<{ value: unknown }>(
    "SELECT value FROM bot_kv WHERE key = $1",
    [sayWhitelistKey(guildId)],
  );
  const value = result.rows[0]?.value;
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

async function setSayWhitelist(guildId: string, ids: string[]): Promise<void> {
  await getPool().query(
    `INSERT INTO bot_kv (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
    [sayWhitelistKey(guildId), JSON.stringify(ids)],
  );
}

export async function handleSayWhitelistCommand(message: Message): Promise<void> {
  if (!message.guild) return;
  if (!isLowoOwner(message.author.id) && message.guild.ownerId !== message.author.id) return;
  if (!/^\?s\s+whitelist(?:\s+(?:add|remove|list)(?:\s+.*)?|\s*)$/i.test(message.content.trim())) return;

  const rest = message.content.trim().replace(/^\?s\s+/i, "").trim();
  const action = rest.split(/\s+/)[1]?.toLowerCase();
  const whitelist = await getSayWhitelist(message.guild.id);

  if (action === "list") {
    await message.reply(
      whitelist.length
        ? `**/say whitelist:**\n${whitelist.map((id) => `<@${id}>`).join("\n")}`
        : "**/say whitelist:** No users whitelisted.",
    );
    return;
  }

  if (action !== "add" && action !== "remove") {
    await message.reply("Usage: `?s whitelist add/remove/list`");
    return;
  }

  const ids = [...message.mentions.users.values()].map((user) => user.id);
  if (!ids.length) {
    await message.reply(`Usage: \`?s whitelist ${action} @user, @user\``);
    return;
  }

  const next = action === "remove"
    ? whitelist.filter((id) => !ids.includes(id))
    : [...new Set([...whitelist, ...ids])];
  await setSayWhitelist(message.guild.id, next);
  await message.reply(
    action === "remove"
      ? `✅ Removed ${ids.map((id) => `<@${id}>`).join(", ")} from the /say whitelist.`
      : `✅ Added ${ids.map((id) => `<@${id}>`).join(", ")} to the /say whitelist.`,
  );
}

export async function executeSay(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const guildOwnerId = interaction.guild?.ownerId;

  const isOwner = isLowoOwner(userId) || userId === guildOwnerId;
  const whitelist = interaction.guild
    ? await getSayWhitelist(interaction.guild.id)
    : [];
  if (!isOwner && !whitelist.includes(userId)) {
    await interaction.editReply({
      content: "🚫 This command is restricted to the bot owner and server owner.",
    });
    return;
  }

  const message = interaction.options.getString("message", true);
  const asEmbed = interaction.options.getBoolean("embed") ?? false;
  const channel = interaction.channel;

  if (!channel || !("send" in channel) || typeof channel.send !== "function") {
    await interaction.editReply({ content: "❌ Could not access the channel." });
    return;
  }

  try {
    if (asEmbed) {
      const embed = new EmbedBuilder()
        .setDescription(message)
        .setColor(0x5865f2);
      await channel.send({ embeds: [embed] });
    } else {
      await channel.send({ content: message });
    }
    await interaction.editReply({ content: "✅ Message posted successfully." });
  } catch (err) {
    console.error("[SAY] Failed to post message:", err);
    await interaction.editReply({ content: "❌ Failed to post the message." });
  }
}
