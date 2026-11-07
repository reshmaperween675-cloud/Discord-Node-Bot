import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { isLowoOwner } from "../utility/lowoOwner.js";

export const sayData = new SlashCommandBuilder()
  .setName("say")
  .setDescription("Post a message to the current channel (owner only)")
  .addStringOption((o) =>
    o.setName("message").setDescription("The message to post").setRequired(true),
  )
  .addBooleanOption((o) =>
    o.setName("embed").setDescription("Post as embed (default: false)").setRequired(false),
  )
  .setDefaultMemberPermissions(0)
  .setDMPermission(false);

export async function executeSay(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const guildOwnerId = interaction.guild?.ownerId;

  const isOwner = isLowoOwner(userId) || userId === guildOwnerId;
  if (!isOwner) {
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
