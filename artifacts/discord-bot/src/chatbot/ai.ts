import type { ChatbotConfig } from "./config.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

interface CompletionResponse {
  choices?: Array<{ message: { content: string } }>;
  error?: { message?: string };
}

function getApiConfig(): { url: string; key: string } | null {
  const openrouter = process.env.OPENROUTER_API_KEY;
  const openai = process.env.OPENAI_API_KEY;
  const groq = process.env.GROQ_API_KEY;
  const samba = process.env.SAMBANOVA_API_KEY;

  if (openrouter) return { url: "https://openrouter.ai/api/v1/chat/completions", key: openrouter };
  if (openai)     return { url: "https://api.openai.com/v1/chat/completions", key: openai };
  if (samba)      return { url: "https://api.sambanova.ai/v1/chat/completions", key: samba };
  if (groq)       return { url: "https://api.groq.com/openai/v1/chat/completions", key: groq };
  return null;
}

function resolveModel(config: ChatbotConfig): string {
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;

  // If OpenRouter key exists, use the configured model (which uses OpenRouter model IDs)
  if (hasOpenRouter) return config.model;

  // Fallback mappings for direct providers
  if (process.env.OPENAI_API_KEY) return "gpt-4o-mini";
  if (process.env.SAMBANOVA_API_KEY) return "Meta-Llama-3.3-70B-Instruct";
  if (process.env.GROQ_API_KEY) return "llama-3.1-8b-instant";
  return "gpt-4o-mini";
}

let _providerLogged = false;
export async function callAI(
  messages: ChatMessage[],
  config: ChatbotConfig,
  maxTokens = 300,
): Promise<string | null> {
  const api = getApiConfig();
  if (!api) {
    if (!_providerLogged) {
      console.error("[CHATBOT AI] No API key found. Set OPENROUTER_API_KEY, OPENAI_API_KEY, GROQ_API_KEY, or SAMBANOVA_API_KEY.");
      _providerLogged = true;
    }
    return null;
  }
  if (!_providerLogged) {
    const provider = process.env.OPENROUTER_API_KEY ? "OpenRouter"
      : process.env.OPENAI_API_KEY ? "OpenAI"
      : process.env.SAMBANOVA_API_KEY ? "SambaNova"
      : "Groq";
    console.log(`[CHATBOT AI] Using provider: ${provider}, model: ${resolveModel(config)}`);
    _providerLogged = true;
  }

  const model = resolveModel(config);

  try {
    const res = await fetch(api.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${api.key}`,
        ...(process.env.OPENROUTER_API_KEY
          ? {
              "HTTP-Referer": "https://github.com/discord-bot",
              "X-Title": "mewo",
            }
          : {}),
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.92,
        presence_penalty: 0.4,
        frequency_penalty: 0.3,
      }),
    });

    const data = (await res.json()) as CompletionResponse;

    if (!res.ok || data.error) {
      console.error("[CHATBOT AI] API error:", data.error?.message ?? res.status);
      return null;
    }

    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    console.error("[CHATBOT AI] fetch error:", err);
    return null;
  }
}

export function isAiAvailable(): boolean {
  return !!(
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.SAMBANOVA_API_KEY ||
    process.env.GROQ_API_KEY
  );
}

// Lightweight memory extraction — runs occasionally after a reply
export async function extractMemoryHints(
  recentMessages: string,
  config: ChatbotConfig,
): Promise<{ userFacts: string[]; serverFacts: string[] } | null> {
  const api = getApiConfig();
  if (!api) return null;

  const model = resolveModel(config);

  try {
    const res = await fetch(api.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${api.key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "Extract memorable facts from this Discord conversation. Return JSON only: {\"userFacts\":[...],\"serverFacts\":[...]}. Max 2 facts each. Only genuinely interesting things: games, hobbies, events, inside jokes. Empty arrays if nothing noteworthy.",
          },
          { role: "user", content: recentMessages.slice(0, 2000) },
        ],
        max_tokens: 150,
        temperature: 0.3,
      }),
    });

    const data = (await res.json()) as CompletionResponse;
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return null;
    return JSON.parse(json) as { userFacts: string[]; serverFacts: string[] };
  } catch {
    return null;
  }
}
