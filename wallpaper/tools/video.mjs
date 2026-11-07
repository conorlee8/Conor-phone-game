// Animates part of the station painting with OpenAI's video model.
// The input image must already be the exact video size (e.g. 1280x720).
//
//   NODE_USE_ENV_PROXY=1 node wallpaper/tools/video.mjs <input.png> <out.mp4> <seconds> <model> "<prompt>"
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

const [input, out, seconds = '8', model = 'sora-2', prompt] = process.argv.slice(2);
// VIDEO_API=google uses Gemini's OpenAI-compatible endpoint (the proxy adds the saved key).
const BASE = process.env.VIDEO_API === 'google' ? 'https://generativelanguage.googleapis.com/v1beta/openai' : 'https://api.openai.com/v1';
const key = process.env.VIDEO_API === 'google' ? 'proxy-injected' : process.env.OPENAI_API_KEY;
const H = { Authorization: `Bearer ${key}` };

const size = (() => {           // read PNG width/height from the IHDR chunk
  const b = readFileSync(input);
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
})();

const form = new FormData();
form.append('model', model);
form.append('prompt', prompt);
form.append('size', size);
form.append('seconds', String(seconds));
form.append('input_reference', new Blob([readFileSync(input)], { type: 'image/png' }), basename(input));
let res = await fetch(`${BASE}/videos`, { method: 'POST', headers: H, body: form });
const raw = await res.text();
let job; try { job = JSON.parse(raw); } catch (e) { console.log('FAILED', res.status, raw.slice(0, 400)); process.exit(1); }
if (!res.ok) { console.log('FAILED', JSON.stringify(job).slice(0, 600)); process.exit(1); }
console.log('started', job.id, size, seconds + 's', model);
const t0 = Date.now();
while (job.status !== 'completed' && job.status !== 'failed') {
  await new Promise(r => setTimeout(r, 10000));
  res = await fetch(`${BASE}/videos/${job.id}`, { headers: H });
  const txt = await res.text();
  try { job = JSON.parse(txt); } catch (e) { console.log('  poll', res.status, txt.slice(0, 200)); continue; }
  console.log(`  ${job.status} ${job.progress ?? ''}% (${Math.round((Date.now() - t0) / 1000)}s)`);
}
if (job.status === 'failed') { console.log('FAILED', JSON.stringify(job.error || job).slice(0, 600)); process.exit(1); }
res = await fetch(`${BASE}/videos/${job.id}/content`, { headers: H });
writeFileSync(out, Buffer.from(await res.arrayBuffer()));
console.log('done', out);
