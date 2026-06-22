import type { Message } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { IMAGE_HANDLERS } from "./assystImage.js";

// ─── Assyst-style commands ────────────────────────────────────────────────────
// Prefix: `?` and `,`  (both work for every command)
// Source-faithful to assyst2 — text/fun/misc commands that don't need the
// external Rust flux image processor.

// ─── 8-ball ───────────────────────────────────────────────────────────────────
const BALL_ANSWERS = [
  "It is certain.", "It is decidedly so.", "Without a doubt.",
  "Yes, definitely.", "You may rely on it.", "As I see it, yes.",
  "Most likely.", "Outlook good.", "Yes.", "Signs point to yes.",
  "Reply hazy, try again.", "Ask again later.", "Better not tell you now.",
  "Cannot predict now.", "Concentrate and ask again.",
  "Don't count on it.", "My reply is no.", "My sources say no.",
  "Outlook not so good.", "Very doubtful.",
];

export async function cmdEightBall(message: Message, args: string[]): Promise<void> {
  const q = args.join(" ").trim();
  if (!q) { await message.reply("Ask me something! `?8b <question>`"); return; }
  const answer = BALL_ANSWERS[Math.floor(Math.random() * BALL_ANSWERS.length)];
  const positive = BALL_ANSWERS.indexOf(answer) < 10;
  const neutral  = BALL_ANSWERS.indexOf(answer) < 15;
  const color = positive ? 0x57f287 : neutral ? 0xfee75c : 0xed4245;
  const e = new EmbedBuilder()
    .setColor(color)
    .setTitle("🎱 Magic 8-Ball")
    .addFields(
      { name: "Question", value: q },
      { name: "Answer",   value: answer },
    );
  await message.reply({ embeds: [e] });
}

// ─── owoify ───────────────────────────────────────────────────────────────────
export async function cmdOwoify(message: Message, args: string[]): Promise<void> {
  const text = args.join(" ");
  if (!text) { await message.reply("Usage: `?owoify <text>`"); return; }
  const result = text
    .replace(/[rl]/g, "w").replace(/[RL]/g, "W")
    .replace(/n([aeiouAEIOU])/g, "ny$1").replace(/N([aeiouAEIOU])/g, "Ny$1")
    .replace(/ove/g, "uv")
    .replace(/!+/g, " owo!").replace(/\. /g, " uwu. ");
  const faces = ["(・`ω´・)", ";;w;;", "owo", "UwU", ">w<", "^w^"];
  await message.reply(`${result} ${faces[Math.floor(Math.random() * faces.length)]}`);
}

// ─── reverse ──────────────────────────────────────────────────────────────────
export async function cmdReverse(message: Message, args: string[]): Promise<void> {
  const text = args.join(" ");
  if (!text) { await message.reply("Usage: `?reverse <text>`"); return; }
  await message.reply([...text].reverse().join(""));
}

// ─── mock (spongebob) ─────────────────────────────────────────────────────────
export async function cmdMock(message: Message, args: string[]): Promise<void> {
  const text = args.join(" ");
  if (!text) { await message.reply("Usage: `?mock <text>`"); return; }
  let out = "";
  let upper = false;
  for (const ch of text) {
    out += upper ? ch.toUpperCase() : ch.toLowerCase();
    if (ch.trim()) upper = !upper;
  }
  await message.reply(out);
}

// ─── clap ─────────────────────────────────────────────────────────────────────
export async function cmdClap(message: Message, args: string[]): Promise<void> {
  const text = args.join(" ");
  if (!text) { await message.reply("Usage: `?clap <text>`"); return; }
  await message.reply(text.split(" ").join(" 👏 "));
}

// ─── upper ────────────────────────────────────────────────────────────────────
export async function cmdUpper(message: Message, args: string[]): Promise<void> {
  const text = args.join(" ");
  if (!text) { await message.reply("Usage: `?upper <text>`"); return; }
  await message.reply(text.toUpperCase());
}

// ─── lower ────────────────────────────────────────────────────────────────────
export async function cmdLower(message: Message, args: string[]): Promise<void> {
  const text = args.join(" ");
  if (!text) { await message.reply("Usage: `?lower <text>`"); return; }
  await message.reply(text.toLowerCase());
}

// ─── roll ─────────────────────────────────────────────────────────────────────
export async function cmdRoll(message: Message, args: string[]): Promise<void> {
  const input = args[0] ?? "6";
  // Support NdM format (e.g. 2d6)
  const diceMatch = /^(\d+)d(\d+)$/.exec(input);
  if (diceMatch) {
    const count = Math.min(Number(diceMatch[1]), 20);
    const sides = Math.min(Number(diceMatch[2]), 1000);
    const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
    const total = rolls.reduce((s, v) => s + v, 0);
    await message.reply(`🎲 **${rolls.join(", ")}** (total: **${total}**)`);
    return;
  }
  const max = Math.min(Math.max(Number(input) || 6, 2), 1_000_000);
  const result = Math.floor(Math.random() * max) + 1;
  await message.reply(`🎲 **${result}** / ${max}`);
}

