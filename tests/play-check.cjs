/* play-check: playing through the page. Ball in hand (the cue ball movable all turn by a drag
   from it, never locked by letting go, back to its last legal spot from an illegal one, locked
   by the bar shot), the live roll matching
   simulateShot exactly (with and without english, and across a pause), the power bar as the
   only pointer control that shoots (power proportional to the pull, cancel by coming back or
   sliding off), the table only aiming (a sweep about the cue ball, 1:1 beyond sweepR; no drag on it ever
   shoots), the fine-aim wheel, the english pad, the keyboard, auto aim, the table size, the turn
   passing with a banner and the turn chip, the CPU taking its turn at the chosen level (the
   chip pulses while it thinks), the two-fouls warning in the banner, the chip and the pause
   menu's card, settings surviving a reload, rematch after a win, touch on a phone, and bumper pool
   (its card, the chosen ball, the bar, byte-for-byte rolls, the CPU, the pause cards, a win). */
'use strict';
const { check, done, open, settled, smallTargets, lowContrast } = require('./lib.cjs');
const DEG = Math.PI / 180;
/* the power a bar pull of d px gives, by the page's own rule (span and arm from where it began) */
const barPower = (d, pos, lo, hi, armPx) => { const span = Math.max(hi - pos, (hi - lo) * 0.5) * 0.92, arm = Math.min(armPx, span * 0.2); return Math.min(1, Math.max(0, (d - arm) / (span - arm))); };

