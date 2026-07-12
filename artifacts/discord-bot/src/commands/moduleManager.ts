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

// ── New basic arrays ───────────────────────────────────────────────────────────
const RANDOM_PLANETS = ["☿ Mercury","♀ Venus","🌍 Earth","♂ Mars","♃ Jupiter","♄ Saturn","⛢ Uranus","♆ Neptune","✦ Pluto"];
const RANDOM_SPORTS = ["⚽ Football","🏀 Basketball","🎾 Tennis","🏈 American Football","⚾ Baseball","🏐 Volleyball","🏒 Hockey","🥊 Boxing","🎿 Skiing","🏊 Swimming","🎯 Darts","♟️ Chess"];
const RANDOM_INSTRUMENTS = ["🎸 Guitar","🎹 Piano","🥁 Drums","🎺 Trumpet","🎻 Violin","🪗 Accordion","🎷 Saxophone","🪘 Bass","🎵 Flute","🪕 Banjo"];
const RANDOM_COLOR_NAMES = ["Crimson","Azure","Obsidian","Ivory","Scarlet","Cobalt","Emerald","Amber","Violet","Onyx","Sapphire","Magenta","Teal","Maroon","Lavender","Coral","Indigo","Jade","Bronze","Turquoise"];
const RANDOM_LANGUAGES = ["TypeScript","Python","Rust","Go","C++","Zig","Haskell","Elixir","Kotlin","Swift","Ruby","Lua","Java","Scala","OCaml"];
const RANDOM_MUSIC_GENRES = ["Pop","Rock","Hip-Hop","Jazz","Classical","Metal","Lo-fi","R&B","Indie","EDM","Reggae","Punk","Soul","Country","Vaporwave"];
const RANDOM_WEATHERS = ["☀️ Sunny","🌧️ Rainy","⛈️ Thunderstorm","❄️ Snowy","🌫️ Foggy","🌤️ Partly Cloudy","🌪️ Tornado","🌊 Tsunami","🌨️ Blizzard","🌵 Dry Heat"];
const RANDOM_MYTHICALS = ["🐉 Dragon","🦅 Phoenix","🦄 Unicorn","🧜 Mermaid","👹 Oni","🧛 Vampire","🐍 Basilisk","🦁 Chimera","👁️ Cyclops","🌙 Werewolf","🧚 Fairy","🏔️ Giant","🧞 Djinn","🦋 Mothman"];
const RANDOM_GEMSTONES = ["💎 Diamond","❤️ Ruby","💙 Sapphire","💚 Emerald","💜 Amethyst","🧡 Amber","💛 Topaz","🩵 Aquamarine","🖤 Obsidian","🤍 Pearl","🩷 Rose Quartz","🟢 Jade"];
const RANDOM_CLASSES = ["⚔️ Warrior","🔮 Mage","🗡️ Rogue","🛡️ Paladin","🏹 Ranger","⚡ Sorcerer","🌿 Druid","💀 Necromancer","🔥 Pyromancer","🌊 Hydromancer","👊 Monk","🎭 Bard","🗺️ Explorer","🧿 Oracle"];
const RANDOM_ALIGNMENTS = ["Lawful Good","Neutral Good","Chaotic Good","Lawful Neutral","True Neutral","Chaotic Neutral","Lawful Evil","Neutral Evil","Chaotic Evil"];
const RANDOM_EXCUSES = [
  "my dog walked across my keyboard","my internet died mid-round","I was lagging","I had 2fps","someone was talking to me","I sneezed at the worst time",
  "my mouse ran out of battery","I was eating","skill issue (not mine)","the game cheated","I was testing something","I was going easy on them",
];
const RANDOM_FLAGS = ["🇯🇵","🇺🇸","🇬🇧","🇧🇷","🇩🇪","🇫🇷","🇰🇷","🇨🇦","🇦🇺","🇳🇬","🇪🇸","🇲🇽","🇮🇳","🇮🇩","🇸🇪","🇵🇭","🇹🇷","🇦🇷","🇵🇱","🇳🇱"];
const RANDOM_DRINKS = ["☕ Coffee","🧃 Juice","🍵 Tea","🧋 Boba","🥤 Soda","🍺 Beer","🍷 Wine","🥛 Milk","💧 Water","🍹 Cocktail","🧉 Mate","🫖 Herbal Tea"];
const RANDOM_PLANTS = ["🌹 Rose","🌻 Sunflower","🌿 Fern","🎋 Bamboo","🌵 Cactus","🍀 Clover","🌸 Cherry Blossom","🌺 Hibiscus","🍄 Mushroom","🌲 Pine","🌴 Palm","🪴 Potted Plant"];
const RANDOM_GEMS_EMOJI = ["💎","♦️","🔷","🟦","🟩","🔴","🟡","🟣","⬛","🤍"];
const RANDOM_STATUSES = ["🟢 Online","🌙 Idle","⛔ Do Not Disturb","⚫ Offline","🎮 Playing","📡 Streaming","🎧 Listening"];
const RANDOM_REGIONS = ["🌎 NA","🌍 EU","🌏 ASIA","🦘 OCE","🌐 GLOBAL","🏔️ SA","🌑 MENA"];
const RANDOM_GENRES_GAME = ["Battle Royale","MMORPG","FPS","RTS","Roguelike","Sandbox","Visual Novel","MOBA","Rhythm","Platformer","Soulslike","Idle","Horror","Simulation"];
const RANDOM_PLATFORMS = ["💻 PC","🎮 Console","📱 Mobile","🕹️ Handheld","☁️ Cloud","🖥️ Browser"];
const RANDOM_PRIORITIES = ["🔴 Critical","🟠 High","🟡 Medium","🟢 Low","⬛ None","🔱 MAXIMUM OVERDRIVE"];

