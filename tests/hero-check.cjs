#!/usr/bin/env node
/* hero-check: the setup hero (page 4m, sim 1n), in a real browser at 393x852 (dpr 3).
   For each of the eight games:
   1. the hero canvas is there, full bleed, 30-50% of the height, taking the room a short form
      leaves (no band over 24 px above Break unless at its 50% cap), not blank (pixel variance) and
      unlike every other game's;
   2. the shot plays out and settles within 5 s of the sheet opening, then asks for no frame;
   3. the last frame is the sim's: the rest positions equal simulateShot's for the stored inputs,
      on the page and in Node (byte for byte), and the shot is the game's moment (a pot at the
      pocket games, a red at snooker, the marked red in the far cup at bumper pool, a point at
      carom);
   4. the table geometry and physics globals are exactly what they were, mid-shot and after the
      sheet closes;
   5. frames within a 60 Hz budget: 95% under 16 ms, none over 33 (each frame flushed, felt.heroMeasure);
   6. the Large Title and the game's line keep 4.5:1 over the final frame (measured on the
      screen's pixels with the words hidden).
   Then: Reduce Motion shows that same final still and never animates; a tap on the hero replays
   it; the sheet closed mid-shot stops the frames; a table change on the sheet replays the shot on
   the new table; the back button is 44 px and on top; 8-Ball for two players fits whole at
   393x852 with Break pinned and a real tap there starts the game; on its side the hero is a panel
   left of the form. */
'use strict';
const { check, done, open, choose } = require('./lib.cjs');
const { loadSim } = require('./sim.cjs');

const KINDS = ['8', '9', '10', 'straight', 'rotation', 'bumper', 'snooker', 'carom'];
const phone = (w, h, o = {}) => open('', { viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 3, ...o });
const GEO = () => JSON.stringify([TABLE, POOL_TABLE, BUMPER_SHAPE, SNOOKER_SIZE, POCKETS_STYLE, TL, TW, HEAD_X, FOOT, BALL_R, MU_ROLL, CUE_RATIO, CUSH_MU, RAIL_E, MU_SP,
  CUSH, CUSHION_POLYS, POCKETS, POCKET_R, POCKET_AIM, MOUTHS, BUMPERS, BED_LINES, JAW_ARCS, SPOTS, D_R, RAIL, view]);

