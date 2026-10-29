#!/usr/bin/env node
/* camera-check: the broadcast camera and the winning-shot replay (page 4n), at 393x852 (dpr 3,
   touch), the camera on (open's camera: true; every other suite runs with it off).
   1. a struck shot: the camera starts entering perspective within 500 ms, is all perspective
      while the balls roll, and is back to the top-down table (blend 0, phase off) on the frame
      the next turn starts;
   2. it is only a view: the live result equals simulateShot byte for byte, and equals the same
      shot played with the camera off; the table geometry, the physics globals and the view are
      exactly what they were;
   3. input is ignored while it is in perspective: a sweep on the table, a pull on the power bar
      and the arrow keys turn nothing and shoot nothing;
   4. frames within a 60 Hz budget while the camera is up: 95% under 16 ms, none over 33 (each
      frame flushed, felt.bcMeasure);
   5. never in the lesson, a tutorial, a drill, a trick shot or a shot replay;
   6. Settings > Graphics, Shot Camera: Off persists (localStorage, and a reload) and keeps every
      shot top-down; Reduce Motion turns it off;
   7. the winning shot: a one-ball 9-ball rack, the 9 potted via felt.shoot, plays again through
      the camera before the result sheet (the 9 seen dropping into its pocket, 2.5 to 4 s), then
      the sheet; a tap skips it at once; Replay Winning Shot on the sheet plays it again and the
      sheet comes back; Reduce Motion leaves it out; the geometry is unchanged after. */
'use strict';
const { check, done, open } = require('./lib.cjs');

const GEO = () => JSON.stringify([TABLE, POOL_TABLE, BUMPER_SHAPE, SNOOKER_SIZE, POCKETS_STYLE, TL, TW, HEAD_X, FOOT, BALL_R, MU_ROLL, CUE_RATIO, CUSH_MU, RAIL_E, MU_SP,
  CUSH, CUSHION_POLYS, POCKETS, POCKET_R, POCKET_AIM, MOUTHS, BUMPERS, BED_LINES, JAW_ARCS, SPOTS, D_R, RAIL, viewBase]);

