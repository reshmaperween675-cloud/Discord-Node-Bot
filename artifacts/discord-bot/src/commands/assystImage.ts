import type { Message } from "discord.js";
import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import sharp, { type Sharp } from "sharp";

// ─── Shared helpers ───────────────────────────────────────────────────────────

function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url);
}

export async function findImageUrl(message: Message, urlArg?: string): Promise<string | null> {
  if (urlArg && /^https?:\/\//.test(urlArg) && isImageUrl(urlArg)) return urlArg;

  const attach = message.attachments.find(
    (a) => a.contentType?.startsWith("image/") || isImageUrl(a.url),
  );
  if (attach) return attach.url;

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

async function resolve(message: Message, args: string[]): Promise<Buffer | null> {
  const urlArg = args.find((a) => /^https?:\/\//.test(a));
  const url = await findImageUrl(message, urlArg);
  if (!url) return null;
  return fetchBuf(url);
}

async function send(message: Message, buf: Buffer, name: string): Promise<void> {
  await message.reply({ files: [new AttachmentBuilder(buf, { name })] });
}

function noImage(message: Message): Promise<void> {
  return message.reply("❌ No image found. Attach one, reply to a message with one, or provide a URL.").then(() => undefined);
}

const MAX_W = 1000;

async function load(raw: Buffer): Promise<{ img: Sharp; w: number; h: number }> {
  const img = sharp(raw);
  const meta = await img.metadata();
  const w = meta.width ?? 800;
  const h = meta.height ?? 600;
  const scale = w > MAX_W ? MAX_W / w : 1;
  const nw = Math.round(w * scale);
  const nh = Math.round(h * scale);
  const resized = w > MAX_W ? img.resize(nw, nh) : img;
  return { img: resized, w: nw, h: nh };
}

// ─── BLUR ─────────────────────────────────────────────────────────────────────
export async function cmdImgBlur(message: Message, args: string[]): Promise<void> {
  const raw = await resolve(message, args);
  if (!raw) { await noImage(message); return; }
  const sigma = Math.min(Math.max(Number(args.find((a) => /^\d+(\.\d+)?$/.test(a))) || 5, 0.3), 1000);
  const { img } = await load(raw);
  const out = await img.blur(sigma).png().toBuffer();
  await send(message, out, "blur.png");
}

// ─── INVERT ───────────────────────────────────────────────────────────────────
export async function cmdImgInvert(message: Message, args: string[]): Promise<void> {
  const raw = await resolve(message, args);
  if (!raw) { await noImage(message); return; }
  const { img } = await load(raw);
  const out = await img.negate().png().toBuffer();
  await send(message, out, "invert.png");
}

// ─── GRAYSCALE ────────────────────────────────────────────────────────────────
export async function cmdImgGrayscale(message: Message, args: string[]): Promise<void> {
  const raw = await resolve(message, args);
  if (!raw) { await noImage(message); return; }
  const { img } = await load(raw);
  const out = await img.grayscale().png().toBuffer();
  await send(message, out, "grayscale.png");
}

// ─── JPEG (heavy compression artifacts — deepfried feel) ──────────────────────
export async function cmdImgJpeg(message: Message, args: string[]): Promise<void> {
  const raw = await resolve(message, args);
  if (!raw) { await noImage(message); return; }
  const quality = Math.min(Math.max(Number(args.find((a) => /^\d+$/.test(a))) || 5, 1), 95);
  const { img } = await load(raw);
  const out = await img.jpeg({ quality }).toBuffer();
  await send(message, out, "jpeg.jpg");
}

// ─── PIXELATE ─────────────────────────────────────────────────────────────────
export async function cmdImgPixelate(message: Message, args: string[]): Promise<void> {
  const raw = await resolve(message, args);
  if (!raw) { await noImage(message); return; }
  const size = Math.min(Math.max(Number(args.find((a) => /^\d+$/.test(a))) || 12, 2), 100);
  const { img, w, h } = await load(raw);
  const pw = Math.max(1, Math.floor(w / size));
  const ph = Math.max(1, Math.floor(h / size));
  const out = await img
    .resize(pw, ph, { kernel: sharp.kernel.nearest })
    .resize(w, h, { kernel: sharp.kernel.nearest })
    .png()
    .toBuffer();
  await send(message, out, "pixelate.png");
}

// ─── FLIP (horizontal mirror) ──────────────────────────────────────────────────
export async function cmdImgFlip(message: Message, args: string[]): Promise<void> {
  const raw = await resolve(message, args);
  if (!raw) { await noImage(message); return; }
  const { img } = await load(raw);
  const out = await img.flop().png().toBuffer(); // sharp: flop = horizontal mirror
  await send(message, out, "flip.png");
}

// ─── FLOP (vertical mirror) ────────────────────────────────────────────────────
export async function cmdImgFlop(message: Message, args: string[]): Promise<void> {
  const raw = await resolve(message, args);
  if (!raw) { await noImage(message); return; }
  const { img } = await load(raw);
  const out = await img.flip().png().toBuffer(); // sharp: flip = vertical mirror
  await send(message, out, "flop.png");
}

// ─── ROTATE ───────────────────────────────────────────────────────────────────
export async function cmdImgRotate(message: Message, args: string[]): Promise<void> {
  const raw = await resolve(message, args);
  if (!raw) { await noImage(message); return; }
  const deg = Number(args.find((a) => /^-?\d+$/.test(a))) || 90;
  const { img } = await load(raw);
  const out = await img.rotate(deg, { background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
  await send(message, out, "rotate.png");
}

// ─── RESIZE ───────────────────────────────────────────────────────────────────
export async function cmdImgResize(message: Message, args: string[]): Promise<void> {
  const raw = await resolve(message, args);
  if (!raw) { await noImage(message); return; }

  const meta = await sharp(raw).metadata();
  const origW = meta.width ?? 800;
  const origH = meta.height ?? 600;

  const sizeArg = args.find((a) => /^\d+(%|x\d+)?$/.test(a) && !/^https?:/.test(a)) ?? "50%";
  let newW: number;
  let newH: number;

  if (sizeArg.endsWith("%")) {
    const pct = Math.min(Math.max(Number(sizeArg.slice(0, -1)), 1), 400) / 100;
    newW = Math.round(origW * pct);
    newH = Math.round(origH * pct);
  } else if (sizeArg.includes("x")) {
    const [ws, hs] = sizeArg.split("x");
    newW = Number(ws) || origW;
    newH = Number(hs) || origH;
  } else {
    newW = Number(sizeArg) || origW;
    newH = Math.round(origH * (newW / origW));
  }

  newW = Math.min(Math.max(newW, 1), 3000);
  newH = Math.min(Math.max(newH, 1), 3000);

  const out = await sharp(raw).resize(newW, newH, { fit: "fill" }).png().toBuffer();
  await send(message, out, "resize.png");
}

// ─── SEPIA ────────────────────────────────────────────────────────────────────
export async function cmdImgSepia(message: Message, args: string[]): Promise<void> {
  const raw = await resolve(message, args);
  if (!raw) { await noImage(message); return; }
  const { img } = await load(raw);
  // Sepia matrix via recomb
  const out = await img.recomb([
    [0.393, 0.769, 0.189],
    [0.349, 0.686, 0.168],
    [0.272, 0.534, 0.131],
  ]).png().toBuffer();
  await send(message, out, "sepia.png");
}

// ─── DEEPFRY ─────────────────────────────────────────────────────────────────
export async function cmdImgDeepfry(message: Message, args: string[]): Promise<void> {
  const raw = await resolve(message, args);
  if (!raw) { await noImage(message); return; }
  const { img } = await load(raw);
  const out = await img
    .modulate({ saturation: 3, brightness: 1.1 })
    .sharpen({ sigma: 2, m1: 6, m2: 8 })
    .jpeg({ quality: 2 })
    .toBuffer();
  await send(message, out, "deepfry.jpg");
}

// ─── NEON ─────────────────────────────────────────────────────────────────────
export async function cmdImgNeon(message: Message, args: string[]): Promise<void> {
  const raw = await resolve(message, args);
  if (!raw) { await noImage(message); return; }
  const { img } = await load(raw);
  const out = await img
    .negate()
    .modulate({ saturation: 5, hue: 180 })
    .png()
    .toBuffer();
  await send(message, out, "neon.png");
}

// ─── BRIGHTEN ─────────────────────────────────────────────────────────────────
export async function cmdImgBrighten(message: Message, args: string[]): Promise<void> {
  const raw = await resolve(message, args);
  if (!raw) { await noImage(message); return; }
  const amount = Math.min(Math.max(Number(args.find((a) => /^\d+(\.\d+)?$/.test(a))) || 1.5, 0.1), 10);
  const { img } = await load(raw);
  const out = await img.modulate({ brightness: amount }).png().toBuffer();
  await send(message, out, "brighten.png");
}

// ─── CONTRAST ─────────────────────────────────────────────────────────────────
// sharp doesn't have a direct contrast knob — use linear() a/b to fake it
export async function cmdImgContrast(message: Message, args: string[]): Promise<void> {
  const raw = await resolve(message, args);
  if (!raw) { await noImage(message); return; }
  // contrast factor 1–5 (default 2)
  const factor = Math.min(Math.max(Number(args.find((a) => /^\d+(\.\d+)?$/.test(a))) || 2, 0.1), 5);
  const { img } = await load(raw);
  // a = factor, b = 128*(1 - factor)  →  stretches values around midpoint
  const a = factor;
  const b = Math.round(128 * (1 - factor));
  const out = await img.linear(a, b).png().toBuffer();
  await send(message, out, "contrast.png");
}

// ─── SATURATE ─────────────────────────────────────────────────────────────────
export async function cmdImgSaturate(message: Message, args: string[]): Promise<void> {
  const raw = await resolve(message, args);
  if (!raw) { await noImage(message); return; }
  const amount = Math.min(Math.max(Number(args.find((a) => /^\d+(\.\d+)?$/.test(a))) || 3, 0), 20);
  const { img } = await load(raw);
  const out = await img.modulate({ saturation: amount }).png().toBuffer();
  await send(message, out, "saturate.png");
}

// ─── SHARPEN ──────────────────────────────────────────────────────────────────
export async function cmdImgSharpen(message: Message, args: string[]): Promise<void> {
  const raw = await resolve(message, args);
  if (!raw) { await noImage(message); return; }
  const sigma = Math.min(Math.max(Number(args.find((a) => /^\d+(\.\d+)?$/.test(a))) || 2, 0.5), 10);
  const { img } = await load(raw);
  const out = await img.sharpen({ sigma }).png().toBuffer();
  await send(message, out, "sharpen.png");
}

// ─── THRESHOLD (posterize-style B&W) ─────────────────────────────────────────
export async function cmdImgThreshold(message: Message, args: string[]): Promise<void> {
  const raw = await resolve(message, args);
  if (!raw) { await noImage(message); return; }
  const t = Math.min(Math.max(Number(args.find((a) => /^\d+$/.test(a))) || 128, 1), 254);
  const { img } = await load(raw);
  const out = await img.threshold(t).png().toBuffer();
  await send(message, out, "threshold.png");
}

// ─── IMAGEINFO ────────────────────────────────────────────────────────────────
export async function cmdImgInfo(message: Message, args: string[]): Promise<void> {
  const urlArg = args.find((a) => /^https?:\/\//.test(a));
  const url = await findImageUrl(message, urlArg);
  if (!url) { await noImage(message); return; }

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; DiscordBot/1.0)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) { await message.reply("❌ Could not fetch image."); return; }

  const buf = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(buf).metadata();

  const kb = (buf.byteLength / 1024).toFixed(1);
  const fmt = (meta.format ?? "unknown").toUpperCase();
  const channels = meta.channels ?? "?";
  const hasAlpha = meta.hasAlpha ? "Yes" : "No";

  const e = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🖼️ Image Info")
    .setThumbnail(url)
    .addFields(
      { name: "Format",     value: fmt,                             inline: true },
      { name: "Dimensions", value: `${meta.width}×${meta.height}`, inline: true },
      { name: "Size",       value: `${kb} KB`,                     inline: true },
      { name: "Channels",   value: String(channels),               inline: true },
      { name: "Alpha",      value: hasAlpha,                        inline: true },
      ...(meta.density ? [{ name: "DPI", value: String(meta.density), inline: true }] : []),
    );
  await message.reply({ embeds: [e] });
}

// ─── Exported handler map ─────────────────────────────────────────────────────
export type ImgHandler = (message: Message, args: string[]) => Promise<void>;

export const IMAGE_HANDLERS: Record<string, ImgHandler> = {
  blur:        cmdImgBlur,
  invert:      cmdImgInvert,      negative:   cmdImgInvert,
  grayscale:   cmdImgGrayscale,   greyscale:  cmdImgGrayscale,  grey: cmdImgGrayscale,  gray: cmdImgGrayscale,
  jpeg:        cmdImgJpeg,        jpegify:    cmdImgJpeg,
  pixelate:    cmdImgPixelate,    pixel:      cmdImgPixelate,
  flip:        cmdImgFlip,        mirror:     cmdImgFlip,
  flop:        cmdImgFlop,
  rotate:      cmdImgRotate,      rot:        cmdImgRotate,
  resize:      cmdImgResize,      scale:      cmdImgResize,
  sepia:       cmdImgSepia,
  deepfry:     cmdImgDeepfry,     fry:        cmdImgDeepfry,
  neon:        cmdImgNeon,
  brighten:    cmdImgBrighten,    brightness: cmdImgBrighten,
  contrast:    cmdImgContrast,
  saturate:    cmdImgSaturate,    saturation: cmdImgSaturate,
  sharpen:     cmdImgSharpen,
  threshold:   cmdImgThreshold,   bw:         cmdImgThreshold,
  imageinfo:   cmdImgInfo,        imginfo:    cmdImgInfo,       ii: cmdImgInfo,
};
