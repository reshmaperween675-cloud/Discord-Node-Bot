import { Message, EmbedBuilder, TextChannel, NewsChannel, ThreadChannel, GuildMember } from "discord.js";
import { getPool } from "../persistence.js";

export interface CustomModule {
  prefix: string;
  command: string;
  message: string;
  reply: boolean;
  embed: boolean;
}

type ModuleRow = { modules: CustomModule[] };

const KV_KEY = (guildId: string) => `custom_modules:${guildId}`;

async function loadModules(guildId: string): Promise<CustomModule[]> {
  const db = getPool();
  const res = await db.query<{ value: ModuleRow }>(
    "SELECT value FROM bot_kv WHERE key = $1",
    [KV_KEY(guildId)]
  );
  return res.rows[0]?.value?.modules ?? [];
}

async function saveModules(guildId: string, modules: CustomModule[]): Promise<void> {
  const db = getPool();
  await db.query(
    `INSERT INTO bot_kv (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
    [KV_KEY(guildId), JSON.stringify({ modules })]
  );
}

function isAdmin(message: Message): boolean {
  return !!message.member?.permissions.has("Administrator");
}

function parseBool(token: string | undefined, fallback: boolean): boolean {
  if (token === "true") return true;
  if (token === "false") return false;
  return fallback;
}

// ─── Variable Substitution Engine ─────────────────────────────────────────────

const RANDOM_WORDS = [
  "catastrophic","whimsical","legendary","mediocre","suspicious","colossal",
  "chaotic","ethereal","abysmal","phenomenal","turbulent","flamboyant",
  "grotesque","majestic","peculiar","radiant","sinister","tranquil","volatile",
  "zealous","ominous","reckless","serene","frantic","oblique",
];

const RANDOM_INSULTS = [
  "absolute clown","certified idiot","walking disaster","living L","professional failure",
  "human disappointment","404 brain not found","irrelevant","a mistake","pure cringe",
  "skill issue personified","the reason we have warning labels","sentient red flag",
  "a NPE in human form","tragically mid","terminally offline","touch-grass denier",
];

const RANDOM_COMPLIMENTS = [
  "an absolute legend","genuinely goated","criminally underrated","built different",
  "a real one","the GOAT","main character energy","peak human specimen","sigma behavior",
  "top tier","certified W","God-tier","an icon","the blueprint","elite","a vibe",
];

const RANDOM_FACTS = [
  "Honey never expires — archaeologists found 3000-year-old honey still edible.",
  "A group of flamingos is called a flamboyance.",
  "Cleopatra lived closer in time to the Moon landing than to the pyramids being built.",
  "The average person walks enough in their lifetime to circle the Earth 5 times.",
  "Octopuses have three hearts and blue blood.",
  "There are more possible chess games than atoms in the observable universe.",
  "A day on Venus is longer than a year on Venus.",
  "Sharks are older than trees.",
  "A single bolt of lightning contains enough energy to toast 100,000 slices of bread.",
  "Crows can recognize and remember human faces.",
  "The human brain generates about 23 watts of power when awake.",
  "Bananas are berries but strawberries are not.",
  "Water can boil and freeze at the same time (called the triple point).",
  "The Eiffel Tower grows 15cm taller in summer due to thermal expansion.",
];

const RANDOM_ANIMALS = ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🦁","🐯","🦄","🐸","🐧","🦋","🦎","🦜","🐙","🦈","🦀","🐊"];
const RANDOM_FOODS = ["🍕","🍔","🍣","🌮","🍜","🍩","🍦","🧁","🥩","🍱","🫔","🥐","🍛","🫕","🌯","🥗","🍝","🧇","🥓","🍟"];
const RANDOM_WEAPONS = ["⚔️","🗡️","🏹","🔫","💣","🪃","🔱","🗺️","⚡","🪄","🌀","🔩","🪖","🛡️","🧨"];
const RANDOM_EMOJIS = ["😂","💀","😭","🗿","🤡","🔥","💅","😈","🥶","😤","🤯","💀","🫡","👁️","🤌","✨","🌚","🫠","😵","🤑"];
const RANDOM_ADJECTIVES = ["absolutely","brutally","suspiciously","dangerously","aggressively","chronically","terminally","genuinely","unironically","objectively","arguably","statistically","legally","technically","spiritually"];
const RANDOM_VERBS = ["demolishing","consuming","manifesting","speedrunning","fumbling","gatekeeping","menacing","carrying","throwing","vibing","sweating","coping","malding","simping","gooning"];
const RANDOM_NOUNS = ["disaster","menace","NPC","goblin","demon","legend","menace","ghost","villain","protagonist","side quest","lore","arc","plot twist","glitch"];
const RANDOM_COUNTRIES = ["Japan","Brazil","Canada","Nigeria","Australia","Germany","South Korea","Argentina","Egypt","Indonesia","Sweden","Mexico","Thailand","Netherlands","Turkey"];
const RANDOM_NAMES = ["Alex","Jordan","Riley","Morgan","Casey","Avery","Quinn","Sage","Blake","Reese","Drew","Skyler","Finley","Rowan","Cameron"];
const RANDOM_SUPERPOWERS = ["invisibility","time manipulation","flight","telekinesis","mind reading","reality warping","teleportation","elemental control","superhuman strength","precognition","matter creation","shapeshifting"];
const RANDOM_JOBS = ["professional gremlin","certified goblin","self-employed menace","unlicensed wizard","retired villain","aspiring NPC","failed protagonist","part-time cryptid","freelance disaster","galaxy-brained strategist"];
const RANDOM_VIBES = ["main character","NPC","final boss","side quest","tutorial character","secret ending","post-credits scene","filler arc","plot armor","boss fight","speed run","100% completion"];
const RANDOM_AESTHETICS = ["dark academia","cottagecore","vaporwave","cyberpunk","goblincore","fairycore","indie sleaze","y2k","grunge","angelcore","weirdcore","dreamcore","traumacore","liminal"];
const RANDOM_RANKS = ["S+","S","A+","A","B+","B","C","D","E","F","Z","SSS","X","?","Unranked"];
const RANDOM_RARITIES = ["Common","Uncommon","Rare","Epic","Legendary","Mythic","Divine","Transcendent","Unobtainable","Debug"];
const RANDOM_ZODIACS = ["Aries ♈","Taurus ♉","Gemini ♊","Cancer ♋","Leo ♌","Virgo ♍","Libra ♎","Scorpio ♏","Sagittarius ♐","Capricorn ♑","Aquarius ♒","Pisces ♓"];
const RANDOM_ELEMENTS = ["🔥 Fire","💧 Water","🌍 Earth","💨 Air","⚡ Lightning","🌊 Ocean","❄️ Ice","🌿 Nature","☀️ Light","🌑 Shadow","🌀 Void","💀 Death"];
const EIGHTBALL_RESPONSES = [
  "It is certain.","It is decidedly so.","Without a doubt.","Yes — definitely.",
  "You may rely on it.","As I see it, yes.","Most likely.","Outlook good.",
  "Yes.","Signs point to yes.","Reply hazy, try again.","Ask again later.",
  "Better not tell you now.","Cannot predict now.","Concentrate and ask again.",
  "Don't count on it.","My reply is no.","My sources say no.",
  "Outlook not so good.","Very doubtful.",
];
const VERDICTS = ["GUILTY","NOT GUILTY","INNOCENT","FRAMED","SUSPICIOUS","BASED","CRINGE","MID","GOATED","COOKED","UNHINGED","CARRIED","THROWING","SUSSY"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function rng(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function memberDisplayName(member: GuildMember | null | undefined, fallback: string): string {
  return member?.displayName ?? fallback;
}

export function resolveVariables(template: string, message: Message, triggerArgs: string): string {
  const author = message.author;
  const member = message.member;
  const guild = message.guild;
  const channel = message.channel;
  const mentioned = message.mentions.members?.first() ?? null;
  const mentionedUser = message.mentions.users.first() ?? null;
  const args = triggerArgs.trim().split(/\s+/).filter(Boolean);

  const now = new Date();
  const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  let result = template;

  // ── User (command invoker) ────────────────────────────────────────────────
  result = result.replace(/\{user\}/gi, `<@${author.id}>`);
  result = result.replace(/\{user\.name\}/gi, author.username);
  result = result.replace(/\{user\.displayname\}/gi, memberDisplayName(member, author.username));
  result = result.replace(/\{user\.id\}/gi, author.id);
  result = result.replace(/\{user\.tag\}/gi, author.tag ?? author.username);
  result = result.replace(/\{user\.avatar\}/gi, author.displayAvatarURL());
  result = result.replace(/\{user\.created\}/gi, author.createdAt.toDateString());
  result = result.replace(/\{user\.joined\}/gi, member?.joinedAt?.toDateString() ?? "Unknown");
  result = result.replace(/\{user\.roles\}/gi, String((member?.roles.cache.size ?? 1) - 1));
  result = result.replace(/\{user\.top_role\}/gi, member?.roles.highest.name ?? "everyone");
  result = result.replace(/\{user\.color\}/gi, member?.roles.highest.hexColor ?? "#ffffff");
  result = result.replace(/\{user\.mention\}/gi, `<@${author.id}>`);

  // ── Target (first @mentioned user) ───────────────────────────────────────
  result = result.replace(/\{target\}/gi, mentionedUser ? `<@${mentionedUser.id}>` : `<@${author.id}>`);
  result = result.replace(/\{target\.name\}/gi, mentionedUser?.username ?? author.username);
  result = result.replace(/\{target\.displayname\}/gi, memberDisplayName(mentioned, mentionedUser?.username ?? author.username));
  result = result.replace(/\{target\.id\}/gi, mentionedUser?.id ?? author.id);
  result = result.replace(/\{target\.tag\}/gi, mentionedUser?.tag ?? author.tag ?? author.username);
  result = result.replace(/\{target\.avatar\}/gi, mentionedUser?.displayAvatarURL() ?? author.displayAvatarURL());
  result = result.replace(/\{target\.created\}/gi, mentionedUser?.createdAt.toDateString() ?? author.createdAt.toDateString());
  result = result.replace(/\{target\.joined\}/gi, mentioned?.joinedAt?.toDateString() ?? "Unknown");
  result = result.replace(/\{target\.top_role\}/gi, mentioned?.roles.highest.name ?? "everyone");

  // ── Server ────────────────────────────────────────────────────────────────
  result = result.replace(/\{server\}/gi, guild?.name ?? "this server");
  result = result.replace(/\{server\.id\}/gi, guild?.id ?? "0");
  result = result.replace(/\{server\.members\}/gi, String(guild?.memberCount ?? 0));
  result = result.replace(/\{server\.channels\}/gi, String(guild?.channels.cache.size ?? 0));
  result = result.replace(/\{server\.roles\}/gi, String(guild?.roles.cache.size ?? 0));
  result = result.replace(/\{server\.owner\}/gi, guild?.ownerId ? `<@${guild.ownerId}>` : "Unknown");
  result = result.replace(/\{server\.created\}/gi, guild?.createdAt.toDateString() ?? "Unknown");
  result = result.replace(/\{server\.boost_level\}/gi, String(guild?.premiumTier ?? 0));
  result = result.replace(/\{server\.boosts\}/gi, String(guild?.premiumSubscriptionCount ?? 0));
  result = result.replace(/\{server\.icon\}/gi, guild?.iconURL() ?? "");
  result = result.replace(/\{server\.name\}/gi, guild?.name ?? "this server");

  // ── Channel ───────────────────────────────────────────────────────────────
  result = result.replace(/\{channel\}/gi, `<#${channel.id}>`);
  result = result.replace(/\{channel\.name\}/gi, "name" in channel ? (channel as TextChannel).name : channel.id);
  result = result.replace(/\{channel\.id\}/gi, channel.id);
  result = result.replace(/\{channel\.topic\}/gi, ("topic" in channel && (channel as TextChannel).topic) ? (channel as TextChannel).topic! : "No topic");

  // ── Message ───────────────────────────────────────────────────────────────
  result = result.replace(/\{message\.id\}/gi, message.id);
  result = result.replace(/\{message\.link\}/gi, message.url);
  result = result.replace(/\{message\.url\}/gi, message.url);

  // ── Args (text after trigger) ─────────────────────────────────────────────
  result = result.replace(/\{args\}/gi, triggerArgs.trim() || "");
  // {args.1}, {args.2}, etc. (1-indexed)
  result = result.replace(/\{args\.(\d+)\}/gi, (_, n) => args[Number(n) - 1] ?? "");
  result = result.replace(/\{args\.(\d+):([^}]+)\}/gi, (_, n, fallback) => args[Number(n) - 1] ?? fallback);

  // ── Time / Date ───────────────────────────────────────────────────────────
  const pad = (n: number) => String(n).padStart(2, "0");
  result = result.replace(/\{time\}/gi, `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())} UTC`);
  result = result.replace(/\{date\}/gi, now.toUTCString().slice(0, 16));
  result = result.replace(/\{datetime\}/gi, now.toUTCString().slice(0, 22) + " UTC");
  result = result.replace(/\{day\}/gi, DAYS[now.getUTCDay()]!);
  result = result.replace(/\{month\}/gi, MONTHS[now.getUTCMonth()]!);
  result = result.replace(/\{year\}/gi, String(now.getUTCFullYear()));
  result = result.replace(/\{hour\}/gi, String(now.getUTCHours()));
  result = result.replace(/\{minute\}/gi, String(now.getUTCMinutes()));
  result = result.replace(/\{unix\}/gi, String(Math.floor(now.getTime() / 1000)));
  result = result.replace(/\{timestamp\}/gi, `<t:${Math.floor(now.getTime() / 1000)}:F>`);
  result = result.replace(/\{timestamp\.r\}/gi, `<t:${Math.floor(now.getTime() / 1000)}:R>`);

  // ── Random — Numbers ──────────────────────────────────────────────────────
  result = result.replace(/\{random_percentage\}/gi, () => `${rng(0, 100)}%`);
  result = result.replace(/\{random_number\}/gi, () => String(rng(1, 100)));
  result = result.replace(/\{random_number:(\d+):(\d+)\}/gi, (_, mn, mx) => String(rng(Number(mn), Number(mx))));
  result = result.replace(/\{dice\}/gi, () => String(rng(1, 6)));
  result = result.replace(/\{dice:(\d+)\}/gi, (_, sides) => String(rng(1, Number(sides))));
  result = result.replace(/\{coinflip\}/gi, () => (Math.random() < 0.5 ? "Heads 🪙" : "Tails 🔵"));
  result = result.replace(/\{yesno\}/gi, () => (Math.random() < 0.5 ? "Yes" : "No"));
  result = result.replace(/\{8ball\}/gi, () => pick(EIGHTBALL_RESPONSES));
  result = result.replace(/\{random_year\}/gi, () => String(rng(1900, 2099)));
  result = result.replace(/\{random_letter\}/gi, () => String.fromCharCode(65 + rng(0, 25)));

  // ── Random — Text ────────────────────────────────────────────────────────
  result = result.replace(/\{random_word\}/gi, () => pick(RANDOM_WORDS));
  result = result.replace(/\{random_insult\}/gi, () => pick(RANDOM_INSULTS));
  result = result.replace(/\{random_compliment\}/gi, () => pick(RANDOM_COMPLIMENTS));
  result = result.replace(/\{random_fact\}/gi, () => pick(RANDOM_FACTS));
  result = result.replace(/\{random_adjective\}/gi, () => pick(RANDOM_ADJECTIVES));
  result = result.replace(/\{random_verb\}/gi, () => pick(RANDOM_VERBS));
  result = result.replace(/\{random_noun\}/gi, () => pick(RANDOM_NOUNS));
  result = result.replace(/\{random_name\}/gi, () => pick(RANDOM_NAMES));
  result = result.replace(/\{random_country\}/gi, () => pick(RANDOM_COUNTRIES));
  result = result.replace(/\{random_superpower\}/gi, () => pick(RANDOM_SUPERPOWERS));
  result = result.replace(/\{random_job\}/gi, () => pick(RANDOM_JOBS));
  result = result.replace(/\{random_vibe\}/gi, () => pick(RANDOM_VIBES));
  result = result.replace(/\{random_aesthetic\}/gi, () => pick(RANDOM_AESTHETICS));
  result = result.replace(/\{random_verdict\}/gi, () => pick(VERDICTS));

  // ── Random — Emojis / Symbols ─────────────────────────────────────────────
  result = result.replace(/\{random_emoji\}/gi, () => pick(RANDOM_EMOJIS));
  result = result.replace(/\{random_animal\}/gi, () => pick(RANDOM_ANIMALS));
  result = result.replace(/\{random_food\}/gi, () => pick(RANDOM_FOODS));
  result = result.replace(/\{random_weapon\}/gi, () => pick(RANDOM_WEAPONS));
  result = result.replace(/\{random_color\}/gi, () => `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0")}`);

  // ── Random — RPG / Fun ────────────────────────────────────────────────────
  result = result.replace(/\{random_rank\}/gi, () => pick(RANDOM_RANKS));
  result = result.replace(/\{random_tier\}/gi, () => `Tier ${rng(1, 5)}`);
  result = result.replace(/\{random_rarity\}/gi, () => pick(RANDOM_RARITIES));
  result = result.replace(/\{random_zodiac\}/gi, () => pick(RANDOM_ZODIACS));
  result = result.replace(/\{random_element\}/gi, () => pick(RANDOM_ELEMENTS));
  result = result.replace(/\{random_season\}/gi, () => pick(["🌸 Spring","☀️ Summer","🍂 Fall","❄️ Winter"]));
  result = result.replace(/\{random_day\}/gi, () => pick(DAYS));
  result = result.replace(/\{random_month\}/gi, () => pick(MONTHS));

  // ── Ship score ─────────────────────────────────────────────────────────────
  result = result.replace(/\{random_ship_score\}/gi, () => {
    const score = rng(0, 100);
    let hearts = "";
    if (score >= 90) hearts = "💞💞💞💞💞";
    else if (score >= 70) hearts = "❤️❤️❤️❤️";
    else if (score >= 50) hearts = "💛💛💛";
    else if (score >= 30) hearts = "💔💔";
    else hearts = "💀";
    return `${score}% ${hearts}`;
  });

  // ── Math ──────────────────────────────────────────────────────────────────
  result = result.replace(/\{math:([^}]+)\}/gi, (_, expr) => {
    try {
      const safe = expr.replace(/[^0-9+\-*/.() ]/g, "");
      const val = Function(`"use strict"; return (${safe})`)();
      return typeof val === "number" && isFinite(val) ? String(Math.round(val * 1000) / 1000) : "?";
    } catch {
      return "?";
    }
  });

  // ── Repeat ────────────────────────────────────────────────────────────────
  result = result.replace(/\{repeat:(\d+):([^}]+)\}/gi, (_, n, text) => {
    const count = Math.min(Number(n), 20);
    return Array(count).fill(text).join(" ");
  });

  // ── Choose random from list ───────────────────────────────────────────────
  // {choose:option1|option2|option3}
  result = result.replace(/\{choose:([^}]+)\}/gi, (_, opts) => {
    const options = opts.split("|").map((s: string) => s.trim()).filter(Boolean);
    return options.length > 0 ? pick(options) : "";
  });

  // ── Misc / Extra ──────────────────────────────────────────────────────────
  result = result.replace(/\{prefix\}/gi, "?m");
  result = result.replace(/\{newline\}/gi, "\n");
  result = result.replace(/\{empty\}/gi, "");
  result = result.replace(/\{zero_width\}/gi, "\u200b");

  return result;
}

