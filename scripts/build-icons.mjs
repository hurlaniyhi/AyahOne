// Render the AyahOne icon SVG masters in `assets/source/` to the PNGs
// referenced by `app.json` (`assets/icon.png`, `assets/android-icon-*.png`,
// `assets/favicon.png`, `assets/splash-icon.png`).
//
// Usage:  node scripts/build-icons.mjs
//
// Sharp links against libvips with cairo, so SVG with gradients, opacity,
// and groups renders correctly at any output resolution.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const SRC = path.join(ROOT, 'assets', 'source');
const OUT = path.join(ROOT, 'assets');

// Each entry: source SVG → destination PNG (with the size Android / iOS /
// Expo expect). 1024 is the standard "high-res" master size; expo-build
// downscales as needed at build time.
const TARGETS = [
  { src: 'icon.svg',             out: 'icon.png',                     size: 1024 },
  { src: 'icon.svg',             out: 'splash-icon.png',              size: 1024 },
  { src: 'icon.svg',             out: 'favicon.png',                  size: 64   },
  { src: 'icon-foreground.svg',  out: 'android-icon-foreground.png',  size: 1024 },
  { src: 'icon-background.svg',  out: 'android-icon-background.png',  size: 1024 },
  { src: 'icon-monochrome.svg',  out: 'android-icon-monochrome.png',  size: 1024 },
];

async function render(srcFile, outFile, size) {
  const srcPath = path.join(SRC, srcFile);
  const outPath = path.join(OUT, outFile);
  const svg = await fs.readFile(srcPath);
  // density: 300 gives a high-res rasterization of the SVG before sharp's
  // final resize, which keeps vector edges crisp at any output size.
  await sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  const stat = await fs.stat(outPath);
  console.log(`  ${outFile.padEnd(34)} ${size}x${size}   ${(stat.size / 1024).toFixed(1).padStart(6)} KB`);
}

async function main() {
  console.log('Rendering AyahOne icons →');
  for (const t of TARGETS) {
    await render(t.src, t.out, t.size);
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error('Icon build failed:', e);
  process.exit(1);
});
