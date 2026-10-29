/* look-check: the game table's premium look (section 4), on a phone at dpr 3 (393x852). The
   lamp's pool on the bed (luminance falls from the middle toward every rail), the cushions' shade
   and the vignette; each ball's shadow laid off away from the lamp over the middle of the table;
   every look (cloths, rails, ball sets) renders apart; a frame with all 16 balls rolling stays
   inside the budget; the view and the hit-test are untouched (toScreen round-trips, a tap on a
   ball's screen centre aims at it); the ball in hand lifts while carried (its shadow grows) and
   settles with a bounce inside SETTLE_MS when let go, at once under Reduce Motion; the career
   hub's next match card shows the hero's still as its banner and leaves the game's geometry as it
   was. Pixels are read in the same task as the draw() that made them. */
'use strict';
const { check, done, open } = require('./lib.cjs');

const HELPERS = () => {
  window.__lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  /* mean luminance of the device pixels in a small square round CSS point (x, y) of canvas c */
  window.__area = (c, x, y, h = 2) => {
    const d = c.getContext('2d').getImageData(Math.round(x * dpr) - h, Math.round(y * dpr) - h, 2 * h + 1, 2 * h + 1).data;
    let s = 0;
    for (let i = 0; i < d.length; i += 4) s += __lum([d[i], d[i + 1], d[i + 2]]);
    return s / (d.length / 4);
  };
  window.__only = keep => { for (const b of game.balls) b.on = keep.includes(b.n); };
  window.__geo = () => JSON.stringify([TABLE, TL, TW, BALL_R, RAIL, POCKETS, POCKET_R, CUSHION_POLYS.length, view, viewBase]);
};

