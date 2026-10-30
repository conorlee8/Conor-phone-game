// Draws a grey placeholder for every catalog piece at its exact in-game
// proportions and camera angle (front-on, slightly from above). The image
// model paints over these, so every piece comes back the right shape to
// sit in its slot.  Usage:  python3 -m http.server 8123 &  node tools/make-templates.mjs
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.HAVEN_URL || 'http://localhost:8123';
const out = new URL('../art/templates/', import.meta.url);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/tools/blank.html`);
const files = await page.evaluate(async () => {
  const { CATALOG } = await import('/src/builder/catalog.js');
  const res = {};
  for (const d of CATALOG) {
    const S = 1024;
    const cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    const c = cv.getContext('2d');
    const wall = d.mounts[0] === 'wall', ceil = d.mounts[0] === 'ceiling';
    const depth = wall ? 0.12 : ceil ? 0.1 : Math.min(0.45, d.w * 0.22);
    const k = Math.min((S * 0.82) / d.w, (S * 0.82) / (d.h + depth));
    const w = d.w * k, h = d.h * k, dp = depth * k;
    const x = (S - w) / 2, y = S - S * 0.06 - h; // pieces stand on a common baseline
    // top face, seen from slightly above
    c.fillStyle = '#c4c4c4';
    c.beginPath();
    c.moveTo(x, y); c.lineTo(x + w, y); c.lineTo(x + w - w * 0.04, y - dp); c.lineTo(x + w * 0.04, y - dp); c.closePath();
    c.fill();
    // front face
    c.fillStyle = '#9c9c9c';
    c.fillRect(x, y, w, h);
    c.strokeStyle = '#555'; c.lineWidth = 6;
    c.strokeRect(x, y, w, h);
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + w * 0.04, y - dp); c.lineTo(x + w - w * 0.04, y - dp); c.lineTo(x + w, y); c.stroke();
    res[d.id] = cv.toDataURL('image/png');
  }
  return res;
});
for (const [id, data] of Object.entries(files)) writeFileSync(new URL(`${id}.png`, out), Buffer.from(data.split(',')[1], 'base64'));
console.log(`${Object.keys(files).length} templates`);
await browser.close();
