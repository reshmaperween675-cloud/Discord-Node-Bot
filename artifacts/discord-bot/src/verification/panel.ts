import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

export const DEFAULT_VERIFICATION_PANEL_NAME = "Last Stand";

/**
 * Builds the verification panel embed + button row.
 * Used by ?setupverification, ?setupauthverification, and ?testauth
 * so they all stay in sync.
 */
export function buildVerifyPanel(
  guildName: string,
  oauthUrl: string,
  panelName: string = DEFAULT_VERIFICATION_PANEL_NAME,
): { embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> } {
  const embed = new EmbedBuilder()
    .setColor(0x003366)
    .setAuthor({ name: guildName })
    .setTitle(`Welcome to ${panelName}`)
    .setDescription(
      `Hey, glad to see you in!\n\n` +
      `We verify everyone before giving server access. ` +
      `It's just a quick Discord check.\n\n` +
      `Click the button below and you'll be through in under a minute.`,
    )
    .setFooter({ text: "Contact EoN if it doesn't works" });

  const button = new ButtonBuilder()
    .setLabel("Get Verified")
    .setStyle(ButtonStyle.Link)
    .setURL(oauthUrl)
    .setEmoji("🔓");

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  return { embed, row };
}