(async () => {
  const t = await open('', { viewport: { width: 393, height: 852 }, hasTouch: true, deviceScaleFactor: 3 });
  const { page } = t, ev = (f, a) => page.evaluate(f, a);
  await ev(HELPERS);
  await ev(() => felt.start('8'));
  await page.waitForTimeout(200);

  /* ---- the lamp's pool and the vignette: the bed is brightest under the lamp ---- */
  for (const cloth of ['green', 'red', 'blue']) {
    const r = await ev(cl => {
      settings.cloth = cl; __only([]); draw(performance.now());
      const at = (x, y) => { const s = toScreen(x, y); return __area(tableImg, s[0], s[1], 3); }, d = 3 * BALL_R;
      return { mid: at(TL / 2, TW / 2), rails: [at(d, TW / 2), at(TL - d, TW / 2), at(TL / 4, d), at(TL * 0.75, TW - d)], corner: at(TL - 2 * d, TW - 2 * d), half: at(TL * 0.3, TW * 0.3) };
    }, cloth);
    check(`${cloth} cloth: the lamp's pool, the bed's luminance falls from the middle toward every rail and most into the corners`,
      r.rails.every(v => v < r.mid * 0.9) && r.half < r.mid && r.corner < Math.min(...r.rails), JSON.stringify(r));
  }
  const vg = await ev(() => {
    settings.cloth = 'green'; __only([]); draw(performance.now());
    const plain = paintTable(table.width, table.height), a = toScreen(-RAIL * 0.5, TW / 2), b = toScreen(TL / 2, TW / 2);
    return { railWith: __area(tableImg, a[0], a[1]), railPlain: __area(plain, a[0], a[1]), midWith: __area(tableImg, b[0], b[1]), midPlain: __area(plain, b[0], b[1]) };
  });
  check('the vignette darkens the rails and leaves the middle of the bed as it was', vg.railWith < vg.railPlain * 0.97 && Math.abs(vg.midWith - vg.midPlain) < 1e-6, JSON.stringify(vg));

  /* ---- shadows: away from the lamp over the middle of the table ---- */
  const sh = await ev(() => {
    const out = [];
    for (const [fx, fy] of [[0.8, 0.78], [0.2, 0.25], [0.7, 0.3]]) {
      felt.start('8'); __only([1]); state = 'aim'; game.inHand = null;
      const o = game.balls.find(b => b.n === 1);
      Object.assign(o, { x: TL * fx, y: TW * fy });
      const dx = o.x - TL / 2, dy = o.y - TW / 2, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, k = 1.35 * BALL_R;
      const pt = s => { const p = toScreen(o.x + s * ux * k, o.y + s * uy * k); return __area(table, p[0], p[1], 2); };
      draw(performance.now());
      const away = pt(1), toward = pt(-1);
      o.on = false; draw(performance.now());
      out.push({ away, toward, baseAway: pt(1), baseToward: pt(-1) });
    }
    return out;
  });
  check('a ball\'s shadow falls away from the lamp over the table\'s middle: darker on the far side than the near, wherever the ball lies',
    sh.every(s => s.away < s.baseAway * 0.85 && s.away < s.toward && (s.baseToward - s.toward) < (s.baseAway - s.away)), JSON.stringify(sh));

  /* ---- every look renders apart ---- */
  const looks = await ev(() => {
    noteLookOwn(Object.entries(LOOKS).flatMap(([slot, set]) => Object.keys(set).map(k => slot + '-' + k)));
    const keep = { cloth: settings.cloth, rail: settings.rail, balls: settings.balls }, out = {};
    felt.start('8');
    const hash = () => { draw(performance.now()); const d = table.getContext('2d').getImageData(0, 0, table.width, table.height).data; let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) >>> 0; return h; };
    for (const slot of ['cloth', 'rail', 'balls']) {
      out[slot] = {};
      for (const k of Object.keys(LOOKS[slot])) { settings[slot] = k; out[slot][k] = hash(); }
      settings[slot] = keep[slot];
    }
    hash();
    return out;
  });
  for (const slot of Object.keys(looks)) {
    const v = Object.values(looks[slot]);
    check(`every ${slot} look renders differently (${v.length})`, new Set(v).size === v.length, JSON.stringify(looks[slot]));
  }

  /* ---- the frame budget: all 16 balls rolling, at dpr 3 ---- */
  /* three runs, the best kept: a busy runner's stray slow frames are not the page's cost */
  const fbs = [];
  for (let run = 0; run < 3; run++) fbs.push(await ev(() => {
    felt.start('8'); state = 'aim'; game.inHand = null;
    let now = performance.now();
    const B = game.balls, v = B.map((b, i) => [Math.cos(i * 2.4) * 1.6, Math.sin(i * 2.4) * 1.6]), ms = [], c = table.getContext('2d');
    B.forEach((b, i) => { b.on = true; b.x = TL * (0.1 + 0.8 * ((i * 0.37) % 1)); b.y = TW * (0.1 + 0.8 * ((i * 0.61) % 1)); });
    draw(now); c.getImageData(0, 0, 1, 1);
    for (let f = 0; f < 120; f++) {
      B.forEach((b, i) => {
        let x = b.x + v[i][0] / 60, y = b.y + v[i][1] / 60;
        if (x < BALL_R || x > TL - BALL_R) { v[i][0] *= -1; x = clamp(x, BALL_R, TL - BALL_R); }
        if (y < BALL_R || y > TW - BALL_R) { v[i][1] *= -1; y = clamp(y, BALL_R, TW - BALL_R); }
        rollBall(b.n, x - b.x, y - b.y); b.x = x; b.y = y;
      });
      const t0 = performance.now();
      draw(now += 16.7); c.getImageData(0, 0, 1, 1);
      ms.push(performance.now() - t0);
    }
    ms.sort((a, b) => a - b);
    return { mean: ms.reduce((a, b) => a + b, 0) / ms.length, p90: ms[Math.floor(ms.length * 0.9)], dpr, w: table.width, h: table.height };
  }));
  const fb = fbs.reduce((a, b) => b.mean < a.mean ? b : a);
  check('a frame with all 16 balls rolling at 393x852 dpr 3 draws in under 12 ms mean and 16.7 ms at the 90th percentile (headless, software, best of 3)',
    fb.mean < 12 && fb.p90 < 16.7 && fb.dpr === 3, JSON.stringify(fbs));
  console.log(`frame time: mean ${fb.mean.toFixed(2)} ms, p90 ${fb.p90.toFixed(2)} ms at ${fb.w}x${fb.h}`);

  /* ---- the view and the hit-test are untouched ---- */
  const rt = await ev(() => {
    let worst = 0;
    for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) {
      const x = TL * i / 10, y = TW * j / 10, s = toScreen(x, y), p = toTable(s[0], s[1]);
      worst = Math.max(worst, Math.hypot(p[0] - x, p[1] - y));
    }
    return worst;
  });
  check('toScreen and toTable round-trip over the whole bed', rt < 1e-9, String(rt));
  const tap = [];
  for (const [fx, fy] of [[0.75, 0.3], [0.3, 0.7]]) {
    const s = await ev(([fx, fy]) => {
      felt.start('8'); __only([0, 1]); game.breakShot = false; game.inHand = null; state = 'aim';
      Object.assign(game.balls[0], { x: TL * 0.5, y: TW * 0.5 }); const o = game.balls.find(b => b.n === 1); Object.assign(o, { x: TL * fx, y: TW * fy });
      aimAngle = 0; draw(performance.now());
      return { s: toScreen(o.x, o.y), want: Math.atan2(o.y - TW * 0.5, o.x - TL * 0.5) };
    }, [fx, fy]);
    await page.touchscreen.tap(s.s[0], s.s[1]);
    await page.waitForTimeout(150);
    const got = await ev(() => aimAngle);
    tap.push({ want: s.want, got, d: Math.abs(Math.atan2(Math.sin(got - s.want), Math.cos(got - s.want))) });
  }
  check('a tap on a ball\'s screen centre aims straight at it (the hit-test as before)', tap.every(x => x.d < 1e-6), JSON.stringify(tap));

  /* ---- the ball in hand: lift while carried, settle on release ---- */
  const lift = rm => ev(rm => {
    settings.reduceMotion = rm;
    felt.start('8'); __only([0, 1]); game.breakShot = false; state = 'aim'; cpuMode = false;
    Object.assign(game.balls.find(b => b.n === 1), { x: TL * 0.75, y: TW * 0.3 });
    Object.assign(game.balls[0], { x: TL * 0.3, y: TW * 0.6 }); game.inHand = 'table';
    let now = performance.now() + 1000;
    const c = game.balls[0], s0 = toScreen(c.x, c.y), ring = () => { let a = 0; for (let k = 0; k < 12; k++) { const q = k * Math.PI / 6; a += __area(table, s0[0] + Math.cos(q) * BALL_R * view.k * 2.1, s0[1] + Math.sin(q) * BALL_R * view.k * 2.1, 1); } return a / 12; };
    draw(now); draw(now += 16);
    const rest = { sr: bih.sr, ring: ring() };
    beginMove('touch'); moveBall([c.x, c.y]);
    draw(now += 16);
    const first = { h: bih.h, sr: bih.sr };
    for (let i = 0; i < 8; i++) draw(now += 16);
    const up = { h: bih.h, sr: bih.sr, ring: ring(), at: placeAt && placeAt.slice(), ball: [c.x, c.y], view: JSON.stringify(view) };
    endMove();
    const hs = [];
    draw(now += 1);
    const settling = !!bih.settle;
    for (let i = 0; i < 12; i++) { draw(now += 16); hs.push(+settleH(now).toFixed(3)); }
    const after = { settle: !!bih.settle, sr: bih.sr, h: bih.h };
    settings.reduceMotion = false;
    return { rest, first, up, settling, hs, after };
  }, rm);
  const L0 = await lift(false);
  check('ball in hand: carried, it rises over a few frames and its shadow grows (reach and the dark round it)',
    L0.first.h > 0 && L0.first.h < 1 && L0.up.h === 1 && L0.up.sr > L0.rest.sr * 1.4 && L0.up.ring < L0.rest.ring, JSON.stringify(L0));
  check('ball in hand: let go, it settles (down, one small bounce) and is still inside 150 ms, its shadow back to rest',
    L0.settling && L0.hs.some((h, i) => i > 0 && i < L0.hs.length - 1 && h < L0.hs[i - 1] && L0.hs[i + 1] > h) && L0.hs.slice(-3).every(h => h === 0) && !L0.after.settle && Math.abs(L0.after.sr - L0.rest.sr) < 1e-6,
    JSON.stringify(L0.hs) + ' ' + JSON.stringify(L0.after));
  const L1 = await lift(true);
  check('ball in hand, Reduce Motion: up at once while carried, down at once on release, no bounce',
    L1.first.h === 1 && !L1.settling && L1.hs.every(h => h === 0) && Math.abs(L1.after.sr - L1.rest.sr) < 1e-6, JSON.stringify(L1));
  check('no console errors on the table', t.errors.length === 0, t.errors.join(' | '));
  await t.browser.close();

  /* ---- the career hub's next match card: the hero's still as its banner ---- */
  const c = await open('', { viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const cv = (f, a) => c.page.evaluate(f, a);
  await cv(HELPERS);
  await cv(() => { felt.start('9'); felt.quitToHome(); Career.create({ name: 'Ada Banner', start: 'pro' }, { seed: 31 }); });
  await cv(() => { if (!Career.nextMatch() && !Career.schedule().length) { const e = Career.availableEvents().find(x => x.eligibility.ok && x.live); if (e) Career.enter(e.id); } });
  let guard = 0;
  while (!(await cv(() => !!Career.nextMatch())) && guard++ < 30) await cv(() => felt.careerAdvance('week'));
  const before = await cv(() => __geo());
  await cv(() => felt.showCareer());
  await c.page.waitForFunction(() => { const b = document.getElementById('cvBanner'); return b && b.classList.contains('on'); }, null, { timeout: 15000 }).catch(() => { });
  const bn = await cv(() => {
    const b = document.getElementById('cvBanner');
    if (!b) return { none: true };
    const d = b.getContext('2d').getImageData(0, 0, b.width, b.height).data, card = cvNext.getBoundingClientRect(), r = b.getBoundingClientRect();
    let lo = 1, hi = 0, mid = 0;
    for (let i = 0; i < d.length; i += 4 * 37) { const l = __lum([d[i], d[i + 1], d[i + 2]]); lo = Math.min(lo, l); hi = Math.max(hi, l); }
    const m = b.width / 2 + b.height * 0.55 * b.width | 0; mid = __lum([d[4 * m], d[4 * m + 1], d[4 * m + 2]]);
    return { on: b.classList.contains('on'), w: b.width, h: b.height, lo, hi, mid, inCard: cvNext.contains(b), wide: Math.abs(r.width - card.width) < 1.5, kind: Career.nextMatch().rules.game, aria: b.getAttribute('aria-hidden') };
  });
  check('career hub: the next match card opens on a banner, the hero\'s still of its table (painted, card-wide, hidden from assistive tech)',
    !bn.none && bn.on && bn.inCard && bn.wide && bn.w > 300 && bn.hi - bn.lo > 0.2 && bn.aria === 'true', JSON.stringify(bn));
  const after = await cv(() => __geo());
  check('career hub: the banner leaves the game\'s table, geometry and view exactly as they were', after === before, before === after ? '' : before.slice(0, 200) + ' | ' + after.slice(0, 200));
  check('career hub: no console errors', c.errors.length === 0, c.errors.join(' | '));
  if (process.env.LOOK_SHOTS) await c.page.locator('#cvNext').screenshot({ path: process.env.LOOK_SHOTS + '/career-card.png' });
  await c.browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
