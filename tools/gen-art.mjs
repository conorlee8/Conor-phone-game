// Generates the painted assets listed in art/assets.json with the OpenAI
// image API. Bases are painted over their blockout guide; items are made on a
// transparent background. Existing files are skipped, so it is safe to re-run.
//
//   OPENAI_API_KEY=... node tools/gen-art.mjs              # everything missing
//   node tools/gen-art.mjs item_bed base_train_car         # just these ids
//   node tools/gen-art.mjs --force item_bed                # redo one
//   IMAGE_MODEL=gpt-image-1 node tools/gen-art.mjs         # pick a model
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename } from 'node:path';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('art/assets.json', root)));
const outDir = new URL('art/raw/', root);
mkdirSync(outDir, { recursive: true });

const key = process.env.OPENAI_API_KEY;
const model = process.env.IMAGE_MODEL || 'gpt-image-1';
const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter(a => !a.startsWith('--'));

if (!key) {
  console.error('OPENAI_API_KEY is not set. Add it to the environment settings, then start a new session.');
  process.exit(1);
}

function promptFor(a) {
  if (a.kind === 'base') return `${manifest.style} ${manifest.view} ${a.prompt}`;
  return `${manifest.style} ${manifest.view} ${manifest.itemRules} Subject: ${a.prompt}`;
}

async function call(url, init) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${key}`, ...init.headers } });
    if (res.ok) return res.json();
    const body = await res.text();
    if (res.status < 500 && res.status !== 429) throw new Error(`${res.status}: ${body.slice(0, 300)}`);
    console.warn(`  retry ${attempt} after ${res.status}`);
    await new Promise(r => setTimeout(r, 4000 * attempt));
  }
  throw new Error('gave up after 3 attempts');
}

async function generate(a) {
  const prompt = promptFor(a);
  if (a.kind === 'base') {
    const form = new FormData();
    const png = readFileSync(new URL(a.guide, root));
    form.append('image', new Blob([png], { type: 'image/png' }), basename(a.guide));
    form.append('model', model);
    form.append('prompt', prompt);
    form.append('size', a.size || '1536x1024');
    form.append('quality', 'high');
    return call('https://api.openai.com/v1/images/edits', { method: 'POST', body: form });
  }
  return call('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, size: a.size || '1024x1024', quality: 'high', background: 'transparent', output_format: 'png' }),
  });
}

const todo = manifest.assets.filter(a => !only.length || only.includes(a.id));
for (const a of todo) {
  const file = new URL(`${a.id}.png`, outDir);
  if (existsSync(file) && !force) { console.log(`skip ${a.id} (exists)`); continue; }
  process.stdout.write(`paint ${a.id} ... `);
  try {
    const json = await generate(a);
    writeFileSync(file, Buffer.from(json.data[0].b64_json, 'base64'));
    console.log('done');
  } catch (e) {
    console.log(`FAILED ${e.message}`);
  }
}
