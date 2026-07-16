import type { Message } from "discord.js";
import { getConfig, isChannelEnabled } from "./config.js";
import {
  pushToCache,
  getCachedMessages,
  persistMessage,
  loadChannelHistory,
  getServerMemory,
  saveServerMemory,
  getUserMemory,
  saveUserMemory,
} from "./memory.js";
import { buildSystemPrompt } from "./personality.js";
import { shouldReply, trackIncomingMessage, recordBotReply } from "./engine.js";
import { callAI, extractMemoryHints, isAiAvailable } from "./ai.js";
import { getImageUrls, reactToImage } from "./vision.js";
import { sendWithTyping, typingDelay } from "./typing.js";
import type { ChatMessage } from "./ai.js";

// Track per-channel whether we've loaded history from DB
const historyLoaded = new Set<string>();

async function ensureHistoryLoaded(channelId: string): Promise<void> {
  if (historyLoaded.has(channelId)) return;
  historyLoaded.add(channelId);
  const history = await loadChannelHistory(channelId, 80).catch(() => []);
  for (const msg of history) {
    pushToCache(channelId, msg);
  }
}

export async function handleChatbot(message: Message): Promise<void> {
  if (!message.guild) return;
  if (message.author.bot) return;

  const guildId = message.guild.id;
  const channelId = message.channelId;
  const botId = message.client.user?.id ?? "";

  const config = await getConfig(guildId);

  // Always respond to direct @mentions regardless of whether the channel is enabled
  const directlyMentioned = botId ? message.mentions.users.has(botId) : false;
  if (!isChannelEnabled(config, channelId) && !directlyMentioned) return;

  // Track activity for engine decisions
  trackIncomingMessage(channelId);

  // Ensure channel history is hydrated from DB on first message
  await ensureHistoryLoaded(channelId);

  // Build display content for storage (strip bot mention to clean text)
  const rawContent = message.content.trim();
  const displayContent = rawContent || (message.attachments.size > 0 ? "[image]" : "");
  if (!displayContent) return;

  // Add to in-memory cache
  pushToCache(channelId, {
    userId: message.author.id,
    username: message.member?.displayName ?? message.author.username,
    content: displayContent,
    isBot: false,
    createdAt: new Date(),
  });

  // Persist to DB (non-blocking)
  persistMessage(
    guildId,
    channelId,
    message.author.id,
    message.member?.displayName ?? message.author.username,
    displayContent,
    false,
  ).catch(() => {});

  if (!isAiAvailable()) {
    console.warn("[CHATBOT] AI not available — no API key found. Set OPENROUTER_API_KEY, OPENAI_API_KEY, GROQ_API_KEY, or SAMBANOVA_API_KEY.");
    return;
  }

  const history = getCachedMessages(channelId, 80);
  const decision = shouldReply(message, config, history, botId);

  if (!decision.should) {
    console.log(`[CHATBOT] skip reply in ${channelId}: ${decision.reason}`);
    return;
  }
  console.log(`[CHATBOT] will reply in ${channelId}: ${decision.reason}`);

  // Check for images — vision path
  const imageUrls = getImageUrls(message);
  if (imageUrls.length > 0) {
    const visionReply = await reactToImage(imageUrls, rawContent, config).catch(() => null);
    if (visionReply) {
      const delay = typingDelay(visionReply, decision.delay);
      await sendWithTyping(message, visionReply, delay);
      recordBotReply(channelId);
      pushToCache(channelId, {
        userId: botId,
        username: config.botName,
        content: visionReply,
        isBot: true,
        createdAt: new Date(),
      });
      persistMessage(guildId, channelId, botId, config.botName, visionReply, true).catch(() => {});
      return;
    }
  }

  // Build context for AI
  const serverMem = await getServerMemory(guildId).catch(() => ({
    insideJokes: [],
    frequentTopics: [],
    events: [],
    notes: [],
  }));

  const userMem = await getUserMemory(guildId, message.author.id).catch(() => null);

  const systemPrompt = buildSystemPrompt(
    config,
    message.guild.name,
    serverMem,
    userMem,
    botId,
  );

  // Convert history to AI messages
  const aiMessages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

  for (const msg of history.slice(-60)) {
    const role = msg.isBot ? "assistant" : "user";
    const content = msg.isBot
      ? msg.content
      : `[${msg.username}]: ${msg.content}`;
    aiMessages.push({ role, content });
  }

  // If last message isn't already the current one, add it
  const lastAiMsg = aiMessages[aiMessages.length - 1];
  const currentContent = `[${message.member?.displayName ?? message.author.username}]: ${displayContent}`;
  if (lastAiMsg?.role !== "user" || !lastAiMsg.content.toString().includes(displayContent)) {
    aiMessages.push({ role: "user", content: currentContent });
  }

  const response = await callAI(aiMessages, config, 280).catch((err) => {
    console.error("[CHATBOT] callAI threw:", err);
    return null;
  });
  if (!response) {
    console.warn("[CHATBOT] callAI returned null — API call failed or returned empty. Check [CHATBOT AI] logs above.");
    return;
  }

  // Clean response: remove any AI self-identification artifacts
  const cleaned = response
    .replace(/^(mewo:|bot:|assistant:)\s*/i, "")
    .replace(/\[mewo\]:\s*/i, "")
    .trim();

  if (!cleaned) {
    console.warn("[CHATBOT] cleaned response was empty, skipping send.");
    return;
  }

  console.log(`[CHATBOT] sending reply (${cleaned.length} chars) in ${channelId}`);
  const delay = typingDelay(cleaned, decision.delay);
  await sendWithTyping(message, cleaned, delay).catch((err) => {
    console.error("[CHATBOT] sendWithTyping failed:", err);
  });
  recordBotReply(channelId);

  // Save bot reply to cache & DB
  pushToCache(channelId, {
    userId: botId,
    username: config.botName,
    content: cleaned,
    isBot: true,
    createdAt: new Date(),
  });
  persistMessage(guildId, channelId, botId, config.botName, cleaned, true).catch(() => {});

  // Occasionally extract memory hints (10% chance)
  if (Math.random() < 0.1) {
    const recentText = history
      .slice(-20)
      .map((m) => `${m.username}: ${m.content}`)
      .join("\n");

    extractMemoryHints(recentText, config)
      .then(async (hints) => {
        if (!hints) return;

        if (hints.serverFacts.length > 0) {
          const mem = await getServerMemory(guildId);
          for (const fact of hints.serverFacts) {
            if (!mem.notes.includes(fact)) {
              mem.notes.push(fact);
              if (mem.notes.length > 20) mem.notes.shift();
            }
          }
          await saveServerMemory(guildId, mem);
        }

        if (hints.userFacts.length > 0) {
          const uMem = await getUserMemory(guildId, message.author.id);
          for (const fact of hints.userFacts) {
            if (!uMem.notes.includes(fact)) {
              uMem.notes.push(fact);
              if (uMem.notes.length > 15) uMem.notes.shift();
            }
          }
          await saveUserMemory(guildId, message.author.id, uMem);
        }
      })
      .catch(() => {});
  }
}
