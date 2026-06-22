import type { Message } from "discord.js";
import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import { createCanvas, loadImage } from "@napi-rs/canvas";

// ─── Shared image helpers ─────────────────────────────────────────────────────

function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url);
}

export async function findImageUrl(message: Message, urlArg?: string): Promise<string | null> {
  // 1. URL explicitly passed as arg
  if (urlArg && /^https?:\/\//.test(urlArg) && isImageUrl(urlArg)) return urlArg;

  // 2. Attachment on current message
  const attach = message.attachments.find(
    (a) => a.contentType?.startsWith("image/") || isImageUrl(a.url),
  );
  if (attach) return attach.url;

  // 3. Referenced (replied-to) message
  if (message.reference?.messageId) {
    try {
      const ref = await message.channel.messages.fetch(message.reference.messageId);
      const refAttach = ref.attachments.find(
        (a) => a.contentType?.startsWith("image/") || isImageUrl(a.url),
      );
      if (refAttach) return refAttach.url;
      for (const embed of ref.embeds) {
        if (embed.image?.url) return embed.image.url;
        if (embed.thumbnail?.url) return embed.thumbnail.url;
      }
    } catch { /* ignore */ }
  }

  // 4. Embed on current message
  for (const embed of message.embeds) {
    if (embed.image?.url) return embed.image.url;
    if (embed.thumbnail?.url) return embed.thumbnail.url;
  }

  return null;
}

async function fetchBuf(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; DiscordBot/1.0)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function resolveAndFetch(message: Message, args: string[]): Promise<Buffer | null> {
  const urlArg = args.find((a) => /^https?:\/\//.test(a));
  const url = await findImageUrl(message, urlArg);
  if (!url) return null;
  return fetchBuf(url);
}

async function replyWithImage(message: Message, buf: Buffer, name: string): Promise<void> {
  await message.reply({ files: [new AttachmentBuilder(buf, { name })] });
}

const MAX_W = 1000;

// ─── BLUR ─────────────────────────────────────────────────────────────────────
export async function cmdImgBlur(message: Message, args: string[]): Promise<void> {
  const radius = Math.min(Math.max(Number(args.find((a) => /^\d+$/.test(a))) || 5, 1), 50);
  const buf = await resolveAndFetch(message, args);
  if (!buf) { await message.reply("❌ No image found. Attach one, reply to one, or provide a URL."); return; }

  const src = await loadImage(buf);
  const scale = src.width > MAX_W ? MAX_W / src.width : 1;
  const w = Math.round(src.width * scale);
  const h = Math.round(src.height * scale);

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.filter = `blur(${radius}px)`;
  ctx.drawImage(src, 0, 0, w, h);

  await replyWithImage(message, canvas.toBuffer("image/png"), "blur.png");
}

// ─── INVERT ───────────────────────────────────────────────────────────────────
export async function cmdImgInvert(message: Message, args: string[]): Promise<void> {
  const buf = await resolveAndFetch(message, args);
  if (!buf) { await message.reply("❌ No image found."); return; }

  const src = await loadImage(buf);
  const scale = src.width > MAX_W ? MAX_W / src.width : 1;
  const w = Math.round(src.width * scale);
  const h = Math.round(src.height * scale);

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.filter = "invert(1)";
  ctx.drawImage(src, 0, 0, w, h);

  await replyWithImage(message, canvas.toBuffer("image/png"), "invert.png");
}

// ─── GRAYSCALE ────────────────────────────────────────────────────────────────
export async function cmdImgGrayscale(message: Message, args: string[]): Promise<void> {
  const buf = await resolveAndFetch(message, args);
  if (!buf) { await message.reply("❌ No image found."); return; }

  const src = await loadImage(buf);
  const scale = src.width > MAX_W ? MAX_W / src.width : 1;
  const w = Math.round(src.width * scale);
  const h = Math.round(src.height * scale);

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.filter = "grayscale(1)";
  ctx.drawImage(src, 0, 0, w, h);

  await replyWithImage(message, canvas.toBuffer("image/png"), "grayscale.png");
}

// ─── JPEG (compression artifacts) ─────────────────────────────────────────────
export async function cmdImgJpeg(message: Message, args: string[]): Promise<void> {
  const quality = Math.min(Math.max(Number(args.find((a) => /^\d+$/.test(a))) || 5, 1), 95);
  const buf = await resolveAndFetch(message, args);
  if (!buf) { await message.reply("❌ No image found."); return; }

  const src = await loadImage(buf);
  const scale = src.width > MAX_W ? MAX_W / src.width : 1;
  const w = Math.round(src.width * scale);
  const h = Math.round(src.height * scale);

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(src, 0, 0, w, h);

  await replyWithImage(message, canvas.toBuffer("image/jpeg", quality / 100), "jpeg.jpg");
}

// ─── PIXELATE ─────────────────────────────────────────────────────────────────
export async function cmdImgPixelate(message: Message, args: string[]): Promise<void> {
  const size = Math.min(Math.max(Number(args.find((a) => /^\d+$/.test(a))) || 12, 2), 100);
  const buf = await resolveAndFetch(message, args);
  if (!buf) { await message.reply("❌ No image found."); return; }

  const src = await loadImage(buf);
  const scale = src.width > MAX_W ? MAX_W / src.width : 1;
  const w = Math.round(src.width * scale);
  const h = Math.round(src.height * scale);

  // Scale down to pixelated resolution, then back up
  const pw = Math.max(1, Math.floor(w / size));
  const ph = Math.max(1, Math.floor(h / size));

  const small = createCanvas(pw, ph);
  small.getContext("2d").drawImage(src, 0, 0, pw, ph);

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  (ctx as unknown as { imageSmoothingEnabled: boolean }).imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, w, h);

  await replyWithImage(message, canvas.toBuffer("image/png"), "pixelate.png");
}

// ─── FLIP (horizontal mirror) ──────────────────────────────────────────────────
export async function cmdImgFlip(message: Message, args: string[]): Promise<void> {
  const buf = await resolveAndFetch(message, args);
  if (!buf) { await message.reply("❌ No image found."); return; }

  const src = await loadImage(buf);
  const scale = src.width > MAX_W ? MAX_W / src.width : 1;
  const w = Math.round(src.width * scale);
  const h = Math.round(src.height * scale);

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0, w, h);

  await replyWithImage(message, canvas.toBuffer("image/png"), "flip.png");
}

