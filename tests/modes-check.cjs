/* modes-check: the More modes (page 6f, sim 1e's ring rulesets).
   1. Quick tournament: a seeded field and draw (the same seed, the same tournament), the CPU
      matches settled by the match model and labelled simulated, the bracket on its page, the
      player's match raced on the table (felt.forceWin) with the rack sheet between racks, the
      result advancing the bracket, a reload resuming it (felt.tourney.v1), a match left mid-way
      (Quit, or the page closed) counted as a forfeit, and the winner's screen.
   2. AI exhibition: CPU against CPU runs a 9-ball rack to its end with no input at all, at speed,
      through the speed bar and pause; the same seed plays the same rack shot for shot.
   3. Party: three players on 9-ball ring take their turns round the table (a foul passes it, a pot
      keeps it), the handoff names the next player every time the turn passes, the rack's winner
      and the racks won are right; rotation ring's points go to the player who potted them.
   Pages: 44 px targets and 4.5:1 text at 375x667 and 440x956, nothing wider than the screen. */
'use strict';
const { check, done, open, smallTargets, lowContrast } = require('./lib.cjs');

(async () => {
  /* ---------- the ring rulesets in the rules engine (sim 1e), in Node ---------- */
  const S = require('./sim.cjs').loadSim();
  const R3 = S.makeRules('9', { ruleset: '9-ring', options: { players: 3 } }), R9 = S.makeRules('9', { ruleset: '9-ring', options: { players: 9 } }), R8 = S.makeRules('8', { options: { players: 3 } });
  check('rules: a ring ruleset takes 2 to 4 players (more is held to 4); a two-player set stays at 2', R3.players === 3 && R9.players === 4 && R8.players === 2 && S.makeRules('9').players === 2, JSON.stringify([R3.players, R9.players, R8.players]));
  const g3 = S.newGame('straight', { rules: { ruleset: 'straight-ring', options: { players: 3 } } });
  check('rules: a ring game keeps a foul count, a score and a best run per player, and passes the turn round the table', g3.fouls.length === 3 && g3.score.length === 3 && g3.high.length === 3
    && S.playersOf(g3) === 3 && [0, 1, 2].map(p => S.nextOf(g3, p)).join() === '1,2,0' && S.nextOf(S.newGame('9'), 1) === 0, JSON.stringify(g3.score));
  /* Around the table: a breaking foul hands player 1 the choice; "they break again" goes back to player 0 */
  const res = (pot, first) => ({ potted: pot, first, balls: g3.balls.map(b => Object.assign({}, b, { on: b.on && !pot.includes(b.n) })), rails: {}, railAfter: false, pocketOf: {}, crossed: true });
  const j = S.judge(g3, res([], 1));
  const back = j.option && S.chooseOption(j, 'rebreak');
  check('rules: Around the table, a breaking foul: the next player (1) chooses; a re-break goes back to the breaker (0)', j.verdict.foul && j.option && j.option.who === 1 && back && back.turn === 0 && back.breaker === 0 && back.score[0] === -2, JSON.stringify([j.verdict.foul, j.option, back && back.turn]));
  const gr = Object.assign(S.newGame('rotation', { rules: { ruleset: 'rotation-ring', options: { players: 3 } } }), { breakShot: false, inHand: null, turn: 2, score: [20, 30, 5] });
  gr.balls.forEach(b => { b.on = b.n === 0 || b.n === 15; });
  const jr = S.judge(gr, { potted: [15], first: 15, balls: gr.balls.map(b => Object.assign({}, b, { on: b.n === 0 })), rails: {}, railAfter: true, pocketOf: { 15: 0 }, crossed: true });
  check('rules: rotation ring, the last ball: its points (15) go to the shooter, the most points win the rack', jr.score.join() === '20,30,20' && jr.winner === 1, JSON.stringify([jr.score, jr.winner]));

  const { browser, page, errors } = await open('', { viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const ev = (f, a) => page.evaluate(f, a);
  const idle = (t = 30000) => page.waitForFunction(() => !['stroke', 'rolling', 'thinking'].includes(felt.state), null, { timeout: t });

  /* ---------- the home row and the pages ---------- */
  const row = await ev(() => { settings.last = '8'; relayout(); showMenu(); const r = playModes.getBoundingClientRect(), g = playMore.getBoundingClientRect(); return { h: r.height, w: r.width, beside: Math.abs(r.top - g.top) < 1 && r.left > g.right, text: playModes.textContent.trim(), sh: menu.scrollHeight, ch: menu.clientHeight, sw: menu.scrollWidth - menu.clientWidth }; });
  /* 375x667 scrolls a little since the QA pass (F3: the cards keep their size); qa-check pins the home's fit */
  check('home: a More modes row beside More games, 44 px, no sideways scroll at 375x667', row.h >= 44 && row.w >= 44 && row.beside && /More modes/.test(row.text) && row.sw <= 0, JSON.stringify(row));
  const pages = [];
  for (const [w, h] of [[375, 667], [440, 956]]) {
    await page.setViewportSize({ width: w, height: h });
    for (const p of ['root', 'tsetup', 'exsetup', 'psetup']) {
      await ev(p => showModes(p), p);
      await page.waitForTimeout(80);
      const a = await ev(() => ({ page: mdBody.dataset.page, sw: mdSheet.scrollWidth, cw: mdSheet.clientWidth, dw: document.documentElement.scrollWidth, vw: innerWidth, scrolls: mdSheet.scrollHeight <= mdSheet.clientHeight || getComputedStyle(mdSheet).overflowY === 'auto', cap: !!mdBody.querySelector('.cvBtn') }));
      a.small = (await smallTargets(page)).length; a.low = await lowContrast(page);
      a.size = `${w}x${h}`;
      pages.push(a);
    }
  }
  check('pages (the list, tournament, exhibition and party setups) at 375x667 and 440x956: in the screen, scroll, accent capsule, 44 px, 4.5:1',
    pages.every(a => a.sw <= a.cw && a.dw <= a.vw && a.scrolls && (a.page === 'root' || a.cap) && !a.small && !a.low.length), JSON.stringify(pages.filter(a => a.small || a.low.length || a.sw > a.cw)));
  await page.setViewportSize({ width: 375, height: 667 });
  const ring = await ev(() => ({ two: ['8', '9', '10', 'straight', 'rotation'].every(k => rulesetsFor(k).every(r => !r.ring)), ring: ringRulesets().map(r => r.game).sort().join(), party: [...mdBody.querySelectorAll('.seg button')].length }));
  check('party: only the ring rulesets (9-ball, rotation, straight pool) are offered; the two-player setups never list them', ring.two && ring.ring === '9,rotation,straight', JSON.stringify(ring));

  /* ---------- 1. the quick tournament ---------- */
  const T0 = await ev(() => felt.tourneyCreate({ kind: '9', ruleset: '9-house', size: 4, fmt: 'single', race: 2, field: 'easy', seed: 11 }));
  const T1 = await ev(() => felt.tourneyCreate({ kind: '9', ruleset: '9-house', size: 4, fmt: 'single', race: 2, field: 'easy', seed: 11 }));
  const stored = await ev(() => JSON.parse(localStorage.getItem('felt.tourney.v1')));
  const names = T0.field.map(p => p.name);
  check('tournament: four entrants, you and three named CPU players with personalities, all different', T0.field.length === 4 && T0.field[0].name === 'You' && new Set(names).size === 4
    && T0.field.slice(1).every(p => p.level === 'easy' && typeof p.arch === 'string' && p.av && p.av.ini), JSON.stringify(T0.field));
  check('tournament: the same seed makes the same field, draw and simulated results; it is saved as felt.tourney.v1', JSON.stringify(T0) === JSON.stringify(T1) && stored && stored.v === 1 && JSON.stringify(stored.res) === JSON.stringify(T0.res), JSON.stringify([T0.res, T1.res]));
  check('tournament: the other semi-final is settled by the model and marked simulated; the final waits', T0.res.filter(Boolean).length === 1 && T0.sim.filter(Boolean).length === 1 && T0.res[2] === null && !T0.done, JSON.stringify(T0));
  await ev(() => showModes('tour'));
  const br = await ev(() => ({ rows: [...mdBody.querySelectorAll('.bm')].map(d => ({ st: d.dataset.st, sim: d.dataset.sim === '1', text: d.textContent })), play: !!document.getElementById('mdPlay'), heads: [...mdBody.querySelectorAll('.cvHead')].map(h => h.textContent) }));
  check('tournament page: the bracket by round (semi-finals, final), the simulated match labelled, Play match', br.rows.length === 3 && br.rows.some(r => r.sim && /simulated/.test(r.text)) && br.play && br.heads.includes('Semi-final') && br.heads.includes('Final'), JSON.stringify(br));
  const tp = await ev(async () => {
    mdPlay.click();
    await new Promise(r => setTimeout(r, 100));
    return { mode: felt.mode, m: felt.tmatch, cpu: felt.cpu, locked: game.rules.locked, ruleset: game.rules.id, live: JSON.parse(localStorage.getItem('felt.tourney.v1')).live, state: felt.state, sheet: modesSheet.classList.contains('show') };
  });
  check('tournament: Play match starts the rack on the table against the opponent (locked rules, the match marked live in the save)', tp.mode === 'tourney' && tp.m && tp.m.rack === 1 && tp.cpu && tp.locked && tp.ruleset === '9-house' && tp.live === tp.m.m && !tp.sheet && ['aim', 'thinking'].includes(tp.state), JSON.stringify(tp));
  const r1 = await ev(async () => {
    const b0 = game.breaker;
    felt.forceWin(0);
    const a = { rack: rackSheet.classList.contains('show'), title: rackTitle.textContent, score: felt.tmatch.score.slice(), b0 };
    rackGo.click();
    await new Promise(r => setTimeout(r, 50));
    a.next = { rack: felt.tmatch.rack, b1: game.breaker, mode: felt.mode, sheet: rackSheet.classList.contains('show') };
    pause();
    a.pause = { card: !careerNow.hidden, name: cnName.textContent, score: cnScore.textContent, restart: restartBtn.hidden, quit: exitBtn.textContent.trim() };
    resume();
    return a;
  });
  check('tournament: a rack won shows the rack sheet (Rack 2, 1-0), Next rack starts it with the other player breaking', r1.rack && r1.title === 'Rack 2' && r1.score.join() === '1,0' && r1.next.rack === 2 && r1.next.b1 !== r1.b0 && !r1.next.sheet, JSON.stringify(r1));
  check('tournament: the pause menu shows the opponent, the score, no Restart, and Quit says Forfeit match', r1.pause.card && r1.pause.score === '1-0' && r1.pause.restart && r1.pause.quit === 'Forfeit match' && r1.pause.name === tp.m.foe, JSON.stringify(r1.pause));
  const r2 = await ev(async () => {
    felt.forceWin(0);
    await new Promise(r => setTimeout(r, 50));
    const t = felt.tourney;
    return { mode: felt.mode, page: mdBody.dataset.page, show: modesSheet.classList.contains('show'), msg: (document.getElementById('mdMsg') || {}).textContent, res: t.res, live: t.live, play: !!document.getElementById('mdPlay'), state: felt.state };
  });
  const semi = tp.m.m;
  check('tournament: the match won 2-0 is reported, the bracket advances, the page says so and offers the final', r2.mode === null && r2.show && r2.page === 'tour' && /You beat/.test(r2.msg || '') && r2.res[semi] && Math.max(...r2.res[semi]) === 2 && Math.min(...r2.res[semi]) === 0 && r2.live === null && r2.play && r2.state === 'menu', JSON.stringify(r2));
  /* reload: the tournament is there, as it was */
  await page.reload(); await page.waitForFunction(() => window.booted === true);
  const rl = await ev(() => { showModes(); const sub = mdTour.textContent; showModes('tour'); return { t: felt.tourney, sub, play: !!document.getElementById('mdPlay') }; });
  check('tournament: after a reload it resumes where it was (the final against the other semi-final\'s winner)', rl.t && JSON.stringify(rl.t.res) === JSON.stringify(r2.res) && rl.play && /Final against/.test(rl.sub), JSON.stringify({ sub: rl.sub, res: rl.t && rl.t.res }));
  /* the final, left half way by Quit: a forfeit, a loss; the tournament ends with you runner-up */
  const ff = await ev(async () => {
    mdPlay.click();
    await new Promise(r => setTimeout(r, 50));
    felt.forceWin(0);
    rackGo.click();
    await new Promise(r => setTimeout(r, 50));
    felt.quitToHome();
    const t = felt.tourney;
    showModes('tour');
    return { mode: felt.mode, res: t.res[2], ff: t.ff[2], done: t.done, place: t.places && t.places.find(p => p[0] === 0)[1], msg: (document.getElementById('mdMsg') || {}).textContent, win: (document.getElementById('mdWinner') || {}).textContent, forfeitLabel: [...mdBody.querySelectorAll('.bm')].some(d => /forfeit/.test(d.textContent)) };
  });
  check('tournament: Quit mid-match forfeits it (1 rack of 2 kept, the race to the opponent), labelled forfeit', ff.mode === null && ff.res && Math.max(...ff.res) === 2 && Math.min(...ff.res) === 1 && ff.ff && /Forfeit/.test(ff.msg || '') && ff.forfeitLabel, JSON.stringify(ff));
  check('tournament: then it is over: the winner\'s screen names the champion and your place (runner-up)', ff.done && ff.place === 2 && /wins it/.test(ff.win || '') && /runner-up/.test(ff.win || ''), JSON.stringify(ff));
  /* a match left by closing the page: forfeited at the next boot */
  await ev(() => { felt.tourneyCreate({ kind: '8', size: 8, fmt: 'double', race: 1, field: 'mixed', seed: 5 }); felt.tourneyPlay(); });
  const live = await ev(() => felt.tourney.live);
  await page.reload(); await page.waitForFunction(() => window.booted === true);
  const lb2 = await ev(m => { const t = felt.tourney; return { live: t.live, res: t.res[m], ff: t.ff[m], msg: t.msg, done: t.done, next: tMine(tour), round: tMine(tour) !== null ? tRound(tour, tMine(tour)) : null }; }, live);
  check('tournament (double elimination): a match left by closing the page is a forfeit at the next boot; you drop to the losers bracket', lb2.live === null && lb2.ff && lb2.res && /Forfeit/.test(lb2.msg) && !lb2.done && /Losers bracket/.test(lb2.round || ''), JSON.stringify(lb2));
  /* the winner's screen: every match won */
  const ch = await ev(async () => {
    felt.tourneyCreate({ kind: '9', size: 4, fmt: 'single', race: 1, field: 'hard', seed: 3 });
    for (let i = 0; i < 3 && felt.tourneyPlay(); i++) { felt.forceWin(0); await new Promise(r => setTimeout(r, 30)); }
    const t = felt.tourney;
    return { done: t.done, place: t.places && t.places[0][0], win: (document.getElementById('mdWinner') || {}).textContent, page: mdBody.dataset.page, rows: mdBody.querySelectorAll('.cv .topic').length };
  });
  check('tournament: win every match and the winner\'s screen says you are the champion, with the final places', ch.done && ch.place === 0 && /champion/.test(ch.win || '') && ch.page === 'tour', JSON.stringify(ch));
  const wa = { small: (await smallTargets(page)).length, low: await lowContrast(page) };
  check('tournament page (winner): 44 px, 4.5:1', !wa.small && !wa.low.length, JSON.stringify(wa));

  /* ---------- 2. the AI exhibition ---------- */
  const run = seed => ev(async seed => {
    window.__inputs = 0;
    for (const t of ['pointerdown', 'keydown']) addEventListener(t, () => window.__inputs++, { capture: true, once: false });
    felt.exhibition({ kind: '9', a: { level: 'easy', arch: 'potter' }, b: { level: 'easy', arch: 'defender' }, seed });
    const a = { human: human(), cpu: felt.cpu, bar: !exBar.hidden, names: [nameOf(0), nameOf(1)], prof: exhib.prof.map(p => p.arch) };
    exS2.click(); a.s2 = felt.speed === 2 && exS2.getAttribute('aria-pressed') === 'true';
    exS4.click(); a.s4 = felt.speed === 4;
    exPause.click(); a.paused = felt.paused; resume();
    felt.speed = 24;
    /* every shot as it is struck: the record shoot() makes (felt.lastShot) */
    const shots = [];
    let rec = felt.lastShot;
    Object.defineProperty(felt, 'lastShot', { configurable: true, get: () => rec, set: v => { rec = v; shots.push([v.angle, v.power, v.spin.x, v.spin.y, game.turn]); } });
    const t0 = performance.now();
    while (felt.state !== 'over' && performance.now() - t0 < 50000) await new Promise(r => setTimeout(r, 20));
    a.over = felt.state === 'over'; a.winner = game.winner; a.shots = shots; a.balls = JSON.stringify(game.balls.map(b => [b.n, b.on, +b.x.toFixed(9), +b.y.toFixed(9)]));
    a.overShown = over.classList.contains('show'); a.overText = overText.textContent;
    a.inputs = window.__inputs; a.ms = Math.round(performance.now() - t0);
    felt.speed = 1;
    return a;
  }, seed);
  const recBefore = await ev(() => JSON.stringify(felt.record.kinds['9']));
  const e1 = await run(21);
  const e2 = await run(21);
  const recAfter = await ev(() => JSON.stringify(felt.record.kinds['9']));
  check('exhibition: both players are the CPU (no human turn), named, each with its own personality; the speed bar shows', !e1.human && !e1.cpu && e1.bar && e1.names.every(n => /\w+ \w+/.test(n)) && e1.prof.join() === 'potter,defender', JSON.stringify(e1).slice(0, 300));
  check('exhibition: the bar sets 2x and 4x (felt.speed) and pauses', e1.s2 && e1.s4 && e1.paused, JSON.stringify({ s2: e1.s2, s4: e1.s4, p: e1.paused }));
  check('exhibition: the rack runs to its end with no input, and game over names the winner', e1.over && e1.winner !== null && e1.inputs === 0 && e1.overShown && /wins/.test(e1.overText) && e1.shots.length >= 2, JSON.stringify({ over: e1.over, w: e1.winner, n: e1.shots.length, inputs: e1.inputs, ms: e1.ms, text: e1.overText }));
  check('exhibition: the same seed plays the same rack, shot for shot, to the same end', e2.over && JSON.stringify(e1.shots) === JSON.stringify(e2.shots) && e1.balls === e2.balls && e1.winner === e2.winner, JSON.stringify({ a: e1.shots.length, b: e2.shots.length, ms: [e1.ms, e2.ms], diff: e1.shots.findIndex((x, i) => JSON.stringify(x) !== JSON.stringify(e2.shots[i])), s1: e1.shots.slice(0, 6), s2: e2.shots.slice(0, 6) }));
  check('exhibition: nobody\'s record changes', recBefore === recAfter, recAfter);

  /* ---------- 3. the party ---------- */
  /* a shot that pots ball n into pocket k from close in (draw, so the cue ball stays), or one at
     the empty cloth (no ball hit: a foul) */
  const setup = (only, at) => ev(([only, at]) => {
    game.breakShot = false; game.inHand = null; state = 'aim'; hint = null; aimAnim = null;
    for (const b of game.balls) { b.on = b.n === 0 || only.includes(b.n); }
    for (const [n, x, y] of at) Object.assign(game.balls.find(b => b.n === n), { x, y, vx: 0, vy: 0, on: true });
  }, [only, at]);
  const potAim = (n, k) => ev(([n, k]) => {
    const P = POCKET_AIM[k], c = [TL / 2, TW / 2], d = Math.hypot(c[0] - P[0], c[1] - P[1]), u = [(c[0] - P[0]) / d, (c[1] - P[1]) / d];
    const o = [P[0] + u[0] * 0.18, P[1] + u[1] * 0.18], q = [P[0] + u[0] * 0.5, P[1] + u[1] * 0.5];
    Object.assign(game.balls.find(b => b.n === n), { x: o[0], y: o[1], on: true });
    Object.assign(game.balls.find(b => b.n === 0), { x: q[0], y: q[1], on: true });
    return Math.atan2(o[1] - q[1], o[0] - q[0]);
  }, [n, k]);
  const shoot = async (a, p, s = 0) => { await ev(([a, p, s]) => { handoff.classList.remove('show'); felt.shoot(a, p, s); }, [a, p, s]); await page.waitForTimeout(50); await idle(); await page.waitForTimeout(50); };
  const st = () => ev(() => ({ turn: game.turn, fouls: game.fouls.slice(), hand: game.inHand, winner: game.winner, ho: felt.handoff, shots: stats.shots.slice(), sfouls: stats.fouls.slice(), score: game.score ? game.score.slice() : null, chip: turnChip.dataset.name, state: felt.state }));
  await ev(() => { felt.speed = 6; felt.party({ ruleset: '9-ring', names: ['Ann', 'Bob', 'Cy'] }); });
  const p0 = await ev(() => ({ mode: felt.mode, n: playersOf(game), fouls: game.fouls.length, ho: felt.handoff, cpu: felt.cpu, locked: game.rules.locked, id: game.rules.id, sub: hoSub.textContent, board: hoBoard.children.length, chips: [pchip0.textContent, pchip1.textContent] }));
  check('party: three players on 9-ball ring, two-player-free (no CPU), the first handoff names the breaker and lists everyone', p0.mode === 'party' && p0.n === 3 && p0.fouls === 3 && !p0.cpu && p0.locked && p0.id === '9-ring' && p0.ho.shown && p0.ho.who === 0 && p0.ho.title === 'Ann breaks' && p0.board === 3, JSON.stringify(p0));
  const hs = { small: (await smallTargets(page)).length, low: await lowContrast(page) };
  check('party: the handoff sheet has 44 px targets and 4.5:1 text', !hs.small && !hs.low.length, JSON.stringify(hs));
  await ev(() => hoGo.click());
  /* Ann pots the 1 (keeps the table, no handoff) */
  await setup([1, 2, 9], [[2, 1.2, 0.7], [9, 1.4, 0.75]]);
  let a = await potAim(1, 0);
  const c0 = (await st()).ho.count;
  await shoot(a, 0.32, -0.5);
  const s1 = await st();
  check('party: a pot keeps the table, no handoff', s1.turn === 0 && s1.winner === null && s1.ho.count === c0 && !s1.ho.shown && s1.shots[0] === 1, JSON.stringify(s1));
  /* Ann hits nothing: a foul, Bob to shoot with ball in hand, the handoff says so */
  await setup([2, 9], [[0, 0.3, 0.3], [2, 1.2, 0.7], [9, 1.4, 0.75]]);
  await shoot(Math.PI, 0.1);
  const s2 = await st();
  const sub2 = await ev(() => hoSub.textContent);
  check('party: a foul passes the turn to the next player (Bob) with ball in hand; the handoff names him and the foul', s2.turn === 1 && s2.hand === 'table' && s2.fouls.join() === '1,0,0' && s2.sfouls[0] === 1 && s2.ho.shown && s2.ho.who === 1 && s2.ho.title === 'Pass to Bob' && /Ann fouled/.test(sub2) && s2.ho.count === c0 + 1, JSON.stringify([s2, sub2]));
  /* Bob and Cy foul too: round the table back to Ann */
  await setup([2, 9], [[0, 0.3, 0.3], [2, 1.2, 0.7], [9, 1.4, 0.75]]);
  await shoot(Math.PI, 0.1);
  const s3 = await st();
  await setup([2, 9], [[0, 0.3, 0.3], [2, 1.2, 0.7], [9, 1.4, 0.75]]);
  await shoot(Math.PI, 0.1);
  const s4 = await st();
  check('party: the turn goes round in order: Bob fouls to Cy, Cy fouls back to Ann, each with a handoff', s3.turn === 2 && s3.ho.title === 'Pass to Cy' && s4.turn === 0 && s4.ho.title === 'Pass to Ann' && s4.fouls.join() === '1,1,1' && s4.ho.count === c0 + 3 && s4.chip === 'Ann', JSON.stringify([s3, s4]));
  /* Ann, ball on the 9 alone, pots it: she wins the rack */
  await setup([9], [[9, 1.4, 0.75]]);
  a = await potAim(9, 2);
  await shoot(a, 0.32, -0.5);
  const s5 = await ev(() => ({ winner: game.winner, wins: felt.partyState.wins, over: over.classList.contains('show'), text: overText.textContent, cols: overStats.querySelectorAll('thead th').length, ho: felt.handoff.shown }));
  check('party: Ann pots the 9: she wins, the racks won read 1-0-0, game over has a column per player', s5.winner === 0 && s5.wins.join() === '1,0,0' && s5.over && s5.text === 'Ann wins' && s5.cols === 4 && !s5.ho, JSON.stringify(s5));
  const rm = await ev(() => { rematch.click(); return { turn: game.turn, breaker: game.breaker, wins: felt.partyState.wins, ho: felt.handoff }; });
  check('party: Rematch is the next rack: the wins kept, the break passed on to Bob', rm.turn === 1 && rm.wins.join() === '1,0,0' && rm.ho.shown && rm.ho.title === 'Bob breaks', JSON.stringify(rm));
  /* rotation ring: the points go to whoever potted them */
  await ev(() => { felt.party({ ruleset: 'rotation-ring', names: ['Ann', 'Bob', 'Cy'] }); hoGo.click(); });
  await setup([3, 15], [[15, 1.4, 0.75]]);
  a = await potAim(3, 0);
  await shoot(a, 0.32, -0.5);
  await setup([15], [[0, 0.3, 0.3], [15, 1.4, 0.75]]);
  await shoot(Math.PI, 0.1);
  await setup([15], [[15, 1.4, 0.75]]);
  a = await potAim(15, 5);
  await shoot(a, 0.32, -0.5);
  const s6 = await st();
  check('party: rotation ring: Ann pots the 3 (3 points), fouls, Bob pots the 15 (15 points) and wins with the table clear', s6.score && s6.score.join() === '3,15,0' && s6.winner === 1, JSON.stringify(s6));

  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
