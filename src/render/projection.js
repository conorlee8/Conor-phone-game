// Perspective camera for the ¾ top-down cutaway view. Shared by the blockout
// tool (which makes the paint-over guides) and the game (which places
// furniture sprites onto the painted bases), so both agree on every pixel.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };

// World: x along the base's length, y up, z toward the viewer.
export function makeCamera({ eye, target, W, H, fit, margin = 0.06 }) {
  const f = norm(sub(target, eye));
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const raw = p => {
    const d = sub(p, eye);
    const zc = dot(d, f);
    return [dot(d, r) / zc, -dot(d, u) / zc, zc];
  };
  // Scale and centre so the `fit` points fill the frame.
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of fit) {
    const [x, y] = raw(p);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const s = Math.min((W * (1 - 2 * margin)) / (x1 - x0), (H * (1 - 2 * margin)) / (y1 - y0));
  const ox = W / 2 - ((x0 + x1) / 2) * s;
  const oy = H / 2 - ((y0 + y1) / 2) * s;
  const project = p => {
    const [x, y, z] = raw(p);
    return [ox + x * s, oy + y * s, z];
  };
  return { project, scale: s };
}
