#!/usr/bin/env node
/* intro-check: the opening (index.html 6o), in a real browser with the opening on (lib's intro: true;
   every other suite skips it). At 430x932 (dpr 3, the island's 59 px and the home indicator's 34 px
   as iOS insets through --sat..):
   1. a cold boot plays it: the first paint holds the launch image's frame, boot is not held up
      (window.booted while it is still being built), then it plays to its end and hands over to the
      home (the cards shown, the wordmark back in the header, the canvas let go);
   2. its first frame is the launch image: the wordmark on the same device pixels as
      icons/launch/launch-1290x2796.png (upright) and launch-2796x1290.png (on its side);
   3. the break it plays is the sim's: the last frame's rest positions equal simulateShot's for the
      same layout and inputs on the same table, byte for byte, with a ball down; the table geometry
      and the physics globals are untouched; the cut comes after the strike;
   4. a real tap mid-break skips it to the home in a short glide, and that tap (and the rest of its
      gesture) never reaches the home: no setup sheet opens; a tap after it does; a key skips too;
   5. no frame is asked for once it ends; hidden mid-way it ends at once; a visibilitychange or a
      pageshow later never plays it again;
   6. frames: within a 60 Hz budget at dpr 3 (scaled by lib's speedFactor), and the lamp's overlay
      no more than doubles the hero renderer's own cost (relative);
   7. Reduce Motion (the system's, and the app's switch): no scene, the cards fade in under the
      wordmark in under 300 ms; the setting off: no opening at all, from the first paint;
   8. layout at 393x852, 430x932, 440x956 and 375x667 upright and 852x393, 932x430 on its side with
      iOS insets: the canvas covers the screen at the device's pixels, the landed wordmark is
      centred and whole inside the safe area (never under the island), not blank, and ends exactly
      on the header's wordmark;
   9. aria-hidden, focus untouched, no console errors. */
'use strict';
const fs = require('fs');
const path = require('path');
const { check, done, open, speedFactor } = require('./lib.cjs');

const insetCss = (w, h) => w > h ? 'html:root { --sat: 0px; --sar: 59px; --sab: 21px; --sal: 59px; }' : `html:root { --sat: ${h <= 667 ? 20 : 59}px; --sar: 0px; --sab: ${h <= 667 ? 0 : 34}px; --sal: 0px; }`;
const insets = css => `document.addEventListener('readystatechange', () => { if (!document.getElementById('insets')) { const s = document.createElement('style'); s.id = 'insets'; s.textContent = ${JSON.stringify(css)}; (document.head || document.documentElement).appendChild(s); } });
  window.__bootIntro = null; { let b; Object.defineProperty(window, 'booted', { configurable: true, get: () => b, set: v => { b = v; window.__bootIntro = window.felt && felt.intro ? felt.intro.state : 'none'; } }); }
  window.__cls0 = null; document.addEventListener('DOMContentLoaded', () => { window.__cls0 = document.documentElement.className; }, { once: true });`;
const phone = (w, h, o = {}) => open('', { viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 3, intro: true, ...o,
  init: insets(insetCss(w, h)) + (o.init || '') });
const GEO = () => JSON.stringify([TABLE, POOL_TABLE, BUMPER_SHAPE, SNOOKER_SIZE, POCKETS_STYLE, TL, TW, HEAD_X, FOOT, BALL_R, MU_ROLL, CUE_RATIO, CUSH_MU, RAIL_E, MU_SP,
  CUSH, CUSHION_POLYS, POCKETS, POCKET_R, POCKET_AIM, MOUTHS, BUMPERS, BED_LINES, JAW_ARCS, SPOTS, D_R, RAIL]);
const waitState = (page, states, timeout = 15000) => page.waitForFunction(s => s.includes(felt.intro.state), states, { timeout });
/* the bright pixels' box in a PNG (the wordmark's white on the home's near black), in device px */
const brightBox = (page, b64) => page.evaluate(async b64 => {
  const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob()), c = document.createElement('canvas');
  c.width = bmp.width; c.height = bmp.height;
  const g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { const i = 4 * (y * c.width + x); if (d[i] + d[i + 1] + d[i + 2] > 3 * 140) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  return { w: c.width, h: c.height, box: [x0, y0, x1, y1], n, bg: [...g.getImageData(c.width - 2, c.height - 2, 1, 1).data].slice(0, 3) };
}, b64);
const near = (p, q) => p.box.every((v, i) => Math.abs(v - q.box[i]) <= 2);

