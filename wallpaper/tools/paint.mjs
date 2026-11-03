// Paints the images listed in a wallpaper manifest with the OpenAI image API.
// Prompts are built from named text blocks so style tests can share one scene.
// Assets with `images` (reference photos, a layout guide, an earlier painting)
// go through the edits endpoint. Runs up to 4 at once; skips existing files.
//
//   NODE_USE_ENV_PROXY=1 node wallpaper/tools/paint.mjs wallpaper/style-tests.json
//   NODE_USE_ENV_PROXY=1 node wallpaper/tools/paint.mjs wallpaper/style-tests.json --force style_blend
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const manifestPath = resolve(args.find(a => a.endsWith('.json')));
const force = args.includes('--force');
const only = args.filter(a => !a.startsWith('--') && !a.endsWith('.json'));
const manifest = JSON.parse(readFileSync(manifestPath));
const base = dirname(manifestPath);
const outDir = resolve(base, manifest.out || 'raw');
mkdirSync(outDir, { recursive: true });

const key = process.env.OPENAI_API_KEY;
if (!key) { console.error('OPENAI_API_KEY is not set.'); process.exit(1); }

const promptFor = a => (a.parts ? a.parts.map(k => manifest.text[k]) : [a.prompt]).filter(Boolean).join(' ');

async function call(url, init) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${key}`, ...init.headers } });
    if (res.ok) return res.json();
    const body = await res.text();
    const fatal = /insufficient_quota|credit_balance|billing|verif|must be verified/i.test(body);
    if (fatal || (res.status < 500 && res.status !== 429)) throw new Error(`${res.status}: ${body.slice(0, 400)}`);
    console.warn(`  ${'retry'} ${attempt} after ${res.status}`);
    await new Promise(r => setTimeout(r, 5000 * attempt));
  }
  throw new Error('gave up after 3 attempts');
}

async function paint(a) {
  const prompt = promptFor(a);
  const model = a.model || manifest.model || 'gpt-image-2';
  const size = a.size || manifest.size || '1536x1024';
  const quality = a.quality || manifest.quality || 'high';
  if (a.images?.length) {
    const form = new FormData();
    for (const p of a.images) {
      const buf = readFileSync(resolve(base, p));
      const type = p.endsWith('.png') ? 'image/png' : p.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
      form.append('image[]', new Blob([buf], { type }), basename(p));
    }
    form.append('model', model); form.append('prompt', prompt);
    form.append('size', size); form.append('quality', quality);
    return call('https://api.openai.com/v1/images/edits', { method: 'POST', body: form });
  }
  return call('https://api.openai.com/v1/images/generations', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, size, quality }),
  });
}

const todo = manifest.assets.filter(a => !only.length || only.includes(a.id));
const queue = [...todo];
async function worker() {
  for (let a; (a = queue.shift());) {
    const file = resolve(outDir, `${a.id}.png`);
    if (existsSync(file) && !force) { console.log(`skip ${a.id}`); continue; }
    const t = Date.now();
    try {
      const json = await paint(a);
      writeFileSync(file, Buffer.from(json.data[0].b64_json, 'base64'));
      console.log(`done ${a.id} (${Math.round((Date.now() - t) / 1000)}s)`);
    } catch (e) { console.log(`FAILED ${a.id}: ${e.message}`); }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
