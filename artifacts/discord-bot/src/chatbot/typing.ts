import type { Message, TextChannel, NewsChannel, ThreadChannel } from "discord.js";

type Sendable = TextChannel | NewsChannel | ThreadChannel;

function isSendable(ch: unknown): ch is Sendable {
  return !!ch && typeof (ch as Sendable).sendTyping === "function";
}

// Simulate human typing: show indicator, wait, send
export async function sendWithTyping(
  message: Message,
  content: string,
  delay: number,
): Promise<void> {
  const ch = message.channel;
  if (!isSendable(ch)) {
    await message.reply(content).catch(() => {});
    return;
  }

  // Show typing indicator
  if (delay > 0) {
    await ch.sendTyping().catch(() => {});
  }

  // Keep typing indicator alive for long delays (it expires after 10s)
  if (delay > 8000) {
    const refreshCount = Math.floor(delay / 8000);
    let waited = 0;
    for (let i = 0; i < refreshCount; i++) {
      await sleep(8000);
      waited += 8000;
      if (waited < delay) await ch.sendTyping().catch(() => {});
    }
    await sleep(delay - waited);
  } else if (delay > 0) {
    await sleep(delay);
  }

  // Split long messages
  const chunks = splitMessage(content, 1900);
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    if (i === 0) {
      await message.reply(chunk).catch(() => ch.send(chunk).catch(() => {}));
    } else {
      await sleep(300);
      await ch.send(chunk).catch(() => {});
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    const cut = remaining.lastIndexOf("\n", maxLen) || remaining.lastIndexOf(" ", maxLen) || maxLen;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

// Calculate a realistic typing speed based on response length
export function typingDelay(responseText: string, baseDelay: number): number {
  // ~200 chars/min reading time + base delay
  const readTime = Math.min(responseText.length * 20, 5000);
  return Math.floor(baseDelay + readTime * 0.3);
}