(async () => {
  const P = await open('', { viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3, camera: true });
  const page = P.page, ev = (f, a) => page.evaluate(f, a);
  await ev(`window.__geo = ${GEO.toString()}`);
  /* a cut on the 1 with a few balls about (replay-check's), auto aim off; returns the angle */
  const setup = () => ev(() => {
    settings.autoAim = false; felt.speed = 1;
    felt.start('8'); game.inHand = null; game.breakShot = false; game.shots = 4; state = 'aim'; hint = null;
    const at = { 0: [0.55, 0.62], 1: [1.25, 0.42], 3: [1.6, 0.75], 9: [0.9, 0.2], 8: [1.45, 0.62] };
    for (const b of game.balls) { b.on = b.n in at; if (b.on) { b.x = at[b.n][0]; b.y = at[b.n][1]; } }
    const c = game.balls[0], o = game.balls.find(b => b.n === 1), Q = POCKET_AIM[2], L = Math.hypot(Q[0] - o.x, Q[1] - o.y);
    return Math.atan2(o.y - (Q[1] - o.y) / L * 2 * BALL_R - c.y, o.x - (Q[0] - o.x) / L * 2 * BALL_R - c.x);
  });
  /* every frame: the time since the strike, the camera's phase and blend, the state */
  const watch = () => ev(() => {
    const W = window.__w = { rows: [], atTurn: null, t0: performance.now() };
    let last = felt.state;
    const tick = () => {
      const b = felt.broadcast;
      W.rows.push([Math.round(performance.now() - W.t0), b.phase, +b.blend.toFixed(3), felt.state]);
      if (last !== 'aim' && felt.state === 'aim' && W.atTurn === null) W.atTurn = { phase: b.phase, blend: b.blend };
      last = felt.state;
      if (W.atTurn === null && W.rows.length < 4000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const shotAndWatch = async (a, p) => {
    await watch();
    await ev(([a, p]) => { window.__w.t0 = performance.now(); felt.shoot(a, p, 0); }, [a, p]);
    await page.waitForFunction(() => window.__w.atTurn !== null, null, { timeout: 30000 });
    return ev(() => window.__w);
  };

  /* ---- 1-4: a shot under the camera ---- */
  const ang = await setup();
  const g0 = await ev(() => __geo());
  await ev(() => { felt.bcMeasure = true; bc.ms = []; bc.fms = []; bc.fph = []; });
  await watch();
  const pre = await ev(a => { window.__w.t0 = performance.now(); felt.shoot(a, 0.62, 0); return { balls: JSON.parse(JSON.stringify(felt.lastShot.balls)), rec: { angle: felt.lastShot.angle, power: felt.lastShot.power, spin: felt.lastShot.spin, ball: 0 } }; }, ang);
  /* 3. input while it is in perspective: a sweep, a pull on the bar, the arrows */
  await page.waitForFunction(() => felt.broadcast.blend >= 1, null, { timeout: 3000 }).catch(() => {});
  const in0 = await ev(() => ({ aim: felt.aim, shots: felt.game.shots, last: felt.lastShot, blend: felt.broadcast.blend, st: felt.state }));
  const t = await ev(() => felt.tableRect());
  await page.touchscreen.tap(t.left + 120, t.top + 200);
  const cdp = await page.context().newCDPSession(page);
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', t.left + 100, t.top + 150);
  for (let i = 1; i <= 8; i++) await touch('touchMove', t.left + 100 + i * 20, t.top + 150 + i * 15);
  await touch('touchEnd');
  const bar = await ev(() => { const r = powerBar.getBoundingClientRect(); return { x: r.left + r.width / 2, y0: r.top + 20, y1: r.bottom - 10 }; });
  await touch('touchStart', bar.x, bar.y0);
  for (let i = 1; i <= 10; i++) await touch('touchMove', bar.x, bar.y0 + (bar.y1 - bar.y0) * i / 10);
  await touch('touchEnd');
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Space');
  const in1 = await ev(() => ({ aim: felt.aim, shots: felt.game.shots, blend: felt.broadcast.blend, st: felt.state, pulling: felt.pulling }));
  check('input in perspective: a tap, a sweep on the table, a pull on the bar and the arrow keys turn nothing and shoot nothing',
    in0.blend >= 1 && in0.st === 'rolling' && in1.blend > 0 && in1.aim === in0.aim && in1.shots === in0.shots && in1.st === 'rolling' && !in1.pulling, JSON.stringify({ in0: { aim: in0.aim, blend: in0.blend, st: in0.st }, in1 }));
  await page.waitForFunction(() => window.__w.atTurn !== null, null, { timeout: 30000 });
  const W = await ev(() => window.__w);
  const first = W.rows.find(r => r[2] > 0), full = W.rows.some(r => r[2] >= 1 && r[3] === 'rolling');
  check(`a struck shot: the camera enters perspective within 500 ms (${first ? first[0] : 'never'} ms) and is all perspective while the balls roll`,
    !!first && first[0] <= 500 && full, JSON.stringify(W.rows.slice(0, 30)));
  const aimRows = W.rows.filter(r => r[3] === 'aim');
  check('...and it is back to the top-down table (blend 0, off) before aiming resumes',
    W.atTurn.phase === 'off' && W.atTurn.blend === 0 && aimRows.every(r => r[2] === 0), JSON.stringify(W.atTurn));
  const outRows = W.rows.filter(r => r[1] === 'out');
  check('...easing back while the turn is held (state rolling, blend falling to 0 over about 350 ms)', outRows.length >= 5 && outRows.every(r => r[3] === 'rolling'),
    JSON.stringify(outRows.slice(0, 2).concat(outRows.slice(-2))));
  const live = await ev(p => {
    const r = simulateShot(p.balls, p.rec);
    return { live: JSON.stringify(felt.lastResult.balls), sim: JSON.stringify(r.balls), res: JSON.stringify(felt.lastResult) };
  }, pre);
  check('the live roll under the camera equals simulateShot byte for byte', live.live === live.sim);
  const fr = await ev(() => { const a = bc.fms.slice().sort((p, q) => p - q); const big = bc.fms.map((m, i) => [i, +m.toFixed(1), bc.fph[i]]).filter(x => x[1] > 16); return { n: a.length, p95: a[Math.floor(a.length * 0.95)], max: a[a.length - 1], paint: Math.max(...bc.ms), big }; });
  check(`frame budget with the camera up at 393x852 dpr 3: ${fr.n} frames, 95% under 16 ms (p95 ${fr.p95 && fr.p95.toFixed(1)}), none over 33 (max ${fr.max && fr.max.toFixed(1)})`,
    fr.n > 30 && fr.p95 < 16 && fr.max < 33, JSON.stringify(fr));
  const g1 = await ev(() => __geo());
  check('the table geometry, the physics globals and the view are exactly what they were', g1 === g0);
  /* the same shot with the camera off: the same result to the bit */
  const ang2 = await setup();
  await ev(() => setSetting('shotCam', 'off'));
  const W2 = await shotAndWatch(ang2, 0.62);
  const off = await ev(() => JSON.stringify(felt.lastResult));
  check('the same shot with Shot Camera Off: never in perspective, and the result is byte-identical', off === live.res && W2.rows.every(r => r[2] === 0 && r[1] === 'off'));
  await ev(() => setSetting('shotCam', 'broadcast'));

  /* ---- 5. never in the lesson, a tutorial, a drill, a trick shot or a replay ---- */
  const solos = {
    lesson: () => { startLesson(); },
    tutorial: () => { startTutorial('8'); },
    drill: () => { startDrill(DRILL_LIB[0].id); },
    trick: () => { startTrick(TRICKS[0].id); },
  };
  for (const [name, fn] of Object.entries(solos)) {
    await ev(`(${fn.toString()})()`);
    await page.waitForFunction(() => felt.state === 'aim', null, { timeout: 8000 }).catch(() => {});
    const ok = await ev(() => { felt.speed = 3; return felt.shoot(0.3, 0.5, 0); });
    await watch();
    await page.waitForFunction(() => !['stroke', 'rolling'].includes(felt.state), null, { timeout: 20000 }).catch(() => {});
    const r = await ev(() => ({ rows: window.__w.rows, solo: solo && solo.kind, mode: game.mode || null }));
    check(`never in ${name === 'trick' ? 'a trick shot' : name === 'drill' ? 'a drill' : name === 'tutorial' ? 'a tutorial' : 'the lesson'} (${r.solo}, ${r.mode})`, ok && r.rows.length > 3 && r.rows.every(x => x[1] === 'off' && x[2] === 0), JSON.stringify({ ok, n: r.rows.length, bad: r.rows.find(x => x[1] !== 'off') }));
  }
  await ev(() => { backToMenu(); });
  const angR = await setup();
  await ev(() => { felt.speed = 3; });
  await shotAndWatch(angR, 0.62);
  await watch();
  const rp0 = await ev(() => felt.replay());
  await page.waitForFunction(() => !felt.replaying, null, { timeout: 20000 });
  const rpRows = await ev(() => window.__w.rows);
  check('never during a shot replay (5r)', rp0 && rpRows.length > 5 && rpRows.every(r => r[1] === 'off' && r[2] === 0), JSON.stringify({ rp0, n: rpRows.length }));

  /* ---- 6. the setting ---- */
  await ev(() => { showPrefs('gfx'); });
  const seg = await ev(() => { const r = scOff.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height, w: r.width, label: scLab.textContent, def: scBroad.getAttribute('aria-pressed') }; });
  await ev(() => scOff.scrollIntoView({ block: 'center' }));
  const segAt = await ev(() => { const r = scOff.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.touchscreen.tap(segAt.x, segAt.y);
  const st = await ev(() => ({ s: settings.shotCam, stored: JSON.parse(localStorage.getItem('felt.settings')).shotCam, pressed: scOff.getAttribute('aria-pressed') }));
  check(`Settings > Graphics: a Shot Camera row (Broadcast by default, 44 px targets), and a tap on Off sets it and stores it`,
    seg.label === 'Shot Camera' && seg.def === 'true' && seg.h >= 44 && st.s === 'off' && st.stored === 'off' && st.pressed === 'true', JSON.stringify({ seg, st }));
  await page.reload();
  await page.waitForFunction(() => window.booted === true, null, { timeout: 20000 });
  await ev(`window.__geo = ${GEO.toString()}`);
  const angO = await setup();
  const WO = await shotAndWatch(angO, 0.62);
  const re = await ev(() => settings.shotCam);
  check('...it persists across a reload, and with it Off a shot stays top-down', re === 'off' && WO.rows.every(r => r[2] === 0 && r[1] === 'off'), re);
  await ev(() => { setSetting('shotCam', 'broadcast'); setSetting('reduceMotion', true); });
  const angM = await setup();
  const WM = await shotAndWatch(angM, 0.62);
  check('Reduce Motion turns it off: the shot stays top-down', WM.rows.every(r => r[2] === 0 && r[1] === 'off'));
  await ev(() => setSetting('reduceMotion', false));

  /* ---- 7. the winning shot ---- */
  const win = () => ev(() => {
    settings.autoAim = false; felt.speed = 1;
    setSetting('cpu', false);
    felt.start('9'); game.inHand = null; game.breakShot = false; game.shots = 6; state = 'aim'; hint = null;
    const at = { 0: [0.9, 0.42], 9: [1.5, 0.3] };
    for (const b of game.balls) { b.on = b.n in at; if (b.on) { b.x = at[b.n][0]; b.y = at[b.n][1]; } }
    stats.shots = [3, 3];
    /* straight in: the 9 to the corner pocket nearest along its line */
    const o = game.balls.find(b => b.n === 9), c = game.balls[0];
    let best = null;
    for (let k = 0; k < POCKET_AIM.length; k++) {
      const Q = POCKET_AIM[k], L = Math.hypot(Q[0] - o.x, Q[1] - o.y), a = Math.atan2(o.y - (Q[1] - o.y) / L * 2 * BALL_R - c.y, o.x - (Q[0] - o.x) / L * 2 * BALL_R - c.x);
      const r = simulateShot(game.balls, { angle: a, power: 0.45, spin: { x: 0, y: 0 }, ball: 0 });
      if (r.potted.includes(9) && !r.potted.includes(0) && judge(game, r).winner === 0) { best = a; break; }
    }
    return best;
  });
  const ang9 = await win();
  check('a one-ball 9-ball rack with a winning pot to play', ang9 !== null);
  const g2 = await ev(() => __geo());
  await ev(() => {
    window.__win = { rows: [], drop: [], t0: 0, over: null };
    const W = window.__win;
    const tick = () => {
      const b = felt.broadcast, o = over.classList.contains('show');
      if (b.phase === 'win' && !W.t0) W.t0 = performance.now();
      if (W.t0) W.rows.push([Math.round(performance.now() - W.t0), b.phase, +b.blend.toFixed(3), o]);
      const d = b.phase === 'win' && b.drawn && b.drawn.find(x => x.n === 9 && x.drop !== null);
      if (d) W.drop.push(d.drop);
      if (o && W.t0 && W.over === null) W.over = Math.round(performance.now() - W.t0);
      if (W.over === null) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await ev(a => felt.shoot(a, 0.45, 0), ang9);
  await page.waitForFunction(() => window.__win.over !== null, null, { timeout: 30000 });
  const WW = await ev(() => ({ w: window.__win, st: felt.state, winner: felt.game.winner, info: felt.broadcast }));
  const winRows = WW.w.rows.filter(r => r[1] === 'win');
  check(`the winning pot plays again through the camera before the result sheet (${WW.w.over} ms: 2.5 to 4 s)`,
    WW.winner === 0 && winRows.length > 30 && winRows.every(r => !r[3]) && WW.w.over >= 2400 && WW.w.over <= 4300, JSON.stringify({ over: WW.w.over, n: winRows.length, info: { wins: WW.info.wins } }));
  const drops = WW.w.drop;
  check(`...the 9 seen dropping into its pocket on the screen's clock (${drops.length} frames of the drop)`, drops.length >= 5 && drops.some(u => u > 0 && u < 0.5) && drops.some(u => u >= 0.5 && u < 1), JSON.stringify(drops.slice(0, 20)));
  const sheet = await ev(() => ({ show: over.classList.contains('show'), btn: !overReplay.hidden && overReplay.getBoundingClientRect().height, label: overReplay.textContent, txt: overText.textContent }));
  check('...then the result sheet as before, with a Replay Winning Shot button (44 px)', sheet.show && sheet.btn >= 44 && sheet.label === 'Replay Winning Shot', JSON.stringify(sheet));
  /* the button plays it again and the sheet comes back */
  const bt = await ev(() => { const r = overReplay.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.touchscreen.tap(bt.x, bt.y);
  const rb = await ev(() => ({ phase: felt.broadcast.phase, show: over.classList.contains('show') }));
  await page.waitForFunction(() => felt.broadcast.phase === 'win' && felt.broadcast.blend >= 1, null, { timeout: 3000 }).catch(() => {});
  await page.waitForFunction(() => over.classList.contains('show'), null, { timeout: 8000 }).catch(() => {});
  const rb2 = await ev(() => ({ phase: felt.broadcast.phase, show: over.classList.contains('show'), wins: felt.broadcast.wins }));
  check('Replay Winning Shot: the sheet steps aside, the shot plays again, and the sheet comes back', rb.phase === 'win' && !rb.show && rb2.show && rb2.wins === WW.info.wins + 1, JSON.stringify({ rb, rb2 }));
  /* a tap skips it */
  const ang9b = await win();
  await ev(a => felt.shoot(a, 0.45, 0), ang9b);
  await page.waitForFunction(() => felt.broadcast.phase === 'win' && felt.broadcast.win && felt.broadcast.win.t > 300, null, { timeout: 20000 });
  const tr = await ev(() => felt.tableRect());
  await page.touchscreen.tap(tr.left + 80, tr.top + 80);
  const sk = await ev(() => ({ phase: felt.broadcast.phase, show: over.classList.contains('show'), st: felt.state }));
  await page.waitForTimeout(700);
  const sk2 = await ev(() => ({ show: over.classList.contains('show'), st: felt.state, phase: felt.broadcast.phase }));
  check('a tap skips the winning replay: the result sheet at once, and the tap reaches nothing else', sk.phase !== 'win' && sk.show && sk2.show && sk2.st === 'over' && sk2.phase === 'off', JSON.stringify({ sk, sk2 }));
  /* Reduce Motion: no replay, the sheet at once */
  await ev(() => setSetting('reduceMotion', true));
  const ang9c = await win();
  await ev(a => felt.shoot(a, 0.45, 0), ang9c);
  await page.waitForFunction(() => felt.state === 'over', null, { timeout: 20000 });
  const rm = await ev(() => ({ phase: felt.broadcast.phase, show: over.classList.contains('show') }));
  check('Reduce Motion: no winning replay, the result sheet at once', rm.phase === 'off' && rm.show, JSON.stringify(rm));
  await ev(() => setSetting('reduceMotion', false));
  const g3 = await ev(() => __geo());
  check('the table geometry, the physics globals and the view are unchanged after the replays', g3 === g2);
  check('no console errors', P.errors.length === 0, P.errors.slice(0, 3).join(' | '));
  await P.browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
