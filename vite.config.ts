import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { manifestPlugin } from "./scripts/build/manifestPlugin.js";

const projectDir = fileURLToPath(new URL(".", import.meta.url));

function readGeneratedEntries() {
  const p = path.resolve(projectDir, "scripts/.generated/entries.json");
  try {
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function computeRollupInput() {
  const entries = readGeneratedEntries();
  // Convert to a simple name->path map
  return entries;
}

export default defineConfig({
  plugins: [svelte(), manifestPlugin()],
  build: {
    outDir: "dist",
    rollupOptions: {
      // Only set input if we actually have entries; otherwise let Vite default (and expect at least one HTML if present)
      input: (() => {
        const e = computeRollupInput();
        return Object.keys(e).length > 0 ? e : undefined;
      })(),
      output: {
        entryFileNames: (chunkInfo: any) => {
          // Place background and content entries in their own folders for clean manifest paths
          const name = chunkInfo.name;
          if (name === "background") return "background/index.js";
          if (name.startsWith("content_")) {
            const base = name.replace(/^content_/, "");
            return `content/${base}.js`;
          }
          return `assets/[name].js`;
        },
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`,
      },
    },
  },
});
