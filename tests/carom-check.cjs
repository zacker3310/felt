/* carom-check: three-cushion carom (setTable('carom'), sim 1j, the page's carom branches).
   Sim: the table (no pockets, four closed cushions, its own 61.5 mm ball, pool's back after a
   switch), its cloth and rails against pool's, a 400-shot fuzz (no ball off the table, nothing
   NaN), the count and the rules from constructed contact sequences (three cushions then the
   second ball, two, the second ball too early, the one-cushion game, the break, a ball off the
   table, a run, the race), the CPU (hard scores more than easy over seeded layouts) and auto
   aim. Page, on a 440x956 phone: the home's Three-cushion card starts a game from its setup, bar
   shots roll live equal to simulateShot byte for byte (balls and the contact sequence), the
   chips show the points over the race, the CPU plays yellow, the guide traces three cushions,
   the home fits either way up, and every overlay keeps 3:1 on each cloth, blue included. */
'use strict';
const { check, done, open, lowContrast, smallTargets, settled } = require('./lib.cjs');
const { loadSim } = require('./sim.cjs');
const S = loadSim();

/* ---- the table ---- */
S.setTable('carom');
{
  const C = S.CUSH, closed = C.every((c, i) => { const n = C[(i + 1) % C.length]; return c[2] === n[0] && c[3] === n[1]; });
  check('carom table: 2.84 x 1.42 m, no pockets (POCKETS, POCKET_R, POCKET_AIM, mouths all empty)',
    S.TABLE === 'carom' && S.TL === 2.84 && S.TW === 1.42 && !S.POCKETS.length && !S.POCKET_R.length && !S.POCKET_AIM.length && !S.MOUTHS.length);
  check('carom table: four cushions end to end round the bed, four rubbers', C.length === 4 && closed && S.CUSHION_POLYS.length === 4
    && C.flat().every(v => v === 0 || v === S.TL || v === S.TW), JSON.stringify(C));
  check('carom ball: 61.5 mm (radius 30.75 mm), its cloth and rails', S.BALL_R === 0.03075 && S.MU_ROLL === S.CAROM_PHYS.roll && S.CUE_RATIO === 0.4);
}
S.setTable('7');
check('back on pool: the 2 1/4 in ball and pool cloth again', S.BALL_R === 0.028575 && S.MU_ROLL === 0.01 && S.CUSH_MU === 0.2 && S.POCKETS.length === 6);
S.newGame('carom');
const pr = S.BALL_R;
S.newGame('8');
check('newGame: carom sets its table and ball, an 8-ball game after it is back on the pool table', pr === 0.03075 && S.TABLE === '7' && S.BALL_R === 0.028575 && S.POCKETS.length === 6);

/* ---- the cloth and the rails: faster and livelier than pool's ---- */
const roll = t => { S.setTable(t); const r = S.simulateShot([S.newBall(70, 0.2, S.TW / 2)], { angle: 0, power: 0.15, spin: 0, ball: 70 }); return r.balls[0].x - 0.2; };
const rebound = t => {
  S.setTable(t);
  const tab = S.newTable([S.newBall(70, 0.6, S.TW / 2)], 70), b = tab.balls[0];
  b.vy = -2; b.wx = -2 / S.BALL_R;
  for (let i = 0; i < 3000 && b.vy <= 0; i++) S.stepTable(tab);
  return b.vy / 2;
};
{
  const rp = roll('9'), rc = roll('carom'), ep = rebound('9'), ec = rebound('carom');
  check('heated cloth: a soft stroke rolls 1.2 to 1.5 times as far on carom as on pool', rc / rp > 1.2 && rc / rp < 1.5, `${rp.toFixed(3)} m vs ${rc.toFixed(3)} m`);
  check('livelier rails: a ball straight into a cushion at 2 m/s comes back faster on carom (0.80 to 0.92 of its speed)', ec > ep && ec > 0.8 && ec < 0.92, `${ep.toFixed(3)} vs ${ec.toFixed(3)}`);
}