// ─── choose ───────────────────────────────────────────────────────────────────
export async function cmdChoose(message: Message, args: string[]): Promise<void> {
  const text = args.join(" ");
  const options = text.split(/[,|]/).map((s) => s.trim()).filter(Boolean);
  if (options.length < 2) { await message.reply("Usage: `?choose option1, option2, option3`"); return; }
  const pick = options[Math.floor(Math.random() * options.length)];
  await message.reply(`🤔 I choose... **${pick}**`);
}

// ─── color ────────────────────────────────────────────────────────────────────
export async function cmdColor(message: Message, args: string[]): Promise<void> {
  let hex = args[0]?.replace("#", "") ?? "";
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    await message.reply("Usage: `?color <hex>` — e.g. `?color FF5733`");
    return;
  }
  const num = parseInt(hex, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8)  & 255;
  const b = num & 255;
  const e = new EmbedBuilder()
    .setColor(num)
    .setTitle(`🎨 #${hex.toUpperCase()}`)
    .addFields(
      { name: "Hex",  value: `#${hex.toUpperCase()}`, inline: true },
      { name: "RGB",  value: `rgb(${r}, ${g}, ${b})`, inline: true },
      { name: "Int",  value: String(num),              inline: true },
    )
    .setThumbnail(`https://singlecolorimage.com/get/${hex}/100x100`);
  await message.reply({ embeds: [e] });
}

// ─── avatar ───────────────────────────────────────────────────────────────────
export async function cmdAvatar(message: Message): Promise<void> {
  const target = message.mentions.users.first() ?? message.author;
  const url = target.displayAvatarURL({ size: 1024, extension: "png" });
  const e = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`${target.username}'s Avatar`)
    .setImage(url)
    .setURL(url);
  await message.reply({ embeds: [e] });
}

// ─── serverinfo ───────────────────────────────────────────────────────────────
export async function cmdServerInfo(message: Message): Promise<void> {
  const guild = message.guild;
  if (!guild) { await message.reply("This command can only be used in a server."); return; }
  const e = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(guild.name)
    .setThumbnail(guild.iconURL({ size: 256 }) ?? null)
    .addFields(
      { name: "Owner",    value: `<@${guild.ownerId}>`,              inline: true },
      { name: "Members",  value: String(guild.memberCount),          inline: true },
      { name: "Channels", value: String(guild.channels.cache.size),  inline: true },
      { name: "Roles",    value: String(guild.roles.cache.size),     inline: true },
      { name: "Created",  value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
      { name: "ID",       value: guild.id,                           inline: true },
    );
  await message.reply({ embeds: [e] });
}

// ─── userinfo ─────────────────────────────────────────────────────────────────
export async function cmdUserInfo(message: Message): Promise<void> {
  const target = message.mentions.users.first() ?? message.author;
  const member = message.guild?.members.cache.get(target.id);
  const e = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`${target.username}`)
    .setThumbnail(target.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: "ID",       value: target.id,                                              inline: true },
      { name: "Bot",      value: target.bot ? "Yes" : "No",                              inline: true },
      { name: "Created",  value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`,  inline: true },
    );
  if (member) {
    e.addFields(
      { name: "Joined",   value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : "Unknown", inline: true },
      { name: "Nickname", value: member.nickname ?? "None", inline: true },
      { name: "Top Role", value: member.roles.highest.toString(), inline: true },
    );
  }
  await message.reply({ embeds: [e] });
}

// ─── ping ─────────────────────────────────────────────────────────────────────
export async function cmdPing(message: Message): Promise<void> {
  const start = Date.now();
  const m = await message.reply("🏓 Pong!");
  await m.edit(`🏓 Pong! \`${Date.now() - start}ms\``);
}

// ─── remindme ─────────────────────────────────────────────────────────────────
const pendingReminders = new Map<ReturnType<typeof setTimeout>, true>();
export async function cmdRemind(message: Message, args: string[]): Promise<void> {
  const timeStr = args[0];
  const reminder = args.slice(1).join(" ");
  if (!timeStr || !reminder) {
    await message.reply("Usage: `?remindme <time> <message>` — e.g. `?remindme 10m check pizza`\nSupported: `s` (seconds), `m` (minutes), `h` (hours)");
    return;
  }
  const match = /^(\d+)(s|m|h)$/.exec(timeStr.toLowerCase());
  if (!match) {
    await message.reply("❌ Invalid time format. Use `10s`, `5m`, `2h` etc.");
    return;
  }
  const mult: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000 };
  const ms = Number(match[1]) * mult[match[2]];
  if (ms > 24 * 3_600_000) { await message.reply("❌ Max reminder time is 24 hours."); return; }

  await message.reply(`✅ I'll remind you in **${timeStr}**: *${reminder}*`);
  const t = setTimeout(async () => {
    pendingReminders.delete(t);
    await message.author.send(`⏰ **Reminder:** ${reminder}`).catch(async () => {
      if (message.channel && "send" in message.channel) {
        await (message.channel as import("discord.js").TextChannel).send(`⏰ <@${message.author.id}> Reminder: **${reminder}**`).catch(() => {});
      }
    });
  }, ms);
  pendingReminders.set(t, true);
}

