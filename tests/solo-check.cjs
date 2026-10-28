/* solo-check: practice and trick shots. Node half (the sim region): practice racks and the
   scatter, the relaxed judging (no fouls, always your shot, potted balls stay down), undo
   determinism, free-table add and remove, the new result fields, every trick shot's layout on
   both tables, its goal passing on the known solution and failing on a deliberate miss, a
   bounded solver search that finds a solution for each on the 7 ft regulation table, and the
   stars. Browser half: the menu's Solo cards, practice on a phone by touch (undo, ball in hand,
   reset, free-table add and remove, the stats in the pause menu), the live practice roll equal
   to simulateShot, the trick list, a make and a miss with the result sheet, stars by attempts,
   Show me, and progress surviving a reload. The full offline search is tools/trick-solver.cjs. */
'use strict';
const { check, done, open, smallTargets, lowContrast } = require('./lib.cjs');
const { loadSim } = require('./sim.cjs');
const S = loadSim();
const R = S.BALL_R;
const segGap = (q, x, y) => { const ex = q[2] - q[0], ey = q[3] - q[1], t = Math.max(0, Math.min(1, ((x - q[0]) * ex + (y - q[1]) * ey) / (ex * ex + ey * ey))); return Math.hypot(q[0] + ex * t - x, q[1] + ey * t - y); };

/* one known solution per challenge, 7 ft regulation: [angle, power, side, vertical]. They are
   the solver's (tools/trick-solver.cjs) and must match TRICK_SOLS['7r'] in the page. */
const KNOWN = require('./trick-solutions.json')['7r'];

/* ---- practice ---- */
{
  const g8 = S.newPractice('8'), g9 = S.newPractice('9'), ge = S.newPractice('empty');
  check('practice racks: 8-ball 16 balls and 9-ball 10, from the kitchen; empty is the cue ball alone, ball in hand anywhere',
    g8.mode === 'practice' && g8.balls.length === 16 && g8.inHand === 'kitchen' && g9.balls.length === 10 && ge.balls.length === 1 && ge.inHand === 'table' && !ge.breakShot);
  const a = S.newPractice('scatter', 7), b = S.newPractice('scatter', 7), c = S.newPractice('scatter', 8);
  const legal = a.balls.every(x => S.canPlace({ inHand: 'table', balls: [] }, x.x, x.y) && a.balls.every(y => y === x || Math.hypot(x.x - y.x, x.y - y.y) >= 2 * R));
  check('free table: the scatter puts the cue ball and seven balls on legal, separate spots; same seed same layout, another seed another',
    a.balls.length === 1 + S.PRACTICE_SCATTER && legal && JSON.stringify(a.balls) === JSON.stringify(b.balls) && JSON.stringify(a.balls) !== JSON.stringify(c.balls));
  const m = S.newPractice('8');
  m.breakShot = false; m.inHand = null;
  check('practice: any ball may be hit first, the 8 too', JSON.stringify(S.legalTargets(m)) === JSON.stringify([...Array(15).keys()].map(i => i + 1)));
  const res = (g, o) => Object.assign({ balls: g.balls.map(x => Object.assign({}, x, { on: x.on && !(o.potted || []).includes(x.n) })), first: null, railAfter: false, potted: [], end: 'rest' }, o);
  const before = JSON.stringify(m);
  const s1 = S.practiceJudge(m, res(m, { first: 3, potted: [0, 8] }));
  const s2 = S.practiceJudge(m, res(m, { first: null }));
  check('practice: a scratch that also sinks the 8 is no foul and no loss: still your shot, ball in hand anywhere, the 8 stays down',
    !s1.verdict.foul && s1.turn === 0 && s1.winner === null && s1.inHand === 'table' && s1.verdict.scratch && !s1.balls.find(x => x.n === 8).on, JSON.stringify(s1.verdict));
  check('practice: no ball hit and no rail is no foul either; the cue ball stays where it is', !s2.verdict.foul && s2.turn === 0 && s2.inHand === null && s2.shots === 1);
  check('practiceJudge never touches the game it is given', JSON.stringify(m) === before);
  m.hand = true;
  check('practice: with the ball-in-hand toggle on every shot starts with ball in hand anywhere', S.practiceJudge(m, res(m, { first: 2 })).inHand === 'table');
  const cl = S.newPractice('empty');
  cl.balls.push(S.newBall(1, 1, 0.5));
  check('practice: clearing the table says so', S.practiceJudge(cl, res(cl, { first: 1, potted: [1] })).verdict.cleared === true);

  /* undo: the game before a shot, restored, plays the same shot to the same result */
  const u0 = S.newPractice('9'), shot = { angle: Math.atan2(S.FOOT[1] - u0.balls[0].y, S.FOOT[0] - u0.balls[0].x), power: 0.9, spin: { x: 0.2, y: -0.3 } };
  const snap = S.copyGame(u0), r1 = S.simulateShot(u0.balls, shot), u1 = S.practiceJudge(u0, r1);
  const r2 = S.simulateShot(snap.balls, shot);
  check('undo determinism: the snapshot before a shot equals the game, and the same shot from it gives the same result byte for byte',
    JSON.stringify(snap) === JSON.stringify(u0) && JSON.stringify(r1) === JSON.stringify(r2) && u1.shots === 1, '');

  /* free table editing */
  let e = S.newPractice('empty');
  const e1 = S.addBall(e, 1.2, 0.5), e2 = e1 && S.addBall(e1, 1.5, 0.3), e3 = e2 && S.removeBall(e2, 1), e4 = e3 && S.addBall(e3, 0.9, 0.7);
  check('free table: drops take the lowest free number (1, 2), a removed 1 is the next to come back',
    e1 && S.onTable(e1).join() === '1' && S.onTable(e2).join() === '1,2' && S.onTable(e3).join() === '2' && S.onTable(e4).join() === '1,2' && S.onTable(e).length === 0);
  check('free table: no drop on a ball, a cushion or a pocket mouth, no removing the cue ball',
    S.addBall(e2, 1.2 + R, 0.5) === null && S.addBall(e, 0.01, 0.5) === null && S.addBall(e, S.POCKET_AIM[1][0], S.POCKET_AIM[1][1] + 0.01) === null && S.removeBall(e2, 0) === null);
  e = S.newPractice('empty');
  for (let i = 0; i < 15; i++) e = S.addBall(e, 0.75 + (i % 5) * 0.2, 0.25 + Math.floor(i / 5) * 0.2) || e;
  check('free table: fifteen at most', S.onTable(e).length === 15 && S.addBall(e, 1.6, 0.8) === null);
}

