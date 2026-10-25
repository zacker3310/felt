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

  /* 3. mouse: aim by pointing, press and pull back to shoot, power proportional to the pull */
  await inHand();
  const before = await page.evaluate(() => felt.game.shots);
  const aim = await page.evaluate(() => { const c = felt.game.balls[0]; return { c: felt.toScreen(c.x, c.y), t: felt.toScreen(TL / 2, TW / 2), full: felt.pullFull, arm: felt.armPx }; });
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
  /* past the dead zone, power runs from 0 to 1: (back - arm) / (full - arm) */
  const want = (back - aim.arm) / (aim.full - aim.arm);
  check('drag-to-shoot power is proportional to the pull past the dead zone', Math.abs(shot.power - want) < 0.03 && Math.abs(shot.angle - pull.aim) < 1e-9, JSON.stringify({ shot, want }));

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

  /* a cue-ball drag still held through a keyboard place and shot cannot stop the roll */
  if (!(await page.evaluate(() => menu.classList.contains('show')))) await page.click('#menuBtn');
  await page.click('#vs2p');
  await page.click('#play9');
  const hold = await page.evaluate(() => felt.toScreen(HEAD_X - 0.2, TW / 2));
  await page.mouse.move(hold[0], hold[1]);
  await page.mouse.down();
  await page.keyboard.press('Enter');
  await page.evaluate(() => { felt.speed = 1; });
  await page.keyboard.press(' ');
  await page.waitForFunction(() => felt.state === 'rolling', null, { timeout: 5000 });
  await page.mouse.move(hold[0] + 40, hold[1] + 30, { steps: 3 });
  await page.mouse.up();
  const held = await page.evaluate(() => felt.state);
  await page.evaluate(() => { felt.speed = 40; });
  await settled(page);
  check('letting go of a held cue-ball drag after the shot leaves the roll alone', held === 'rolling' && (await page.evaluate(() => felt.game.shots)) === 1, held);

  /* 11. how a gesture becomes a shot, with a mouse. setup(): a two-player rack with the cue
     ball down at (x, middle), aiming along +x (to the right on screen), still in hand or not */
  const setup = (x = 0.5, hand = false) => page.evaluate(([x, hand]) => {
    settings.cpu = false; felt.start('8'); tryPlace([x, TW / 2]);
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
  /* a backward drag that never reaches the arm distance */
  const vx = Math.cos(aimP), vy = Math.sin(aimP), bk = d => [P[0] - vx * d, P[1] - vy * d];
  await page.mouse.down();
  await page.mouse.move(...bk(S.arm - 6), { steps: 5 });
  const unarmed = await idle();
  await page.mouse.up();
  I = await idle();
  check('a backward drag short of the arm distance shows no pull and does not shoot', !unarmed.pulling && I.s === 'aim' && I.shots === S.shots, JSON.stringify({ unarmed, I }));
  /* armed, then back under the arm distance before letting go */
  await page.mouse.move(P[0], P[1]);
  await page.mouse.down();
  await page.mouse.move(...bk(S.arm + 60), { steps: 6 });
  const armed = await idle();
  await page.mouse.move(...bk(S.arm - 10), { steps: 4 });
  const under = await idle();
  await page.mouse.up();
  I = await idle();
  check('an armed pull shows the cue, the power and a let-go-or-cancel hint', armed.pulling && armed.power > 0.1 && /Let go to shoot/.test(armed.msg), JSON.stringify(armed));
  check('sliding back under the arm distance and letting go cancels', under.power === 0 && I.s === 'aim' && I.shots === S.shots && !/Let go/.test(I.msg), JSON.stringify({ under, I }));
  /* armed, then off the line sideways */
  await page.mouse.move(P[0], P[1]);
  await page.mouse.down();
  await page.mouse.move(...bk(S.arm + 80), { steps: 6 });
  const q = bk(S.arm + 80);
  await page.mouse.move(q[0] - vy * 90, q[1] + vx * 90, { steps: 6 });
  const slid = await idle();
  await page.mouse.move(...bk(S.arm + 100), { steps: 4 });
  await page.mouse.up();
  I = await idle();
  check('an armed pull slid far off its line cancels, and stays cancelled', !slid.pulling && I.s === 'aim' && I.shots === S.shots, JSON.stringify({ slid, I }));
  /* the power bar: leaving it sideways cancels */
  const bar = await page.evaluate(() => { const r = powerBar.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + 8, h: r.height, left: r.x }; });
  await page.mouse.move(bar.x, bar.y);
  await page.mouse.down();
  await page.mouse.move(bar.x, bar.y + bar.h * 0.5, { steps: 5 });
  const onBar = await idle();
  await page.mouse.move(bar.left - 80, bar.y + bar.h * 0.5, { steps: 5 });
  const offBar = await idle();
  await page.mouse.up();
  I = await idle();
  check('leaving the power bar sideways cancels its pull', onBar.pulling && onBar.power > 0.2 && !offBar.pulling && I.s === 'aim' && I.shots === S.shots, JSON.stringify({ onBar, offBar, I }));
  /* fine aim survives a 1 px jitter; a real move takes the aim back */
  await page.mouse.move(P[0], P[1]);
  await page.waitForTimeout(200);
  const pre = (await idle()).aim;
  await page.keyboard.down('Alt'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.up('Alt');
  const fine = await idle();
  await page.mouse.move(P[0] + 1, P[1]);
  await page.mouse.move(P[0], P[1] + 1);
  const jit = await idle();
  check('a fine aim survives a 1 px mouse jitter', Math.abs(fine.aim - pre - 0.001) < 1e-9 && jit.aim === fine.aim, JSON.stringify({ fine: fine.aim - pre, jit: jit.aim - fine.aim }));
  /* pressing to pull starts from the locked aim, it does not snap back to the pointer */
  await page.mouse.down();
  await page.mouse.move(P[0] - S.arm - 50, P[1], { steps: 5 });
  const lockPull = await idle();
  await page.mouse.move(P[0], P[1], { steps: 5 });
  await page.mouse.up();
  check('pressing to pull keeps the fine aim', lockPull.pulling && lockPull.aim === fine.aim, JSON.stringify(lockPull));
  await page.mouse.move(P[0] + 10, P[1] + 60, { steps: 4 });
  check('moving the mouse well away unlocks the aim, and hover aims again', Math.abs((await idle()).aim - Math.atan2(100, 310)) < 0.01, String((await idle()).aim));
  /* hover aim, rest, then a dash to the power bar: the aim stays where it rested */
  await page.mouse.move(P[0], P[1]);
  await page.waitForTimeout(300);
  const rested = (await idle()).aim;
  await page.mouse.move(bar.x, bar.y + bar.h * 0.5, { steps: 15 });
  const atBar = (await idle()).aim;
  check('moving the mouse from the table to the power bar leaves the aim unchanged', Math.abs(atBar - rested) < 1e-9, JSON.stringify({ rested, atBar }));
  /* ball in hand, placed: a backward drag from the cue ball pulls, it does not move the ball */
  S = await setup(0.4, true);
  await page.mouse.move(S.c[0], S.c[1]);
  await page.mouse.down();
  await page.mouse.move(S.c[0] - S.full * 0.5, S.c[1], { steps: 8 });
  const cuePull = await page.evaluate(() => ({ s: felt.state, pulling: felt.pulling, x: felt.game.balls[0].x, power: felt.power }));
  await page.mouse.up();
  await settled(page);
  check('ball in hand, placed: a backward drag from the cue ball pulls and shoots', cuePull.s === 'aim' && cuePull.pulling && Math.abs(cuePull.x - 0.4) < 1e-9 && (await page.evaluate(() => felt.game.shots)) === S.shots + 1, JSON.stringify(cuePull));
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
  const two = await page.evaluate(() => ({ sub: bannerSub.textContent, kind: banner.dataset.kind, meta: p0meta.textContent, warn: p0meta.classList.contains('warn') }));
  check('9-ball: a second foul in a row warns that a third loses', /Player 1 is on two fouls: a third loses/.test(two.sub) && two.kind === 'foul' && /Two fouls/.test(two.meta) && two.warn, JSON.stringify(two));

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

  /* 13. touch gestures on a phone (dpr 3, real touch events): sloppy taps, tilted fine-tunes,
     cancels, the placed cue ball, a rotation mid-pull, the english pad, pinch */
  const m = await open('', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const mp = m.page, mc = await mp.context().newCDPSession(mp);
  const tch = (type, x, y) => mc.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const swipe = async (from, to, n = 6) => { for (let i = 1; i <= n; i++) await tch('touchMove', from[0] + (to[0] - from[0]) * i / n, from[1] + (to[1] - from[1]) * i / n); };
  const msetup = (x = 0.5, hand = false) => mp.evaluate(([x, hand]) => {
    settings.cpu = false; felt.start('8'); tryPlace([x, TW / 2]);
    if (!hand) game.inHand = null;
    aimAngle = 0; felt.speed = 40;
    const c = felt.game.balls[0];
    return { c: felt.toScreen(c.x, c.y), q: felt.toScreen(1.6, TW / 2 + 0.2), want: Math.atan2(0.2, 1.6 - x), full: felt.pullFull, arm: felt.armPx, shots: felt.game.shots };
  }, [x, hand]);
  const mstate = () => mp.evaluate(() => ({ s: felt.state, shots: felt.game.shots, pulling: felt.pulling, aim: felt.aim, power: felt.power, x: felt.game.balls[0].x }));
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
  check('touch: a fine-tune drag tilted 50 deg below horizontal turns and never shoots', ms.s === 'aim' && ms.shots === M.shots && !ms.pulling && Math.abs(ms.aim) > 0.005, JSON.stringify(ms));
  M = await msetup();
  await tch('touchStart', M.q[0], M.q[1]);
  await swipe(M.q, [M.q[0], M.q[1] + M.arm + 70]);
  const tArmed = await mstate();
  await swipe([M.q[0], M.q[1] + M.arm + 70], [M.q[0] + 90, M.q[1] + M.arm + 70]);
  const tSlid = await mstate();
  await tch('touchEnd');
  ms = await mstate();
  check('touch: a pull slid sideways off its line cancels', tArmed.pulling && !tSlid.pulling && ms.s === 'aim' && ms.shots === M.shots, JSON.stringify({ tArmed, tSlid, ms }));
  await tch('touchStart', M.q[0], M.q[1]);
  await tch('touchMove', M.q[0], M.q[1] + M.arm + 90);
  await tch('touchMove', M.q[0], M.q[1] + 4);
  await tch('touchEnd');
  ms = await mstate();
  check('touch: a quick return to the start leaves no stale power and does not shoot', ms.s === 'aim' && ms.shots === M.shots && !ms.pulling, JSON.stringify(ms));
  /* the placed cue ball: a backward drag pulls; a tap picks it up; holding it slides it */
  M = await msetup(0.6, true);
  await tch('touchStart', M.c[0], M.c[1]);
  await swipe(M.c, [M.c[0], M.c[1] + M.full * 0.5], 8);
  const cp = await mstate();
  await tch('touchEnd');
  await settled(mp);
  check('touch: ball in hand, placed: a backward drag from the cue ball pulls and shoots, the ball stays put', cp.s === 'aim' && cp.pulling && Math.abs(cp.x - 0.6) < 1e-9 && (await mstate()).shots === M.shots + 1, JSON.stringify(cp));
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
  check('touch: holding the placed cue ball picks it up and a drag slides it', held2.s === 'place' && moved.s === 'aim' && moved.y > 1.27 / 2 + 0.1, JSON.stringify({ held2, moved }));
  /* a rotation mid-pull drops the gesture: no jump in power, no shot */
  M = await msetup();
  await tch('touchStart', M.q[0], M.q[1]);
  await swipe(M.q, [M.q[0], M.q[1] + M.arm + 60]);
  const preRot = await mstate();
  await mp.setViewportSize({ width: 844, height: 390 });
  await mp.waitForTimeout(250);
  const rot = await mstate();
  await tch('touchMove', M.q[0], M.q[1] + M.arm + 120);
  await tch('touchEnd');
  ms = await mstate();
  check('touch: rotating mid-pull cancels the pull', preRot.pulling && !rot.pulling && ms.shots === M.shots && ms.s === 'aim', JSON.stringify({ preRot, rot, ms }));
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
  for (const sel of ['#table', '#spinLabel', '#menuBtn']) {
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