// ─── translate (basic — calls MyMemory free API) ─────────────────────────────
export async function cmdTranslate(message: Message, args: string[]): Promise<void> {
  const lang = args[0];
  const text  = args.slice(1).join(" ");
  if (!lang || !text) {
    await message.reply("Usage: `?translate <lang_code> <text>` — e.g. `?translate es hello world`");
    return;
  }
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${encodeURIComponent(lang)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const json = await res.json() as { responseData?: { translatedText?: string }; responseStatus?: number };
    const translated = json?.responseData?.translatedText;
    if (!translated || json.responseStatus !== 200) {
      await message.reply("❌ Translation failed. Check the language code and try again.");
      return;
    }
    await message.reply(`🌐 **${lang.toUpperCase()}:** ${translated}`);
  } catch {
    await message.reply("❌ Translation service unavailable right now.");
  }
}

// ─── define ───────────────────────────────────────────────────────────────────
export async function cmdDefine(message: Message, args: string[]): Promise<void> {
  const word = args[0];
  if (!word) { await message.reply("Usage: `?define <word>`"); return; }
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) { await message.reply(`❌ No definition found for **${word}**.`); return; }
    const data = await res.json() as Array<{ meanings?: Array<{ partOfSpeech?: string; definitions?: Array<{ definition?: string; example?: string }> }> }>;
    const meaning = data?.[0]?.meanings?.[0];
    const def = meaning?.definitions?.[0];
    if (!def?.definition) { await message.reply(`❌ No definition found for **${word}**.`); return; }
    const e = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📖 ${word}`)
      .setDescription(`**${meaning?.partOfSpeech ?? ""}**\n${def.definition}`)
      .setFooter({ text: "via dictionaryapi.dev" });
    if (def.example) e.addFields({ name: "Example", value: `*${def.example}*` });
    await message.reply({ embeds: [e] });
  } catch {
    await message.reply("❌ Dictionary service unavailable right now.");
  }
}

// ─── coinflip ─────────────────────────────────────────────────────────────────
export async function cmdCoinflip(message: Message): Promise<void> {
  const result = Math.random() < 0.5 ? "🪙 Heads" : "🌑 Tails";
  await message.reply(`**${result}**!`);
}

// ─── dice ─────────────────────────────────────────────────────────────────────
export async function cmdDice(message: Message, args: string[]): Promise<void> {
  return cmdRoll(message, args);
}

// ─── enlarge (repost/reupload an image) ───────────────────────────────────────
export async function cmdEnlarge(message: Message): Promise<void> {
  const attach = message.attachments.first();
  const url = attach?.url ?? message.mentions.users.first()?.displayAvatarURL({ size: 4096, extension: "png" });
  if (!url) {
    await message.reply("Attach an image or mention a user to enlarge their avatar.");
    return;
  }
  const e = new EmbedBuilder().setImage(url).setColor(0x2f3136);
  await message.reply({ embeds: [e] });
}

// ─── emojify ──────────────────────────────────────────────────────────────────
const REGIONAL: Record<string, string> = Object.fromEntries([
  ..."abcdefghijklmnopqrstuvwxyz".split("").map((c, i) => [c, String.fromCodePoint(0x1F1E6 + i)]),
  ...["0","1","2","3","4","5","6","7","8","9"].map((n) => [n, `${n}️⃣`]),
  [" ", "  "], ["!", "❗"], ["?", "❓"],
]);
export async function cmdEmojify(message: Message, args: string[]): Promise<void> {
  const text = args.join(" ").toLowerCase();
  if (!text) { await message.reply("Usage: `?emojify <text>`"); return; }
  const result = text.split("").map((c) => REGIONAL[c] ?? c).join(" ");
  await message.reply(result.slice(0, 2000));
}

// ─── aesthetic (vaporwave fullwidth) ─────────────────────────────────────────
export async function cmdAesthetic(message: Message, args: string[]): Promise<void> {
  const text = args.join(" ");
  if (!text) { await message.reply("Usage: `?aesthetic <text>`"); return; }
  const result = text.split("").map((c) => {
    const code = c.charCodeAt(0);
    if (code >= 0x21 && code <= 0x7E) return String.fromCharCode(code + 0xFF01 - 0x21);
    if (c === " ") return "\u3000";
    return c;
  }).join("");
  await message.reply(result.slice(0, 2000));
}

// ─── zalgo ────────────────────────────────────────────────────────────────────
const ZALGO_ABOVE = [0x030D,0x030E,0x0304,0x0305,0x033F,0x0311,0x0306,0x0310,0x0352,0x0357,0x0351,0x0307,0x0308,0x030A,0x0342,0x0343,0x0344,0x034A,0x034B,0x034C,0x0303,0x0302,0x030C,0x0350,0x0300,0x0301,0x030B,0x030F,0x0312,0x0313,0x0314,0x033D,0x0309,0x0363,0x0364,0x0365,0x0366,0x0367,0x0368,0x0369,0x036A,0x036B,0x036C,0x036D,0x036E,0x036F,0x033E,0x035B];
const ZALGO_BELOW = [0x0316,0x0317,0x0318,0x0319,0x031C,0x031D,0x031E,0x031F,0x0320,0x0324,0x0325,0x0326,0x0329,0x032A,0x032B,0x032C,0x032D,0x032E,0x032F,0x0330,0x0331,0x0332,0x0333,0x0339,0x033A,0x033B,0x033C,0x0345,0x0347,0x0348,0x0349,0x034D,0x034E,0x0353,0x0354,0x0355,0x0356,0x0359,0x035A,0x0323];
export async function cmdZalgo(message: Message, args: string[]): Promise<void> {
  const text = args.join(" ");
  if (!text) { await message.reply("Usage: `?zalgo <text>`"); return; }
  const intensity = 5;
  const result = [...text].map((c) => {
    if (c === " ") return c;
    let s = c;
    for (let i = 0; i < intensity; i++) s += String.fromCodePoint(ZALGO_ABOVE[Math.floor(Math.random() * ZALGO_ABOVE.length)]);
    for (let i = 0; i < intensity; i++) s += String.fromCodePoint(ZALGO_BELOW[Math.floor(Math.random() * ZALGO_BELOW.length)]);
    return s;
  }).join("");
  await message.reply(result.slice(0, 2000));
}

// ─── letterspace ─────────────────────────────────────────────────────────────
export async function cmdLetterspace(message: Message, args: string[]): Promise<void> {
  const text = args.join(" ");
  if (!text) { await message.reply("Usage: `?letterspace <text>`"); return; }
  await message.reply(text.split("").join(" ").slice(0, 2000));
}

// ─── rate ─────────────────────────────────────────────────────────────────────
export async function cmdRate(message: Message, args: string[]): Promise<void> {
  const thing = args.join(" ").trim();
  if (!thing) { await message.reply("Usage: `?rate <thing>`"); return; }
  const rating = [...thing].reduce((a, c) => a + c.charCodeAt(0), thing.length) % 101;
  const bar = "█".repeat(Math.floor(rating / 10)) + "░".repeat(10 - Math.floor(rating / 10));
  await message.reply(`📊 **${thing}**: ${rating}/100\n\`[${bar}]\``);
}