// ─── FLOP (vertical mirror) ────────────────────────────────────────────────────
export async function cmdImgFlop(message: Message, args: string[]): Promise<void> {
  const buf = await resolveAndFetch(message, args);
  if (!buf) { await message.reply("❌ No image found."); return; }

  const src = await loadImage(buf);
  const scale = src.width > MAX_W ? MAX_W / src.width : 1;
  const w = Math.round(src.width * scale);
  const h = Math.round(src.height * scale);

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.translate(0, h);
  ctx.scale(1, -1);
  ctx.drawImage(src, 0, 0, w, h);

  await replyWithImage(message, canvas.toBuffer("image/png"), "flop.png");
}

// ─── ROTATE ───────────────────────────────────────────────────────────────────
export async function cmdImgRotate(message: Message, args: string[]): Promise<void> {
  const deg = Number(args.find((a) => /^-?\d+$/.test(a))) || 90;
  const buf = await resolveAndFetch(message, args);
  if (!buf) { await message.reply("❌ No image found."); return; }

  const src = await loadImage(buf);
  const scale = src.width > MAX_W ? MAX_W / src.width : 1;
  const sw = Math.round(src.width * scale);
  const sh = Math.round(src.height * scale);

  const rad = (deg * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const newW = Math.ceil(sw * cos + sh * sin);
  const newH = Math.ceil(sw * sin + sh * cos);

  const canvas = createCanvas(newW, newH);
  const ctx = canvas.getContext("2d");
  ctx.translate(newW / 2, newH / 2);
  ctx.rotate(rad);
  ctx.drawImage(src, -sw / 2, -sh / 2, sw, sh);

  await replyWithImage(message, canvas.toBuffer("image/png"), "rotate.png");
}

// ─── RESIZE ───────────────────────────────────────────────────────────────────
export async function cmdImgResize(message: Message, args: string[]): Promise<void> {
  const buf = await resolveAndFetch(message, args);
  if (!buf) { await message.reply("❌ No image found."); return; }

  const src = await loadImage(buf);
  const sizeArg = args.find((a) => /^\d+(%|x\d+)?$/.test(a) && !/^https?:/.test(a)) ?? "50%";

  let newW: number;
  let newH: number;

  if (sizeArg.endsWith("%")) {
    const pct = Math.min(Math.max(Number(sizeArg.slice(0, -1)), 1), 400) / 100;
    newW = Math.round(src.width * pct);
    newH = Math.round(src.height * pct);
  } else if (sizeArg.includes("x")) {
    const [ws, hs] = sizeArg.split("x");
    newW = Number(ws) || src.width;
    newH = Number(hs) || src.height;
  } else {
    newW = Number(sizeArg) || src.width;
    newH = Math.round(src.height * (newW / src.width));
  }

  newW = Math.min(Math.max(newW, 1), 3000);
  newH = Math.min(Math.max(newH, 1), 3000);

  const canvas = createCanvas(newW, newH);
  canvas.getContext("2d").drawImage(src, 0, 0, newW, newH);

  await replyWithImage(message, canvas.toBuffer("image/png"), "resize.png");
}

// ─── NEON ─────────────────────────────────────────────────────────────────────
export async function cmdImgNeon(message: Message, args: string[]): Promise<void> {
  const buf = await resolveAndFetch(message, args);
  if (!buf) { await message.reply("❌ No image found."); return; }

  const src = await loadImage(buf);
  const scale = src.width > MAX_W ? MAX_W / src.width : 1;
  const w = Math.round(src.width * scale);
  const h = Math.round(src.height * scale);

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  // Invert + saturate for a "neon" feel
  ctx.filter = "invert(1) saturate(5) hue-rotate(180deg)";
  ctx.drawImage(src, 0, 0, w, h);

  await replyWithImage(message, canvas.toBuffer("image/png"), "neon.png");
}

// ─── DEEPFRY ─────────────────────────────────────────────────────────────────
export async function cmdImgDeepfry(message: Message, args: string[]): Promise<void> {
  const buf = await resolveAndFetch(message, args);
  if (!buf) { await message.reply("❌ No image found."); return; }

  const src = await loadImage(buf);
  const scale = src.width > MAX_W ? MAX_W / src.width : 1;
  const w = Math.round(src.width * scale);
  const h = Math.round(src.height * scale);

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.filter = "saturate(8) contrast(3) brightness(1.2)";
  ctx.drawImage(src, 0, 0, w, h);

  // Apply JPEG compression for artifacts
  const jpegBuf = canvas.toBuffer("image/jpeg", 0.02);
  const jImg = await loadImage(jpegBuf);
  const finalCanvas = createCanvas(w, h);
  finalCanvas.getContext("2d").drawImage(jImg, 0, 0);

  await replyWithImage(message, finalCanvas.toBuffer("image/png"), "deepfry.png");
}

// ─── BRIGHTEN ─────────────────────────────────────────────────────────────────
export async function cmdImgBrighten(message: Message, args: string[]): Promise<void> {
  const amount = Math.min(Math.max(Number(args.find((a) => /^\d+$/.test(a))) || 150, 50), 400);
  const buf = await resolveAndFetch(message, args);
  if (!buf) { await message.reply("❌ No image found."); return; }

  const src = await loadImage(buf);
  const scale = src.width > MAX_W ? MAX_W / src.width : 1;
  const w = Math.round(src.width * scale);
  const h = Math.round(src.height * scale);

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.filter = `brightness(${amount}%)`;
  ctx.drawImage(src, 0, 0, w, h);

  await replyWithImage(message, canvas.toBuffer("image/png"), "brighten.png");
}

// ─── CONTRAST ─────────────────────────────────────────────────────────────────
export async function cmdImgContrast(message: Message, args: string[]): Promise<void> {
  const amount = Math.min(Math.max(Number(args.find((a) => /^\d+$/.test(a))) || 200, 50), 1000);
  const buf = await resolveAndFetch(message, args);
  if (!buf) { await message.reply("❌ No image found."); return; }

  const src = await loadImage(buf);
  const scale = src.width > MAX_W ? MAX_W / src.width : 1;
  const w = Math.round(src.width * scale);
  const h = Math.round(src.height * scale);

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.filter = `contrast(${amount}%)`;
  ctx.drawImage(src, 0, 0, w, h);

  await replyWithImage(message, canvas.toBuffer("image/png"), "contrast.png");
}

// ─── SATURATE ─────────────────────────────────────────────────────────────────
export async function cmdImgSaturate(message: Message, args: string[]): Promise<void> {
  const amount = Math.min(Math.max(Number(args.find((a) => /^\d+$/.test(a))) || 300, 0), 2000);
  const buf = await resolveAndFetch(message, args);
  if (!buf) { await message.reply("❌ No image found."); return; }

  const src = await loadImage(buf);
  const scale = src.width > MAX_W ? MAX_W / src.width : 1;
  const w = Math.round(src.width * scale);
  const h = Math.round(src.height * scale);

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.filter = `saturate(${amount}%)`;
  ctx.drawImage(src, 0, 0, w, h);

  await replyWithImage(message, canvas.toBuffer("image/png"), "saturate.png");
}

// ─── SEPIA ────────────────────────────────────────────────────────────────────
export async function cmdImgSepia(message: Message, args: string[]): Promise<void> {
  const buf = await resolveAndFetch(message, args);
  if (!buf) { await message.reply("❌ No image found."); return; }

  const src = await loadImage(buf);
  const scale = src.width > MAX_W ? MAX_W / src.width : 1;
  const w = Math.round(src.width * scale);
  const h = Math.round(src.height * scale);

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.filter = "sepia(1)";
  ctx.drawImage(src, 0, 0, w, h);

  await replyWithImage(message, canvas.toBuffer("image/png"), "sepia.png");
}

// ─── IMAGEINFO ────────────────────────────────────────────────────────────────
export async function cmdImgInfo(message: Message, args: string[]): Promise<void> {
  const urlArg = args.find((a) => /^https?:\/\//.test(a));
  const url = await findImageUrl(message, urlArg);
  if (!url) { await message.reply("❌ No image found."); return; }

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; DiscordBot/1.0)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) { await message.reply("❌ Could not fetch image."); return; }

  const buf = Buffer.from(await res.arrayBuffer());
  const src = await loadImage(buf);
  const bytes = buf.byteLength;
  const kb = (bytes / 1024).toFixed(1);

  const ctype = res.headers.get("content-type") ?? "unknown";
  const ext = ctype.includes("png") ? "PNG" : ctype.includes("gif") ? "GIF" : ctype.includes("webp") ? "WebP" : "JPEG";

  const e = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🖼️ Image Info")
    .setThumbnail(url)
    .addFields(
      { name: "Format",      value: ext,                      inline: true },
      { name: "Dimensions",  value: `${src.width}×${src.height}`, inline: true },
      { name: "Size",        value: `${kb} KB`,               inline: true },
    );
  await message.reply({ embeds: [e] });
}

