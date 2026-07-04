import { Router, type IRouter } from "express";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve, relative, extname, isAbsolute } from "node:path";
import { requireAuth } from "../../middlewares/requireAuth.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const router: IRouter = Router();
router.use(requireAuth);

// The root of the bot source to expose
const BOT_SRC = resolve(process.cwd(), "../../artifacts/discord-bot/src");
const PROJECT_ROOT = resolve(process.cwd(), "../..");

// Secret patterns to redact from file content
const SECRET_PATTERNS = [
  /\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{27,}\b/g, // Discord tokens
  /DISCORD_BOT_TOKEN\s*[=:]\s*["']?[^\s"']+/gi,
  /DATABASE_URL\s*[=:]\s*["']?postgresql[^\s"']+/gi,
  /OPENAI_API_KEY\s*[=:]\s*["']?sk-[^\s"']+/gi,
];

// Paths that are NEVER allowed
const BLOCKED_PATHS = [".env", ".env.", "node_modules", "dist", ".git", "__pycache__", ".cache"];
const BLOCKED_EXTENSIONS = [".key", ".pem", ".p12", ".pfx"];

function isPathSafe(filePath: string): boolean {
  const norm = filePath.toLowerCase();
  if (BLOCKED_PATHS.some((b) => norm.includes(b))) return false;
  if (BLOCKED_EXTENSIONS.some((ext) => norm.endsWith(ext))) return false;
  return true;
}

function redactSecrets(content: string): string {
  let result = content;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

function getLanguage(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".ts": "typescript", ".tsx": "tsx", ".js": "javascript",
    ".json": "json", ".md": "markdown", ".yaml": "yaml", ".yml": "yaml",
    ".toml": "toml", ".sh": "bash", ".css": "css", ".html": "html",
    ".sql": "sql", ".txt": "plaintext",
  };
  return map[ext] ?? "plaintext";
}

type FileNode = {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number | null;
  children?: FileNode[];
};

async function buildTree(dir: string, rootDir: string, depth = 0): Promise<FileNode[]> {
  if (depth > 6) return [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: FileNode[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = relative(rootDir, fullPath);
    if (!isPathSafe(relPath)) continue;
    if (entry.name.startsWith(".")) continue; // skip dotfiles in tree

    if (entry.isDirectory()) {
      const children = await buildTree(fullPath, rootDir, depth + 1);
      nodes.push({ name: entry.name, path: relPath, type: "directory", size: null, children });
    } else {
      let size: number | null = null;
      try {
        const s = await stat(fullPath);
        size = s.size;
      } catch { /* ignore */ }
      nodes.push({ name: entry.name, path: relPath, type: "file", size });
    }
  }
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

router.get("/files/tree", async (req, res): Promise<void> => {
  try {
    const tree = await buildTree(BOT_SRC, BOT_SRC);
    res.json(tree);
  } catch (err) {
    req.log.error({ err }, "Failed to build file tree");
    res.status(500).json({ error: "Failed to read file tree" });
  }
});

router.get("/files/content", async (req, res): Promise<void> => {
  const rawPath = typeof req.query.path === "string" ? req.query.path : "";
  if (!rawPath) {
    res.status(400).json({ error: "path query parameter required" });
    return;
  }

  // Prevent path traversal — use separator-safe relative check
  const resolved = resolve(BOT_SRC, rawPath);
  const rel = relative(BOT_SRC, resolved);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    res.status(403).json({ error: "Access denied — path outside allowed directory" });
    return;
  }
  if (!isPathSafe(rawPath)) {
    res.status(403).json({ error: "Access denied — restricted path" });
    return;
  }

  try {
    let content = await readFile(resolved, "utf-8");
    content = redactSecrets(content);
    const lines = content.split("\n").length;
    res.json({ path: rawPath, content, lines, language: getLanguage(rawPath) });
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      res.status(404).json({ error: "File not found" });
    } else {
      res.status(500).json({ error: "Failed to read file" });
    }
  }
});

router.get("/files/search", async (req, res): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q || q.length < 2) {
    res.status(400).json({ error: "Query must be at least 2 characters" });
    return;
  }

  try {
    // Use execFile (no shell) — pass q as a literal fixed-string argument
    const { stdout } = await execFileAsync("grep", [
      "-rn",
      "--include=*.ts",
      "--include=*.js",
      "-m", "5",
      "-F",
      q,
      BOT_SRC,
    ]).catch(() => ({ stdout: "" }));

    const results = (stdout as string)
      .split("\n")
      .filter(Boolean)
      .slice(0, 100)
      .map((line) => {
        const match = line.match(/^(.+):(\d+):(.*)$/);
        if (!match) return null;
        const [, filePath, lineNum, content] = match;
        const relPath = relative(BOT_SRC, filePath);
        const rel2 = relative(BOT_SRC, resolve(BOT_SRC, relPath));
        if (rel2.startsWith("..") || isAbsolute(rel2) || !isPathSafe(relPath)) return null;
        const idx = content.indexOf(q);
        return {
          path: relPath,
          line: parseInt(lineNum, 10),
          content: content.trim(),
          matchStart: Math.max(0, idx),
          matchEnd: Math.max(0, idx + q.length),
        };
      })
      .filter(Boolean);

    res.json(results);
  } catch {
    res.json([]);
  }
});

export default router;
