import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function manifestPlugin() {
  return {
    name: "emit-generated-manifest",
    apply: "build" as const,
    async generateBundle() {
      const genPath = path.resolve(__dirname, "../.generated/manifest.json");
      try {
        const manifest = await fs.readFile(genPath, "utf8");
        this.emitFile({
          type: "asset",
          fileName: "manifest.json",
          source: manifest,
        });
      } catch (e) {
        this.warn(
          "[manifestPlugin] No generated manifest found. Ensure build:prepare ran."
        );
      }
    },
  };
}
