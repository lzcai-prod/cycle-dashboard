/**
 * Copies data/ files from the repo root into frontend/public/data/
 * so they are served as static assets by Next.js.
 * Runs as a pre-build step.
 */
import { cpSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "..", "data");
const dest = join(__dirname, "..", "public", "data");

if (!existsSync(src)) {
  console.error("❌ Source data/ directory not found at:", src);
  process.exit(1);
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`✅ Copied data/ → public/data/`);