(async () => {
  /* ---- 1-3. a cold boot, upright ---- */
  const P = await phone(430, 932), page = P.page, ev = (f, a) => page.evaluate(f, a);
  const boot = await ev(() => ({ booted: window.booted, state: window.__bootIntro, mode: felt.intro.mode, cls0: window.__cls0, cls: document.documentElement.className, focus: document.activeElement === document.body,
    aria: introArt.getAttribute('aria-hidden'), sound: settings.sound }));
  await ev(`window.__geo = ${GEO.toString()}`);
  const geo0 = await ev(() => __geo());
  check('a cold boot plays the opening: booted while it is still being built (boot not held up), the first paint already the launch frame (<html class="intro">), the canvas aria-hidden',
    boot.booted && boot.state === 'prep' && boot.mode === 'full' && /\bintro\b/.test(boot.cls0 || '') && boot.aria === 'true', JSON.stringify(boot));
  await waitState(page, ['play']);
  await ev(() => { felt.introMeasure = true; });
  const mid = await (async () => { await page.waitForFunction(() => performance.now() - felt.intro.t0 > 1500, null, { timeout: 5000 }); return ev(() => ({ geo: __geo(), cls: document.documentElement.className, focus: document.activeElement === document.body })); })();
  await waitState(page, ['done'], 10000);
  const end = await ev(() => { const r = menuTitle.getBoundingClientRect(), i = felt.intro; return { i, cls: document.documentElement.className, t: menuTitle.style.transform, op: getComputedStyle(playRow).opacity, foot: getComputedStyle(statsBtn).opacity,
    title: [r.left, r.top, r.width, r.height], canvas: [introArt.width, introArt.height], disp: getComputedStyle(introArt).display, focus: document.activeElement === document.body, geo: __geo() }; });
  const ran = end.i.endAt - end.i.t0;
  check(`it plays to its end (${Math.round(ran)} ms, built in ${Math.round(end.i.prepMs)} ms) and hands over: the cards and the header's buttons shown, the wordmark back in place, the canvas let go`,
    end.i.why === null && ran >= end.i.end - 40 && ran < end.i.end + 600 && !/\bintro\b/.test(end.cls) && end.t === '' && end.op === '1' && end.foot === '1' && end.canvas.join() === '0,0' && end.disp === 'none'
    && Math.abs(end.title[0] - end.i.home.x) < 0.5 && Math.abs(end.title[1] - end.i.home.y) < 0.5, JSON.stringify({ ran, end: { ...end, i: { ...end.i, ms: end.i.ms.length } } }));
  check('focus is never moved (VoiceOver users land on the home)', boot.focus && mid.focus && end.focus);
  /* 3. the sim's break */
  const sim = await ev(() => { const a = felt.intro.args, k = heroOn(a); try { const H = heroSetup(felt.intro.kind), r = simulateShot(H.balls, H.shot); return { key: heroKey(felt.intro.kind), shot: H.shot, start: H.balls.map(b => ({ n: b.n, x: b.x, y: b.y })), balls: r.balls.map(b => ({ n: b.n, x: b.x, y: b.y, on: b.on })), potted: r.potted }; } finally { heroOff(k); } });
  check(`the break is the sim's (${sim.key}): the last frame's rest positions are simulateShot's for the same layout and inputs, byte for byte, with ${sim.potted.length} ball(s) down`,
    JSON.stringify(sim.balls) === JSON.stringify(end.i.final) && JSON.stringify(sim.start) === JSON.stringify(end.i.start) && JSON.stringify(sim.shot) === JSON.stringify(end.i.shot) && sim.potted.length > 0 && !sim.potted.includes(0),
    JSON.stringify({ sim: sim.potted, page: end.i.potted }));
  check('the table geometry and physics globals are exactly as they were, mid-break and after', geo0 === mid.geo && geo0 === end.geo);
  check(`the cut to the high camera comes after the strike (${Math.round(end.i.cut)} ms on the shot's clock, strike at 560)`, end.i.cut > 560 && end.i.cut < 1600);
  check(`with sound on and audio already running here, the strike and the break sounded from the roll's hits (${end.i.sounded} of ${end.i.hits})`, !boot.sound || end.i.sounded > 0, JSON.stringify({ sounded: end.i.sounded, hits: end.i.hits }));
  /* 5. no frame after the end; hidden and back never plays it again */
  const f0 = end.i.frames;
  await ev(() => { window.__rafs = 0; const r = window.requestAnimationFrame; window.requestAnimationFrame = cb => r(t => { if (cb === introTick) window.__rafs++; cb(t); }); });
  await page.waitForTimeout(600);
  await ev(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await page.waitForTimeout(600);
  const after = await ev(() => ({ listening: felt.intro.listening, frames: felt.intro.frames, raf: felt.intro.raf, state: felt.intro.state, rafs: window.__rafs, cls: document.documentElement.className, w: introArt.width }));
  check('once it ends no frame is asked for (and its gesture guard is gone from the window), and a return from the background (visibilitychange, pageshow) never plays it again', !after.listening && after.frames === f0 && !after.raf && after.rafs === 0 && after.state === 'done' && !/\bintro\b/.test(after.cls) && after.w === 0, JSON.stringify(after));
  /* 6. frames */
  const ms = end.i.ms.slice(2).sort((a, b) => a - b), sp = await speedFactor(page), p95 = ms[Math.floor(ms.length * 0.95)], max = ms[ms.length - 1];
  check(`frames at dpr 3 (430x932, 1290x2796 px): 95% under ${(16.7 * sp.f).toFixed(1)} ms (${p95.toFixed(1)}), none over ${(50 * sp.f).toFixed(0)} (${max.toFixed(1)}), ${ms.length} frames (speed factor ${sp.f.toFixed(2)})`,
    ms.length > 40 && p95 < 16.7 * sp.f && max < 50 * sp.f, JSON.stringify(ms.slice(-8).map(v => +v.toFixed(1))));
  check(`what it holds while it plays at dpr 3: ${end.i.memMB} MB of canvas (under 72), all let go at the end`, end.i.memMB > 0 && end.i.memMB < 72 && end.canvas.join() === '0,0');
  check('no console errors', P.errors.length === 0, P.errors.join(' | '));
  await P.browser.close();

  /* the relative cost: the opening's frame against the hero renderer alone, on the same canvas */
  const Q = await phone(430, 932), q = Q.page;
  await waitState(q, ['play']);
  const rel = await q.evaluate(() => {
    felt.introSeek(1800);
    const flush = () => introArt.getContext('2d').getImageData(0, 0, 1, 1), time = f => { const out = []; for (let i = 0; i < 24; i++) { const t0 = performance.now(); f(1500 + i * 20); flush(); out.push(performance.now() - t0); } out.sort((a, b) => a - b); return out[12]; };
    time(t => introDraw(t));
    const full = time(t => introDraw(t)), bare = time(t => heroDraw(introHT(t), intro, introArt));
    return { full, bare, r: full / bare };
  });
  check(`the lamp's overlay costs at most as much again as the hero renderer under it (opening ${rel.full.toFixed(1)} ms, hero alone ${rel.bare.toFixed(1)} ms)`, rel.r < 2, JSON.stringify(rel));
  /* the opening's own clock: a touch under real time on the approach, slow motion through the first contact
     and the rack opening, then real time at most; never faster than 1.1x, no snaps, and the roll not run to rest */
  const clk = await q.evaluate(() => {
    const i = felt.intro, out = [];
    for (let t = i.strikeAt; t <= i.end; t += 10) out.push([t, felt.introSim(t)]);
    const rate = [];
    for (let k = 1; k < out.length; k++) rate.push([out[k][0], (out[k][1] - out[k - 1][1]) / ((out[k][0] - out[k - 1][0]) / 1000), out[k][1]]);
    return { rate, hitS: i.hitS, contactAt: i.contactAt, R: i.rate, pots: i.pots, land: i.timeline.land, end: i.end, simLand: felt.introSim(i.timeline.land), n: intro.run.pos.length * HERO_SUB * SIM_DT };
  });
  const maxRate = Math.max(...clk.rate.map(r => r[1])), late = clk.rate.filter(r => r[2] > clk.hitS + clk.R.outB), atHit = clk.rate.filter(r => Math.abs(r[2] - clk.hitS) < 0.02);
  const slowSpan = clk.rate.filter(r => r[1] <= 0.45).map(r => r[2]), jump = Math.max(...clk.rate.slice(1).map((r, k) => Math.abs(r[1] - clk.rate[k][1])));
  check(`the roll plays on the opening's own clock: never faster than 1.1x real (max ${maxRate.toFixed(3)}x; after the slow motion ${Math.max(...late.map(r => r[1])).toFixed(3)}x), no snap between frames (largest change ${jump.toFixed(3)} per 10 ms)`,
    maxRate <= 1.1 && late.length > 50 && late.every(r => r[1] >= 0.95 && r[1] <= 1.1) && jump < 0.075, JSON.stringify({ maxRate, jump }));
  check(`slow motion (0.45x or slower) covers the first contact (sim ${clk.hitS.toFixed(3)} s, at ${Math.round(clk.contactAt)} ms): from sim ${Math.min(...slowSpan).toFixed(2)} to ${Math.max(...slowSpan).toFixed(2)} s, ${atHit.length ? Math.max(...atHit.map(r => r[1])).toFixed(2) : '?'}x at the contact`,
    atHit.length > 0 && atHit.every(r => r[1] <= 0.45) && Math.min(...slowSpan) <= clk.hitS - 0.03 && Math.max(...slowSpan) >= clk.hitS + 0.2, JSON.stringify({ slow: [Math.min(...slowSpan), Math.max(...slowSpan)] }));
  check(`the wordmark lands over a table still rolling (sim ${clk.simLand.toFixed(2)} s of the ${clk.n.toFixed(2)} s roll at ${clk.land} ms), the 8-ball break's pots seen dropping by then (${clk.pots.map(p => p.at).join(', ')} ms), all within ${clk.end} ms`,
    clk.simLand < clk.n - 1 && clk.pots.length >= 2 && clk.pots.every(p => p.at <= clk.land + 100) && clk.end >= 4300 && clk.end <= 4800, JSON.stringify(clk.pots));
  /* each held moment's balls are the real sim's at that sim time: strike and stepTable stepped to the samples
     either side of it on the same table, interpolated as the frame does, byte for byte */
  const det = await q.evaluate(() => {
    const i = felt.intro, res = [];
    for (const t of [i.contactAt - 60, i.contactAt + 120, 2200, 3000, i.timeline.land, i.timeline.out - 20]) {
      const w = felt.introWorld(t), k0 = heroOn(i.args);
      try {
        const d = intro.data, tab = strike(newTable(d.balls, d.shot.ball), d.shot.angle, d.shot.power, d.shot.spin), dt = HERO_SUB * SIM_DT, f = w.s / dt, k = Math.floor(f), wt = f - k;
        let P = null, Q = null;
        for (let j = 0; j <= k + 1; j++) { if (j) for (let m = 0; m < HERO_SUB; m++) stepTable(tab); const snap = tab.balls.map(b => [b.x, b.y, b.on]); if (j === k) P = snap; if (j === k + 1) Q = snap; }
        const want = tab.balls.map((b, n) => [b.n, P[n][0] + (Q[n][0] - P[n][0]) * wt, P[n][1] + (Q[n][1] - P[n][1]) * wt, !!Q[n][2]]);
        res.push({ t, s: w.s, same: JSON.stringify(want) === JSON.stringify(w.balls), n: w.balls.length });
      } finally { heroOff(k0); }
    }
    return res;
  });
  check(`every held moment is the real sim's state at its sim time, byte for byte (${det.map(r => `${Math.round(r.t)} ms: sim ${r.s.toFixed(3)} s`).join('; ')})`, det.length === 6 && det.every(r => r.same && r.n > 9), JSON.stringify(det));
  /* 4. a real tap skips it and is swallowed; a key skips it */
  await q.reload();
  await q.waitForFunction(() => window.booted === true);
  await waitState(q, ['play']);
  await q.waitForFunction(() => performance.now() - felt.intro.t0 > 1400, null, { timeout: 5000 });
  const card = await q.evaluate(() => { const r = play8.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const tapT = await q.evaluate(() => performance.now());
  await q.touchscreen.tap(card[0], card[1]);
  await q.waitForTimeout(80);
  const skipping = await q.evaluate(() => felt.intro.state);
  await waitState(q, ['done'], 3000);
  await q.waitForTimeout(400);
  const sk = await q.evaluate(t => ({ i: felt.intro, took: felt.intro.endAt - t, setup: setupSheet.classList.contains('show'), state: felt.state, op: getComputedStyle(play8).opacity, tr: menuTitle.style.transform }), tapT);
  check(`a real tap mid-break skips it (${Math.round(sk.took)} ms glide to the home) and is swallowed with its gesture (${sk.i.swallowed} events): the 8-Ball card under it never opens`,
    skipping === 'out' && sk.i.why === 'skipped' && sk.took < 450 && !sk.setup && sk.state === 'menu' && sk.op === '1' && sk.tr === '' && sk.i.swallowed >= 2, JSON.stringify({ skipping, ...sk, i: { why: sk.i.why, swallowed: sk.i.swallowed } }));
  await q.touchscreen.tap(card[0], card[1]);
  await q.waitForTimeout(500);
  check('the next tap on the card is the home\'s own: the 8-Ball setup opens', await q.evaluate(() => setupSheet.classList.contains('show')));
  await q.reload();
  await q.waitForFunction(() => window.booted === true);
  await waitState(q, ['play']);
  await q.keyboard.press('Space');
  await waitState(q, ['done'], 3000);
  const ky = await q.evaluate(() => ({ why: felt.intro.why, state: felt.state, sheets: [...document.querySelectorAll('.overlay.show')].map(o => o.id) }));
  check('a key skips it too, and does nothing else', ky.why === 'skipped' && ky.state === 'menu' && ky.sheets.join() === 'menu', JSON.stringify(ky));
  /* hidden mid-way: it ends at once */
  await q.reload();
  await q.waitForFunction(() => window.booted === true);
  await waitState(q, ['play']);
  await q.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  const hid = await q.evaluate(() => ({ state: felt.intro.state, why: felt.intro.why, raf: felt.intro.raf, cls: document.documentElement.className }));
  check('the app sent to the background mid-way ends it at once (the home waiting on return)', hid.state === 'done' && hid.why === 'hidden' && !hid.raf && !/\bintro\b/.test(hid.cls), JSON.stringify(hid));
  check('no console errors (skips)', Q.errors.length === 0, Q.errors.join(' | '));
  await Q.browser.close();

  /* ---- 7. Reduce Motion: the system's, then the app's switch; and the setting off ---- */
  for (const [label, o] of [['the system\'s Reduce Motion', { reducedMotion: 'reduce' }], ['the app\'s Reduce Motion switch', { init: `try { localStorage.setItem('felt.settings', '{"sv":3,"reduceMotion":true}'); } catch (e) { }` }]]) {
    const R = await phone(393, 852, o), r = R.page;
    const s0 = await r.evaluate(() => ({ mode: felt.intro.mode, state: felt.intro.state, cls0: window.__cls0 }));
    await waitState(r, ['done'], 3000);
    const rm = await r.evaluate(() => ({ i: felt.intro, op: getComputedStyle(playRow).opacity, cls: document.documentElement.className, shown: getComputedStyle(introArt).display !== 'none' }));
    const took = rm.i.endAt - rm.i.t0;
    check(`${label}: no scene, the cards fade in under the wordmark in under 300 ms (a ${rm.i.fadeMs} ms fade, the app's switch cutting every transition; done ${Math.round(took)} ms after boot here)`, /introFade/.test(s0.cls0 || '') && s0.mode === 'fade' && rm.i.frames === 0 && !rm.shown && rm.i.fadeMs < 300 && rm.op === '1' && !rm.cls.split(' ').includes('intro'),
      JSON.stringify({ s0, took, fade: rm.i.fadeMs, frames: rm.i.frames, cls: rm.cls }));
    await R.browser.close();
  }
  const O = await phone(393, 852, { init: `try { localStorage.setItem('felt.settings', '{"sv":3,"intro":false}'); } catch (e) { }` }), o = O.page;
  await o.waitForTimeout(400);
  const off = await o.evaluate(() => ({ i: felt.intro, cls0: window.__cls0, cls: document.documentElement.className, op: getComputedStyle(playRow).opacity, set: settings.intro }));
  check('the setting off: no opening at all, not even its first frame (the home from the first paint)', off.set === false && off.i.why === 'off' && off.i.frames === 0 && off.i.mode === null && !/\bintro\b/.test(off.cls0 || '') && !/\bintro\b/.test(off.cls), JSON.stringify(off));
  await O.browser.close();

  /* ---- 8. layout, upright and on its side, with iOS insets; and the first frame on its side ---- */
  for (const [w, h] of [[393, 852], [430, 932], [440, 956], [375, 667], [852, 393], [932, 430]]) {
    const L = await phone(w, h, { deviceScaleFactor: 2 }), l = L.page;
    await waitState(l, ['play']);
    const lay = await l.evaluate(() => {
      felt.introSeek(0);
      const home = menuTitle.getBoundingClientRect(), cv = introArt.getBoundingClientRect(), ps = getComputedStyle(document.documentElement);
      const ins = ['--sat', '--sar', '--sab', '--sal'].map(k => parseFloat(ps.getPropertyValue(k)) || 0);
      felt.introSeek(felt.intro.timeline.out - 20);
      const land = menuTitle.getBoundingClientRect(), x = introArt.getContext('2d'), d = x.getImageData(0, 0, introArt.width, introArt.height).data;
      let s = 0, s2 = 0, n = 0;
      for (let i = 0; i < d.length; i += 4 * 97) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; s += v; s2 += v * v; n++; }
      felt.introSeek(felt.intro.end - 1);
      const last = menuTitle.getBoundingClientRect();
      felt.introSeek(1200);
      const d2 = introArt.getContext('2d').getImageData(0, 0, introArt.width, introArt.height).data;
      let t = 0, t2 = 0, m = 0;
      for (let i = 0; i < d2.length; i += 4 * 97) { const v = (d2[i] + d2[i + 1] + d2[i + 2]) / 3; t += v; t2 += v * v; m++; }
      const r = a => [a.left, a.top, a.width, a.height].map(v => +v.toFixed(2));
      return { vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio, ins, home: r(home), cv: r(cv), px: [introArt.width, introArt.height], land: r(land), last: r(last), varLand: s2 / n - (s / n) ** 2, varBreak: t2 / m - (t / m) ** 2 };
    });
    const [sat, sar, sab, sal] = lay.ins, c = lay.land, side = w > h;
    const inside = c[0] >= sal + 8 && c[0] + c[2] <= lay.vw - sar - 8 && c[1] >= sat + 8 && c[1] + c[3] <= lay.vh - sab - 8;
    check(`${w}x${h}${side ? ' on its side' : ''}: the canvas covers the screen at its pixels (${lay.px.join('x')}), the landed wordmark ${c[2].toFixed(0)}x${c[3].toFixed(0)} is centred and whole in the safe area (insets ${lay.ins.join('/')}), the scene not blank, and it ends on the header's wordmark`,
      lay.cv[0] === 0 && lay.cv[1] === 0 && Math.abs(lay.cv[2] - lay.vw) < 0.5 && Math.abs(lay.cv[3] - lay.vh) < 1.5 && lay.px[0] === Math.round(lay.vw * lay.dpr) && Math.abs(lay.px[1] - Math.round(lay.cv[3] * lay.dpr)) <= 1
      && inside && Math.abs(c[0] + c[2] / 2 - lay.vw / 2) < 1 && c[2] > lay.home[2] * 1.5 && lay.varLand > 30 && lay.varBreak > 100 && lay.last.every((v, i) => Math.abs(v - lay.home[i]) < 0.6),
      JSON.stringify(lay));
    check(`${w}x${h}: no console errors`, L.errors.length === 0, L.errors.join(' | '));
    await L.browser.close();
  }
  /* ---- 2. the first frame against the launch image, upright and on its side (the shot taken while
     the opening is still being built, the real first frame; else the timeline's moment 0) ---- */
  for (const [w, h, file] of [[430, 932, 'launch-1290x2796.png'], [932, 430, 'launch-2796x1290.png']]) {
    const S = await phone(w, h), s = S.page;
    const real = await s.evaluate(() => felt.intro.state === 'prep');
    const shot = real ? await s.screenshot() : (await waitState(s, ['play']), await s.evaluate(() => felt.introSeek(0)), await s.screenshot());
    const [A, B] = [await brightBox(s, fs.readFileSync(path.join(__dirname, '..', 'icons', 'launch', file)).toString('base64')), await brightBox(s, shot.toString('base64'))];
    check(`${w}x${h}: its first frame is the launch image (${file}): the wordmark on the same device pixels (launch ${A.box}, first frame ${B.box}), the same colour behind, the cards not shown${real ? '' : ' (moment 0)'}`,
      A.w === B.w && A.h === B.h && near(A, B) && Math.abs(A.n - B.n) < A.n * 0.08 && B.bg.join() === A.bg.join(), JSON.stringify({ A, B }));
    await S.browser.close();
  }
  /* ---- the player's own game and look: the last game played (its table, its pockets, its solved break)
     on their cloth; the wordmark keeps its contrast over every cloth; the hand-over into the header is
     the home's own pixels ---- */
  const diffPng = (page, a, b) => page.evaluate(async ([a, b]) => {
    const load = async s => { const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + s)).blob()), c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; const g = c.getContext('2d'); g.drawImage(bmp, 0, 0); return g.getImageData(0, 0, c.width, c.height); };
    const P = await load(a), p = P.data, q = (await load(b)).data, w = P.width;
    let s = 0, m = 0, n = 0;
    const box = [1e9, 1e9, -1, -1];
    for (let i = 0; i < p.length; i += 4) for (let j = 0; j < 3; j++) {
      const d = Math.abs(p[i + j] - q[i + j]); s += d; if (d > m) m = d;
      if (d > 24 && (j === 0 || Math.max(...[0, 1, 2].slice(0, j).map(c => Math.abs(p[i + c] - q[i + c]))) <= 24)) { n++; const x = (i / 4) % w, y = Math.floor(i / 4 / w); box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y); }
    }
    /* where it differs (device pixels in the clip), so a failure on a runner names the element */
    return { mean: s / (p.length / 4 * 3), max: m, over: n, box: n ? box : null };
  }, [a.toString('base64'), b.toString('base64')]);
  for (const [cloth, last, table, pockets] of [['green', null, '9', 'regulation'], ['red', '9', '7', 'regulation'], ['blue', 'straight', '9', 'generous']]) {
    const set = JSON.stringify({ sv: 3, cloth, table, pockets, ...(last ? { last } : {}) });
    const K = await phone(430, 932, { deviceScaleFactor: 2, init: `try { localStorage.setItem('felt.settings', ${JSON.stringify(set)}); } catch (e) { }` }), k = K.page;
    await waitState(k, ['play']);
    const r = await k.evaluate(() => {
      const i = felt.intro, a = i.args, kk = heroOn(a);
      let sim;
      try { const H = heroSetup(i.kind), res = simulateShot(H.balls, H.shot); sim = { key: heroKey(i.kind), balls: res.balls.map(b => ({ n: b.n, x: b.x, y: b.y, on: b.on })), potted: res.potted }; } finally { heroOff(kk); }
      felt.introSeek(i.timeline.out - 20);
      const t = menuTitle.getBoundingClientRect(), dp = introArt.width / introArt.clientWidth, op = +introArt.style.opacity;
      const d = introArt.getContext('2d').getImageData(Math.round(t.left * dp), Math.round(t.top * dp), Math.round(t.width * dp), Math.round(t.height * dp)).data;
      const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
      let hi = 0;
      for (let j = 0; j < d.length; j += 4) hi = Math.max(hi, lum([0, 1, 2].map(c => d[j + c] * op + [9, 9, 10][c] * (1 - op))));
      return { kind: i.kind, key: i.key, sim, final: i.final, cloth: settings.cloth, ratio: (lum([245, 245, 247]) + 0.05) / (hi + 0.05), end: i.end };
    });
    check(`${cloth} cloth${last ? `, last game ${last} on the ${table} ft table` : ', no game yet (8-ball, 9 ft)'}: it plays that game's own solved break (${r.key}), the last frame simulateShot's with ${r.sim.potted.length} down`,
      r.kind === (last || '8') && r.cloth === cloth && JSON.stringify(r.sim.balls) === JSON.stringify(r.final) && r.sim.potted.length > 0 && r.sim.key === r.key, JSON.stringify({ kind: r.kind, key: r.key, potted: r.sim.potted }));
    check(`${cloth} cloth: the landed wordmark keeps ${r.ratio.toFixed(1)}:1 over the brightest of the scene behind it (4.5:1 or better)`, r.ratio >= 4.5, JSON.stringify({ ratio: r.ratio }));
    if (cloth === 'green') {
      /* the last moment against the home itself: the same pixels in the header and the cards */
      /* settled: no running animation or transition and two frames painted, so a slow runner shoots the same moment */
      const settle = () => k.evaluate(async () => {
        const t0 = performance.now(), raf = () => new Promise(r => requestAnimationFrame(() => r()));
        while (performance.now() - t0 < 3000 && document.getAnimations().some(a => a.playState === 'running')) await raf();
        await raf(); await raf();
      });
      await k.evaluate(e => felt.introSeek(e - 1), r.end);
      await k.waitForTimeout(80); await settle();
      /* font-proof: what decides how the home's text is drawn (translate, transform, opacity, will-change) is already the
         home's own at the last frame, so no runner's rasteriser can show a jump the next frame (CI's Inter did) */
      const styles = () => k.evaluate(() => [...document.querySelectorAll('#menu .newgame > *, #menu .brand .foot, #menuTitle, #menu, #menu .sheet.home, #introArt')].map(e => {
        const c = getComputedStyle(e); if (c.display === 'none') return (e.id || e.className) + '|none'; return [e.id || e.className, c.translate, c.transform, c.opacity, c.willChange, c.display, c.overflow, c.position, c.zIndex].join('|');
      }));
      const clip = { x: 0, y: 0, width: 430, height: 420 }, a = await k.screenshot({ clip }), sa = await styles();
      await k.evaluate(() => felt.introEnd());
      await k.waitForTimeout(200); await settle();
      const b = await k.screenshot({ clip }), sb = await styles(), df = await diffPng(k, a, b);
      const sdiff = sa.map((v, i) => v === sb[i] ? null : [v, sb[i]]).filter(Boolean);
      check(`the hand-over has no jump in style: the home's header and sections already carry their own translate, transform, opacity, overflow and stacking at the last frame, and no canvas layer lies under them (${sa.length} elements)`, sa.length > 3 && sdiff.length === 0, JSON.stringify(sdiff.slice(0, 4)));
      check(`the hand-over has no jump: the opening's last frame and the home after it match (mean ${df.mean.toFixed(3)}, max ${df.max} per channel)`, df.mean < 0.5 && df.max <= 24, JSON.stringify(df));
    }
    check(`${cloth}: no console errors`, K.errors.length === 0, K.errors.join(' | '));
    await K.browser.close();
  }
  done();
})().catch(e => { console.error(e); process.exit(1); });