/* ---- fuzz: 400 shots, nothing leaves the table, nothing NaN ---- */
{
  S.setTable('carom');
  const rnd = S.rng(4242);
  let bad = 0, off = 0, nan = 0, steps = 0;
  for (let k = 0; k < 400; k++) {
    const g = S.newGame('carom');
    for (const b of g.balls) for (;;) { const x = S.BALL_R + rnd() * (S.TL - 2 * S.BALL_R), y = S.BALL_R + rnd() * (S.TW - 2 * S.BALL_R); if (g.balls.every(o => o === b || Math.hypot(o.x - x, o.y - y) > 2 * S.BALL_R + 1e-4)) { b.x = x; b.y = y; break; } }
    const r = S.simulateShot(g.balls, { angle: rnd() * 2 * Math.PI, power: rnd(), spin: { x: rnd() * 2 - 1, y: rnd() * 2 - 1 }, ball: S.C_CUE[k % 2] });
    steps += r.steps;
    if (r.potted.length) off++;
    if (r.balls.some(b => ![b.x, b.y].every(Number.isFinite))) nan++;
    if (r.balls.some(b => b.x < S.BALL_R - 1e-6 || b.x > S.TL - S.BALL_R + 1e-6 || b.y < S.BALL_R - 1e-6 || b.y > S.TW - S.BALL_R + 1e-6)) bad++;
  }
  check('fuzz: 400 shots at any angle, power and english, no ball leaves the table, all at rest on the bed, nothing NaN', !off && !nan && !bad, JSON.stringify({ off, nan, bad, steps }));
}

