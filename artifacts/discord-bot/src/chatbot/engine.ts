import type { Message } from "discord.js";
import type { ChatbotConfig } from "./config.js";
import type { ChannelMessage } from "./memory.js";

// Track per-channel: last bot reply time & recent message count
const lastBotReply = new Map<string, number>();
const recentMsgCount = new Map<string, { count: number; resetAt: number }>();

export function recordBotReply(channelId: string): void {
  lastBotReply.set(channelId, Date.now());
}

export function trackIncomingMessage(channelId: string): void {
  const now = Date.now();
  const entry = recentMsgCount.get(channelId);
  if (!entry || now > entry.resetAt) {
    recentMsgCount.set(channelId, { count: 1, resetAt: now + 30_000 });
  } else {
    entry.count++;
  }
}

function isQuestion(content: string): boolean {
  const lower = content.toLowerCase().trim();
  return (
    lower.endsWith("?") ||
    /^(who|what|where|when|why|how|is|are|was|were|do|does|did|can|could|should|would|will)\b/.test(lower)
  );
}

function mentionedBot(message: Message, botUserId: string, botName: string): boolean {
  if (message.mentions.users.has(botUserId)) return true;
  const lower = message.content.toLowerCase();
  return lower.includes(botName.toLowerCase());
}

function isActiveConversation(channelId: string): boolean {
  const entry = recentMsgCount.get(channelId);
  if (!entry || Date.now() > entry.resetAt) return false;
  return entry.count >= 3;
}

function secondsSinceLastReply(channelId: string): number {
  const last = lastBotReply.get(channelId);
  if (!last) return Infinity;
  return (Date.now() - last) / 1000;
}

function isPrivateExchange(history: ChannelMessage[]): boolean {
  // Two people trading short messages back and forth (no bot involved)
  const recent = history.slice(-6);
  if (recent.length < 4) return false;
  const users = new Set(recent.filter((m) => !m.isBot).map((m) => m.userId));
  return users.size === 2;
}

export interface ReplyDecision {
  should: boolean;
  delay: number; // ms before typing
  reason: string;
}

export function shouldReply(
  message: Message,
  config: ChatbotConfig,
  history: ChannelMessage[],
  botUserId: string,
): ReplyDecision {
  const content = message.content;
  const channelId = message.channelId;

  // Always reply if directly @mentioned
  if (mentionedBot(message, botUserId, config.botName)) {
    return {
      should: true,
      delay: Math.random() < 0.4 ? 0 : randomDelay(1000, 4000),
      reason: "mentioned",
    };
  }

  // Ignored user
  if (config.ignoredUsers.includes(message.author.id)) {
    return { should: false, delay: 0, reason: "ignored_user" };
  }

  // Build weighted probability
  let prob = config.respondRate / 100;

  // Cooldown: bot just replied
  const secSince = secondsSinceLastReply(channelId);
  if (secSince < 8) {
    prob *= 0.1;
  } else if (secSince < 20) {
    prob *= 0.4;
  }

  // Question boosts probability
  if (isQuestion(content)) prob += 0.25;

  // Active conversation
  if (isActiveConversation(channelId)) prob += 0.15;

  // Private exchange between two people — stay out
  if (isPrivateExchange(history)) prob -= 0.35;

  // Very short messages (reacts, single words) — lower probability
  if (content.trim().split(/\s+/).length <= 2 && !isQuestion(content)) prob -= 0.1;

  // Images / media in message — vision reaction
  if (message.attachments.size > 0) prob += 0.2;

  // Clamp
  prob = Math.max(0, Math.min(1, prob));

  const roll = Math.random();
  if (roll > prob) {
    return { should: false, delay: 0, reason: `rolled ${roll.toFixed(2)} > ${prob.toFixed(2)}` };
  }

  // Human-like delay: 1-15s, longer for longer expected replies
  const wordCount = content.split(/\s+/).length;
  const minDelay = wordCount > 20 ? 3000 : 500;
  const maxDelay = wordCount > 20 ? 12000 : 6000;

  return {
    should: true,
    delay: randomDelay(minDelay, maxDelay),
    reason: `prob ${prob.toFixed(2)}`,
  };
}

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min) + min);
}