// ─── iq ───────────────────────────────────────────────────────────────────────
export async function cmdIQ(message: Message, args: string[]): Promise<void> {
  const target = message.mentions.users.first() ?? message.author;
  const seed = [...target.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const iq = (seed * 7 + 42) % 200 + 20;
  const bar = "█".repeat(Math.min(10, Math.floor(iq / 25)));
  await message.reply(`🧠 **${target.username}** has an IQ of **${iq}**\n\`[${bar}]\``);
}

// ─── pp ───────────────────────────────────────────────────────────────────────
export async function cmdPP(message: Message, args: string[]): Promise<void> {
  const target = message.mentions.users.first() ?? message.author;
  const seed = [...target.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const size = seed % 20;
  await message.reply(`🍆 **${target.username}**'s pp:\n8${"=".repeat(size)}D`);
}

// ─── gay ──────────────────────────────────────────────────────────────────────
export async function cmdGay(message: Message, args: string[]): Promise<void> {
  const target = message.mentions.users.first() ?? message.author;
  const seed = [...target.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const pct = seed % 101;
  const bar = "🏳️‍🌈".repeat(Math.floor(pct / 20));
  await message.reply(`🏳️‍🌈 **${target.username}** is **${pct}% gay** ${bar}`);
}

// ─── fact ─────────────────────────────────────────────────────────────────────
export async function cmdFact(message: Message): Promise<void> {
  try {
    const res = await fetch("https://uselessfacts.jsph.pl/api/v2/facts/random?language=en", { signal: AbortSignal.timeout(6000) });
    const json = await res.json() as { text?: string };
    await message.reply(`💡 ${json.text ?? "Could not fetch a fact right now."}`);
  } catch { await message.reply("❌ Fact service unavailable."); }
}

// ─── joke ─────────────────────────────────────────────────────────────────────
export async function cmdJoke(message: Message): Promise<void> {
  try {
    const res = await fetch("https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,religious,political,racist,sexist,explicit", { signal: AbortSignal.timeout(6000) });
    const json = await res.json() as { type?: string; joke?: string; setup?: string; delivery?: string };
    if (json.type === "single") {
      await message.reply(`😂 ${json.joke}`);
    } else if (json.type === "twopart") {
      await message.reply(`😂 ${json.setup}\n||${json.delivery}||`);
    } else {
      await message.reply("❌ Could not fetch a joke.");
    }
  } catch { await message.reply("❌ Joke service unavailable."); }
}

// ─── base64 ───────────────────────────────────────────────────────────────────
export async function cmdBase64(message: Message, args: string[]): Promise<void> {
  const mode = args[0]?.toLowerCase();
  const text = args.slice(1).join(" ");
  if (!mode || !text || !["encode","decode","e","d"].includes(mode)) {
    await message.reply("Usage: `?base64 encode|decode <text>`"); return;
  }
  try {
    const result = (mode === "encode" || mode === "e")
      ? Buffer.from(text, "utf8").toString("base64")
      : Buffer.from(text, "base64").toString("utf8");
    await message.reply(`\`\`\`\n${result.slice(0, 1900)}\n\`\`\``);
  } catch { await message.reply("❌ Failed to encode/decode."); }
}

// ─── binary ───────────────────────────────────────────────────────────────────
export async function cmdBinary(message: Message, args: string[]): Promise<void> {
  const mode = args[0]?.toLowerCase();
  const text = args.slice(1).join(" ");
  if (!mode || !text || !["encode","decode","e","d"].includes(mode)) {
    await message.reply("Usage: `?binary encode|decode <text>`"); return;
  }
  try {
    const result = (mode === "encode" || mode === "e")
      ? text.split("").map((c) => c.charCodeAt(0).toString(2).padStart(8, "0")).join(" ")
      : text.split(" ").map((b) => String.fromCharCode(parseInt(b, 2))).join("");
    await message.reply(`\`\`\`\n${result.slice(0, 1900)}\n\`\`\``);
  } catch { await message.reply("❌ Failed to encode/decode."); }
}

// ─── hex ──────────────────────────────────────────────────────────────────────
export async function cmdHex(message: Message, args: string[]): Promise<void> {
  const mode = args[0]?.toLowerCase();
  const text = args.slice(1).join(" ");
  if (!mode || !text || !["encode","decode","e","d"].includes(mode)) {
    await message.reply("Usage: `?hex encode|decode <text>`"); return;
  }
  try {
    const result = (mode === "encode" || mode === "e")
      ? Buffer.from(text, "utf8").toString("hex")
      : Buffer.from(text, "hex").toString("utf8");
    await message.reply(`\`\`\`\n${result.slice(0, 1900)}\n\`\`\``);
  } catch { await message.reply("❌ Failed to encode/decode."); }
}

// ─── charinfo ─────────────────────────────────────────────────────────────────
export async function cmdCharInfo(message: Message, args: string[]): Promise<void> {
  const text = args.join(" ");
  if (!text) { await message.reply("Usage: `?charinfo <characters>`"); return; }
  const chars = [...text].slice(0, 8);
  const lines = chars.map((c) => {
    const cp = c.codePointAt(0)!;
    const hex = `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
    const decimal = cp;
    const html = `&#${cp};`;
    return `\`${c}\` — **${hex}** (dec: \`${decimal}\`) (html: \`${html}\`)`;
  });
  await message.reply(lines.join("\n"));
}

// ─── math ─────────────────────────────────────────────────────────────────────
export async function cmdMath(message: Message, args: string[]): Promise<void> {
  const expr = args.join(" ").replace(/\^/g, "**");
  if (!expr) { await message.reply("Usage: `?math <expression>` — e.g. `?math 2 + 2 * 10`"); return; }
  if (!/^[\d\s+\-*/().%\s]+$/.test(expr.replace(/\*\*/g, ""))) {
    await message.reply("❌ Invalid expression. Only numbers and basic operators allowed."); return;
  }
  try {
    // Safe eval: only numbers/operators allowed (validated above)
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr})`)();
    if (typeof result !== "number" || !isFinite(result)) { await message.reply("❌ Result is not a finite number."); return; }
    await message.reply(`🧮 \`${expr.replace(/\*\*/g, "^")}\` = **${result}**`);
  } catch { await message.reply("❌ Could not evaluate expression."); }
}