/* ---- the count and the rules, from constructed contact sequences ---- */
const W = S.C_CUE[0], Y = S.C_CUE[1], R = S.C_RED, C = -1;
const shot = (g, seq, extra) => S.judge(g, Object.assign({ balls: g.balls.map(b => Object.assign({}, b)), potted: [], pocketOf: {}, cue: g.striker, seq }, extra));
const play = (o = {}) => { const g = S.newGame('carom', o); g.breakShot = false; return g; };
{
  const g = play();
  let j = shot(g, [Y, C, C, C, R]);
  check('three cushions, then the second ball: a point, the shooter stays at the table', j.verdict.point && j.score[0] === 1 && j.turn === 0 && j.striker === W && j.run === 1 && !j.verdict.foul && j.verdict.keep, JSON.stringify(j.verdict));
  j = shot(g, [C, C, C, R, Y]);
  check('three cushions first, then both balls: a point', j.verdict.point && j.score[0] === 1);
  j = shot(g, [Y, C, C, R, C, C]);
  check('only two cushions before the second ball: no point, the turn passes to yellow (a new inning)', !j.verdict.point && j.turn === 1 && j.striker === Y && j.innings[1] === 1 && j.score[0] === 0 && j.verdict.count.cushions === 2, JSON.stringify(j.verdict.count));
  j = shot(g, [C, Y, R, C, C, C]);
  check('the second ball before the third cushion: no point', !j.verdict.point && j.turn === 1);
  j = shot(g, [Y, C, Y, C, Y, C, Y]);
  check('one ball only, however often: no point', !j.verdict.point && j.verdict.count.balls.join() === String(Y));
  j = shot(g, [Y, C, C, C, Y, C, R]);
  check('the same ball again and the same cushion again count; cushions after the second ball do not matter', j.verdict.point && j.verdict.count.cushions === 4);
  const one = play({ cushions: 1 });
  check('one-cushion: one cushion before the second ball is a point, none is not',
    shot(one, [Y, C, R]).verdict.point && shot(one, [C, R, Y]).verdict.point && !shot(one, [Y, R, C]).verdict.point && one.need === 1);
  /* a run, then a miss: the run ends, the high run stays, the other player's inning starts */
  let h = play();
  for (let i = 0; i < 3; i++) h = shot(h, [R, C, C, C, Y]);
  const run = { score: h.score.slice(), run: h.run, high: h.high.slice(), turn: h.turn };
  h = shot(h, [R]);
  check('scoring continues the turn: three in a row is a run of three; a miss ends it and yellow\'s inning begins',
    run.score[0] === 3 && run.run === 3 && run.high[0] === 3 && run.turn === 0 && h.turn === 1 && h.run === 0 && h.high[0] === 3 && h.innings.join() === '1,1', JSON.stringify({ run, h: [h.turn, h.run, h.innings] }));
  h = shot(h, [W, C, C, C, R]);
  check('yellow scores off the white and the red', h.verdict.point && h.score[1] === 1 && h.turn === 1 && h.striker === Y);
  /* the race */
  for (const race of [5, 10, 15]) {
    const r0 = play({ race });
    r0.score = [race - 1, 2];
    const e = shot(r0, [Y, C, C, C, R]);
    check(`race to ${race}: the point that reaches it wins`, e.winner === 0 && e.verdict.win === 0 && /points/.test(e.verdict.why) && !e.verdict.keep);
  }
  check('race: anything else is 10', play({ race: 7 }).race === 10 && play().race === 10);
  /* the break: the red first, or a foul */
  const b = S.newGame('carom');
  check('the start: red on the foot spot, yellow on the head spot, white 15.24 cm beside it on the head string; only the red is on',
    b.balls.find(o => o.n === R).x === S.FOOT[0] && b.balls.find(o => o.n === Y).x === S.HEAD_X && Math.abs(Math.abs(b.balls.find(o => o.n === W).y - S.TW / 2) - 0.1524) < 1e-9
    && S.legalTargets(b).join() === String(R) && S.newGame('carom', { side: -1 }).balls[0].y < S.TW / 2);
  const bf = shot(b, [Y, C, C, C, R]);
  check('the break: yellow first is a foul, no point, the turn passes', bf.verdict.foul && !bf.verdict.point && bf.turn === 1 && !bf.breakShot);
  check('the break: red first and three cushions is a point', shot(b, [R, C, C, C, Y]).verdict.point);
  /* a ball off the table: a foul, and it comes back to its spot */
  const og = play(), offB = og.balls.map(o => Object.assign({}, o, o.n === R ? { on: false } : {}));
  const oj = S.judge(og, { balls: offB, potted: [R], pocketOf: { [R]: -1 }, cue: W, seq: [Y, C, C, C, R] });
  const red = oj.balls.find(o => o.n === R);
  check('a ball off the table: a foul, no point, the red back on the foot spot', oj.verdict.foul && !oj.verdict.point && red.on && red.x === S.FOOT[0] && red.y === S.FOOT[1] && oj.turn === 1);
  check('judge leaves the game it was given alone', g.score[0] === 0 && g.turn === 0 && g.shots === 0);
}

/* ---- real shots: the sequence the physics records ---- */
{
  const g = play(), c = g.balls.find(o => o.n === W);
  const r = S.simulateShot(g.balls, { angle: Math.PI / 2, power: 0.35, spin: 0, ball: W });
  check('a real shot records the cue ball\'s own cushions in seq (-1 each), the same as rails', r.seq.filter(e => e < 0).length === (r.rails[W] || 0) && r.seq.length >= 1 && c.on, JSON.stringify(r.seq));
}