// ─── Exported handler map ─────────────────────────────────────────────────────
export type ImgHandler = (message: Message, args: string[]) => Promise<void>;

export const IMAGE_HANDLERS: Record<string, ImgHandler> = {
  blur:        cmdImgBlur,
  invert:      cmdImgInvert,      negative:    cmdImgInvert,
  grayscale:   cmdImgGrayscale,   greyscale:   cmdImgGrayscale,
  grey:        cmdImgGrayscale,   gray:        cmdImgGrayscale,
  jpeg:        cmdImgJpeg,        jpegify:     cmdImgJpeg,       df: cmdImgJpeg,
  pixelate:    cmdImgPixelate,    pixel:       cmdImgPixelate,
  flip:        cmdImgFlip,        mirror:      cmdImgFlip,
  flop:        cmdImgFlop,
  rotate:      cmdImgRotate,      rot:         cmdImgRotate,
  resize:      cmdImgResize,      scale:       cmdImgResize,
  neon:        cmdImgNeon,
  deepfry:     cmdImgDeepfry,
  brighten:    cmdImgBrighten,    brightness:  cmdImgBrighten,
  contrast:    cmdImgContrast,
  saturate:    cmdImgSaturate,    saturation:  cmdImgSaturate,
  sepia:       cmdImgSepia,
  imageinfo:   cmdImgInfo,        imginfo:     cmdImgInfo,       ii: cmdImgInfo,
};
