import { Message, EmbedBuilder } from "discord.js";

// Exclusion tags appended to every query — strictly straight, no furry
const EXCL = "-yaoi -yuri -transgender -futanari -trap -crossdressing -furry -anthro -kemono";

// ── Category map ──────────────────────────────────────────────────────────
// booru: xbooru/tbib/hypnohub tag string
// redgifs: search query string
const CATEGORIES = {
  neko:       { booru: `animated cat_girl rating:explicit ${EXCL}`,        redgifs: "neko hentai"        },
  hentai:     { booru: `animated rating:explicit ${EXCL}`,                 redgifs: "hentai animated"    },
  waifu:      { booru: `animated 1girl rating:explicit ${EXCL}`,           redgifs: "waifu hentai"       },
  milf:       { booru: `animated milf rating:explicit ${EXCL}`,            redgifs: "milf hentai"        },
  ahegao:     { booru: `animated ahegao rating:explicit ${EXCL}`,          redgifs: "ahegao hentai"      },
  maid:       { booru: `animated maid rating:explicit ${EXCL}`,            redgifs: "maid hentai"        },
  elf:        { booru: `animated elf rating:explicit ${EXCL}`,             redgifs: "elf hentai"         },
  schoolgirl: { booru: `animated school_uniform rating:explicit ${EXCL}`,  redgifs: "schoolgirl hentai"  },
  gangbang:   { booru: `animated gangbang rating:explicit ${EXCL}`,        redgifs: "gangbang hentai"    },
  creampie:   { booru: `animated creampie rating:explicit ${EXCL}`,        redgifs: "creampie hentai"    },
  random:     { booru: `animated rating:explicit ${EXCL}`,                 redgifs: "hentai"             },
} as const;

type Category = keyof typeof CATEGORIES;
const VALID_CATS = Object.keys(CATEGORIES) as Category[];

