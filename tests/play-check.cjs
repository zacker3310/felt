/* play-check: playing through the page. Placing the cue ball by clicking, aiming with the
   mouse and pulling back to shoot, the power bar, the live roll matching simulateShot
   exactly, the turn passing, the CPU taking its turn, and rematch after a win. */
'use strict';
const { check, done, open, settled } = require('./lib.cjs');

(async () => {
  const { browser, page, errors } = await open();
  await page.evaluate(() => { felt.speed = 40; });
  await page.click('#play9');
  await page.waitForTimeout(200);

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

  /* 3. mouse: aim by pointing, press and pull back to shoot */
  if ((await page.evaluate(() => felt.state)) === 'place') {
    const p = await page.evaluate(() => felt.toScreen(0.4, 0.3));
    await page.mouse.click(p[0], p[1]);
  }
  const before = await page.evaluate(() => felt.game.shots);
  const aim = await page.evaluate(() => { const c = felt.game.balls[0]; return { c: felt.toScreen(c.x, c.y), t: felt.toScreen(TL / 2, TW / 2) }; });
  await page.mouse.move(aim.t[0], aim.t[1]);
  await page.mouse.down();
  const back = [aim.t[0] - (aim.t[0] - aim.c[0]) * 0.6, aim.t[1] - (aim.t[1] - aim.c[1]) * 0.6];
  await page.mouse.move(back[0], back[1], { steps: 6 });
  const pull = await page.evaluate(() => felt.power);
  await page.mouse.up();
  await settled(page);
  check('press and pull back on the table shoots', pull > 0 && (await page.evaluate(() => felt.game.shots)) === before + 1, 'power ' + pull);

  /* 4. the power bar shoots too */
  if ((await page.evaluate(() => felt.state)) === 'place') {
    const p = await page.evaluate(() => felt.toScreen(0.4, 0.3));
    await page.mouse.click(p[0], p[1]);
  }
  if ((await page.evaluate(() => felt.state)) === 'aim') {
    const n0 = await page.evaluate(() => felt.game.shots);
    const bar = await page.evaluate(() => { const r = powerBar.getBoundingClientRect(); return [r.x + r.width / 2, r.y + 8, r.y + r.height * 0.5]; });
    await page.mouse.move(bar[0], bar[1]);
    await page.mouse.down();
    await page.mouse.move(bar[0], bar[2], { steps: 5 });
    await page.mouse.up();
    await settled(page);
    check('pulling the power bar down and letting go shoots', (await page.evaluate(() => felt.game.shots)) === n0 + 1);
  } else check('pulling the power bar down and letting go shoots', false, 'game over before the bar test');

  /* 5. vs CPU: miss on purpose, the CPU takes its turn */
  await page.click('#menuBtn');
  await page.click('#vsCpu');
  await page.click('#play8');
  const k = await page.evaluate(() => felt.toScreen(HEAD_X - 0.1, TW / 2));
  await page.mouse.click(k[0], k[1]);
  await page.evaluate(() => felt.shoot(Math.PI, 0.01, 0));
  await page.waitForFunction(() => felt.game.shots >= 2 || felt.game.winner !== null, null, { timeout: 60000 });
  await settled(page, 60000);
  const c = await page.evaluate(() => ({ shots: felt.game.shots, turn: felt.game.turn, s: felt.state }));
  check('after a foul the CPU places the cue ball and shoots', c.shots >= 2, JSON.stringify(c));

  /* 6. a won game offers a rematch */
  await page.evaluate(() => felt.forceWin(0));
  await page.waitForTimeout(100);
  const over = await page.evaluate(() => ({ s: felt.state, vis: getComputedStyle(rematch).display }));
  check('a win shows the rematch button', over.s === 'over' && over.vis !== 'none', JSON.stringify(over));
  await page.click('#rematch');
  check('rematch starts a fresh rack', await page.evaluate(() => felt.game.shots === 0 && felt.game.winner === null && felt.state === 'place'));

  check('no console errors', errors.length === 0, errors.join(' | '));
  await browser.close();

  /* 7. touch, on a phone: tap to place, tap to aim, the bar to shoot */
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
  const bb = await t.page.evaluate(() => { const r = powerBar.getBoundingClientRect(); return [r.x + r.width / 2, r.y + 10, r.y + r.height * 0.6]; });
  const cdp = await t.page.context().newCDPSession(t.page);
  const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: bb[0], y }] });
  await touch('touchStart', bb[1]);
  for (let i = 1; i <= 5; i++) await touch('touchMove', bb[1] + (bb[2] - bb[1]) * i / 5);
  await touch('touchEnd');
  await settled(t.page);
  check('touch: pulling the bar down shoots', await t.page.evaluate(() => felt.game.shots === 1));
  check('touch: no console errors', t.errors.length === 0, t.errors.join(' | '));
  await t.browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