/* ---- the new result fields ---- */
{
  const balls = [S.newBall(0, 0.5, 0.5), S.newBall(1, 1.0, 0.5), S.newBall(2, 1.0, 0.8)];
  const a = S.simulateShot(balls, { angle: 0, power: 0.5, spin: 0 }), b = S.simulateShot(balls, { angle: 0, power: 0.5, spin: 0 });
  check('result: contacts, rails, kick and pocketOf are deterministic (same shot, same JSON)', JSON.stringify(a) === JSON.stringify(b) && Array.isArray(a.contacts) && typeof a.rails === 'object' && 'pocketOf' in a);
  check('result: a straight hit records the cue ball and the 1 meeting, no kick, and the 1 reaching the rail', a.contacts[0].join() === '0,1' && a.kick === 0 && a.rails[1] >= 1 && !a.contacts.some(c => c.includes(2)), JSON.stringify({ c: a.contacts, r: a.rails, k: a.kick }));
  const k = S.simulateShot(balls, { angle: Math.PI, power: 0.5, spin: 0 });
  check('result: off the head rail first, kick counts the cushion before the first contact', k.kick === 1 || k.first === null, JSON.stringify({ k: k.kick, f: k.first, r: k.rails }));
}

/* ---- trick shots ---- */
{
  const ids = S.TRICKS.map(c => c.id);
  check(`trick shots: ${ids.length} challenges (at least 12), each with an id, a title and a one-line goal`, ids.length >= 12 && new Set(ids).size === ids.length && S.TRICKS.every(c => c.title && c.goal && !/\n/.test(c.goal)), ids.join(','));
  for (const size of ['7', '9']) {
    S.setTable(size);
    const bad = [];
    for (const c of S.TRICKS) {
      const b = S.trickBalls(c);
      for (const x of b) {
        /* on the bed and clear of every cushion surface; a ball may hang in a mouth */
        if (!(x.x > R && x.x < S.TL - R && x.y > R && x.y < S.TW - R) || S.CUSH.some(q => segGap(q, x.x, x.y) < R)) bad.push(`${c.id}:${x.n} off`);
        for (const y of b) if (y.n < x.n && Math.hypot(x.x - y.x, x.y - y.y) < 2 * R) bad.push(`${c.id}:${x.n}/${y.n}`);
      }
      if (b[0].n !== 0) bad.push(`${c.id}: cue first`);
    }
    check(`trick shots, ${size} ft: every layout fits (balls on the cloth, clear of every cushion and jaw, none overlapping)`, !bad.length, bad.join(' '));
  }
  S.setTable('7'); S.setPockets('regulation');
  check('trick shots: a known solution recorded for every challenge, and the page holds the same ones', S.TRICKS.every(c => KNOWN[c.id] && JSON.stringify(S.TRICK_SOLS[c.id]['7r']) === JSON.stringify(KNOWN[c.id])));
  const shotOf = s => ({ angle: s[0], power: s[1], spin: { x: s[2], y: s[3] } });
  for (const c of S.TRICKS) {
    const b = S.trickBalls(c), s = KNOWN[c.id];
    const hit = S.trickJudge(c, S.simulateShot(b, shotOf(s)));
    const miss = S.trickJudge(c, S.simulateShot(b, { angle: s[0] + Math.PI, power: 0.12, spin: 0 }));
    check(`trick "${c.title}": the goal passes on its solution and fails on a deliberate miss`, hit.ok && !miss.ok && miss.why.length > 0, JSON.stringify({ hit, miss }));
  }
  /* the solver: a bounded search round each recorded solution (angle +-0.3 deg, power +-0.04)
     finds at least one make, as the full search in tools/trick-solver.cjs did */
  const D = Math.PI / 180, found = [];
  for (const c of S.TRICKS) {
    const b = S.trickBalls(c), s = KNOWN[c.id];
    let n = 0;
    for (let k = -3; k <= 3; k++) for (const dp of [-0.04, 0, 0.04]) if (S.trickJudge(c, S.simulateShot(b, shotOf([s[0] + k * 0.1 * D, Math.min(1, s[1] + dp), s[2], s[3]]))).ok) n++;
    found.push(`${c.id}:${n}`);
  }
  check('solver: a search with simulateShot finds a solution for every challenge on the 7 ft regulation table', found.every(f => +f.split(':')[1] > 0), found.join(' '));
  /* the other table settings' stored solutions (Show me) pass too */
  const other = [];
  for (const cfg of ['9r', '7g', '9g']) {
    S.setTable(cfg[0]); S.setPockets(cfg[1] === 'g' ? 'generous' : 'regulation');
    for (const c of S.TRICKS) {
      const s = (S.TRICK_SOLS[c.id] || {})[cfg];
      if (s && !S.trickJudge(c, S.simulateShot(S.trickBalls(c), shotOf(s))).ok) other.push(`${cfg}:${c.id}`);
    }
  }
  S.setTable('7'); S.setPockets('regulation');
  check('Show me: every stored solution for the 9 ft and generous tables makes its shot', !other.length, other.join(' '));
  const sc = S.trickGame(S.TRICKS[0]);
  check('a trick game: the layout, no ball in hand, any ball first', sc.mode === 'trick' && sc.inHand === null && !sc.breakShot && S.legalTargets(sc).length === sc.balls.length - 1);
  check('stars: 3 on the first try, 2 on the second or third, 1 after that', [1, 2, 3, 4, 9].map(S.trickStars).join() === '3,2,2,1,1');
  const sz = S.trickById('stun'), b = S.trickBalls(sz), j = S.trickJudge(sz, S.simulateShot(b, { angle: Math.atan2(b[1].y - b[0].y, b[1].x - b[0].x), power: 0.9, spin: { x: 0, y: 1 } }));
  check('trick goals say why they failed (a follow shot misses the stop ring, or scratches)', !j.ok && /ring|Scratch/.test(j.why), j.why);
}

