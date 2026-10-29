#!/usr/bin/env node
/* make-sounds: builds the table sounds in sounds/ from real recordings (all CC0, see CREDITS.md).
   Each source is a WAV in a public GitHub repository, pinned to a commit; it is downloaded once
   into the cache directory (any downloaded file is only ever read as audio data). Every output is
   a slice of one recording: high-passed (room rumble), faded in over 1 ms and out over its tail,
   and levelled across its family (the attack energy matched, the loudest at -1 dBFS), written as
   16-bit mono 44.1 kHz PCM. The cushion is Kenney's soft impact raised in pitch with a muffled ball
   click under it; the roll is a quiet stretch of a rolling ball made into a seamless loop
   (played forwards then backwards, so both joins are continuous).
   Usage: node tools/make-sounds.cjs [cache-dir]   (writes ./sounds) */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'sounds');
const CACHE = path.resolve(process.argv[2] || path.join(require('os').tmpdir(), 'felt-sfx-src'));
const SR = 44100;

/* the recordings: where each one is hosted (pinned), and its original */
const AL = 'https://raw.githubusercontent.com/melpomenex/Afterlight/cdb806be84fd7afcb85630d0311d46af29c874fb/public/audio/pool/';
const SH = 'https://raw.githubusercontent.com/YoussefSah05/septhuit/2a18ca17a9b5379c36ecb2b262666cc4d18776b2/assets/audio/';
const BS = 'https://raw.githubusercontent.com/danielKlmr/BreakoutShot/6b1a83ca4f36a5b5d65a16e14a8c49ff47a3a968/addons/Za-Games/';
const MF = 'https://raw.githubusercontent.com/imehc/mftp/59409ffb5ebee843857fe704d65f2591c41be3eb/src/features/games/billiards/audio/';
const SRC = {
  za: BS + '539854__za-games__billiard-ball-clack.wav',   /* Za-Games, freesound 539854 */
  ross: AL + 'ball-hard-1.wav',                          /* RossJuterbock, freesound 543482 (a break in a bar) */
  lukas: AL + 'ball-soft-1.wav',                         /* 13FPanska_Marval_Lukas, freesound 379327 */
  bsu0: SH + 'ball_00.wav', bsu1: SH + 'ball_01.wav', bsu2: SH + 'ball_02.wav', bsu4: SH + 'ball_04.wav',
  bsu5: SH + 'ball_05.wav', bsu7: SH + 'ball_07.wav',    /* bsumusictech, freesound 62331 */
  csz8: SH + 'ball_08.wav', csz6: SH + 'cue_06.wav', roll: SH + 'roll_00.wav',   /* csaszi, freesound 350918 */
  cue1: AL + 'cue-hard-1.wav', cue2: AL + 'cue-hard-2.wav', cue3: MF + 'cue-1.wav',   /* craigsmith, freesound 675330 */
  ken0: SH + 'cushion_00.wav', ken1: SH + 'cushion_01.wav', ken2: SH + 'cushion_02.wav',   /* Kenney, Impact Sounds impactSoft_medium_000-002 */
  yar: AL + 'pocket-1.wav',                              /* Yarmonics, freesound 441857 */
  cait0: SH + 'pocket_00.wav', cait2: SH + 'pocket_02.wav'   /* Caitlin_100, freesound 365525 */
};

/* the outputs. [source, start s, end s, options]; options: hp (Hz), lp (Hz), fade (s of tail
   fade), pitch (rate), click (a ball click under it: [source, start, end, level, lp]) */