// ─── icon ─────────────────────────────────────────────────────────────────────
export async function cmdIcon(message: Message): Promise<void> {
  const guild = message.guild;
  if (!guild) { await message.reply("This command only works in a server."); return; }
  const url = guild.iconURL({ size: 1024, extension: "png" });
  if (!url) { await message.reply("This server has no icon."); return; }
  const e = new EmbedBuilder().setColor(0x5865f2).setTitle(`${guild.name} — Server Icon`).setImage(url).setURL(url);
  await message.reply({ embeds: [e] });
}

// ─── banner ───────────────────────────────────────────────────────────────────
export async function cmdBanner(message: Message): Promise<void> {
  const targetUser = message.mentions.users.first() ?? message.author;
  try {
    const fetched = await targetUser.fetch(true);
    const url = fetched.bannerURL({ size: 1024, extension: "png" });
    if (!url) { await message.reply(`**${fetched.username}** doesn't have a banner set.`); return; }
    const e = new EmbedBuilder().setColor(0x5865f2).setTitle(`${fetched.username}'s Banner`).setImage(url).setURL(url);
    await message.reply({ embeds: [e] });
  } catch { await message.reply("❌ Could not fetch banner."); }
}

// ─── roleinfo ─────────────────────────────────────────────────────────────────
export async function cmdRoleInfo(message: Message, args: string[]): Promise<void> {
  const guild = message.guild;
  if (!guild) { await message.reply("Server only."); return; }
  const role = message.mentions.roles.first()
    ?? guild.roles.cache.find((r) => r.name.toLowerCase() === args.join(" ").toLowerCase());
  if (!role) { await message.reply("❌ Role not found. Mention a role or provide its exact name."); return; }
  const e = new EmbedBuilder()
    .setColor(role.color || 0x5865f2)
    .setTitle(role.name)
    .addFields(
      { name: "ID",          value: role.id,                              inline: true },
      { name: "Color",       value: role.hexColor,                        inline: true },
      { name: "Hoisted",     value: role.hoist ? "Yes" : "No",            inline: true },
      { name: "Mentionable", value: role.mentionable ? "Yes" : "No",      inline: true },
      { name: "Members",     value: String(role.members.size),            inline: true },
      { name: "Position",    value: String(role.position),                inline: true },
      { name: "Created",     value: `<t:${Math.floor(role.createdTimestamp / 1000)}:R>`, inline: true },
    );
  await message.reply({ embeds: [e] });
}

