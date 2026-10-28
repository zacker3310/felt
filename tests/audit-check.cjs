#!/usr/bin/env node
/* audit-check: one regression check per fix of the T4 audit (.buildloop/audit/T4-audit.md),
   each written to fail on the build before the fix and pass after it.
   A1 the frame loop survives an exception thrown inside a frame (it once stopped for good).
   A2 the live roll keeps real time at any display rate (rounding per frame ran 144 Hz 4% slow).
   A3 the daily shot's first try counts when it is struck: quitting mid-roll no longer frees a retry.
   A4 a daily record whose last day is in the future neither shows its streak nor blocks scoring.
   A5 a stored daily date that names no real day is dropped.
   A6 (F7) keyboard play: the focused power bar takes its mark from up and down; Space drives the bar
      only with Settings' switch on, pulls to the mark and lets go as the bar does; any key stops it.
   A7 (F11) a hidden page pauses the game and suspends the audio; nothing steps while hidden; back,
      the audio resumes and Resume carries on with no time jump.
   A8 (F14) the CPU's win plays no win sting (a quiet one of its own); a player's win still does.
   A9 (F16) the last banner does not show through the pause menu (landscape).

   A10 (F8) the CPU's think time: it waits as cpuThinkMs says (the break briefly), the frame never
      stalls meanwhile, a tap on the table skips the wait, and felt.speed runs it faster.
   A11 (F9) a ball that stops with side spin keeps turning in place until the cloth takes it, and
      a ball that hits it meanwhile is thrown by it (the old rest zeroed it on the spot).
   A12 (F10) side spin decays at pooltool's spinning friction, 5 u_sp g / 2R with u_sp = 4/9 R
      (10.89 rad/s^2), on every table, not the old flat 8 rad/s^2.
   A13 (F12) a trick shot's tries persist per challenge (felt.trickTries.v1, versioned): reopening
      it from the list, or after a reload, carries on the count, so a make after a miss and a
      reopen earns two stars, not three. A bad record is ignored.
   A14 (F6) the rules engine's re-rack on a stalemate covers 8-ball too (rules2-check pins the
      rest of F6: legal breaks, the 8 on the break, push-outs, break-foul options, three fouls).

   A15 (F17) snooker after a foul (WPBSA Section 3 Rules 12 to 14): snookered on the only red, the
      next player is offered a free ball, and the nominated colour scores as a red and is re-spotted;
      a miss with the red in plain view can be put back exactly; the third such miss loses the frame.
      The base build had none of it (the turn simply passed). */
'use strict';
const { check, done, open } = require('./lib.cjs');

