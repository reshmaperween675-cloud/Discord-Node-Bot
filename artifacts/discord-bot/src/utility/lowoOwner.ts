import type { Message, ChatInputCommandInteraction } from "discord.js";

export function getLowoOwnerId(): string {
  return process.env.LOWO_OWNER_ID ?? "";
}

export function isLowoOwner(userId: string): boolean {
  const id = getLowoOwnerId();
  return !!id && userId === id;
}

export function requireLowoOwnerMessage(message: Message): boolean {
  return isLowoOwner(message.author.id);
}

export async function requireLowoOwnerInteraction(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  if (isLowoOwner(interaction.user.id)) return true;
  await interaction.editReply({
    content: "🚫 This command is restricted to the bot owner.",
  });
  return false;
}