// ─── channelinfo ─────────────────────────────────────────────────────────────
export async function cmdChannelInfo(message: Message): Promise<void> {
  const channel = message.mentions.channels.first() ?? message.channel;
  const e = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`#${"name" in channel ? channel.name : "channel"}`)
    .addFields(
      { name: "ID",      value: channel.id,                              inline: true },
      { name: "Type",    value: String(channel.type),                    inline: true },
      { name: "Created", value: `<t:${Math.floor(channel.createdTimestamp! / 1000)}:R>`, inline: true },
    );
  if ("topic" in channel && channel.topic) e.addFields({ name: "Topic", value: channel.topic });
  await message.reply({ embeds: [e] });
}

// ─── ship (assyst-style) ──────────────────────────────────────────────────────
export async function cmdAssystShip(message: Message): Promise<void> {
  const mentioned = Array.from(message.mentions.users.values());
  const user1 = mentioned[0] ?? message.author;
  const user2 = mentioned[1] ?? message.author;
  if (user1.id === user2.id) { await message.reply("You need to mention two different users!"); return; }
  const hash = ([...user1.id + user2.id].reduce((a, c) => a + c.charCodeAt(0), 0)) % 101;
  const bar = "▓".repeat(Math.floor(hash / 10)) + "░".repeat(10 - Math.floor(hash / 10));
  const verdict = hash >= 80 ? "💕 Soulmates!" : hash >= 60 ? "💖 Great match!" : hash >= 40 ? "💛 Could work..." : hash >= 20 ? "😅 Unlikely..." : "💔 Not meant to be.";
  await message.reply(`**💕 ${user1.username} + ${user2.username}**\n\`[${bar}]\` **${hash}%** — ${verdict}`);
}

