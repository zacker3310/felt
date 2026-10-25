/* play-check: playing through the page. Placing the cue ball by clicking, the live roll matching
   simulateShot exactly (with and without english, and across a pause), drag-to-shoot with the
   mouse (power proportional to the pull, cancel by coming back), the power bar, the english pad,
   the keyboard, the turn passing with a banner, the CPU taking its turn at the chosen level,
   settings surviving a reload, rematch after a win, and touch on a phone. */
'use strict';
const { check, done, open, settled } = require('./lib.cjs');

(async () => {
  const { browser, page, errors } = await open();
  await page.evaluate(() => { felt.speed = 40; });
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
  const placed = await page.evaluate(() => ({ s: felt.state, x: felt.game.balls[0].x, y: felt.game.balls[0].y }));
  check('clicking the kitchen places the cue ball', placed.s === 'aim' && Math.abs(placed.x - (0.635 - 0.2)) < 0.01, JSON.stringify(placed));

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
  const p1 = await page.evaluate(() => ({ s: felt.state, paused: felt.paused, resume: getComputedStyle(resumeBtn).display }));
  await page.waitForTimeout(400);
  const still = await page.evaluate(() => felt.game.shots);
  await page.click('#resumeBtn');
  const p2 = await page.evaluate(() => felt.state);
  await page.evaluate(() => { felt.speed = 40; });
  await settled(page);
  const live2 = await page.evaluate(() => JSON.stringify(felt.lastResult.balls.map(b => [b.n, b.on, b.x, b.y])));
  check('pause mid-roll shows the menu with resume, and the roll waits', p1.s === 'menu' && p1.paused && p1.resume !== 'none' && still === shots0, JSON.stringify(p1));
  check('resume carries on the same game', p2 === 'rolling' && (await page.evaluate(() => felt.game.shots)) === shots0 + 1, p2);
  check('a shot with english, paused and resumed, still matches simulateShot exactly', live2 === exp2);

  /* 3. mouse: aim by pointing, press and pull back to shoot, power proportional to the pull */
  await inHand();
  const before = await page.evaluate(() => felt.game.shots);
  const aim = await page.evaluate(() => { const c = felt.game.balls[0]; return { c: felt.toScreen(c.x, c.y), t: felt.toScreen(TL / 2, TW / 2), full: felt.pullFull }; });
  const ux = (aim.t[0] - aim.c[0]) / Math.hypot(aim.t[0] - aim.c[0], aim.t[1] - aim.c[1]), uy = (aim.t[1] - aim.c[1]) / Math.hypot(aim.t[0] - aim.c[0], aim.t[1] - aim.c[1]);
  const back = aim.full * 0.5;
  await page.mouse.move(aim.t[0], aim.t[1]);
  await page.mouse.down();
  await page.mouse.move(aim.t[0] - ux * back, aim.t[1] - uy * back, { steps: 8 });
  const pull = await page.evaluate(() => ({ power: felt.power, aim: felt.aim }));
  await page.mouse.up();
  const stroke = await page.evaluate(() => felt.state);
  await settled(page);
  const shot = await page.evaluate(() => felt.lastShot);
  check('press and pull back on the table shoots', pull.power > 0 && (await page.evaluate(() => felt.game.shots)) === before + 1, 'power ' + pull.power);
  check('the shot strokes the cue before the balls move', stroke === 'stroke' || stroke === 'rolling', stroke);
  check('drag-to-shoot power is proportional to the pull', Math.abs(shot.power - 0.5) < 0.03 && Math.abs(shot.angle - pull.aim) < 1e-9, JSON.stringify(shot));

  /* 3b. pulling back and returning to the start cancels */
  await inHand();
  const n3 = await page.evaluate(() => felt.game.shots);
  const a3 = await page.evaluate(() => { const c = felt.game.balls[0]; return { c: felt.toScreen(c.x, c.y), t: felt.toScreen(TL * 0.6, TW * 0.6) }; });
  await page.mouse.move(a3.t[0], a3.t[1]);
  await page.mouse.down();
  const d3 = [(a3.c[0] - a3.t[0]) * 0.5, (a3.c[1] - a3.t[1]) * 0.5];
  await page.mouse.move(a3.t[0] + d3[0], a3.t[1] + d3[1], { steps: 6 });
  const mid = await page.evaluate(() => felt.power);
  await page.mouse.move(a3.t[0] + 1, a3.t[1], { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const c3 = await page.evaluate(() => ({ s: felt.state, shots: felt.game.shots }));
  check('dragging back to the start and letting go cancels', mid > 0.05 && c3.s === 'aim' && c3.shots === n3, JSON.stringify({ mid, ...c3 }));

  /* 3c. a sideways drag turns the aim a little, and does not shoot */
  const a0 = await page.evaluate(() => felt.aim);
  const side = await page.evaluate(() => { const c = felt.game.balls[0], a = felt.aim, s = felt.toScreen(c.x + Math.cos(a) * 0.6, c.y + Math.sin(a) * 0.6), t = felt.toScreen(c.x + Math.cos(a) * 0.6 - Math.sin(a) * 0.05, c.y + Math.sin(a) * 0.6 + Math.cos(a) * 0.05); return { s, t }; });
  await page.mouse.move(side.s[0], side.s[1]);
  await page.mouse.down();
  await page.mouse.move(side.t[0], side.t[1], { steps: 8 });
  await page.mouse.up();
  const a1 = await page.evaluate(() => ({ aim: felt.aim, s: felt.state, shots: felt.game.shots }));
  const turned = a1.aim - a0;
  check('a sideways drag fine-turns the aim (a quarter of the finger) without shooting', turned > 0.005 && turned < 0.05 && a1.s === 'aim' && a1.shots === n3, JSON.stringify({ turned, ...a1 }));

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
    const k1 = await page.evaluate(() => felt.aim);
    check('arrows aim: fine, shift coarse, alt very fine', Math.abs(k1 - k0.aim - (0.004 + 0.03 - 0.0005)) < 1e-9, String(k1 - k0.aim));
    await page.keyboard.press('r');
    check('R centres the english', await page.evaluate(() => felt.cueSpin.y === 0));
    await page.keyboard.press('Space');
    await settled(page);
    check('space shoots', (await page.evaluate(() => felt.game.shots)) === k0.shots + 1);
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
  const foul = await page.evaluate(() => ({ head: bannerHead.textContent, on: banner.classList.contains('show'), kind: banner.dataset.kind }));
  check('a foul raises a foul banner', foul.on && foul.kind === 'foul' && foul.head.startsWith('Foul'), JSON.stringify(foul));
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
  await page.reload();
  await page.waitForFunction(() => window.booted === true);
  const st = await page.evaluate(() => ({ s: felt.settings, hard: lvHard.getAttribute('aria-pressed'), short: gShort.getAttribute('aria-pressed'), level: getComputedStyle(levelSeg).display }));
  check('settings persist across a reload', st.s.guide === 'short' && st.s.cpu === true && st.s.level === 'hard' && st.s.sound === false && st.hard === 'true' && st.short === 'true' && st.level !== 'none', JSON.stringify(st));

  check('no console errors', errors.length === 0, errors.join(' | '));
  await browser.close();

  /* 10. touch, on a phone: tap to place, tap to aim, drag back to shoot, the bar to shoot */
  const t = await open('', { viewport: { width: 390, height: 844 }, hasTouch: true });
  await t.page.evaluate(() => { felt.speed = 40; });
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
  /* drag back along the line from a spot beside the table's middle */
  const tb = await t.page.evaluate(() => { const c = felt.game.balls[0], a = felt.aim, s = felt.toScreen(c.x + Math.cos(a) * 0.3, c.y + Math.sin(a) * 0.3), e = felt.toScreen(c.x - Math.cos(a) * 0.1, c.y - Math.sin(a) * 0.1); return { s, e }; });
  await touch('touchStart', tb.s[0], tb.s[1]);
  for (let i = 1; i <= 6; i++) await touch('touchMove', tb.s[0] + (tb.e[0] - tb.s[0]) * i / 6, tb.s[1] + (tb.e[1] - tb.s[1]) * i / 6);
  const tp = await t.page.evaluate(() => felt.power);
  await touch('touchEnd');
  await settled(t.page);
  check('touch: dragging back along the line shoots', tp > 0.2 && (await t.page.evaluate(() => felt.game.shots === 1 && Math.abs(felt.lastShot.angle - felt.aim) < 1e-9)), 'power ' + tp);
  if ((await t.page.evaluate(() => felt.state)) === 'place') {
    const p = await t.page.evaluate(() => felt.toScreen(0.4, 0.3));
    await t.page.touchscreen.tap(p[0], p[1]);
  }
  const bb = await t.page.evaluate(() => { const r = powerBar.getBoundingClientRect(); return [r.x + 10, r.x + r.width * 0.7, r.y + r.height / 2]; });
  await touch('touchStart', bb[0], bb[2]);
  for (let i = 1; i <= 5; i++) await touch('touchMove', bb[0] + (bb[1] - bb[0]) * i / 5, bb[2]);
  await touch('touchEnd');
  await settled(t.page);
  check('touch: dragging the power bar along shoots', await t.page.evaluate(() => felt.game.shots === 2 || felt.game.winner !== null));
  check('touch: no console errors', t.errors.length === 0, t.errors.join(' | '));
  await t.browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