/* A11 and A12 run on the sim alone */
{
  const S = require('./sim.cjs').loadSim(), R = S.BALL_R;
  const t = S.newTable([S.newBall(0, 1, S.TW / 2)]);
  t.balls[0].wz = 20;
  const first = S.stepTable(t), wz1 = t.balls[0].wz;
  while (S.stepTable(t));
  check('A11 (F9) a ball at rest with side spin keeps spinning in place: the first step goes on (it once ended the shot), and the shot lasts until the spin is gone',
    first === true && wz1 > 19.9 && t.end === 'rest' && t.t > 1.5 && t.balls[0].x === 1, JSON.stringify({ first, wz1, t: t.t }));
  const hit = wz => {
    const h = S.newTable([S.newBall(0, 0.5, S.TW / 2), S.newBall(1, 1.0, S.TW / 2)]);
    h.balls[1].wz = wz; h.balls[0].vx = 1.2; h.balls[0].wy = -1.2 / R;
    while (S.stepTable(h)) if (h.balls[1].vx > 0.3) return Math.atan2(h.balls[1].vy, h.balls[1].vx);
    return null;
  };
  check('A11 (F9) the spin is still there when the stationary ball is struck: it throws the ball off the line', Math.abs(hit(25)) > 1e-4 && Math.abs(hit(0)) < 1e-12, JSON.stringify([hit(25), hit(0)]));
  const rates = [['7'], ['9'], ['snooker', 'full'], ['carom'], ['bumper', 'rect']].map(a => {
    S.setTable(...a);
    const r = S.newTable([S.newBall(a[0] === 'carom' ? 70 : a[0] === 'bumper' ? 21 : 0, S.TL * 0.35, S.TW * 0.3)]);
    r.balls[0].wz = 10;
    for (let i = 0; i < 120; i++) S.stepTable(r);
    return (10 - r.balls[0].wz) / (120 * S.SIM_DT);
  });
  S.setTable('snooker', 'compact');
  {
    const g = Object.assign(S.newGame('snooker'), { breakShot: false, inHand: null, turn: 0 }), B = n => g.balls.find(b => b.n === n);
    for (const b of g.balls) if (S.isRed(b.n) && b.n !== 41) b.on = false;
    Object.assign(B(0), { x: 1.0, y: 0.5 }); Object.assign(B(41), { x: 2.0, y: 0.5 });
    const wall = S.copyGame(g), W = n => wall.balls.find(b => b.n === n);
    Object.assign(W(60), { x: 1.3, y: 0.5 }); Object.assign(W(59), { x: 1.3, y: 0.4465 }); Object.assign(W(61), { x: 1.3, y: 0.5535 });
    const miss = (h, o = {}) => S.judge(h, Object.assign({ balls: h.balls, cue: 0, first: null, potted: [], pocketOf: {}, crossed: true }, o));
    const f = miss(wall), fb = f.option && S.chooseOption(f, 'free:62');
    const fp = fb && miss(fb, { first: 62, potted: [62], pocketOf: { 62: 0 }, balls: fb.balls.map(b => b.n === 62 ? Object.assign({}, b, { on: false }) : b) });
    check('A15 (F17) snooker: snookered after a foul, a free ball is offered; the black nominated and potted scores 1 and is re-spotted',
      !!(f.option && f.option.free && fb && fp && fp.score[1] === 5 && fp.balls.find(b => b.n === 62).on && fp.on === 'colour'), JSON.stringify(f.option));
    Object.assign(B(60), { x: 1.5, y: 0.62 });
    const snap = JSON.stringify(g.balls), r = S.simulateShot(g.balls, { angle: -Math.PI / 2, power: 0.12, spin: { x: 0, y: 0 } });
    const m1 = S.judge(g, r), back = m1.option && S.chooseOption(m1, 'replace');
    const m3 = back && S.judge(S.chooseOption(S.judge(back, r), 'replace'), r);
    check('A15 (F17) snooker: a miss with the red in view is put back byte for byte, and the third miss loses the frame',
      !!(back && JSON.stringify(back.balls) === snap && back.turn === 0 && m3 && m3.winner === 1 && m3.verdict.why === 'three misses'));
  }
  S.setTable('7');
  /* A14 (F6): dry innings in a row in 8-ball re-rack with the house stalemate option */
  {
    const g0 = S.newGame('8', { rules: { ruleset: '8-house', call: {}, options: { stalemate: 2 } } });
    g0.breakShot = false; g0.inHand = null; g0.breaker = 1;
    for (const b of g0.balls) if (b.n > 0 && ![1, 9, 8].includes(b.n)) b.on = false;
    let g = g0;
    const dry = x => ({ balls: x.balls.map(b => Object.assign({}, b, { vx: 0, vy: 0 })), first: x.groups && x.groups[x.turn] === 'stripes' ? 9 : 1, railAfter: true, potted: [], pocketOf: {}, kick: null, end: 'rest' });
    for (let i = 0; i < 4 && g.winner === null && !g.breakShot; i++) g = S.judge(g, dry(g));
    check('A14 (F6) 8-ball: dry innings in a row (the house stalemate option) re-rack all fifteen and the breaker breaks again',
      g.verdict.rerack === 'stalemate' && g.breakShot && g.turn === 1 && S.onTable(g).length === 15, JSON.stringify({ v: g.verdict, n: S.onTable(g).length, t: g.turn }));
  }
  check('A12 (F10) side spin decays at 10.89 rad/s^2 (pooltool: 5/2 x 4/9 x g) on pool, snooker, carom and bumper tables, not 8', rates.every(v => Math.abs(v - 2.5 * 4 / 9 * 9.8) < 1e-6), JSON.stringify(rates));
}

