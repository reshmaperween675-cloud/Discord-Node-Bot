import type { Message } from "discord.js";

const PRED_TRIGGER = "?pred <@1122801297570156544>";
const PRED_RESPONSE = "**sylent** is 100% pred ✅";

export async function handlePredModule(message: Message): Promise<boolean> {
  if (!message.guild || message.content.trim().toLowerCase() !== PRED_TRIGGER) {
    return false;
  }

  await message.reply(PRED_RESPONSE).catch((error: unknown) => {
    console.error("[PRED MODULE] Failed to send response:", error);
  });
  return true;
}