(async () => {
  const P = await phone(393, 852), page = P.page, ev = (f, a) => page.evaluate(f, a);
  await ev(`window.__geo = ${GEO.toString()}`);
  await ev(() => {
    window.__sig = () => { const c = setupHeroArt, x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data; let s = 0, s2 = 0, h = 0, n = 0;
      for (let i = 0; i < d.length; i += 4 * 7) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; s += v; s2 += v * v; n++; h = (h * 31 + d[i] + 7 * d[i + 1] + 13 * d[i + 2]) % 2147483647; }
      const m = s / n; return { varc: s2 / n - m * m, hash: h }; };
    /* the shot as the sim plays it on the hero's table, the game's put back */
    window.__simFinal = kind => { const k = heroOn(heroArgs(kind)); try { const H = heroSetup(kind), r = simulateShot(H.balls, H.shot); return { key: heroKey(kind), balls: r.balls.map(b => ({ n: b.n, x: b.x, y: b.y, on: b.on })), potted: r.potted, pocketOf: r.pocketOf, seq: r.seq, cue: r.cue }; } finally { heroOff(k); } };
  });
  const S = loadSim(), sigs = {};
  for (const kind of KINDS) {
    await ev(() => { felt.heroMeasure = true; setSetting('cpu', false); setSetting('reduceMotion', false); });
    const geoOpen = await ev(k => { backToMenu(); hero.ms = []; window.__t0 = performance.now(); showSetup(k); return __geo(); }, kind);
    await page.waitForTimeout(900);
    const mid = await ev(() => ({ geo: __geo(), state: felt.hero.state }));
    let ok = true;
    try { await page.waitForFunction(() => felt.hero.state === 'done', null, { timeout: 6000 }); } catch (e) { ok = false; }
    const settleMs = Math.round(await ev(() => felt.hero.doneAt - __t0));
    ok = ok && settleMs <= 5000;   /* the shot is 2.9 s; the rest is the build after the sheet opens, slower on a CI runner */
    const a = await ev(() => { const h = felt.hero, r = setupHeroArt.getBoundingClientRect(); return { h, box: [r.left, r.top, r.width, r.height], vh: innerHeight, vw: innerWidth, sig: __sig() }; });
    await page.waitForTimeout(600);
    const b = await ev(() => ({ frames: felt.hero.frames, raf: felt.hero.raf, state: felt.hero.state }));
    const sim = await ev(k => __simFinal(k), kind);
    sigs[kind] = a.sig;
    check(`${kind}: the hero is full bleed, ${(a.box[3] / a.vh * 100).toFixed(1)}% of the height (30-50%), and not blank (variance ${a.sig.varc.toFixed(0)})`,
      a.box[0] === 0 && Math.abs(a.box[2] - a.vw) < 0.5 && a.box[3] >= 0.3 * a.vh - 0.5 && a.box[3] <= 0.5 * a.vh + 0.5 && a.sig.varc > 200);
    /* the empty band between the form's last line and Break */
    const band = await ev(() => { let b = 0; for (const c of setupScroll.children) if (c.getClientRects().length) b = Math.max(b, c.getBoundingClientRect().bottom);
      const pad = parseFloat(getComputedStyle(setupScroll).paddingBottom); return { band: Math.round(breakBtn.getBoundingClientRect().top - b - pad), h: setupHero.getBoundingClientRect().height, vh: innerHeight, sh: setupScroll.scrollHeight, ch: setupScroll.clientHeight }; });
    check(`${kind}: the hero takes the spare room (band above Break ${band.band} px: 24 px or less, or the hero at its 50% cap; the form never scrolled by it)`,
      (band.band <= 24 || band.h >= 0.5 * band.vh - 0.5 || band.h <= 0.3 * band.vh + 0.5 && band.sh > band.ch) && !(band.h > 0.3 * band.vh + 0.5 && band.sh > band.ch), JSON.stringify(band));
    check(`${kind}: the shot settles within 5 s of opening (${settleMs} ms), then no frame is asked for`, ok && b.state === 'done' && !b.raf && b.frames === a.h.frames && mid.state === 'play', JSON.stringify({ settleMs, mid: mid.state, b }));
    const same = JSON.stringify(sim.balls) === JSON.stringify(a.h.final);
    /* Node's sim on the same table */
    const [kd, t1, t2] = sim.key.split('|');
    if (kd === 'snooker') S.setTable('snooker', t1); else if (kd === 'bumper') S.setTable('bumper', t1); else if (kd === 'carom') S.setTable('carom'); else { S.setTable(t1); S.setPockets(t2); }
    const H = S.heroSetup(kind), r = S.simulateShot(H.balls, H.shot), node = r.balls.map(x => ({ n: x.n, x: x.x, y: x.y, on: x.on }));
    const diff = (p, q) => (p || []).filter((x, i) => !q || JSON.stringify(x) !== JSON.stringify(q[i])).map(x => x.n);
    check(`${kind}: the final frame is simulateShot's rest positions for the stored inputs (${sim.key}) on the page, byte for byte`, same, JSON.stringify({ page: diff(sim.balls, a.h.final) }));
    /* Node's V8 may round a transcendental function a last bit differently from the browser's:
       the same balls down, every rest position within a micrometre */
    const near = node.every((x, i) => x.n === a.h.final[i].n && x.on === a.h.final[i].on && Math.hypot(x.x - a.h.final[i].x, x.y - a.h.final[i].y) < 1e-6);
    check(`${kind}: ...and Node's sim agrees (the same balls down, each rest within 1 micrometre)`, near, JSON.stringify(diff(node, a.h.final)));
    const g = S.newGame(kind);
    g.balls = H.balls.map(x => Object.assign({}, x));
    const v = S.judge(g, r).verdict;
    const moment = ['8', '9', '10', 'straight', 'rotation'].includes(kind) ? !v.foul && r.potted.length > 0 && !r.potted.includes(0)
      : kind === 'snooker' ? !v.foul && r.potted.some(S.isRed) && !r.potted.includes(0)
        : kind === 'bumper' ? !v.foul && r.pocketOf[S.B_MARK[0]] === 1 && r.rails[S.B_MARK[0]] >= 1 : v.point;
    check(`${kind}: the shot is the game's moment (${kind === 'carom' ? 'a point' : 'down: ' + r.potted.join(' ')}), a legal shot`, moment);
    const after = await ev(() => { backToMenu(); return __geo(); });
    check(`${kind}: the table geometry and physics globals unchanged mid-shot and after the sheet closes`, mid.geo === geoOpen && after === geoOpen);
    /* the budget is a 60 Hz frame for 95% of frames and two at the worst: one frame over 16 ms is the
       machine (the suites run side by side), a run of them is the hero */
    const ms = a.h.ms, max = Math.max(...ms), avg = ms.reduce((s, x) => s + x, 0) / ms.length, p95 = ms.slice().sort((x, y) => x - y)[Math.floor(ms.length * 0.95)];
    check(`${kind}: frames within a 60 Hz budget (${ms.length} frames, 95% under ${p95.toFixed(1)} ms < 16, max ${max.toFixed(1)} ms < 33, mean ${avg.toFixed(1)} ms, flushed)`, p95 < 16 && max < 33);
    /* contrast: the words hidden, the brightest pixel behind each against its colour */
    await ev(k => { showSetup(k); }, kind);
    await page.waitForFunction(() => felt.hero.state === 'done', null, { timeout: 8000 });
    const boxes = await ev(() => { document.querySelector('.heroTxt').style.visibility = 'hidden';
      return ['#setupTitle', '#setupSub'].map(s => { const e = document.querySelector(s), r = e.getBoundingClientRect(), c = getComputedStyle(e).color.match(/[\d.]+/g).map(Number); return { s, r: [r.left, r.top, r.width, r.height], c }; }); });
    const png = await page.screenshot({ clip: { x: 0, y: 0, width: 393, height: 300 } });
    await ev(() => { document.querySelector('.heroTxt').style.visibility = ''; });
    const worst = await ev(([b64, boxes]) => new Promise(res => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
        const k = im.width / 393, lum = p => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]); };
        res(boxes.map(o => {
          const d = x.getImageData(Math.floor(o.r[0] * k), Math.floor(o.r[1] * k), Math.ceil(o.r[2] * k), Math.ceil(o.r[3] * k)).data;
          let hi = [0, 0, 0], L = -1;
          for (let i = 0; i < d.length; i += 4) { const l = lum([d[i], d[i + 1], d[i + 2]]); if (l > L) { L = l; hi = [d[i], d[i + 1], d[i + 2]]; } }
          const a = o.c.length > 3 ? o.c[3] : 1, fg = [0, 1, 2].map(i => o.c[i] * a + hi[i] * (1 - a)), lf = lum(fg);
          return { s: o.s, ratio: +((Math.max(lf, L) + 0.05) / (Math.min(lf, L) + 0.05)).toFixed(2) };
        }));
      };
      im.src = 'data:image/png;base64,' + b64;
    }), [png.toString('base64'), boxes]);
    check(`${kind}: the Large Title and the line keep 4.5:1 over the brightest pixel behind them (${worst.map(w => w.ratio).join(', ')})`, worst.every(w => w.ratio >= 4.5), JSON.stringify(worst));
    await ev(() => backToMenu());
  }
  const hs = KINDS.map(k => sigs[k].hash);
  /* a potted ball leaves the table: it is drawn dropping into its pocket for HERO_DROP_MS of the screen's
     clock (the cut and the fade under way), and is gone after; never frozen at the mouth until the still */
  for (const kind of KINDS) {
    const dr = await ev(k => { backToMenu(); showSetup(k); return new Promise(res => { const go = () => { if (!(hero.run && hero.run.done)) return setTimeout(go, 50);
      heroStop(); const r = hero.run, out = [];
      for (const [i, p] of Object.entries(r.pots)) {
        const n = hero.data.balls[i].n, th = heroPotT(r, p), at = u => { heroDraw(th + u * HERO_DROP_MS); return hero.drawn.find(o => o.n === n) || null; };
        const mid = at(0.5), after = at(1.15), before = at(-0.3);
        out.push({ n, before: !!before && before.drop === null, mid: !!mid && mid.drop > 0.3 && mid.drop < 0.7 && mid.fade < 1, gone: !after });
      }
      heroGo(); res(out); }; go(); }); }, kind);
    check(`${kind}: every potted ball drops into its pocket over ${'HERO_DROP_MS'} and is gone after (none frozen at the mouth)`, dr.every(o => o.before && o.mid && o.gone), JSON.stringify(dr));
  }
  check('every game\'s hero differs from every other\'s', new Set(hs).size === KINDS.length, hs.join(' '));

  /* Reduce Motion: the final still at once, the same pixels, no animation */
  const rm = await ev(async () => {
    showSetup('8');
    await new Promise(r => { const w = () => felt.hero.state === 'done' ? r() : setTimeout(w, 50); w(); });
    const fin = __sig();
    backToMenu(); setSetting('reduceMotion', true);
    const f0 = felt.hero.frames;
    showSetup('8');
    await new Promise(r => setTimeout(r, 900));
    const out = { state: felt.hero.state, raf: felt.hero.raf, frames: felt.hero.frames - f0, same: __sig().hash === fin.hash };
    setupHeroArt.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 300));
    out.afterTap = felt.hero.state;
    setSetting('reduceMotion', false); backToMenu();
    return out;
  });
  check('Reduce Motion: the final still, the same pixels as the shot\'s end, one frame and none asked for; a tap does not animate', rm.state === 'still' && !rm.raf && rm.frames === 1 && rm.same && rm.afterTap === 'still', JSON.stringify(rm));
  /* a real tap on the hero replays the shot */
  await ev(() => showSetup('9'));
  await page.waitForFunction(() => felt.hero.state === 'done', null, { timeout: 8000 });
  const f1 = await ev(() => felt.hero.frames);
  await page.touchscreen.tap(200, 120);
  await page.waitForTimeout(150);
  const rp = await ev(() => felt.hero.state);
  await page.waitForFunction(() => felt.hero.state === 'done', null, { timeout: 8000 });
  const f2 = await ev(() => felt.hero.frames);
  check('a real tap on the hero replays the shot to its end', rp === 'play' && f2 - f1 > 30, JSON.stringify({ rp, frames: f2 - f1 }));
  /* closed mid-shot: no more frames */
  const hid = await ev(async () => {
    showSetup('10');
    await new Promise(r => setTimeout(r, 700));
    backToMenu();
    await new Promise(r => setTimeout(r, 50));
    const f = felt.hero.frames;
    await new Promise(r => setTimeout(r, 600));
    return { state: felt.hero.state, raf: felt.hero.raf, more: felt.hero.frames - f };
  });
  check('the sheet closed mid-shot: the hero pauses and asks for no frame', hid.state === 'paused' && !hid.raf && hid.more === 0, JSON.stringify(hid));
  /* a table change on the sheet: the shot replays on the new table, the game's geometry kept */
  await ev(() => { setSetting('table', '7'); setSetting('pockets', 'regulation'); showSetup('8'); });
  await page.waitForFunction(() => felt.hero.state === 'done', null, { timeout: 8000 });
  const g1 = await ev(() => __geo());
  await choose(page, '#tb9', { touch: true });
  await page.waitForTimeout(80);
  const ch = await ev(() => ({ key: felt.hero.key, state: felt.hero.state }));
  await page.waitForFunction(() => felt.hero.state === 'done', null, { timeout: 8000 });
  const ch2 = await ev(() => ({ final: JSON.stringify(felt.hero.final) === JSON.stringify(__simFinal('8').balls), geo: __geo() }));
  check('Table 9 ft on the sheet: the hero replays the shot on the 9 ft table (its own stored shot), the final frame the sim\'s',
    ch.key === '8|9|regulation' && ch.state === 'play' && ch2.final, JSON.stringify(ch));
  check('...and the game\'s table geometry is the setting\'s, changed only by the setting', ch2.geo !== g1 && (await ev(() => TABLE)) === '9');
  await ev(() => { setSetting('table', '7'); backToMenu(); });
  /* the back button, the fit, Break */
  const lay = await ev(() => { setSetting('cpu', false); showSetup('8'); fitSetupRows();
    const r = setupBack.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2), bb = breakBtn.getBoundingClientRect();
    return { w: r.width, h: r.height, top: setupBack.contains(t), hero: setupHero.getBoundingClientRect().height, fit: setupScroll.scrollHeight <= setupScroll.clientHeight, sh: setupScroll.scrollHeight, ch: setupScroll.clientHeight, brk: [bb.top, bb.bottom, bb.height], vh: innerHeight }; });
  check('the back button over the hero: 44 px and on top', lay.w >= 44 && lay.h >= 44 && lay.top, JSON.stringify(lay));
  check('8-Ball for two players fits whole at 393x852 under a hero of 30% to 50% (the HIG list is shorter: the hero takes the room it leaves), Break pinned and wholly in view', lay.fit && lay.hero >= 0.3 * lay.vh - 0.5 && lay.hero <= 0.5 * lay.vh + 0.5 && lay.brk[0] >= 0 && lay.brk[1] <= lay.vh && lay.brk[2] === 50, JSON.stringify(lay));
  /* the CPU's cards make the snooker form taller: the hero gives the room back, then takes it again */
  const opp = await ev(async () => { backToMenu(); setSetting('cpu', false); showSetup('snooker'); await new Promise(r => setTimeout(r, 300)); const h0 = setupHero.getBoundingClientRect().height;
    vsCpu.click(); await new Promise(r => setTimeout(r, 300)); const h1 = setupHero.getBoundingClientRect().height, fit1 = setupScroll.scrollHeight <= setupScroll.clientHeight;
    vs2p.click(); await new Promise(r => setTimeout(r, 300)); const h2 = setupHero.getBoundingClientRect().height;
    return { h0, h1, h2, fit1, sh: setupScroll.scrollHeight, ch: setupScroll.clientHeight }; });
  check('Snooker: Opponent CPU adds the cards, the hero shrinks for them (the form still whole); Two Players gives the room back', opp.h1 < opp.h0 && opp.fit1 && opp.h2 === opp.h0, JSON.stringify(opp));
  await ev(() => { backToMenu(); setSetting('cpu', false); showSetup('8'); });
  /* balanced lines: the game's line never ends on one word alone */
  const wid = await ev(() => ['8', '9', '10', 'straight', 'rotation', 'bumper', 'snooker', 'carom'].map(k => { showSetup(k); const r = document.createRange(); r.selectNodeContents(setupSub); const rs = [...r.getClientRects()];
    const lines = [...new Set(rs.map(x => Math.round(x.top)))].length; const t = setupSub.textContent, last = t.slice(t.lastIndexOf(' ') + 1); return { k, lines, ok: lines < 2 || /\u00a0/.test(t) || last.includes('\u00a0'), wrap: getComputedStyle(setupSub).textWrap }; }));
  check('the game\'s line wraps balanced (text-wrap: balance), its last two words held together', wid.every(w => w.ok && /balance/.test(w.wrap)), JSON.stringify(wid));
  await ev(() => { backToMenu(); showSetup('8'); fitSetupRows(); });
  await page.waitForTimeout(200);
  await page.touchscreen.tap(196, (lay.brk[0] + lay.brk[1]) / 2);
  await page.waitForTimeout(300);
  check('a real tap on Break starts the game', await ev(() => !setupSheet.classList.contains('show') && felt.game.kind === '8' && felt.state !== 'menu'));
  check('no page errors', !P.errors.length, P.errors.join(' | '));
  await P.browser.close();

  /* on its side: the hero a panel down the left, the form beside it, Break in view */
  const L = await phone(956, 440), lp = L.page;
  const ls = await lp.evaluate(async () => { showSetup('snooker');
    await new Promise(r => { const w = () => felt.hero.state === 'done' ? r() : setTimeout(w, 50); w(); });
    const h = setupHero.getBoundingClientRect(), f = setupScroll.getBoundingClientRect(), b = breakBtn.getBoundingClientRect();
    return { h: [h.left, h.top, h.width, h.height], f: [f.left, f.top], b: [b.left, b.bottom], vh: innerHeight, vw: innerWidth, side: document.documentElement.scrollWidth <= innerWidth }; });
  check('956x440: the hero is a full-height panel on the left, the form and Break on its right, all in view',
    ls.h[0] === 0 && ls.h[3] >= ls.vh - 1 && ls.f[0] >= ls.h[2] - 0.5 && ls.b[0] >= ls.h[2] - 0.5 && ls.b[1] <= ls.vh && ls.side, JSON.stringify(ls));
  check('956x440: no page errors', !L.errors.length, L.errors.join(' | '));
  await L.browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
