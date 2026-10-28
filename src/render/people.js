import { rr } from '../util.js';

export const LOOKS = [
  { skin: '#f1c9a5', hair: '#3a2a20', shirt: '#6b7b4a', pants: '#3f4a5a', long: true },
  { skin: '#d9a77c', hair: '#1e1a18', shirt: '#b5653a', pants: '#3a3a3a' },
  { skin: '#8a5a3c', hair: '#141210', shirt: '#3f6a8a', pants: '#5a4a3a' },
  { skin: '#f3d2b5', hair: '#a8652a', shirt: '#8a3a4a', pants: '#3f4a5a', long: true },
  { skin: '#c48a60', hair: '#2a1e16', shirt: '#d8c8a0', pants: '#4a5a3a' },
  { skin: '#e8b890', hair: '#6a6a6a', shirt: '#5a5a7a', pants: '#2a2a2a' },
];

const OUT = 'rgba(20,14,10,0.7)';

export function drawSurvivor(c, p, rm, o) {
  const k = p.look;
  if (p.state === 'sleep') {
    c.beginPath();
    c.arc(p.sx, p.sy, 0.1, 0, Math.PI * 2);
    c.fillStyle = k.skin; c.fill();
    c.lineWidth = 0.02; c.strokeStyle = OUT; c.stroke();
    c.beginPath();
    c.arc(p.sx - 0.02, p.sy - 0.02, 0.105, Math.PI * 0.9, Math.PI * 2.1);
    c.fillStyle = k.hair; c.fill();
    c.strokeStyle = '#3a2a20'; c.lineWidth = 0.012;
    c.beginPath(); c.moveTo(p.sx + 0.02, p.sy + 0.01); c.lineTo(p.sx + 0.06, p.sy + 0.01); c.stroke();
    const z = ((o.t || 0) * 0.5 + p.phase) % 1;
    c.globalAlpha = 1 - z;
    c.font = `bold ${0.12 + z * 0.08}px system-ui, sans-serif`;
    c.fillStyle = '#f4ecd8';
    c.fillText('z', p.sx + 0.12 + z * 0.15, p.sy - 0.15 - z * 0.3);
    c.globalAlpha = 1;
    return;
  }
  const x = p.x, y = rm.fy - 0.07;
  const walking = p.state === 'walk';
  const sw = walking ? Math.sin(p.phase * 9) * 0.07 : 0;
  const bob = walking ? Math.abs(Math.sin(p.phase * 9)) * 0.015 : Math.sin((o.t || 0) * 1.5 + p.phase) * 0.004;
  const d = p.dir;
  c.save();
  c.translate(x, y - bob);
  c.scale(d, 1);
  c.lineCap = 'round';
  // legs
  c.strokeStyle = k.pants; c.lineWidth = 0.075;
  c.beginPath(); c.moveTo(-0.04, -0.3); c.lineTo(-0.04 + sw, -0.02); c.stroke();
  c.beginPath(); c.moveTo(0.04, -0.3); c.lineTo(0.04 - sw, -0.02); c.stroke();
  c.fillStyle = '#2a2420';
  c.fillRect(-0.08 + sw, -0.04, 0.1, 0.04);
  c.fillRect(0 - sw, -0.04, 0.1, 0.04);
  // torso
  c.beginPath(); rr(c, -0.1, -0.6, 0.2, 0.32, 0.06);
  c.fillStyle = k.shirt; c.fill();
  c.lineWidth = 0.02; c.strokeStyle = OUT; c.stroke();
  // arm
  c.strokeStyle = k.shirt; c.lineWidth = 0.06;
  if (p.state === 'guard') {
    c.beginPath(); c.moveTo(0.02, -0.52); c.lineTo(0.16, -0.46); c.stroke();
    c.fillStyle = '#2a2a2a'; c.fillRect(0.0, -0.5, 0.42, 0.045);
    c.fillStyle = '#6b4528'; c.fillRect(-0.06, -0.49, 0.12, 0.06);
  } else {
    c.beginPath(); c.moveTo(0, -0.55); c.lineTo(-sw * 0.8 + 0.02, -0.32); c.stroke();
  }
  // head
  c.beginPath(); c.arc(0.01, -0.72, 0.11, 0, Math.PI * 2);
  c.fillStyle = k.skin; c.fill();
  c.lineWidth = 0.02; c.strokeStyle = OUT; c.stroke();
  c.beginPath(); c.arc(-0.01, -0.75, 0.115, Math.PI * 0.95, Math.PI * 2.05);
  c.fillStyle = k.hair; c.fill();
  if (k.long) {
    c.beginPath(); c.ellipse(-0.1, -0.68, 0.05, 0.1, 0.3, 0, Math.PI * 2); c.fill();
  }
  c.fillStyle = '#2a1e16';
  c.beginPath(); c.arc(0.07, -0.72, 0.012, 0, Math.PI * 2); c.fill();
  c.restore();
}
