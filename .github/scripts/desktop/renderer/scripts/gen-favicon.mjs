// Generate favicon.ico + PNG icons from app/icon.svg (KFe Meetup mark).
//
// Outputs:
//   app/favicon.ico          — multi-resolution browser + Windows taskbar
//   app/apple-icon.png       — 180×180 Apple touch icon (auto-served by Next.js)
//   public/icon.png          — 512×512 for the Electron BrowserWindow
//
// Run:  npm run gen:favicon
// The SVG uses `fill="#0d99ff"` (primary blue) so tints are baked into the raster.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const svgPath = resolve(root, 'app/icon.svg');
const svg = readFileSync(svgPath);

// Render sharp with density high enough that the smallest ICO frame stays crisp.
// SVG viewBox is 48×48 → density 320 renders ~200px baseline, then resize down.
const svgOptions = { density: 320 };

async function rasterize(size) {
  return sharp(svg, svgOptions)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

// --- favicon.ico: 16/32/48/64/128/256 packed multi-resolution ---
const icoSizes = [16, 32, 48, 64, 128, 256];
const pngs = await Promise.all(icoSizes.map(rasterize));
const icoBuf = await pngToIco(pngs);
writeFileSync(resolve(root, 'app/favicon.ico'), icoBuf);
console.log(`wrote app/favicon.ico  (${icoSizes.join(', ')})  ${icoBuf.length} bytes`);

// --- apple-icon.png: Next.js auto-serves at /apple-icon.png ---
const applePng = await rasterize(180);
writeFileSync(resolve(root, 'app/apple-icon.png'), applePng);
console.log(`wrote app/apple-icon.png  (180x180)  ${applePng.length} bytes`);

// --- Electron BrowserWindow icon: served from renderer/public/icon.png ---
mkdirSync(resolve(root, 'public'), { recursive: true });
const winPng = await rasterize(512);
writeFileSync(resolve(root, 'public/icon.png'), winPng);
console.log(`wrote public/icon.png  (512x512)  ${winPng.length} bytes`);
