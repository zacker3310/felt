#!/usr/bin/env node
/* sound-render: renders the game's synthesised sounds (index.html section 2) to WAV files to
   listen to, through the page's own soundRender (an OfflineAudioContext with the live graph and
   settings): a soft and a hard ball click, a cushion, a corner and a side pocket, snooker's net,
   the cue, a bumper post, the power bar's full tick, and a whole 8-ball break (every contact of a
   real break off the sim, with the roll bed following the balls' speed).
   Usage: node tools/sound-render.cjs [out-dir]   (default ./sounds) */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const pw = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || 'sounds');
const SR = 48000;

function wav(samples) {
  const n = samples.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return b;
}

(async () => {
  const srv = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || pw.chromium.executablePath() });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html`);
  await page.waitForFunction(() => window.booted === true, null, { timeout: 20000 });
  const files = await page.evaluate(async SR => {
    const out = {}, arr = a => Array.from(a);
    const one = async (name, ev, secs = 1) => { out[name] = arr(await soundRender(ev, secs, null, SR)); };
    setTable('7');
    const corner = POCKETS.findIndex(p => p[0] < TL * 0.1), side = POCKETS.findIndex(p => Math.abs(p[0] - TL / 2) < TL * 0.1);
    await one('click-soft', [['ball', 0.5, 0.05]], 0.4);
    await one('click-hard', [['ball', 5, 0.05]], 0.4);
    await one('cushion', [['rail', 3, 0.05]], 0.6);
    await one('pocket-corner', [['pocket', 1.5, 0.05, corner]], 1.4);
    await one('pocket-side', [['pocket', 1.5, 0.05, side]], 1.4);
    await one('cue', [['cue', 6, 0.05]], 0.5);
    await one('post', [['rail', 2.5, 0.05, 'post']], 0.6);
    await one('power-full', [['full', 1, 0.05]], 0.3);
    setTable('snooker', 'full');
    await one('pocket-snooker-net', [['pocket', 1.5, 0.05, 0]], 1);
    setTable('7');
    /* the break: a real one, every hit at its sim time, the roll bed at 60 Hz */
    felt.start('8');
    const balls = felt.game.balls.filter(b => b.on).map(b => Object.assign({}, b));
    const c = balls.find(b => b.n === 0), apex = balls.find(b => b.n === 1), lead = 0.1;
    const T = strike(newTable(balls, 0), Math.atan2(apex.y - c.y, apex.x - c.x), 1, 0), ev = [], rolls = [];
    const take = () => { for (const h of T.hits) ev.push([h[0], h[1], lead + T.t, h[2]]); T.hits.length = 0; };
    take();
    let live = true, n = 0;
    const every = Math.max(1, Math.round(1 / 60 / SIM_DT));
    while (live && T.t < 9) {
      live = stepTable(T); take();
      if (++n % every === 0 || !live) { let S = 0; for (const b of T.balls) if (b.on) S += Math.hypot(b.vx, b.vy); rolls.push([lead + T.t, S]); }
    }
    out.break = arr(await soundRender(ev, lead + T.t + 1.5, rolls, SR));
    felt.quitToHome();
    return out;
  }, SR);
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, s] of Object.entries(files)) {
    let pk = 0;
    for (const x of s) pk = Math.max(pk, Math.abs(x));
    fs.writeFileSync(path.join(OUT, name + '.wav'), wav(s));
    console.log(`${(name + '.wav').padEnd(26)} ${(s.length / SR).toFixed(2)} s  peak ${(20 * Math.log10(pk || 1e-9)).toFixed(1)} dBFS`);
  }
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