/* ---- the CPU ---- */
{
  const rnd = S.rng(99), layouts = [];
  for (let k = 0; k < 40; k++) {
    const g = play();
    for (const b of g.balls) for (;;) { const x = 0.12 + rnd() * (S.TL - 0.24), y = 0.12 + rnd() * (S.TW - 0.24); if (g.balls.every(o => o === b || Math.hypot(o.x - x, o.y - y) > 0.1)) { b.x = x; b.y = y; break; } }
    layouts.push(g);
  }
  const rate = level => {
    let pts = 0, ms = 0;
    layouts.forEach((g, k) => { const t0 = Date.now(), s = S.cpuShot(g, k + 1, level); ms += Date.now() - t0; if (S.judge(g, S.simulateShot(g.balls, s)).verdict.point) pts++; });
    return { pts, ms: Math.round(ms / layouts.length) };
  };
  const e = rate('easy'), h = rate('hard');
  check('CPU: hard scores more than easy over 40 seeded layouts, and hard makes 20% or more', h.pts > e.pts && h.pts >= 8, JSON.stringify({ easy: e, hard: h }));
  check('CPU: a hard search is quick (under 1.5 s a shot here)', h.ms < 1500, `${h.ms} ms`);
  const yg = play(); yg.turn = 1; yg.striker = Y;
  const ys = S.cpuShot(yg, 3, 'medium');
  check('CPU: on yellow\'s turn it strikes yellow', ys.ball === Y && Number.isFinite(ys.angle) && ys.power > 0 && ys.power <= 1);
  const bs = S.cpuShot(S.newGame('carom'), 5, 'hard'), br = S.simulateShot(S.newGame('carom').balls, bs);
  check('CPU: on the break it hits the red first', br.seq.find(x => x >= 0) === R, JSON.stringify(br.seq.slice(0, 6)));
  const sg = S.suggestCarom(play());
  check('auto aim: a suggested line and the ball it meets first, no pocket', sg && Number.isFinite(sg.angle) && [Y, R].includes(sg.n) && sg.k === -1, JSON.stringify(sg));
}
S.setTable('7');

