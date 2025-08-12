#!/usr/bin/env tsx
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const contentDir = path.join(rootDir, "src", "content");
const backgroundDir = path.join(rootDir, "src", "background");
const popupDir = path.join(rootDir, "src", "popup");
const optionsDir = path.join(rootDir, "src", "options");
const sidepanelDir = path.join(rootDir, "src", "sidepanel");
const configDir = path.join(__dirname, "config");

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

async function readJson(filePath: string): Promise<any> {
  try {
    const data = await fs.readFile(filePath, "utf8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeJson(filePath: string, data: any): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function newContent(name: string): Promise<void> {
  if (!name) {
    console.error("Usage: new content <name>");
    process.exit(1);
  }
  await ensureDir(contentDir);
  const tsPath = path.join(contentDir, `${name}.ts`);
  if (!(await fileExists(tsPath))) {
    await fs.writeFile(
      tsPath,
      `// Content script: ${name}\nconsole.debug('[content:${name}] loaded');\n`,
      "utf8"
    );
    console.log(`[new:content] created ${path.relative(rootDir, tsPath)}`);
  } else {
    console.log(
      `[new:content] ${path.relative(rootDir, tsPath)} already exists`
    );
  }

  await ensureDir(configDir);
  const cfgPath = path.join(configDir, "content.json");
  let cfg = await readJson(cfgPath);
  if (!cfg[name])
    cfg[name] = { matches: ["<all_urls>"], run_at: "document_end" };
  await writeJson(cfgPath, cfg);
  console.log(
    "[new:content] Added default config. You can customize matches/run_at in scripts/config/content.json (existing manifest entries are never overwritten)."
  );
}

async function newBackground(): Promise<void> {
  await ensureDir(backgroundDir);
  const tsPath = path.join(backgroundDir, "index.ts");
  if (!(await fileExists(tsPath))) {
    await fs.writeFile(
      tsPath,
      `// Background service worker
console.debug('[background] service worker started');

// Example: handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.debug('[background] extension installed:', details.reason);
});
`,
      "utf8"
    );
    console.log(`[new:background] created ${path.relative(rootDir, tsPath)}`);
  } else {
    console.log(
      `[new:background] ${path.relative(rootDir, tsPath)} already exists`
    );
  }
}

async function newPopup(componentName?: string): Promise<void> {
  await ensureDir(popupDir);

  const htmlPath = path.join(popupDir, "index.html");
  const mainPath = path.join(popupDir, "main.ts");

  if (!(await fileExists(htmlPath))) {
    const svelteComponent = componentName || "PopupApp";
    await fs.writeFile(
      htmlPath,
      `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Extension Popup</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>`,
      "utf8"
    );
    console.log(`[new:popup] created ${path.relative(rootDir, htmlPath)}`);
  }

  if (!(await fileExists(mainPath))) {
    const svelteComponent = componentName || "PopupApp";
    await fs.writeFile(
      mainPath,
      `import '../app.css';
import { mount } from 'svelte';
import ${svelteComponent} from './${svelteComponent}.svelte';

const target = document.getElementById('app');
if (!target) {
  throw new Error('Could not find app container');
}

mount(${svelteComponent}, { target });`,
      "utf8"
    );
    console.log(`[new:popup] created ${path.relative(rootDir, mainPath)}`);
  }

  if (componentName) {
    const svelteFile = path.join(popupDir, `${componentName}.svelte`);
    if (!(await fileExists(svelteFile))) {
      await fs.writeFile(
        svelteFile,
        `<script lang="ts">
  let count = $state(0);
</script>

<div class="p-4">
  <h1>Extension Popup</h1>
  <button class="btn btn-primary" onclick={() => count++}>
    Count: {count}
  </button>
</div>`,
        "utf8"
      );
      console.log(`[new:popup] created ${path.relative(rootDir, svelteFile)}`);
    }
  }
}

async function newOptions(componentName?: string): Promise<void> {
  await ensureDir(optionsDir);

  const htmlPath = path.join(optionsDir, "index.html");
  const mainPath = path.join(optionsDir, "main.ts");

  if (!(await fileExists(htmlPath))) {
    const svelteComponent = componentName || "OptionsApp";
    await fs.writeFile(
      htmlPath,
      `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Extension Options</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>`,
      "utf8"
    );
    console.log(`[new:options] created ${path.relative(rootDir, htmlPath)}`);
  }

  if (!(await fileExists(mainPath))) {
    const svelteComponent = componentName || "OptionsApp";
    await fs.writeFile(
      mainPath,
      `import '../app.css';
import { mount } from 'svelte';
import ${svelteComponent} from './${svelteComponent}.svelte';

const target = document.getElementById('app');
if (!target) {
  throw new Error('Could not find app container');
}

mount(${svelteComponent}, { target });`,
      "utf8"
    );
    console.log(`[new:options] created ${path.relative(rootDir, mainPath)}`);
  }

  if (componentName) {
    const svelteFile = path.join(optionsDir, `${componentName}.svelte`);
    if (!(await fileExists(svelteFile))) {
      await fs.writeFile(
        svelteFile,
        `<script lang="ts">
  let settings = $state({ theme: 'light', notifications: true });
</script>

<div class="p-8 max-w-2xl mx-auto">
  <h1 class="text-2xl font-bold mb-6">Extension Options</h1>
  
  <div class="space-y-4">
    <div class="form-control">
      <label class="label">
        <span class="label-text">Theme</span>
      </label>
      <select class="select select-bordered" bind:value={settings.theme}>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="auto">Auto</option>
      </select>
    </div>
    
    <div class="form-control">
      <label class="cursor-pointer label">
        <span class="label-text">Enable notifications</span>
        <input type="checkbox" class="checkbox" bind:checked={settings.notifications} />
      </label>
    </div>
  </div>
</div>`,
        "utf8"
      );
      console.log(
        `[new:options] created ${path.relative(rootDir, svelteFile)}`
      );
    }
  }
}

async function newSidepanel(componentName?: string): Promise<void> {
  await ensureDir(sidepanelDir);

  const htmlPath = path.join(sidepanelDir, "index.html");
  const mainPath = path.join(sidepanelDir, "main.ts");

  if (!(await fileExists(htmlPath))) {
    await fs.writeFile(
      htmlPath,
      `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Extension Side Panel</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>`,
      "utf8"
    );
    console.log(`[new:sidepanel] created ${path.relative(rootDir, htmlPath)}`);
  }

  if (!(await fileExists(mainPath))) {
    const svelteComponent = componentName || "SidepanelApp";
    await fs.writeFile(
      mainPath,
      `import '../app.css';
import { mount } from 'svelte';
import ${svelteComponent} from './${svelteComponent}.svelte';

const target = document.getElementById('app');
if (!target) {
  throw new Error('Could not find app container');
}

mount(${svelteComponent}, { target });`,
      "utf8"
    );
    console.log(`[new:sidepanel] created ${path.relative(rootDir, mainPath)}`);
  }

  if (componentName) {
    const svelteFile = path.join(sidepanelDir, `${componentName}.svelte`);
    if (!(await fileExists(svelteFile))) {
      await fs.writeFile(
        svelteFile,
        `<script lang="ts">
  let activeTab = $state('home');
</script>

<div class="h-screen bg-base-100">
  <div class="flex h-full flex-col">
    <header class="navbar bg-base-200">
      <div class="navbar-start">
        <h1 class="text-lg font-semibold">Extension</h1>
      </div>
    </header>
    
    <main class="flex-1 p-4">
      <div class="tabs tabs-bordered mb-4">
        <button 
          class="tab" 
          class:tab-active={activeTab === 'home'}
          onclick={() => activeTab = 'home'}
        >
          Home
        </button>
        <button 
          class="tab" 
          class:tab-active={activeTab === 'settings'}
          onclick={() => activeTab = 'settings'}
        >
          Settings
        </button>
      </div>
      
      {#if activeTab === 'home'}
        <div class="card bg-base-200">
          <div class="card-body">
            <h2 class="card-title">Welcome</h2>
            <p>This is your extension side panel.</p>
          </div>
        </div>
      {:else if activeTab === 'settings'}
        <div class="card bg-base-200">
          <div class="card-body">
            <h2 class="card-title">Settings</h2>
            <p>Configure your extension here.</p>
          </div>
        </div>
      {/if}
    </main>
  </div>
</div>`,
        "utf8"
      );
      console.log(
        `[new:sidepanel] created ${path.relative(rootDir, svelteFile)}`
      );
    }
  }

  // Update manifest template to include side panel
  const manifestPath = path.join(rootDir, "public", "manifest.json");
  const manifest = await readJson(manifestPath);
  if (!manifest.side_panel) {
    manifest.side_panel = { default_path: "sidepanel/index.html" };
    await writeJson(manifestPath, manifest);
    console.log("[new:sidepanel] Added side_panel to manifest.json");
  }

  // Add sidePanel permission if not present
  if (!manifest.permissions) manifest.permissions = [];
  if (!manifest.permissions.includes("sidePanel")) {
    manifest.permissions.push("sidePanel");
    await writeJson(manifestPath, manifest);
    console.log("[new:sidepanel] Added sidePanel permission to manifest.json");
  }
}

async function renameExtension(newName: string): Promise<void> {
  if (!newName) {
    console.error("Usage: rename <new-name>");
    process.exit(1);
  }

  // Update package.json
  const packagePath = path.join(rootDir, "package.json");
  const packageJson = await readJson(packagePath);
  const oldName = packageJson.name;
  packageJson.name = newName.toLowerCase().replace(/\s+/g, "-");
  await writeJson(packagePath, packageJson);
  console.log(
    `[rename] Updated package.json name: ${oldName} → ${packageJson.name}`
  );

  // Update manifest.json
  const manifestPath = path.join(rootDir, "public", "manifest.json");
  const manifest = await readJson(manifestPath);
  const oldManifestName = manifest.name;
  manifest.name = newName;
  await writeJson(manifestPath, manifest);
  console.log(
    `[rename] Updated manifest.json name: ${oldManifestName} → ${newName}`
  );
}

async function managePermission(
  action: string,
  permission?: string
): Promise<void> {
  if (!permission) {
    console.error(`Usage: permission ${action} <permission>`);
    process.exit(1);
  }

  const manifestPath = path.join(rootDir, "public", "manifest.json");
  const manifest = await readJson(manifestPath);

  if (!manifest.permissions) manifest.permissions = [];

  if (action === "add") {
    if (!manifest.permissions.includes(permission)) {
      manifest.permissions.push(permission);
      await writeJson(manifestPath, manifest);
      console.log(`[permission] Added: ${permission}`);
    } else {
      console.log(`[permission] Already present: ${permission}`);
    }
  } else if (action === "remove") {
    const index = manifest.permissions.indexOf(permission);
    if (index > -1) {
      manifest.permissions.splice(index, 1);
      await writeJson(manifestPath, manifest);
      console.log(`[permission] Removed: ${permission}`);
    } else {
      console.log(`[permission] Not found: ${permission}`);
    }
  } else {
    console.error("Usage: permission add|remove <permission>");
    process.exit(1);
  }
}

async function setVersion(version: string): Promise<void> {
  if (!version) {
    console.error("Usage: version set <x.y.z>");
    process.exit(1);
  }

  // Update package.json
  const packagePath = path.join(rootDir, "package.json");
  const packageJson = await readJson(packagePath);
  packageJson.version = version;
  await writeJson(packagePath, packageJson);

  // Update manifest.json
  const manifestPath = path.join(rootDir, "public", "manifest.json");
  const manifest = await readJson(manifestPath);
  manifest.version = version;
  await writeJson(manifestPath, manifest);

  console.log(`[version] Set to ${version}`);
}

async function bumpVersion(type: string): Promise<void> {
  if (!["major", "minor", "patch"].includes(type)) {
    console.error("Usage: version bump major|minor|patch");
    process.exit(1);
  }

  const packagePath = path.join(rootDir, "package.json");
  const packageJson = await readJson(packagePath);
  const [major, minor, patch] = packageJson.version.split(".").map(Number);

  let newVersion: string;
  if (type === "major") {
    newVersion = `${major + 1}.0.0`;
  } else if (type === "minor") {
    newVersion = `${major}.${minor + 1}.0`;
  } else {
    newVersion = `${major}.${minor}.${patch + 1}`;
  }

  await setVersion(newVersion);
}

async function main(): Promise<void> {
  const [, , cmd, sub, arg] = process.argv;

  if (cmd === "new") {
    switch (sub) {
      case "content":
        await newContent(arg);
        break;
      case "background":
        await newBackground();
        break;
      case "popup":
        await newPopup(arg);
        break;
      case "options":
        await newOptions(arg);
        break;
      case "sidepanel":
        await newSidepanel(arg);
        break;
      default:
        console.error(
          "Usage: new content|background|popup|options|sidepanel [name]"
        );
        process.exit(1);
    }
  } else if (cmd === "rename") {
    await renameExtension(sub);
  } else if (cmd === "permission") {
    await managePermission(sub, arg);
  } else if (cmd === "version") {
    if (sub === "set") {
      await setVersion(arg);
    } else if (sub === "bump") {
      await bumpVersion(arg);
    } else {
      console.error("Usage: version set|bump <version|type>");
      process.exit(1);
    }
  } else {
    console.log("Usage:");
    console.log("  tsx scripts/cli.ts new content <name>");
    console.log("  tsx scripts/cli.ts new background");
    console.log("  tsx scripts/cli.ts new popup [component-name]");
    console.log("  tsx scripts/cli.ts new options [component-name]");
    console.log("  tsx scripts/cli.ts new sidepanel [component-name]");
    console.log("  tsx scripts/cli.ts rename <new-name>");
    console.log("  tsx scripts/cli.ts permission add|remove <permission>");
    console.log("  tsx scripts/cli.ts version set <x.y.z>");
    console.log("  tsx scripts/cli.ts version bump major|minor|patch");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
