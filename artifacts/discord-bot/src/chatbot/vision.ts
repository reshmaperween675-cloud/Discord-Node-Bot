import type { Message } from "discord.js";
import type { ChatMessage } from "./ai.js";
import type { ChatbotConfig } from "./config.js";
import { callAI } from "./ai.js";
import { buildVisionPrompt } from "./personality.js";

function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url);
}

export function getImageUrls(message: Message): string[] {
  const urls: string[] = [];

  // Attachments
  for (const [, attachment] of message.attachments) {
    if (attachment.contentType?.startsWith("image/") || isImageUrl(attachment.url)) {
      urls.push(attachment.url);
    }
  }

  // Embeds with images
  for (const embed of message.embeds) {
    if (embed.image?.url) urls.push(embed.image.url);
    if (embed.thumbnail?.url) urls.push(embed.thumbnail.url);
  }

  return urls.slice(0, 2); // max 2 images per message
}

export async function reactToImage(
  imageUrls: string[],
  messageText: string,
  config: ChatbotConfig,
): Promise<string | null> {
  // Vision requires a model that supports it — use gpt-4o or gemini
  const visionModel = process.env.OPENROUTER_API_KEY
    ? "openai/gpt-4o"
    : "gpt-4o";

  const visionConfig: ChatbotConfig = { ...config, model: visionModel };

  const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

  if (messageText.trim()) {
    contentParts.push({ type: "text", text: `"${messageText}"` });
  }

  for (const url of imageUrls) {
    contentParts.push({ type: "image_url", image_url: { url } });
  }

  contentParts.push({
    type: "text",
    text: "React to this naturally. Be brief, casual, human. 1-2 sentences max.",
  });

  const messages: ChatMessage[] = [
    { role: "system", content: buildVisionPrompt() },
    { role: "user", content: contentParts },
  ];

  return callAI(messages, visionConfig, 120);
}
