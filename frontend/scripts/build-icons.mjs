// Renders the logo SVGs and PNG app icons into frontend/public.
//
// The logo is three rounded bars in the vote colors (free, possible, impossible), like the vote bar
// of a module. Dev instances get a blue background so installed apps and tabs are never confused.
//
// Run from the repo root with a Chromium that playwright-core can launch, e.g.:
//   CHROMIUM_PATH=/path/to/chrome node frontend/scripts/build-icons.mjs
// playwright-core is not a project dependency; install it temporarily (npm i --no-save playwright-core).
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), "../public");

// x, y, height in a 32x32 box; every bar is 7 wide with rounded ends.
const BARS = [
  { color: "#15803d", x: 2.5, y: 5, height: 22 },
  { color: "#e0a100", x: 12.5, y: 12, height: 15 },
  { color: "#dc2626", x: 22.5, y: 18, height: 9 },
];

const VARIANTS = {
  production: { background: "#eef0f3", suffix: "", icons: "icons" },
  dev: { background: "#1e3a8a", suffix: "-dev", icons: "icons/dev" },
};

/**
 * Builds an SVG of the logo.
 * @param {{size: number, background?: string, radius?: number, scale?: number}} options
 *   background: omit for a transparent logo; radius: corner radius of the background in the 32 box;
 *   scale: size of the bars around the center of the box (1 = the bars fill 84%)
 */
function logoSvg({ size, background, radius = 0, scale = 1 }) {
  const bars = BARS.map(
    ({ color, x, y, height }) => `<rect x="${x}" y="${y}" width="7" height="${height}" rx="3" fill="${color}"/>`,
  ).join("");
  const backdrop = background ? `<rect width="32" height="32" rx="${radius}" fill="${background}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">${backdrop}<g transform="translate(16 16) scale(${scale}) translate(-16 -16)">${bars}</g></svg>`;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage();

/** Renders an SVG string to a PNG file; transparent corners stay transparent. */
async function writePng(svg, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0;background:transparent">${svg}</body>`);
  await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

for (const { background, suffix, icons } of Object.values(VARIANTS)) {
  mkdirSync(resolve(publicDir, icons), { recursive: true });
  // The tab icon: production is transparent bars, dev sits on the blue tile.
  writeFileSync(
    resolve(publicDir, `favicon${suffix}.svg`),
    logoSvg({ size: 32, background: suffix ? background : undefined, radius: 7, scale: suffix ? 0.8 : 1.1 }),
  );
  // "any" icons keep rounded corners; maskable ones are full-bleed with the bars inside the safe zone.
  await writePng(logoSvg({ size: 192, background, radius: 7 }), 192, resolve(publicDir, icons, "icon-192.png"));
  await writePng(logoSvg({ size: 512, background, radius: 7 }), 512, resolve(publicDir, icons, "icon-512.png"));
  await writePng(logoSvg({ size: 512, background, scale: 0.7 }), 512, resolve(publicDir, icons, "icon-maskable-512.png"));
  // iOS rounds the corners itself and fills transparency with black, so this one is full-bleed.
  await writePng(logoSvg({ size: 180, background, scale: 0.9 }), 180, resolve(publicDir, `apple-touch-icon${suffix}.png`));
}

await browser.close();
console.log("icons written to", publicDir);