// ─── Command Handler ────────────────────────────────────────────────────────

export async function handleModuleCommand(message: Message): Promise<void> {
  if (!message.guild) {
    await message.reply("This command can only be used in a server.").catch(() => {});
    return;
  }

  const content = message.content.trim();
  const parts = content.split(/\s+/);
  const sub = parts[1]?.toLowerCase();

  // ?m help — secret, only visible to the invoker via DM
  if (sub === "help") {
    await handleModuleHelp(message);
    return;
  }

  if (!isAdmin(message)) {
    await message.reply("❌ You need **Administrator** permission to manage modules.").catch(() => {});
    return;
  }

  if (sub === "create") {
    await handleCreate(message, parts.slice(2));
  } else if (sub === "list") {
    await handleList(message);
  } else if (sub === "delete") {
    await handleDelete(message, parts.slice(2));
  } else {
    await message.reply(
      "**Module Manager — Usage:**\n" +
      "`?m create <prefix> <command> <message> [reply: true/false] [embed: true/false]`\n" +
      "`?m list` — Show all custom modules\n" +
      "`?m delete <prefix> <command>` — Remove a module\n\n" +
      "**Examples:**\n" +
      "`?m create ? gay {user} is {random_percentage} gay`\n" +
      "`?m create ? roast {user} is a {random_adjective} {random_insult}`"
    ).catch(() => {});
  }
}

