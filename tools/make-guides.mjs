// Renders the paint-over guide, a debug overlay and the slot map for each
// blocked-out base.  Usage:  python3 -m http.server 8123 &  node tools/make-guides.mjs
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

// Playwright may be installed globally, which ESM imports can't see.
const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = process.env.HAVEN_URL || 'http://localhost:8123';
const OUT = new URL('../art/guides/', import.meta.url);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/tools/blank.html`);
for (const name of ['trainCar']) {
  const res = await page.evaluate(async fn => {
    const mod = await import('/tools/blockout.js');
    const out = {};
    for (const debug of [false, true]) {
      const cv = document.createElement('canvas');
      const { slots, size } = mod[fn](cv, { debug });
      out[debug ? 'debug' : 'guide'] = cv.toDataURL('image/png');
      out.data = { size, slots };
    }
    return out;
  }, name);
  const id = name.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`);
  writeFileSync(new URL(`${id}_guide.png`, OUT), Buffer.from(res.guide.split(',')[1], 'base64'));
  writeFileSync(new URL(`${id}_debug.png`, OUT), Buffer.from(res.debug.split(',')[1], 'base64'));
  writeFileSync(new URL(`${id}_slots.json`, OUT), JSON.stringify(res.data, null, 1));
  console.log(`wrote ${id}: ${res.data.slots.length} slots`);
}
await browser.close();