(async () => {
  /* ---- the page, on a phone, by touch ---- */
  const { browser, page, errors } = await open('', { viewport: { width: 440, height: 956 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2,
    init: () => { try { localStorage.removeItem('felt.tricks'); } catch (e) { } } });
  await page.evaluate(() => { felt.speed = 40; });
  const sz = await page.evaluate(() => [pracBtn, trickBtn, dailyBtn, play8].map(b => { const r = b.getBoundingClientRect(); return [r.top, r.height]; }));
  check('menu: the games, then the solo list under them (Practice, Trick shots, Daily shot, one row each), every row 44 px or more',
    sz[0][0] > sz[3][0] + sz[3][1] && sz[0][0] < sz[1][0] && sz[1][0] < sz[2][0] && sz.every(s => s[1] >= 44), JSON.stringify(sz));
  await page.tap('#pracBtn');
  const pick = await page.evaluate(() => ({ shown: prac.classList.contains('show'), ids: [...prac.querySelectorAll('.pick .game')].map(b => b.id).join() }));
  check('Practice opens its picker: the drills, 8-ball rack, 9-ball rack, free table, empty table', pick.shown && pick.ids === 'drillBtn,prac8,prac9,pracScatter,pracEmpty', JSON.stringify(pick));
  check('practice picker: targets 44 px, text 4.5:1', (await smallTargets(page)).length === 0 && (await lowContrast(page)).length === 0, JSON.stringify([await smallTargets(page), await lowContrast(page)]));
  await page.tap('#prac9');
  await page.waitForTimeout(150);
  const p0 = await page.evaluate(() => ({ s: felt.state, mode: felt.game.mode, n: felt.game.balls.length, chip: getComputedStyle(turnChip).display, ctl: getComputedStyle(soloCtl).display, hand: felt.game.inHand }));
  check('practice starts: 9-ball rack, ball in hand in the kitchen, undo and tools in the strip instead of the turn chip', p0.s === 'aim' && p0.mode === 'practice' && p0.n === 10 && p0.chip === 'none' && p0.ctl !== 'none' && p0.hand === 'kitchen', JSON.stringify(p0));
  check('practice strip: targets 44 px, text 4.5:1', (await smallTargets(page)).length === 0 && (await lowContrast(page)).length === 0, JSON.stringify([await smallTargets(page), await lowContrast(page)]));

  /* the live roll equals simulateShot, and undo then the same shot gives the same result */
  const shoot = (a, p, s) => page.evaluate(([a, p, s]) => felt.shoot(a, p, s), [a, p, s]);
  const idle = () => page.waitForFunction(() => felt.state === 'aim' || felt.state === 'over', null, { timeout: 30000 });
  const brk = await page.evaluate(() => { const c = felt.game.balls[0]; return Math.atan2(FOOT[1] - c.y, FOOT[0] - c.x); });
  const want = await page.evaluate(a => JSON.stringify(simulateShot(felt.game.balls, { angle: a, power: 0.9, spin: { x: 0.1, y: -0.2 } })), brk);
  const pre = await page.evaluate(() => JSON.stringify(felt.game.balls));
  await shoot(brk, 0.9, { x: 0.1, y: -0.2 }); await idle();
  const live = await page.evaluate(() => JSON.stringify(felt.lastResult));
  check('practice: the live break equals simulateShot byte for byte (result fields included)', live === want);
  const after = await page.evaluate(() => ({ s: felt.state, turn: felt.game.turn, shots: felt.solo.st.shots, undo: felt.solo.undo.length }));
  check('practice: after the shot it is your shot again, counted, with one undo', after.s === 'aim' && after.turn === 0 && after.shots === 1 && after.undo === 1, JSON.stringify(after));
  await page.tap('#undoBtn');
  await page.waitForTimeout(100);
  const und = await page.evaluate(() => ({ b: JSON.stringify(felt.game.balls), s: felt.state, hand: felt.game.inHand, shots: felt.game.shots }));
  check('undo (tap): the layout before the shot is back, cue ball and ball in hand included', und.b === pre && und.s === 'aim' && und.hand === 'kitchen' && und.shots === 0, JSON.stringify(und).slice(0, 200));
  await shoot(brk, 0.9, { x: 0.1, y: -0.2 }); await idle();
  check('undo, then the same shot: the same result byte for byte', (await page.evaluate(() => JSON.stringify(felt.lastResult))) === live);

  /* ball in hand from the tools panel: the cue ball moves anywhere, past the head string too */
  await page.tap('#toolBtn');
  const tl = await page.evaluate(() => ({ shown: !tools.hidden, exp: toolBtn.getAttribute('aria-expanded') }));
  check('tools: the panel opens from the strip', tl.shown && tl.exp === 'true', JSON.stringify(tl));
  check('tools panel: targets 44 px, text 4.5:1', (await smallTargets(page)).length === 0 && (await lowContrast(page)).length === 0, JSON.stringify([await smallTargets(page), await lowContrast(page)]));
  await page.tap('#handBtn');
  const free = await page.evaluate(() => { for (const [x, y] of [[TL * 0.6, TW * 0.2], [TL * 0.4, TW * 0.8], [TL * 0.55, TW * 0.5]]) if (canPlace(felt.game, x, y)) return [x, y]; return null; });
  const c0 = await page.evaluate(() => { const c = felt.game.balls[0]; return felt.toScreen(c.x, c.y); }), to = await page.evaluate(p => felt.toScreen(p[0], p[1]), free);
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', c0[0], c0[1]);
  for (let i = 1; i <= 10; i++) await touch('touchMove', c0[0] + (to[0] - c0[0]) * i / 10, c0[1] + (to[1] - c0[1]) * i / 10);
  await touch('touchEnd');
  await page.waitForTimeout(100);
  const bh = await page.evaluate(() => ({ hand: felt.game.inHand, on: felt.game.hand, pressed: handBtn.getAttribute('aria-pressed'), c: [felt.game.balls[0].x, felt.game.balls[0].y], hx: HEAD_X, s: felt.state, shots: felt.game.shots }));
  check('ball in hand (touch): the toggle gives ball in hand anywhere and a drag takes the cue ball past the head string; nothing shoots',
    bh.hand === 'table' && bh.on && bh.pressed === 'true' && Math.hypot(bh.c[0] - free[0], bh.c[1] - free[1]) < 0.01 && bh.c[0] > bh.hx && bh.s === 'aim' && bh.shots === 1, JSON.stringify(bh));
  await shoot(0.4, 0.3, 0); await idle();
  check('ball in hand stays on for the next shot while the toggle is on', await page.evaluate(() => felt.game.inHand === 'table'));

  /* reset rack, then the stats in the pause menu */
  await page.tap('#toolBtn'); await page.tap('#resetBtn');
  await page.waitForTimeout(100);
  const rs = await page.evaluate(() => ({ eq: JSON.stringify(felt.game.balls.slice(1)) === JSON.stringify(newPractice('9', 1).balls.slice(1)), shots: felt.game.shots, undo: felt.solo.undo.length, st: felt.solo.st.shots, hand: felt.game.inHand }));
  check('reset rack (touch): the 9-ball rack is back, the session keeps its count, undo can bring the old layout back', rs.eq && rs.shots === 0 && rs.st === 3 && rs.undo === 3 && rs.hand === 'table', JSON.stringify(rs));
  await page.tap('#menuBtn');
  await page.waitForTimeout(100);
  const pm = await page.evaluate(() => ({ stats: soloStats.textContent, kind: soloKind.textContent, title: soloTitle.textContent, newgame: getComputedStyle(document.querySelector('#menu .newgame')).display, btns: [resumeBtn, restartBtn, exitBtn].map(b => getComputedStyle(b).display), cards: getComputedStyle(gameNow).display }));
  check('pause in practice: the session (shots, pots, pot %), Resume, Restart and Exit; no player cards, no new-game part',
    /Shots3/.test(pm.stats) && /Pots\d+/.test(pm.stats) && /Pot %\d+%/.test(pm.stats) && pm.kind === 'Practice' && pm.title === '9-ball rack' && pm.newgame === 'none' && pm.btns.every(d => d !== 'none') && pm.cards === 'none', JSON.stringify(pm));
  check('pause in practice: targets 44 px, text 4.5:1', (await smallTargets(page)).length === 0 && (await lowContrast(page)).length === 0, JSON.stringify([await smallTargets(page), await lowContrast(page)]));
  await page.tap('#exitBtn');
  check('Exit to menu: the full menu, no session', await page.evaluate(() => felt.state === 'menu' && felt.solo === null && getComputedStyle(document.querySelector('#menu .newgame')).display !== 'none'));

  /* solo is pool only: from a bumper pool game, practice and trick shots go back to the pool table */
  const fromB = await page.evaluate(() => { felt.start('bumper'); const was = felt.table; felt.practice('8', 1); const p = { was, table: felt.table, kind: felt.game.kind, cue: felt.game.balls[0].n }; felt.start('bumper'); felt.trick('long'); p.trick = felt.table; p.n = felt.game.balls.length; felt.exitSolo(); return p; });
  check('solo is pool only: from bumper pool, practice and a trick shot are back on the pool table', fromB.was === 'bumper' && fromB.table === '7' && fromB.kind === '8' && fromB.cue === 0 && fromB.trick === '7' && fromB.n === 2, JSON.stringify(fromB));
  /* empty table: taps drop balls, a tap on one takes it off; Done editing gives the taps back to aiming */
  await page.tap('#pracBtn'); await page.tap('#pracEmpty');
  await page.waitForTimeout(100);
  const tapAt = async (fx, fy) => { const s = await page.evaluate(([x, y]) => felt.toScreen(x * TL, y * TW), [fx, fy]); await page.touchscreen.tap(s[0], s[1]); await page.waitForTimeout(60); };
  await tapAt(0.6, 0.3); await tapAt(0.7, 0.6); await tapAt(0.8, 0.4);
  const ed1 = await page.evaluate(() => onTable(felt.game).join());
  await tapAt(0.7, 0.6);
  const ed2 = await page.evaluate(() => onTable(felt.game).join());
  await tapAt(0.5, 0.8);
  const ed3 = await page.evaluate(() => onTable(felt.game).join());
  check('free table (touch): three taps drop the 1, 2 and 3; a tap on the 2 takes it off; the next tap drops the 2 again', ed1 === '1,2,3' && ed2 === '1,3' && ed3 === '1,2,3', [ed1, ed2, ed3].join(' | '));
  await page.tap('#undoBtn');
  check('free table: undo takes back an edit', (await page.evaluate(() => onTable(felt.game).join())) === '1,3');
  await page.tap('#editDone');
  const aim0 = await page.evaluate(() => felt.aim);
  await tapAt(0.9, 0.9);
  const ed4 = await page.evaluate(() => ({ on: onTable(felt.game).join(), aim: felt.aim, edit: felt.solo.edit, done: getComputedStyle(editDone).display }));
  check('free table: after Done editing a tap aims again and adds nothing', ed4.on === '1,3' && ed4.aim !== aim0 && !ed4.edit && ed4.done === 'none', JSON.stringify(ed4));
  await page.tap('#menuBtn'); await page.tap('#exitBtn');

  /* trick shots: the list, a make, a miss, stars and progress */
  await page.tap('#trickBtn');
  const tg = await page.evaluate(() => ({ n: trickGrid.querySelectorAll('.tcard').length, shown: tricks.classList.contains('show') }));
  check('Trick shots opens the list: a card per challenge with its stars', tg.shown && tg.n === S.TRICKS.length, JSON.stringify(tg));
  check('trick list: targets 44 px, text 4.5:1', (await smallTargets(page)).length === 0 && (await lowContrast(page)).length === 0, JSON.stringify([await smallTargets(page), await lowContrast(page)]));
  await page.tap('.tcard[data-id="long"]');
  await page.waitForTimeout(100);
  const t0 = await page.evaluate(() => ({ mode: felt.game.mode, id: felt.game.trick, chip: turnChip.dataset.name, s: felt.state, hand: felt.game.inHand, p2: pchip1.getClientRects().length }));
  check('a challenge starts on its layout: no ball in hand, the chip says Try 1, no second player chip on screen', t0.mode === 'trick' && t0.id === 'long' && t0.chip === 'Try 1' && t0.s === 'aim' && !t0.hand && t0.p2 === 0, JSON.stringify(t0));
  const sol = s => page.evaluate(id => TRICK_SOLS[id]['7r'], s);
  const L = await sol('long');
  await shoot(L[0], L[1], { x: L[2], y: L[3] }); await idle();
  const m1 = await page.evaluate(() => ({ t: felt.lastTrick, shown: trickRes.classList.contains('show'), head: trickHead.textContent, stars: trickStarsNow.getAttribute('aria-label'), ls: localStorage.getItem('felt.tricks') }));
  check('a make on the first try: Made it, 3 stars, saved', m1.t.ok && m1.t.stars === 3 && m1.shown && m1.head === 'Made it' && m1.stars === '3 of 3 stars' && JSON.parse(m1.ls).long === 3, JSON.stringify(m1));
  check('result sheet: targets 44 px, text 4.5:1', (await smallTargets(page)).length === 0 && (await lowContrast(page)).length === 0, JSON.stringify([await smallTargets(page), await lowContrast(page)]));
  await page.tap('#trickRetry');
  await shoot(L[0] + Math.PI, 0.12, 0); await idle();
  const m2 = await page.evaluate(() => ({ t: felt.lastTrick, head: trickHead.textContent, why: trickWhy.textContent, best: felt.trickBest.long }));
  check('Retry, then a miss: Not quite, why, try 2; the best stays 3', !m2.t.ok && m2.t.attempts === 2 && m2.head === 'Not quite' && /stayed up|wrong/.test(m2.why) && m2.best === 3, JSON.stringify(m2));
  /* stars by attempts: the stop shot made on the third try earns 2 */
  await page.tap('#trickNext');
  const st = await page.evaluate(() => felt.game.trick);
  const SS = await sol(st);
  for (let i = 0; i < 2; i++) { await shoot(SS[0] + Math.PI, 0.12, 0); await idle(); await page.tap('#trickRetry'); }
  await shoot(SS[0], SS[1], { x: SS[2], y: SS[3] }); await idle();
  const m3 = await page.evaluate(() => felt.lastTrick);
  check('Next goes to the next challenge; a make on the third try earns 2 stars', st === 'stun' && m3.ok && m3.attempts === 3 && m3.stars === 2, JSON.stringify(m3));
  await page.tap('#trickShow'); await idle();
  const m4 = await page.evaluate(() => ({ t: felt.lastTrick, head: trickHead.textContent, best: felt.trickBest.stun }));
  check('Show me plays the stored solution: it makes the shot, is not an attempt and leaves the stars alone', m4.t.ok && m4.t.demo && m4.t.attempts === 3 && m4.best === 2 && m4.head === 'Like that', JSON.stringify(m4));
  /* the pause menu in a challenge: its goal and tries */
  await page.tap('#trickRetry');
  await page.tap('#menuBtn');
  const tp = await page.evaluate(() => ({ title: soloTitle.textContent, goal: soloGoal.textContent, stats: soloStats.textContent }));
  check('pause in a challenge: its title, goal and tries', tp.title === 'Stop shot' && /stop the cue ball/.test(tp.goal) && /Tries3/.test(tp.stats), JSON.stringify(tp));
  await page.tap('#restartBtn');
  check('Restart keeps the challenge and its tries', await page.evaluate(() => felt.state === 'aim' && felt.game.trick === 'stun' && felt.solo.attempts === 3));

  /* landscape: the strip column and the result sheet still fit */
  await page.setViewportSize({ width: 956, height: 440 });
  await page.waitForTimeout(300);
  await shoot(SS[0] + Math.PI, 0.12, 0); await idle();
  check('landscape 956x440: result sheet targets 44 px, text 4.5:1, no sideways scroll', (await smallTargets(page)).length === 0 && (await lowContrast(page)).length === 0
    && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), JSON.stringify([await smallTargets(page), await lowContrast(page)]));
  /* a narrow phone: the practice strip (undo and tools beside the meter) stays on the screen */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => felt.practice('8', 1));
  await page.waitForTimeout(300);
  const strip = await page.evaluate(() => [...ctl.querySelectorAll('button, [role="slider"]')].filter(b => b.getClientRects().length).map(b => { const r = b.getBoundingClientRect(); return [b.id, Math.round(r.left), Math.round(r.right), Math.round(Math.min(r.width, r.height))]; }));
  check('390 px phone: every control of the practice strip is on the screen and 44 px or more', strip.length >= 6 && strip.every(([, l, r, m]) => l >= 0 && r <= 390 && m >= 44), JSON.stringify(strip));
  check('no console errors', errors.length === 0, errors.join(' | '));
  await browser.close();

  /* progress survives a reload */
  const b2 = await open('', { viewport: { width: 440, height: 956 }, hasTouch: true, isMobile: true });
  await b2.page.evaluate(() => { localStorage.setItem('felt.tricks', JSON.stringify({ long: 3, stun: 2, bogus: 3, kick: 7 })); });
  await b2.page.reload();
  await b2.page.waitForFunction(() => window.booted === true);
  const pr = await b2.page.evaluate(() => ({ best: felt.trickBest, sum: trickSum.textContent }));
  await b2.page.tap('#trickBtn');
  const card = await b2.page.evaluate(() => document.querySelector('.tcard[data-id="long"] .stars').getAttribute('aria-label'));
  check('progress persists across a reload (unknown ids and bad values dropped); the menu and the list show it',
    JSON.stringify(pr.best) === JSON.stringify({ long: 3, stun: 2 }) && pr.sum === `5 of ${S.TRICKS.length * 3}` && card === '3 of 3 stars', JSON.stringify({ pr, card }));
  check('no console errors after the reload', b2.errors.length === 0, b2.errors.join(' | '));
  await b2.browser.close();

  /* the daily shot: one trick shot a day, picked by the date (felt.today stands in for the
     clock), the same for every player that day. The first try of a day is scored: a day after
     the last one grows the streak, a missed day starts it again; retries are practice. */
  const b3 = await open('', { viewport: { width: 440, height: 956 }, hasTouch: true, isMobile: true });
  const dp = b3.page;
  const dpick = await dp.evaluate(() => {
    const days = [...Array(14).keys()].map(i => `2026-11-${String(i + 1).padStart(2, '0')}`);
    return { ids: days.map(d => felt.dailyTrick(d)), again: felt.dailyTrick('2026-11-03'), leap: [felt.dailyTrick('2026-12-31'), felt.dailyTrick('2027-01-01')] };
  });
  check('daily shot: the same date always gives the same shot; fourteen days in a row give all fourteen, never the same two days running',
    dpick.again === dpick.ids[2] && new Set(dpick.ids).size === S.TRICKS.length && dpick.ids.every((id, i) => !i || id !== dpick.ids[i - 1]) && dpick.leap[0] !== dpick.leap[1], JSON.stringify(dpick));
  await dp.evaluate(() => { felt.speed = 40; felt.today = '2026-10-25'; syncMenu(); });
  const tile0 = await dp.evaluate(() => ({ sum: dailySum.textContent, ball: dailyBall.textContent, name: dailyName.textContent, st: dailyBtn.dataset.daily }));
  const dIdle = () => dp.waitForFunction(() => felt.state === 'over', null, { timeout: 30000 });
  const solve = () => dp.evaluate(() => { const s = TRICK_SOLS[felt.solo.id]['7r']; felt.shoot(s[0], s[1], { x: s[2], y: s[3] }); });
  const miss = () => dp.evaluate(() => { const s = TRICK_SOLS[felt.solo.id]['7r']; felt.shoot(s[0] + Math.PI, 0.12, 0); });
  await dp.tap('#dailyBtn');
  await dp.waitForTimeout(100);
  const d0 = await dp.evaluate(() => ({ id: felt.game.trick, want: felt.dailyTrick('2026-10-25'), day: felt.solo.daily.day, mode: felt.game.mode }));
  const want25 = await dp.evaluate(() => dailyTrick('2026-10-25').title);
  check('daily shot: the row shows the day of the month on its calendar leaf and the day\'s shot by name, no streak yet; it starts that trick shot',
    tile0.ball === '25' && tile0.sum === '' && tile0.st === 'new' && tile0.name === want25 && d0.id === d0.want && d0.day === '2026-10-25' && d0.mode === 'trick', JSON.stringify({ tile0, d0, want25 }));
  await solve(); await dIdle();
  const d1 = await dp.evaluate(() => ({ t: felt.lastTrick, rec: felt.dailyRec, kind: trickKind.textContent, why: trickWhy.textContent, next: trickNext.textContent, ls: JSON.parse(localStorage.getItem('felt.daily.v1')) }));
  check('daily shot: the first try is scored (streak 1, stored) and the result says so; its sheet goes Home',
    d1.t.ok && d1.t.daily.counted && d1.rec.streak === 1 && d1.rec.last === '2026-10-25' && d1.rec.made && d1.ls.streak === 1 && /^Daily shot, 25 Oct/.test(d1.kind) && /Day streak: 1/.test(d1.why) && d1.next === 'Home', JSON.stringify(d1));
  check('daily result: targets 44 px, text 4.5:1', (await smallTargets(dp)).length === 0 && (await lowContrast(dp)).length === 0, JSON.stringify([await smallTargets(dp), await lowContrast(dp)]));
  await dp.tap('#trickRetry');
  await miss(); await dIdle();
  const d2 = await dp.evaluate(() => ({ t: felt.lastTrick, rec: felt.dailyRec, why: trickWhy.textContent }));
  check('daily shot: a retry the same day is practice: the streak stays 1', !d2.t.ok && !d2.t.daily.counted && d2.rec.streak === 1 && d2.rec.made && /Practice/.test(d2.why), JSON.stringify(d2));
  await dp.tap('#trickNext');
  const d3 = await dp.evaluate(() => ({ s: felt.state, solo: felt.solo, home: menu.classList.contains('show') && !document.querySelector('#menu[data-paused]'), sum: dailySum.textContent, st: dailyBtn.dataset.daily, tick: getComputedStyle(dailyBtn.querySelector('.tick')).display, label: dailyBtn.getAttribute('aria-label') }));
  check('Home from the daily result: the home screen, the row says Done today with a tick (the streak in its label)', d3.s === 'menu' && d3.solo === null && d3.home && d3.sum === 'Done today' && d3.st === 'done' && d3.tick !== 'none' && /day streak 1/.test(d3.label), JSON.stringify(d3));
  await dp.tap('#dailyBtn');
  await solve(); await dIdle();
  const d4 = await dp.evaluate(() => ({ t: felt.lastTrick, rec: felt.dailyRec }));
  check('daily shot: played again the same day from home, still practice', !d4.t.daily.counted && d4.rec.streak === 1, JSON.stringify(d4));
  /* the next day: the streak grows, even on a miss */
  await dp.evaluate(() => { felt.today = '2026-10-26'; quitToHome(); });
  const tile1 = await dp.evaluate(() => dailySum.textContent + '/' + dailyBtn.dataset.daily + '/' + getComputedStyle(dailyBtn.querySelector('.flame')).display);
  await dp.tap('#dailyBtn');
  const id26 = await dp.evaluate(() => felt.game.trick);
  await miss(); await dIdle();
  const d5 = await dp.evaluate(() => ({ t: felt.lastTrick, rec: felt.dailyRec }));
  check('the next day: a new shot, and its first try (a miss) grows the streak to 2', tile1 === '1/streak/block' && id26 !== d0.id && d5.t.daily.counted && d5.rec.streak === 2 && d5.rec.best === 2 && !d5.rec.made, JSON.stringify({ tile1, d5 }));
  /* a missed day: the streak has lapsed, and the next scored try starts it at 1 */
  await dp.evaluate(() => { felt.today = '2026-10-28'; quitToHome(); });
  const tile2 = await dp.evaluate(() => ({ sum: dailySum.textContent, st: dailyBtn.dataset.daily, now: felt.dailyRec.streakNow }));
  await dp.tap('#dailyBtn');
  await solve(); await dIdle();
  const d6 = await dp.evaluate(() => felt.dailyRec);
  check('after a missed day the streak has lapsed (the tile says so) and the next try starts it again at 1; the best stays 2',
    tile2.sum === '' && tile2.st === 'new' && tile2.now === 0 && d6.streak === 1 && d6.best === 2 && d6.last === '2026-10-28', JSON.stringify({ tile2, d6 }));
  await dp.evaluate(() => { localStorage.setItem('felt.daily.v1', '{bad json'); localStorage.setItem('felt.record.v1', '{"v":1,"kinds":{"8":{"played":-3,"cpu":{"easy":{"w":"x"}}}},"streak":2.5}'); });
  await dp.reload();
  await dp.waitForFunction(() => window.booted === true);
  check('daily record: unreadable storage starts from nothing, no errors', await dp.evaluate(() => felt.dailyRec.streak === 0 && felt.dailyRec.last === null), '');
  const rb = await dp.evaluate(() => felt.record);
  check('game record: bad values in storage read as zero', rb.kinds['8'].played === 0 && rb.kinds['8'].cpu.easy.w === 0 && rb.streak === 0 && rb.kinds.bumper.two === 0, JSON.stringify(rb));
  check('daily: no console errors', b3.errors.length === 0, b3.errors.join(' | '));
  await b3.browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