async function handleModuleHelp(message: Message): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle("📦 Module Manager — Variable Reference")
    .setDescription("All variables you can use inside module messages. Create modules with `?m create`.")
    .addFields(
      {
        name: "👤 Invoker (you)",
        value: [
          "`{user}` — your mention",
          "`{user.name}` — your username",
          "`{user.displayname}` — your server nickname",
          "`{user.id}` — your user ID",
          "`{user.tag}` — your tag",
          "`{user.created}` — account creation date",
          "`{user.joined}` — server join date",
          "`{user.roles}` — number of roles you have",
          "`{user.top_role}` — your highest role",
          "`{user.color}` — your role color hex",
        ].join("\n"),
      },
      {
        name: "🎯 Target (first @mention in command)",
        value: [
          "`{target}` — mentioned user's mention (falls back to you)",
          "`{target.name}` — their username",
          "`{target.displayname}` — their server nickname",
          "`{target.id}` — their user ID",
          "`{target.tag}` — their tag",
          "`{target.created}` — account creation date",
          "`{target.joined}` — server join date",
          "`{target.top_role}` — their highest role",
          "`{target.avatar}` — their avatar URL",
        ].join("\n"),
      },
      {
        name: "🏰 Server",
        value: [
          "`{server}` or `{server.name}` — server name",
          "`{server.id}` — server ID",
          "`{server.members}` — member count",
          "`{server.channels}` — channel count",
          "`{server.roles}` — role count",
          "`{server.owner}` — owner mention",
          "`{server.created}` — creation date",
          "`{server.boost_level}` — boost tier (0–3)",
          "`{server.boosts}` — total boost count",
        ].join("\n"),
      },
      {
        name: "📺 Channel",
        value: [
          "`{channel}` — channel mention",
          "`{channel.name}` — channel name",
          "`{channel.id}` — channel ID",
          "`{channel.topic}` — channel topic",
        ].join("\n"),
      },
      {
        name: "✉️ Message & Args",
        value: [
          "`{args}` — everything typed after the trigger",
          "`{args.1}`, `{args.2}` … — specific word from args (1-indexed)",
          "`{args.1:fallback}` — arg with fallback if empty",
          "`{message.id}` — message ID",
          "`{message.link}` — jump URL",
        ].join("\n"),
      },
      {
        name: "🕐 Time & Date",
        value: [
          "`{time}` — current UTC time",
          "`{date}` — current UTC date",
          "`{datetime}` — full date + time",
          "`{day}` — current day of week",
          "`{month}` — current month name",
          "`{year}` — current year",
          "`{hour}`, `{minute}` — UTC hour / minute",
          "`{unix}` — Unix timestamp",
          "`{timestamp}` — Discord full timestamp",
          "`{timestamp.r}` — Discord relative timestamp",
        ].join("\n"),
      },
      {
        name: "🎲 Random — Numbers & Choices",
        value: [
          "`{random_percentage}` — 0–100%",
          "`{random_number}` — 1–100",
          "`{random_number:1:10}` — custom min:max range",
          "`{random_year}` — 1900–2099",
          "`{random_letter}` — A–Z",
          "`{dice}` — 1–6 die roll",
          "`{dice:20}` — custom N-sided die",
          "`{coinflip}` — Heads or Tails",
          "`{yesno}` — Yes or No",
          "`{8ball}` — 8-ball response",
          "`{choose:a|b|c}` — pick random from list",
        ].join("\n"),
      },
      {
        name: "💬 Random — Words & Text",
        value: [
          "`{random_word}` — random adjective word",
          "`{random_insult}` — random insult",
          "`{random_compliment}` — random compliment",
          "`{random_fact}` — random fun fact",
          "`{random_adjective}` — e.g. chronically, terminally",
          "`{random_verb}` — e.g. speedrunning, manifesting",
          "`{random_noun}` — e.g. goblin, legend",
          "`{random_name}` — random first name",
          "`{random_country}` — random country",
          "`{random_superpower}` — random superpower",
          "`{random_job}` — random job title",
          "`{random_vibe}` — e.g. final boss, NPC",
          "`{random_aesthetic}` — e.g. vaporwave, cottagecore",
          "`{random_verdict}` — GUILTY, BASED, MID, etc.",
        ].join("\n"),
      },
      {
        name: "🎨 Random — Emojis & Visuals",
        value: [
          "`{random_emoji}` — random emoji",
          "`{random_animal}` — random animal emoji",
          "`{random_food}` — random food emoji",
          "`{random_weapon}` — random weapon emoji",
          "`{random_color}` — random hex color code",
        ].join("\n"),
      },
      {
        name: "🎮 Random — RPG & Fun",
        value: [
          "`{random_rank}` — S+, A, B, F, SSS…",
          "`{random_tier}` — Tier 1–5",
          "`{random_rarity}` — Common → Unobtainable",
          "`{random_zodiac}` — random zodiac sign",
          "`{random_element}` — Fire, Water, Void…",
          "`{random_season}` — Spring/Summer/Fall/Winter",
          "`{random_day}` — random day of week",
          "`{random_month}` — random month",
          "`{random_ship_score}` — 0–100% with hearts ❤️",
        ].join("\n"),
      },
      {
        name: "⚙️ Utility",
        value: [
          "`{math:2+2}` — evaluate a math expression",
          "`{repeat:3:word}` — repeat text N times (max 20)",
          "`{newline}` — line break",
          "`{prefix}` — ?m",
          "`{empty}` — empty string",
        ].join("\n"),
      },
      {
        name: "📝 Example Modules",
        value: [
          "`?m create ? gay {user} is {random_percentage} gay`",
          "`?m create ? roast {target} is a {random_adjective} {random_insult}`",
          "`?m create ? ship {user} ❤️ {target} — {random_ship_score}`",
          "`?m create ? rarity your rarity is **{random_rarity}** {random_rank}`",
          "`?m create ? fact 💡 {random_fact}`",
          "`?m create ? verdict {target} — verdict: **{random_verdict}**`",
          "`?m create ? roll 🎲 you rolled a {dice:20}!`",
          "`?m create ? choose {choose:pizza|burger|sushi} for dinner`",
        ].join("\n"),
      }
    )
    .setFooter({ text: "Module Manager • Variables" })
    .setTimestamp();

  try {
    await message.author.send({ embeds: [embed] });
    await message.reply({ content: "📬 Sent to your DMs!" }).catch(() => {});
  } catch {
    await message.reply({ embeds: [embed] }).catch(() => {});
  }
}

