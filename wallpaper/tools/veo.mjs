// Animates station tiles with Google's Veo model through the Gemini API.
// Needs GEMINI_API_KEY in the environment (environment settings, not chat).
//
//   NODE_USE_ENV_PROXY=1 node wallpaper/tools/veo.mjs models                 # list the Veo models this key can use
//   NODE_USE_ENV_PROXY=1 node wallpaper/tools/veo.mjs one <tile.png> <out.mp4> [model]
//   NODE_USE_ENV_PROXY=1 node wallpaper/tools/veo.mjs all [model]            # every tile in wallpaper/video/tiles without an .mp4
//
// Not yet run against the live API: check `models` first and adjust the model
// name, and read one operation's response if the video URI isn't where this expects.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const KEY = process.env.GEMINI_API_KEY;
const API = 'https://generativelanguage.googleapis.com/v1beta';
if (!KEY) { console.log('GEMINI_API_KEY is not set. Add it in the environment settings and start a new session.'); process.exit(1); }
const H = { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' };

export const PROMPT = [
  'Animate this painting into a living, cozy scene. The camera is completely locked: no zoom, no pan, no shake, no camera movement at all.',
  'Every wall, room edge, floor, pipe, sign, poster and piece of furniture stays exactly where it is; the image only comes alive.',
  'The people and animals move naturally inside their own rooms, all the time: people at tables eat, drink and chat; cooks cook;',
  'people play basketball, arcade games, video games and skate; people work, fixing things, watering plants, stocking shelves and mopping;',
  'pod doors slide open and closed as people come and go; the glass elevator carries people up and down; dogs and cats wander, sniff and nap;',
  'lights and screens flicker gently. Nobody walks through walls. Keep exactly the same hand-painted lofi anime style, ink linework,',
  'colours and warm lighting in every frame. No new text, no captions, no music.',
].join(' ');

async function call(url, init = {}) {
  for (let i = 1; i <= 3; i++) {
    const res = await fetch(url, { ...init, headers: { ...H, ...(init.headers || {}) } });
    const txt = await res.text();
    if (res.ok) return txt ? JSON.parse(txt) : {};
    if (res.status < 500 && res.status !== 429) throw new Error(`${res.status}: ${txt.slice(0, 500)}`);
    await new Promise(r => setTimeout(r, 8000 * i));
  }
  throw new Error('gave up after 3 attempts');
}

async function models() {
  const j = await call(`${API}/models?pageSize=200`);
  return (j.models || []).filter(m => /veo/i.test(m.name)).map(m => m.name.replace('models/', ''));
}

async function animate(png, out, model) {
  const body = {
    instances: [{ prompt: PROMPT, image: { bytesBase64Encoded: readFileSync(png).toString('base64'), mimeType: 'image/png' } }],
    parameters: { aspectRatio: '16:9', personGeneration: 'allow_adult' },
  };
  let op = await call(`${API}/models/${model}:predictLongRunning`, { method: 'POST', body: JSON.stringify(body) });
  const t0 = Date.now();
  while (!op.done) {
    await new Promise(r => setTimeout(r, 10000));
    op = await call(`${API}/${op.name}`);
    process.stdout.write(`  ${Math.round((Date.now() - t0) / 1000)}s\r`);
  }
  if (op.error) throw new Error(JSON.stringify(op.error).slice(0, 500));
  const r = op.response || {};
  const sample = (r.generateVideoResponse?.generatedSamples || r.generatedVideos || r.videos || [])[0];
  const uri = sample?.video?.uri || sample?.uri;
  const b64 = sample?.video?.bytesBase64Encoded || sample?.bytesBase64Encoded;
  if (b64) writeFileSync(out, Buffer.from(b64, 'base64'));
  else if (uri) {
    const res = await fetch(uri, { headers: { 'x-goog-api-key': KEY } });
    writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  } else throw new Error('no video in the response: ' + JSON.stringify(r).slice(0, 500));
  console.log(`done ${out} (${Math.round((Date.now() - t0) / 1000)}s)`);
}

const [cmd, a, b, c] = process.argv.slice(2);
const pickModel = async m => m || (await models()).sort().reverse().find(x => /fast/.test(x)) || (await models())[0];
if (cmd === 'models') console.log((await models()).join('\n') || 'no Veo models for this key');
else if (cmd === 'one') await animate(a, b, await pickModel(c));
else if (cmd === 'all') {
  const model = await pickModel(a);
  const meta = JSON.parse(readFileSync(new URL('../video/tiles/tiles.json', import.meta.url)));
  const todo = meta.tiles.filter(t => !existsSync(new URL(`../video/tiles/${t.id}.mp4`, import.meta.url)));
  console.log(`${todo.length} tiles with ${model}`);
  const queue = [...todo];
  await Promise.all([0, 1].map(async () => {
    for (let t; (t = queue.shift());) {
      const png = new URL(`../video/tiles/${t.id}.png`, import.meta.url).pathname;
      try { await animate(png, png.replace('.png', '.mp4'), model); } catch (e) { console.log(`FAILED ${t.id}: ${e.message}`); }
    }
  }));
} else console.log('usage: models | one <tile.png> <out.mp4> [model] | all [model]');