/* ---- the page ---- */
(async () => {
  const { browser, page, errors } = await open('', { viewport: { width: 440, height: 956 }, hasTouch: true, deviceScaleFactor: 1 });
  await page.evaluate(() => { localStorage.clear(); settings.cpu = false; settings.autoAim = true; });
  await page.click('#playC');
  const su = await page.evaluate(() => ({ title: setupTitle.textContent, race: [cr5, cr10, cr15].map(b => b.getAttribute('aria-pressed')), cush: [cc3, cc1].map(b => b.getAttribute('aria-pressed')),
    pool: !!tb7.getClientRects().length, carom: !!cr10.getClientRects().length }));
  check('setup (three-cushion): race to 5 / 10 / 15 (10) and three or one cushion (three); no pool table options', su.title === 'Three-Cushion' && su.race.join() === 'false,true,false' && su.cush.join() === 'true,false' && !su.pool && su.carom, JSON.stringify(su));
  check('setup (three-cushion): targets 44 px, text 4.5:1', (await smallTargets(page)).length === 0 && (await lowContrast(page)).length === 0, JSON.stringify([await smallTargets(page), await lowContrast(page)]));
  await page.click('#breakBtn');
  await page.waitForTimeout(300);
  const s0 = await page.evaluate(() => ({ kind: felt.game.kind, table: felt.table, st: felt.state, n: felt.game.balls.length, striker: felt.striker, R: BALL_R, chips: [...document.querySelectorAll('.pchip:not([hidden]) .pb')].map(e => e.textContent), hint: felt.hint, sub: bannerSub.textContent }));
  check('the card starts three-cushion on the carom table: three balls, white to break, chips at 0/10, auto aim on the red',
    s0.kind === 'carom' && s0.table === 'carom' && s0.st === 'aim' && s0.n === 3 && s0.striker === 70 && s0.R === 0.03075 && s0.chips.join() === '0/10,0/10' && s0.hint && s0.hint.n === 72 && /red first/.test(s0.sub), JSON.stringify(s0));
  const tdrag = async (from, to, n = 6) => {
    const cdp = await page.context().newCDPSession(page), pt = p => [{ x: p[0], y: p[1], id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(from) });
    for (let i = 1; i <= n; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt([from[0] + (to[0] - from[0]) * i / n, from[1] + (to[1] - from[1]) * i / n]) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const barShot = async frac => {
    const snap = await page.evaluate(() => JSON.stringify(felt.game.balls)), n0 = await page.evaluate(() => felt.game.shots);
    const hb = await page.evaluate(() => { const r = powerBar.getBoundingClientRect(); return { lo: r.left, hi: r.right, y: r.y + r.height / 2 }; });
    await tdrag([hb.lo + 10, hb.y], [hb.lo + 10 + (hb.hi - hb.lo) * frac, hb.y]);
    await page.waitForFunction(n => felt.game.shots === n + 1, n0, { timeout: 30000 });
    return page.evaluate(b => {
      const s = felt.lastShot, row = x => JSON.stringify(x.map(o => [o.n, o.on, o.x, o.y])), sim = simulateShot(JSON.parse(b), s);
      return { same: row(sim.balls) === row(felt.lastResult.balls) && JSON.stringify(sim.seq) === JSON.stringify(felt.lastResult.seq), ball: s.ball, seq: felt.lastResult.seq.length };
    }, snap);
  };
  await page.evaluate(() => { felt.speed = 40; });
  const o1 = await barShot(0.6);
  await settled(page);
  check('the bar shoots white, the live roll equal to simulateShot byte for byte (balls and contact sequence)', o1.same && o1.ball === 70, JSON.stringify(o1));
  /* a known point through the hook: a layout and a shot the CPU's noiseless search finds */
  const pt = await page.evaluate(async () => {
    const g = felt.game;
    g.turn = 0; g.striker = 70; g.breakShot = false; g.winner = null; state = 'aim';
    const at = { 70: [0.9, 0.35], 71: [2.1, 1.05], 72: [1.6, 0.5] };
    for (const b of g.balls) { b.x = at[b.n][0]; b.y = at[b.n][1]; b.on = true; }
    const s = cpuShot(g, 1, 'hint'), r0 = simulateShot(g.balls, s), want = judge(g, r0).verdict.point, score = g.score[0];
    const snap = JSON.stringify(g.balls);
    felt.shoot(s.angle, s.power, s.spin);
    while (['stroke', 'rolling'].includes(felt.state)) await new Promise(r => setTimeout(r, 30));
    const row = x => JSON.stringify(x.map(o => [o.n, o.on, o.x, o.y]));
    return { want, point: felt.game.verdict.point, score: felt.game.score[0] - score, turn: felt.game.turn, same: row(simulateShot(JSON.parse(snap), felt.lastShot).balls) === row(felt.lastResult.balls),
      chip: document.querySelector('#pchip0 .pb').textContent, head: bannerHead.textContent };
  });
  check('a scoring shot through felt.shoot: the point counts, the turn stays, the chip and banner show it, byte for byte',
    pt.want && pt.point && pt.score === 1 && pt.turn === 0 && pt.same && /^\d+\/10$/.test(pt.chip) && /^Point/.test(pt.head), JSON.stringify(pt));
  /* the point is the notable shot, and its replay rebuilds the carom roll exactly */
  await page.waitForTimeout(100);
  const rp0 = await page.evaluate(() => ({ notable: felt.lastShot.notable, geo: felt.lastShot.geo, lab: replayLab.textContent, gold: replayBtn.hasAttribute('data-notable'), aria: replayBtn.getAttribute('aria-label'), ok: (felt.speed = 8, felt.replay()) }));
  await page.waitForFunction(() => !felt.replaying, null, { timeout: 30000 });
  const rp1 = await page.evaluate(() => ({ same: JSON.stringify(felt.replayResult && felt.replayResult.balls) === JSON.stringify(felt.lastResult.balls) && JSON.stringify(felt.replayResult.seq) === JSON.stringify(felt.lastResult.seq), R: BALL_R, kind: felt.game.kind, st: felt.state }));
  check('replay: a carom point is notable (a gold Replay pill), and its replay rolls the same balls and contacts on the carom table',
    rp0.notable === 'point' && rp0.lab === 'Replay' && rp0.gold && /point/.test(rp0.aria) && /^carom,/.test(rp0.geo) && /0\.03075$/.test(rp0.geo) && rp0.ok && rp1.same && rp1.R === 0.03075 && rp1.st === 'aim', JSON.stringify({ rp0, rp1 }));
  await page.evaluate(() => { felt.speed = 40; });
  /* the full guide: a dashed path with the first three cushions dotted */
  const gd = await page.evaluate(() => {
    settings.guide = 'full'; aimAngle = 0.62; cueSpin = { x: 0.3, y: 0.2 }; markPower = 0.6; preview = null; previewWork = null;
    for (let i = 0; i < 40 && !(preview && preview.done && preview.key); i++) draw(performance.now());
    const P = preview;
    return { bounces: P ? P.bounces.length : -1, cc: P ? P.cc : -1, cue: P ? P.cue.length : 0, legal: guideLegal };
  });
  check('carom guide: the cue ball\'s path through its first three cushions, a dot on each, no illegal ring on a cushion-first line', gd.bounces === 3 && gd.cc >= 3 && gd.cue > 3 && gd.legal, JSON.stringify(gd));
  /* the pause menu: points over the race, no potted row */
  await page.click('#menuBtn');
  const pm = await page.evaluate(() => ({ m0: p0meta.textContent, m1: p1meta.textContent, pot: getComputedStyle(potRow).display, tab: (showHelp(), [...document.querySelectorAll('#helpSheet .pan')].filter(p => !p.hidden).map(p => p.id)) }));
  check('pause menu: each card shows its colour and points of the race, no potted row; How to play opens on the Carom page', /^White, \d+ of 10/.test(pm.m0) && /^Yellow, \d+ of 10/.test(pm.m1) && pm.pot === 'none' && pm.tab.join() === 'panCarom', JSON.stringify(pm));
  await page.evaluate(() => backToMenu());
  await page.click('#resumeBtn');
  /* the CPU plays yellow and hands the turn back */
  const cpu = await page.evaluate(async () => {
    settings.cpu = true; settings.level = 'hard'; felt.start('carom'); felt.speed = 40;
    const g = felt.game; g.breakShot = false;
    felt.shoot(0.3, 0.05, 0);
    const seen = [];
    for (let i = 0; i < 600 && (felt.game.turn === 1 || felt.game.shots < 2); i++) { if (felt.state === 'thinking') seen.push(1); await new Promise(r => setTimeout(r, 25)); if (felt.game.winner !== null) break; }
    return { thought: seen.length > 0, last: felt.lastShot.ball, shots: felt.game.shots };
  });
  check('vs CPU: it thinks, strikes yellow, and the turn comes back', cpu.thought && cpu.last === 71 && cpu.shots >= 2, JSON.stringify(cpu));
  const won = await page.evaluate(() => { felt.game.score = [3, 10]; felt.game.innings = [4, 4]; felt.game.high = [1, 4]; felt.game.winner = 1; felt.game.verdict = { why: '10 points' }; finish(); return { kind: overKind.textContent, text: overText.textContent, why: overWhy.textContent, rows: [...overStats.querySelectorAll('tbody th')].map(t => t.textContent) }; });
  check('game over: three-cushion, the race reached, points, innings, average and high run', /^Three-cushion/.test(won.kind) && /CPU wins/.test(won.text) && /10 points/.test(won.why) && won.rows.join() === 'Points,Innings,Average,High run', JSON.stringify(won));
  const rec = await page.evaluate(() => felt.record.kinds.carom);
  check('the record counts the carom game', rec && rec.played === 1 && rec.cpu.hard.l === 1, JSON.stringify(rec));
  await page.click('#rematch');
  const re = await page.evaluate(() => ({ kind: felt.game.kind, table: felt.table, white: felt.game.balls[0].y > TW / 2 }));
  await page.evaluate(() => { settings.cpu = false; felt.start('8'); });
  const back = await page.evaluate(() => ({ table: felt.table, R: BALL_R, n: POCKETS.length }));
  check('rematch is carom again (the break side alternates); an 8-ball game after it is back on pool with the pool ball', re.kind === 'carom' && re.table === 'carom' && back.table === '7' && back.R === 0.028575 && back.n === 6, JSON.stringify({ re, back }));

  /* the home's Three-cushion card is on the first screen either way up, painted, and names its setup */
  const fits = [];
  for (const [w, h] of [[440, 956], [956, 440]]) {
    await page.setViewportSize({ width: w, height: h });
    fits.push(await page.evaluate(async () => {
      quitToHome(); settings.last = 'carom'; relayout(); showMenu();
      await new Promise(r => setTimeout(r, 300));
      const c = playC.querySelector('.art'), d = c.getContext('2d').getImageData(c.width / 2, c.height / 3, 1, 1).data, r = playC.getBoundingClientRect();
      return { size: innerWidth + 'x' + innerHeight, sw: document.documentElement.scrollWidth, vw: innerWidth, art: d[3] === 255, inside: r.bottom <= innerHeight && r.right <= innerWidth, h: r.height, sum: playC.getAttribute('aria-label') };
    }));
  }
  check('home: the Three-cushion card painted and on the first screen at 440x956 and 956x440, no sideways scroll; its label names its setup',
    fits.every(f => f.sw <= f.vw && f.art && f.inside && f.h >= 88 && /^Three-cushion.*\d+ points/.test(f.sum)), JSON.stringify(fits));

  /* every overlay against the brightest cloth the carom table paints (off its spots), on each cloth, and blue on a pool table */
  await page.setViewportSize({ width: 440, height: 956 });
  const ov = [];
  for (const [kind, cloth] of [['carom', 'green'], ['carom', 'red'], ['carom', 'blue'], ['8', 'blue']]) {
    ov.push(await page.evaluate(([kind, cloth]) => {
      settings.cloth = cloth; felt.start(kind); layout();
      for (const b of game.balls) b.on = false;
      state = 'over'; draw(performance.now());
      const c = table.getContext('2d'), lum = v => { const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(v[0]) + 0.7152 * f(v[1]) + 0.0722 * f(v[2]); };
      let best = [0, 0, 0], bl = 0;
      for (let i = 1; i < 10; i++) for (let j = 1; j < 6; j++) { const s = toScreen(TL * (i / 10 + 0.02), TW * j / 6), d = c.getImageData(Math.round(s[0] * dpr), Math.round(s[1] * dpr), 1, 1).data; const l = lum(d); if (l > bl) { bl = l; best = [d[0], d[1], d[2]]; } }
      const over = (f, a) => f.map((v, i) => v * a + best[i] * (1 - a)), hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
      const cr = x => { const a = lum(x); return +((Math.max(a, bl) + 0.05) / (Math.min(a, bl) + 0.05)).toFixed(2); };
      return { kind, cloth, white: cr(over([255, 255, 255], CL.ovMin)), illegal: cr(hex(ILLEGAL)), halo: cr(over([255, 236, 190], 0.95)), loupe: cr(over([255, 255, 255], 0.85)), bed: best };
    }, [kind, cloth]));
  }
  check('contrast: every overlay (white lines and rings at the floor alpha, illegal, halo, loupe) keeps 3:1 on the brightest carom cloth, green, red and blue, and on a blue pool table',
    ov.every(o => o.white >= 3 && o.illegal >= 3 && o.halo >= 3 && o.loupe >= 3), JSON.stringify(ov));
  const bl = ov.find(o => o.cloth === 'blue' && o.kind === 'carom').bed;
  check('the blue cloth is blue', bl[2] > bl[1] + 20 && bl[2] > bl[0] + 40, JSON.stringify(bl));
  await page.evaluate(() => { settings.cloth = 'green'; });
  check('no console errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
