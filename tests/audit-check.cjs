#!/usr/bin/env node
/* audit-check: one regression check per fix of the T4 audit (.buildloop/audit/T4-audit.md),
   each written to fail on the build before the fix and pass after it.
   A1 the frame loop survives an exception thrown inside a frame (it once stopped for good).
   A2 the live roll keeps real time at any display rate (rounding per frame ran 144 Hz 4% slow).
   A3 the daily shot's first try counts when it is struck: quitting mid-roll no longer frees a retry.
   A4 a daily record whose last day is in the future neither shows its streak nor blocks scoring.
   A5 a stored daily date that names no real day is dropped.
   A6 (F8) the CPU's think time: it waits as cpuThinkMs says (the break briefly), the frame never
      stalls meanwhile, a tap on the table skips the wait, and felt.speed runs it faster. */
'use strict';
const { check, done, open } = require('./lib.cjs');

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

  /* A6 (F8): the CPU breaks at speed 1. It holds until its think time is up, counted from the
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
  check('A6 F8 think time: the CPU\'s break waits its cpuThinkMs (brief: 0.35 to 1.3 s), from the turn\'s start, with no frame gap over 100 ms',
    w1.plan && w1.think && w1.think.intent && w1.think.intent.type === 'break' && w1.think.ms >= 350 && w1.think.ms <= 1300 && w1.at >= w1.think.ms - 20 && w1.at < w1.think.ms + 400 && w1.gap < 100,
    JSON.stringify(w1));
  check('A6 F8 a tap on the table skips the wait; felt.speed 40 cuts it to a fortieth',
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
  await a5.browser.close();
  check('no console errors', errors.length === 0 && a4.errors.length === 0, errors.concat(a4.errors).join(' | '));
  await a4.browser.close();
  await browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