const FAMILIES = {
  ball: [['za', 0.001, 0.080], ['ross', 0.021, 0.060, { fade: 0.02 }], ['bsu1', 0.108, 0.175], ['bsu2', 0.005, 0.080],
    ['bsu4', 0.001, 0.080], ['bsu5', 0.001, 0.040, { fade: 0.02 }], ['bsu7', 0.001, 0.080], ['csz8', 0.001, 0.087],
    ['lukas', 0.004, 0.085], ['bsu0', 0.001, 0.068]],
  cue: [['cue1', 0.001, 0.130], ['cue2', 0.004, 0.150], ['cue3', 0.001, 0.150], ['csz6', 0.041, 0.115]],
  rail: [['ken0', 0, 0.115, { pitch: 2.2, hp: 80, click: ['za', 0.001, 0.04, 0.3, 1800] }],
    ['ken1', 0, 0.150, { pitch: 2.0, hp: 80, click: ['bsu4', 0.001, 0.04, 0.45, 1700] }],
    ['ken2', 0, 0.132, { pitch: 2.4, hp: 80, click: ['bsu2', 0.005, 0.045, 0.3, 1900] }]],
  pocket: [['yar', 0, 0.70, { hp: 60, fade: 0.1 }], ['cait0', 0, 0.64, { hp: 60, fade: 0.12 }], ['cait2', 0, 0.62, { hp: 60, fade: 0.14 }]],
  break: [['ross', 0.003, 0.260, { fade: 0.06 }]]
};

for (const [fam, tau] of [['ball', 0.014], ['cue', 0.022], ['break', 0.09]]) for (const sp of FAMILIES[fam]) sp[3] = Object.assign({ tau }, sp[3]);

function get(key) {
  const f = path.join(CACHE, key + '.wav');
  if (!fs.existsSync(f)) {
    fs.mkdirSync(CACHE, { recursive: true });
    execFileSync('curl', ['-sSfL', '-o', f, SRC[key]]);
  }
  return readWav(fs.readFileSync(f));
}
function readWav(b) {
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a WAV');
  let p = 12, fmt = null;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), n = b.readUInt32LE(p + 4), d = p + 8;
    if (id === 'fmt ') fmt = { tag: b.readUInt16LE(d), ch: b.readUInt16LE(d + 2), sr: b.readUInt32LE(d + 4), bits: b.readUInt16LE(d + 14) };
    else if (id === 'data') {
      if (!fmt || fmt.tag !== 1 || fmt.bits !== 16) throw new Error('want 16-bit PCM');
      const frames = Math.floor(n / 2 / fmt.ch), x = new Float64Array(frames);
      for (let i = 0; i < frames; i++) { let s = 0; for (let c = 0; c < fmt.ch; c++) s += b.readInt16LE(d + (i * fmt.ch + c) * 2); x[i] = s / fmt.ch / 32768; }
      return { x, sr: fmt.sr };
    }
    p = d + n + (n & 1);
  }
  throw new Error('no data');
}
function writeWav(x, sr = SR) {
  const n = x.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), 44 + i * 2);
  return b;
}
/* windowed-sinc resampling of [a, b) s of x to SR, played `pitch` times faster */
function resample(src, a, b, pitch = 1) {
  const { x, sr } = src, step = sr * pitch / SR, n = Math.floor((b - a) * sr / step), out = new Float64Array(n);
  const cut = Math.min(1, 1 / step) * 0.95, W = 16;
  for (let i = 0; i < n; i++) {
    const t = a * sr + i * step, c = Math.floor(t);
    let s = 0, wsum = 0;
    for (let k = c - W + 1; k <= c + W; k++) {
      const u = t - k, w = 0.5 + 0.5 * Math.cos(Math.PI * u / W), h = u === 0 ? 1 : Math.sin(Math.PI * cut * u) / (Math.PI * cut * u);
      wsum += w * h;
      if (k >= 0 && k < x.length) s += x[k] * w * h;
    }
    out[i] = s / wsum;
  }
  return out;
}
/* RBJ biquad, in place */
function biquad(x, type, f0, q = 0.707) {
  const w = 2 * Math.PI * f0 / SR, al = Math.sin(w) / (2 * q), cw = Math.cos(w);
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; } else { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; }
  const a0 = 1 + al, a1 = -2 * cw, a2 = 1 - al;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i], y = (b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y;
  }
  return x;
}
function fades(x, fin, fout) {
  const ni = Math.max(1, Math.round(fin * SR)), no = Math.max(1, Math.min(x.length, Math.round(fout * SR)));
  for (let i = 0; i < ni && i < x.length; i++) x[i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / ni);
  for (let i = 0; i < no; i++) x[x.length - 1 - i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / no);
  return x;
}
const peak = x => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
/* energy of the first 20 ms after the peak: the loudness a hit is matched on */
function attack(x) {
  let i0 = 0, m = 0;
  for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > m) { m = Math.abs(x[i]); i0 = i; }
  let e = 0;
  for (let i = i0; i < Math.min(x.length, i0 + 0.02 * SR); i++) e += x[i] * x[i];
  return Math.sqrt(e);
}
function build(spec) {
  const [key, a, b, o = {}] = spec;
  const x = resample(get(key), a, b, o.pitch || 1);
  biquad(x, 'hp', o.hp || 150);
  if (o.lp) biquad(x, 'lp', o.lp);
  if (o.click) {
    const [ck, ca, cb, lvl, lp] = o.click, c = biquad(biquad(resample(get(ck), ca, cb), 'hp', 300), 'lp', lp);
    fades(c, 0.001, (cb - ca) * 0.6);
    const g = lvl * peak(x) / (peak(c) || 1);
    for (let i = 0; i < c.length && i < x.length; i++) x[i] += g * c[i];
  }
  if (o.tau) tighten(x, o.tau);
  return fades(x, 0.001, o.fade || (b - a) / (o.pitch || 1) * 0.45);
}
/* a short room's tail off a take: from 3 ms after the peak the level falls by e every tau s on top
   of its own decay, so a clack is a clack and not the hall it was recorded in */
