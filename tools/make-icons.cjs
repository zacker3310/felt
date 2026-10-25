#!/usr/bin/env node
/* make-icons: renders the felt app icon and writes every size the web app needs.
   The art is an action shot: the break, the instant the cue ball smashes into the rack, seen
   from just above the foot rail, with the balls coming at the viewer. It is drawn in headless
   Chromium: a small deterministic ray tracer (lit, glossy spheres with a specular lamp
   reflection, soft area-light shadows, contact occlusion, true motion blur, red cloth with a
   light falloff, dark wood rails, a corner pocket) writes the pixels into a 2D canvas, then the
   canvas API adds the graphic layer (impact flash, speed lines, chalk dust, vignette) and does
   the downscaling. Ball numbers are drawn as stroked paths, not text, so no font is involved
   and the output is the same on every machine with the same Chromium.

   Usage: node tools/make-icons.cjs                  writes icons/ from the chosen scene
          node tools/make-icons.cjs --scene B --out DIR [--size 1024] [--spp 4]
                                                     renders one scene to DIR (candidates)
   npm run icons runs the first form. */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const CHOSEN = 'A';

/* ---------- scenes: everything in metres, table plane z = 0, z up ---------- */
/* Table: playing surface x in [0, LX], y in [0, LY]. The foot rail is x = LX; the rack sits on
   the foot spot (LX * 3/4, LY / 2) with the apex toward the head. */
const LX = 2.54, LY = 1.27, R = 0.028575;
const D = 2 * R;

/* positions of the 15-ball rack, apex at the foot spot, rows going toward the foot rail */
function rackSpot(row, k) {
  const x = LX * 0.75 + row * D * Math.sqrt(3) / 2;
  const y = LY / 2 + (k - row / 2) * D;
  return [x, y];
}

/* A scene is built around the cue ball at Q, shot direction +x. Ball entries:
   n, p (offset from Q, metres, z is the lift off the cloth), v (displacement over the shutter),
   f (number facing: [right, up] tilt away from the camera, roll of the number). */
function scene(o) {
  const Q = o.Q;
  const at = p => [Q[0] + p[0], Q[1] + p[1], R + (p[2] || 0)];
  return {
    cam: { pos: [Q[0] + o.cam[0], Q[1] + o.cam[1], o.cam[2]], look: [Q[0] + o.look[0], Q[1] + o.look[1], o.look[2]], fov: o.fov, up: o.up },
    lamp: { c: [Q[0] + o.lamp[0], Q[1] + o.lamp[1], o.lamp[2]], s: o.lampSize || [0.7, 0.45], ambient: o.ambient || 0.1 },
    exposure: o.exposure || 1,
    cloth: o.cloth,
    balls: o.balls.map(b => ({ n: b.n, p: at(b.p), v: b.v || [0, 0, 0], f: b.f || [0, 0, 0] })),
    cue: { tip: at([-R - (o.tipGap || 0), 0, o.tipZ || 0]), dir: o.cueDir || [-1, 0, 0.1], v: o.cueV || 0 },
    fx: o.fx || [],
  };
}
const SCENES = {
  /* A: low and close behind the shot. The tip has just struck the cue ball; ahead, the rack
     bursts apart and balls fly back toward the camera. */
  A: scene({
    Q: [LX - 1.05, LY / 2 + 0.02],
    cam: [-0.21, -0.15, 0.19], look: [0.21, 0.0, -0.03], fov: 50,
    lamp: [0.24, -0.04, 0.85],
    balls: [
      { n: 0, p: [0, 0], v: [0.004, 0, 0] },
      { n: 8, p: [0.06, -0.16, 0.028], v: [-0.0015, -0.001, 0.0005], f: [0.05, -0.12, 0.1] },
      { n: 9, p: [0.20, -0.095, 0.008], v: [-0.004, -0.003, 0], f: [0, 0.15, -0.1] },
      { n: 1, p: [0.29, 0.0], v: [0.006, 0, 0], f: [0, 0.2, 0] },
      { n: 2, p: [0.335, 0.07], v: [0.004, 0.005, 0], f: [0, 0.2, 0.1] },
      { n: 3, p: [0.345, -0.05], v: [0.004, -0.004, 0], f: [0, 0.2, -0.1] },
      { n: 10, p: [0.41, 0.012, 0.022], v: [0.004, 0, 0.003], f: [0, 0.2, 0] },
      { n: 11, p: [0.23, 0.12, 0.008], v: [-0.006, 0.006, 0], f: [0, 0.2, 0.15] },
    ],
    tipGap: 0.0, cueDir: [-1, 0, 0.12],
    fx: [
      { type: 'lines', ball: 1, n: 4, len: 0.07, alpha: 0.5 },
      { type: 'lines', ball: 7, n: 3, len: 0.05, alpha: 0.45 },
      { type: 'flash', at: 'tip', r: 0.04, spikes: 6, spike: 0.75 },
      { type: 'dust', n: 40, r: 0.02, drift: 0.02 },
    ],
  }),
  /* B: nearly overhead, the table turned 45 degrees so the corner pocket sits at the top and
     the rails run down from it. The cue comes up from the bottom; the rack bursts open. */
  B: scene({
    Q: [LX - 0.30, 0.24],
    cam: [-0.04, 0.04, 0.56], look: [0.115, -0.115, 0], fov: 50, up: [1, -1, 0],
    lamp: [0.14, -0.14, 0.8],
    balls: [
      { n: 0, p: [0, 0] },
      { n: 1, p: [0.16, -0.155], f: [0, 0, 0] },
      { n: 2, p: [0.235, -0.125], f: [0, 0, 0] },
      { n: 3, p: [0.135, -0.245], f: [0, 0, 0] },
      { n: 9, p: [0.275, -0.165], f: [0, 0, 0] },
      { n: 10, p: [0.05, -0.215, 0.06], v: [-0.003, -0.003, 0.003], f: [0, 0, 0] },
      { n: 11, p: [0.235, -0.02, 0.06], v: [0.003, 0.003, 0.003], f: [0, 0, 0] },
      { n: 8, p: [0.205, -0.215], f: [0, 0, 0] },
    ],
    tipGap: 0.0, cueDir: [-1, 0.35, 0.06],
    fx: [
      { type: 'lines', ball: 5, n: 3, len: 0.05, alpha: 0.5 },
      { type: 'lines', ball: 6, n: 3, len: 0.05, alpha: 0.5 },
      { type: 'flash', at: 'tip', r: 0.03, spikes: 8, spike: 0.9 },
      { type: 'dust', n: 30, r: 0.015, drift: 0.01 },
    ],
  }),
  /* C: from above the foot corner pocket, looking back up the table: the rack bursts toward the
     camera, the cue ball and the cue beyond it. */
  C: scene({
    Q: [LX * 0.75 - 0.30, LY / 2 + 0.02],
    cam: [0.78, -0.42, 0.30], look: [0.10, 0.0, -0.03], fov: 40,
    lamp: [0.3, -0.05, 0.85],
    balls: [
      { n: 0, p: [0, 0], v: [0.004, 0, 0] },
      { n: 1, p: [0.11, 0.035], v: [0.004, 0, 0] },
      { n: 2, p: [0.20, 0.06], v: [0.004, 0.004, 0] },
      { n: 10, p: [0.21, -0.06, 0.02], v: [0.004, -0.004, 0.002] },
      { n: 3, p: [0.30, -0.13], v: [0.006, -0.006, 0] },
      { n: 11, p: [0.33, 0.04, 0.015], v: [0.006, 0.002, 0.002] },
      { n: 9, p: [0.42, -0.10, 0.02], v: [0.006, -0.004, 0.002] },
      { n: 8, p: [0.50, -0.235, 0.035], v: [0.002, -0.0015, 0.001] },
    ],
    tipGap: 0.0, cueDir: [-1, 0, 0.12],
    fx: [
      { type: 'lines', ball: 7, n: 4, len: 0.07, alpha: 0.5 },
      { type: 'lines', ball: 6, n: 3, len: 0.05, alpha: 0.45 },
      { type: 'flash', at: 'tip', r: 0.04, spikes: 8, spike: 0.9 },
    ],
  }),
};