const VIDEO_EXTS = [".mp4", ".webm"];
const IMAGE_EXTS = [".gif", ".png", ".jpg", ".jpeg", ".webp"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function isVideo(url: string) { return VIDEO_EXTS.some((e) => url.toLowerCase().endsWith(e)); }
function isImage(url: string) { return IMAGE_EXTS.some((e) => url.toLowerCase().endsWith(e)); }

// ── Shared booru response types ────────────────────────────────────────────
type BooruPost = { file_url?: string };
type BooruThibPost = { directory?: number; image?: string };

function selectUrl(posts: BooruPost[], wantVideo: boolean): string | null {
  // Strictly filter by wanted type — never mix; a video URL in setImage() = blank embed
  const pool = posts.filter((p) =>
    p.file_url && (wantVideo ? isVideo(p.file_url) : isImage(p.file_url)),
  );
  if (pool.length === 0) return null;
  return pick(pool).file_url ?? null;
}

// ── Generic booru fetcher (shared logic) ──────────────────────────────────
async function fetchBooru(
  baseUrl: string,
  tags: string,
  wantVideo: boolean,
  maxPid: number,
  buildUrl?: (item: BooruThibPost) => string,
): Promise<string | null> {
  // Try a random page first; on empty result fall back to page 0 (always has data)
  for (const pid of [Math.floor(Math.random() * maxPid), 0]) {
    try {
      const res = await fetch(
        `${baseUrl}&limit=50&pid=${pid}&tags=${encodeURIComponent(tags)}`,
        { headers: { "User-Agent": "Mozilla/5.0 (compatible; DiscordBot/1.0)" }, signal: AbortSignal.timeout(10_000) },
      );
      if (!res.ok) return null;

      let posts: BooruPost[];
      if (buildUrl) {
        // tbib: directory + image fields
        const raw = await res.json() as BooruThibPost[] | { post?: BooruThibPost[] };
        const items = Array.isArray(raw) ? raw : (raw.post ?? []);
        posts = items
          .filter((p) => p.directory != null && p.image)
          .map((p) => ({ file_url: buildUrl(p) }));
      } else {
        const data = await res.json() as BooruPost[] | { post?: BooruPost[] };
        posts = Array.isArray(data) ? data : (data.post ?? []);
      }

      const url = selectUrl(posts, wantVideo);
      if (url) return url;
      // no results on this page → loop to pid 0 fallback
    } catch { return null; }
  }
  return null;
}

// ── xbooru — confirmed HTTP 200 from server IPs ───────────────────────────
function fromXbooru(tags: string, wantVideo: boolean): Promise<string | null> {
  return fetchBooru(
    "https://xbooru.com/index.php?page=dapi&s=post&q=index&json=1",
    tags, wantVideo, 30,
  );
}

// ── tbib — confirmed HTTP 200, URL = img.tbib.org/images/{dir}/{img} ──────
function fromTbib(tags: string, wantVideo: boolean): Promise<string | null> {
  return fetchBooru(
    "https://tbib.org/index.php?page=dapi&s=post&q=index&json=1",
    tags, wantVideo, 30,
    (p) => `https://img.tbib.org/images/${p.directory}/${p.image}`,
  );
}

// ── hypnohub — confirmed HTTP 200, uses file_url ──────────────────────────
function fromHypnohub(tags: string, wantVideo: boolean): Promise<string | null> {
  return fetchBooru(
    "https://hypnohub.net/index.php?page=dapi&s=post&q=index&json=1",
    tags, wantVideo, 20,
  );
}

// ── Redgifs — guest token (auto-fetched, no registration needed) ───────────
let redgifsToken: string | null = null;
let redgifsTokenExpiry = 0;

async function getRedgifsToken(): Promise<string | null> {
  if (redgifsToken && Date.now() < redgifsTokenExpiry) return redgifsToken;
  try {
    const res = await fetch("https://api.redgifs.com/v2/auth/temporary", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DiscordBot/1.0)" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { token?: string };
    if (!data.token) return null;
    redgifsToken = data.token;
    redgifsTokenExpiry = Date.now() + 23 * 60 * 60 * 1000; // 23 h
    return redgifsToken;
  } catch { return null; }
}

async function fromRedgifs(query: string, wantVideo: boolean): Promise<string | null> {
  try {
    const token = await getRedgifsToken();
    if (!token) return null;
    const start = Math.floor(Math.random() * 200); // randomise result page
    const res = await fetch(
      `https://api.redgifs.com/v2/gifs/search?search_text=${encodeURIComponent(query)}&order=trending&count=80&start=${start}`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "User-Agent": "Mozilla/5.0 (compatible; DiscordBot/1.0)",
        },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (res.status === 401) { redgifsToken = null; return null; } // token expired — reset
    if (!res.ok) return null;
    const data = await res.json() as { gifs?: Array<{ urls?: { hd?: string; sd?: string } }> };
    const gifs = data.gifs ?? [];
    if (gifs.length === 0) return null;
    const gif = pick(gifs);
    const url = gif.urls?.hd ?? gif.urls?.sd ?? null;
    if (!url) return null;
    // Redgifs always returns mp4 — only use if wantVideo or caller doesn't mind
    if (!wantVideo && !isImage(url)) return null;
    return url;
  } catch { return null; }
}

// ── Race all 4 sources — first URL wins ───────────────────────────────────
function raceToFirst(fns: Array<() => Promise<string | null>>): Promise<string | null> {
  return new Promise((resolve) => {
    let remaining = fns.length;
    let done = false;
    for (const fn of fns) {
      fn().then((url) => {
        if (url && !done) { done = true; resolve(url); }
        else if (--remaining === 0 && !done) resolve(null);
      }).catch(() => { if (--remaining === 0 && !done) resolve(null); });
    }
  });
}

async function fetchNsfwUrl(category: Category, wantVideo: boolean): Promise<string | null> {
  const map = CATEGORIES[category];
  const fns = [
    () => fromXbooru(map.booru, wantVideo),
    () => fromTbib(map.booru, wantVideo),
    () => fromHypnohub(map.booru, wantVideo),
    () => fromRedgifs(map.redgifs, wantVideo),
  ];
  const url = await raceToFirst(fns);
  if (url) return url;
  return raceToFirst(fns); // one retry
}

// ── Help embed ────────────────────────────────────────────────────────────

const HELP_EMBED = new EmbedBuilder()
  .setColor(0xff0055)
  .setTitle("🔞 NSFW Command Help")
  .addFields(
    {
      name: "Images",
      value: [
        "`?nsfw` — random image",
        "`?nsfw <category>` — category image",
      ].join("\n"),
    },
    {
      name: "Videos",
      value: [
        "`?nsfw video` — random video",
        "`?nsfw <category> video` — category video",
      ].join("\n"),
    },
    {
      name: "Categories",
      value: VALID_CATS.map((c) => `\`${c}\``).join(" · "),
    },
  )
  .setFooter({ text: "?nfsw also works • Strictly straight content only" });

// ── Command handler ────────────────────────────────────────────────────────

export async function handleNsfwCommand(message: Message): Promise<void> {
  const parts = message.content.trim().split(/\s+/);
  const arg1 = parts[1]?.toLowerCase();
  const arg2 = parts[2]?.toLowerCase();

  if (arg1 === "help") {
    await message.reply({ embeds: [HELP_EMBED] });
    return;
  }

  let wantVideo = false;
  let category: Category;

  if (!arg1) {
    // ?nsfw → random image
    category = pick(VALID_CATS.filter((c) => c !== "random"));
  } else if (arg1 === "video") {
    // ?nsfw video → random video
    wantVideo = true;
    category = pick(VALID_CATS.filter((c) => c !== "random"));
  } else if ((VALID_CATS as string[]).includes(arg1)) {
    // ?nsfw <cat> [video]
    category = arg1 as Category;
    wantVideo = arg2 === "video";
  } else {
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff4444)
          .setTitle("❌ Unknown category")
          .setDescription(
            `**Valid:** ${VALID_CATS.map((c) => `\`${c}\``).join(" · ")}\n` +
            `Use \`?nsfw help\` for full usage info.`,
          ),
      ],
    });
    return;
  }

  const url = await fetchNsfwUrl(category, wantVideo);

  if (!url) {
    await message.reply("❌ Couldn't fetch right now. Try again in a moment.");
    return;
  }

  if (wantVideo) {
    await message.reply({ content: `🔞 **${category}** — ${url}` });
  } else {
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff0055)
          .setImage(url)
          .setFooter({ text: `🔞 ${category}` }),
      ],
    });
  }
}
