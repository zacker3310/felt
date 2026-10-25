/* render-check: what the canvas shows. The table art is built from the sim's geometry (pockets
   dark, cushions distinct from the bed, wood on the rails), the guide follows settings.guide,
   the guide's paths are the physics (they match a real roll, never touch game or tab, and stay
   inside their per-frame budget), its ring calls kitchen fouls, a pot ends in the tray, the tray
   sits in view.tray clear of the table, a scratch never shows two cue balls, portrait draws the
   same table turned, the illegal ring and the 8's rim keep their contrast, and a frame stays
   cheap. Pixels are read in the same task as a draw() so no animation frame can slip in
   between. */
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

  /* aim at a lone object ball: the guide draws in 'full', less in 'short', nothing in 'off'. A few
     frames first, so the preview has finished its paths. */
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
    for (const m of ['full', 'short', 'off']) { settings.guide = m; for (let i = 0; i < 30; i++) draw(performance.now()); out[m] = [peak(__px(across(far))), peak(__px(across(aim)))]; }
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

  /* the guide's paths are the physics: run the preview to the end, then roll the same shot on
     every ball with strike/stepTable (what simulateShot does) and compare the cue ball where it
     has travelled as far past first contact as the preview's path. Two far balls are on the
     table so the preview's ball filter is exercised. */
  const acc = await page.evaluate(() => {
    felt.start('8'); game.breakShot = false; game.inHand = null; state = 'aim'; pull = null; stroke = null; settings.guide = 'full';
    const out = [];
    /* a medium shot: 2 m/s, so the cue ball is rolling by the time it reaches the object ball 0.6 m on */
    const M = powerFor(1.97);
    for (const [cut, sy, pw, side] of [[15, 0, M, 0], [15, 1, M, 0], [30, 0, M, 0], [30, -1, M, 0], [45, -1, M, 0], [45, 0.6, 0.3, 0], [0, 0, M, 1], [30, 0, 0.8, 0]]) {
      for (const b of game.balls) b.on = [0, 1, 6, 14].includes(b.n);
      Object.assign(game.balls[0], { x: 1.0, y: 0.6 }); Object.assign(game.balls.find(b => b.n === 1), { x: 1.6, y: 0.6 });
      Object.assign(game.balls.find(b => b.n === 6), { x: 0.3, y: 1.1 }); Object.assign(game.balls.find(b => b.n === 14), { x: 2.3, y: 1.15 });
      const a = -cut * Math.PI / 180, o = game.balls.find(b => b.n === 1), c = game.balls[0];
      aimAngle = Math.atan2(o.y - Math.sin(a) * 2 * BALL_R - c.y, o.x - Math.cos(a) * 2 * BALL_R - c.x);
      cueSpin = { x: side, y: sy }; markPower = pw; preview = null;
      for (let i = 0; i < 400 && !(preview && preview.done); i++) draw(performance.now());
      const P = preview, len = P.cue.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - P.cue[i][0], q[1] - P.cue[i][1]), 0);
      const t = strike(newTable(game.balls), aimAngle, pw, cueSpin), cue = t.balls[0], ob = t.balls.find(b => b.n === 1);
      let run = 0, last = null, at = null, odir = null;
      while (stepTable(t) && !at) {
        if (t.first === null) continue;
        if (last) run += Math.hypot(cue.x - last[0], cue.y - last[1]);
        last = [cue.x, cue.y];
        if (odir === null && Math.hypot(ob.vx, ob.vy) > 0) odir = Math.atan2(ob.vy, ob.vx);
        if (run >= len - 1e-9) at = [cue.x, cue.y];
      }
      const e = P.cue[P.cue.length - 1], s0 = P.cue[0], q = P.obj[1];   /* its first few cm: the last point may be a pocket's centre */
      out.push({ cut, sy, pw, side, len: +len.toFixed(3), err: at ? Math.hypot(at[0] - e[0], at[1] - e[1]) : 1,
        leave: Math.abs(Math.atan2(Math.sin(Math.atan2(e[1] - s0[1], e[0] - s0[0]) - aimAngle), Math.cos(Math.atan2(e[1] - s0[1], e[0] - s0[0]) - aimAngle))) * 180 / Math.PI,
        objErr: Math.abs(Math.atan2(q[1] - P.obj[0][1], q[0] - P.obj[0][0]) - odir) * 180 / Math.PI, geomObj: Math.abs(odir - a) * 180 / Math.PI });
    }
    return { out };
  });
  const fmt = o => o.map(r => `${r.cut}deg ${r.sy}/${r.side} p${r.pw.toFixed(2)}: ${(r.err * 100).toFixed(2)} cm over ${r.len} m`).join('; ');
  check('preview: the cue ball path ends within 3 cm of the real roll at the same travel, cuts with centre, follow, draw and side', acc.out.every(r => r.err < 0.03 && r.len > 0.1), fmt(acc.out));
  const straight = await page.evaluate(() => {
    for (const b of game.balls) b.on = [0, 1].includes(b.n);
    Object.assign(game.balls[0], { x: 1.0, y: 0.6 }); Object.assign(game.balls.find(b => b.n === 1), { x: 1.6, y: 0.6 });
    aimAngle = 0; markPower = powerFor(1.2); preview = null;
    const out = {};
    /* draw needs pace to survive 0.6 m of cloth */
    for (const [k, sy, v] of [['follow', 1, 1.2], ['draw', -1, 3]]) {
      cueSpin = { x: 0, y: sy }; markPower = powerFor(v); preview = null;
      for (let i = 0; i < 2000 && !(preview && preview.done); i++) draw(performance.now());
      const P = preview;
      out[k] = { len: P.cue.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - P.cue[i][0], q[1] - P.cue[i][1]), 0), stop: P.cueStop, done: P.done };
    }
    return out;
  });
  check('preview: a straight follow or draw shot shows the cue ball running on, not a stop at contact', straight.follow.len > 0.1 && straight.draw.len > 0.1, JSON.stringify(straight));
  check('preview: the object ball leaves within 0.5 deg of the real roll', acc.out.every(r => r.objErr < 0.5), acc.out.map(r => r.objErr.toFixed(3)).join(','));
  const c15 = acc.out[0], side = acc.out.find(r => r.side);
  check('preview: 15 deg cut, centre, 0.6 m at 2 m/s follows (leaves under 45 deg off the aim, not along the 75 deg tangent)', c15.leave < 45, c15.leave.toFixed(1) + ' deg');
  check('preview: full side on a straight shot shows the object ball thrown off the aim line, as it plays', side.geomObj > 5 && side.objErr < 0.5, JSON.stringify(side));

  /* the preview reads game and never writes it, nor tab */
  const pure = await page.evaluate(() => {
    felt.start('8'); game = placeCue(game, HEAD_X - 0.2, TW / 2 + 0.05); game.inHand = null; game.breakShot = false; state = 'aim';
    const g0 = JSON.stringify(game), t0 = tab;
    for (let i = 0; i < 60; i++) { aimAngle = -0.3 + i * 0.01; cueSpin = { x: (i % 3 - 1) * 0.5, y: (i % 5 - 2) * 0.4 }; markPower = 0.2 + (i % 4) * 0.25; draw(performance.now()); }
    return JSON.stringify(game) === g0 && tab === t0;
  });
  check('preview: never mutates game or tab', pure);

  /* cost: the aim changes every frame, over a full rack and over a spread table. The preview
     runs at most PV_BUDGET ms a frame and carries on next frame, so the paths finish when the
     aim rests. */
  const cost = await page.evaluate(() => {
    const run = (n, f) => { for (let i = 0; i < n; i++) { f(i); draw(performance.now()); } };
    felt.start('8'); game = placeCue(game, HEAD_X - 0.1, TW / 2 + 0.1); game.inHand = null; game.breakShot = false; state = 'aim';
    previewMs.length = 0;
    for (const p of [0.15, 0.55, 1]) run(60, i => { markPower = p; aimAngle = -0.15 + i * 0.005; });
    game.balls.forEach((b, i) => { if (b.n) Object.assign(b, { x: 0.3 + (i % 5) * 0.45, y: 0.2 + Math.floor(i / 5) * 0.28 }); });
    Object.assign(game.balls[0], { x: 1.2, y: 0.62 });
    for (const p of [0.15, 0.55, 1]) run(80, i => { markPower = p; aimAngle = i * 0.0785; });
    const s = previewMs.slice().sort((a, b) => a - b);
    let frames = 0;
    preview = null; aimAngle = 0.3; markPower = 0.55;
    do { draw(performance.now()); frames++; } while (!preview.done && frames < 60);
    return { mean: s.reduce((a, b) => a + b, 0) / s.length, p90: s[Math.floor(s.length * 0.9)], frames };
  });
  check('preview: under 2 ms a frame with the aim changing every frame (mean, headless)', cost.mean < 2, `mean ${cost.mean.toFixed(2)} ms, p90 ${cost.p90.toFixed(2)} ms`);
  check('preview: a resting aim finishes its paths within a few frames', cost.frames <= 10, cost.frames + ' frames');

  /* the ghost ring tells a legal first contact from a foul. Ball in hand in the kitchen: a ball
     behind the head string is a foul (the cue ball has not crossed the line), one past it is not */
  const ringRed = await page.evaluate(() => {
    felt.start('8'); game.breakShot = false; settings.guide = 'full';
    for (const b of game.balls) b.on = b.n === 0 || b.n === 3 || b.n === 5;
    Object.assign(game.balls.find(b => b.n === 3), { x: 0.42, y: 0.4 }); Object.assign(game.balls.find(b => b.n === 5), { x: 1.4, y: 0.95 });
    game = placeCue(game, 0.2, 0.7); game.inHand = 'kitchen'; state = 'aim'; placeAt = null; cueSpin = { x: 0, y: 0 }; markPower = 0.5;
    const red = n => {
      const c = game.balls[0], t = game.balls.find(b => b.n === n);
      aimAngle = Math.atan2(t.y - c.y, t.x - c.x);
      const g = [t.x - Math.cos(aimAngle) * 2 * BALL_R, t.y - Math.sin(aimAngle) * 2 * BALL_R], rp = BALL_R * view.k, s = toScreen(g[0], g[1]);
      preview = null;
      for (let i = 0; i < 50 && !(preview && preview.done); i++) draw(performance.now());
      const pts = [];
      /* round the ring, away from the object ball it touches and the lines that leave it */
      for (let k = 6; k < 19; k++) { const a = aimAngle + k * Math.PI / 12; pts.push([s[0] + Math.cos(a) * rp, s[1] + Math.sin(a) * rp]); }
      return Math.max(...__px(pts).map(c => c[0] - c[1]));
    };
    return { behind: red(3), past: red(5) };
  });
  check('kitchen: aiming at a ball behind the head string shows the illegal ring', ringRed.behind > 60, JSON.stringify(ringRed));
  check('kitchen: aiming at a ball past the head string shows a white ring', ringRed.past < 30, JSON.stringify(ringRed));

  /* a scratch: no ball-in-hand ghost while the cue ball is still dropping, so never two cue balls */
  const scratch = await page.evaluate(() => {
    felt.start('8'); game.breakShot = false;
    for (const b of game.balls) b.on = b.n === 5;
    Object.assign(game.balls.find(b => b.n === 5), { x: 2.0, y: 0.9 });
    game.balls[0].on = false; game.inHand = 'table'; state = 'place'; placeAt = [1.0, 0.5];
    const s = toScreen(1.0, 0.5), rp = BALL_R * view.k, now = performance.now();
    /* round the ball, clear of its red dot */
    const ring = () => Math.max(...__px([0, 1, 2, 3, 4, 5].map(k => [s[0] + Math.cos(k) * rp * 0.6, s[1] + Math.sin(k) * rp * 0.6])).map(__lum));
    onPot(0, 0, [0.05, 0.05], now);
    draw(now + 10);
    const during = ring();
    pots = pots.filter(p => p.n !== 0);
    draw(now + 10);
    return { during, after: ring() };
  });
  check('scratch: the ball-in-hand ghost waits for the cue ball to finish dropping', scratch.during < 0.15 && scratch.after > 0.5, JSON.stringify(scratch));

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

  /* the tray goes in view.tray, layout()'s band outside the table, with readable balls. Checked
     on the band layout() sets when it sets one, and on a band given here either way. */
  const tr = await p.page.evaluate(() => {
    const t = felt.tableRect(), cut = (a, b) => a.x < b.right && a.x + a.w > b.left && a.y < b.bottom && a.y + a.h > b.top;
    const own = view.tray ? { inside: true, clear: !cut(trayBox, t) } : null;
    view.tray = { x: t.left + 10, y: t.bottom + 4, w: t.right - t.left - 20, h: 26 };
    tableImg = drawTableImage();
    const T = trayBox, V = view.tray;
    const inside = T.x >= V.x - 0.5 && T.y >= V.y - 0.5 && T.x + T.w <= V.x + V.w + 0.5 && T.y + T.h <= V.y + V.h + 0.5;
    return { own, inside, clear: !cut(T, t), across: 2 * T.r, fits: T.pad * 2 + 15 * T.step - 2 <= T.w + 0.5 };
  });
  check('tray: inside view.tray, clear of the table, 15 balls fit', tr.inside && tr.clear && tr.fits && (!tr.own || tr.own.clear), JSON.stringify(tr));
  check('tray: balls at least 16 px across on a phone', tr.across >= 16, tr.across.toFixed(1) + ' px');

  /* the 8 in the tray: its light rim against the tray, and the rim colour on the brightest cloth */
  const eight = await p.page.evaluate(() => {
    for (const b of game.balls) b.on = b.n !== 8;
    game.shots = 1; trayList = [{ n: 8, t: 0 }];
    const T = trayBox, x = T.x + T.pad + T.r, y = T.y + T.h / 2, pts = [], out = [];
    for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; pts.push([x + Math.cos(a) * (T.r - 0.6), y + Math.sin(a) * (T.r - 0.6)]); out.push([x + Math.cos(a) * (T.r + 2.5), y + Math.sin(a) * (T.r + 2.5)]); }
    const px = __px([...pts, ...out]), rim = Math.max(...px.slice(0, 16).map(__lum)), bg = Math.max(...px.slice(16).map(__lum));
    let cloth = 0;
    for (const b of game.balls) b.on = false;
    state = 'over';
    for (let i = 1; i < 10; i++) for (let j = 1; j < 6; j++) cloth = Math.max(cloth, __lum(__px([toScreen(TL * i / 10, TW * j / 6)])[0]));
    return { tray: (rim + 0.05) / (bg + 0.05), cloth: (__lum([196, 196, 196]) + 0.05) / (cloth + 0.05) };
  });
  check('the 8 reads: its rim keeps 3:1 on the tray and on the brightest cloth', eight.tray >= 3 && eight.cloth >= 3, JSON.stringify(eight));
  check('portrait: no console errors', p.errors.length === 0, p.errors.join(' | '));
  await p.browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
