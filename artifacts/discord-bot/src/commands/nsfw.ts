import { Message, EmbedBuilder } from "discord.js";

// ── Category map ───────────────────────────────────────────────────────────
// User-facing name → per-source API category (null = source doesn't support it)
const CATEGORIES = {
  neko:    { purrbot: "neko",    waifupics: "neko",    nekoslife: "lewd"              },
  hentai:  { purrbot: "hentai",  waifupics: "hentai",  nekoslife: "hentai"            },
  waifu:   { purrbot: null,      waifupics: "waifu",   nekoslife: null                },
  random:  { purrbot: "hentai",  waifupics: "hentai",  nekoslife: "random_hentai_gif" },
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
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { link?: string; error?: boolean };
    if (data.error || !data.link) return null;
    return data.link;
  } catch { return null; }
}

async function fromWaifuPics(cat: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.waifu.pics/nsfw/${cat}`, {
      headers: { "User-Agent": "DiscordBot/1.0" },
      signal: AbortSignal.timeout(7000),
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
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { url?: string };
    return data.url ?? null;
  } catch { return null; }
}

// ── Race all supported sources in parallel, return first winner ────────────

async function fetchNsfwUrl(category: Category): Promise<string | null> {
  const map = CATEGORIES[category];

  // Fire all supported sources simultaneously — first non-null wins
  const promises: Promise<string | null>[] = [];
  if (map.purrbot)   promises.push(fromPurrbot(map.purrbot));
  if (map.waifupics) promises.push(fromWaifuPics(map.waifupics));
  if (map.nekoslife) promises.push(fromNekosLife(map.nekoslife));

  if (promises.length === 0) return null;

  // Keep resolving promises until one returns a URL, or all return null
  const results = await Promise.allSettled(promises);
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) return r.value;
  }

  // One retry pass in case of transient failures
  const retry = await Promise.allSettled(promises.map((_, i) => {
    const map2 = CATEGORIES[category];
    if (i === 0 && map2.purrbot)   return fromPurrbot(map2.purrbot);
    if (i === 1 && map2.waifupics) return fromWaifuPics(map2.waifupics);
    if (i === 2 && map2.nekoslife) return fromNekosLife(map2.nekoslife);
    return Promise.resolve(null);
  }));
  for (const r of retry) {
    if (r.status === "fulfilled" && r.value) return r.value;
  }

  return null;
}

// ── Command handler ────────────────────────────────────────────────────────

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

export async function handleNsfwCommand(message: Message): Promise<void> {
  const parts = message.content.trim().split(/\s+/);
  const input = parts[1]?.toLowerCase();

  // Help subcommand
  if (input === "help") {
    await message.reply({ embeds: [HELP_EMBED] });
    return;
  }

  // Resolve category
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
            `**Usage:** \`?nsfw <category>\` · \`?nsfw help\` for full info`,
          ),
      ],
    });
    return;
  }

  const url = await fetchNsfwUrl(category);

  if (!url) {
    await message.reply("❌ Couldn't fetch a gif right now. Try again in a moment.");
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xff0055)
    .setImage(url)
    .setFooter({ text: `🔞 ${category}` });

  await message.reply({ embeds: [embed] });
}
