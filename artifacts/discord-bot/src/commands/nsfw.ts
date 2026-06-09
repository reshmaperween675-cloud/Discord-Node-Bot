import { Message, EmbedBuilder } from "discord.js";

// ── Category map ───────────────────────────────────────────────────────────
const CATEGORIES = {
  neko:   { purrbot: "neko",   waifupics: "neko",   nekoslife: "lewd",              hmtai: "neko",   waifuim: null      },
  hentai: { purrbot: "hentai", waifupics: "hentai", nekoslife: "hentai",            hmtai: "hentai", waifuim: "hentai"  },
  waifu:  { purrbot: null,     waifupics: "waifu",  nekoslife: null,                hmtai: "waifu",  waifuim: "ero"     },
  random: { purrbot: "hentai", waifupics: "hentai", nekoslife: "random_hentai_gif", hmtai: "hentai", waifuim: "hentai"  },
} as const;

type Category = keyof typeof CATEGORIES;
const VALID_CATS = Object.keys(CATEGORIES) as Category[];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Per-source fetchers ────────────────────────────────────────────────────

async function fromPurrbot(cat: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.purrbot.site/v2/img/nsfw/${cat}/gif`, {
      headers: { "User-Agent": "DiscordBot/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { link?: string; error?: boolean };
    if (data.error || !data.link) return null;
    return data.link;
  } catch { return null; }
}

async function fromWaifuPics(cat: string): Promise<string | null> {
  try {
    // Append random nonce to avoid cached responses
    const res = await fetch(`https://api.waifu.pics/nsfw/${cat}`, {
      headers: { "User-Agent": "DiscordBot/1.0", "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { url?: string };
    return data.url ?? null;
  } catch { return null; }
}

async function fromNekosLife(cat: string): Promise<string | null> {
  try {
    const res = await fetch(`https://nekos.life/api/v2/img/${cat}`, {
      headers: { "User-Agent": "DiscordBot/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { url?: string };
    return data.url ?? null;
  } catch { return null; }
}

async function fromHmtai(cat: string): Promise<string | null> {
  try {
    const res = await fetch(`https://hmtai.hatsunia.cfd/nsfw/${cat}`, {
      headers: { "User-Agent": "DiscordBot/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { url?: string };
    return data.url ?? null;
  } catch { return null; }
}

// waifu.im — well-maintained API with a large randomised pool
async function fromWaifuIm(tag: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.waifu.im/search/?included_tags=${tag}&is_nsfw=true`,
      {
        headers: {
          "User-Agent": "DiscordBot/1.0",
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return null;
    const data = await res.json() as { images?: Array<{ url?: string }> };
    const images = data.images;
    if (!images || images.length === 0) return null;
    return images[0]?.url ?? null;
  } catch { return null; }
}

// ── Race: resolves the moment ANY source returns a URL ─────────────────────

function raceToFirst(fns: Array<() => Promise<string | null>>): Promise<string | null> {
  return new Promise((resolve) => {
    if (fns.length === 0) { resolve(null); return; }
    let remaining = fns.length;
    for (const fn of fns) {
      fn()
        .then((url) => {
          if (url) {
            resolve(url);
          } else if (--remaining === 0) {
            resolve(null);
          }
        })
        .catch(() => {
          if (--remaining === 0) resolve(null);
        });
    }
  });
}

function buildFetchers(category: Category): Array<() => Promise<string | null>> {
  const map = CATEGORIES[category];
  const fns: Array<() => Promise<string | null>> = [];
  if (map.purrbot)   fns.push(() => fromPurrbot(map.purrbot!));
  if (map.waifupics) fns.push(() => fromWaifuPics(map.waifupics!));
  if (map.nekoslife) fns.push(() => fromNekosLife(map.nekoslife!));
  if (map.hmtai)     fns.push(() => fromHmtai(map.hmtai!));
  if (map.waifuim)   fns.push(() => fromWaifuIm(map.waifuim!));
  return fns;
}

async function fetchNsfwUrl(category: Category): Promise<string | null> {
  const url = await raceToFirst(buildFetchers(category));
  if (url) return url;
  // Retry once
  return raceToFirst(buildFetchers(category));
}

// ── Help embed ────────────────────────────────────────────────────────────

const HELP_EMBED = new EmbedBuilder()
  .setColor(0xff0055)
  .setTitle("🔞 NSFW Command Help")
  .addFields(
    {
      name: "Usage",
      value: [
        "`?nsfw` — random category",
        "`?nsfw <category>` — specific category",
        "`?nsfw help` — show this menu",
      ].join("\n"),
    },
    {
      name: "Categories",
      value: VALID_CATS.map((c) => `\`${c}\``).join(" · "),
    },
  )
  .setFooter({ text: "?nfsw also works as an alias" });

// ── Command handler ────────────────────────────────────────────────────────

export async function handleNsfwCommand(message: Message): Promise<void> {
  const parts = message.content.trim().split(/\s+/);
  const input = parts[1]?.toLowerCase();

  if (input === "help") {
    await message.reply({ embeds: [HELP_EMBED] });
    return;
  }

  let category: Category;
  if (!input) {
    const pickable = VALID_CATS.filter((c) => c !== "random");
    category = pick(pickable);
  } else if ((VALID_CATS as string[]).includes(input)) {
    category = input as Category;
  } else {
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff4444)
          .setTitle("❌ Unknown category")
          .setDescription(
            `**Valid:** ${VALID_CATS.map((c) => `\`${c}\``).join(" · ")}\n` +
            `Use \`?nsfw help\` for full info.`,
          ),
      ],
    });
    return;
  }

  const url = await fetchNsfwUrl(category);

  if (!url) {
    await message.reply("❌ All image sources are currently down. Try again shortly.");
    return;
  }

  await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xff0055)
        .setImage(url)
        .setFooter({ text: `🔞 ${category}` }),
    ],
  });
}