// ── New advanced arrays ────────────────────────────────────────────────────────
const RANDOM_PROPHECIES = [
  "The one who {random_verb} shall inherit the server.",
  "When the {random_element} meets the {random_element}, chaos reigns.",
  "A {random_rarity} soul walks among you — undetected.",
  "The {random_rank} shall fall. The {random_rank} shall rise.",
  "Beware the {random_noun} who speaks in riddles.",
  "Before the sun sets, a great {random_noun} will be revealed.",
  "The stars align for {target} — their destiny is {random_rank}.",
];
const RANDOM_FORTUNES = [
  "Your next decision will be questionable but memorable.",
  "A great opportunity disguised as a W is coming your way.",
  "Someone is thinking about you right now. It's not flattering.",
  "The answer you seek is 42.",
  "You will experience great lag at a critical moment.",
  "Beware of strangers bearing gift cards.",
  "Your true power will be unlocked after you touch grass.",
  "A plot twist approaches. You are not the main character.",
  "Unexpected XP incoming. Prepare your grind.",
  "The best loot drops when you least expect it.",
];
const RANDOM_QUESTS = [
  "The {random_adjective} Hunt for the {random_gemstone}",
  "Siege of the {random_adjective} Fortress",
  "Curse of the {random_mythical}",
  "The Last {random_element} Keeper",
  "Trial of the {random_alignment} Champion",
  "Descent into the {random_adjective} Void",
  "The {random_rarity} Artifact Recovery",
  "Confronting the {random_class} of Doom",
];
const RANDOM_SPELLS = [
  "Arcane Obliteration","Temporal Fracture","Voidstep","Soul Burn","Null Cascade",
  "Shadow Collapse","Ember Nova","Glacial Rupture","Mindshatter","Spectral Lance",
  "Divine Reckoning","Chaos Pulse","Ethereal Bind","Storm Surge","Death Knell",
];
const RANDOM_TITLES = [
  "Lord of the Forgotten Realm","Grand Sentinel of Chaos","Keeper of Lost Memes",
  "Destroyer of Sanity","Warden of the Void","High Priest of Cringe",
  "Eternal Champion of Mid","Overlord of Overthinking","Duke of Disaster",
  "Archmage of the Obvious","Baron of Bad Takes","Knight of the Throwing Arc",
];
const RANDOM_THREATS = [
  "I will find your IP and switch you to 144Hz.",
  "One more word and I'm muting your music.",
  "Keep it up and I'll tell everyone your browser history.",
  "Say that again and I'm voting to kick.",
  "Touch my loadout one more time. I dare you.",
  "I will lag switch you into the shadow realm.",
  "One more bad take and I'm NFT-ing your profile picture.",
];
const RANDOM_PICKUP_LINES = [
  "Are you a Discord server? Because I want to join you.",
  "Is your name Google? Because you have everything I've been searching for.",
  "Are you a keyboard? Because you're just my type.",
  "Do you have a map? I keep getting lost in your eyes.",
  "Are you Wi-Fi? Because I'm feeling a connection.",
  "Are you a GPU? Because you're making everything look better.",
  "Is your ping low? Because you seem like a keeper.",
  "Are you 144Hz? Because you're smooth.",
];
const RANDOM_DIAGNOSES = [
  "chronically online","terminally mid","skill issue (hereditary)","main character syndrome",
  "acute W deficiency","advanced NPC behavior","severe lore addiction","critical overthinking disorder",
  "hyper-fixation on side quests","irreversible sigma grindset","stage 4 copium dependency",
  "terminal sussy-ness","chronic plot armor reliance",
];
const RANDOM_CATCHPHRASES = [
  "trust the process","it is what it is","no cap fr fr","on god","we move","we stay winning",
  "diff","let him cook","he's cooked","not like this","this is the way","skill issue",
  "stay mad","ratio","touch grass","L + bozo","real","based and redpilled","certified W",
];
const RANDOM_ANIMES = [
  "Attack on Titan","Jujutsu Kaisen","Demon Slayer","One Piece","Naruto","Hunter x Hunter",
  "Fullmetal Alchemist: Brotherhood","Death Note","Steins;Gate","Mob Psycho 100",
  "Chainsaw Man","Spy x Family","Bleach","Dragon Ball Z","Tokyo Revengers",
];
const RANDOM_LORE = [
  "It is said that in the ancient times, {user} once carried an entire server on their back.",
  "The scrolls speak of a great {random_rarity} warrior who {random_verb} their way to glory.",
  "Legend has it that {target} was once a {random_class} of immense power.",
  "Ancient texts describe a calamity triggered by a single bad take.",
  "The elders whisper of a time when the {random_element} was balanced.",
  "It was foretold: when two {random_nouns} meet, the server will be forever changed.",
];
const RANDOM_MOTIVATIONS = [
  "You miss 100% of the shots you don't take. You also miss most of the shots you do take. Keep shooting.",
  "Every expert was once a disaster. You're halfway there.",
  "The grind doesn't stop just because you're tired. It stops when you're dead.",
  "Be the main character you wish to see in the world.",
  "Failure is just success that hasn't respawned yet.",
  "You are not cooked. You are marinating.",
  "Go beyond. Plus ultra. Touch grass. Come back stronger.",
];
const RANDOM_WARNINGS = [
  "⚠️ WARNING: Prolonged exposure to this user may cause brain cell loss.",
  "⚠️ CAUTION: Contents may be unhinged.",
  "⚠️ ALERT: This message contains {random_percentage} cringe.",
  "⚠️ NOTICE: Viewer discretion is advised. Mostly for your own sanity.",
  "⚠️ DANGER: This is not a drill. Actually it might be.",
  "⚠️ SYSTEM: Anomaly detected. Source: {user}.",
];
const RANDOM_ERRORS = [
  "Error 404: Brain not found.","NullPointerException: skill is null.",
  "SEGFAULT at address 0xDEADBEEF","RuntimeError: too much cringe in one message.",
  "TypeError: expected W, got L instead.","Stack overflow: too many bad takes.",
  "FATAL: copium levels critical.","IndexError: argument out of range (of reason).",
  "UnhandledPromiseRejection: reality check failed.",
];
const RANDOM_REVIEWS = [
  "⭐☆☆☆☆ — Would not recommend. Brought too much chaos.",
  "⭐⭐⭐⭐⭐ — Absolute menace. 10/10 would be destroyed by again.",
  "⭐⭐⭐☆☆ — Mid but in a weirdly charming way.",
  "⭐⭐☆☆☆ — Showed up, caused problems, left. Classic.",
  "⭐⭐⭐⭐☆ — Carried hard but refuses to acknowledge it.",
  "⭐☆☆☆☆ — Still don't know what they were trying to do.",
];
const RANDOM_MISSIONS = [
  "Operation Silent Goblin","Mission: Absolute Chaos","Task: Undo the Undoable",
  "Protocol OMEGA","Directive: Speedrun Reality","Assignment: Cope and Seethe",
  "Project Null Pointer","Initiative: Main Character Arc","Directive Sigma",
  "Mission: Touch Grass","Operation: Find the W","Task Force: NPC Patrol",
];
const RANDOM_USERNAMES = [
  "DarkNova_99","xXProSlayer420Xx","goblin_mode_on","certified_menace","NPC_7734",
  "voidwalker_irl","silent_chaos","that_one_guy","404_skill_not_found","omega_grinder",
  "based_enjoyer","plot_armor_user","gg_ez_fr","lag_excuse_guy","lore_accurate",
];

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
  result = result.replace(/\{space\}/gi, " ");

  // ════════════════════════════════════════════════════════════════════════
  // NEW BASIC VARIABLES (60)
  // ════════════════════════════════════════════════════════════════════════

  // ── Time extras ───────────────────────────────────────────────────────────
  result = result.replace(/\{second\}/gi, String(now.getUTCSeconds()));
  result = result.replace(/\{week\}/gi, () => {
    const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    return String(Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getUTCDay() + 1) / 7));
  });
  result = result.replace(/\{quarter\}/gi, `Q${Math.ceil((now.getUTCMonth() + 1) / 3)}`);
  result = result.replace(/\{time\.12\}/gi, () => {
    const h = now.getUTCHours();
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${pad(now.getUTCMinutes())} ${ampm} UTC`;
  });
  result = result.replace(/\{morning\}/gi, () => {
    const h = now.getUTCHours();
    if (h < 6) return "🌙 Night";
    if (h < 12) return "🌅 Morning";
    if (h < 17) return "☀️ Afternoon";
    if (h < 21) return "🌆 Evening";
    return "🌙 Night";
  });

  // ── User extras ───────────────────────────────────────────────────────────
  result = result.replace(/\{user\.boosting\}/gi, member?.premiumSince ? "✅ Yes" : "❌ No");
  result = result.replace(/\{user\.timeout\}/gi, member?.communicationDisabledUntil ? "⏸️ Yes" : "✅ No");
  result = result.replace(/\{user\.in_voice\}/gi, member?.voice.channel ? "🔊 Yes" : "🔇 No");
  result = result.replace(/\{user\.voice_channel\}/gi, member?.voice.channel?.name ?? "Not in voice");
  result = result.replace(/\{user\.pending\}/gi, member?.pending ? "⏳ Pending" : "✅ Verified");

  // ── Target extras ─────────────────────────────────────────────────────────
  result = result.replace(/\{target\.color\}/gi, mentioned?.roles.highest.hexColor ?? "#ffffff");
  result = result.replace(/\{target\.roles\}/gi, String((mentioned?.roles.cache.size ?? 1) - 1));
  result = result.replace(/\{target\.boosting\}/gi, mentioned?.premiumSince ? "✅ Yes" : "❌ No");
  result = result.replace(/\{target\.in_voice\}/gi, mentioned?.voice.channel ? "🔊 Yes" : "🔇 No");
  result = result.replace(/\{target\.timeout\}/gi, mentioned?.communicationDisabledUntil ? "⏸️ Yes" : "✅ No");

  // ── Server extras ─────────────────────────────────────────────────────────
  result = result.replace(/\{server\.verification\}/gi, () => {
    const levels = ["None","Low","Medium","High","Very High"];
    return levels[guild?.verificationLevel ?? 0] ?? "Unknown";
  });
  result = result.replace(/\{server\.age\}/gi, () => {
    if (!guild) return "Unknown";
    const days = Math.floor((Date.now() - guild.createdTimestamp) / 86400000);
    return `${days} days`;
  });
  result = result.replace(/\{server\.nsfw\}/gi, () => {
    const levels = ["Default","Explicit Disabled","Safe","Age Restricted"];
    return levels[guild?.nsfwLevel ?? 0] ?? "Unknown";
  });

  // ── New random numbers ────────────────────────────────────────────────────
  result = result.replace(/\{random_number:(\d+)\}/gi, (_, n) => String(rng(1, Number(n))));
  result = result.replace(/\{random_age\}/gi, () => String(rng(1, 99)));
  result = result.replace(/\{random_iq\}/gi, () => String(rng(60, 200)));
  result = result.replace(/\{random_temperature\}/gi, () => `${rng(-20, 50)}°C`);
  result = result.replace(/\{random_speed\}/gi, () => `${rng(1, 300)} km/h`);
  result = result.replace(/\{random_weight\}/gi, () => `${rng(1, 200)} kg`);
  result = result.replace(/\{random_height\}/gi, () => `${rng(100, 220)} cm`);
  result = result.replace(/\{random_level\}/gi, () => String(rng(1, 100)));
  result = result.replace(/\{random_xp\}/gi, () => String(rng(0, 99999)));
  result = result.replace(/\{random_gold\}/gi, () => String(rng(0, 10000)));
  result = result.replace(/\{random_ping\}/gi, () => `${rng(1, 999)}ms`);
  result = result.replace(/\{random_fps\}/gi, () => pick(["30","60","75","120","144","240"]));
  result = result.replace(/\{random_percentage_decimal\}/gi, () => `${(Math.random() * 100).toFixed(2)}%`);
  result = result.replace(/\{random_bool\}/gi, () => (Math.random() < 0.5 ? "true" : "false"));

  // ── New random text ───────────────────────────────────────────────────────
  result = result.replace(/\{random_planet\}/gi, () => pick(RANDOM_PLANETS));
  result = result.replace(/\{random_sport\}/gi, () => pick(RANDOM_SPORTS));
  result = result.replace(/\{random_instrument\}/gi, () => pick(RANDOM_INSTRUMENTS));
  result = result.replace(/\{random_color_name\}/gi, () => pick(RANDOM_COLOR_NAMES));
  result = result.replace(/\{random_language\}/gi, () => pick(RANDOM_LANGUAGES));
  result = result.replace(/\{random_music_genre\}/gi, () => pick(RANDOM_MUSIC_GENRES));
  result = result.replace(/\{random_weather\}/gi, () => pick(RANDOM_WEATHERS));
  result = result.replace(/\{random_mythical\}/gi, () => pick(RANDOM_MYTHICALS));
  result = result.replace(/\{random_gemstone\}/gi, () => pick(RANDOM_GEMSTONES));
  result = result.replace(/\{random_class\}/gi, () => pick(RANDOM_CLASSES));
  result = result.replace(/\{random_alignment\}/gi, () => pick(RANDOM_ALIGNMENTS));
  result = result.replace(/\{random_excuse\}/gi, () => pick(RANDOM_EXCUSES));
  result = result.replace(/\{random_flag\}/gi, () => pick(RANDOM_FLAGS));
  result = result.replace(/\{random_drink\}/gi, () => pick(RANDOM_DRINKS));
  result = result.replace(/\{random_plant\}/gi, () => pick(RANDOM_PLANTS));
  result = result.replace(/\{random_gem\}/gi, () => pick(RANDOM_GEMS_EMOJI));
  result = result.replace(/\{random_status\}/gi, () => pick(RANDOM_STATUSES));
  result = result.replace(/\{random_region\}/gi, () => pick(RANDOM_REGIONS));
  result = result.replace(/\{random_genre\}/gi, () => pick(RANDOM_GENRES_GAME));
  result = result.replace(/\{random_platform\}/gi, () => pick(RANDOM_PLATFORMS));
  result = result.replace(/\{random_priority\}/gi, () => pick(RANDOM_PRIORITIES));
  result = result.replace(/\{random_grade\}/gi, () => pick(["A+","A","B+","B","C+","C","D","F"]));
  result = result.replace(/\{random_username\}/gi, () => pick(RANDOM_USERNAMES));
  result = result.replace(/\{random_direction\}/gi, () => pick(["⬆️ North","⬇️ South","➡️ East","⬅️ West","↗️ Northeast","↙️ Southwest"]));

  // ── Visual bars & meters ──────────────────────────────────────────────────
  result = result.replace(/\{random_stars\}/gi, () => {
    const n = rng(1, 5);
    return "⭐".repeat(n) + "☆".repeat(5 - n);
  });
  result = result.replace(/\{random_battery\}/gi, () => {
    const pct = rng(0, 100);
    const icon = pct > 60 ? "🔋" : pct > 20 ? "🪫" : "❌";
    return `${icon} ${pct}%`;
  });
  result = result.replace(/\{random_wifi\}/gi, () => {
    const bars = rng(0, 4);
    return ["📵 No Signal","📶 Weak","📶📶 Fair","📶📶📶 Good","📶📶📶📶 Excellent"][bars]!;
  });
  result = result.replace(/\{random_loading\}/gi, () => {
    const filled = rng(0, 10);
    return `[${"▓".repeat(filled)}${"░".repeat(10 - filled)}] ${filled * 10}%`;
  });
  result = result.replace(/\{random_poll\}/gi, () => {
    const yes = rng(0, 100);
    return `✅ Yes: ${yes}% | ❌ No: ${100 - yes}%`;
  });

  // ── Args extras ───────────────────────────────────────────────────────────
  result = result.replace(/\{args\.count\}/gi, String(args.length));
  result = result.replace(/\{args\.last\}/gi, args[args.length - 1] ?? "");
  result = result.replace(/\{args\.rest:(\d+)\}/gi, (_, n) => args.slice(Number(n) - 1).join(" "));
  result = result.replace(/\{random_from_args\}/gi, () => args.length > 0 ? pick(args) : "");
  result = result.replace(/\{args\.upper\}/gi, triggerArgs.trim().toUpperCase());
  result = result.replace(/\{args\.lower\}/gi, triggerArgs.trim().toLowerCase());

  // ════════════════════════════════════════════════════════════════════════
  // NEW ADVANCED VARIABLES (40)
  // ════════════════════════════════════════════════════════════════════════

  // ── Text transforms ───────────────────────────────────────────────────────
  result = result.replace(/\{uppercase:([^}]+)\}/gi, (_, t) => t.toUpperCase());
  result = result.replace(/\{lowercase:([^}]+)\}/gi, (_, t) => t.toLowerCase());
  result = result.replace(/\{titlecase:([^}]+)\}/gi, (_, t) =>
    t.replace(/\b\w/g, (c: string) => c.toUpperCase())
  );
  result = result.replace(/\{reverse:([^}]+)\}/gi, (_, t) => t.split("").reverse().join(""));
  result = result.replace(/\{length:([^}]+)\}/gi, (_, t) => String(t.length));
  result = result.replace(/\{bold:([^}]+)\}/gi, (_, t) => `**${t}**`);
  result = result.replace(/\{italic:([^}]+)\}/gi, (_, t) => `*${t}*`);
  result = result.replace(/\{code:([^}]+)\}/gi, (_, t) => `\`${t}\``);
  result = result.replace(/\{spoiler:([^}]+)\}/gi, (_, t) => `||${t}||`);
  result = result.replace(/\{strike:([^}]+)\}/gi, (_, t) => `~~${t}~~`);

  // ── Math extras ───────────────────────────────────────────────────────────
  result = result.replace(/\{min:(-?[\d.]+):(-?[\d.]+)\}/gi, (_, a, b) => String(Math.min(Number(a), Number(b))));
  result = result.replace(/\{max:(-?[\d.]+):(-?[\d.]+)\}/gi, (_, a, b) => String(Math.max(Number(a), Number(b))));
  result = result.replace(/\{clamp:(-?[\d.]+):(-?[\d.]+):(-?[\d.]+)\}/gi, (_, v, mn, mx) =>
    String(Math.min(Math.max(Number(v), Number(mn)), Number(mx)))
  );
  result = result.replace(/\{bar:(\d+)\}/gi, (_, n) => {
    const pct = Math.min(100, Math.max(0, Number(n)));
    const filled = Math.round(pct / 10);
    return `[${"▓".repeat(filled)}${"░".repeat(10 - filled)}] ${pct}%`;
  });
  result = result.replace(/\{percentage_bar:(\d+)\}/gi, (_, n) => {
    const pct = Math.min(100, Math.max(0, Number(n)));
    const filled = Math.round(pct / 10);
    return `[${"▓".repeat(filled)}${"░".repeat(10 - filled)}] ${pct}%`;
  });

  // ── Advanced random ───────────────────────────────────────────────────────
  result = result.replace(/\{random_prophecy\}/gi, () => {
    let p = pick(RANDOM_PROPHECIES);
    p = p.replace(/\{random_element\}/g, () => pick(RANDOM_ELEMENTS));
    p = p.replace(/\{random_rarity\}/g, () => pick(RANDOM_RARITIES));
    p = p.replace(/\{random_rank\}/g, () => pick(RANDOM_RANKS));
    p = p.replace(/\{random_noun\}/g, () => pick(RANDOM_NOUNS));
    p = p.replace(/\{random_verb\}/g, () => pick(RANDOM_VERBS));
    p = p.replace(/\{target\}/g, mentionedUser ? `<@${mentionedUser.id}>` : `<@${author.id}>`);
    return p;
  });
  result = result.replace(/\{random_fortune\}/gi, () => pick(RANDOM_FORTUNES));
  result = result.replace(/\{random_quest\}/gi, () => {
    let q = pick(RANDOM_QUESTS);
    q = q.replace(/\{random_adjective\}/g, () => pick(RANDOM_ADJECTIVES));
    q = q.replace(/\{random_gemstone\}/g, () => pick(RANDOM_GEMSTONES));
    q = q.replace(/\{random_mythical\}/g, () => pick(RANDOM_MYTHICALS));
    q = q.replace(/\{random_element\}/g, () => pick(RANDOM_ELEMENTS));
    q = q.replace(/\{random_alignment\}/g, () => pick(RANDOM_ALIGNMENTS));
    q = q.replace(/\{random_rarity\}/g, () => pick(RANDOM_RARITIES));
    q = q.replace(/\{random_class\}/g, () => pick(RANDOM_CLASSES));
    return q;
  });
  result = result.replace(/\{random_spell\}/gi, () => pick(RANDOM_SPELLS));
  result = result.replace(/\{random_title\}/gi, () => pick(RANDOM_TITLES));
  result = result.replace(/\{random_threat\}/gi, () => pick(RANDOM_THREATS));
  result = result.replace(/\{random_pickup_line\}/gi, () => pick(RANDOM_PICKUP_LINES));
  result = result.replace(/\{random_diagnosis\}/gi, () => pick(RANDOM_DIAGNOSES));
  result = result.replace(/\{random_catchphrase\}/gi, () => pick(RANDOM_CATCHPHRASES));
  result = result.replace(/\{random_anime\}/gi, () => pick(RANDOM_ANIMES));
  result = result.replace(/\{random_lore\}/gi, () => {
    let l = pick(RANDOM_LORE);
    l = l.replace(/\{user\}/g, `<@${author.id}>`);
    l = l.replace(/\{target\}/g, mentionedUser ? `<@${mentionedUser.id}>` : `<@${author.id}>`);
    l = l.replace(/\{random_rarity\}/g, () => pick(RANDOM_RARITIES));
    l = l.replace(/\{random_class\}/g, () => pick(RANDOM_CLASSES));
    l = l.replace(/\{random_element\}/g, () => pick(RANDOM_ELEMENTS));
    l = l.replace(/\{random_noun\}/g, () => pick(RANDOM_NOUNS));
    l = l.replace(/\{random_nouns\}/g, () => pick(RANDOM_NOUNS) + "s");
    l = l.replace(/\{random_verb\}/g, () => pick(RANDOM_VERBS));
    return l;
  });
  result = result.replace(/\{random_motivation\}/gi, () => pick(RANDOM_MOTIVATIONS));
  result = result.replace(/\{random_warning\}/gi, () => {
    let w = pick(RANDOM_WARNINGS);
    w = w.replace(/\{random_percentage\}/g, () => `${rng(0, 100)}%`);
    w = w.replace(/\{user\}/g, `<@${author.id}>`);
    return w;
  });
  result = result.replace(/\{random_error\}/gi, () => pick(RANDOM_ERRORS));
  result = result.replace(/\{random_review\}/gi, () => pick(RANDOM_REVIEWS));
  result = result.replace(/\{random_mission\}/gi, () => pick(RANDOM_MISSIONS));
  result = result.replace(/\{random_power_level\}/gi, () => `${rng(1000, 9999999).toLocaleString()} 💥`);
  result = result.replace(/\{random_skill\}/gi, () => `${rng(1, 100)}% skill in ${pick(RANDOM_VERBS).replace(/ing$/, "")}`);
  result = result.replace(/\{random_confession\}/gi, () => {
    const subject = pick([`<@${author.id}>`, "someone in this server", "a certain individual"]);
    return `${subject} confesses: they have ${pick(RANDOM_DIAGNOSES)} and they know it.`;
  });

  // ── Timestamp variants ────────────────────────────────────────────────────
  result = result.replace(/\{random_timestamp_past\}/gi, () => {
    const past = Math.floor((Date.now() - rng(3600000, 2592000000)) / 1000);
    return `<t:${past}:R>`;
  });
  result = result.replace(/\{random_timestamp_future\}/gi, () => {
    const future = Math.floor((Date.now() + rng(3600000, 2592000000)) / 1000);
    return `<t:${future}:R>`;
  });
  result = result.replace(/\{timestamp\.d\}/gi, `<t:${Math.floor(now.getTime() / 1000)}:D>`);
  result = result.replace(/\{timestamp\.t\}/gi, `<t:${Math.floor(now.getTime() / 1000)}:T>`);

  // ── Fake tech ─────────────────────────────────────────────────────────────
  result = result.replace(/\{random_ip\}/gi, () => `${rng(1,254)}.${rng(0,255)}.${rng(0,255)}.${rng(1,254)}`);
  result = result.replace(/\{random_version\}/gi, () => `v${rng(1,9)}.${rng(0,19)}.${rng(0,99)}`);
  result = result.replace(/\{random_hash\}/gi, () => Math.floor(Math.random() * 0xffffff).toString(16).padStart(6,"0") + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6,"0").slice(0,1));
  result = result.replace(/\{random_password\}/gi, () => "•".repeat(rng(8, 16)));

  // ── Conditional ───────────────────────────────────────────────────────────
  // {if:VALUE==CHECK:THEN:ELSE}  — simple string equality check
  result = result.replace(/\{if:([^:}]+)==([^:}]*):([^:}]*):([^}]*)\}/gi, (_, val, check, then_, else_) => {
    return val.trim() === check.trim() ? then_ : else_;
  });
  // {if:VALUE!=CHECK:THEN:ELSE}
  result = result.replace(/\{if:([^:}]+)!=([^:}]*):([^:}]*):([^}]*)\}/gi, (_, val, check, then_, else_) => {
    return val.trim() !== check.trim() ? then_ : else_;
  });

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
        name: "⚙️ Utility & Transforms",
        value: [
          "`{math:2+2}` — evaluate math expression",
          "`{repeat:3:word}` — repeat text N times (max 20)",
          "`{choose:a|b|c}` — pick random from list",
          "`{bar:75}` — visual bar `[▓▓▓▓▓▓▓░░░] 75%`",
          "`{uppercase:text}` — UPPERCASE",
          "`{lowercase:TEXT}` — lowercase",
          "`{titlecase:text}` — Title Case",
          "`{reverse:text}` — txet esreveR",
          "`{length:text}` — character count",
          "`{bold:text}` — **bold**",
          "`{italic:text}` — *italic*",
          "`{code:text}` — `code`",
          "`{spoiler:text}` — ||spoiler||",
          "`{strike:text}` — ~~strikethrough~~",
          "`{min:5:10}` / `{max:5:10}` — math min/max",
          "`{clamp:150:0:100}` — clamp value to range",
          "`{if:VALUE==CHECK:then:else}` — conditional",
          "`{newline}` / `{space}` / `{prefix}` / `{empty}`",
        ].join("\n"),
      },
      {
        name: "🕐 Time (new)",
        value: [
          "`{second}` — current UTC second",
          "`{week}` — week number of year",
          "`{quarter}` — Q1 / Q2 / Q3 / Q4",
          "`{time.12}` — 12-hour format (e.g. 3:42 PM UTC)",
          "`{morning}` — 🌅 Morning / ☀️ Afternoon / 🌆 Evening / 🌙 Night",
          "`{timestamp.d}` — Discord date stamp",
          "`{timestamp.t}` — Discord time stamp",
          "`{random_timestamp_past}` — relative timestamp in past",
          "`{random_timestamp_future}` — relative timestamp in future",
        ].join("\n"),
      },
      {
        name: "👤 User & Target (new)",
        value: [
          "`{user.boosting}` — ✅ Yes / ❌ No (boosting server)",
          "`{user.timeout}` — timed out status",
          "`{user.in_voice}` — 🔊 Yes / 🔇 No",
          "`{user.voice_channel}` — voice channel name",
          "`{user.pending}` — membership screening status",
          "`{target.color}` — target top role color hex",
          "`{target.roles}` — target role count",
          "`{target.boosting}` — target boosting status",
          "`{target.in_voice}` — target in voice?",
          "`{target.timeout}` — target timed out?",
        ].join("\n"),
      },
      {
        name: "🏰 Server (new)",
        value: [
          "`{server.verification}` — None/Low/Medium/High/Very High",
          "`{server.age}` — server age in days",
          "`{server.nsfw}` — NSFW content level",
        ].join("\n"),
      },
      {
        name: "🎲 Random — Numbers (new)",
        value: [
          "`{random_number:50}` — 1 to N shorthand",
          "`{random_age}` — 1–99",
          "`{random_iq}` — 60–200",
          "`{random_temperature}` — −20 to 50°C",
          "`{random_speed}` — 1–300 km/h",
          "`{random_weight}` / `{random_height}`",
          "`{random_level}` — 1–100",
          "`{random_xp}` — 0–99999",
          "`{random_gold}` — 0–10000",
          "`{random_ping}` — 1–999ms",
          "`{random_fps}` — 30/60/144/240",
          "`{random_percentage_decimal}` — 73.42%",
          "`{random_bool}` — true / false",
          "`{random_power_level}` — 1,000–9,999,999 💥",
        ].join("\n"),
      },
      {
        name: "💬 Random — Text (new)",
        value: [
          "`{random_planet}` — ♂ Mars, ♃ Jupiter…",
          "`{random_sport}` — ⚽ Football, 🏀 Basketball…",
          "`{random_instrument}` — 🎸 Guitar, 🎹 Piano…",
          "`{random_color_name}` — Crimson, Azure, Obsidian…",
          "`{random_language}` — TypeScript, Rust, Python…",
          "`{random_music_genre}` — Pop, Metal, Lo-fi…",
          "`{random_weather}` — ☀️ Sunny, ⛈️ Thunderstorm…",
          "`{random_mythical}` — 🐉 Dragon, 🦅 Phoenix…",
          "`{random_gemstone}` — 💎 Diamond, ❤️ Ruby…",
          "`{random_class}` — ⚔️ Warrior, 🔮 Mage, 🗡️ Rogue…",
          "`{random_alignment}` — Lawful Good, Chaotic Evil…",
          "`{random_excuse}` — gaming excuse",
          "`{random_flag}` — 🇯🇵 🇺🇸 🇬🇧…",
          "`{random_drink}` — ☕ Coffee, 🧋 Boba…",
          "`{random_plant}` — 🌹 Rose, 🌵 Cactus…",
          "`{random_gem}` — 💎 ♦️ 🔷…",
          "`{random_status}` — 🟢 Online, 🌙 Idle…",
          "`{random_region}` — 🌎 NA, 🌍 EU, 🌏 ASIA…",
          "`{random_genre}` — Battle Royale, MMORPG, FPS…",
          "`{random_platform}` — 💻 PC, 🎮 Console…",
          "`{random_priority}` — 🔴 Critical, 🟡 Medium…",
          "`{random_grade}` — A+, A, B, C, F",
          "`{random_direction}` — ⬆️ North, ➡️ East…",
          "`{random_username}` — random Discord-style username",
        ].join("\n"),
      },
      {
        name: "🎨 Random — Visual (new)",
        value: [
          "`{random_stars}` — ⭐⭐⭐☆☆ rating",
          "`{random_battery}` — 🔋 73%",
          "`{random_wifi}` — 📶📶📶 Good",
          "`{random_loading}` — [▓▓▓▓▓░░░░░] 50%",
          "`{random_poll}` — ✅ Yes: 73% | ❌ No: 27%",
        ].join("\n"),
      },
      {
        name: "✉️ Args (new)",
        value: [
          "`{args.count}` — number of words in args",
          "`{args.last}` — last word in args",
          "`{args.rest:2}` — args starting from word N",
          "`{args.upper}` — all args uppercased",
          "`{args.lower}` — all args lowercased",
          "`{random_from_args}` — pick random word from args",
        ].join("\n"),
      },
      {
        name: "🔮 Advanced Random (new)",
        value: [
          "`{random_prophecy}` — auto-generated prophecy",
          "`{random_fortune}` — fortune cookie",
          "`{random_quest}` — generated quest name",
          "`{random_spell}` — random spell name",
          "`{random_title}` — noble title",
          "`{random_threat}` — playful threat",
          "`{random_pickup_line}` — pickup line",
          "`{random_diagnosis}` — e.g. chronically online",
          "`{random_catchphrase}` — no cap fr fr, skill issue…",
          "`{random_anime}` — random anime title",
          "`{random_lore}` — generated lore line",
          "`{random_motivation}` — motivational quote",
          "`{random_warning}` — ⚠️ warning label",
          "`{random_error}` — fake error message",
          "`{random_review}` — ⭐ fake review",
          "`{random_mission}` — operation/mission name",
          "`{random_skill}` — 90% skill in procrastin…",
          "`{random_confession}` — auto-generated confession",
          "`{random_ip}` — fake IP address",
          "`{random_version}` — v2.4.1 style version",
          "`{random_hash}` — fake git hash",
          "`{random_password}` — ••••••••",
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
          "`?m create ? class your class is {random_class} ({random_alignment})`",
          "`?m create ? prophecy 🔮 {random_prophecy}`",
          "`?m create ? diagnose {target} has been diagnosed with: **{random_diagnosis}**`",
          "`?m create ? excuse I lost because {random_excuse}`",
          "`?m create ? weather today's vibe: {random_weather} {random_temperature}`",
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
