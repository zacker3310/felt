#!/usr/bin/env node
/* sound-render: renders the game's table sounds (index.html section 2: the recorded takes in
   sounds/ through the page's own graph) to WAV files to listen to, through soundRender (an
   OfflineAudioContext with the live graph and settings): a soft, a medium and a hard ball hit, a
   run of hits at mixed speeds, a cushion (hard and soft), a corner and a side pocket, snooker's
   net, a jaw, a bumper post, the cue (hard and soft), three seconds of roll slowing to a stop, a
   whole 8-ball break (every contact of a real break off the sim, the roll bed following the balls'
   speed), and a break and run: the hard CPU's shots one after another until it misses or wins,
   each one's contacts at their sim times, a second between shots.
   Usage: node tools/sound-render.cjs [out-dir]   (default ./renders) */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const pw = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || 'renders');
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
    res.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.wav') ? 'audio/wav' : 'application/octet-stream' });
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
    await one('hit-soft', [['ball', 0.5, 0.05]], 0.4);
    await one('hit-medium', [['ball', 2, 0.05]], 0.4);
    await one('hit-hard', [['ball', 5, 0.05]], 0.4);
    await one('hit-sequence', [0.4, 1, 2, 3.5, 5, 0.3, 1.5, 2.5, 4, 6].map((v, i) => ['ball', v, 0.05 + i * 0.3]), 3.3);
    await one('cushion', [['rail', 3, 0.05]], 0.6);
    await one('cushion-soft', [['rail', 0.8, 0.05]], 0.6);
    await one('pot-corner', [['pocket', 1.5, 0.05, corner]], 1.2);
    await one('pot-side', [['pocket', 1.5, 0.05, side]], 1.2);
    await one('jaw', [['jaw', 3, 0.05]], 0.5);
    await one('cue', [['cue', 6, 0.05]], 0.5);
    await one('cue-soft', [['cue', 1.5, 0.05]], 0.5);
    out['roll-3s'] = arr(await soundRender([], 3.2, Array.from({ length: 181 }, (_, i) => [i / 60, 4 * Math.max(0, 1 - i / 170) ** 1.5]), SR));
    setTable('bumper'); await one('bumper-post', [['rail', 2.5, 0.05, 'post']], 0.6);
    setTable('snooker', 'full'); await one('pot-snooker-net', [['pocket', 1.5, 0.05, 0]], 1);
    setTable('7');
    /* a shot's contacts and roll (60 Hz) at their sim times from t0; the table and its end time */
    const play = (balls, shot, t0, ev, rolls) => {
      const T = strike(newTable(balls, 0), shot.angle, shot.power, shot.spin || 0), every = Math.max(1, Math.round(1 / 60 / SIM_DT));
      const take = () => { for (const h of T.hits) ev.push([h[0], h[1], t0 + T.t, h[2]]); T.hits.length = 0; };
      take();
      let live = true, n = 0;
      while (live && T.t < 12) {
        live = stepTable(T); take();
        if (++n % every === 0 || !live) { let S = 0; for (const b of T.balls) if (b.on) S += Math.hypot(b.vx, b.vy); rolls.push([t0 + T.t, S]); }
      }
      return { T, end: t0 + T.t };
    };
    /* the break: a real one off the sim */
    felt.start('8');
    {
      const balls = felt.game.balls.filter(b => b.on).map(b => Object.assign({}, b));
      const c = balls.find(b => b.n === 0), apex = balls.find(b => b.n === 1), ev = [], rolls = [];
      const { end } = play(balls, { angle: Math.atan2(apex.y - c.y, apex.x - c.x), power: 1, spin: 0 }, 0.1, ev, rolls);
      out.break = arr(await soundRender(ev, end + 1.5, rolls, SR));
    }
    felt.quitToHome();
    /* a break and run: the hard CPU from the break on, the seed with the longest run of the first dozen */
    let best = null;
    for (let seed = 1; seed <= 12; seed++) {
      let g = newGame('8'), t = 0.1, pots = 0;
      const ev = [], rolls = [];
      for (let k = 0; k < 16 && g.winner === null; k++) {
        if (g.option) g = chooseOption(g, cpuOption(g, 'hard'));
        const me = g.turn, shot = cpuShot(g, seed * 31 + k, 'hard');
        if (shot.place) g = placeCue(g, shot.place[0], shot.place[1]);
        if (shot.call) g = withCall(g, shot.call);
        const { T, end } = play(g.balls, shot, t, ev, rolls);
        const r = resultOf(T);
        pots += r.potted.filter(n => n !== 0).length;
        g = judge(g, r); t = end + 1;
        if (g.turn !== me) break;
      }
      if (!best || pots > best.pots || (g.winner !== null && !best.won)) best = { pots, ev, rolls, t, won: g.winner !== null, seed };
      if (best.won) break;
    }
    out['break-and-run'] = arr(await soundRender(best.ev, best.t + 0.5, best.rolls, SR));
    out.__run = [best.seed, best.pots, best.won];
    return out;
  }, SR);
  const run = files.__run; delete files.__run;
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, s] of Object.entries(files)) {
    let pk = 0;
    for (const x of s) pk = Math.max(pk, Math.abs(x));
    fs.writeFileSync(path.join(OUT, name + '.wav'), wav(s));
    console.log(`${(name + '.wav').padEnd(26)} ${(s.length / SR).toFixed(2)} s  peak ${(20 * Math.log10(pk || 1e-9)).toFixed(1)} dBFS`);
  }
  console.log(`break and run: CPU seed ${run[0]}, ${run[1]} balls potted${run[2] ? ', game won' : ''}`);
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
