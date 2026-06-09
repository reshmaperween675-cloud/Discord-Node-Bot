import { Message, EmbedBuilder } from "discord.js";

// ── Category → search tags per source ─────────────────────────────────────
const CATEGORIES = {
  neko:   { gelbooru: "animated cat_girl rating:explicit", rule34: "animated neko rating:explicit"   },
  hentai: { gelbooru: "animated rating:explicit -3d",      rule34: "animated hentai rating:explicit"  },
  waifu:  { gelbooru: "animated 1girl rating:explicit",    rule34: "animated 1girl rating:explicit"   },
  random: { gelbooru: "animated rating:explicit",          rule34: "animated rating:explicit"         },
} as const;

type Category = keyof typeof CATEGORIES;
const VALID_CATS = Object.keys(CATEGORIES) as Category[];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Gelbooru (millions of images, very reliable) ───────────────────────────
async function fromGelbooru(tags: string): Promise<string | null> {
  try {
    const pid = Math.floor(Math.random() * 40); // pages 0–39 → up to 800 images deep
    const url =
      `https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1` +
      `&limit=20&pid=${pid}&tags=${encodeURIComponent(tags)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "DiscordBot/1.0" },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { post?: Array<{ file_url?: string }> };
    const posts = data.post ?? [];
    // prefer animated content but fall back to any post
    const animated = posts.filter((p) =>
      p.file_url && (p.file_url.endsWith(".gif") || p.file_url.endsWith(".webm") || p.file_url.endsWith(".mp4")),
    );
    const pool = animated.length > 0 ? animated : posts.filter((p) => p.file_url);
    if (pool.length === 0) return null;
    return pick(pool).file_url ?? null;
  } catch { return null; }
}

// ── Rule34.xxx (massive pool, always up) ───────────────────────────────────
async function fromRule34(tags: string): Promise<string | null> {
  try {
    const pid = Math.floor(Math.random() * 60);
    const url =
      `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1` +
      `&limit=20&pid=${pid}&tags=${encodeURIComponent(tags)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "DiscordBot/1.0" },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return null;
    const data = await res.json() as Array<{ file_url?: string }> | null;
    if (!Array.isArray(data) || data.length === 0) return null;
    const animated = data.filter((p) =>
      p.file_url && (p.file_url.endsWith(".gif") || p.file_url.endsWith(".webm") || p.file_url.endsWith(".mp4")),
    );
    const pool = animated.length > 0 ? animated : data.filter((p) => p.file_url);
    if (pool.length === 0) return null;
    return pick(pool).file_url ?? null;
  } catch { return null; }
}

// ── waifu.im fallback (reliable, smaller pool) ────────────────────────────
const WAIFUIM_TAGS: Partial<Record<Category, string>> = {
  hentai: "hentai",
  waifu:  "ero",
  random: "hentai",
};

async function fromWaifuIm(tag: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.waifu.im/search/?included_tags=${tag}&is_nsfw=true`,
      {
        headers: { "User-Agent": "DiscordBot/1.0", Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return null;
    const data = await res.json() as { images?: Array<{ url?: string }> };
    const images = data.images ?? [];
    if (images.length === 0) return null;
    return pick(images).url ?? null;
  } catch { return null; }
}

// ── Race: first source to return a URL wins ────────────────────────────────
function raceToFirst(fns: Array<() => Promise<string | null>>): Promise<string | null> {
  return new Promise((resolve) => {
    if (fns.length === 0) { resolve(null); return; }
    let remaining = fns.length;
    for (const fn of fns) {
      fn()
        .then((url) => {
          if (url) { resolve(url); }
          else if (--remaining === 0) { resolve(null); }
        })
        .catch(() => { if (--remaining === 0) resolve(null); });
    }
  });
}

async function fetchNsfwUrl(category: Category): Promise<string | null> {
  const map = CATEGORIES[category];

  const fns: Array<() => Promise<string | null>> = [
    () => fromGelbooru(map.gelbooru),
    () => fromRule34(map.rule34),
  ];
  const waifuimTag = WAIFUIM_TAGS[category];
  if (waifuimTag) fns.push(() => fromWaifuIm(waifuimTag));

  const url = await raceToFirst(fns);
  if (url) return url;

  // One full retry
  return raceToFirst(fns);
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
