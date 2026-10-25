/* render-check: what the canvas shows. The table art is built from the sim's geometry (pockets
   dark, cushions distinct from the bed, wood on the rails), the guide follows settings.guide,
   a pot ends in the tray, portrait draws the same table turned, the illegal ring keeps its
   contrast on the brightest cloth, and a frame stays cheap. Pixels are read in the same task
   as a draw() so no animation frame can slip in between. */
'use strict';
const { check, done, open } = require('./lib.cjs');

/* in-page helpers: draw now, then read device pixels at CSS points */
const HELPERS = () => {
  window.__px = pts => {
    draw(performance.now());
    const c = table.getContext('2d');
    return pts.map(([x, y]) => Array.from(c.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data));
  };
  window.__lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
};

async function tableChecks(page, tag) {
  const r = await page.evaluate(() => {
    const at = (x, y) => toScreen(x, y);
    const poly = CUSHION_POLYS[0], cx = poly.reduce((a, p) => a + p[0], 0) / poly.length, cy = poly.reduce((a, p) => a + p[1], 0) / poly.length;
    const pts = [at(TL / 2, TW / 2), ...POCKETS.map(p => at(p[0], p[1])), at(cx, cy), at(cx, cy + 0.12), at(TL * 0.3, -RAIL * 0.8)];
    const px = __px(pts);
    return { mid: px[0], pockets: px.slice(1, 7), cush: px[7], bed: px[8], wood: px[9] };
  });
  check(`${tag}: the bed is cloth green`, r.mid[1] > r.mid[0] + 20 && r.mid[1] > r.mid[2], JSON.stringify(r.mid));
  check(`${tag}: all six pockets are dark holes`, r.pockets.every(c => c[0] + c[1] + c[2] < 60), JSON.stringify(r.pockets));
  const dc = Math.abs(r.cush[0] - r.bed[0]) + Math.abs(r.cush[1] - r.bed[1]) + Math.abs(r.cush[2] - r.bed[2]);
  check(`${tag}: a cushion is painted apart from the bed`, dc >= 6, JSON.stringify({ cush: r.cush, bed: r.bed }));
  check(`${tag}: the rail is wood`, r.wood[0] > r.wood[1] + 15 && r.wood[1] >= r.wood[2], JSON.stringify(r.wood));
}

(async () => {
  const { browser, page, errors } = await open();
  await page.evaluate(HELPERS);
  await page.evaluate(() => { felt.start('8'); });
  await page.waitForTimeout(150);
  await tableChecks(page, 'landscape');

  /* aim at a lone object ball: the guide draws in 'full', less in 'short', nothing in 'off' */
  const g = await page.evaluate(() => {
    game.breakShot = false; game.inHand = null;
    for (const b of game.balls) if (b.n > 1) b.on = false;
    Object.assign(game.balls.find(b => b.n === 1), { x: 1.9, y: 0.45, on: true });
    Object.assign(game.balls.find(b => b.n === 0), { x: 1.2, y: 0.62, on: true });
    state = 'aim'; pull = null; stroke = null;
    const c = game.balls[0], t = game.balls.find(b => b.n === 1), P = POCKET_AIM[2];
    const ux = P[0] - t.x, uy = P[1] - t.y, L = Math.hypot(ux, uy);
    aimAngle = Math.atan2(t.y - uy / L * 2 * BALL_R - c.y, t.x - ux / L * 2 * BALL_R - c.x);
    /* a point on the object ball's line, well past a short stub, and one on the aim line */
    const far = toScreen(t.x + ux / L * 0.4, t.y + uy / L * 0.4), aim = toScreen((c.x + t.x - ux / L * 2 * BALL_R) / 2, (c.y + t.y - uy / L * 2 * BALL_R) / 2);
    /* the brightest pixel across a thin line: sample a few CSS px either side of each point */
    const across = q => { const o = []; for (let d = -3; d <= 3; d += 0.5) o.push([q[0] + d, q[1]], [q[0], q[1] + d]); return o; };
    const peak = px => px.reduce((a, c) => c[0] + c[1] + c[2] > a[0] + a[1] + a[2] ? c : a);
    const out = {};
    for (const m of ['full', 'short', 'off']) { settings.guide = m; out[m] = [peak(__px(across(far))), peak(__px(across(aim)))]; }
    settings.guide = 'full';
    return out;
  });
  const bright = c => c[0] + c[1] + c[2];
  check('guide full: the object ball line runs out toward the pocket', bright(g.full[0]) > bright(g.off[0]) + 120, JSON.stringify(g));
  check('guide short: only stubs, the long line is gone', bright(g.short[0]) < bright(g.full[0]) - 120);
  check('guide off: no aim line', bright(g.off[1]) < bright(g.full[1]) - 30, JSON.stringify([g.full[1], g.off[1]]));

  /* the illegal-target ring against the brightest cloth the table paints */
  const contrast = await page.evaluate(() => {
    for (const b of game.balls) b.on = false;
    state = 'over';
    let best = 0;
    for (let i = 1; i < 10; i++) for (let j = 1; j < 6; j++) {
      const [c] = __px([toScreen(TL * i / 10, TW * j / 6)]);
      best = Math.max(best, __lum(c));
    }
    return (__lum([255, 165, 151]) + 0.05) / (best + 0.05);
  });
  check('illegal ring #ffa597 keeps 3:1 on the brightest cloth', contrast >= 3, contrast.toFixed(2));

  /* a pot: the ball sinks into its pocket and lands in the tray */
  const tray = await page.evaluate(async () => {
    for (const o of game.balls) o.on = o.n !== 1;
    trayList = [];
    const T = trayBox, x = T.x + T.pad + T.r, y = T.y + T.h / 2;
    onPot(1, 2, [POCKETS[2][0] - 0.05, POCKETS[2][1] + 0.05], performance.now());
    const before = __px([[x, y]])[0];
    const mid = __px([toScreen(POCKETS[2][0], POCKETS[2][1])])[0];
    await new Promise(r => setTimeout(r, 1300));
    return { before, mid, after: __px([[x, y]])[0] };
  });
  check('a potted ball rolls into the tray', bright(tray.after) > bright(tray.before) + 150, JSON.stringify(tray));

  /* frame cost: 16 balls, the guide and the cue, at this viewport and dpr */
  const ms = await page.evaluate(() => {
    felt.start('8'); game = placeCue(game, HEAD_X - 0.1, TW / 2 + 0.1); state = 'aim'; game.inHand = null;
    const c = table.getContext('2d'), N = 120;
    draw(performance.now()); c.getImageData(0, 0, 1, 1);
    const t0 = performance.now();
    for (let i = 0; i < N; i++) draw(performance.now());
    c.getImageData(0, 0, 1, 1);
    return (performance.now() - t0) / N;
  });
  check('a frame with 16 balls, guide and cue draws in under 12 ms (headless, software)', ms < 12, ms.toFixed(2) + ' ms');
  check('no console errors', errors.length === 0, errors.join(' | '));
  await browser.close();

  /* portrait phone: the same table, turned */
  const p = await open('', { viewport: { width: 390, height: 844 }, hasTouch: true });
  await p.page.evaluate(HELPERS);
  await p.page.evaluate(() => { felt.start('9'); });
  await p.page.waitForTimeout(150);
  check('portrait: the table is turned', await p.page.evaluate(() => view.portrait));
  await tableChecks(p.page, 'portrait');
  check('portrait: no console errors', p.errors.length === 0, p.errors.join(' | '));
  await p.browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