// ─── ascii (block letters) ────────────────────────────────────────────────────
export async function cmdAscii(message: Message, args: string[]): Promise<void> {
  const text = args.join(" ").toUpperCase().slice(0, 10);
  if (!text) { await message.reply("Usage: `?ascii <text>`"); return; }
  // Simple block letter encoding (3-row style)
  const BLOCKS: Record<string, string[]> = {
    A:["▄▀█","█ █","█ █"], B:["█▀▄","█▀▄","█▄▀"], C:["▄▀▀","█  ","▀▄▄"],
    D:["█▀▄","█ █","█▄▀"], E:["█▀▀","███","█▄▄"], F:["█▀▀","███","█  "],
    G:["▄▀▀","█ █","▀▄█"], H:["█ █","███","█ █"], I:["▀█▀","█","▄█▄"],
    J:["  █"," █ ","▀█ "], K:["█ █","██ ","█ █"], L:["█  ","█  ","███"],
    M:["█▀█","███","█ █"], N:["█▄█","███","█▀█"], O:["▄▀▄","█ █","▀▄▀"],
    P:["█▀█","█▀ ","█  "], Q:["▄▀▄","█ █","▀█▄"], R:["█▀█","█▀▄","█ █"],
    S:["▄▀▀","▀▀▄","▄▄▀"], T:["▀█▀"," █ "," █ "], U:["█ █","█ █","▀▄▀"],
    V:["█ █","█ █"," ▀ "], W:["█ █","███","▀█▀"], X:["█ █"," █ ","█ █"],
    Y:["█ █"," █ "," █ "], Z:["▀▀█"," █ ","█▄▄"],
    " ":["   ","   ","   "], "!":["█"," ","▪"], "?":["▀█"," █","  ▪"],
    "0":["▄▀▄","█ █","▀▄▀"], "1":[" █"," █"," █"], "2":["▀▀█","▄▀ ","███"],
    "3":["▀▀█"," ▀█","▄▄▀"], "4":["█ █","███","  █"], "5":["█▀▀","▀▀▄","▄▄▀"],
    "6":["▄▀ ","█▀▄","▀▄▀"], "7":["▀▀█"," █ "," █ "], "8":["▄█▄","▄█▄","▄█▄"],
    "9":["▄█▄","▀▀█","▄▀ "],
  };
  const rows = ["", "", ""];
  for (const ch of text) {
    const block = BLOCKS[ch] ?? ["?","?","?"];
    rows[0] += block[0] + " ";
    rows[1] += block[1] + " ";
    rows[2] += block[2] + " ";
  }
  await message.reply(`\`\`\`\n${rows.join("\n")}\n\`\`\``);
}

// ─── urban (Urban Dictionary) ─────────────────────────────────────────────────
export async function cmdUrban(message: Message, args: string[]): Promise<void> {
  const term = args.join(" ").trim();
  if (!term) { await message.reply("Usage: `?urban <term>`"); return; }
  try {
    const res = await fetch(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(term)}`, { signal: AbortSignal.timeout(6000) });
    const json = await res.json() as { list?: Array<{ definition: string; example: string; thumbs_up: number }> };
    const top = json.list?.[0];
    if (!top) { await message.reply(`❌ No definition found for **${term}**.`); return; }
    const def = top.definition.replace(/\[|\]/g, "").slice(0, 800);
    const ex = top.example.replace(/\[|\]/g, "").slice(0, 300);
    const e = new EmbedBuilder()
      .setColor(0xefff00)
      .setTitle(`📖 ${term}`)
      .setDescription(def)
      .setFooter({ text: `👍 ${top.thumbs_up} • via Urban Dictionary` })
      .setURL(`https://www.urbandictionary.com/define.php?term=${encodeURIComponent(term)}`);
    if (ex) e.addFields({ name: "Example", value: `*${ex}*` });
    await message.reply({ embeds: [e] });
  } catch { await message.reply("❌ Urban Dictionary unavailable."); }
}

// ─── tag system ───────────────────────────────────────────────────────────────
const tagStore = new Map<string, string>();
export async function cmdTag(message: Message, args: string[]): Promise<void> {
  const sub = args[0]?.toLowerCase();
  if (!sub) {
    const keys = [...tagStore.keys()];
    if (keys.length === 0) { await message.reply("No tags yet. Create one: `?tag create <name> <content>`"); return; }
    await message.reply(`**Tags:** ${keys.map((k) => `\`${k}\``).join(", ")}`);
    return;
  }
  if (sub === "create" || sub === "add") {
    const name = args[1]?.toLowerCase();
    const content = args.slice(2).join(" ");
    if (!name || !content) { await message.reply("Usage: `?tag create <name> <content>`"); return; }
    tagStore.set(name, content);
    await message.reply(`✅ Tag \`${name}\` created!`);
    return;
  }
  if (sub === "delete" || sub === "remove") {
    const name = args[1]?.toLowerCase();
    if (!name || !tagStore.has(name)) { await message.reply(`❌ Tag not found.`); return; }
    tagStore.delete(name);
    await message.reply(`✅ Tag \`${name}\` deleted.`);
    return;
  }
  const content = tagStore.get(sub);
  if (!content) { await message.reply(`❌ Tag \`${sub}\` not found.`); return; }
  await message.reply(content);
}

// ─── help ─────────────────────────────────────────────────────────────────────
export async function cmdAssystHelp(message: Message): Promise<void> {
  const e = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("📖 Assyst Commands")
    .setDescription("Both `?` and `,` prefixes work for all commands.")
    .addFields(
      { name: "🖼️ Image",    value: "`caption` `blur` `invert` `grayscale` `jpeg` `pixelate` `flip` `flop` `rotate` `resize` `neon` `deepfry` `brighten` `contrast` `saturate` `sepia` `imageinfo`" },
      { name: "🎭 Text/Fun", value: "`owoify` `mock` `clap` `reverse` `upper` `lower` `emojify` `aesthetic` `zalgo` `letterspace` `ascii` `rate` `iq` `pp` `gay` `fact` `joke` `coinflip` `roll` `choose` `ship`" },
      { name: "🔐 Encode",   value: "`base64` `binary` `hex` `charinfo`" },
      { name: "🧮 Misc",     value: "`8b` `math` `urban` `define` `translate` `color` `tag` `remindme`" },
      { name: "🔍 Info",     value: "`avatar` `serverinfo` `userinfo` `icon` `banner` `roleinfo` `channelinfo` `ping` `enlarge`" },
      { name: "💥 Special",  value: "`nuke` — *you know what this does*" },
    )
    .setFooter({ text: "Assyst-inspired • both ? and , prefix work" });
  await message.reply({ embeds: [e] });
}