(async () => {
  const { browser, page, errors } = await open('', { viewport: { width: 440, height: 956 }, hasTouch: true, isMobile: true });

  /* A1: draw() throws once mid-roll; the loop must go on and the roll must still end */
  const a1 = await page.evaluate(async () => {
    felt.start('8');
    const real = window.draw;
    let thrown = 0;
    window.draw = function (now) { if (!thrown++) throw new Error('audit: one bad frame'); return real.call(this, now); };
    felt.speed = 8;
    felt.shoot(0, 0.6, 0);
    const t0 = performance.now();
    while (performance.now() - t0 < 15000 && ['stroke', 'rolling'].includes(felt.state)) await new Promise(r => setTimeout(r, 20));
    window.draw = real;
    felt.speed = 1;
    return { thrown, state: felt.state };
  });
  check('A1 frame loop: a frame that throws does not stop the game; the roll still comes to rest and the turn goes on',
    a1.thrown > 1 && a1.state === 'aim', JSON.stringify(a1));
  /* the one deliberate error is reported, and nothing else */
  const own = errors.filter(e => /audit: one bad frame/.test(e)).length;
  check('A1 the error is reported on the console (not swallowed)', own >= 1, errors.join(' | '));
  errors.splice(0);

  /* A2: drive frame() by hand at 144 Hz for one simulated second of a firm break */
  const a2 = await page.evaluate(async () => {
    felt.quitToHome(); felt.start('8');
    const raf = window.requestAnimationFrame;
    window.requestAnimationFrame = () => 0;   /* the page's own loop stops; this test is the clock */
    await new Promise(r => setTimeout(r, 50));
    const out = {};
    try {
      felt.shoot(0, 1, 0);
      let t = performance.now();
      frame(t);   /* the first frame after the strike */
      const s0 = felt.simT;
      for (let i = 0; i < 144; i++) { t += 1000 / 144; frame(t); }
      out.simulated = felt.simT - s0;
      out.state = felt.state;
    } finally { window.requestAnimationFrame = raf; frame.last = undefined; raf.call(window, frame); }
    return out;
  });
  check('A2 frame pacing: 144 frames at 144 Hz advance the roll one second of sim time (within one step)',
    a2.state === 'rolling' && Math.abs(a2.simulated - 1) <= 1 / 1200 + 1e-9, JSON.stringify(a2));
  await page.waitForFunction(() => !['stroke', 'rolling'].includes(felt.state), null, { timeout: 30000 });

  /* A3: the daily's first try is struck, then the player quits before it stops and comes back */
  const a3 = await page.evaluate(async () => {
    felt.today = '2026-03-10';
    felt.quitToHome();
    felt.daily();
    const first = felt.solo.daily.scored;
    felt.speed = 0.2;
    felt.shoot(0, 0.5, 0);
    await new Promise(r => setTimeout(r, 120));
    const mid = felt.state;
    felt.pause(); felt.quitToHome();
    felt.speed = 1;
    felt.daily();
    return { first, mid, again: felt.solo.daily.scored, rec: felt.dailyRec };
  });
  check('A3 daily shot: a first try quit mid-roll still counts; coming back the same day is practice',
    a3.first === true && ['stroke', 'rolling'].includes(a3.mid) && a3.again === false && a3.rec.last === '2026-03-10' && a3.rec.streak === 1, JSON.stringify(a3));
  await page.evaluate(() => felt.quitToHome());

  /* A10 (F8): the CPU breaks at speed 1. It holds until its think time is up, counted from the
     turn's start (before the fix the plan came the moment the search ended: a break waited no
     time at all), every frame keeps coming, then a second break is skipped by a tap on the table,
     and at speed 40 the wait shrinks to a fortieth */
  const cpuTurn = (skip, speed) => page.evaluate(async ({ skip, speed }) => {
    felt.quitToHome();
    felt.speed = speed; felt.lastThink = null;
    felt.start('8', { level: 'hard', table: '7', pockets: 'regulation', breaker: 1 });
    const t0 = performance.now();
    if (skip) await new Promise(r => setTimeout(r, 30));
    if (skip) { const b = table.getBoundingClientRect(); table.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2, pointerId: 9, pointerType: 'touch', isPrimary: true })); }
    let gap = 0, last = performance.now();
    while (performance.now() - t0 < 8000 && felt.state === 'thinking' && !cpuPlan) {
      await new Promise(r => requestAnimationFrame(r));
      const n = performance.now(); gap = Math.max(gap, n - last); last = n;
    }
    const at = performance.now() - t0, think = felt.lastThink;
    return { at, think, gap, plan: !!cpuPlan || felt.state !== 'thinking', st: felt.state };
  }, { skip, speed });
  const w1 = await cpuTurn(false, 1), w2 = await cpuTurn(true, 1), w3 = await cpuTurn(false, 40);
  await page.evaluate(() => { felt.speed = 1; felt.quitToHome(); });
  check('A10 F8 think time: the CPU\'s break waits its cpuThinkMs (brief: 0.35 to 1.3 s), from the turn\'s start, with no frame gap over 100 ms',
    w1.plan && w1.think && w1.think.intent && w1.think.intent.type === 'break' && w1.think.ms >= 350 && w1.think.ms <= 1300 && w1.at >= w1.think.ms - 20 && w1.at < w1.think.ms + 400 && w1.gap < 100,
    JSON.stringify(w1));
  check('A10 F8 a tap on the table skips the wait; felt.speed 40 cuts it to a fortieth',
    w2.plan && w2.think && w2.at < Math.min(300, w2.think.ms - 200) && w3.plan && w3.think && w3.at < w3.think.ms / 40 + 200, JSON.stringify({ w2, w3 }));

  /* A4: a stored last day far in the future */
  const a4 = await open('', { init: () => { localStorage.setItem('felt.daily.v1', '{"last":"2099-01-01","streak":500,"best":500,"made":true}'); } });
  const r4 = await a4.page.evaluate(async () => {
    felt.today = '2026-03-10';
    syncMenu();
    const shown = { now: felt.dailyRec.streakNow, tile: dailySum.textContent };
    felt.daily();
    felt.speed = 30;
    felt.shoot(0, 0.3, 0);
    while (felt.state !== 'over') await new Promise(r => setTimeout(r, 20));
    return { shown, rec: felt.dailyRec };
  });
  check('A4 daily record from the future: no streak shown, and today\'s first try scores (a new streak of 1, the best kept)',
    r4.shown.now === 0 && r4.shown.tile === '' && r4.rec.last === '2026-03-10' && r4.rec.streak === 1 && r4.rec.best === 500, JSON.stringify(r4));
  /* A5: an impossible stored date is dropped, not wrapped into a real one */
  const a5 = await open('', { init: () => { localStorage.setItem('felt.daily.v1', '{"last":"2026-13-45","streak":3,"best":3}'); } });
  const r5 = await a5.page.evaluate(() => felt.dailyRec);
  check('A5 daily record with an impossible date (2026-13-45): read as no last day and no streak, the best kept',
    r5.last === null && r5.streak === 0 && r5.best === 3, JSON.stringify(r5));
  a4.errors.push(...a5.errors);

  /* A6-A9 on a desktop page (keyboard) */
  const k = await open('');
  const kp = k.page, sleep = ms => kp.waitForTimeout(ms);
  await kp.evaluate(() => { felt.start('9'); felt.speed = 1; });
  await sleep(500);
  await kp.evaluate(() => powerBar.focus());
  const k0 = await kp.evaluate(() => ({ mark: markPower, shots: felt.game.shots }));
  await kp.keyboard.press('ArrowUp'); await kp.keyboard.press('ArrowUp');
  await kp.keyboard.down('Shift'); await kp.keyboard.press('ArrowDown'); await kp.keyboard.up('Shift');
  await kp.keyboard.press('Space'); await kp.keyboard.press('Enter');
  await sleep(1300);
  const k1 = await kp.evaluate(() => ({ mark: markPower, aria: powerBar.getAttribute('aria-valuenow'), tab: powerBar.tabIndex, shots: felt.game.shots, state: felt.state, pulling: felt.pulling, msg: msg.textContent }));
  check('A6 keyboard: the power bar is in the tab order; up and down move its mark (Shift a big step); with the switch off Space and Enter shoot nothing and say where to turn it on',
    k1.tab === 0 && Math.abs(k1.mark - (k0.mark + 0.04 - 0.1)) < 1e-9 && k1.aria === String(Math.round(k1.mark * 100)) && k1.shots === k0.shots && k1.state === 'aim' && !k1.pulling && /Accessibility/.test(k1.msg), JSON.stringify({ k0, k1 }));
  await kp.evaluate(() => { setSetting('keyShoot', true); powerBar.focus(); });
  await kp.keyboard.press('Space');
  await sleep(150);
  const k2 = await kp.evaluate(() => ({ pulling: felt.pulling, power: felt.power, state: felt.state }));
  await kp.keyboard.press('Escape');
  await sleep(1300);
  const k3 = await kp.evaluate(() => ({ pulling: felt.pulling, state: felt.state, paused: felt.paused, shots: felt.game.shots, power: felt.power, mark: markPower }));
  check('A6 keyboard: with the switch on, Space arms the bar and it fills toward the mark; any key (Esc here) stops it, nothing is shot and the game is not paused',
    k2.pulling && k2.power > 0 && k2.power < k1.mark && k2.state === 'aim' && !k3.pulling && k3.state === 'aim' && !k3.paused && k3.shots === k0.shots && k3.power === k3.mark, JSON.stringify({ k2, k3 }));
  await kp.evaluate(() => powerBar.focus());
  await kp.keyboard.press('Enter');
  await kp.waitForFunction(() => felt.state !== 'aim', null, { timeout: 4000 }).catch(() => { });
  const k4 = await kp.evaluate(() => ({ state: felt.state, power: felt.power, mark: markPower, pulling: felt.pulling }));
  check('A6 keyboard: left alone, the driven bar reaches its mark and lets go: the shot is struck at the mark (only the bar shoots)', ['stroke', 'rolling'].includes(k4.state) && Math.abs(k4.power - k1.mark) < 1e-9 && !k4.pulling, JSON.stringify(k4));
  await kp.evaluate(() => { felt.speed = 40; setSetting('keyShoot', false); document.activeElement.blur(); });
  await kp.waitForFunction(() => !['stroke', 'rolling'].includes(felt.state), null, { timeout: 30000 });

  /* A7: hide the page mid-roll */
  const a7 = await kp.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const hide = h => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); document.dispatchEvent(new Event('visibilitychange')); };
    felt.quitToHome(); felt.start('8'); audioOn(); felt.speed = 1;
    await wait(400);
    felt.shoot(0, 0.9, 0);
    while (felt.state !== 'rolling') await wait(10);
    await wait(100);
    hide(true);
    await wait(80);
    const t1 = felt.simT, s1 = felt.state, p1 = felt.paused, a1 = felt.audio.state;
    await wait(600);
    const t2 = felt.simT;
    hide(false);
    await wait(80);
    const a2 = felt.audio.state, p2 = felt.paused, t2b = felt.simT;
    const r0 = performance.now();
    resumeBtn.click();
    await wait(150);
    const t3 = felt.simT, el = (performance.now() - r0) / 1000, s3 = felt.state;
    delete document.hidden;
    return { t1, t2, t2b, t3, el, s1, p1, a1, a2, p2, s3, hidden: document.hidden };
  });
  check('A7 lifecycle: hidden mid-roll, the game pauses (the pause menu), the audio is suspended, and the roll does not move',
    a7.s1 === 'menu' && a7.p1 && a7.a1 === 'suspended' && a7.t2 === a7.t1, JSON.stringify(a7));
  check('A7 lifecycle: back, the audio resumes, the game waits for Resume, then the roll carries on with no jump in time',
    a7.a2 === 'running' && a7.p2 && a7.t2b === a7.t2 && a7.s3 === 'rolling' && a7.t3 > a7.t2 && a7.t3 - a7.t2 <= a7.el + 0.02 && a7.hidden === false, JSON.stringify(a7));
  await kp.evaluate(() => { felt.speed = 40; });
  await kp.waitForFunction(() => !['stroke', 'rolling'].includes(felt.state), null, { timeout: 30000 });

  /* A8: who hears the win sting */
  const a8 = await kp.evaluate(() => {
    const heard = [], real = window.sfx;
    window.sfx = (kind, v) => { if (kind === 'win' || kind === 'lose') heard.push(kind); return real(kind, v); };
    const run = (cpu, p) => { heard.length = 0; settings.cpu = cpu; felt.quitToHome(); felt.start('8'); felt.forceWin(p); return heard.join(); };
    const out = { cpuWins: run(true, 1), youWin: run(true, 0), twoPlayers: run(false, 1) };
    window.sfx = real; settings.cpu = false; felt.quitToHome();
    return out;
  });
  check('A8 audio: the CPU winning plays the quiet sting, not the win; your win and a two-player win still play the win', a8.cpuWins === 'lose' && a8.youWin === 'win' && a8.twoPlayers === 'win', JSON.stringify(a8));

  /* A13 (F12): a miss on 'long', back to the list, reopened: try 2, and after a reload too; a make
     now earns two stars, not three */
  const a13 = await kp.evaluate(async () => {
    const idle = () => new Promise(r => { const w = () => ['stroke', 'rolling', 'thinking'].includes(felt.state) ? setTimeout(w, 10) : r(); w(); });
    localStorage.removeItem('felt.tricks'); localStorage.removeItem('felt.trickTries.v1');
    felt.speed = 30; felt.trick('long');
    felt.shoot(Math.PI / 2, 0.08, 0); await idle();
    const miss = felt.lastTrick.ok;
    felt.quitToHome(); felt.showTricks(); felt.trick('long');
    const reopened = { tries: felt.solo.attempts, chip: turnChip.dataset.name, stored: JSON.parse(localStorage.getItem('felt.trickTries.v1')) };
    felt.quitToHome(); felt.speed = 1;
    return { miss, reopened };
  });
  await kp.reload(); await kp.waitForFunction(() => window.booted === true);
  const a13b = await kp.evaluate(async () => {
    const idle = () => new Promise(r => { const w = () => ['stroke', 'rolling', 'thinking'].includes(felt.state) ? setTimeout(w, 10) : r(); w(); });
    felt.speed = 30; felt.trick('long');
    const chip = turnChip.dataset.name, L = TRICK_SOLS.long[TABLE + POCKETS_STYLE[0]];
    felt.shoot(L[0], L[1], { x: L[2], y: L[3] }); await idle();
    const made = felt.lastTrick;
    felt.quitToHome(); felt.speed = 1;
    localStorage.setItem('felt.trickTries.v1', '{"v":2,"n":{"long":"x"}}');
    return { chip, made, best: felt.trickBest.long };
  });
  await kp.reload(); await kp.waitForFunction(() => window.booted === true);
  const a13c = await kp.evaluate(() => felt.trickTries);
  check('A13 (F12) trick tries persist per challenge: a miss, the list, reopened is Try 2 (stored v1), after a reload still Try 2; a make then earns 2 stars, not 3; a bad record reads as none',
    a13.miss === false && a13.reopened.tries === 1 && a13.reopened.chip === 'Try 2' && a13.reopened.stored.v === 1 && a13.reopened.stored.n.long === 1
    && a13b.chip === 'Try 2' && a13b.made.ok && a13b.made.attempts === 2 && a13b.made.stars === 2 && a13b.best === 2 && JSON.stringify(a13c) === '{}', JSON.stringify({ a13, a13b, a13c }));

  /* A9: a banner on show, then the pause menu, on a phone on its side */
  await kp.setViewportSize({ width: 956, height: 440 });
  await sleep(300);
  const a9 = await kp.evaluate(async () => {
    felt.start('8');
    flash('turn', 'Player 2 to shoot', '', 60000);
    const before = getComputedStyle(banner).visibility;
    felt.pause();
    const under = getComputedStyle(banner).visibility;
    resumeBtn.click();
    const after = getComputedStyle(banner).visibility;
    return { before, under, after, shown: banner.classList.contains('show') };
  });
  check('A9 the last banner is hidden under the pause menu, and back after Resume', a9.before === 'visible' && a9.under === 'hidden' && a9.after === 'visible' && a9.shown, JSON.stringify(a9));
  a4.errors.push(...k.errors);
  await k.browser.close();
  await a5.browser.close();
  check('no console errors', errors.length === 0 && a4.errors.length === 0, errors.concat(a4.errors).join(' | '));
  await a4.browser.close();
  await browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