(async () => {
  const { browser, page, errors } = await open();
  /* auto aim off for the gesture checks (it swings the aim at each turn); it has its own below */
  await page.evaluate(() => { felt.speed = 40; settings.autoAim = false; });
  await page.click('#play9');
  await page.click('#breakBtn');
  await page.waitForTimeout(200);
  /* ball in hand: put the cue ball somewhere predictable (the hook moves it as a drag would) */
  const inHand = () => page.evaluate(() => { if (felt.game.inHand) felt.place(0.4, 0.3); });

  /* 1. ball in hand, mouse. The break turn starts aimable with the cue ball already on a legal
     kitchen spot. A drag that starts on or near the ball moves it by the drag (relative: the
     pointer's offset from the ball is kept); letting go never locks it, so it moves again and
     again. A drag that starts off the ball aims and leaves it. Past the head string the ghost
     follows, illegal, and letting go there slides the ball back to the last legal spot it had. */
  const cueAt = () => page.evaluate(() => { const c = felt.game.balls[0]; return { x: c.x, y: c.y, s: felt.toScreen(c.x, c.y), st: felt.state, hand: felt.game.inHand, ok: canPlace(felt.game, c.x, c.y), placeAt: felt.placeAt, moving: felt.moving, aim: felt.aim, shots: felt.game.shots, hx: HEAD_X, tw: TW, msg: msg.textContent }; });
  const scr = (x, y) => page.evaluate(([x, y]) => felt.toScreen(x, y), [x, y]);
  const mdrag = async (from, to, n = 8, up = true) => {
    await page.mouse.move(from[0], from[1]); await page.mouse.down();
    for (let i = 1; i <= n; i++) await page.mouse.move(from[0] + (to[0] - from[0]) * i / n, from[1] + (to[1] - from[1]) * i / n);
    if (up) await page.mouse.up();
  };
  const b0 = await cueAt();
  check('ball in hand: the break turn starts aimable, the cue ball already on a legal kitchen spot', b0.st === 'aim' && b0.hand === 'kitchen' && b0.ok && b0.x <= b0.hx && !b0.placeAt, JSON.stringify(b0));
  const moves = [];
  for (const [tx, ty, ox, oy] of [[-0.2, 0.1, 8, -6], [-0.3, -0.15, -10, 4], [-0.1, 0, 0, 12]]) {
    const c = await cueAt(), want = [c.hx + tx, c.tw / 2 + ty], ws = await scr(want[0], want[1]);
    await mdrag([c.s[0] + ox, c.s[1] + oy], [ws[0] + ox, ws[1] + oy]);
    await page.waitForTimeout(60);
    const a = await cueAt();
    moves.push({ d: Math.hypot(a.x - want[0], a.y - want[1]), st: a.st, ok: a.ok, placeAt: a.placeAt, shots: a.shots });
  }
  check('mouse: a drag from the cue ball moves it, offset kept; letting go never locks it (three moves in a row)', moves.every(m => m.d < 0.003 && m.st === 'aim' && m.ok && !m.placeAt && m.shots === 0), JSON.stringify(moves));
  const off0 = await cueAt(), offFrom = await scr(off0.hx + 0.6, off0.tw * 0.3), offTo = await scr(off0.hx + 0.6, off0.tw * 0.5);
  await mdrag(offFrom, offTo, 8, false);
  const offMid = await cueAt();
  await page.mouse.up();
  const off1 = await cueAt(), offWant = await page.evaluate(([x, y]) => { const p = felt.toTable(x, y), c = felt.game.balls[0]; return Math.atan2(p[1] - c.y, p[0] - c.x); }, offTo);
  check('mouse: a drag that starts off the cue ball aims (the sweep) and leaves the ball where it is', off1.x === off0.x && off1.y === off0.y && !offMid.moving && !offMid.placeAt && Math.abs(off1.aim - offWant) < 0.01 && off1.st === 'aim', JSON.stringify({ offWant, off1: off1.aim }));
  await page.evaluate(() => { felt.speed = 0.25; });
  const il0 = await cueAt(), ilTo = await scr(il0.hx + 0.25, il0.y);
  await mdrag(il0.s, ilTo, 24, false);
  const il1 = await cueAt();
  await page.mouse.up();
  const il2 = await cueAt();
  await page.waitForTimeout(700);
  const il3 = await cueAt();
  await page.evaluate(() => { felt.speed = 40; });
  check('mouse: dragged past the head string the ghost follows, illegal, and says why; the ball keeps its last legal spot by the line',
    il1.placeAt && il1.placeAt[0] > il1.hx && il1.x <= il1.hx && il1.hx - il1.x < 0.03 && /head string/.test(il1.msg), JSON.stringify(il1));
  check('mouse: let go there, it slides back to that last legal spot (not locked, not anywhere else)',
    il2.placeAt && il2.placeAt[0] > il1.x && il3.placeAt === null && il3.x === il1.x && il3.y === il1.y && il3.ok && il3.st === 'aim', JSON.stringify({ il2: il2.placeAt, il3 }));

  /* 2. the live break equals the pure simulation of the same shot */
  const angle = await page.evaluate(() => Math.atan2(FOOT[1] - felt.game.balls[0].y, FOOT[0] - felt.game.balls[0].x));
  const expected = await page.evaluate(a => JSON.stringify(simulateShot(felt.game.balls, { angle: a, power: 1, spin: 0 }).balls.map(b => [b.n, b.on, b.x, b.y])), angle);
  await page.evaluate(a => felt.shoot(a, 1, 0), angle);
  await settled(page);
  const live = await page.evaluate(() => JSON.stringify(felt.lastResult.balls.map(b => [b.n, b.on, b.x, b.y])));
  check('live break matches simulateShot exactly', live === expected);
  const after = await page.evaluate(() => ({ shots: felt.game.shots, s: felt.state, msg: msg.textContent }));
  check('the break is judged and the HUD says so', after.shots === 1 && after.msg.length > 0 && ['aim', 'over'].includes(after.s), JSON.stringify(after));

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

  /* 3d. AC3, mouse: the finger swept 90 deg round the cue ball, beyond sweepR (where the turn
     is 1:1), turns the aim 90 deg (+-2); on to 200 deg, across the +-180 wrap, it keeps up; the
     sweep never shoots */
  const sw = await page.evaluate(() => { const c = felt.game.balls[0]; return { c: felt.toScreen(c.x, c.y), a: felt.aim, shots: felt.game.shots, r: 1.2 * felt.sweepR }; });
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

  /* 5b. cue elevation (swerve and masse): a right click on the pad opens its sheet and leaves the
     tip alone; the slider sets whole degrees, the pad's tag and words say so; a click elsewhere
     closes it; Page Up on the pad raises the cue 5 degrees; the elevated live roll equals
     simulateShot byte for byte; and the next turn starts level */
  if ((await page.evaluate(() => felt.state)) === 'aim') {
    await inHand();
    await page.mouse.click(pad.x + pad.R * 0.4, pad.y);
    await page.waitForTimeout(400);
    const tip0 = await page.evaluate(() => Object.assign({}, felt.cueSpin));
    await page.mouse.click(pad.x, pad.y - pad.R * 0.5, { button: 'right' });
    const ev0 = await page.evaluate(() => ({ open: !elevPop.hidden, tip: Object.assign({}, felt.cueSpin), r: elevSlider.getBoundingClientRect().toJSON(), pop: elevPop.getBoundingClientRect().toJSON(), vw: innerWidth, vh: innerHeight }));
    const targets = await smallTargets(page), low = await lowContrast(page);
    await page.mouse.click(ev0.r.x + ev0.r.width / 2, ev0.r.y + ev0.r.height / 2);
    const ev1 = await page.evaluate(() => ({ e: felt.cueSpin.e, x: felt.cueSpin.x, tag: elevTag.textContent, tagShown: !elevTag.hidden, words: spinLabel.textContent, now: elevSlider.getAttribute('aria-valuenow') }));
    await page.mouse.click(5, 5);
    const ev2 = await page.evaluate(() => ({ open: !elevPop.hidden, e: felt.cueSpin.e }));
    await page.focus('#spinPad');
    await page.keyboard.press('PageUp');
    const ev3 = await page.evaluate(() => Math.round(felt.cueSpin.e * 180 / Math.PI));
    await page.evaluate(() => document.activeElement.blur());
    check('cue elevation: a right click on the english pad opens the sheet inside the screen and leaves the tip where it was; its targets are 44 px and its text 4.5:1',
      ev0.open && JSON.stringify(ev0.tip) === JSON.stringify(tip0) && ev0.pop.x >= 0 && ev0.pop.y >= 0 && ev0.pop.right <= ev0.vw && ev0.pop.bottom <= ev0.vh && !targets.length && !low.length, JSON.stringify({ ev0, tip0, targets, low }));
    check('cue elevation: the slider\'s middle is 30 degrees; the pad shows 30\u00b0 and says cue up 30 degrees; the english is kept; a click elsewhere closes the sheet and keeps the cue up; Page Up on the pad adds 5',
      Math.abs(ev1.e - Math.PI / 6) < 1e-12 && ev1.x === tip0.x && ev1.tag === '30\u00b0' && ev1.tagShown && /cue up 30 degrees/.test(ev1.words) && ev1.now === '30' && !ev2.open && ev2.e === ev1.e && ev3 === 35, JSON.stringify({ ev1, ev2, ev3 }));
    const eshot = { x: 0.7, y: -0.4, e: 0.75 };
    const exp3 = await page.evaluate(s => JSON.stringify(simulateShot(felt.game.balls, { angle: 0.4, power: 0.5, spin: s }).balls.map(b => [b.n, b.on, b.x, b.y])), eshot);
    await page.evaluate(s => { felt.speed = 40; felt.shoot(0.4, 0.5, s); }, eshot);
    await settled(page);
    const live3 = await page.evaluate(() => ({ balls: JSON.stringify(felt.lastResult.balls.map(b => [b.n, b.on, b.x, b.y])), rec: felt.lastShot.spin, next: felt.cueSpin, tag: elevTag.hidden }));
    check('cue elevation: an elevated shot with english plays live exactly as simulateShot does, the shot record keeps the elevation, and the next turn starts level',
      live3.balls === exp3 && live3.rec.e === 0.75 && !('e' in live3.next) && live3.tag, JSON.stringify({ rec: live3.rec, next: live3.next, same: live3.balls === exp3 }));
  } else check('cue elevation: the sheet, the slider and an elevated live roll', false, 'not on an aim turn');

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
  await page.click('#exitBtn');
  await page.click('#play8');
  await page.click('#vsCpu');
  await page.click('#lvHard');
  await page.click('#breakBtn');
  const k = await page.evaluate(() => felt.toScreen(HEAD_X - 0.1, TW / 2));
  await page.mouse.click(k[0], k[1]);
  await page.evaluate(() => felt.shoot(Math.PI, 0.01, 0));
  await page.waitForFunction(() => felt.state !== 'rolling', null, { timeout: 30000 });
  const foul = await page.evaluate(() => ({ head: bannerHead.textContent, on: banner.classList.contains('show'), kind: banner.dataset.kind,
    chip: { name: turnChip.dataset.name, busy: turnChip.classList.contains('busy'), thinking: felt.state === 'thinking' && !cpuPlan } }));
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
  check('a win shows who won, the stats and the rematch button', over.s === 'over' && over.vis !== 'none' && over.title === 'You win' && over.rows === 5, JSON.stringify(over));
  await page.click('#rematch');
  check('rematch starts a fresh rack', await page.evaluate(() => felt.game.shots === 0 && felt.game.winner === null && felt.state === 'aim' && felt.game.inHand === 'kitchen'));

  /* 9. settings survive a reload */
  await page.click('#menuBtn');
  await page.click('#pPrefsBtn');
  await page.click('#prGame');
  await page.click('#gShort');
  await page.click('#prefsBack');
  await page.click('#prAud');
  await page.click('#sndOff');
  await page.click('#prefsBack');
  await page.click('#prGfx');
  await page.evaluate(() => { window.oldImg = tableImg; });
  await page.click('#clRed');
  const repaint = await page.evaluate(() => tableImg !== window.oldImg && document.documentElement.dataset.cloth === 'red');
  await page.reload();
  await page.waitForFunction(() => window.booted === true);
  const cl = await page.evaluate(() => ({ s: felt.settings.cloth, red: clRed.getAttribute('aria-pressed'), green: clGreen.getAttribute('aria-pressed'), root: document.documentElement.dataset.cloth }));
  check('cloth: red is chosen in the menu, the table repaints, and it persists across a reload', repaint && cl.s === 'red' && cl.red === 'true' && cl.green === 'false' && cl.root === 'red', JSON.stringify(cl));
  const st = await page.evaluate(() => ({ s: felt.settings, hard: lvHard.getAttribute('aria-pressed'), short: gShort.getAttribute('aria-pressed'), level: getComputedStyle(levelSeg).display }));
  check('settings persist across a reload', st.s.guide === 'short' && st.s.cpu === true && st.s.level === 'hard' && st.s.sound === false && st.hard === 'true' && st.short === 'true' && st.level !== 'none', JSON.stringify(st));

  /* 9b. the menu flow. A game tile opens its setup; the choices there start that game (and are
     the last setup); a finished game is recorded against the CPU opponent it was played against
     and shows in Stats; Play again replays the setup; a loss ends the run of wins; two players'
     names show on the chips, the pause cards and game over, and persist. */
  await page.click('#play8');
  const su = await page.evaluate(() => ({ shown: setupSheet.classList.contains('show'), home: menu.classList.contains('show'), title: setupTitle.textContent, names: getComputedStyle(nameRow).display, foes: [...levelSeg.querySelectorAll('b')].map(b => b.textContent), go: breakBtn.textContent }));
  check('setup: a game tile opens its setup sheet (8-ball, the CPU opponents Rookie, Regular, Hustler; no name fields against the CPU), Break to start',
    su.shown && !su.home && su.title === '8-ball' && su.names === 'none' && su.foes.join() === 'Rookie,Regular,Hustler' && su.go === 'Break', JSON.stringify(su));
  await page.click('#lvEasy');
  const rec0 = await page.evaluate(() => felt.record);
  await page.click('#breakBtn');
  const g1 = await page.evaluate(() => ({ s: felt.state, kind: felt.game.kind, cpu: felt.cpu, lvl: felt.cpuLevel, last: settings.last, menu: menu.classList.contains('show'), sheet: setupSheet.classList.contains('show') }));
  check('setup: Break starts the game with the chosen options (8-ball vs the CPU on easy) and remembers it as the last setup',
    g1.s === 'aim' && g1.kind === '8' && g1.cpu && g1.lvl === 'easy' && g1.last === '8' && !g1.menu && !g1.sheet, JSON.stringify(g1));
  await page.click('#menuBtn');
  const pc = await page.evaluate(() => ({ p1: p1name.textContent, kick: soloKind.textContent }));
  await page.click('#resumeBtn');
  await page.evaluate(() => felt.forceWin(0));
  const won1 = await page.evaluate(() => ({ r: felt.record, kind: overKind.textContent, ls: JSON.parse(localStorage.getItem('felt.record.v1')) }));
  check('stats: a forced win against Rookie is recorded (played, a win against easy, the run of wins), stored, and game over names the opponent',
    won1.r.kinds['8'].played === rec0.kinds['8'].played + 1 && won1.r.kinds['8'].cpu.easy.w === rec0.kinds['8'].cpu.easy.w + 1 && won1.r.streak === rec0.streak + 1
    && won1.ls.kinds['8'].cpu.easy.w === won1.r.kinds['8'].cpu.easy.w && /vs Rookie/.test(won1.kind) && pc.p1 === 'Rookie (CPU)' && /vs Rookie/.test(pc.kick), JSON.stringify({ rec0, won1, pc }));
  await page.click('#overMenu');
  const home1 = await page.evaluate(() => ({ hero: !!document.getElementById('againBtn'), label: play8.getAttribute('aria-label') }));
  check('home after a game: no Play again; the 8-ball card names the setup it opens on', !home1.hero && home1.label === '8-ball vs Rookie (CPU easy), 7 ft', JSON.stringify(home1));
  await page.click('#statsBtn');
  const st1 = await page.evaluate(() => ({ row: [...recTable.querySelectorAll('tbody tr')][0].textContent, kp: kpis.textContent }));
  check('stats sheet: the 8-ball row has the win against Rookie, the run of wins shows', /^8-ball\d+1-0/.test(st1.row) && /Win streak[1-9]/.test(st1.kp), JSON.stringify(st1));
  await page.click('#statsBack');
  await page.click('#play8');
  const preset = await page.evaluate(() => [vsCpu, lvEasy].map(b => b.getAttribute('aria-pressed')).join());
  await page.click('#breakBtn');
  const g2 = await page.evaluate(() => ({ s: felt.state, kind: felt.game.kind, cpu: felt.cpu, lvl: felt.cpuLevel, shots: felt.game.shots }));
  check('the 8-ball card opens on the last setup (CPU, Rookie) and Break replays it: a fresh 8-ball rack against the CPU on easy', preset === 'true,true' && g2.s === 'aim' && g2.kind === '8' && g2.cpu && g2.lvl === 'easy' && g2.shots === 0, JSON.stringify(g2));
  await page.evaluate(() => felt.forceWin(1));
  const lost = await page.evaluate(() => felt.record);
  check('stats: a loss is recorded against that opponent and ends the run of wins (the best is kept)', lost.kinds['8'].cpu.easy.l === rec0.kinds['8'].cpu.easy.l + 1 && lost.streak === 0 && lost.best >= 1, JSON.stringify(lost));
  await page.click('#overMenu');
  await page.click('#play9');
  await page.click('#vs2p');
  await page.fill('#name1', ' Zac ');
  await page.fill('#name2', 'Samantha Jones');
  await page.click('#breakBtn');
  await page.click('#menuBtn');
  const nm = await page.evaluate(() => ({ s: settings.names, chips: [pchip0.firstChild.textContent, pchip1.firstChild.textContent], cards: [p0name.textContent, p1name.textContent], kick: soloKind.textContent }));
  await page.click('#resumeBtn');
  await page.evaluate(() => felt.forceWin(0));
  nm.over = await page.evaluate(() => overText.textContent);
  check('names: two players\' names (trimmed, at most 12 characters) on the chips (short), the pause cards and game over',
    nm.s[0] === 'Zac' && nm.s[1] === 'Samantha Jon' && nm.chips.join() === 'Zac,Sam' && nm.cards.join() === 'Zac,Samantha Jon' && nm.over === 'Zac wins' && /Paused, 9-ball/.test(nm.kick), JSON.stringify(nm));
  await page.reload();
  await page.waitForFunction(() => window.booted === true);
  await page.click('#play9');
  const nm2 = await page.evaluate(() => ({ s: felt.settings.names, v: [name1.value, name2.value], two: felt.record.kinds['9'].two }));
  check('names persist across a reload (the setup shows them), and the two-player game was recorded', nm2.s[0] === 'Zac' && nm2.v[0] === 'Zac' && nm2.v[1] === 'Samantha Jon' && nm2.two >= 1, JSON.stringify(nm2));
  await page.fill('#name1', '');
  await page.fill('#name2', '');
  await page.click('#setupBack');

  /* a cue-ball drag still held through a shot cannot stop the roll or move the ball */
  if (!(await page.evaluate(() => menu.classList.contains('show')))) await page.click('#menuBtn');
  await page.click('#play9');
  await page.click('#vs2p');
  await page.click('#breakBtn');
  const hold = await page.evaluate(() => { const c = felt.game.balls[0]; return felt.toScreen(c.x, c.y); });
  await page.mouse.move(hold[0], hold[1]);
  await page.mouse.down();
  await page.mouse.move(hold[0] - 20, hold[1] + 10, { steps: 3 });
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
    settings.cpu = false; settings.autoAim = false; felt.start('8'); game = placeCue(game, x, TW / 2);
    game.inHand = hand ? 'table' : null;
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
  /* ball in hand: a backward drag from the cue ball moves the ball; it never pulls or shoots */
  S = await setup(0.4, true);
  await page.mouse.move(S.c[0], S.c[1]);
  await page.mouse.down();
  await page.mouse.move(S.c[0] - S.full * 0.8, S.c[1], { steps: 8 });
  const cuePull = await page.evaluate(() => ({ s: felt.state, pulling: felt.pulling, x: felt.game.balls[0].x, power: felt.power }));
  await page.mouse.up();
  await page.waitForTimeout(200);
  const cueAfter = await idle();
  check('ball in hand: a backward drag from the cue ball moves the ball, and never pulls or shoots', cuePull.s === 'aim' && !cuePull.pulling && Math.abs(cuePull.x - 0.4) > 0.05 && cueAfter.s === 'aim' && cueAfter.shots === S.shots, JSON.stringify({ cuePull, cueAfter }));
  S = await setup(0.4, true);
  await page.mouse.click(S.c[0], S.c[1]);
  const pick = await page.evaluate(() => ({ s: felt.state, x: felt.game.balls[0].x, aim: felt.aim, lab: powerLab.textContent }));
  check('ball in hand: a click on the cue ball changes nothing (no pick-up, no aim)', pick.s === 'aim' && pick.x === 0.4 && pick.aim === 0 && pick.lab === 'Pull to shoot', JSON.stringify(pick));
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
  await page.evaluate(() => { settings.cpu = false; felt.start('9'); felt.place(0.4, TW / 2); game.fouls = [1, 0]; felt.speed = 40; felt.shoot(Math.PI, 0.01, 0); });
  await settled(page);
  const two = await page.evaluate(() => ({ sub: bannerSub.textContent, kind: banner.dataset.kind, chip: turnChip.dataset.name, chipWarn: turnChip.classList.contains('warn') }));
  await page.click('#menuBtn');
  Object.assign(two, await page.evaluate(() => ({ meta: p0meta.textContent, warn: p0meta.classList.contains('warn'), shown: !gameNow.hidden && p0meta.getBoundingClientRect().height > 0 })));
  await page.click('#resumeBtn');
  check('9-ball: a second foul in a row warns that a third loses (banner, and the card in the pause menu)', /Player 1 is on two fouls: a third loses/.test(two.sub) && two.kind === 'foul' && /Two fouls/.test(two.meta) && two.warn && two.shown, JSON.stringify(two));
  const chipTwo = await page.evaluate(() => {
    const was = game.fouls.slice(), out = {};
    game.fouls = [0, 2]; hud(); out.on = [turnChip.dataset.name, turnChip.classList.contains('warn')];
    game.fouls = [2, 0]; hud(); out.off = [turnChip.dataset.name, turnChip.classList.contains('warn')];
    game.fouls = was; hud();
    return out;
  });
  check('9-ball: the turn chip of the player to shoot on two fouls is marked, and only theirs', two.chip === 'P2' && !two.chipWarn && chipTwo.on[0] === 'P2' && chipTwo.on[1] && !chipTwo.off[1], JSON.stringify({ two, chipTwo }));

  /* 14. auto aim, a recommendation rather than a sniper. On: the break starts aimed at the head
     ball, and each later human turn starts, once the cue has swung round, within 1 deg of the
     straight line to the centre of the ball suggestAim(game) picks (not its pot line); `hint` is
     that suggestion's { n, k }, cleared once the shot is fired. Off: no hint, the aim is left
     alone. The setting persists. */
  await page.click('#menuBtn');
  await page.click('#pPrefsBtn');
  await page.click('#prCtl');
  await page.click('#aaOn');
  await page.click('#prefsBack');
  await page.click('#prefsBack');
  await page.click('#exitBtn');
  await page.click('#play9');
  await page.click('#vs2p');
  await page.click('#breakBtn');
  const brk = await page.evaluate(async () => {
    felt.speed = 40;
    await new Promise(r => setTimeout(r, 150));
    const c = game.balls[0], one = game.balls.find(b => b.n === 1);
    return { on: settings.autoAim, d: Math.abs(wrapAngle(felt.aim - Math.atan2(one.y - c.y, one.x - c.x))) / (Math.PI / 180), locked: felt.aimLocked, hint: felt.hint };
  });
  check('auto aim: the break starts aimed at the head ball, that aim is locked, and the hint names it', brk.on && brk.d < 1 && brk.locked && brk.hint && brk.hint.n === 1 && brk.hint.k === -1, JSON.stringify(brk));
  /* the turn after a shot (ball in hand or not: the ball is already on its spot) */
  const nextTurn = () => page.evaluate(async () => {
    await new Promise(r => setTimeout(r, 150));
    const s = suggestAim(game), c = game.balls[0], t = s && game.balls.find(b => b.n === s.n);
    const line = t ? Math.atan2(t.y - c.y, t.x - c.x) : null;
    return { s: felt.state, aim: felt.aim, d: t ? Math.abs(wrapAngle(felt.aim - line)) / (Math.PI / 180) : null, pot: s ? Math.abs(wrapAngle(s.angle - line)) / (Math.PI / 180) : null,
      locked: felt.aimLocked, hint: felt.hint, want: s && { n: s.n, k: s.k }, hand: game.inHand };
  });
  const autoRuns = [], hintAfterShot = [];
  for (const [a, p] of [[Math.PI, 0.02], [null, 0.25]]) {
    hintAfterShot.push(await page.evaluate(([a, p]) => { const s = suggestAim(game); felt.shoot(a === null ? s.angle : a, p, 0); return felt.hint; }, [a, p]));
    await settled(page);
    autoRuns.push(await nextTurn());
  }
  check('auto aim on: after a shot (a foul and ball in hand, then a hit) the turn starts within 1 deg of the line to the suggested ball\'s centre, hint = suggestAim\'s { n, k }',
    autoRuns.every(r => r.s === 'aim' && r.d !== null && r.d < 1 && r.locked && r.hint && r.hint.n === r.want.n && r.hint.k === r.want.k) && autoRuns[0].hand === 'table', JSON.stringify(autoRuns));
  check('auto aim on: the hint is cleared once the shot is fired', hintAfterShot.every(h => h === null), JSON.stringify(hintAfterShot));
  await page.click('#menuBtn');
  await page.click('#pPrefsBtn');
  await page.click('#prCtl');
  await page.click('#aaOff');
  await page.keyboard.press('Escape');
  await page.click('#resumeBtn');
  const offShot = await page.evaluate(() => felt.state === 'aim' && felt.shoot(Math.PI / 2 + 0.3, 0.02, 0));
  await settled(page);
  const offRun = await page.evaluate(async () => {
    await new Promise(r => setTimeout(r, 150));
    const out = { s: felt.state, aim: felt.aim, on: settings.autoAim, hint: felt.hint, hand: game.inHand };
    /* a ball-in-hand move with auto aim off leaves the aim alone too */
    if (game.inHand) { const c = game.balls[0], q = nearestLegal(c.x + 0.1, c.y + 0.05); if (q) felt.place(q[0], q[1]); out.moved = felt.aim; out.hint2 = felt.hint; }
    return out;
  });
  check('auto aim off: no hint, and the next turn (and a ball-in-hand move) keeps the aim the last shot left', offShot && !offRun.on && offRun.s === 'aim' && offRun.hint === null && Math.abs(offRun.aim - (Math.PI / 2 + 0.3)) < 1e-9
    && (offRun.moved === undefined || (offRun.moved === offRun.aim && offRun.hint2 === null)), JSON.stringify(offRun));
  await page.reload();
  await page.waitForFunction(() => window.booted === true);
  const aaSt = await page.evaluate(() => ({ on: felt.settings.autoAim, off: aaOff.getAttribute('aria-pressed') }));
  check('auto aim: the setting persists across a reload', aaSt.on === false && aaSt.off === 'true', JSON.stringify(aaSt));

  /* 15. the table size: the menu control persists, and start() sets that table before the rack.
     setTable is wrapped to record its calls. */
  const wrapTable = () => page.evaluate(() => { window.tableCalls = []; const f = setTable; window.setTable = s => { tableCalls.push(s); f(s); }; });
  await wrapTable();
  const t7 = await page.evaluate(() => ({ s: felt.settings.table, p: tb7.getAttribute('aria-pressed') }));
  await page.click('#play8');
  await page.click('#tb9');
  const preview = await page.evaluate(() => tableCalls.slice());
  await page.reload();
  await page.waitForFunction(() => window.booted === true);
  await wrapTable();
  const t9 = await page.evaluate(() => ({ s: felt.settings.table, p: tb9.getAttribute('aria-pressed') }));
  await page.click('#play8');
  await page.click('#breakBtn');
  const g9 = await page.evaluate(() => ({ calls: tableCalls.slice(), table: felt.table, s: felt.state }));
  check('table size: 7 ft by default, the menu choice persists, and a new game starts on that table', t7.s === '7' && t7.p === 'true' && preview.includes('9') && t9.s === '9' && t9.p === 'true' && g9.calls[g9.calls.length - 1] === '9' && g9.table === '9' && g9.s === 'aim', JSON.stringify({ t7, preview, t9, g9 }));
  /* the 9 ft table plays too: the live roll still equals simulateShot byte for byte */
  const nine = await page.evaluate(async () => {
    felt.speed = 40; felt.place(HEAD_X - 0.2, TW / 2);
    const c = game.balls[0], a = Math.atan2(FOOT[1] - c.y, FOOT[0] - c.x);
    const want = JSON.stringify(simulateShot(game.balls, { angle: a, power: 0.9, spin: 0 }).balls.map(b => [b.n, b.on, b.x, b.y]));
    felt.shoot(a, 0.9, 0);
    while (['stroke', 'rolling'].includes(felt.state)) await new Promise(r => setTimeout(r, 50));
    return { same: JSON.stringify(felt.lastResult.balls.map(b => [b.n, b.on, b.x, b.y])) === want, TL };
  });
  check('9 ft table: the live break matches simulateShot exactly', nine.same && nine.TL > 2.5, JSON.stringify(nine));
  await page.click('#menuBtn');
  await page.click('#exitBtn');
  await page.click('#play8');
  await page.click('#tb7');
  const g7 = await page.evaluate(() => { tableCalls.length = 0; felt.start('8'); return { calls: tableCalls.slice(), table: felt.table, TL }; });
  check('table size: back to 7 ft, the next game is on the 7 ft table (1.981 m)', g7.calls[0] === '7' && g7.table === '7' && Math.abs(g7.TL - 1.981) < 1e-9, JSON.stringify(g7));

  /* 16. pockets: regulation by default; the menu choice redraws the rack behind the menu at once,
     persists, and start() sets it (with the table) before the rack; the art follows POCKET_R.
     setPockets is wrapped to record its calls. */
  const wrapPk = () => page.evaluate(() => { window.pkCalls = []; const f = setPockets; window.setPockets = s => { pkCalls.push(s); return f(s); }; });
  await page.reload();
  await page.waitForFunction(() => window.booted === true);
  await wrapPk();
  const pr = await page.evaluate(() => ({ s: felt.settings.pockets, p: pkReg.getAttribute('aria-pressed'), now: felt.pockets, R: felt.pocketR }));
  await page.click('#play8');
  await page.click('#pkGen');
  const pg = await page.evaluate(() => ({ calls: pkCalls.slice(), now: felt.pockets, R: felt.pocketR }));
  check('pockets: regulation by default; choosing Generous rebuilds the table behind the menu at once', pr.s === 'regulation' && pr.p === 'true' && pr.now === 'regulation'
    && pg.calls.includes('generous') && pg.now === 'generous' && pg.R[0] > pr.R[0] && pg.R[1] > pr.R[1], JSON.stringify({ pr, pg }));
  await page.reload();
  await page.waitForFunction(() => window.booted === true);
  await wrapPk();
  const pb = await page.evaluate(() => ({ s: felt.settings.pockets, p: pkGen.getAttribute('aria-pressed'), now: felt.pockets }));
  await page.click('#play9');
  await page.click('#breakBtn');
  const pn = await page.evaluate(() => ({ calls: pkCalls.slice(), now: felt.pockets, s: felt.state }));
  check('pockets: the choice persists across a reload, and a new game starts with generous pockets', pb.s === 'generous' && pb.p === 'true' && pb.now === 'generous'
    && pn.calls[pn.calls.length - 1] === 'generous' && pn.now === 'generous' && pn.s === 'aim', JSON.stringify({ pb, pn }));
  /* generous pockets play too: the live roll still equals simulateShot byte for byte */
  const gen = await page.evaluate(async () => {
    felt.speed = 40; felt.place(HEAD_X - 0.2, TW / 2);
    const c = game.balls[0], a = Math.atan2(FOOT[1] - c.y, FOOT[0] - c.x);
    const want = JSON.stringify(simulateShot(game.balls, { angle: a, power: 0.9, spin: 0 }).balls.map(b => [b.n, b.on, b.x, b.y]));
    felt.shoot(a, 0.9, 0);
    while (['stroke', 'rolling'].includes(felt.state)) await new Promise(r => setTimeout(r, 50));
    return { same: JSON.stringify(felt.lastResult.balls.map(b => [b.n, b.on, b.x, b.y])) === want, pockets: POCKETS_STYLE };
  });
  check('generous pockets: the live break matches simulateShot exactly', gen.same && gen.pockets === 'generous', JSON.stringify(gen));
  await page.click('#menuBtn');
  await page.click('#exitBtn');
  await page.click('#play8');
  await page.click('#pkReg');
  const pz = await page.evaluate(() => { pkCalls.length = 0; felt.start('8'); return { calls: pkCalls.slice(), now: felt.pockets, R: felt.pocketR }; });
  check('pockets: back to regulation, the next game has regulation pockets', pz.calls[0] === 'regulation' && pz.now === 'regulation' && pz.R[0] === 0.056 && pz.R[1] === 0.058, JSON.stringify(pz));

  /* 17. ball in hand after a foul by the CPU, then after a break scratch. cpuSearch is swapped for
     a stub that thinks for a while, then rolls the cue ball gently into nothing: a foul. */
  await page.evaluate(() => {
    window.realSearch = cpuSearch;
    cpuSearch = function* () { const t = performance.now(); while (performance.now() - t < 1500) yield; return { angle: Math.PI / 2, power: 0.02, spin: 0, place: null }; };
    settings.cpu = true; settings.autoAim = false; felt.start('8'); felt.speed = 40;
    game.breakShot = false; game.inHand = null; game.turn = 1;
    state = 'thinking'; cpuPlan = null; cpuIt = cpuSearch(); hud();
  });
  const cpu0 = await cueAt();
  await mdrag(cpu0.s, [cpu0.s[0] + 60, cpu0.s[1] + 40]);
  await page.keyboard.press('m'); await page.keyboard.press('ArrowUp');
  const cpu1 = await cueAt();
  check('during the CPU\'s turn the cue ball cannot be moved (drag, M and arrows do nothing)', cpu0.st === 'thinking' && cpu1.st === 'thinking' && cpu1.x === cpu0.x && cpu1.y === cpu0.y && !cpu1.placeAt && !cpu1.moving, JSON.stringify({ cpu0, cpu1 }));
  await page.waitForFunction(() => felt.state === 'aim' && felt.game.turn === 0, null, { timeout: 30000 });
  await page.evaluate(() => { cpuSearch = window.realSearch; });
  const fh = await cueAt();
  check('after a CPU foul: your turn, ball in hand, the cue ball on a legal spot, aimable at once', fh.st === 'aim' && fh.hand === 'table' && fh.ok && !fh.placeAt, JSON.stringify(fh));
  /* release on another ball: the head ball of the rack, dragged straight onto its centre */
  const tgt = await page.evaluate(() => { const b = felt.game.balls.filter(b => b.n > 0 && b.on).reduce((a, b) => b.x < a.x ? b : a); return { n: b.n, x: b.x, y: b.y, s: felt.toScreen(b.x, b.y), R: BALL_R }; });
  await mdrag(fh.s, tgt.s, 40, false);
  const ob1 = await cueAt();
  await page.mouse.up();
  await page.waitForTimeout(150);
  const ob2 = await cueAt();
  check('a release on another ball: the ghost says why, and the ball goes back to its last legal spot, right beside that ball',
    ob1.placeAt && new RegExp('the ' + tgt.n + '\\.').test(ob1.msg) && ob2.placeAt === null && ob2.ok && ob2.x === ob1.x && ob2.y === ob1.y && Math.hypot(ob2.x - tgt.x, ob2.y - tgt.y) < 2 * tgt.R + 0.04 && ob2.st === 'aim',
    JSON.stringify({ ob1, ob2, tgt }));
  /* the bar shot locks the spot: the live roll equals simulateShot from there, byte for byte */
  const snap = await page.evaluate(() => JSON.stringify(felt.game.balls)), shotsB = ob2.shots;
  await page.mouse.move(bar0.x, bar0.lo + 10);
  await page.mouse.down();
  await page.mouse.move(bar0.x, bar0.lo + 10 + (bar0.hi - bar0.lo) * 0.3, { steps: 6 });
  await page.mouse.up();
  await page.waitForFunction(n => felt.game.shots === n + 1, shotsB, { timeout: 30000 });
  const cmt = await page.evaluate(b => {
    const balls = JSON.parse(b), s = felt.lastShot, row = x => JSON.stringify(x.map(b => [b.n, b.on, b.x, b.y]));
    return { same: row(simulateShot(balls, { angle: s.angle, power: s.power, spin: s.spin }).balls) === row(felt.lastResult.balls), cue: [balls[0].x, balls[0].y] };
  }, snap);
  check('ball in hand: the bar shot plays from the spot the ball was on, and the live roll equals simulateShot from it byte for byte', cmt.same && cmt.cue[0] === ob2.x && cmt.cue[1] === ob2.y, JSON.stringify(cmt));
  /* a break scratch: the next player has the ball in hand in the kitchen, auto aim on */
  const bs = await page.evaluate(async () => {
    settings.cpu = false; settings.autoAim = true; felt.start('8'); felt.speed = 40;
    const P = POCKET_AIM.reduce((a, p) => Math.hypot(p[0], p[1]) < Math.hypot(a[0], a[1]) ? p : a);
    felt.place(0.15, 0.15);
    const c = game.balls[0];
    felt.shoot(Math.atan2(P[1] - c.y, P[0] - c.x), 0.3, 0);
    while (['stroke', 'rolling'].includes(felt.state)) await new Promise(r => setTimeout(r, 30));
    await new Promise(r => setTimeout(r, 200));
    const d = game.balls[0], h = felt.hint, t = h && game.balls.find(b => b.n === h.n);
    return { s: felt.state, turn: game.turn, hand: game.inHand, ok: canPlace(game, d.x, d.y), x: d.x, hx: HEAD_X, foul: game.verdict.foul, hint: h,
      d: t ? Math.abs(wrapAngle(felt.aim - Math.atan2(t.y - d.y, t.x - d.x))) / (Math.PI / 180) : null };
  });
  check('a break scratch: the next player has ball in hand behind the line, on a legal spot, auto aimed at the suggested ball',
    bs.s === 'aim' && bs.turn === 1 && bs.hand === 'kitchen' && bs.ok && bs.x <= bs.hx && bs.hint && bs.d < 1, JSON.stringify(bs));
  /* auto aim follows the moved ball until the player aims by hand; then only the hint follows */
  const sugg = () => page.evaluate(() => {
    const s = suggestAim(game), c = game.balls[0], t = game.balls.find(b => b.n === s.n);
    return { aim: felt.aim, d: Math.abs(wrapAngle(felt.aim - Math.atan2(t.y - c.y, t.x - c.x))) / (Math.PI / 180), hint: felt.hint, want: { n: s.n, k: s.k }, hand: felt.handAimed, x: c.x, y: c.y };
  });
  const sameHint = r => r.hint && r.hint.n === r.want.n && r.hint.k === r.want.k;
  let k0 = await cueAt();
  await mdrag(k0.s, await scr(k0.x - 0.12, k0.y + 0.25));
  await page.waitForTimeout(150);
  const ra1 = await sugg();
  check('auto aim: after a move, with no aiming by hand yet, the cue re-aims at the suggested ball from the new spot', !ra1.hand && ra1.d < 1 && sameHint(ra1) && ra1.y > k0.y + 0.2, JSON.stringify(ra1));
  await page.keyboard.down('Alt'); for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight'); await page.keyboard.up('Alt');
  const aimK = await page.evaluate(() => felt.aim);
  k0 = await cueAt();
  await mdrag(k0.s, await scr(k0.x - 0.1, k0.y - 0.3));
  await page.waitForTimeout(150);
  const ra2 = await sugg();
  check('auto aim: once the player has aimed by hand, a move keeps their aim (the hint still follows the new spot)', ra2.hand && ra2.aim === aimK && sameHint(ra2) && ra2.y < k0.y - 0.25, JSON.stringify({ ra2, aimK }));
  k0 = await cueAt();
  await mdrag(k0.s, await scr(k0.hx + 0.3, k0.y), 20);
  await page.waitForTimeout(150);
  const kb = await cueAt();
  check('after a break scratch: let go past the head string, the ball is back in the kitchen on a legal spot', kb.placeAt === null && kb.ok && kb.x <= kb.hx && kb.hx - kb.x < 0.04 && kb.st === 'aim', JSON.stringify(kb));
  /* keyboard: M, then arrows move the ball; nothing commits until the bar; M again to aim */
  const kk0 = await cueAt();
  await page.keyboard.press('m');
  const kk1 = await page.evaluate(() => felt.moving);
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
  await page.keyboard.down('Shift'); await page.keyboard.press('ArrowUp'); await page.keyboard.up('Shift');
  const kk2 = await cueAt();
  await page.keyboard.press('m');
  const kk3 = await cueAt();
  check('keyboard: M then arrows move the cue ball in hand (7 cm here), M again goes back to aiming, and no key shoots', kk1 && kk2.moving && Math.abs(Math.hypot(kk2.x - kk0.x, kk2.y - kk0.y) - 0.07) < 0.002 && !kk3.moving && !kk3.placeAt && kk3.st === 'aim' && kk3.shots === kk0.shots, JSON.stringify({ kk0, kk2, kk3 }));

  check('no console errors', errors.length === 0, errors.join(' | '));
  await browser.close();

  /* 10. touch, on a phone: the break is aimable at once, tap to aim, a backward drag only aims
     (from the cue ball in hand it moves the ball), the bar shoots */
  const t = await open('', { viewport: { width: 390, height: 844 }, hasTouch: true });
  await t.page.evaluate(() => { felt.speed = 40; settings.autoAim = false; });
  await t.page.tap('#play9');
  await t.page.tap('#breakBtn');
  await t.page.waitForTimeout(100);
  check('touch: the break turn is aimable at once, the cue ball in hand on a legal kitchen spot', await t.page.evaluate(() => felt.state === 'aim' && felt.game.inHand === 'kitchen' && canPlace(felt.game, felt.game.balls[0].x, felt.game.balls[0].y)));
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
  /* the same with timestamps 8 ms apart, a normal finger speed whatever the harness's pace (the
     sweep and the wheel scale by finger speed) */
  let mvt = Date.now() / 1000;
  const tchT = (type, x, y) => { mvt += 0.008; return mc.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }], timestamp: mvt }); };
  const swipe = async (from, to, n = 6) => { for (let i = 1; i <= n; i++) await tch('touchMove', from[0] + (to[0] - from[0]) * i / n, from[1] + (to[1] - from[1]) * i / n); };
  const msetup = (x = 0.5, hand = false) => mp.evaluate(([x, hand]) => {
    settings.cpu = false; settings.autoAim = false; felt.start('8'); game = placeCue(game, x, TW / 2);
    game.inHand = hand ? 'table' : null;
    aimAngle = 0; felt.speed = 40;
    const c = felt.game.balls[0], s = felt.toScreen(c.x, c.y), u = felt.toScreen(c.x + 0.1, c.y);
    return { c: s, ang: Math.atan2(u[1] - s[1], u[0] - s[0]), q: felt.toScreen(TL - 0.4, TW / 2 + 0.2), want: Math.atan2(0.2, TL - 0.4 - x), full: felt.pullFull, arm: felt.armPx, shots: felt.game.shots, tw: TW, bx: c.x };
  }, [x, hand]);
  const mstate = () => mp.evaluate(() => ({ s: felt.state, shots: felt.game.shots, pulling: felt.pulling, aim: felt.aim, power: felt.power, x: felt.game.balls[0].x, fine: felt.fineAim }));
  /* portrait: aim 0 points up the screen, so "back" is down */
  let M = await msetup();
  /* a quick tap (timestamped, so a slow harness never makes it a held drag) */
  await tchT('touchStart', M.q[0], M.q[1]);
  for (let i = 1; i <= 3; i++) await tchT('touchMove', M.q[0] + 4 * i, M.q[1] + 2 * i / 3);
  await tchT('touchEnd');
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
  /* the cue ball in hand: a backward drag from it moves it and never pulls; a tap on it does
     nothing; holding it still and then dragging moves it too (no long press to learn) */
  M = await msetup(0.6, true);
  await tch('touchStart', M.c[0], M.c[1]);
  await swipe(M.c, [M.c[0], M.c[1] + M.full * 0.5], 8);
  await mp.waitForTimeout(60);
  const cp = await mstate();
  await tch('touchEnd');
  await mp.waitForTimeout(150);
  const cpAfter = await mstate();
  check('touch: ball in hand: a backward drag from the cue ball moves it, never pulls or shoots', cp.s === 'aim' && !cp.pulling && cp.x !== M.bx && cpAfter.x === cp.x && cpAfter.s === 'aim' && cpAfter.shots === M.shots, JSON.stringify({ cp, cpAfter }));
  M = await msetup(0.6, true);
  await tch('touchStart', M.c[0], M.c[1]);
  await tch('touchEnd');
  const tp1 = await mstate();
  check('touch: a tap on the cue ball in hand changes nothing (no pick-up, no aim)', tp1.s === 'aim' && tp1.x === M.bx && tp1.aim === 0, JSON.stringify(tp1));
  M = await msetup(0.6, true);
  await tch('touchStart', M.c[0], M.c[1]);
  await mp.waitForTimeout(600);
  const held2 = await mstate();
  await swipe(M.c, [M.c[0] + 40, M.c[1]], 4);
  await tch('touchEnd');
  const moved = await mp.evaluate(() => ({ s: felt.state, y: felt.game.balls[0].y }));
  check('touch: holding the cue ball in hand, then dragging, moves it', held2.s === 'aim' && held2.x === M.bx && moved.s === 'aim' && moved.y > M.tw / 2 + 0.1, JSON.stringify({ held2, moved }));
  /* AC3, touch: a finger swept 90 deg round the cue ball at a normal speed, beyond sweepR,
     turns the aim 90 deg (+-2); on to 200 */
  M = await msetup();
  const TS = { c: M.c, a: M.ang, r: 1.3 * await mp.evaluate(() => felt.sweepR) };
  const tArc = async (from, to, n) => { for (let i = 1; i <= n; i++) { const p = TS.a + (from + (to - from) * i / n) * DEG; await tchT('touchMove', TS.c[0] + TS.r * Math.cos(p), TS.c[1] + TS.r * Math.sin(p)); } };
  await tchT('touchStart', TS.c[0] + TS.r * Math.cos(TS.a), TS.c[1] + TS.r * Math.sin(TS.a));
  /* touch moves reach the page aligned to frames: let the last one land before reading */
  await tArc(0, 90, 30);
  await mp.waitForTimeout(60);
  const t90 = await mstate();
  await tArc(90, 200, 37);
  await mp.waitForTimeout(60);
  const t200 = await mstate();
  await tchT('touchEnd');
  ms = await mstate();
  check('AC3 touch: a 90 deg sweep about the cue ball turns the aim 90 deg (+-2), 200 deg turns 200, never shooting',
    Math.abs(t90.aim / DEG - 90) <= 2 && Math.abs(t200.aim / DEG - 200) <= 2 && !t200.pulling && ms.s === 'aim' && ms.shots === M.shots, JSON.stringify({ d90: t90.aim / DEG, d200: t200.aim / DEG, ms }));
  /* AC4, touch: the fine-aim wheel rolled at a normal speed, 100 px turns the aim 1.5 to 2.5
     deg; fineAim while held */
  M = await msetup();
  const fw = await mp.evaluate(() => { const r = fineWheel.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.bottom - 8, w: r.width, h: r.height }; });
  await tchT('touchStart', fw.x, fw.y);
  for (let i = 1; i <= 10; i++) await tchT('touchMove', fw.x, fw.y - 10 * i);
  await mp.waitForTimeout(60);
  const fHeld = await mstate();
  await tchT('touchEnd');
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
  /* a still hold on the pad opens the cue elevation sheet and puts the tip back where it was */
  await mp.waitForTimeout(400);
  await tch('touchStart', tpad.x + 10, tpad.y - 10);
  await mp.waitForTimeout(700);
  const thold = await mp.evaluate(() => ({ open: !elevPop.hidden, spin: Object.assign({}, felt.cueSpin) }));
  await tch('touchEnd');
  await mp.evaluate(() => { elevLevel.click(); });
  const tlev = await mp.evaluate(() => ({ open: !elevPop.hidden, e: felt.cueSpin.e }));
  check('touch: a still hold on the english pad opens the cue elevation sheet, the tip where it was; Level closes it level', thold.open && thold.spin.x === 0 && thold.spin.y === 0 && !tlev.open && tlev.e === undefined, JSON.stringify({ thold, tlev }));
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

  /* 18. ball in hand by touch on a big phone (440x956, dpr 3, real touch events): a drag that
     starts beside the ball moves it with the finger's offset kept (the finger never hides it),
     again and again; a drag elsewhere aims; a tap on it does nothing; past the head string it
     slides back; the bar shot plays from the spot it was left on */
  const h = await open('', { viewport: { width: 440, height: 956 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const hp = h.page, hc = await hp.context().newCDPSession(hp);
  const ht = (type, x, y) => hc.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const hdrag = async (from, to, n = 8, end = true) => {
    await ht('touchStart', from[0], from[1]);
    for (let i = 1; i <= n; i++) await ht('touchMove', from[0] + (to[0] - from[0]) * i / n, from[1] + (to[1] - from[1]) * i / n);
    await hp.waitForTimeout(60);
    if (end) await ht('touchEnd');
  };
  const hcue = () => hp.evaluate(() => { const c = felt.game.balls[0]; return { x: c.x, y: c.y, s: felt.toScreen(c.x, c.y), st: felt.state, hand: felt.game.inHand, ok: canPlace(felt.game, c.x, c.y), placeAt: felt.placeAt, aim: felt.aim, shots: felt.game.shots, hx: HEAD_X, tw: TW, grab: Math.max(30, 2.5 * BALL_R * felt.view.k) }; });
  const hscr = (x, y) => hp.evaluate(([x, y]) => felt.toScreen(x, y), [x, y]);
  await hp.evaluate(() => { felt.speed = 40; settings.autoAim = false; });
  await hp.tap('#play8');
  await hp.tap('#breakBtn');
  await hp.waitForTimeout(150);
  const h0 = await hcue();
  check('touch 440: the break turn is aimable at once, the cue ball in hand on a legal kitchen spot', h0.st === 'aim' && h0.hand === 'kitchen' && h0.ok, JSON.stringify(h0));
  const hm = [];
  for (const [tx, ty, ox, oy] of [[-0.15, 0.12, 22, 0], [-0.25, -0.1, 0, 24], [-0.05, 0.05, -17, -17]]) {
    const c = await hcue(), want = [c.hx + tx, c.tw / 2 + ty], ws = await hscr(want[0], want[1]);
    await hdrag([c.s[0] + ox, c.s[1] + oy], [ws[0] + ox, ws[1] + oy]);
    const a = await hcue();
    hm.push({ d: Math.hypot(a.x - want[0], a.y - want[1]), gap: Math.hypot(ws[0] + ox - a.s[0], ws[1] + oy - a.s[1]), st: a.st, ok: a.ok, placeAt: a.placeAt, shots: a.shots });
  }
  check('touch 440: a drag starting beside the cue ball moves it, finger offset kept; letting go never locks it (three moves)',
    hm.every(m => m.d < 0.003 && m.gap > 20 && m.st === 'aim' && m.ok && !m.placeAt && m.shots === 0), JSON.stringify(hm));
  const ho0 = await hcue();
  await hdrag([ho0.s[0] + ho0.grab + 40, ho0.s[1] - 120], [ho0.s[0] + ho0.grab + 120, ho0.s[1] - 120]);
  const ho1 = await hcue();
  check('touch 440: a drag that starts away from the cue ball aims and leaves the ball', ho1.x === ho0.x && ho1.y === ho0.y && Math.abs(ho1.aim - ho0.aim) > 0.01, JSON.stringify({ ho0, ho1 }));
  await ht('touchStart', ho1.s[0], ho1.s[1]); await ht('touchEnd');
  await hp.waitForTimeout(60);
  const hq = await hcue();
  check('touch 440: a tap on the cue ball in hand changes nothing', hq.x === ho1.x && hq.y === ho1.y && hq.aim === ho1.aim && hq.st === 'aim', JSON.stringify(hq));
  await hp.evaluate(() => { felt.speed = 0.25; });
  await hdrag(hq.s, await hscr(hq.hx + 0.3, hq.y), 24, false);
  const hi1 = await hcue();
  await ht('touchEnd');
  const hi2 = await hcue();
  await hp.waitForTimeout(700);
  const hi3 = await hcue();
  await hp.evaluate(() => { felt.speed = 40; });
  check('touch 440: let go past the head string, the ball slides back to its last legal spot by the line',
    hi1.placeAt && hi1.placeAt[0] > hi1.hx && hi2.placeAt && hi3.placeAt === null && hi3.x === hi1.x && hi3.y === hi1.y && hi3.ok && hi1.hx - hi1.x < 0.03, JSON.stringify({ hi1, hi2: hi2.placeAt, hi3 }));
  const hsnap = await hp.evaluate(() => JSON.stringify(felt.game.balls));
  const hb = await hp.evaluate(() => { const r = powerBar.getBoundingClientRect(); return { lo: r.left, hi: r.right, y: r.y + r.height / 2 }; });
  await hdrag([hb.lo + 10, hb.y], [hb.lo + 10 + (hb.hi - hb.lo) * 0.7, hb.y], 6);
  await hp.waitForFunction(() => felt.game.shots >= 1, null, { timeout: 30000 });
  await settled(hp);
  const hcm = await hp.evaluate(b => {
    const balls = JSON.parse(b), s = felt.lastShot, row = x => JSON.stringify(x.map(b => [b.n, b.on, b.x, b.y]));
    return { same: row(simulateShot(balls, { angle: s.angle, power: s.power, spin: s.spin }).balls) === row(felt.lastResult.balls), cue: [balls[0].x, balls[0].y] };
  }, hsnap);
  check('touch 440: the bar shot plays from where the ball was left, the live roll equal to simulateShot byte for byte', hcm.same && hcm.cue[0] === hi3.x && hcm.cue[1] === hi3.y, JSON.stringify(hcm));
  check('touch 440: no console errors', h.errors.length === 0, h.errors.join(' | '));
  await h.browser.close();
  /* bumper pool through the page, on a 440x956 phone: started from the menu's card, the bar
     shoots the chosen ball and the live roll equals simulateShot byte for byte (bar and hook),
     a tap on one of your balls picks it (B cycles), nothing else shoots, the turn chip shows the
     colour and balls left, the pause menu's cards too, the CPU plays its own balls, a win */
  {
    const k = await open('', { viewport: { width: 440, height: 956 }, hasTouch: true, deviceScaleFactor: 1 });
    const kp = k.page;
    await kp.evaluate(() => { localStorage.clear(); settings.cpu = false; settings.autoAim = true; });
    await kp.click('#playB');
    await kp.click('#breakBtn');
    await kp.waitForTimeout(300);
    const s0 = await kp.evaluate(() => ({ shape: settings.bumperTable, cush: CUSH.length, TL, kind: felt.game.kind, st: felt.state, striker: felt.striker, table: felt.table, chip: document.querySelector('.pchip.on .pb').textContent, chipName: turnChip.dataset.name, hint: felt.hint, sub: bannerSub.textContent }));
    check('bumper: the menu card starts a bumper game on the bumper table, red to open with the marked ball, auto aim on it',
      s0.kind === 'bumper' && s0.st === 'aim' && s0.striker === 21 && s0.table === 'bumper' && s0.chip === '5' && s0.hint && s0.hint.n === 21 && s0.hint.k === 1 && /marked ball/.test(s0.sub), JSON.stringify(s0));
    const tdrag = async (from, to, n = 6) => {
      const cdp = await kp.context().newCDPSession(kp), pt = p => [{ x: p[0], y: p[1], id: 1 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(from) });
      for (let i = 1; i <= n; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt([from[0] + (to[0] - from[0]) * i / n, from[1] + (to[1] - from[1]) * i / n]) });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    /* a bar shot: the live roll equals simulateShot of the same shot from the same balls */
    const barShot = async frac => {
      const snap = await kp.evaluate(() => JSON.stringify(felt.game.balls)), n0 = await kp.evaluate(() => felt.game.shots);
      const hb = await kp.evaluate(() => { const r = powerBar.getBoundingClientRect(); return { lo: r.left, hi: r.right, y: r.y + r.height / 2 }; });
      await tdrag([hb.lo + 10, hb.y], [hb.lo + 10 + (hb.hi - hb.lo) * frac, hb.y]);
      await kp.waitForFunction(n => felt.game.shots === n + 1, n0, { timeout: 30000 });
      return kp.evaluate(b => {
        const s = felt.lastShot, row = x => JSON.stringify(x.map(o => [o.n, o.on, o.x, o.y]));
        return { same: row(simulateShot(JSON.parse(b), s).balls) === row(felt.lastResult.balls), ball: s.ball, cue: felt.lastResult.cue };
      }, snap);
    };
    await kp.evaluate(() => { felt.speed = 40; });
    const o1 = await barShot(0.35);
    await settled(kp);
    const s1 = await kp.evaluate(() => ({ turn: felt.game.turn, striker: felt.striker, opening: felt.game.opening, msg: msg.textContent }));
    check('bumper: the bar shoots red\'s marked ball, the live roll equal to simulateShot byte for byte', o1.same && o1.ball === 21 && o1.cue === 21, JSON.stringify(o1));
    check('bumper: then white plays its opening shot with its marked ball', s1.turn === 1 && s1.striker === 31 && s1.opening === 2 && /Player 2/.test(s1.msg), JSON.stringify(s1));
    /* white's opening through the hook, its own ball named: still byte for byte */
    const o2 = await kp.evaluate(async () => {
      const snap = JSON.stringify(felt.game.balls), s = suggestAim(felt.game);
      felt.shoot(s.angle, 0.3, { x: 0.2, y: -0.3 }, s.n);
      while (['stroke', 'rolling'].includes(felt.state)) await new Promise(r => setTimeout(r, 30));
      const row = x => JSON.stringify(x.map(o => [o.n, o.on, o.x, o.y]));
      return { same: row(simulateShot(JSON.parse(snap), felt.lastShot).balls) === row(felt.lastResult.balls), ball: felt.lastShot.ball, opening: felt.game.opening };
    });
    check('bumper: a shot through felt.shoot with english, the live roll equal to simulateShot byte for byte', o2.same && o2.ball === 31 && o2.opening === 0, JSON.stringify(o2));
    /* past the opening: a tap on one of your balls picks it; B cycles; a tap elsewhere aims */
    const pk = await kp.evaluate(() => {
      felt.game.turn = 0; felt.game.winner = null; state = 'aim';
      const mine = felt.game.balls.filter(b => b.on && b.n < 30 && b.n !== felt.striker);
      const b = mine[0];
      return { n: b.n, s: felt.toScreen(b.x, b.y) };
    });
    await kp.touchscreen.tap(pk.s[0], pk.s[1]);
    await kp.waitForTimeout(100);
    const p1 = await kp.evaluate(() => ({ striker: felt.striker, st: felt.state, shots: felt.game.shots, hint: felt.hint }));
    check('bumper: a tap on one of your own balls picks it to strike (and shoots nothing)', p1.striker === pk.n && p1.st === 'aim' && p1.shots === 2, JSON.stringify({ p1, want: pk.n }));
    await kp.keyboard.press('b');
    const p2 = await kp.evaluate(() => felt.striker);
    await kp.keyboard.press('Space');
    await kp.keyboard.press('Enter');
    await kp.waitForTimeout(100);
    const p3 = await kp.evaluate(() => ({ st: felt.state, shots: felt.game.shots }));
    check('bumper: B picks the next of your balls; no key shoots', p2 !== pk.n && p2 < 30 && p3.st === 'aim' && p3.shots === 2, JSON.stringify({ p2, p3 }));
    const o3 = await barShot(0.3);
    check('bumper: the bar shoots the picked ball, byte for byte', o3.same && o3.ball === p2, JSON.stringify(o3));
    await settled(kp);
    await kp.click('#menuBtn');
    const card = await kp.evaluate(() => [p0meta.textContent, p1meta.textContent, p0dots.children.length + p1dots.children.length]);
    check('bumper: the pause menu\'s cards show each colour and the balls left', /^Red, \d left/.test(card[0]) && /^White, \d left/.test(card[1]) && card[2] >= 2, JSON.stringify(card));
    await kp.click('#resumeBtn');
    /* the CPU: it plays its own balls, at a level, and hands the turn back */
    const cpu = await kp.evaluate(async () => {
      settings.cpu = true; settings.level = 'hard'; felt.start('bumper'); felt.speed = 40;
      const s = suggestAim(felt.game);
      felt.shoot(s.angle, 0.3, 0, s.n);
      const seen = [];
      for (let i = 0; i < 400 && (felt.game.turn === 1 || felt.game.shots < 2); i++) { if (felt.state === 'thinking') seen.push('t'); await new Promise(r => setTimeout(r, 25)); if (felt.game.winner !== null) break; }
      return { shots: felt.game.shots, last: felt.lastShot.ball, thought: seen.length > 0, st: felt.state };
    });
    check('bumper vs CPU: the CPU thinks, strikes its own (white) ball and the turn comes back', cpu.thought && cpu.last >= 31 && cpu.shots >= 2, JSON.stringify(cpu));
    const won = await kp.evaluate(() => { for (const b of felt.game.balls) if (b.n >= 30) b.on = false; felt.forceWin(1); return { st: felt.state, kind: overKind.textContent, text: overText.textContent }; });
    check('bumper: a win shows the game-over sheet for bumper pool', won.st === 'over' && /^Bumper pool/.test(won.kind) && /CPU wins/.test(won.text), JSON.stringify(won));
    await kp.click('#rematch');
    const re = await kp.evaluate(() => ({ kind: felt.game.kind, table: felt.table, shots: felt.game.shots }));
    check('bumper: rematch starts another bumper game', re.kind === 'bumper' && re.table === 'bumper' && re.shots === 0, JSON.stringify(re));
    await kp.evaluate(() => { settings.cpu = false; felt.start('8'); });
    const back = await kp.evaluate(() => ({ table: felt.table, n: POCKETS.length, b: BUMPERS.length }));
    check('bumper: an 8-ball game after it is back on the pool table', back.table === '7' && back.n === 6 && back.b === 0, JSON.stringify(back));
    /* the bumper table's shape: the octagon by default (the game above ran on it), a menu control
       picks the rectangle, and the choice survives a reload; on each, a bar shot byte for byte */
    check('bumper: the default bumper table is the octagon (eight cushions, 40 in across the flats)', s0.shape === 'octagon' && s0.cush === 8 && Math.abs(s0.TL - 1.016) < 1e-9, JSON.stringify(s0));
    await kp.evaluate(() => { felt.start('bumper'); showSetup('bumper'); });
    const ctl = await kp.evaluate(() => ({ shown: !!btOct.getClientRects().length && !!btRect.getClientRects().length, oct: btOct.getAttribute('aria-pressed') }));
    await kp.click('#btRect');
    const rs = await kp.evaluate(() => { const was = TL; felt.start('bumper'); return { was, s: settings.bumperTable, ls: JSON.parse(localStorage.getItem('felt.settings')).bumperTable, TL, cush: CUSH.length, kind: felt.game.kind, pressed: btRect.getAttribute('aria-pressed') }; });
    check('bumper: the menu\'s Bumper control picks the rectangle (stored; a game in progress keeps its table, the next bumper game is on it)',
      Math.abs(rs.was - 1.016) < 1e-9 &&
      ctl.shown && ctl.oct === 'true' && rs.s === 'rect' && rs.ls === 'rect' && Math.abs(rs.TL - 1.219) < 1e-9 && rs.cush === 4 && rs.kind === 'bumper' && rs.pressed === 'true', JSON.stringify({ ctl, rs }));
    await kp.reload();
    await kp.waitForFunction(() => window.booted === true);
    const rl = await kp.evaluate(() => { felt.start('bumper'); felt.speed = 40; return { s: settings.bumperTable, TL, cush: CUSH.length, btn: btRect.getAttribute('aria-pressed') }; });
    check('bumper: the rectangle choice survives a reload and a new bumper game is on it', rl.s === 'rect' && Math.abs(rl.TL - 1.219) < 1e-9 && rl.cush === 4 && rl.btn === 'true', JSON.stringify(rl));
    const o4 = await barShot(0.3);
    check('bumper rectangle: a bar shot, live equal to simulateShot byte for byte', o4.same && o4.ball === 21, JSON.stringify(o4));
    await settled(kp);
    await kp.evaluate(() => showSetup('bumper'));
    await kp.click('#btOct');
    const ob = await kp.evaluate(() => { felt.start('bumper'); felt.speed = 40; return { s: settings.bumperTable, ls: JSON.parse(localStorage.getItem('felt.settings')).bumperTable, TL, cush: CUSH.length, st: felt.state }; });
    const o5 = await barShot(0.45);
    check('bumper octagon: back on the octagon from the menu, a game starts and a bar shot rolls live equal to simulateShot byte for byte',
      ob.s === 'octagon' && ob.ls === 'octagon' && ob.cush === 8 && ob.st === 'aim' && o5.same && o5.ball === 21, JSON.stringify({ ob, o5 }));
    await settled(kp);
    check('bumper: no console errors', k.errors.length === 0, k.errors.join(' | '));
    await k.browser.close();
  }
  /* every game kind on one page, in turn and back: 8-ball, snooker (compact), carom, 9-ball on
     the 9 ft table, bumper pool (octagon, then the rectangle), snooker on the full table, 8-ball
     again. Each shot through felt.shoot rolls live equal to simulateShot byte for byte, on the
     table's own ball and cloth (physOf), and 8-ball's values come back exactly. */
  {
    const k = await open('', { viewport: { width: 440, height: 956 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const runs = [];
    for (const [kind, set] of [['8', { table: '7' }], ['snooker', { snookerTable: 'compact' }], ['carom', {}], ['9', { table: '9' }], ['bumper', { bumperTable: 'octagon' }],
      ['bumper', { bumperTable: 'rect' }], ['snooker', { snookerTable: 'full' }], ['8', { table: '7' }]]) {
      runs.push(await k.page.evaluate(async ([kind, set]) => {
        Object.assign(settings, set); felt.start(kind); felt.speed = 40;
        const g = felt.game, ph = physOf(TABLE);
        g.breakShot = false;
        const snap = JSON.stringify(g.balls), vals = [TABLE, TL, TW, BALL_R, MU_ROLL, CUE_RATIO, CUSH_MU, RAIL_E.join('/'), MU_SP].join();
        felt.shoot(0.37, 0.55, { x: 0.2, y: -0.3 });
        while (['stroke', 'rolling'].includes(felt.state)) await new Promise(r => setTimeout(r, 30));
        const row = x => JSON.stringify(x.map(o => [o.n, o.on, o.x, o.y]));
        return { kind, table: TABLE, vals, same: row(simulateShot(JSON.parse(snap), felt.lastShot).balls) === row(felt.lastResult.balls),
          rec: BALL_R === ph.R && MU_ROLL === ph.roll && CUE_RATIO === ph.cue && CUSH_MU === ph.mu && RAIL_E === ph.e && MU_SP === ph.sp };
      }, [kind, set]));
      await settled(k.page);
    }
    check('every game kind in turn (8, snooker compact, carom, 9 on 9 ft, bumper octagon and rectangle, snooker full, 8 again): live equals simulateShot byte for byte on the table\'s own ball and cloth, and 8-ball comes back exactly',
      runs.every(r => r.same && r.rec) && runs[0].vals === runs[7].vals && new Set(runs.map(r => r.vals)).size === 7 && k.errors.length === 0, JSON.stringify(runs.map(r => [r.kind, r.table, r.same, r.rec])) + k.errors.join(' | '));
    await k.browser.close();
  }
  done();
})().catch(e => { console.error(e); process.exit(1); });