async function handleCreate(message: Message, args: string[]): Promise<void> {
  if (args.length < 3) {
    await message.reply(
      "❌ Not enough arguments.\n" +
      "Usage: `?m create <prefix> <command> <message> [reply: true/false] [embed: true/false]`\n" +
      "Example: `?m create ? gay {user} is {random_percentage} gay`\n" +
      "Tip: Use `?m help` to see all available `{variables}`."
    ).catch(() => {});
    return;
  }

  const prefix = args[0];
  const command = args[1];

  let remaining = args.slice(2);

  let embed = false;
  let reply = true;

  if (remaining.length >= 1 && (remaining[remaining.length - 1] === "true" || remaining[remaining.length - 1] === "false")) {
    embed = parseBool(remaining[remaining.length - 1], false);
    remaining = remaining.slice(0, -1);
  }

  if (remaining.length >= 1 && (remaining[remaining.length - 1] === "true" || remaining[remaining.length - 1] === "false")) {
    reply = parseBool(remaining[remaining.length - 1], true);
    remaining = remaining.slice(0, -1);
  }

  const msg = remaining.join(" ");

  if (!msg) {
    await message.reply("❌ Message cannot be empty.").catch(() => {});
    return;
  }

  const trigger = prefix + command;
  if (trigger.length > 50) {
    await message.reply("❌ Prefix + command combined must be 50 characters or less.").catch(() => {});
    return;
  }

  const guildId = message.guild!.id;
  const modules = await loadModules(guildId);

  const existing = modules.findIndex(
    (m) => m.prefix === prefix && m.command.toLowerCase() === command.toLowerCase()
  );

  const mod: CustomModule = { prefix, command, message: msg, reply, embed };

  if (existing !== -1) {
    modules[existing] = mod;
    await saveModules(guildId, modules);
    await message.reply(
      `✅ Module \`${trigger}\` updated.\n` +
      `> Message: **${msg}**\n` +
      `> Reply: \`${reply}\` · Embed: \`${embed}\``
    ).catch(() => {});
  } else {
    modules.push(mod);
    await saveModules(guildId, modules);
    await message.reply(
      `✅ Module \`${trigger}\` created!\n` +
      `> Message: **${msg}**\n` +
      `> Reply: \`${reply}\` · Embed: \`${embed}\``
    ).catch(() => {});
  }
}