/* ---------- the browser side: the renderer ---------- */
function renderArt(cfg) {
  const S = cfg.size, SPP = cfg.spp, sc = cfg.scene, zoom = cfg.zoom || 1;
  const LX = cfg.LX, LY = cfg.LY, R = cfg.R;

  /* deterministic random */
  let seed = 0x9e3779b9;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const hash = (x, y) => { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
  const vnoise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };

  /* vectors */
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const srgb2lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lin2srgb = c => c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  const col = hex => [srgb2lin(parseInt(hex.slice(1, 3), 16)), srgb2lin(parseInt(hex.slice(3, 5), 16)), srgb2lin(parseInt(hex.slice(5, 7), 16))];

  /* ---- camera ---- */
  const cam = sc.cam, C = cam.pos, F = norm(sub(cam.look, C));
  const RT = norm(cross(F, cam.up || [0, 0, 1])), UP = cross(RT, F);
  const TAN = Math.tan(cam.fov * Math.PI / 360) * zoom;
  const project = p => { const w = sub(p, C), z = dot(w, F); return { x: (dot(w, RT) / (z * TAN) + 1) * S / 2, y: (1 - dot(w, UP) / (z * TAN)) * S / 2, z, k: S / 2 / (z * TAN) }; };

  /* ---- materials ---- */
  const CLOTH = col(sc.cloth || '#a8242a');
  const WOOD = col('#4a2414'), WOOD2 = col('#2a120a');
  const LEATHER = col('#141012');
  const IVORY = col('#f7f4ea');
  const BALLC = { 0: '#f7f4ea', 1: '#f6ba1c', 2: '#1f4fbf', 3: '#d9281c', 8: '#151517', 9: '#f6ba1c', 10: '#1f4fbf', 11: '#d9281c',
    4: '#5c2e92', 5: '#f2701a', 6: '#167842', 7: '#7a1e20', 12: '#5c2e92', 13: '#f2701a', 14: '#167842', 15: '#7a1e20' };

  /* ---- static geometry: convex solids as plane lists, holes cut through them ---- */
  const solids = [];
  /* edge frames: local x along the edge, local -y outward */
  const frames = [
    { Le: LX, M: (x, y) => [x, y], N: (nx, ny) => [nx, ny] },
    { Le: LY, M: (x, y) => [LX - y, x], N: (nx, ny) => [-ny, nx] },
    { Le: LX, M: (x, y) => [LX - x, LY - y], N: (nx, ny) => [-nx, -ny] },
    { Le: LY, M: (x, y) => [y, LY - x], N: (nx, ny) => [ny, -nx] },
  ];
  const planeL = (fr, n, d) => { /* local plane n.p <= d to global */
    const g = fr.N(n[0], n[1]), T = fr.M(0, 0), nn = [g[0], g[1], n[2]];
    return { n: nn, d: d + nn[0] * T[0] + nn[1] * T[1] };
  };
  const nP = (n, p) => { const u = norm(n); return [u, dot(u, p)]; };
  const CUSH_TOP = 0.040, RAIL_TOP = 0.046, RAIL_IN = -0.05, RAIL_OUT = -0.17;
  const AC = 0.082, AS = 0.062;
  function cushion(fr, ei, a, b, endA, endB) {
    const P = [];
    const push = (n, p) => { const [u, d] = nP(n, p); P.push(planeL(fr, u, d)); };
    push([0, 0, 1], [0, 0, CUSH_TOP]);
    push([0, 0, -1], [0, 0, 0]);
    push([0, 1, 0], [0, 0, 0]);
    push([0, -1, 0], [0, RAIL_IN, 0]);
    push([0, 0.010, 0.012], [0, 0, 0.030]);
    /* jaws: the face runs from the nose point back toward the pocket */
    const ja = endA === 'c' ? 0.030 : 0.012, jb = endB === 'c' ? 0.030 : 0.012;
    push([-0.05, ja, 0], [a, 0, 0]);
    push([0.05, jb, 0], [b, 0, 0]);
    solids.push({ planes: P, mat: 'cushion', top: CUSH_TOP, edge: ei });
  }
  function rail(fr, ei) {
    const P = [];
    const push = (n, p) => { const [u, d] = nP(n, p); P.push(planeL(fr, u, d)); };
    push([0, 0, 1], [0, 0, RAIL_TOP]);
    push([0, 0, -1], [0, 0, -0.12]);
    push([0, 1, 0], [0, RAIL_IN, 0]);
    push([0, -1, 0], [0, RAIL_OUT, 0]);
    push([-1, 0, 0], [-0.17, 0, 0]);
    push([1, 0, 0], [fr.Le + 0.17, 0, 0]);
    push([0, -0.021, 0.03], [0, RAIL_OUT, 0.025]);
    push([0, 1, 1], [0, RAIL_IN, 0.040]);
    solids.push({ planes: P, mat: 'rail', top: RAIL_TOP, edge: ei });
  }
  frames.forEach((fr, ei) => {
    const long = fr.Le > 2;
    if (long) { cushion(fr, ei, AC, fr.Le / 2 - AS, 'c', 's'); cushion(fr, ei, fr.Le / 2 + AS, fr.Le - AC, 's', 'c'); }
    else cushion(fr, ei, AC, fr.Le - AC, 'c', 'c');
    rail(fr, ei);
  });
  /* the slate bed */
  solids.push({ planes: [
    { n: [0, 0, 1], d: 0 }, { n: [0, 0, -1], d: 0.05 },
    { n: [1, 0, 0], d: LX + 0.06 }, { n: [-1, 0, 0], d: 0.06 }, { n: [0, 1, 0], d: LY + 0.06 }, { n: [0, -1, 0], d: 0.06 },
  ], mat: 'cloth', top: 0 });
  /* pockets */
  const holes = [];
  const HC = 0.064, HS = 0.058, HO = 0.03, HSO = 0.052, HBOT = -0.16;
  for (const [x, y, sx, sy] of [[0, 0, -1, -1], [LX, 0, 1, -1], [0, LY, -1, 1], [LX, LY, 1, 1]]) holes.push({ c: [x + sx * HO, y + sy * HO], r: HC });
  holes.push({ c: [LX / 2, -HSO], r: HS }, { c: [LX / 2, LY + HSO], r: HS });
  /* diamonds on the rail tops */
  const diamonds = [];
  frames.forEach((fr, ei) => {
    const n = fr.Le > 2 ? 8 : 4;
    for (let k = 1; k < n; k++) { if (n === 8 && k === 4) continue; const g = fr.M(k * fr.Le / n, (RAIL_IN + RAIL_OUT) / 2 - 0.005); diamonds.push({ c: g, e: ei }); }
  });
  /* the lamp: a rectangle facing down */
  const L = sc.lamp, LC = L.c, LS = L.s;
  const LAREA = LS[0] * LS[1];
  /* normalise so the open cloth right under the lamp gets irradiance 1 */
  let I0 = 0;
  for (let i = 0; i < 64; i++) for (let j = 0; j < 64; j++) {
    const q = [LC[0] + ((i + 0.5) / 64 - 0.5) * LS[0], LC[1] + ((j + 0.5) / 64 - 0.5) * LS[1], LC[2]];
    const l = sub(q, [LC[0], LC[1], 0]), d2 = dot(l, l), lz = l[2] / Math.sqrt(d2);
    I0 += lz * lz / d2;
  }
  I0 *= LAREA / 4096;
  const LK = 1 / I0;

  /* ---- balls ---- */
  const balls = sc.balls.map(b => {
    const toCam = norm(sub(C, b.p));
    const N = norm(add(toCam, add(mul(RT, b.f[0]), mul(UP, b.f[1]))));
    let A0 = norm(sub(UP, mul(N, dot(UP, N))));
    const E0 = cross(A0, N), ca = Math.cos(b.f[2] || 0), sa = Math.sin(b.f[2] || 0);
    const A = norm(add(mul(A0, ca), mul(E0, sa)));
    const E1 = cross(A, N);
    return { n: b.n, p: b.p, v: b.v, N, A, E1, col: col(BALLC[b.n]), stripe: b.n > 8, r: b.r || R };
  });
  const ballAt = (b, t) => [b.p[0] + b.v[0] * (t - 0.5), b.p[1] + b.v[1] * (t - 0.5), b.p[2] + b.v[2] * (t - 0.5)];

  /* ---- the cue: a tapered cylinder from the tip back ---- */
  const cue = sc.cue ? (() => {
    const a = norm(sc.cue.dir);
    return { tip: sc.cue.tip, a, L: 1.5, r0: 0.0064, r1: 0.0140, v: sc.cue.v || 0 };
  })() : null;
  if (cue) cue.k = (cue.r1 - cue.r0) / cue.L;

  /* ---- digits: stroked paths into a mask, sampled on the ball ---- */
  const DIG = 160;
  const digitMask = {};
  function drawDigit(g, ch, x, w) {
    /* a heavy rounded numeral in a box x..x+w wide, 0..140 tall (y down) */
    const s = w / 70;
    g.save(); g.translate(x, 0); g.scale(s, 1);
    g.beginPath();
    if (ch === '1') { g.moveTo(22, 34); g.lineTo(40, 18); g.lineTo(40, 122); }
    else if (ch === '0') { g.ellipse(35, 70, 22, 52, 0, 0, Math.PI * 2); }
    else if (ch === '2') { g.moveTo(14, 42); g.bezierCurveTo(14, 4, 58, 4, 58, 40); g.bezierCurveTo(58, 62, 40, 76, 14, 122); g.lineTo(60, 122); }
    else if (ch === '3') { g.moveTo(13, 34); g.bezierCurveTo(16, 8, 58, 6, 57, 36); g.bezierCurveTo(56, 58, 40, 64, 30, 64); g.bezierCurveTo(44, 64, 60, 72, 59, 94); g.bezierCurveTo(58, 132, 12, 132, 11, 102); }
    else if (ch === '8') { g.ellipse(35, 40, 20, 24, 0, 0, Math.PI * 2); g.moveTo(59, 96); g.ellipse(35, 96, 24, 28, 0, 0, Math.PI * 2); }
    else if (ch === '9') { g.ellipse(35, 46, 22, 28, 0, 0, Math.PI * 2); g.moveTo(57, 46); g.bezierCurveTo(57, 92, 46, 118, 16, 122); }
    g.restore();
    g.lineWidth = 25 * Math.min(1, s * 1.2); g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke();
  }
  function mask(n) {
    if (digitMask[n]) return digitMask[n];
    const c = document.createElement('canvas'); c.width = c.height = DIG;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, DIG, DIG);
    g.strokeStyle = '#fff';
    const s = String(n);
    g.save();
    g.translate(DIG / 2, DIG / 2); g.scale(DIG / 200, DIG / 200); g.translate(0, -70);
    if (s.length === 1) drawDigit(g, s, -35, 70);
    else { drawDigit(g, s[0], -66, 58); drawDigit(g, s[1], 2, 58); }
    g.restore();
    const d = g.getImageData(0, 0, DIG, DIG).data, m = new Float32Array(DIG * DIG);
    for (let i = 0; i < m.length; i++) m[i] = d[i * 4] / 255;
    return (digitMask[n] = m);
  }
  const sampleMask = (m, u, v) => {
    const x = (u + 1) / 2 * (DIG - 1), y = (1 - v) / 2 * (DIG - 1);
    if (x < 0 || y < 0 || x >= DIG - 1 || y >= DIG - 1) return 0;
    const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi, i = yi * DIG + xi;
    return (m[i] * (1 - fx) + m[i + 1] * fx) * (1 - fy) + (m[i + DIG] * (1 - fx) + m[i + DIG + 1] * fx) * fy;
  };
  for (const b of balls) if (b.n > 0) b.mask = mask(b.n);
  const NUM_CA = Math.cos(28 * Math.PI / 180), NUM_T = Math.tan(28 * Math.PI / 180), BAND = 0.55;

  /* ---- intersection ---- */
  const EPS = 1e-6;
  function hitConvex(o, d, P, tmin) {
    let t0 = -1e30, t1 = 1e30, n0 = null;
    for (let i = 0; i < P.length; i++) {
      const n = P[i].n, den = n[0] * d[0] + n[1] * d[1] + n[2] * d[2], dist = P[i].d - (n[0] * o[0] + n[1] * o[1] + n[2] * o[2]);
      if (Math.abs(den) < 1e-12) { if (dist < 0) return null; continue; }
      const t = dist / den;
      if (den < 0) { if (t > t0) { t0 = t; n0 = n; } } else if (t < t1) t1 = t;
      if (t0 > t1) return null;
    }
    if (t0 <= tmin || t0 > t1 || !n0) return null;
    return { t: t0, n: n0 };
  }
  const holeAt = (x, y) => { for (const h of holes) { const dx = x - h.c[0], dy = y - h.c[1]; if (dx * dx + dy * dy < h.r * h.r) return h; } return null; };
  function topAt(x, y) {
    let z = -1;
    for (const s of solids) {
      if (s.top <= z) continue;
      let inside = true;
      for (const p of s.planes) if (p.n[0] * x + p.n[1] * y + p.n[2] * (s.top - 0.004) > p.d + 1e-7) { inside = false; break; }
      if (inside) z = s.top;
    }
    return z;
  }
  function hitStatic(o, d, tmin) {
    for (let iter = 0; iter < 4; iter++) {
      let best = null;
      for (const s of solids) {
        const h = hitConvex(o, d, s.planes, tmin);
        if (h && (!best || h.t < best.t)) { best = h; best.s = s; }
      }
      const p = best ? add(o, mul(d, best.t)) : null;
      const h = p ? holeAt(p[0], p[1]) : null;
      if (best && !h) { best.p = p; best.mat = best.s.mat; return best; }
      if (!best) {
        /* the floor */
        if (d[2] < 0) { const t = (-0.75 - o[2]) / d[2]; if (t > tmin) return { t, p: add(o, mul(d, t)), n: [0, 0, 1], mat: 'floor' }; }
        return null;
      }
      /* inside a pocket: the ray runs on through the hole until it leaves the cylinder */
      const ox = p[0] - h.c[0], oy = p[1] - h.c[1], a = d[0] * d[0] + d[1] * d[1];
      let tx = 1e30;
      if (a > 1e-12) { const b = ox * d[0] + oy * d[1], c = ox * ox + oy * oy - h.r * h.r, disc = b * b - a * c; if (disc >= 0) tx = (-b + Math.sqrt(disc)) / a; }
      const tb = d[2] < 0 ? (HBOT - p[2]) / d[2] : 1e30;
      if (tb < tx) { const q = add(p, mul(d, tb)); return { t: best.t + tb, p: q, n: [0, 0, 1], mat: 'hole', hole: h }; }
      const q = add(p, mul(d, tx));
      if (q[2] < topAt(q[0], q[1])) return { t: best.t + tx, p: q, n: norm([h.c[0] - q[0], h.c[1] - q[1], 0]), mat: 'hole', hole: h };
      o = q; tmin = 1e-6;
      const T = best.t + tx;
      const r = hitStatic(q, d, 1e-6);
      if (r) r.t += T;
      return r;
    }
    return null;
  }
  function hitBall(o, d, b, t, tmin) {
    const c = ballAt(b, t), ox = o[0] - c[0], oy = o[1] - c[1], oz = o[2] - c[2];
    const B = ox * d[0] + oy * d[1] + oz * d[2], Cc = ox * ox + oy * oy + oz * oz - b.r * b.r, disc = B * B - Cc;
    if (disc < 0) return -1;
    const s = Math.sqrt(disc);
    let tt = -B - s;
    if (tt <= tmin) tt = -B + s;
    return tt > tmin ? tt : -1;
  }
  function hitCue(o, d, time, tmin) {
    if (!cue) return null;
    const c0 = add(cue.tip, mul(cue.a, -cue.v * (time - 0.5)));
    const a = cue.a, k = cue.k, w = sub(o, c0);
    const ws = dot(w, a), ds = dot(d, a);
    const wp = sub(w, mul(a, ws)), dp = sub(d, mul(a, ds));
    const rr = cue.r0 + k * ws;
    const A = dot(dp, dp) - k * k * ds * ds, B = 2 * (dot(wp, dp) - k * ds * rr), Cc = dot(wp, wp) - rr * rr;
    let best = null;
    const disc = B * B - 4 * A * Cc;
    if (disc >= 0 && Math.abs(A) > 1e-14) {
      const sq = Math.sqrt(disc);
      for (const t of [(-B - sq) / (2 * A), (-B + sq) / (2 * A)]) {
        if (t <= tmin) continue;
        const s = ws + t * ds;
        if (s < 0 || s > cue.L) continue;
        if (!best || t < best.t) best = { t, s };
      }
    }
    /* the tip face */
    if (Math.abs(ds) > 1e-12) {
      const t = -ws / ds;
      if (t > tmin && (!best || t < best.t)) {
        const q = add(w, mul(d, t)), rq = sub(q, mul(a, dot(q, a)));
        if (dot(rq, rq) < cue.r0 * cue.r0) best = { t, s: 0, cap: true };
      }
    }
    if (!best) return null;
    const p = add(o, mul(d, best.t));
    let n;
    if (best.cap) n = mul(a, -1);
    else { const q = sub(p, c0), rad = norm(sub(q, mul(a, dot(q, a)))); n = norm(sub(rad, mul(a, k))); }
    return { t: best.t, p, n, mat: 'cue', s: best.s };
  }
  /* nearest hit of anything at shutter time t */
  function trace(o, d, time, tmin = 1e-5, skipBall = -1) {
    let best = hitStatic(o, d, tmin);
    for (let i = 0; i < balls.length; i++) {
      if (i === skipBall) continue;
      const t = hitBall(o, d, balls[i], time, tmin);
      if (t > 0 && (!best || t < best.t)) {
        const p = add(o, mul(d, t)), c = ballAt(balls[i], time);
        best = { t, p, n: mul(sub(p, c), 1 / balls[i].r), mat: 'ball', b: balls[i], bi: i };
      }
    }
    const ch = hitCue(o, d, time, tmin);
    if (ch && (!best || ch.t < best.t)) best = ch;
    return best;
  }
  function visible(p, q, time) {
    const l = sub(q, p), dist = Math.hypot(l[0], l[1], l[2]), d = mul(l, 1 / dist);
    for (let i = 0; i < balls.length; i++) { const t = hitBall(p, d, balls[i], time, 1e-5); if (t > 0 && t < dist) return 0; }
    const ch = hitCue(p, d, time, 1e-5);
    if (ch && ch.t < dist) return 0;
    for (const s of solids) {
      const h = hitConvex(p, d, s.planes, 1e-5);
      if (h && h.t < dist) { const x = p[0] + d[0] * h.t, y = p[1] + d[1] * h.t; if (!holeAt(x, y)) return 0; }
    }
    return 1;
  }

  /* ---- shading ---- */
  function direct(p, n, time, u1, u2) {
    /* one stratified sample of the lamp */
    const q = [LC[0] + (u1 - 0.5) * LS[0], LC[1] + (u2 - 0.5) * LS[1], LC[2]];
    const l = sub(q, p), d2 = dot(l, l), dl = Math.sqrt(d2), ld = mul(l, 1 / dl);
    const cp = dot(n, ld), cl = ld[2];
    if (cp <= 0 || cl <= 0) return { e: 0, ld };
    const v = visible(add(p, mul(n, 2e-5)), q, time);
    return { e: v * cp * cl / d2 * LAREA * LK, ld };
  }
  /* analytic contact occlusion from the balls (and the cue, roughly) */
  function occl(p, n, time, skip) {
    let ao = 1;
    for (let i = 0; i < balls.length; i++) {
      if (i === skip) continue;
      const c = ballAt(balls[i], time), w = sub(c, p), d2 = dot(w, w), d = Math.sqrt(d2);
      const cs = dot(n, w) / d;
      if (cs > 0) ao *= 1 - Math.min(0.95, balls[i].r * balls[i].r / d2 * cs * 0.9);
    }
    return ao;
  }
  /* the lamp seen in a mirror direction: 0..1 with a soft edge of width soft (metres on the lamp plane) */
  function lampSeen(p, r, soft) {
    /* a rounded rectangle (superellipse), soft over `soft` metres at its edge */
    if (r[2] <= 0) return 0;
    const t = (LC[2] - p[2]) / r[2], x = (p[0] + r[0] * t - LC[0]) / (LS[0] / 2), y = (p[1] + r[1] * t - LC[1]) / (LS[1] / 2);
    const e = Math.sqrt(Math.sqrt(x ** 4 + y ** 4));
    return Math.min(1, Math.max(0, 0.5 + (1 - e) * (LS[1] / 2) / Math.max(1e-4, soft)));
  }
  /* the hot core of the shade: it puts the crisp highlight on a ball */
  function coreSeen(p, r) {
    if (r[2] <= 0) return 0;
    const t = (LC[2] - p[2]) / r[2], x = (p[0] + r[0] * t - LC[0]) / (LS[0] * 0.28), y = (p[1] + r[1] * t - LC[1]) / (LS[1] * 0.28);
    return Math.min(1, Math.max(0, (1 - Math.hypot(x, y)) / 0.35));
  }
  const fres = (cs, f0) => f0 + (1 - f0) * (1 - cs) ** 5;
  const AMB = L.ambient;
  function clothAlbedo(p) {
    const fine = vnoise(p[0] * 900, p[1] * 900) * 0.5 + vnoise(p[0] * 2300 + 7, p[1] * 2300) * 0.5;
    const mott = vnoise(p[0] * 30, p[1] * 30);
    const k = 0.93 + 0.1 * fine + 0.06 * mott;
    return mul(CLOTH, k);
  }
  function woodAlbedo(p, edge) {
    /* grain runs along the rail */
    const fr = frames[edge];
    let along, across;
    if (edge === 0) { along = p[0]; across = p[1]; } else if (edge === 1) { along = p[1]; across = LX - p[0]; } else if (edge === 2) { along = LX - p[0]; across = LY - p[1]; } else { along = LY - p[1]; across = p[0]; }
    void fr;
    const wob = vnoise(along * 6, across * 20) * 2.2 + vnoise(along * 30, across * 60) * 0.4;
    const ring = 0.5 + 0.5 * Math.sin((across * 140 + p[2] * 140 + wob * 3) );
    const g = ring ** 3;
    const t = 0.35 + 0.65 * g;
    return [WOOD2[0] + (WOOD[0] - WOOD2[0]) * t, WOOD2[1] + (WOOD[1] - WOOD2[1]) * t, WOOD2[2] + (WOOD[2] - WOOD2[2]) * t];
  }
  function sky(d) { /* the dark room */
    const k = Math.max(0, d[2]);
    return [0.004 + 0.01 * k, 0.004 + 0.009 * k, 0.005 + 0.009 * k];
  }
  function shade(h, d, time, u1, u2, depth) {
    if (!h) return sky(d);
    const p = h.p, n = h.n, V = mul(d, -1);
    if (h.mat === 'floor') return [0.003, 0.0025, 0.0025];
    if (h.mat === 'hole') {
      /* the leather pocket: dark, a little light from above on the upper wall */
      const k = h.n[2] > 0.5 ? 0.0 : Math.max(0, Math.min(1, (p[2] - HBOT) / (0.05 - HBOT)));
      const L0 = direct(p, n, time, u1, u2).e;
      const v = 0.002 + 0.006 * k * k * k + 0.008 * L0 * k;
      return [v * 1.0, v * 0.85, v * 0.8];
    }
    if (h.mat === 'ball') {
      const b = h.b, c = ballAt(b, time);
      const v = n;
      let alb;
      const cn = dot(v, b.N), ca = dot(v, b.A);
      if (b.stripe && Math.abs(ca) > BAND) alb = IVORY;
      else alb = b.col;
      if (b.n === 0) alb = IVORY;
      if (b.n > 0 && cn > NUM_CA) {
        const uu = dot(v, b.E1) / cn / NUM_T, vv = ca / cn / NUM_T;
        const m = sampleMask(b.mask, uu, vv);
        /* anti-aliased circle edge */
        const edge = Math.min(1, Math.max(0, (cn - NUM_CA) / 0.012));
        const white = mul(IVORY, 1), ink = [0.012, 0.012, 0.014];
        const inner = [white[0] + (ink[0] - white[0]) * m, white[1] + (ink[1] - white[1]) * m, white[2] + (ink[2] - white[2]) * m];
        alb = [alb[0] + (inner[0] - alb[0]) * edge, alb[1] + (inner[1] - alb[1]) * edge, alb[2] + (inner[2] - alb[2]) * edge];
      }
      const dl = direct(p, n, time, u1, u2);
      const ao = occl(p, n, time, h.bi);
      /* cloth bounce from below */
      const bounce = Math.max(0, -n[2]) * 0.16;
      const diff = [alb[0] * (AMB * ao + dl.e + bounce * CLOTH[0] * 2), alb[1] * (AMB * ao + dl.e + bounce * CLOTH[1] * 2), alb[2] * (AMB * ao + dl.e + bounce * CLOTH[2] * 2)];
      const cs = Math.max(0, dot(n, V)), F = fres(cs, 0.045);
      const r = sub(d, mul(n, 2 * dot(d, n)));
      let refl;
      const ls = lampSeen(p, r, 0.05) + 4 * coreSeen(p, r);
      if (depth < 1) {
        const rh = trace(add(p, mul(n, 1e-5)), r, time, 1e-5, h.bi);
        refl = rh ? shade(rh, r, time, u1, u2, depth + 1) : sky(r);
        if (!rh || rh.mat === 'floor') refl = add(refl, mul([1, 0.97, 0.9], 9 * ls));
      } else refl = add(sky(r), mul([1, 0.97, 0.9], 9 * ls));
      return [diff[0] * (1 - F) + refl[0] * F, diff[1] * (1 - F) + refl[1] * F, diff[2] * (1 - F) + refl[2] * F];
    }
    if (h.mat === 'cue') {
      const s = h.s;
      let alb, gloss = 0.04;
      if (s < 0.013) alb = col('#2f6fb0');
      else if (s < 0.038) { alb = col('#f2efe6'); gloss = 0.06; }
      else if (s < 0.80) {
        const g = vnoise(s * 40, Math.atan2(n[1], n[0]) * 3);
        alb = mul(col('#e3c896'), 0.9 + 0.15 * g);
      } else if (s < 0.82) alb = col('#e8e2d0');
      else alb = col('#20120c');
      const dl = direct(p, n, time, u1, u2);
      const diff = mul(alb, AMB + dl.e);
      const r = sub(d, mul(n, 2 * dot(d, n))), cs = Math.max(0, dot(n, V));
      const F = fres(cs, gloss);
      const ls = lampSeen(p, r, 0.25);
      return add(mul(diff, 1 - F), mul([1, 0.96, 0.9], 3 * ls * F * (s < 0.013 ? 0.2 : 1)));
    }
    if (h.mat === 'rail') {
      /* the pocket liner: a leather ring on the wood round each hole */
      let nearHole = 1e9;
      for (const ho of holes) nearHole = Math.min(nearHole, Math.hypot(p[0] - ho.c[0], p[1] - ho.c[1]) - ho.r);
      const dl = direct(p, n, time, u1, u2);
      const ao = occl(p, n, time, -1);
      if (nearHole < 0.016 && p[2] > RAIL_TOP - 0.03) {
        const diff = mul(LEATHER, AMB * ao + dl.e);
        const r = sub(d, mul(n, 2 * dot(d, n))), F = fres(Math.max(0, dot(n, V)), 0.03);
        return add(diff, mul([1, 1, 1], 1.2 * lampSeen(p, r, 0.4) * F));
      }
      let alb = woodAlbedo(p, h.s.edge);
      for (const dm of diamonds) {
        if (dm.e !== h.s.edge) continue;
        const dx = p[0] - dm.c[0], dy = p[1] - dm.c[1];
        const ax = dm.e % 2 === 0 ? Math.abs(dx) / 0.011 + Math.abs(dy) / 0.0065 : Math.abs(dy) / 0.011 + Math.abs(dx) / 0.0065;
        if (ax < 1 && n[2] > 0.9) alb = col('#e9e4d6');
      }
      const diff = mul(alb, AMB * ao + dl.e);
      const r = sub(d, mul(n, 2 * dot(d, n))), F = fres(Math.max(0, dot(n, V)), 0.05);
      return add(diff, mul([1, 0.94, 0.86], 2.2 * lampSeen(p, r, 0.35) * F));
    }
    /* cloth: the bed and the cushions */
    const alb = clothAlbedo(p);
    const dl = direct(p, n, time, u1, u2);
    let ao = occl(p, n, time, -1);
    if (h.mat === 'cloth') {
      const de = Math.min(p[0], LX - p[0], p[1], LY - p[1]);
      ao *= 1 - 0.45 * Math.exp(-Math.max(0, de) / 0.018);
    }
    const sheen = 0.18 * (1 - Math.abs(dot(n, V))) ** 4;
    const k = AMB * ao + dl.e;
    return [alb[0] * k + sheen * alb[0] * 2 * k, alb[1] * k + sheen * alb[1] * 2 * k, alb[2] * k + sheen * alb[2] * 2 * k];
  }

  /* ---- render ---- */
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const img = g.createImageData(S, S), px = img.data;
  const sq = Math.round(Math.sqrt(SPP));
  const tone = x => { x *= sc.exposure || 1; const k = 0.78; return x < k ? x : k + (1 - k) * (1 - Math.exp(-(x - k) / (1 - k))); };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let r = 0, gg = 0, b = 0;
      for (let s = 0; s < SPP; s++) {
        const sx = (s % sq + rnd()) / sq, sy = ((s / sq | 0) + rnd()) / sq;
        const time = (s + rnd()) / SPP;
        const ux = ((x + sx) / S * 2 - 1) * TAN, uy = (1 - (y + sy) / S * 2) * TAN;
        const d = norm([F[0] + RT[0] * ux + UP[0] * uy, F[1] + RT[1] * ux + UP[1] * uy, F[2] + RT[2] * ux + UP[2] * uy]);
        const h = trace(C, d, time);
        const l1 = ((s * 7 + 3) % SPP + rnd()) / SPP, l2 = rnd();
        const c = shade(h, d, time, l1, l2, 0);
        r += c[0]; gg += c[1]; b += c[2];
      }
      const i = (y * S + x) * 4;
      px[i] = 255 * lin2srgb(Math.min(1, tone(r / SPP)));
      px[i + 1] = 255 * lin2srgb(Math.min(1, tone(gg / SPP)));
      px[i + 2] = 255 * lin2srgb(Math.min(1, tone(b / SPP)));
      px[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  /* ---- the graphic layer ---- */
  for (const fx of sc.fx || []) {
    if (fx.type === 'flash') {
      const pc = fx.at === 'tip' ? cue.tip : mul(add(ballAt(balls[fx.ball], 1), ballAt(balls[fx.other], 1)), 0.5);
      const P = project(pc), rad = fx.r * P.k;
      g.save(); g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(P.x, P.y, 0, P.x, P.y, rad);
      gr.addColorStop(0, 'rgba(255,250,235,0.95)'); gr.addColorStop(0.18, 'rgba(255,236,190,0.55)'); gr.addColorStop(0.5, 'rgba(255,200,140,0.14)'); gr.addColorStop(1, 'rgba(255,180,120,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(P.x, P.y, rad, 0, Math.PI * 2); g.fill();
      /* spikes */
      const n = fx.spikes ?? 10;
      for (let i = 0; i < n; i++) {
        const ang = i / n * Math.PI * 2 + 0.3 + (hash(i, 7) - 0.5) * 0.3, len = rad * (fx.spike || 1) * (0.9 + 0.9 * hash(i, 3)), wdt = rad * 0.035;
        const ex = P.x + Math.cos(ang) * len, ey = P.y + Math.sin(ang) * len;
        const lg = g.createLinearGradient(P.x, P.y, ex, ey);
        lg.addColorStop(0, 'rgba(255,248,230,0.85)'); lg.addColorStop(1, 'rgba(255,230,190,0)');
        g.fillStyle = lg; g.beginPath();
        g.moveTo(P.x + Math.cos(ang + Math.PI / 2) * wdt, P.y + Math.sin(ang + Math.PI / 2) * wdt);
        g.lineTo(ex, ey);
        g.lineTo(P.x + Math.cos(ang - Math.PI / 2) * wdt, P.y + Math.sin(ang - Math.PI / 2) * wdt);
        g.closePath(); g.fill();
      }
      g.restore();
    }
    if (fx.type === 'lines') {
      /* speed lines trailing a ball, in its screen-space direction of travel */
      const b = balls[fx.ball], p1 = ballAt(b, 1), p0 = sub(p1, mul(norm(b.v), 0.05));
      const A1 = project(p1), A0 = project(p0);
      let dx = A1.x - A0.x, dy = A1.y - A0.y; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      const rpx = b.r * A1.k, cx = project(ballAt(b, 0.5));
      /* drawn on their own layer, then cut away wherever another ball is, so a line never
         crosses a ball */
      const lc = document.createElement('canvas'); lc.width = lc.height = S;
      const lg2 = lc.getContext('2d'); lg2.lineCap = 'round';
      for (let i = 0; i < fx.n; i++) {
        const off = ((i + 0.5) / fx.n * 2 - 1) * (fx.spread || 0.75);
        const len = fx.len * A1.k * (0.55 + 0.45 * hash(i, fx.ball * 13 + 1));
        const st = Math.sqrt(Math.max(0, 1 - off * off)) * rpx + rpx * (0.12 + 0.25 * hash(i, 5));
        const sx = cx.x - dx * st - dy * off * rpx, sy = cx.y - dy * st + dx * off * rpx;
        const ex = sx - dx * len, ey = sy - dy * len;
        const lg = lg2.createLinearGradient(sx, sy, ex, ey);
        lg.addColorStop(0, `rgba(255,248,235,${fx.alpha || 0.6})`); lg.addColorStop(1, 'rgba(255,248,235,0)');
        lg2.strokeStyle = lg; lg2.lineWidth = Math.max(1, rpx * (fx.w || 0.07) * (1 - Math.abs(off) * 0.5));
        lg2.beginPath(); lg2.moveTo(sx, sy); lg2.lineTo(ex, ey); lg2.stroke();
      }
      lg2.globalCompositeOperation = 'destination-out';
      balls.forEach((o, j) => {
        if (j === fx.ball) return;
        const P = project(ballAt(o, 0.5));
        lg2.beginPath(); lg2.arc(P.x, P.y, o.r * P.k * 1.08, 0, Math.PI * 2); lg2.fill();
      });
      g.save(); g.globalCompositeOperation = 'screen'; g.drawImage(lc, 0, 0); g.restore();
    }
    if (fx.type === 'dust') {
      /* chalk off the tip: soft blue powder drifting back along the cue */
      const P = project(cue.tip), back = project(add(cue.tip, mul(cue.a, 0.05)));
      let bx = back.x - P.x, by = back.y - P.y; const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
      g.save(); g.globalCompositeOperation = 'screen';
      for (let i = 0; i < fx.n; i++) {
        const ang = hash(i, 91) * Math.PI * 2, rr = fx.r * P.k * Math.sqrt(hash(i, 92)), dr = fx.drift * P.k * hash(i, 95);
        const x = P.x + Math.cos(ang) * rr + bx * dr, y = P.y + Math.sin(ang) * rr * 0.7 + by * dr;
        const s = Math.max(1, P.k * 0.0022 * (0.3 + hash(i, 93)));
        const gr = g.createRadialGradient(x, y, 0, x, y, s);
        const al = 0.15 + 0.35 * hash(i, 94);
        gr.addColorStop(0, `rgba(150,190,240,${al})`); gr.addColorStop(1, 'rgba(150,190,240,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    }
  }
  /* vignette */
  {
    const vg = g.createRadialGradient(S * 0.5, S * 0.45, S * 0.3, S * 0.5, S * 0.5, S * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.42)');
    g.fillStyle = vg; g.fillRect(0, 0, S, S);
  }

  /* ---- outputs: halve with high-quality smoothing down to each size ---- */
  function scaled(size) {
    let src = cv;
    while (src.width / 2 >= size) {
      const c = document.createElement('canvas'); c.width = c.height = src.width / 2;
      const cg = c.getContext('2d'); cg.imageSmoothingEnabled = true; cg.imageSmoothingQuality = 'high';
      cg.drawImage(src, 0, 0, c.width, c.height); src = c;
    }
    if (src.width !== size) {
      const c = document.createElement('canvas'); c.width = c.height = size;
      const cg = c.getContext('2d'); cg.imageSmoothingEnabled = true; cg.imageSmoothingQuality = 'high';
      cg.drawImage(src, 0, 0, size, size); src = c;
    }
    const id = src.getContext('2d').getImageData(0, 0, size, size), d = id.data;
    if (size <= 256) {
      /* a light unsharp mask, as for any icon export: small sizes keep their edges */
      const o = new Uint8ClampedArray(d), amt = size <= 64 ? 0.45 : 0.3;
      for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) for (let c = 0; c < 3; c++) {
        const i = (y * size + x) * 4 + c;
        const blur = (o[i - 4] + o[i + 4] + o[i - size * 4] + o[i + size * 4] + 4 * o[i]) / 8;
        d[i] = o[i] + amt * (o[i] - blur) * 2;
      }
    }
    let s = '';
    const CH = 0x8000;
    for (let i = 0; i < d.length; i += CH) s += String.fromCharCode.apply(null, d.subarray(i, i + CH));
    return btoa(s);
  }
  const out = {};
  for (const size of cfg.outputs) out[size] = scaled(size);
  return out;
}

/* ---------- node side: PNG encoding (8-bit RGB, opaque by construction) ---------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(rgba, w, h) {
  const bpp = 3, stride = w * bpp, raw = Buffer.alloc((stride + 1) * h);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(stride);
    for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; row[x * 3] = rgba[i]; row[x * 3 + 1] = rgba[i + 1]; row[x * 3 + 2] = rgba[i + 2]; }
    /* adaptive filter: the one with the smallest sum of absolute values */
    let bestF = 0, bestSum = Infinity, bestRow = null;
    for (let f = 0; f < 5; f++) {
      const o = Buffer.alloc(stride);
      let sum = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? row[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
        let p;
        if (f === 0) p = 0; else if (f === 1) p = a; else if (f === 2) p = b; else if (f === 3) p = (a + b) >> 1;
        else { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
        const v = (row[i] - p) & 0xff; o[i] = v; sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) { bestSum = sum; bestF = f; bestRow = o; }
    }
    raw[y * (stride + 1)] = bestF; bestRow.copy(raw, y * (stride + 1) + 1);
    prev = row;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

async function render(browser, scene, { size, spp, zoom, outputs }) {
  const page = await browser.newPage();
  page.on('console', m => console.log('  [page] ' + m.text()));
  const res = await page.evaluate(renderArt, { size, spp, zoom, outputs, scene, LX, LY, R });
  await page.close();
  const out = {};
  for (const k of Object.keys(res)) out[k] = Buffer.from(res[k], 'base64');
  return out;
}

(async () => {
  const args = process.argv.slice(2);
  const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
  const pw = require('playwright-core');
  const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const t0 = Date.now();
  const write = (file, buf, s) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, encodePNG(buf, s, s)); console.log('wrote ' + path.relative(process.cwd(), file) + '  ' + s + 'x' + s); };
  const sceneName = opt('scene', CHOSEN);
  const scene = SCENES[sceneName];
  if (!scene) { console.error('make-icons: no scene ' + sceneName); process.exit(2); }
  const spp = +opt('spp', 8);
  if (args.includes('--out')) {
    /* one scene to a folder: for candidates and previews */
    const dir = path.resolve(opt('out')), size = +opt('size', 1024), ss = +opt('ss', 2);
    const outs = [size, 180, 60].filter(s => s <= size);
    const r = await render(browser, scene, { size: size * ss, spp, zoom: +opt('zoom', 1), outputs: outs });
    for (const s of outs) write(path.join(dir, `${sceneName}-${s}.png`), r[s], s);
  } else {
    const ICONS = path.join(ROOT, 'icons');
    const r = await render(browser, scene, { size: 2048, spp, zoom: 1, outputs: [1024, 512, 192, 180, 32] });
    write(path.join(ICONS, 'icon-1024.png'), r[1024], 1024);
    write(path.join(ICONS, 'icon-512.png'), r[512], 512);
    write(path.join(ICONS, 'icon-192.png'), r[192], 192);
    write(path.join(ICONS, 'apple-touch-icon.png'), r[180], 180);
    write(path.join(ICONS, 'favicon-32.png'), r[32], 32);
    /* maskable: the same shot with a wider view, so what matters sits inside the 80% safe
       circle and the table bleeds to the edges */
    const m = await render(browser, scene, { size: 1024, spp, zoom: 1.25, outputs: [512] });
    write(path.join(ICONS, 'icon-maskable-512.png'), m[512], 512);
  }
  await browser.close();
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
})().catch(e => { console.error('make-icons: ' + (e.stack || e)); process.exit(1); });
