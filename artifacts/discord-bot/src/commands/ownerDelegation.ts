import type { Message } from "discord.js";
import {
  addDelegatedLowoOwner,
  getDelegatedLowoOwnerIds,
  isConfiguredLowoOwner,
  removeDelegatedLowoOwner,
} from "../utility/lowoOwner.js";

export async function handleOwnerDelegationCommand(message: Message): Promise<void> {
  if (!isConfiguredLowoOwner(message.author.id)) {
    await message.reply("🚫 Only the configured Lowo owner can use `?owner`.");
    return;
  }

  const args = message.content.trim().split(/\s+/).slice(1);
  const action = args[0]?.toLowerCase();

  if (!action || action === "list") {
    const delegates = getDelegatedLowoOwnerIds();
    await message.reply(
      delegates.length
        ? `**Delegated Lowo owners:** ${delegates.map((id) => `<@${id}>`).join(", ")}\nOnly the configured Lowo owner can manage this list.`
        : "There are no delegated Lowo owners yet. Use `?owner @user` to grant access.",
    );
    return;
  }

  if (action === "remove" || action === "revoke") {
    const target = message.mentions.users.first();
    if (!target) {
      await message.reply("Usage: `?owner remove @user`");
      return;
    }
    if (isConfiguredLowoOwner(target.id)) {
      await message.reply("The configured Lowo owner cannot be removed.");
      return;
    }
    const removed = await removeDelegatedLowoOwner(target.id);
    await message.reply(
      removed
        ? `✅ Removed delegated owner access for ${target}.`
        : `${target} does not have delegated owner access.`,
    );
    return;
  }

  if (args.length !== 1) {
    await message.reply("Usage: `?owner @user` or `?owner remove @user`.");
    return;
  }
  const target = message.mentions.users.first();
  if (!target) {
    await message.reply("Usage: `?owner @user` — mention one person to grant owner access.");
    return;
  }
  if (target.bot) {
    await message.reply("Bot accounts cannot be delegated Lowo owners.");
    return;
  }
  if (isConfiguredLowoOwner(target.id)) {
    await message.reply(`${target} is already the configured Lowo owner.`);
    return;
  }

  const added = await addDelegatedLowoOwner(target.id);
  await message.reply(
    added
      ? `✅ ${target} now has the Lowo owner's bot permissions. They cannot use or manage the \`?owner\` command.`
      : `${target} already has delegated Lowo owner access.`,
  );
}