async function handleList(message: Message): Promise<void> {
  const guildId = message.guild!.id;
  const modules = await loadModules(guildId);

  if (modules.length === 0) {
    await message.reply("No custom modules created yet. Use `?m create` to add one.").catch(() => {});
    return;
  }

  const lines = modules.map(
    (m, i) =>
      `\`${i + 1}.\` **${m.prefix}${m.command}** — "${m.message}" ` +
      `[reply: ${m.reply}, embed: ${m.embed}]`
  );

  const embed = new EmbedBuilder()
    .setTitle(`Custom Modules — ${message.guild!.name}`)
    .setDescription(lines.join("\n"))
    .setColor(0x2f3136)
    .setFooter({ text: `${modules.length} module${modules.length === 1 ? "" : "s"}` });

  await message.reply({ embeds: [embed] }).catch(() => {});
}

async function handleDelete(message: Message, args: string[]): Promise<void> {
  if (args.length < 2) {
    await message.reply("Usage: `?m delete <prefix> <command>`\nExample: `?m delete ? gay`").catch(() => {});
    return;
  }

  const [prefix, command] = args;
  const guildId = message.guild!.id;
  const modules = await loadModules(guildId);

  const idx = modules.findIndex(
    (m) => m.prefix === prefix && m.command.toLowerCase() === command!.toLowerCase()
  );

  if (idx === -1) {
    await message.reply(`❌ No module found for trigger \`${prefix}${command}\`.`).catch(() => {});
    return;
  }

  modules.splice(idx, 1);
  await saveModules(guildId, modules);
  await message.reply(`✅ Module \`${prefix}${command}\` deleted.`).catch(() => {});
}

