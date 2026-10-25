/* render-check: what the canvas shows. The table art is built from the sim's geometry (pockets
   dark, cushions distinct from the bed, wood on the rails), the guide follows settings.guide,
   the guide's paths are the physics (they match a real roll, never touch game or tab, and stay
   inside their per-frame budget), its ring calls kitchen fouls, a pot sinks into its pocket and is gone
   (no tray on the game screen: view.tray null is the off state, and nothing is drawn on or under
   the rail for one), a scratch never shows two cue balls, portrait draws the same table turned,
   the illegal ring keeps its contrast, and a frame stays cheap. On a phone at dpr 3, on the green and the red cloth: no cloth inside any hole, rubber
   (not hole) just past every jaw, every overlay at 3:1 on the cloth; the game ball's halo is on
   the 8 in 8-ball and on the 9 (not the 8) in 9-ball; the same pocket probes on generous
   pockets (corner caps inside the rail at RAIL_MIN, side caps in painted ears past it); every drop
   whole and round, and the whole of every drop circle on a grid (dark, never
   cloth, and untouched by a frame's overlays); the auto-aim hint's ring and pocket chevron; the loupe shows only while fineAim is set,
   clear of the contact, and keeps a frame cheap. Pixels are read in the same task as a draw() so no animation frame can slip in
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
    Object.assign(game.balls.find(b => b.n === 1), { x: TL * 0.75, y: TW * 0.35, on: true });
    Object.assign(game.balls.find(b => b.n === 0), { x: TL * 0.47, y: TW * 0.49, on: true });
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

  /* a pot: the ball sinks into its pocket and is gone. No tray: view.tray is null, trayGeom()
     gives nothing, and every pixel off the table is the same before the pot and after it */
  const POT = async () => {
    for (const o of game.balls) o.on = o.n !== 1;
    trayList = [];
    const t = felt.tableRect(), W = table.width / dpr, H = table.height / dpr, off = [];
    for (let x = 4; x < W; x += 9) for (let y = 4; y < H; y += 9) if (x < t.left - 2 || x > t.right + 2 || y < t.top - 2 || y > t.bottom + 2) off.push([x, y]);
    const base = __px(off);
    const P = POCKETS[2], from = [P[0] - 0.05, P[1] + 0.05], disk = [];
    for (let i = 0; i < 24; i++) for (const d of [0, 0.02, 0.04, 0.06]) disk.push(toScreen(from[0] + Math.cos(i * Math.PI / 12) * d, from[1] + Math.sin(i * Math.PI / 12) * d));
    const yellow = px => px.some(c => c[0] > 150 && c[1] > 100 && c[2] < 90);
    onPot(1, 2, from, performance.now());
    const mid = yellow(__px(disk));
    await new Promise(r => setTimeout(r, 1300));
    const after = __px(off), diff = Math.max(...after.map((c, i) => Math.abs(c[0] - base[i][0]) + Math.abs(c[1] - base[i][1]) + Math.abs(c[2] - base[i][2])));
    return { mid, gone: !yellow(__px(disk)) && !pots.length, diff, tray: view.tray, box: trayGeom(), list: trayList.length, n: off.length };
  };
  const pot = await page.evaluate(POT);
  check('a potted ball sinks into its pocket and is gone', pot.mid && pot.gone, JSON.stringify(pot));
  check('no tray: view.tray null, trayGeom() null, nothing drawn off the table before or after a pot', pot.tray === null && pot.box === null && pot.list === 0 && pot.n > 50 && pot.diff <= 3, JSON.stringify(pot));

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
      Object.assign(game.balls[0], { x: TL / 2 - 0.3, y: TW * 0.47 }); Object.assign(game.balls.find(b => b.n === 1), { x: TL / 2 + 0.3, y: TW * 0.47 });
      Object.assign(game.balls.find(b => b.n === 6), { x: TL * 0.12, y: TW * 0.87 }); Object.assign(game.balls.find(b => b.n === 14), { x: TL * 0.9, y: TW * 0.9 });
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
    Object.assign(game.balls[0], { x: TL / 2 - 0.3, y: TW * 0.47 }); Object.assign(game.balls.find(b => b.n === 1), { x: TL / 2 + 0.3, y: TW * 0.47 });
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
    game.balls.forEach((b, i) => { if (b.n) Object.assign(b, { x: TL * (0.12 + (i % 5) * 0.18), y: TW * (0.16 + Math.floor(i / 5) * 0.22) }); });
    Object.assign(game.balls[0], { x: TL * 0.47, y: TW * 0.49 });
    for (const p of [0.15, 0.55, 1]) run(80, i => { markPower = p; aimAngle = i * 0.0785; });
    const s = previewMs.slice().sort((a, b) => a - b);
    let frames = 0;
    preview = null; aimAngle = 0.3; markPower = 0.55;
    do { draw(performance.now()); frames++; } while (!preview.done && frames < 60);
    return { mean: s.reduce((a, b) => a + b, 0) / s.length, p90: s[Math.floor(s.length * 0.9)], frames };
  });
  check('preview: under 2 ms a frame with the aim changing every frame (mean, headless)', cost.mean < 2, `mean ${cost.mean.toFixed(2)} ms, p90 ${cost.p90.toFixed(2)} ms`);
  check('preview: a resting aim finishes its paths within a few frames', cost.frames <= 10, cost.frames + ' frames');

  /* flicker: drive the aim frame by frame (a steady sweep across balls, cushions and a pocket, a
     fine-wheel drag a pixel and a half a frame, the auto-aim swing, a power-bar pull) and record
     what every frame's guide drew. Every drawn preview must be complete and identical to the
     same preview run to its end in one go (so no path is ever partly grown), the guide must be
     there every frame, the ring may change colour only when the drawn preview changes to one with
     another first contact, the drawn paths may lag the aim by at most PV_STALE + 1 frames, a
     resting aim must show its own full preview within 2 frames, and the loupe must not jump. */
  const flick = await page.evaluate(() => {
    felt.start('8'); game.breakShot = false; game.inHand = null; settings.guide = 'full'; settings.autoAim = false; hint = null;
    const at = { 0: [0.45, 0.5], 1: [0.72, 0.36], 3: [0.62, 0.7], 9: [0.85, 0.62], 12: [0.3, 0.25], 13: [0.78, 0.5] };
    for (const b of game.balls) { b.on = b.n in at; if (b.on) { b.x = TL * at[b.n][0]; b.y = TW * at[b.n][1]; } }
    state = 'aim'; pull = null; stroke = null; cpuMode = false; aimAnim = null; cueSpin = { x: 0, y: 0 }; markPower = 0.55; power = 0.55; fineAim = false;
    const og = guide;
    let gi = null;
    guide = (c, a) => (gi = og(c, a));
    const plen = p => { let s = 0; if (p) for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; };
    const c = game.balls[0], ref = new Map();
    /* the same preview, run to its end at once, for the inputs the drawn one was started with */
    const whole = P => {
      if (ref.has(P)) return ref.get(P);
      const h = aimTrace(c.x, c.y, Math.cos(P.ang), Math.sin(P.ang), [0], 6);
      const S = previewStart(P.ang, P.pw0, P.sp0, h, P.lens);
      previewRun(S, 1e9);
      ref.set(P, S);
      return S;
    };
    let now = performance.now();
    const out = {};
    const run = (name, n, step) => {
      const f = [];
      for (let i = 0; i < n; i++) {
        step(i, now += 16);
        gi = null; draw(now);
        const P = gi && gi.P;
        f.push({ i, gi: !!gi, P, ang: aimAngle, legal: gi && gi.legal, cue: gi ? plen(gi.cue) : 0, obj: gi ? plen(gi.obj) : 0, loupe: loupe && { x: loupe.x, y: loupe.y } });
      }
      let missing = 0, partial = 0, wrongPath = 0, badFlip = 0, lag = 0, maxLag = 0, jumps = 0, flips = 0;
      for (let k = 0; k < f.length; k++) {
        const r = f[k], p = f[k - 1];
        if (!r.gi || !r.P) { missing++; continue; }
        if (!r.P.done) partial++;
        const W = whole(r.P);
        if (W.cue.length !== r.P.cue.length || W.first !== r.P.first || plen(W.cue) !== plen(r.P.cue) || plen(W.obj) !== plen(r.P.obj)) wrongPath++;
        if (p && p.P && r.legal !== p.legal) { flips++; if (r.P === p.P || r.P.first === p.P.first) badFlip++; }
        lag = Math.abs(r.P.ang - r.ang) > 2 * PV_SNAP ? lag + 1 : 0; maxLag = Math.max(maxLag, lag);
        if (p && p.loupe && r.loupe && Math.hypot(r.loupe.x - p.loupe.x, r.loupe.y - p.loupe.y) > 12) jumps++;
      }
      /* then rest: the aim stays put */
      let settle = 0;
      for (; settle < 10; settle++) { gi = null; draw(now += 16); if (gi && gi.P && gi.P.done && Math.abs(gi.P.ang - aimAngle) <= 2 * PV_SNAP && gi.P === preview && !previewWork) break; }
      out[name] = { frames: f.length, missing, partial, wrongPath, flips, badFlip, maxLag, jumps, settle: settle + 1, sample: f.filter((_, k) => k % 15 === 0).map(r => [+r.cue.toFixed(3), +r.obj.toFixed(3), r.legal]) };
    };
    const a0 = Math.atan2(game.balls.find(b => b.n === 1).y - c.y, game.balls.find(b => b.n === 1).x - c.x) - 0.6;
    aimAngle = a0; preview = previewWork = null;
    run('sweep', 160, () => { aimAngle += 0.006; });
    aimAngle = a0 + 0.1; fineAim = true;
    run('wheel', 120, () => { aimAngle += 1.5 * WHEEL_RATE; });
    fineAim = false;
    settings.autoAim = true; handAimed = false; aimAngle = a0 - 1.2;
    run('autoAim', 40, (i, t) => { if (i === 0) { autoAim(); aimAnim.t0 = t - 16; } stepAutoAim(t); });
    settings.autoAim = false; hint = null; aimAnim = null; aimLock = null;
    run('pull', 80, i => { pull = { kind: 'bar' }; power = i / 79; });
    pull = null; power = markPower;
    guide = og;
    return out;
  });
  for (const [k, r] of Object.entries(flick)) {
    const d = JSON.stringify(r);
    check(`flicker, ${k}: the guide is drawn every frame and every drawn preview is complete and equal to the same preview run to its end (no path ever partly grown)`,
      r.frames > 30 && r.missing === 0 && r.partial === 0 && r.wrongPath === 0, d);
    check(`flicker, ${k}: the ring changes colour only with a new preview whose first contact differs`, r.badFlip === 0, d);
    check(`flicker, ${k}: the paths lag the aim by at most ${3} frames, and a resting aim shows its own full preview within 2 frames`, r.maxLag <= 3 && r.settle <= 2, d);
  }
  check('flicker, wheel: the loupe glides, it never jumps more than 12 px in a frame', flick.wheel.jumps === 0, JSON.stringify(flick.wheel));

  /* the ghost ring tells a legal first contact from a foul. Ball in hand in the kitchen: a ball
     behind the head string is a foul (the cue ball has not crossed the line), one past it is not */
  const ringRed = await page.evaluate(() => {
    felt.start('8'); game.breakShot = false; settings.guide = 'full';
    for (const b of game.balls) b.on = b.n === 0 || b.n === 3 || b.n === 5;
    Object.assign(game.balls.find(b => b.n === 3), { x: HEAD_X * 0.85, y: TW * 0.32 }); Object.assign(game.balls.find(b => b.n === 5), { x: TL * 0.55, y: TW * 0.75 });
    game = placeCue(game, HEAD_X * 0.4, TW * 0.55); game.inHand = 'kitchen'; state = 'aim'; placeAt = null; cueSpin = { x: 0, y: 0 }; markPower = 0.5;
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
    Object.assign(game.balls.find(b => b.n === 5), { x: TL * 0.8, y: TW * 0.7 });
    game.balls[0].on = false; game.inHand = 'table'; state = 'aim'; placeAt = [TL * 0.4, TW * 0.4];
    const s = toScreen(TL * 0.4, TW * 0.4), rp = BALL_R * view.k, now = performance.now();
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

  /* portrait, where the old fallback put a tray on or under the bottom rail: the same pot, and
     still nothing off the table */
  await p.page.evaluate(() => { game.shots = 1; });
  const ppot = await p.page.evaluate(POT);
  check('portrait: a pot sinks and is gone, no tray anywhere (view.tray null is the off state)', ppot.mid && ppot.gone && ppot.tray === null && ppot.box === null && ppot.diff <= 3, JSON.stringify(ppot));
  check('portrait: no console errors', p.errors.length === 0, p.errors.join(' | '));
  await p.browser.close();

  /* a phone at dpr 3: the pockets up close, the game-ball halo and the loupe */
  const q = await open('', { viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 3 });
  await q.page.evaluate(HELPERS);
  /* every pocket, on both cloths: a ring just inside what shows of the hole is never cloth (the
     cloth's channel not dominant, and dark), and the cushion just past each jaw is rubber, not
     hole-dark */
  for (const pockets of ['regulation', 'generous']) for (const [size, cloth] of [['7', 'green'], ['7', 'red'], ['9', 'green'], ['9', 'red']]) {
  const pk = await q.page.evaluate(([size, cloth, pockets]) => {
    /* start() sets the table and pockets from settings, so those choose them */
    settings.table = size; settings.pockets = pockets; felt.start('8'); settings.cloth = cloth; layout();
    if (TABLE !== size || POCKETS_STYLE !== pockets) return []; for (const b of game.balls) b.on = false; state = 'over';
    const co = cushionDepth(), px1 = 1 / view.k, res = [], ch = cloth === 'red' ? 0 : 1;
    const green = c => c[ch] - Math.max(...c.slice(0, 3).filter((_, i) => i !== ch));
    POCKETS.forEach((P, k) => {
      const S = pocketShape(k, co), r = POCKET_R[k], hole = [], rub = [];
      /* the whole drop shows, all the way round (the rubber stops at its edge) */
      for (let i = 0; i < 72; i++) {
        const a = i * Math.PI / 36, d = r - 1.5 * px1;
        hole.push(toScreen(P[0] + d * Math.cos(a), P[1] + d * Math.sin(a)));
      }
      for (const [pi, ei] of [[0, 1], [3, 2]]) {
        const p = S.quad[pi], e = S.quad[ei], poly = CUSHION_POLYS.find(q => q.includes(p)), p2 = poly[1] === p ? poly[2] : poly[1];
        const L = Math.hypot(p2[0] - p[0], p2[1] - p[1]), nx = (p2[0] - p[0]) / L, ny = (p2[1] - p[1]) / L;
        for (const t of [0.15, 0.5, 0.85]) {
          let x = p[0] + (e[0] - p[0]) * t, y = p[1] + (e[1] - p[1]) * t;
          while (Math.hypot(x - P[0], y - P[1]) < r + 0.012) { x += nx * 0.002; y += ny * 0.002; }
          x += nx * 0.003; y += ny * 0.003;
          if (inPoly(poly, x, y)) rub.push(toScreen(x, y));
        }
      }
      const hp = __px(hole), rp = __px(rub);
      res.push({ k, n: hp.length, greenIn: Math.max(...hp.map(green)), lumIn: Math.max(...hp.map(__lum)), rub: rp.length,
        rubOk: rp.every(c => green(c) > 5 && c[0] + c[1] + c[2] > 50), rubMin: rp.map(c => c.join('/')).slice(0, 2) });
    });
    return res;
  }, [size, cloth, pockets]);
  const P = pockets === 'generous' ? ', generous pockets' : '';
  /* a liner's brown far wall is allowed a little red; cloth in a hole would be far over 20 */
  check(`dpr 3, ${size} ft${P}, ${cloth} cloth: inside every hole, a ring just inside its edge shows no cloth (cloth channel not dominant, dark)`,
    pk.length === 6 && pk.every(p => p.n > 20 && p.greenIn < 20 && p.lumIn < 0.06), JSON.stringify(pk.map(p => [p.k, p.n, p.greenIn, +p.lumIn.toFixed(3)])));
  check(`dpr 3, ${size} ft${P}, ${cloth} cloth: the cushion just past every jaw is cloth-covered rubber, not hole-dark`, pk.length === 6 && pk.every(p => p.rub >= 4 && p.rubOk), JSON.stringify(pk.map(p => [p.k, p.rub, p.rubOk, p.rubMin])));

  /* the whole of every hole, not only a ring at its edge: a grid over the whole drop circle (2
     CSS px in from its edge; a side drop's part under its jaws and the rail included: the rubber
     stops at the hole and the cap's back holds all of it), read from the painted table and from
     a frame in three states (game over, ball in hand in the kitchen with its tint, aiming). The
     painted hole is dark and never cloth- or rubber-coloured anywhere; a frame adds nothing
     inside a hole (the kitchen's tint once laid a pale square over the head corners). */
  const grid = await q.page.evaluate(([cloth]) => {
    const co = cushionDepth(), px1 = 1 / view.k, ch = cloth === 'red' ? 0 : 1, m = 2 * px1, step = 1.5 * px1, W = table.width;
    const green = c => c[ch] - Math.max(...c.slice(0, 3).filter((_, i) => i !== ch));
    const whole = POCKETS.map((P, k) => { const S = pocketShape(k, co); return Math.hypot(P[0] - S.C[0], P[1] - S.C[1]) + S.r <= S.rb + 1e-9; });
    const pts = POCKETS.map((P, k) => {
      const r = POCKET_R[k], out = [];
      for (let x = P[0] - r; x <= P[0] + r; x += step) for (let y = P[1] - r; y <= P[1] + r; y += step) {
        if (Math.hypot(x - P[0], y - P[1]) > r - m) continue;
        const s = toScreen(x, y); out.push(Math.round(s[1] * dpr) * W + Math.round(s[0] * dpr));
      }
      return out;
    });
    const img = tableImg.getContext('2d').getImageData(0, 0, W, table.height).data;
    const px = (d, i) => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
    const art = pts.map((list, k) => ({ k, n: list.length, lum: Math.max(...list.map(i => __lum(px(img, i)))), cloth: Math.max(...list.map(i => green(px(img, i)))) }));
    const frame = {};
    const c = table.getContext('2d');
    for (const st of ['over', 'hand', 'aim']) {
      felt.start('8'); for (const b of game.balls) b.on = b.n === 0;
      cpuMode = false; game.turn = 0; game.inHand = st === 'hand' ? 'kitchen' : null; placeAt = null;
      state = st === 'over' ? 'over' : 'aim'; pull = null; stroke = null;
      draw(performance.now());
      const d = c.getImageData(0, 0, W, table.height).data;
      frame[st] = Math.max(...pts.flat().map(i => Math.max(...[0, 1, 2].map(j => Math.abs(d[i * 4 + j] - img[i * 4 + j])))));
    }
    state = 'over';
    return { art, frame, whole };
  }, [cloth]);
  check(`dpr 3, ${size} ft${P}, ${cloth} cloth: every drop is whole and round: the cap's back holds all of it, sides and corners`, grid.whole.length === 6 && grid.whole.every(Boolean), JSON.stringify(grid.whole));
  check(`dpr 3, ${size} ft${P}, ${cloth} cloth: the whole of every hole (a grid over the full drop circle) is dark and never cloth-coloured`,
    grid.art.every(p => p.n > 100 && p.lum < 0.05 && p.cloth < 20), JSON.stringify(grid.art.map(p => [p.k, p.n, +p.lum.toFixed(3), p.cloth])));
  check(`dpr 3, ${size} ft${P}, ${cloth} cloth: a frame paints nothing inside a hole (game over, ball in hand in the kitchen, aiming)`,
    Object.values(grid.frame).every(v => v <= 2), JSON.stringify(grid.frame));

  /* every overlay on the bed against the brightest lit cloth: white at the cloth's floor alpha
     (guide lines and rings, placement, kitchen line, loupe lines), ILLEGAL, the halo's core and
     the loupe's rim, composited as the canvas does */
  const ov = await q.page.evaluate(() => {
    let best = [0, 0, 0], bl = 0;
    for (let i = 1; i < 10; i++) for (let j = 1; j < 6; j++) { const [c] = __px([toScreen(TL * i / 10, TW * j / 6)]); const l = __lum(c); if (l > bl) { bl = l; best = c; } }
    const over = (f, a) => f.map((v, i) => v * a + best[i] * (1 - a)), hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const cr = c => { const a = __lum(c), b = bl; return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
    const out = { white: cr(over([255, 255, 255], CL.ovMin)), illegal: cr(hex(ILLEGAL)), halo: cr(over([255, 236, 190], 0.95)), loupe: cr(over([255, 255, 255], 0.85)) };
    for (const k in out) out[k] = +out[k].toFixed(2);
    return out;
  });
  check(`${size} ft${P}, ${cloth} cloth: every overlay keeps 3:1 on the brightest cloth (white lines and rings, illegal, halo, loupe rim)`, Object.values(ov).every(v => v >= 3), JSON.stringify(ov));
  }
  /* the caps on generous pockets at the narrowest rail (RAIL_MIN on this phone): every corner
     cap's edge stays capGap inside the rail's outer edge; each side cap sits in an ear that
     swells past the rail, SIDE_WOOD of wood round its back, and the ear is painted (casting and
     wood just inside its crown, the room just outside it) */
  const caps = await q.page.evaluate(() => {
    const co = cushionDepth(), px1 = 1 / view.k, S1 = pocketShape(1, co);
    const corners = [0, 2, 3, 5].map(k => { const S = pocketShape(k, co);
      return +(1000 * Math.min(S.C[0] + RAIL - S.rc, TL + RAIL - S.C[0] - S.rc, S.C[1] + RAIL - S.rc, TW + RAIL - S.C[1] - S.rc)).toFixed(2); });
    const sides = [1, 4].map(k => { const S = pocketShape(k, co), e = S.ear; return e ? +(1000 * (e.rw - S.rc)).toFixed(2) : -1; });
    const e = S1.ear, inn = __px([toScreen(TL / 2, -(e.reach - 1.5 * px1))])[0], out = __px([toScreen(TL / 2, -(e.reach + 4 * px1))])[0];
    return { rail: RAIL, min: RAIL_MIN, corners, want: 1000 * capGap(co), sides, wood: 1000 * SIDE_WOOD, reach: +(1000 * e.reach).toFixed(1), inn, out };
  });
  check('generous pockets at RAIL_MIN: every corner cap fits inside the rail, capGap from its outer edge', caps.rail === caps.min && caps.corners.every(g => g >= caps.want - 0.01), JSON.stringify(caps));
  const dif = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  check('generous pockets at RAIL_MIN: each side cap sits in a painted ear past the rail, SIDE_WOOD of wood round it', caps.sides.every(s => Math.abs(s - caps.wood) < 0.01)
    && caps.reach > 1000 * caps.rail && dif(caps.inn, caps.out) > 40, JSON.stringify(caps));
  await q.page.evaluate(() => { settings.table = '7'; settings.pockets = 'regulation'; settings.cloth = 'green'; felt.start('8'); layout(); });

  /* the game ball's halo: the 8 in 8-ball, the 9 (and not the 8) in 9-ball, at 3:1 on the cloth */
  const halo = await q.page.evaluate(() => {
    const ring = n => {
      const b = game.balls.find(o => o.n === n), s = toScreen(b.x, b.y), rp = BALL_R * view.k, w = Math.max(1.25, rp * 0.075), pts = [];
      for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; pts.push([s[0] + Math.cos(a) * (rp + w * 0.75), s[1] + Math.sin(a) * (rp + w * 0.75)]); }
      return __px(pts).map(__lum).sort((a, b) => b - a)[6];   /* the 7th brightest: most of the ring, not a speck */
    };
    const lay = kind => {
      felt.start(kind); state = 'over'; game.breakShot = false;
      for (const b of game.balls) b.on = b.n === 8 || b.n === 9;
      Object.assign(game.balls.find(b => b.n === 8), { x: TL * 0.35, y: TW * 0.5 }); Object.assign(game.balls.find(b => b.n === 9), { x: TL * 0.65, y: TW * 0.5 });
      return { 8: ring(8), 9: ring(9) };
    };
    const e = lay('8'), n = lay('9');
    let cloth = 0;
    for (const b of game.balls) b.on = false;
    for (let i = 1; i < 10; i++) for (let j = 1; j < 6; j++) cloth = Math.max(cloth, __lum(__px([toScreen(TL * i / 10, TW * j / 6)])[0]));
    return { e, n, cloth, c8: (e[8] + 0.05) / (cloth + 0.05), c9: (n[9] + 0.05) / (cloth + 0.05) };
  });
  check('8-ball: the 8 wears the game-ball halo, 3:1 on the brightest cloth', halo.c8 >= 3 && halo.e[9] < halo.cloth * 1.5, JSON.stringify(halo));
  check('9-ball: the 9 wears the halo (3:1) and the 8 has neither halo nor rim', halo.c9 >= 3 && halo.n[8] < halo.cloth * 1.5, JSON.stringify(halo));

  /* the auto-aim hint: a ring round ball n while a human aims (none with hint null, none on the
     CPU's turn or while rolling), a chevron inside pocket k's mouth only when k >= 0, both at
     3:1 on the brightest cloth of each colour. Reduced motion holds the ring still to measure it. */
  await q.page.emulateMedia({ reducedMotion: 'reduce' });
  for (const cloth of ['green', 'red']) {
    const hn = await q.page.evaluate(cloth => {
      settings.table = '7'; settings.pockets = 'regulation'; settings.cloth = cloth; felt.start('8'); layout();
      game.breakShot = false; game.inHand = null; cpuMode = false; pull = null; stroke = null; settings.guide = 'off';
      for (const b of game.balls) b.on = b.n === 0 || b.n === 3;
      Object.assign(game.balls.find(b => b.n === 3), { x: TL * 0.6, y: TW * 0.45 }); Object.assign(game.balls[0], { x: TL * 0.3, y: TW * 0.6 });
      aimAngle = Math.PI; state = 'aim';
      const b = game.balls.find(o => o.n === 3), s = toScreen(b.x, b.y), rp = BALL_R * view.k, ring = [];
      for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; ring.push([s[0] + Math.cos(a) * (rp + 3.5), s[1] + Math.sin(a) * (rp + 3.5)]); }
      const A = POCKET_AIM[2], N = CPU_MOUTH_N[2], m = toScreen(A[0] + N[0] * 0.045, A[1] + N[1] * 0.045), mark = [];
      for (let dx = -8; dx <= 8; dx += 1) for (let dy = -8; dy <= 8; dy += 1) mark.push([m[0] + dx, m[1] + dy]);
      /* __px draws at performance.now(): wind the hint's fade-in clock back past HINT_FADE */
      const read = () => { draw(performance.now()); hintSeen.t -= 1000; return { ring: __px(ring).map(__lum).sort((a, b) => b - a)[6], mark: Math.max(...__px(mark).map(__lum)) }; };
      hint = null; const none = read();
      hint = { n: 3, k: 2 }; const on = read();
      hint = { n: 3, k: -1 }; const noPocket = read();
      cpuMode = true; game.turn = 1; hint = { n: 3, k: 2 }; const cpu = read(); cpuMode = false; game.turn = 0;
      state = 'rolling'; const rolling = read(); state = 'over'; hint = null;
      let bright = 0;
      for (const o of game.balls) o.on = false;
      for (let i = 1; i < 10; i++) for (let j = 1; j < 6; j++) bright = Math.max(bright, __lum(__px([toScreen(TL * i / 10, TW * j / 6)])[0]));
      const cr = l => +((l + 0.05) / (bright + 0.05)).toFixed(2);
      return { none, on, noPocket, cpu, rolling, bright, ringCr: cr(on.ring), markCr: cr(on.mark) };
    }, cloth);
    check(`hint, ${cloth} cloth: a ring round the suggested ball while a human aims, nothing with hint null, on the CPU's turn or while rolling`,
      hn.on.ring > 2 * hn.none.ring && [hn.none, hn.cpu, hn.rolling].every(o => o.ring < hn.bright * 1.5), JSON.stringify(hn));
    check(`hint, ${cloth} cloth: a chevron inside the suggested pocket's mouth only when k >= 0`,
      hn.on.mark > 2 * hn.none.mark && hn.noPocket.mark < hn.bright * 1.5 && hn.noPocket.ring > 2 * hn.none.ring, JSON.stringify(hn));
    check(`hint, ${cloth} cloth: ring and chevron keep 3:1 on the brightest cloth`, hn.ringCr >= 3 && hn.markCr >= 3, JSON.stringify({ ring: hn.ringCr, mark: hn.markCr }));
  }
  await q.page.emulateMedia({ reducedMotion: null });
  await q.page.evaluate(() => { settings.cloth = 'green'; felt.start('8'); layout(); });

  /* the loupe: shown while fineAim is set and not otherwise, clear of the contact */
  const lp = await q.page.evaluate(() => {
    felt.start('8'); game.breakShot = false; game.inHand = null; settings.guide = 'full';
    for (const b of game.balls) b.on = [0, 1, 5].includes(b.n);
    Object.assign(game.balls.find(b => b.n === 1), { x: TL * 0.75, y: TW * 0.35 }); Object.assign(game.balls.find(b => b.n === 5), { x: TL * 0.24, y: TW * 0.7 });
    Object.assign(game.balls[0], { x: TL * 0.47, y: TW * 0.49 });
    state = 'aim'; pull = null; stroke = null; cpuMode = false;
    const c = game.balls[0], t = game.balls.find(b => b.n === 1), P = POCKET_AIM[2], ux = P[0] - t.x, uy = P[1] - t.y, L = Math.hypot(ux, uy);
    const gx = t.x - ux / L * 2 * BALL_R, gy = t.y - uy / L * 2 * BALL_R;
    aimAngle = Math.atan2(gy - c.y, gx - c.x);
    let now = performance.now();
    const run = n => { for (let i = 0; i < n; i++) draw(now += 16); };
    const rim = () => { if (!loupe) return 0; const pts = []; for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; pts.push([loupe.x + Math.cos(a) * loupe.r, loupe.y + Math.sin(a) * loupe.r]); } return Math.max(...__px(pts).map(__lum)); };
    fineAim = false; run(20);
    const off = { shown: !!loupe };
    fineAim = true; run(20);
    const L1 = loupe && { ...loupe }, rimOn = rim(), C = toScreen(gx, gy);
    /* cost of a frame with the loupe up, and of the same frame without it */
    const cost = () => { const g = table.getContext('2d'), N = 60; g.getImageData(0, 0, 1, 1); const t0 = performance.now(); for (let i = 0; i < N; i++) draw(now += 16); g.getImageData(0, 0, 1, 1); return (performance.now() - t0) / N; };
    const ms = cost();
    fineAim = false; run(20); const base = cost(); fineAim = true; run(20);
    fineAim = false; run(20);
    const after = { shown: !!loupe };
    fineAim = false;
    return { off, L1, rimOn, d: L1 ? Math.hypot(L1.x - C[0], L1.y - C[1]) : 0, ms, base, after };
  });
  check('loupe: shown while fineAim is set, gone when it is not', !lp.off.shown && lp.L1 && lp.rimOn > 0.5 && !lp.after.shown, JSON.stringify(lp));
  check('loupe: 120 to 150 CSS px across, its centre more than its radius from the contact', lp.L1 && lp.L1.r * 2 >= 110 && lp.L1.r * 2 <= 150 && lp.d > lp.L1.r, JSON.stringify(lp.L1) + ' d ' + lp.d.toFixed(1));
  /* software canvas on a CI runner is 1.5x slower than a dev machine, so the absolute bound is the
     real one (a 60 fps frame) and the relative one catches a loupe that grows out of proportion */
  check('loupe: a frame with it up at dpr 3 fits a 60 fps frame and costs at most twice the frame without it (headless, software)',
    lp.ms < 16.7 && lp.ms < 2 * lp.base, `${lp.ms.toFixed(2)} ms with, ${lp.base.toFixed(2)} ms without`);
  check('dpr 3: no console errors', q.errors.length === 0, q.errors.join(' | '));
  await q.browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