function tighten(x, tau) {
  let i0 = 0, m = 0;
  for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > m) { m = Math.abs(x[i]); i0 = i; }
  const s0 = i0 + Math.round(0.003 * SR), k = Math.exp(-1 / (tau * SR));
  let g = 1;
  for (let i = s0; i < x.length; i++) { x[i] *= g; g *= k; }
}
/* the roll: a steady stretch of csaszi's rolling ball, its slow level swings evened out, dark,
   then forwards + backwards (a palindrome loops without a seam) */
function roll() {
  const x = resample(get('roll'), 0.52, 1.06);
  biquad(x, 'hp', 50); biquad(x, 'lp', 2200); biquad(x, 'lp', 2200);
  const h = Math.round(0.05 * SR), env = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) { let e = 0, n = 0; for (let k = Math.max(0, i - h); k < Math.min(x.length, i + h); k += 8) { e += x[k] * x[k]; n++; } env[i] = Math.sqrt(e / n); }
  const mean = env.reduce((s, v) => s + v, 0) / env.length;
  for (let i = 0; i < x.length; i++) x[i] *= Math.min(3, mean / (env[i] || mean));
  const y = new Float64Array(x.length * 2 - 2);
  for (let i = 0; i < x.length; i++) y[i] = x[i];
  for (let i = 1; i < x.length - 1; i++) y[x.length - 1 + i] = x[x.length - 1 - i];
  const g = 0.5 / peak(y);
  return y.map(v => v * g);
}

fs.mkdirSync(OUT, { recursive: true });
let total = 0;
const put = (name, x, sr = SR) => { const b = writeWav(x, sr); fs.writeFileSync(path.join(OUT, name), b); total += b.length; console.log(`${name.padEnd(14)} ${(x.length / sr * 1000).toFixed(0).padStart(4)} ms  ${(b.length / 1024).toFixed(1).padStart(5)} KB`); };
for (const [fam, specs] of Object.entries(FAMILIES)) {
  /* even the takes (a hit's level is the game's choice, not the take's): a click by its peak, a
     longer sound (the pocket's rattle) by its attack's energy; then the loudest peak at -1 dBFS */
  const xs = specs.map(build), at = xs.map(fam === 'pocket' ? attack : peak), ref = Math.min(...at);
  xs.forEach((x, i) => { const g = ref / at[i]; for (let j = 0; j < x.length; j++) x[j] *= g; });
  const pk = Math.max(...xs.map(peak)), g = 0.891 / pk;
  xs.forEach((x, i) => put(`${fam}-${i + 1}.wav`, x.map(v => v * g)));
}
/* the roll holds nothing above 2.2 kHz: half the rate is plenty */
put('roll.wav', roll().filter((v, i) => i % 2 === 0), SR / 2);
console.log(`total ${(total / 1024).toFixed(1)} KB`);
