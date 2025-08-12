import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { createReadStream } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

async function readJson(filePath: string): Promise<any> {
  try {
    const data = await fs.readFile(filePath, "utf8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function getAllFiles(dir: string, basePath = ""): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.join(basePath, entry.name);

    if (entry.isDirectory()) {
      const subFiles = await getAllFiles(fullPath, relativePath);
      files.push(...subFiles);
    } else {
      files.push(relativePath);
    }
  }

  return files;
}

// Simple ZIP implementation (basic, but works for Chrome extensions)
class SimpleZip {
  private entries: Array<{ name: string; data: Buffer }> = [];

  addFile(name: string, data: Buffer): void {
    this.entries.push({ name, data });
  }

  async writeToFile(outputPath: string): Promise<void> {
    const chunks: Buffer[] = [];
    const centralDirectory: Buffer[] = [];
    let offset = 0;

    // Write local file headers and data
    for (const entry of this.entries) {
      const fileName = Buffer.from(entry.name, "utf8");
      const fileData = entry.data;

      // Local file header
      const localHeader = Buffer.alloc(30 + fileName.length);
      localHeader.writeUInt32LE(0x04034b50, 0); // signature
      localHeader.writeUInt16LE(10, 4); // version needed
      localHeader.writeUInt16LE(0, 6); // flags
      localHeader.writeUInt16LE(0, 8); // compression method (none)
      localHeader.writeUInt16LE(0, 10); // time
      localHeader.writeUInt16LE(0, 12); // date
      localHeader.writeUInt32LE(this.crc32(fileData), 14); // crc32
      localHeader.writeUInt32LE(fileData.length, 18); // compressed size
      localHeader.writeUInt32LE(fileData.length, 22); // uncompressed size
      localHeader.writeUInt16LE(fileName.length, 26); // filename length
      localHeader.writeUInt16LE(0, 28); // extra field length
      fileName.copy(localHeader, 30);

      chunks.push(localHeader);
      chunks.push(fileData);

      // Central directory entry
      const cdEntry = Buffer.alloc(46 + fileName.length);
      cdEntry.writeUInt32LE(0x02014b50, 0); // signature
      cdEntry.writeUInt16LE(10, 4); // version made by
      cdEntry.writeUInt16LE(10, 6); // version needed
      cdEntry.writeUInt16LE(0, 8); // flags
      cdEntry.writeUInt16LE(0, 10); // compression method
      cdEntry.writeUInt16LE(0, 12); // time
      cdEntry.writeUInt16LE(0, 14); // date
      cdEntry.writeUInt32LE(this.crc32(fileData), 16); // crc32
      cdEntry.writeUInt32LE(fileData.length, 20); // compressed size
      cdEntry.writeUInt32LE(fileData.length, 24); // uncompressed size
      cdEntry.writeUInt16LE(fileName.length, 28); // filename length
      cdEntry.writeUInt16LE(0, 30); // extra field length
      cdEntry.writeUInt16LE(0, 32); // comment length
      cdEntry.writeUInt16LE(0, 34); // disk number
      cdEntry.writeUInt16LE(0, 36); // internal attributes
      cdEntry.writeUInt32LE(0, 38); // external attributes
      cdEntry.writeUInt32LE(offset, 42); // local header offset
      fileName.copy(cdEntry, 46);

      centralDirectory.push(cdEntry);
      offset += localHeader.length + fileData.length;
    }

    const centralDirectoryData = Buffer.concat(centralDirectory);

    // End of central directory
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); // signature
    eocd.writeUInt16LE(0, 4); // disk number
    eocd.writeUInt16LE(0, 6); // central directory start disk
    eocd.writeUInt16LE(this.entries.length, 8); // entries on this disk
    eocd.writeUInt16LE(this.entries.length, 10); // total entries
    eocd.writeUInt32LE(centralDirectoryData.length, 12); // central directory size
    eocd.writeUInt32LE(offset, 16); // central directory offset
    eocd.writeUInt16LE(0, 20); // comment length

    const allData = Buffer.concat([...chunks, centralDirectoryData, eocd]);
    await fs.writeFile(outputPath, allData);
  }

  private crc32(data: Buffer): number {
    const table = this.makeCrcTable();
    let crc = 0 ^ -1;

    for (let i = 0; i < data.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff];
    }

    return (crc ^ -1) >>> 0;
  }

  private makeCrcTable(): number[] {
    const table: number[] = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c;
    }
    return table;
  }
}

async function main(): Promise<void> {
  const distDir = path.join(rootDir, "dist");
  const releaseDir = path.join(rootDir, "release");

  // Check if dist exists
  try {
    await fs.access(distDir);
  } catch {
    console.error(
      "[zip] dist/ directory not found. Run 'npm run build' first."
    );
    process.exit(1);
  }

  // Get package info for naming
  const packagePath = path.join(rootDir, "package.json");
  const packageJson = await readJson(packagePath);
  const name = packageJson.name || "extension";
  const version = packageJson.version || "0.0.0";

  const zipName = `${name}-${version}.zip`;
  const zipPath = path.join(releaseDir, zipName);

  await ensureDir(releaseDir);

  // Get all files in dist
  const files = await getAllFiles(distDir);
  console.log(`[zip] Found ${files.length} files in dist/`);

  // Create ZIP
  const zip = new SimpleZip();

  for (const file of files) {
    const filePath = path.join(distDir, file);
    const data = await fs.readFile(filePath);
    zip.addFile(file.replace(/\\/g, "/"), data); // Normalize path separators
  }

  await zip.writeToFile(zipPath);

  const stats = await fs.stat(zipPath);
  console.log(`[zip] Created ${zipName} (${Math.round(stats.size / 1024)}KB)`);
  console.log(`[zip] Output: ${path.relative(rootDir, zipPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