// ─── MAIN ASSYST ROUTER ───────────────────────────────────────────────────────
type AssystHandler = (message: Message, args: string[]) => Promise<void>;

const ASSYST_HANDLERS: Record<string, AssystHandler> = {
  // ── Fun / text ──────────────────────────────────────────────────────────
  "8b":          cmdEightBall,   "8ball":       cmdEightBall,
  owoify:        cmdOwoify,
  reverse:       cmdReverse,     rev:           cmdReverse,
  mock:          cmdMock,        spongebob:     cmdMock,
  clap:          cmdClap,
  upper:         cmdUpper,       uppercase:     cmdUpper,
  lower:         cmdLower,       lowercase:     cmdLower,
  roll:          cmdRoll,        dice:          cmdDice,
  choose:        cmdChoose,      pick:          cmdChoose,
  coinflip:      cmdCoinflip,    cf:            cmdCoinflip,
  emojify:       cmdEmojify,     emoji:         cmdEmojify,
  aesthetic:     cmdAesthetic,   vaporwave:     cmdAesthetic,  fw: cmdAesthetic,
  zalgo:         cmdZalgo,
  letterspace:   cmdLetterspace, ls:            cmdLetterspace,
  ascii:         cmdAscii,
  rate:          cmdRate,        howgood:       cmdRate,
  iq:            cmdIQ,
  pp:            cmdPP,
  gay:           cmdGay,         homocheck:     cmdGay,
  fact:          (m) => cmdFact(m),
  joke:          (m) => cmdJoke(m),
  // ── Encode ────────────────────────────────────────────────────────────
  base64:        cmdBase64,      b64:           cmdBase64,
  binary:        cmdBinary,      bin:           cmdBinary,
  hex:           cmdHex,
  charinfo:      cmdCharInfo,    chars:         cmdCharInfo,
  // ── Math / misc ───────────────────────────────────────────────────────
  math:          cmdMath,        calc:          cmdMath,
  urban:         cmdUrban,       ud:            cmdUrban,
  // ── Info ──────────────────────────────────────────────────────────────
  color:         cmdColor,       colour:        cmdColor,
  avatar:        cmdAvatar,      av:            cmdAvatar,   pfp: cmdAvatar,
  serverinfo:    cmdServerInfo,  si:            cmdServerInfo,
  userinfo:      cmdUserInfo,    ui:            cmdUserInfo,
  ping:          cmdPing,
  remindme:      cmdRemind,      remind:        cmdRemind,
  translate:     cmdTranslate,   tr:            cmdTranslate,
  define:        cmdDefine,      def:           cmdDefine,
  enlarge:       cmdEnlarge,     e:             cmdEnlarge,  repost: cmdEnlarge,
  icon:          (m) => cmdIcon(m),
  banner:        (m) => cmdBanner(m),
  roleinfo:      cmdRoleInfo,    ri:            cmdRoleInfo,
  channelinfo:   (m) => cmdChannelInfo(m), chi: (m) => cmdChannelInfo(m),
  ship:          (m) => cmdAssystShip(m),
  // ── Tags ──────────────────────────────────────────────────────────────
  tag:           cmdTag,
  // ── Help ──────────────────────────────────────────────────────────────
  help:          (m) => cmdAssystHelp(m),
  // ── Image (from assystImage.ts) ───────────────────────────────────────
  ...IMAGE_HANDLERS,
};

export async function handleAssystCommand(message: Message): Promise<boolean> {
  const content = message.content.trim();

  let body: string;
  if (content.startsWith("?") && !content.startsWith("? ")) {
    body = content.slice(1).trim();
  } else if (content.startsWith(",") && !content.startsWith(", ")) {
    body = content.slice(1).trim();
  } else {
    return false;
  }

  if (!body) return false;

  const parts = body.split(/\s+/);
  const sub = parts.shift()!.toLowerCase();
  const args = parts;

  // ?nuke is handled separately in index.ts — skip it here
  if (sub === "nuke") return false;

  const handler = ASSYST_HANDLERS[sub];
  if (!handler) return false;

  try {
    await handler(message, args);
  } catch (err) {
    console.error("[ASSYST]", sub, err);
    await message.reply("⚠️ Something went wrong.").catch(() => {});
  }
  return true;
}
