/* play-check: playing through the page. Placing the cue ball by clicking, the live roll matching
   simulateShot exactly (with and without english, and across a pause), the power bar as the
   only pointer control that shoots (power proportional to the pull, cancel by coming back or
   sliding off), the table only aiming (a 1:1 sweep about the cue ball; no drag on it ever
   shoots), the fine-aim wheel, the english pad, the keyboard, auto aim, the table size, the turn
   passing with a banner and the turn chip, the CPU taking its turn at the chosen level (the
   chip pulses while it thinks), the two-fouls warning in the banner, the chip and the pause
   menu's card, settings surviving a reload, rematch after a win, and touch on a phone. */
'use strict';
const { check, done, open, settled } = require('./lib.cjs');
const DEG = Math.PI / 180;
/* the power a bar pull of d px gives, by the page's own rule (span and arm from where it began) */
const barPower = (d, pos, lo, hi, armPx) => { const span = Math.max(hi - pos, (hi - lo) * 0.5) * 0.92, arm = Math.min(armPx, span * 0.2); return Math.min(1, Math.max(0, (d - arm) / (span - arm))); };

(async () => {
  const { browser, page, errors } = await open();
  /* auto aim off for the gesture checks (it swings the aim at each turn); it has its own below */
  await page.evaluate(() => { felt.speed = 40; settings.autoAim = false; });
  await page.click('#play9');
  await page.waitForTimeout(200);
  const inHand = async () => {
    if ((await page.evaluate(() => felt.state)) !== 'place') return;
    const p = await page.evaluate(() => felt.toScreen(0.4, 0.3));
    await page.mouse.click(p[0], p[1]);
  };

  /* 1. ball in hand: click a kitchen spot to place the cue ball */
  const at = await page.evaluate(() => felt.toScreen(HEAD_X - 0.2, TW / 2 + 0.1));
  await page.mouse.click(at[0], at[1]);
  const placed = await page.evaluate(() => ({ s: felt.state, x: felt.game.balls[0].x, y: felt.game.balls[0].y, hx: HEAD_X }));
  check('clicking the kitchen places the cue ball', placed.s === 'aim' && Math.abs(placed.x - (placed.hx - 0.2)) < 0.01, JSON.stringify(placed));

  /* 2. the live break equals the pure simulation of the same shot */
  const angle = await page.evaluate(() => Math.atan2(FOOT[1] - felt.game.balls[0].y, FOOT[0] - felt.game.balls[0].x));
  const expected = await page.evaluate(a => JSON.stringify(simulateShot(felt.game.balls, { angle: a, power: 1, spin: 0 }).balls.map(b => [b.n, b.on, b.x, b.y])), angle);
  await page.evaluate(a => felt.shoot(a, 1, 0), angle);
  await settled(page);
  const live = await page.evaluate(() => JSON.stringify(felt.lastResult.balls.map(b => [b.n, b.on, b.x, b.y])));
  check('live break matches simulateShot exactly', live === expected);
  const after = await page.evaluate(() => ({ shots: felt.game.shots, s: felt.state, msg: msg.textContent }));
  check('the break is judged and the HUD says so', after.shots === 1 && after.msg.length > 0 && ['aim', 'place', 'over'].includes(after.s), JSON.stringify(after));

  /* 2b. with english, and paused mid-roll: still byte for byte, and the game is kept */
  await inHand();
  const spun = { x: 0.3, y: -0.5 };
  const exp2 = await page.evaluate(s => JSON.stringify(simulateShot(felt.game.balls, { angle: 0.3, power: 0.6, spin: s }).balls.map(b => [b.n, b.on, b.x, b.y])), spun);
  await page.evaluate(() => { felt.speed = 1; });
  const shots0 = await page.evaluate(() => felt.game.shots);
  await page.evaluate(s => felt.shoot(0.3, 0.6, s), spun);
  await page.waitForTimeout(150);
  await page.click('#menuBtn');
  const p1 = await page.evaluate(() => ({ s: felt.state, paused: felt.paused, resume: getComputedStyle(resumeBtn).display, t: felt.simT }));
  await page.waitForTimeout(400);
  const still = await page.evaluate(() => felt.game.shots), t1 = await page.evaluate(() => felt.simT);
  await page.click('#resumeBtn');
  const p2 = await page.evaluate(() => felt.state);
  await page.evaluate(() => { felt.speed = 40; });
  await settled(page);
  const live2 = await page.evaluate(() => JSON.stringify(felt.lastResult.balls.map(b => [b.n, b.on, b.x, b.y])));
  check('pause mid-roll shows the menu with resume, and the roll waits', p1.s === 'menu' && p1.paused && p1.resume !== 'none' && still === shots0 && p1.t > 0 && t1 === p1.t, JSON.stringify({ p1, t1 }));
  check('resume carries on the same game', p2 === 'rolling' && (await page.evaluate(() => felt.game.shots)) === shots0 + 1, p2);
  check('a shot with english, paused and resumed, still matches simulateShot exactly', live2 === exp2);

  /* 3. mouse: backward drags on the table (slow, fast, long, from the cue ball) never arm and
     never shoot: the table only aims. The power bar shoots, power proportional to the pull. */
  await inHand();
  const before = await page.evaluate(() => felt.game.shots);
  const aim = await page.evaluate(() => { const c = felt.game.balls[0]; return { c: felt.toScreen(c.x, c.y), t: felt.toScreen(TL / 2, TW / 2), full: felt.pullFull }; });
  const ux = (aim.t[0] - aim.c[0]) / Math.hypot(aim.t[0] - aim.c[0], aim.t[1] - aim.c[1]), uy = (aim.t[1] - aim.c[1]) / Math.hypot(aim.t[0] - aim.c[0], aim.t[1] - aim.c[1]);
  let sawPull = false;
  for (const [from, len, steps] of [[aim.t, aim.full * 0.5, 8], [aim.t, aim.full * 1.5, 2], [aim.c, aim.full, 6]]) {
    await page.mouse.move(from[0], from[1]);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(from[0] - ux * len * i / steps, from[1] - uy * len * i / steps);
      sawPull = sawPull || await page.evaluate(() => felt.pulling || felt.state !== 'aim');
    }
    await page.mouse.up();
    await page.waitForTimeout(100);
  }
  const tbm = await page.evaluate(() => ({ s: felt.state, shots: felt.game.shots }));
  check('mouse: backward drags on the table (slow, fast, long, from the cue ball) never arm and never shoot', !sawPull && tbm.s === 'aim' && tbm.shots === before, JSON.stringify({ sawPull, ...tbm }));
  const bar0 = await page.evaluate(() => { const r = powerBar.getBoundingClientRect(); return { x: r.x + r.width / 2, lo: r.top, hi: r.bottom, arm: felt.armPx }; });
  const y0 = bar0.lo + 10, dBar = (bar0.hi - bar0.lo) * 0.5;
  await page.mouse.move(bar0.x, y0);
  const aimB = await page.evaluate(() => felt.aim);
  await page.mouse.down();
  await page.mouse.move(bar0.x, y0 + dBar, { steps: 8 });
  const pull = await page.evaluate(() => ({ power: felt.power, pulling: felt.pulling, aim: felt.aim, msg: msg.textContent }));
  await page.mouse.up();
  const stroke = await page.evaluate(() => felt.state);
  await settled(page);
  const shot = await page.evaluate(() => felt.lastShot);
  check('the power bar arms (the cue draws back, the hint says how to let go) and letting go shoots', pull.pulling && pull.power > 0 && /Let go to shoot/.test(pull.msg) && (await page.evaluate(() => felt.game.shots)) === before + 1, JSON.stringify(pull));
  check('the shot strokes the cue before the balls move', stroke === 'stroke' || stroke === 'rolling', stroke);
  const want = barPower(dBar, y0, bar0.lo, bar0.hi, bar0.arm);
  check('bar power is proportional to the pull past its dead zone, at the aim the table set', Math.abs(shot.power - want) < 0.02 && shot.angle === aimB && pull.aim === aimB, JSON.stringify({ shot, want, aimB }));

  /* 3b. pulling the bar and coming back to its start cancels */
  await inHand();
  const n3 = await page.evaluate(() => felt.game.shots);
  await page.mouse.move(bar0.x, y0);
  await page.mouse.down();
  await page.mouse.move(bar0.x, y0 + dBar, { steps: 6 });
  const mid = await page.evaluate(() => ({ power: felt.power, pulling: felt.pulling }));
  await page.mouse.move(bar0.x, y0 + 1, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const c3 = await page.evaluate(() => ({ s: felt.state, shots: felt.game.shots }));
  check('pulling the bar and coming back to the start cancels', mid.pulling && mid.power > 0.05 && c3.s === 'aim' && c3.shots === n3, JSON.stringify({ mid, ...c3 }));

  /* 3c. a sideways drag on the table turns the aim 1:1 with the finger about the cue ball */
  const side = await page.evaluate(() => { const c = felt.game.balls[0]; aimAngle = Math.atan2(TW / 2 - c.y, TL / 2 - c.x); aimLock = null; const a = felt.aim, s = felt.toScreen(c.x + Math.cos(a) * 0.6, c.y + Math.sin(a) * 0.6), t = felt.toScreen(c.x + Math.cos(a) * 0.6 - Math.sin(a) * 0.05, c.y + Math.sin(a) * 0.6 + Math.cos(a) * 0.05); return { s, t }; });
  await page.mouse.move(side.s[0], side.s[1]);
  const a0 = await page.evaluate(() => felt.aim);
  await page.mouse.down();
  await page.mouse.move(side.t[0], side.t[1], { steps: 8 });
  await page.mouse.up();
  const a1 = await page.evaluate(() => ({ aim: felt.aim, s: felt.state, shots: felt.game.shots }));
  const turned = a1.aim - a0;
  check('a sideways drag turns the aim by the finger\'s angle about the cue ball (1:1), without shooting', Math.abs(turned - Math.atan2(0.05, 0.6)) < 0.003 && a1.s === 'aim' && a1.shots === n3, JSON.stringify({ turned, want: Math.atan2(0.05, 0.6), ...a1 }));

  /* 3d. AC3, mouse: the finger swept 90 deg round the cue ball turns the aim 90 deg (+-2); on to
     200 deg, across the +-180 wrap, it keeps up; the sweep never shoots */
  const sw = await page.evaluate(() => { const c = felt.game.balls[0]; return { c: felt.toScreen(c.x, c.y), a: felt.aim, shots: felt.game.shots, r: 120 }; });
  const arc = async (S, pg, from, to, n) => { for (let i = 1; i <= n; i++) { const p = S.a + (from + (to - from) * i / n) * DEG; await pg.mouse.move(S.c[0] + S.r * Math.cos(p), S.c[1] + S.r * Math.sin(p)); } };
  await page.mouse.move(sw.c[0] + sw.r * Math.cos(sw.a), sw.c[1] + sw.r * Math.sin(sw.a));
  const aS = await page.evaluate(() => felt.aim);   /* hover may restate the same aim within +-180 */
  const wrapD = a => Math.atan2(Math.sin(a), Math.cos(a));
  await page.mouse.down();
  await arc(sw, page, 0, 90, 30);
  const s90 = await page.evaluate(() => felt.aim);
  await arc(sw, page, 90, 200, 37);
  const s200 = await page.evaluate(() => ({ aim: felt.aim, pulling: felt.pulling }));
  await page.mouse.up();
  const sEnd = await page.evaluate(() => ({ s: felt.state, shots: felt.game.shots, locked: felt.aimLocked }));
  check('AC3 mouse: a 90 deg sweep about the cue ball turns the aim 90 deg (+-2), 200 deg turns 200, and it never shoots',
    Math.abs(wrapD(s90 - aS) / DEG - 90) <= 2 && Math.abs((s200.aim - aS) / DEG - 200) <= 2 && !s200.pulling && sEnd.s === 'aim' && sEnd.shots === sw.shots && sEnd.locked,
    JSON.stringify({ d90: (s90 - aS) / DEG, d200: (s200.aim - aS) / DEG, ...sEnd }));
  /* 3e. a drag straight across the cue ball: the aim holds while the finger is over it (no 180 flip) */
  const dz = await page.evaluate(() => { const c = felt.game.balls[0]; return { c: felt.toScreen(c.x, c.y), a: felt.aim }; });
  const nx = -Math.sin(dz.a), ny = Math.cos(dz.a);
  await page.mouse.move(dz.c[0] + nx * 100, dz.c[1] + ny * 100);
  dz.a = await page.evaluate(() => felt.aim);   /* hover aims at the press point first */
  await page.mouse.down();
  await page.mouse.move(dz.c[0] - nx * 100, dz.c[1] - ny * 100, { steps: 20 });
  await page.mouse.up();
  const dzA = await page.evaluate(() => felt.aim);
  check('a drag straight across the cue ball leaves the aim alone (no flip through the dead zone)', Math.abs(dzA - dz.a) < 2 * DEG, JSON.stringify({ d: (dzA - dz.a) / DEG }));

  /* 3f. AC4, mouse: the fine-aim wheel. 100 px of drag turns the aim 1.5 to 2.5 deg; fineAim is
     true while it is held, false after */
  const wh = await page.evaluate(() => { const r = fineWheel.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + 10, a: felt.aim, fine0: felt.fineAim }; });
  await page.mouse.move(wh.x, wh.y);
  await page.mouse.down();
  await page.mouse.move(wh.x, wh.y + 100, { steps: 10 });
  const wHeld = await page.evaluate(() => ({ fine: felt.fineAim, aim: felt.aim, roll: getComputedStyle(fineWheel).getPropertyValue('--roll') }));
  await page.mouse.up();
  const wRel = await page.evaluate(() => ({ fine: felt.fineAim, aim: felt.aim, s: felt.state }));
  const wd = (wHeld.aim - wh.a) / DEG;
  check('AC4 mouse: 100 px on the fine-aim wheel turns the aim 1.5-2.5 deg, the ridges roll, fineAim only while held',
    wd >= 1.5 && wd <= 2.5 && !wh.fine0 && wHeld.fine && !wRel.fine && wRel.aim === wHeld.aim && parseFloat(wHeld.roll) !== 0 && wRel.s === 'aim', JSON.stringify({ wd, wHeld, wRel }));

  /* 4. the power bar shoots too */
  if ((await page.evaluate(() => felt.state)) === 'aim') {
    const n0 = await page.evaluate(() => felt.game.shots);
    const bar = await page.evaluate(() => { const r = powerBar.getBoundingClientRect(); return [r.x + r.width / 2, r.y + 8, r.y + r.height * 0.5]; });
    await page.mouse.move(bar[0], bar[1]);
    await page.mouse.down();
    await page.mouse.move(bar[0], bar[2], { steps: 5 });
    const fill = await page.evaluate(() => powerFill.getBoundingClientRect().height);
    await page.mouse.up();
    await settled(page);
    check('pulling the power bar down and letting go shoots', fill > 20 && (await page.evaluate(() => felt.game.shots)) === n0 + 1, 'fill ' + fill);
    check('the bar keeps the last power as a faint mark and is empty again', await page.evaluate(() => powerFill.getBoundingClientRect().height < 1 && powerMark.getBoundingClientRect().top - powerBar.getBoundingClientRect().top > 30));
  } else check('pulling the power bar down and letting go shoots', false, 'game over before the bar test');

  /* 5. the english pad: up-left is follow with left english, a double tap centres it */
  await inHand();
  const pad = await page.evaluate(() => { const r = spinPad.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, R: r.width / 2 * 0.62 }; });
  await page.mouse.click(pad.x - pad.R * 0.5, pad.y - pad.R * 0.6);
  const sp = await page.evaluate(() => ({ s: felt.cueSpin, label: spinLabel.textContent }));
  check('the english pad sets cueSpin x and y', Math.abs(sp.s.x + 0.5) < 0.05 && Math.abs(sp.s.y - 0.6) < 0.05 && sp.label === 'follow, left english', JSON.stringify(sp));
  await page.mouse.move(pad.x + pad.R * 3, pad.y + pad.R * 3);
  await page.mouse.down();
  await page.mouse.move(pad.x + pad.R * 3, pad.y + pad.R * 3);
  await page.mouse.up();
  await page.waitForTimeout(400);
  await page.mouse.click(pad.x + pad.R * 0.9, pad.y + pad.R * 0.9);
  const clampd = await page.evaluate(() => felt.cueSpin);
  check('english stays inside the safe circle', Math.hypot(clampd.x, clampd.y) <= 1 + 1e-9 && clampd.x > 0.6 && clampd.y < -0.6, JSON.stringify(clampd));
  await page.waitForTimeout(400);
  await page.mouse.click(pad.x, pad.y - pad.R * 0.5);
  await page.mouse.click(pad.x, pad.y - pad.R * 0.5);
  check('a double tap centres the english', await page.evaluate(() => felt.cueSpin.x === 0 && felt.cueSpin.y === 0 && spinLabel.textContent === 'center'));

  /* 6. keyboard: arrows aim, space strokes and shoots, R centres the english */
  if ((await page.evaluate(() => felt.state)) === 'aim') {
    await page.mouse.click(pad.x, pad.y + pad.R * 0.8);
    await page.mouse.move(5, 5);
    const k0 = await page.evaluate(() => ({ aim: felt.aim, shots: felt.game.shots }));
    await page.keyboard.press('ArrowRight');
    await page.keyboard.down('Shift'); await page.keyboard.press('ArrowRight'); await page.keyboard.up('Shift');
    await page.keyboard.down('Alt'); await page.keyboard.press('ArrowLeft'); await page.keyboard.up('Alt');
    const k1 = await page.evaluate(() => felt.aim), fs = await page.evaluate(() => felt.fineStep);
    check('arrows aim: normal, shift coarse, alt fine (one ridge of the fine-aim wheel)', Math.abs(k1 - k0.aim - (0.004 + 0.03 - fs)) < 1e-9 && Math.abs(fs - 4 * 0.02 * DEG) < 1e-12, String(k1 - k0.aim));
    await page.keyboard.press('r');
    check('R centres the english', await page.evaluate(() => felt.cueSpin.y === 0));
    /* no key shoots: Space, Enter (on the page, the bar, the wheel), up and down */
    for (const sel of [null, '#powerBar', '#fineWheel', '#spinPad']) {
      if (sel) await page.evaluate(s => document.querySelector(s).focus(), sel);
      for (const key of ['Space', 'Enter', 'ArrowUp', 'ArrowDown']) await page.keyboard.press(key);
    }
    await page.waitForTimeout(300);
    const kn = await page.evaluate(() => ({ s: felt.state, shots: felt.game.shots, pulling: felt.pulling }));
    check('no key shoots: Space, Enter, up and down in the aim state leave the shot unplayed', kn.s === 'aim' && kn.shots === k0.shots && !kn.pulling, JSON.stringify(kn));
    await page.evaluate(() => document.activeElement.blur());
  }

  /* 7. vs CPU on hard: miss on purpose, the foul banner shows, the CPU places and shoots */
  await page.click('#menuBtn');
  await page.click('#vsCpu');
  await page.click('#lvHard');
  await page.click('#play8');
  const k = await page.evaluate(() => felt.toScreen(HEAD_X - 0.1, TW / 2));
  await page.mouse.click(k[0], k[1]);
  await page.evaluate(() => felt.shoot(Math.PI, 0.01, 0));
  await page.waitForFunction(() => felt.state !== 'rolling', null, { timeout: 30000 });
  const foul = await page.evaluate(() => ({ head: bannerHead.textContent, on: banner.classList.contains('show'), kind: banner.dataset.kind,
    chip: { name: chipName.textContent, busy: turnChip.classList.contains('busy'), thinking: felt.state === 'thinking' && !cpuPlan } }));
  check('a foul raises a foul banner', foul.on && foul.kind === 'foul' && foul.head.startsWith('Foul'), JSON.stringify(foul));
  check('the turn passes to the CPU: the chip says CPU and pulses while it thinks', foul.chip.name === 'CPU' && foul.chip.busy === foul.chip.thinking, JSON.stringify(foul.chip));
  await page.waitForFunction(() => felt.game.shots >= 2 || felt.game.winner !== null, null, { timeout: 60000 });
  await settled(page, 60000);
  const c = await page.evaluate(() => ({ shots: felt.game.shots, turn: felt.game.turn, s: felt.state, lvl: felt.lastCpu }));
  check('after a foul the CPU places the cue ball and shoots', c.shots >= 2, JSON.stringify(c));
  check('the chosen CPU level reaches cpuSearch', c.lvl && c.lvl.level === 'hard', JSON.stringify(c.lvl));

  /* 8. a won game offers a rematch, with the score */
  await page.evaluate(() => felt.forceWin(0));
  await page.waitForTimeout(100);
  const over = await page.evaluate(() => ({ s: felt.state, vis: getComputedStyle(rematch).display, title: overText.textContent, rows: overStats.querySelectorAll('tbody tr').length }));
  check('a win shows who won, the stats and the rematch button', over.s === 'over' && over.vis !== 'none' && over.title === 'You win' && over.rows === 3, JSON.stringify(over));
  await page.click('#rematch');
  check('rematch starts a fresh rack', await page.evaluate(() => felt.game.shots === 0 && felt.game.winner === null && felt.state === 'place'));

  /* 9. settings survive a reload */
  await page.click('#menuBtn');
  await page.click('#gShort');
  await page.click('#sndOff');
  await page.evaluate(() => { window.oldImg = tableImg; });
  await page.click('#clRed');
  const repaint = await page.evaluate(() => tableImg !== window.oldImg && document.documentElement.dataset.cloth === 'red');
  await page.reload();
  await page.waitForFunction(() => window.booted === true);
  const cl = await page.evaluate(() => ({ s: felt.settings.cloth, red: clRed.getAttribute('aria-pressed'), green: clGreen.getAttribute('aria-pressed'), root: document.documentElement.dataset.cloth }));
  check('cloth: red is chosen in the menu, the table repaints, and it persists across a reload', repaint && cl.s === 'red' && cl.red === 'true' && cl.green === 'false' && cl.root === 'red', JSON.stringify(cl));
  const st = await page.evaluate(() => ({ s: felt.settings, hard: lvHard.getAttribute('aria-pressed'), short: gShort.getAttribute('aria-pressed'), level: getComputedStyle(levelSeg).display }));
  check('settings persist across a reload', st.s.guide === 'short' && st.s.cpu === true && st.s.level === 'hard' && st.s.sound === false && st.hard === 'true' && st.short === 'true' && st.level !== 'none', JSON.stringify(st));

  /* a cue-ball drag still held through a keyboard place and a shot cannot stop the roll */
  if (!(await page.evaluate(() => menu.classList.contains('show')))) await page.click('#menuBtn');
  await page.click('#vs2p');
  await page.click('#play9');
  const hold = await page.evaluate(() => felt.toScreen(HEAD_X - 0.2, TW / 2));
  await page.mouse.move(hold[0], hold[1]);
  await page.mouse.down();
  await page.keyboard.press('Enter');
  await page.evaluate(() => { felt.speed = 1; felt.shoot(0, 1, 0); });
  await page.waitForFunction(() => felt.state === 'rolling', null, { timeout: 5000 });
  await page.mouse.move(hold[0] + 40, hold[1] + 30, { steps: 3 });
  await page.mouse.up();
  const held = await page.evaluate(() => felt.state);
  await page.evaluate(() => { felt.speed = 40; });
  await settled(page);
  check('letting go of a held cue-ball drag after the shot leaves the roll alone', held === 'rolling' && (await page.evaluate(() => felt.game.shots)) === 1, held);

  /* 11. how a gesture becomes a shot (or does not), with a mouse. setup(): a two-player rack with
     the cue ball down at (x, middle), aiming along +x (to the right on screen), still in hand or not */
  const setup = (x = 0.5, hand = false) => page.evaluate(([x, hand]) => {
    settings.cpu = false; settings.autoAim = false; felt.start('8'); tryPlace([x, TW / 2]);
    if (!hand) game.inHand = null;
    aimAngle = 0; felt.speed = 40;
    const c = felt.game.balls[0];
    return { c: felt.toScreen(c.x, c.y), full: felt.pullFull, arm: felt.armPx, shots: felt.game.shots };
  }, [x, hand]);
  const idle = () => page.evaluate(() => ({ s: felt.state, shots: felt.game.shots, pulling: felt.pulling, aim: felt.aim, power: felt.power, msg: msg.textContent }));
  await page.mouse.move(5, 5);
  let S = await setup();
  const P = [S.c[0] + 300, S.c[1] + 40], aimP = Math.atan2(40, 300);
  await page.mouse.move(P[0], P[1]);
  check('hover over the cloth aims at the pointer', Math.abs((await idle()).aim - aimP) < 0.01, String((await idle()).aim));
  /* a sloppy click: press, drift 10 px back, let go */
  await page.mouse.down();
  await page.mouse.move(P[0] - 10, P[1] - 1.3, { steps: 3 });
  await page.mouse.up();
  let I = await idle();
  check('a click that drifts 10 px back does not shoot, and aims where it was pressed', I.s === 'aim' && I.shots === S.shots && !I.pulling && Math.abs(I.aim - aimP) < 0.01, JSON.stringify(I));
  /* backward drags along the line: short of the old arm distance, past it, out past the rails */
  const vx = Math.cos(aimP), vy = Math.sin(aimP), bk = d => [P[0] - vx * d, P[1] - vy * d];
  let anyPull = false;
  for (const d of [S.arm - 6, S.arm + 60, S.full * 1.2]) {
    await page.mouse.move(P[0], P[1]);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) { await page.mouse.move(...bk(d * i / 6)); anyPull = anyPull || (await idle()).pulling; }
    await page.mouse.up();
  }
  I = await idle();
  check('mouse: a backward drag along the line, short, long or off the table, never arms and never shoots', !anyPull && I.s === 'aim' && I.shots === S.shots && !/Let go/.test(I.msg), JSON.stringify(I));
  /* the bar: an armed pull shows the cue, the power and the hint; back under its arm distance cancels */
  const bar = await page.evaluate(() => { const r = powerBar.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + 8, h: r.height, left: r.x }; });
  await page.mouse.move(bar.x, bar.y);
  await page.mouse.down();
  await page.mouse.move(bar.x, bar.y + bar.h * 0.5, { steps: 6 });
  const armed = await idle();
  await page.mouse.move(bar.x, bar.y + 4, { steps: 4 });
  const under = await idle();
  await page.mouse.up();
  I = await idle();
  check('an armed bar pull shows the cue, the power and a let-go-or-cancel hint', armed.pulling && armed.power > 0.1 && /Let go to shoot/.test(armed.msg), JSON.stringify(armed));
  check('sliding the bar back under its arm distance and letting go cancels', under.power === 0 && I.s === 'aim' && I.shots === S.shots && !I.pulling && !/Let go/.test(I.msg), JSON.stringify({ under, I }));
  /* the power bar: leaving it sideways cancels, and stays cancelled */
  await page.mouse.move(bar.x, bar.y);
  await page.mouse.down();
  await page.mouse.move(bar.x, bar.y + bar.h * 0.5, { steps: 5 });
  const onBar = await idle();
  await page.mouse.move(bar.left - 80, bar.y + bar.h * 0.5, { steps: 5 });
  const offBar = await idle();
  await page.mouse.move(bar.x, bar.y + bar.h * 0.6, { steps: 5 });
  const backOn = await idle();
  await page.mouse.up();
  I = await idle();
  check('leaving the power bar sideways cancels its pull, and stays cancelled', onBar.pulling && onBar.power > 0.2 && !offBar.pulling && !backOn.pulling && I.s === 'aim' && I.shots === S.shots, JSON.stringify({ onBar, offBar, I }));
  /* fine aim survives a 1 px jitter; a real move takes the aim back */
  await page.mouse.move(P[0], P[1]);
  await page.waitForTimeout(200);
  const pre = (await idle()).aim, fstep = await page.evaluate(() => felt.fineStep);
  await page.keyboard.down('Alt'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.up('Alt');
  const fine = await idle();
  await page.mouse.move(P[0] + 1, P[1]);
  await page.mouse.move(P[0], P[1] + 1);
  const jit = await idle();
  check('a fine aim (two Alt+arrow steps) survives a 1 px mouse jitter', Math.abs(fine.aim - pre - 2 * fstep) < 1e-9 && jit.aim === fine.aim, JSON.stringify({ fine: fine.aim - pre, jit: jit.aim - fine.aim }));
  /* going to the bar and pulling keeps the locked aim */
  await page.mouse.move(bar.x, bar.y, { steps: 6 });
  await page.mouse.down();
  await page.mouse.move(bar.x, bar.y + bar.h * 0.4, { steps: 5 });
  const lockPull = await idle();
  await page.mouse.move(bar.x, bar.y, { steps: 5 });
  await page.mouse.up();
  check('pulling the power bar keeps the fine aim', lockPull.pulling && lockPull.aim === fine.aim, JSON.stringify(lockPull));
  await page.mouse.move(P[0] + 10, P[1] + 60, { steps: 4 });
  check('moving the mouse well away unlocks the aim, and hover aims again', Math.abs((await idle()).aim - Math.atan2(100, 310)) < 0.01, String((await idle()).aim));
  /* hover aim, rest, then a dash to the power bar: the aim stays where it rested */
  await page.mouse.move(P[0], P[1]);
  await page.waitForTimeout(300);
  const rested = (await idle()).aim;
  await page.mouse.move(bar.x, bar.y + bar.h * 0.5, { steps: 15 });
  const atBar = (await idle()).aim;
  check('moving the mouse from the table to the power bar leaves the aim unchanged', Math.abs(atBar - rested) < 1e-9, JSON.stringify({ rested, atBar }));
  /* ball in hand, placed: a backward drag from the cue ball only aims; the ball stays put */
  S = await setup(0.4, true);
  await page.mouse.move(S.c[0], S.c[1]);
  await page.mouse.down();
  await page.mouse.move(S.c[0] - S.full * 0.8, S.c[1], { steps: 8 });
  const cuePull = await page.evaluate(() => ({ s: felt.state, pulling: felt.pulling, x: felt.game.balls[0].x, power: felt.power }));
  await page.mouse.up();
  await page.waitForTimeout(200);
  const cueAfter = await idle();
  check('ball in hand, placed: a backward drag from the cue ball never pulls or shoots, the ball stays put', cuePull.s === 'aim' && !cuePull.pulling && Math.abs(cuePull.x - 0.4) < 1e-9 && cueAfter.s === 'aim' && cueAfter.shots === S.shots, JSON.stringify({ cuePull, cueAfter }));
  S = await setup(0.4, true);
  await page.mouse.click(S.c[0], S.c[1]);
  const pick = await page.evaluate(() => ({ s: felt.state, lab: powerLab.textContent }));
  check('ball in hand, placed: a click on the cue ball picks it up again, and the bar says so', pick.s === 'place' && pick.lab === 'Place the ball', JSON.stringify(pick));
  /* the english pad: a quick second drag is not a double tap */
  await setup();
  const pd = await page.evaluate(() => { const r = spinPad.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  for (const dy of [-12, 12]) {
    await page.mouse.move(pd.x - 4, pd.y);
    await page.mouse.down();
    await page.mouse.move(pd.x - 4, pd.y + dy, { steps: 3 });
    await page.mouse.up();
  }
  const redrag = await page.evaluate(() => felt.cueSpin);
  check('english pad: a quick re-drag does not centre the english', Math.hypot(redrag.x, redrag.y) > 0.2, JSON.stringify(redrag));

  /* 12. the words: game-over sentences, the break-scratch hand, the two-foul warning */
  const lines = await page.evaluate(() => {
    const g = (winner, verdict) => ({ winner, verdict });
    const out = [
      felt.overLine(g(0, { why: 'the 8, legally' })),
      felt.overLine(g(1, { why: 'the 8 went down on a foul', foul: 'scratch', scratch: true })),
      felt.overLine(g(1, { why: 'the 8 went down on a foul', foul: 'hit the 3 first', scratch: false })),
      felt.overLine(g(0, { why: 'the 8 went down before the group was clear' })),
      felt.overLine(g(1, { why: 'the 9' })),
      felt.overLine(g(0, { why: 'three fouls in a row' })),
    ];
    cpuMode = true;
    out.push(felt.overLine(g(1, { why: 'the 8 went down before the group was clear' })), handWords(0, true));
    cpuMode = false;
    out.push(handWords(1, true), handWords(0, false));
    return out;
  });
  const wantLines = ['Player 1 potted the 8 to win.', 'Player 1 scratched while potting the 8.', 'Player 1 potted the 8 on a foul (hit the 3 first).',
    'Player 2 potted the 8 before clearing their group.', 'Player 2 potted the 9 to win.', 'Player 2 fouled three times in a row.',
    'You potted the 8 before clearing your group.', 'Ball in hand for you behind the head string',
    'Player 2: ball in hand behind the head string', 'Player 1: ball in hand'];
  check('game-over and ball-in-hand lines are whole sentences', JSON.stringify(lines) === JSON.stringify(wantLines), JSON.stringify(lines));
  await page.evaluate(() => { settings.cpu = false; felt.start('9'); tryPlace([0.4, TW / 2]); game.fouls = [1, 0]; felt.speed = 40; felt.shoot(Math.PI, 0.01, 0); });
  await settled(page);
  const two = await page.evaluate(() => ({ sub: bannerSub.textContent, kind: banner.dataset.kind, chip: chipName.textContent, chipWarn: turnChip.classList.contains('warn') }));
  await page.click('#menuBtn');
  Object.assign(two, await page.evaluate(() => ({ meta: p0meta.textContent, warn: p0meta.classList.contains('warn'), shown: !gameNow.hidden && p0meta.getBoundingClientRect().height > 0 })));
  await page.click('#resumeBtn');
  check('9-ball: a second foul in a row warns that a third loses (banner, and the card in the pause menu)', /Player 1 is on two fouls: a third loses/.test(two.sub) && two.kind === 'foul' && /Two fouls/.test(two.meta) && two.warn && two.shown, JSON.stringify(two));
  const chipTwo = await page.evaluate(() => {
    const was = game.fouls.slice(), out = {};
    game.fouls = [0, 2]; hud(); out.on = [chipName.textContent, turnChip.classList.contains('warn')];
    game.fouls = [2, 0]; hud(); out.off = [chipName.textContent, turnChip.classList.contains('warn')];
    game.fouls = was; hud();
    return out;
  });
  check('9-ball: the turn chip of the player to shoot on two fouls is marked, and only theirs', two.chip === 'P2' && !two.chipWarn && chipTwo.on[0] === 'P2' && chipTwo.on[1] && !chipTwo.off[1], JSON.stringify({ two, chipTwo }));

  /* 14. auto aim. On: the break starts aimed at the head ball, and each later human turn starts,
     once the cue has swung round, within 1 deg of suggestAim(game). Off: the aim is left alone.
     The setting persists. */
  await page.click('#menuBtn');
  await page.click('#aaOn');
  await page.click('#vs2p');
  await page.click('#play9');
  const brk = await page.evaluate(async () => {
    felt.speed = 40; tryPlace([HEAD_X - 0.2, TW / 2 + 0.1]);
    await new Promise(r => setTimeout(r, 150));
    const c = game.balls[0], one = game.balls.find(b => b.n === 1);
    return { on: settings.autoAim, d: Math.abs(wrapAngle(felt.aim - Math.atan2(one.y - c.y, one.x - c.x))) / (Math.PI / 180), locked: felt.aimLocked };
  });
  check('auto aim: the break starts aimed at the head ball, and that aim is locked', brk.on && brk.d < 1 && brk.locked, JSON.stringify(brk));
  /* the turn after a shot: if it is ball in hand, place it first */
  const nextTurn = () => page.evaluate(async () => {
    if (felt.state === 'place') tryPlace(nearestLegal(0.5, 0.35) || [0.5, 0.35]);
    await new Promise(r => setTimeout(r, 150));
    const s = suggestAim(game);
    return { s: felt.state, aim: felt.aim, d: s ? Math.abs(wrapAngle(felt.aim - s.angle)) / (Math.PI / 180) : null, locked: felt.aimLocked };
  });
  const autoRuns = [];
  for (const [a, p] of [[Math.PI, 0.02], [null, 0.25]]) {
    await page.evaluate(([a, p]) => { const c = game.balls[0], s = suggestAim(game); felt.shoot(a === null ? s.angle : a, p, 0); }, [a, p]);
    await settled(page);
    autoRuns.push(await nextTurn());
  }
  check('auto aim on: after a shot (a foul and ball in hand, then a hit) the turn starts within 1 deg of suggestAim(game)', autoRuns.every(r => r.s === 'aim' && r.d !== null && r.d < 1 && r.locked), JSON.stringify(autoRuns));
  await page.click('#menuBtn');
  await page.click('#aaOff');
  await page.click('#resumeBtn');
  const offShot = await page.evaluate(() => felt.state === 'aim' && felt.shoot(Math.PI / 2 + 0.3, 0.02, 0));
  await settled(page);
  const offRun = await page.evaluate(async () => {
    if (felt.state === 'place') tryPlace(nearestLegal(0.5, 0.35) || [0.5, 0.35]);
    await new Promise(r => setTimeout(r, 150));
    return { s: felt.state, aim: felt.aim, on: settings.autoAim };
  });
  check('auto aim off: the next turn keeps the aim the last shot left', offShot && !offRun.on && offRun.s === 'aim' && Math.abs(offRun.aim - (Math.PI / 2 + 0.3)) < 1e-9, JSON.stringify(offRun));
  await page.reload();
  await page.waitForFunction(() => window.booted === true);
  const aaSt = await page.evaluate(() => ({ on: felt.settings.autoAim, off: aaOff.getAttribute('aria-pressed') }));
  check('auto aim: the setting persists across a reload', aaSt.on === false && aaSt.off === 'true', JSON.stringify(aaSt));

  /* 15. the table size: the menu control persists, and start() sets that table before the rack.
     setTable is wrapped to record its calls. */
  const wrapTable = () => page.evaluate(() => { window.tableCalls = []; const f = setTable; window.setTable = s => { tableCalls.push(s); f(s); }; });
  await wrapTable();
  const t7 = await page.evaluate(() => ({ s: felt.settings.table, p: tb7.getAttribute('aria-pressed') }));
  await page.click('#tb9');
  const preview = await page.evaluate(() => tableCalls.slice());
  await page.reload();
  await page.waitForFunction(() => window.booted === true);
  await wrapTable();
  const t9 = await page.evaluate(() => ({ s: felt.settings.table, p: tb9.getAttribute('aria-pressed') }));
  await page.click('#play8');
  const g9 = await page.evaluate(() => ({ calls: tableCalls.slice(), table: felt.table, s: felt.state }));
  check('table size: 7 ft by default, the menu choice persists, and a new game starts on that table', t7.s === '7' && t7.p === 'true' && preview.includes('9') && t9.s === '9' && t9.p === 'true' && g9.calls[g9.calls.length - 1] === '9' && g9.table === '9' && g9.s === 'place', JSON.stringify({ t7, preview, t9, g9 }));
  /* the 9 ft table plays too: the live roll still equals simulateShot byte for byte */
  const nine = await page.evaluate(async () => {
    felt.speed = 40; tryPlace([HEAD_X - 0.2, TW / 2]);
    const c = game.balls[0], a = Math.atan2(FOOT[1] - c.y, FOOT[0] - c.x);
    const want = JSON.stringify(simulateShot(game.balls, { angle: a, power: 0.9, spin: 0 }).balls.map(b => [b.n, b.on, b.x, b.y]));
    felt.shoot(a, 0.9, 0);
    while (['stroke', 'rolling'].includes(felt.state)) await new Promise(r => setTimeout(r, 50));
    return { same: JSON.stringify(felt.lastResult.balls.map(b => [b.n, b.on, b.x, b.y])) === want, TL };
  });
  check('9 ft table: the live break matches simulateShot exactly', nine.same && nine.TL > 2.5, JSON.stringify(nine));
  await page.click('#menuBtn');
  await page.click('#tb7');
  const g7 = await page.evaluate(() => { tableCalls.length = 0; felt.start('8'); return { calls: tableCalls.slice(), table: felt.table, TL }; });
  check('table size: back to 7 ft, the next game is on the 7 ft table (1.981 m)', g7.calls[0] === '7' && g7.table === '7' && Math.abs(g7.TL - 1.981) < 1e-9, JSON.stringify(g7));

  check('no console errors', errors.length === 0, errors.join(' | '));
  await browser.close();

  /* 10. touch, on a phone: tap to place, tap to aim, a backward drag only aims, the bar shoots */
  const t = await open('', { viewport: { width: 390, height: 844 }, hasTouch: true });
  await t.page.evaluate(() => { felt.speed = 40; settings.autoAim = false; });
  await t.page.tap('#play9');
  const kt = await t.page.evaluate(() => felt.toScreen(HEAD_X - 0.15, TW / 2 - 0.2));
  await t.page.touchscreen.tap(kt[0], kt[1]);
  check('touch: a tap places the cue ball', await t.page.evaluate(() => felt.state === 'aim'));
  const ap = await t.page.evaluate(() => { const c = felt.game.balls[0]; return { s: felt.toScreen(FOOT[0], FOOT[1]), want: Math.atan2(FOOT[1] - c.y, FOOT[0] - c.x) }; });
  await t.page.touchscreen.tap(ap.s[0], ap.s[1]);
  const got = await t.page.evaluate(() => felt.aim);
  check('touch: a tap on the table aims at it', Math.abs(got - ap.want) < 0.01, JSON.stringify({ got, want: ap.want }));
  const cdp = await t.page.context().newCDPSession(t.page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  /* backward drags along the line: from beside the table's middle, a fast long one, one from the cue ball */
  const tb = await t.page.evaluate(() => {
    const c = felt.game.balls[0], a = felt.aim, at = d => felt.toScreen(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d);
    return { s: at(0.3), e: at(-0.1), far: at(-0.5), c: at(0), cb: at(-0.35) };
  });
  let tPull = false;
  for (const [from, to, n] of [[tb.s, tb.e, 6], [tb.s, tb.far, 2], [tb.c, tb.cb, 6]]) {
    await touch('touchStart', from[0], from[1]);
    for (let i = 1; i <= n; i++) { await touch('touchMove', from[0] + (to[0] - from[0]) * i / n, from[1] + (to[1] - from[1]) * i / n); tPull = tPull || await t.page.evaluate(() => felt.pulling || felt.state !== 'aim'); }
    await touch('touchEnd');
  }
  await t.page.waitForTimeout(150);
  const tAfter = await t.page.evaluate(() => ({ s: felt.state, shots: felt.game.shots }));
  check('touch: backward drags on the table (beside the line, fast and long, from the cue ball) never arm and never shoot', !tPull && tAfter.s === 'aim' && tAfter.shots === 0, JSON.stringify({ tPull, ...tAfter }));
  /* the bar: the only thing on the screen that shoots, power proportional to the pull */
  const bb = await t.page.evaluate(() => { const r = powerBar.getBoundingClientRect(); return { lo: r.left, hi: r.right, y: r.y + r.height / 2, h: r.height, arm: felt.armPx, aim: felt.aim }; });
  const bx0 = bb.lo + 10, bd = (bb.hi - bb.lo) * 0.6;
  await touch('touchStart', bx0, bb.y);
  for (let i = 1; i <= 5; i++) await touch('touchMove', bx0 + bd * i / 5, bb.y);
  const tBar = await t.page.evaluate(() => ({ pulling: felt.pulling, power: felt.power }));
  await touch('touchEnd');
  await settled(t.page);
  const tShot = await t.page.evaluate(() => ({ shots: felt.game.shots, shot: felt.lastShot }));
  const tWant = barPower(bd, bx0, bb.lo, bb.hi, bb.arm);
  check('touch: pulling the power bar arms (the cue draws back) and shoots, power proportional, at the aim the table set',
    tBar.pulling && tShot.shots === 1 && Math.abs(tShot.shot.power - tWant) < 0.02 && tShot.shot.angle === bb.aim && bb.h >= 56 && bb.hi - bb.lo >= 150, JSON.stringify({ tBar, tShot, tWant, bb }));
  check('touch: no console errors', t.errors.length === 0, t.errors.join(' | '));
  await t.browser.close();

  /* 13. touch gestures on a phone (dpr 3, real touch events): sloppy taps, sweeps, drags that
     must never shoot, the placed cue ball, a rotation mid-pull, the fine-aim wheel, the english
     pad, pinch */
  const m = await open('', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const mp = m.page, mc = await mp.context().newCDPSession(mp);
  const tch = (type, x, y) => mc.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const swipe = async (from, to, n = 6) => { for (let i = 1; i <= n; i++) await tch('touchMove', from[0] + (to[0] - from[0]) * i / n, from[1] + (to[1] - from[1]) * i / n); };
  const msetup = (x = 0.5, hand = false) => mp.evaluate(([x, hand]) => {
    settings.cpu = false; settings.autoAim = false; felt.start('8'); tryPlace([x, TW / 2]);
    if (!hand) game.inHand = null;
    aimAngle = 0; felt.speed = 40;
    const c = felt.game.balls[0], s = felt.toScreen(c.x, c.y), u = felt.toScreen(c.x + 0.1, c.y);
    return { c: s, ang: Math.atan2(u[1] - s[1], u[0] - s[0]), q: felt.toScreen(TL - 0.4, TW / 2 + 0.2), want: Math.atan2(0.2, TL - 0.4 - x), full: felt.pullFull, arm: felt.armPx, shots: felt.game.shots, tw: TW, bx: c.x };
  }, [x, hand]);
  const mstate = () => mp.evaluate(() => ({ s: felt.state, shots: felt.game.shots, pulling: felt.pulling, aim: felt.aim, power: felt.power, x: felt.game.balls[0].x, fine: felt.fineAim }));
  /* portrait: aim 0 points up the screen, so "back" is down */
  let M = await msetup();
  await tch('touchStart', M.q[0], M.q[1]);
  await swipe(M.q, [M.q[0] + 12, M.q[1] + 2], 3);
  await tch('touchEnd');
  let ms = await mstate();
  check('touch: a tap that slides 12 px sideways still aims where it landed', Math.abs(ms.aim - M.want) < 0.01 && ms.shots === M.shots, JSON.stringify({ ms, want: M.want }));
  M = await msetup();
  const tilt = 50 * Math.PI / 180, tEnd = [M.q[0] + 120 * Math.cos(tilt), M.q[1] + 120 * Math.sin(tilt)];
  await tch('touchStart', M.q[0], M.q[1]);
  await swipe(M.q, tEnd, 10);
  await tch('touchEnd');
  ms = await mstate();
  check('touch: a drag tilted 50 deg below horizontal sweeps the aim and never shoots', ms.s === 'aim' && ms.shots === M.shots && !ms.pulling && Math.abs(ms.aim) > 0.005, JSON.stringify(ms));
  /* straight back, well past where the old table pull armed, then sideways: only ever aims */
  M = await msetup();
  await tch('touchStart', M.q[0], M.q[1]);
  await swipe(M.q, [M.q[0], M.q[1] + M.arm + 70]);
  const tBack = await mstate();
  await swipe([M.q[0], M.q[1] + M.arm + 70], [M.q[0] + 90, M.q[1] + M.arm + 70]);
  const tSide = await mstate();
  await tch('touchEnd');
  ms = await mstate();
  check('touch: a long backward drag, then sideways, never arms or shoots', !tBack.pulling && !tSide.pulling && ms.s === 'aim' && ms.shots === M.shots, JSON.stringify({ tBack, tSide, ms }));
  await tch('touchStart', M.q[0], M.q[1]);
  await tch('touchMove', M.q[0], M.q[1] + M.arm + 90);
  await tch('touchMove', M.q[0], M.q[1] + 4);
  await tch('touchEnd');
  ms = await mstate();
  check('touch: a fast flick back and return never shoots', ms.s === 'aim' && ms.shots === M.shots && !ms.pulling, JSON.stringify(ms));
  /* a pinch: the second finger stops the sweep and puts the aim back where the press began */
  M = await msetup();
  const pinch = (type, a, b) => mc.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: a[0], y: a[1], id: 1 }, ...(b ? [{ x: b[0], y: b[1], id: 2 }] : [])] });
  await mc.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: M.q[0], y: M.q[1], id: 1 }] });
  for (let i = 1; i <= 6; i++) await mc.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: M.q[0] + 60 * i / 6, y: M.q[1] + 40 * i / 6, id: 1 }] });
  const pSwept = await mstate();
  const f1 = [M.q[0] + 60, M.q[1] + 40];
  await pinch('touchStart', f1, [M.q[0], M.q[1] - 40]);
  for (let i = 1; i <= 4; i++) await pinch('touchMove', [f1[0], f1[1] + 10 * i], [M.q[0], M.q[1] - 40 - 10 * i]);
  await pinch('touchEnd');
  await mp.waitForTimeout(100);
  ms = await mstate();
  check('touch: a second finger stops a sweep and puts the aim back, and a pinch never shoots', Math.abs(pSwept.aim) > 0.01 && ms.s === 'aim' && ms.shots === M.shots && !ms.pulling && ms.aim === 0, JSON.stringify({ pSwept, ms }));
  /* the placed cue ball: a backward drag only aims; a tap picks it up; holding it slides it */
  M = await msetup(0.6, true);
  await tch('touchStart', M.c[0], M.c[1]);
  await swipe(M.c, [M.c[0], M.c[1] + M.full * 0.8], 8);
  const cp = await mstate();
  await tch('touchEnd');
  await mp.waitForTimeout(150);
  const cpAfter = await mstate();
  check('touch: ball in hand, placed: a backward drag from the cue ball never pulls or shoots, the ball stays put', cp.s === 'aim' && !cp.pulling && cp.x === M.bx && cpAfter.x === M.bx && cpAfter.s === 'aim' && cpAfter.shots === M.shots, JSON.stringify({ cp, cpAfter }));
  M = await msetup(0.6, true);
  await tch('touchStart', M.c[0], M.c[1]);
  await tch('touchEnd');
  const tp1 = await mp.evaluate(() => ({ s: felt.state, lab: powerLab.textContent }));
  check('touch: a tap on the placed cue ball picks it up', tp1.s === 'place' && tp1.lab === 'Place the ball', JSON.stringify(tp1));
  M = await msetup(0.6, true);
  await tch('touchStart', M.c[0], M.c[1]);
  await mp.waitForTimeout(600);
  const held2 = await mstate();
  await swipe(M.c, [M.c[0] + 40, M.c[1]], 4);
  await tch('touchEnd');
  const moved = await mp.evaluate(() => ({ s: felt.state, y: felt.game.balls[0].y }));
  check('touch: holding the placed cue ball picks it up and a drag slides it', held2.s === 'place' && moved.s === 'aim' && moved.y > M.tw / 2 + 0.1, JSON.stringify({ held2, moved }));
  /* AC3, touch: a finger swept 90 deg round the cue ball turns the aim 90 deg (+-2); on to 200 */
  M = await msetup();
  const TS = { c: M.c, a: M.ang, r: 120 };
  const tArc = async (from, to, n) => { for (let i = 1; i <= n; i++) { const p = TS.a + (from + (to - from) * i / n) * DEG; await tch('touchMove', TS.c[0] + TS.r * Math.cos(p), TS.c[1] + TS.r * Math.sin(p)); } };
  await tch('touchStart', TS.c[0] + TS.r * Math.cos(TS.a), TS.c[1] + TS.r * Math.sin(TS.a));
  /* touch moves reach the page aligned to frames: let the last one land before reading */
  await tArc(0, 90, 30);
  await mp.waitForTimeout(60);
  const t90 = await mstate();
  await tArc(90, 200, 37);
  await mp.waitForTimeout(60);
  const t200 = await mstate();
  await tch('touchEnd');
  ms = await mstate();
  check('AC3 touch: a 90 deg sweep about the cue ball turns the aim 90 deg (+-2), 200 deg turns 200, never shooting',
    Math.abs(t90.aim / DEG - 90) <= 2 && Math.abs(t200.aim / DEG - 200) <= 2 && !t200.pulling && ms.s === 'aim' && ms.shots === M.shots, JSON.stringify({ d90: t90.aim / DEG, d200: t200.aim / DEG, ms }));
  /* AC4, touch: the fine-aim wheel, 100 px turns the aim 1.5 to 2.5 deg; fineAim while held */
  M = await msetup();
  const fw = await mp.evaluate(() => { const r = fineWheel.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.bottom - 8, w: r.width, h: r.height }; });
  await tch('touchStart', fw.x, fw.y);
  await swipe([fw.x, fw.y], [fw.x, fw.y - 100], 10);
  await mp.waitForTimeout(60);
  const fHeld = await mstate();
  await tch('touchEnd');
  const fRel = await mstate();
  check('AC4 touch: 100 px up the fine-aim wheel turns the aim 1.5-2.5 deg anticlockwise, fineAim only while held, a 44 px target',
    -fHeld.aim / DEG >= 1.5 && -fHeld.aim / DEG <= 2.5 && fHeld.fine && !fRel.fine && fRel.aim === fHeld.aim && fRel.shots === M.shots && fw.w >= 44 && fw.h >= 44, JSON.stringify({ deg: fHeld.aim / DEG, fHeld, fRel, fw }));
  /* a rotation mid-pull on the bar drops the gesture: no jump in power, no shot */
  M = await msetup();
  const rb = await mp.evaluate(() => { const r = powerBar.getBoundingClientRect(); return { x: r.left + 10, y: r.y + r.height / 2 }; });
  await tch('touchStart', rb.x, rb.y);
  await swipe([rb.x, rb.y], [rb.x + M.arm + 60, rb.y]);
  const preRot = await mstate();
  await mp.setViewportSize({ width: 844, height: 390 });
  await mp.waitForTimeout(250);
  const rot = await mstate();
  await tch('touchMove', rb.x + M.arm + 100, rb.y);
  await tch('touchEnd');
  ms = await mstate();
  check('touch: rotating mid-pull on the bar cancels the pull', preRot.pulling && !rot.pulling && ms.shots === M.shots && ms.s === 'aim', JSON.stringify({ preRot, rot, ms }));
  await mp.setViewportSize({ width: 390, height: 844 });
  await mp.waitForTimeout(250);
  /* the english pad: two quick drags are not a double tap, two real taps are */
  const tpad = await mp.evaluate(() => { const r = spinPad.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  for (const dy of [-14, 14]) { await tch('touchStart', tpad.x - 6, tpad.y); await swipe([tpad.x - 6, tpad.y], [tpad.x - 6, tpad.y + dy], 3); await tch('touchEnd'); }
  const tre = await mp.evaluate(() => felt.cueSpin);
  for (let i = 0; i < 2; i++) { await tch('touchStart', tpad.x - 8, tpad.y - 8); await tch('touchEnd'); }
  const tdbl = await mp.evaluate(() => felt.cueSpin);
  check('touch: english pad re-drag keeps the english, a real double tap centres it', Math.hypot(tre.x, tre.y) > 0.2 && tdbl.x === 0 && tdbl.y === 0, JSON.stringify({ tre, tdbl }));
  /* pinch: on the table, on the controls and on the menu, the page never zooms. Headless
     Chromium only applies a synthesized pinch of the 'mouse' kind (it zooms the old page to
     2.5x); the viewport meta is what refuses it, touch-action is checked in boot-check */
  const scales = [];
  for (const sel of ['#table', '#powerBar', '#menuBtn']) {
    const r = await mp.evaluate(s => { const b = document.querySelector(s).getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }, sel);
    await mc.send('Input.synthesizePinchGesture', { x: r[0], y: r[1], scaleFactor: 2.5, relativeSpeed: 1200, gestureSourceType: 'mouse' });
    await mp.waitForTimeout(150);
    scales.push(await mp.evaluate(() => visualViewport.scale));
  }
  await mp.evaluate(() => pause());
  await mc.send('Input.synthesizePinchGesture', { x: 195, y: 300, scaleFactor: 2.5, relativeSpeed: 1200, gestureSourceType: 'mouse' });
  await mp.waitForTimeout(150);
  scales.push(await mp.evaluate(() => visualViewport.scale));
  check('touch: pinching the table, the controls or the menu never zooms the page', scales.every(s => s === 1), JSON.stringify(scales));
  check('touch gestures: no console errors', m.errors.length === 0, m.errors.join(' | '));
  await m.browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