export async function runCustomModules(message: Message): Promise<boolean> {
  if (!message.guild) return false;

  let modules: CustomModule[];
  try {
    modules = await loadModules(message.guild.id);
  } catch {
    return false;
  }

  const content = message.content;

  for (const mod of modules) {
    const trigger = mod.prefix + mod.command;
    if (!content.toLowerCase().startsWith(trigger.toLowerCase())) continue;

    // Everything after the trigger (the args the user typed)
    const triggerArgs = content.slice(trigger.length);

    const resolvedMessage = resolveVariables(mod.message, message, triggerArgs);

    const ch = message.channel;
    const canSend = "send" in ch && typeof (ch as TextChannel).send === "function";

    if (mod.embed) {
      const embed = new EmbedBuilder()
        .setDescription(resolvedMessage)
        .setColor(0x2f3136);

      if (mod.reply) {
        await message.reply({ embeds: [embed] }).catch(() => {});
      } else if (canSend) {
        await (ch as TextChannel | NewsChannel | ThreadChannel).send({ embeds: [embed] }).catch(() => {});
      }
    } else {
      if (mod.reply) {
        await message.reply(resolvedMessage).catch(() => {});
      } else if (canSend) {
        await (ch as TextChannel | NewsChannel | ThreadChannel).send(resolvedMessage).catch(() => {});
      }
    }

    return true;
  }

  return false;
}
