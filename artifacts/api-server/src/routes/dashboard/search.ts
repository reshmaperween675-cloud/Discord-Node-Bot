import { Router, type IRouter } from "express";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve, relative, isAbsolute } from "node:path";
import { requireAuth } from "../../middlewares/requireAuth.js";

const execFileAsync = promisify(execFile);
const router: IRouter = Router();
router.use(requireAuth);

const BOT_SRC = resolve(process.cwd(), "../../artifacts/discord-bot/src");

router.get("/search", async (req, res): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
  if (!q || q.length < 2) {
    res.json({ commands: [], embeds: [], modules: [], files: [] });
    return;
  }

  try {
    // Import command + module + embed registries
    const commandsRouter = await import("./commands.js");
    const modulesRouter = await import("./modules.js");
    const embedsRouter = await import("./embeds.js");

    // Inline the static registries for search (re-use same data)
    const { default: commandsData } = await import("./commands.js");
    void commandsData; // just importing for side effects — we'll build our own arrays

    // Build search results inline from the static registries
    const COMMANDS = [
      { name: "rank", description: "View your XP rank card", category: "Leveling", type: "slash", isSlash: true },
      { name: "leaderboard", description: "View the XP leaderboard", category: "Leveling", type: "slash", isSlash: true },
      { name: "help", description: "View bot help", category: "General", type: "slash", isSlash: true },
      { name: "announce", description: "Make an announcement", category: "Utility", type: "slash", isSlash: true },
      { name: "warn", description: "Warn a member", category: "Utility", type: "slash", isSlash: true },
      { name: "ban", description: "Ban a member", category: "Moderation", type: "slash", isSlash: true },
      { name: "kick", description: "Kick a member", category: "Moderation", type: "slash", isSlash: true },
      { name: "mute", description: "Mute a member", category: "Moderation", type: "slash", isSlash: true },
      { name: "tournament", description: "Manage tournaments", category: "Server", type: "slash", isSlash: true },
      { name: "training", description: "Manage training sessions", category: "Server", type: "slash", isSlash: true },
      { name: "lowo hunt", description: "Hunt for animals", category: "Lowo", type: "prefix", isSlash: false },
      { name: "lowo battle", description: "Battle other users", category: "Lowo", type: "prefix", isSlash: false },
      { name: "lowo slots", description: "Play slots", category: "Lowo", type: "prefix", isSlash: false },
      { name: "mewo ai", description: "AI assistant commands", category: "Mewo", type: "prefix", isSlash: false },
      { name: "mewo fun", description: "Fun commands", category: "Mewo", type: "prefix", isSlash: false },
    ];

    const MODULES = [
      { name: "economy", displayName: "Economy", description: "Balance, daily rewards, rob, invest", category: "Games", commandCount: 8 },
      { name: "leveling", displayName: "XP & Leveling", description: "XP tracking, rank cards, leaderboards", category: "Progression", commandCount: 11 },
      { name: "moderation", displayName: "Moderation", description: "Kick, ban, mute, warn, purge", category: "Server Management", commandCount: 8 },
      { name: "lowo", displayName: "Lowo System", description: "Full RPG system with hunting, battles, economy", category: "Games", commandCount: 40 },
      { name: "mewo", displayName: "Mewo System", description: "AI, fun, utility, roleplay, games, search", category: "Fun", commandCount: 8 },
      { name: "raids", displayName: "Raids", description: "Raid management and logging", category: "Server Events", commandCount: 3 },
      { name: "antinuke", displayName: "Anti-Nuke", description: "Server protection against nukes", category: "Security", commandCount: 0 },
      { name: "verification", displayName: "Verification", description: "Discord OAuth2 member verification", category: "Security", commandCount: 0 },
    ];

    const EMBEDS = [
      { id: "leveling.rank", module: "Leveling", title: "Rank Card", description: "XP rank display" },
      { id: "leveling.levelup", module: "Leveling", title: "Level Up!", description: "Level up celebration" },
      { id: "utility.warn", module: "Moderation", title: "Warning Issued", description: "Warning notification" },
      { id: "raids.start", module: "Raids", title: "Raid Started", description: "Raid start announcement" },
      { id: "lowo.hunt", module: "Lowo", title: "Hunting Results", description: "Hunt outcome" },
      { id: "mewo.ai", module: "Mewo", title: "AI Response", description: "AI assistant reply" },
    ];

    const matchedCommands = COMMANDS.filter(
      (c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.category.toLowerCase().includes(q),
    ).slice(0, 5).map((c) => ({
      name: c.name, description: c.description, category: c.category, type: c.type,
      isSlash: c.isSlash, enabled: true, hidden: false, usageCount: 0,
    }));

    const matchedModules = MODULES.filter(
      (m) => m.name.includes(q) || m.displayName.toLowerCase().includes(q) || m.description.toLowerCase().includes(q),
    ).slice(0, 5).map((m) => ({
      name: m.name, displayName: m.displayName, description: m.description,
      enabled: true, commandCount: m.commandCount, category: m.category, errorCount: 0, lastError: null,
    }));

    const matchedEmbeds = EMBEDS.filter(
      (e) => e.id.includes(q) || (e.title?.toLowerCase().includes(q)) || e.module.toLowerCase().includes(q),
    ).slice(0, 5).map((e) => ({
      id: e.id, module: e.module, title: e.title, description: e.description,
      color: null, footer: null, thumbnail: null, image: null, fields: [], isDefault: true, lastModified: null, lastModifiedBy: null,
    }));

    // File search — use execFile (no shell) to prevent injection
    let fileResults: Array<{ path: string; line: number; content: string; matchStart: number; matchEnd: number }> = [];
    try {
      const { stdout } = await execFileAsync("grep", [
        "-rn", "--include=*.ts", "-m", "3", "-Fi", q, BOT_SRC,
      ]).catch(() => ({ stdout: "" }));
      fileResults = (stdout as string).split("\n").filter(Boolean).slice(0, 5).map((line) => {
        const match = line.match(/^(.+):(\d+):(.*)$/);
        if (!match) return null;
        const [, filePath, lineNum, content] = match;
        const relPath = relative(BOT_SRC, filePath);
        const rel2 = relative(BOT_SRC, resolve(BOT_SRC, relPath));
        if (rel2.startsWith("..") || isAbsolute(rel2)) return null;
        const idx = content.toLowerCase().indexOf(q);
        return { path: relPath, line: parseInt(lineNum, 10), content: content.trim(), matchStart: Math.max(0, idx), matchEnd: Math.max(0, idx + q.length) };
      }).filter(Boolean) as typeof fileResults;
    } catch { /* ignore */ }

    res.json({
      commands: matchedCommands,
      embeds: matchedEmbeds,
      modules: matchedModules,
      files: fileResults,
    });
  } catch (err) {
    req.log.error({ err }, "Search failed");
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
