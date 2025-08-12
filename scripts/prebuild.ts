import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const GENERATED_DIR = path.join(__dirname, ".generated");
const CONFIG_DIR = path.join(__dirname, "config");

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath: string, fallback: any): Promise<any> {
  try {
    const data = await fs.readFile(filePath, "utf8");
    return JSON.parse(data);
  } catch {
    return fallback;
  }
}

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

async function buildEntries(): Promise<Record<string, string>> {
  const entries: Record<string, string> = {};

  // sidepanel (opt-in only)
  const sidepanelHtml = path.join(rootDir, "src", "sidepanel", "index.html");
  if (await fileExists(sidepanelHtml)) {
    entries.sidepanel = toPosix(sidepanelHtml);
  }

  // background
  const backgroundIndex = path.join(rootDir, "src", "background", "index.ts");
  if (await fileExists(backgroundIndex)) {
    entries.background = toPosix(backgroundIndex);
  }

  // content: separate scripts; use aggregator if exists for shared utils but prefer separate .ts files under src/content
  const contentDir = path.join(rootDir, "src", "content");
  if (await fileExists(contentDir)) {
    try {
      const files = await fs.readdir(contentDir);
      const tsFiles = files.filter((f) => f.endsWith(".ts"));
      for (const f of tsFiles) {
        const name = path.basename(f, ".ts");
        entries[`content_${name}`] = toPosix(path.join(contentDir, f));
      }
    } catch {}
  }

  // popup
  const popupHtml = path.join(rootDir, "src", "popup", "index.html");
  if (await fileExists(popupHtml)) {
    entries.popup = toPosix(popupHtml);
  }

  // options
  const optionsHtml = path.join(rootDir, "src", "options", "index.html");
  if (await fileExists(optionsHtml)) {
    entries.options = toPosix(optionsHtml);
  }

  return entries;
}

async function generateManifest(
  entries: Record<string, string>
): Promise<void> {
  const templatePath = path.join(rootDir, "public", "manifest.json");
  const manifest = await readJson(templatePath, {});

  // Keep existing fields; only add if absent
  // Background
  if (entries.background) {
    if (!manifest.background) manifest.background = {};
    if (!manifest.background.service_worker) {
      manifest.background.service_worker = "background/index.js";
    }
  }

  // Content scripts via config
  const contentConfigPath = path.join(CONFIG_DIR, "content.json");
  const contentConfig = await readJson(contentConfigPath, {});

  const contentEntries = Object.keys(entries)
    .filter((k) => k.startsWith("content_"))
    .map((k) => k.replace(/^content_/, ""));

  if (contentEntries.length > 0) {
    const existing = Array.isArray(manifest.content_scripts)
      ? manifest.content_scripts.slice()
      : [];

    // Build new content script records for entries not already present by js path
    const existingJsSet = new Set<string>();
    for (const rec of existing) {
      if (Array.isArray(rec.js)) {
        for (const j of rec.js) existingJsSet.add(j);
      }
    }

    for (const name of contentEntries) {
      const jsPath = `content/${name}.js`;
      if (existingJsSet.has(jsPath)) continue;

      const cfg = contentConfig[name] || {};
      const matches = cfg.matches || ["<all_urls>"];
      const run_at = cfg.run_at || "document_end";
      const allFrames = cfg.all_frames || false;

      existing.push({ matches, js: [jsPath], run_at, all_frames: allFrames });
    }

    if (existing.length > 0 && !manifest.content_scripts) {
      manifest.content_scripts = existing;
    } else if (existing.length > 0) {
      // if already existed, we merged above; keep as-is
      manifest.content_scripts = existing;
    }
  }

  // Popup
  if (entries.popup) {
    if (!manifest.action) manifest.action = {};
    if (!manifest.action.default_popup) {
      manifest.action.default_popup = "popup/index.html";
    }
  }

  // Options
  if (entries.options) {
    if (!manifest.options_page) {
      manifest.options_page = "options/index.html";
    }
  }

  // Side panel is opt-in; do not set unless user already has it in template and wants to keep
  if (
    entries.sidepanel &&
    manifest.side_panel &&
    !manifest.side_panel.default_path
  ) {
    manifest.side_panel.default_path = "sidepanel/index.html";
  }

  await ensureDir(GENERATED_DIR);
  await fs.writeFile(
    path.join(GENERATED_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );
}

async function writeEntries(entries: Record<string, string>): Promise<void> {
  await ensureDir(GENERATED_DIR);
  await fs.writeFile(
    path.join(GENERATED_DIR, "entries.json"),
    JSON.stringify(entries, null, 2),
    "utf8"
  );
}

async function main(): Promise<void> {
  await ensureDir(GENERATED_DIR);
  await ensureDir(CONFIG_DIR);
  const entries = await buildEntries();
  await writeEntries(entries);
  await generateManifest(entries);
  console.log("[prebuild] Entries:", entries);
  console.log(
    "[prebuild] Manifest generated at scripts/.generated/manifest.json"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
