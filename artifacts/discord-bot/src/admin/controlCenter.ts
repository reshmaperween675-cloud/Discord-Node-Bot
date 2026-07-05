import { Message } from "discord.js";
import { requireLowoOwnerMessage } from "../utility/lowoOwner.js";

const SECRET_KEYWORD = "eonmaster";

export async function handleControlCenterCommand(message: Message): Promise<void> {
  if (!requireLowoOwnerMessage(message)) return;

  const args = message.content.trim().split(/\s+/);
  if (args[1]?.toLowerCase() !== SECRET_KEYWORD) return;

  const domain = process.env.RAILWAY_PUBLIC_DOMAIN ?? process.env.PUBLIC_HOST ?? "localhost";
  const url = `https://${domain}/dashboard`;

  try {
    await message.author.send(
      `🔐 **Control Center**\n${url}\n\n*Link valid for this session. Keep it secret.*`
    );
    // Delete the trigger message so it doesn't linger in chat
    await message.delete().catch(() => { /* no permission — ignore */ });
  } catch {
    // DMs blocked — reply ephemerally in channel then delete
    const reply = await message.reply("✅ Check your DMs.");
    setTimeout(() => reply.delete().catch(() => {}), 5000);
  }
}
