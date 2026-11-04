/* heyball-check: Chinese 8-ball (heyball; sim 1e and 1o, the page's ninth game). Node: the
   ruleset and its module (judge8, shared with 8-ball: no rule copied), the table (the 2540 x 1270
   mm bed, pool's 57.15 mm ball and cloth, the head string at 635 mm, snooker's mouths with rounded
   jaws and an 85 / 90 mm throat), the pockets against pool's and snooker's (tighter than both for
   the ball), the rack, each rule of the World Chinese 8-Ball Masters rules (Rev. 2017) the engine
   plays, a fuzz, and the CPU playing whole racks at each level. Page: the home's ninth card by a
   real tap (on the first screen), its setup and rules popover, Break, the live roll equal to
   simulateShot byte for byte, the potted-ball windows and the rail's seats, the 3D view, the tutorial
   played through Show me, the How to play page, landscape, and no console errors. */
'use strict';
const { check, done, open, settled, smallTargets, lowContrast } = require('./lib.cjs');
const { loadSim } = require('./sim.cjs');
const S = loadSim();
const P = v => S.powerFor(v), DEG = Math.PI / 180;
const ball = (g, n) => g.balls.find(b => b.n === n);
/* a hand-made result for judge (rules2-check's): the first ball hit, what went down (pocket 0
   unless given), a rail after contact, the break's cushion count when given */
function res(g, { first = null, rail = true, potted = [], pocketOf = {}, rails, crossed } = {}) {
  const balls = g.balls.map(b => Object.assign({}, b, { vx: 0, vy: 0, on: b.on && !potted.includes(b.n) }));
  const po = {};
  for (const n of potted) po[n] = pocketOf[n] !== undefined ? pocketOf[n] : 0;
  return Object.assign({ balls, first, railAfter: rail, potted, pocketOf: po, kick: null, end: 'rest' }, rails ? { rails } : {}, crossed === undefined ? {} : { crossed });
}
/* a rack past the break with only the listed object balls on the table */
function midGame(left, over = {}) {
  const g = S.newGame('heyball');
  g.breakShot = false; g.inHand = null;
  for (const b of g.balls) if (b.n > 0 && !left.includes(b.n)) b.on = false;
  return Object.assign(g, over);
}
const play = t => { const k = {}; while (S.stepTable(t)) { for (const h of t.hits) k[h[0]] = 1; t.hits.length = 0; } return k; };
const rails4 = { 1: 1, 2: 1, 3: 1, 4: 1, 0: 1 }, rails3 = { 1: 1, 2: 1, 3: 1, 0: 1 };

/* ---------- 1. the ruleset and the module ---------- */
{
  const R = S.RULESETS.heyball;
  check('the ruleset: registered as Chinese 8-ball with its source (World Chinese 8-Ball Masters rules, Rev. 2017), the default for the kind, a pocket game',
    !!R && R.game === 'heyball' && /World Chinese 8-Ball Masters/.test(R.source) && /2017/.test(R.source) && S.DEFAULT_RULESET.heyball === 'heyball' && S.POCKET_KINDS.includes('heyball')
    && S.rulesetsFor('heyball').map(r => r.id).join() === 'heyball' && !S.ringRulesets().some(r => r.game === 'heyball'), JSON.stringify(R));
  check('one 8-ball module: Chinese 8-ball is judged by 8-ball\'s own judge (RULE_MODULES), the 8 its game ball, the same groups',
    S.RULE_MODULES.heyball.judge === S.RULE_MODULES[8].judge && S.gameBallOf({ kind: 'heyball' }) === 8 && S.is8('heyball') && S.is8('8') && !S.is8('9'));
  check('its options as the Masters rules read: four balls to the cushions or a pot on the break, the 8 on the break spotted or re-broken, ball in hand anywhere (behind the head string after a break scratch), the 8 called, no three-foul rule',
    R.breakRails === 4 && R.gameBallBreak === 'option' && R.foulHand === 'table' && R.breakScratch === 'kitchen' && R.calls === 'game' && R.threeFoul === false && R.breakAny === true && R.badBreak === 'rerack' && R.offSpot === 'stay');
}

/* ---------- 2. the table ---------- */
S.setTable('heyball');
{
  check('the table: 2540 x 1270 mm between the noses, 57.15 mm balls on pool\'s cloth (POOL_PHYS), the head string 635 mm from the head cushion, the foot spot a quarter from the foot',
    S.TABLE === 'heyball' && S.TL === 2.54 && S.TW === 1.27 && S.BALL_R === 0.028575 && S.physOf('heyball') === S.POOL_PHYS && Math.abs(S.HEAD_X - 0.635) < 1e-12 && Math.abs(S.FOOT[0] - 1.905) < 1e-12,
    JSON.stringify([S.TL, S.TW, S.BALL_R, S.HEAD_X, S.FOOT]));
  const mm = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) * 1000;
  const jawPts = S.MOUTHS.map(m => mm(m[0].p, m[1].p)), throat = S.MOUTHS.map(m => mm(m[0].e, m[1].e));
  check('the pockets: snooker\'s mouths, 90 mm (corners) and 104 mm (middles) between the jaw points; the throat where the facings meet the rail 85 and 90 mm (Joy\'s listed openings), every one of the six',
    [0, 2, 3, 5].every(k => Math.abs(jawPts[k] - 90) < 0.01 && Math.abs(throat[k] - 85) < 0.5) && [1, 4].every(k => Math.abs(jawPts[k] - 104) < 0.01 && Math.abs(throat[k] - 90) < 0.5),
    JSON.stringify({ jawPts: jawPts.map(v => +v.toFixed(1)), throat: throat.map(v => +v.toFixed(1)) }));
  check('rounded jaws as snooker\'s: twelve, 30 mm at the corners and 22 mm at the middles; the noses and facings end where they meet',
    S.JAW_ARCS.length === 12 && S.JAW_RAD[0] === 0.03 && S.JAW_RAD[1] === 0.022 && S.CUSH.length === 18 && S.POCKETS.length === 6, JSON.stringify(S.JAW_RAD));
  /* the band of lines that drop, in ball widths, soft, medium and firm, from 0.6 m (snooker-check's measure) */
  const roll = (k, a, off, v) => {
    const m = S.POCKET_AIM[k], ux = Math.cos(a), uy = Math.sin(a), t = S.strike(S.newTable([S.newBall(0, m[0] - ux * 0.6 - uy * off, m[1] - uy * 0.6 + ux * off)]), a, P(v), 0), kinds = play(t);
    return { pot: !t.balls[0].on, jaw: !!kinds.jaw };
  };
  const LINES = { 'corner straight': [0, Math.atan2(-1, -1)], 'middle straight': [1, -Math.PI / 2], 'middle 30 deg': [1, -Math.PI / 2 + 30 * DEG], 'corner 15 deg off the rail': [0, Math.PI + 15 * DEG] };
  const windows = () => {
    const out = {};
    for (const [name, [k, a]] of Object.entries(LINES)) {
      let n = 0;
      for (const v of [0.8, 1.6, 3]) for (let o = -60; o <= 60; o += 2) if (roll(k, a, o / 1000, v).pot) n++;
      out[name] = +(n * 0.002 / 3 / (2 * S.BALL_R)).toFixed(2);
    }
    return out;
  };
  const straight = [0, 2, 3, 5].every(k => roll(k, Math.atan2(k < 3 ? -1 : 1, k === 0 || k === 3 ? -1 : 1), 0, 1.6).pot) && [1, 4].every(k => roll(k, k === 1 ? -Math.PI / 2 : Math.PI / 2, 0, 1.6).pot);
  const firm = roll(0, LINES['corner straight'][1], 0, 3.5).pot && roll(1, -Math.PI / 2, 0, 3.5).pot;
  check('a straight pot at medium pace drops in all six pockets, and a firm one in a corner and a middle', straight && firm);
  const half = roll(0, LINES['corner straight'][1], S.BALL_R, 1.6);
  check('a line half a ball wide of the corner\'s middle meets the rounded jaw and stays out (pool\'s 9 ft regulation corner takes it)', !half.pot && half.jaw, JSON.stringify(half));
  const hey = windows();
  S.setTable('9'); S.setPockets('regulation');
  const pool = windows(), poolHalf = roll(0, LINES['corner straight'][1], S.BALL_R, 1.6);
  S.setTable('snooker', 'full');
  const snk = windows();
  S.setTable('heyball');
  const looser = Object.keys(hey).filter(k => !(hey[k] < pool[k] && hey[k] < snk[k]));
  check('the pockets are the game: every acceptance window (in ball widths) narrower than pool\'s 9 ft regulation pockets and than snooker\'s for its ball', !looser.length && poolHalf.pot,
    JSON.stringify({ heyball: hey, pool, snooker: snk, looser }));
  /* the rack (the Masters rules: a triangle, its apex on the foot spot, the 8 in the middle of the third row) */
  const g = S.newGame('heyball'), objs = g.balls.filter(b => b.n > 0), sp = 2 * S.BALL_R + S.RACK_GAP, dx = sp * Math.sqrt(3) / 2;
  const apex = ball(g, 1), eight = ball(g, 8), back = objs.filter(b => Math.abs(b.x - (S.FOOT[0] + 4 * dx)) < 1e-9).sort((a, b) => a.y - b.y);
  check('the rack: fifteen in a triangle, the apex on the foot spot, the 8 in the middle of the third row, a solid and a stripe in the back corners; the cue ball in hand behind the head string, the break to come',
    objs.length === 15 && apex.x === S.FOOT[0] && apex.y === S.FOOT[1] && Math.abs(eight.x - (S.FOOT[0] + 2 * dx)) < 1e-9 && Math.abs(eight.y - S.FOOT[1]) < 1e-9
    && S.groupOf(back[0].n) !== S.groupOf(back[4].n) && g.inHand === 'kitchen' && g.breakShot && g.open && ball(g, 0).x <= S.HEAD_X, JSON.stringify(objs.map(b => b.n)));
  check('in hand for the break: behind the head string only', S.canPlace(g, S.HEAD_X - 0.1, S.TW / 2) && !S.canPlace(g, S.HEAD_X + 0.05, S.TW / 2));
  S.setTable('7');
  check('a pool game afterwards goes back to the pool table and its square jaws', S.newGame('8') && S.TABLE === '7' && S.JAW_ARCS.length === 0 && S.newGame('heyball') && S.TABLE === 'heyball' && S.JAW_ARCS.length === 12);
}

/* ---------- 3. the rules (World Chinese 8-Ball Masters Rules of Chinese 8-ball, Rev. 2017) ---------- */
S.setTable('heyball');
{
  const g0 = S.newGame('heyball');
  /* the break: legal with a pot, or with four object balls to the cushions */
  const legal4 = S.judge(g0, res(g0, { first: 1, rails: rails4 }));
  check('break: four object balls to the cushions and nothing down is a legal break; the turn passes, the table open, no ball in hand', !legal4.verdict.foul && legal4.turn === 1 && legal4.open && !legal4.inHand && !legal4.option);
  const bad = S.judge(g0, res(g0, { first: 1, rails: rails3 }));
  check('break: three to the cushions and nothing down is an illegal break; the incoming player takes the table as it lies or has it racked again (felt follows WPA 8-ball\'s choices: take, re-break, break)',
    bad.verdict.illegalBreak && bad.option && bad.option.kind === 'badBreak' && bad.option.who === 1 && bad.option.choices.join() === 'take,rebreak,break', JSON.stringify(bad.option));
  const re = S.chooseOption(bad, 'rebreak'), tk = S.chooseOption(bad, 'take');
  check('...re-break: a fresh rack, the breaker breaks again from behind the head string; take: the incoming player shoots the table as it lies',
    re.breakShot && re.turn === 0 && re.inHand === 'kitchen' && re.balls.filter(b => b.on).length === 16 && tk.turn === 1 && !tk.breakShot);
  /* balls potted on the break do not decide the groups */
  const pot = S.judge(g0, res(g0, { first: 1, potted: [3, 11] }));
  check('break: balls potted on the break (a solid and a stripe) do not choose the groups: the table stays open and the breaker plays on', !pot.verdict.foul && pot.open && pot.groups[0] === null && pot.turn === 0 && !pot.verdict.grouped);
  const one = S.judge(g0, res(g0, { first: 1, potted: [11] }));
  check('...even one ball alone: a stripe down on the break leaves the table open, the breaker on', one.open && one.groups[0] === null && one.turn === 0);
  const after = S.judge(one, res(one, { first: 4, potted: [4] }));
  check('the first ball legally potted after the break chooses the group: a solid, then the breaker is solids and the other player stripes', !after.open && after.groups.join() === 'solids,stripes' && after.verdict.grouped && after.turn === 0);
  /* the 8 on an open table */
  const o8 = S.judge(one, res(one, { first: 8 }));
  check('an open table: the 8 may not be the first ball hit (a foul, ball in hand anywhere for the opponent)', o8.verdict.foul === 'hit the 8 first' && o8.turn === 1 && o8.inHand === 'table' && !S.legalTargets(one).includes(8));
  /* fouls */
  const scr = S.judge(g0, res(g0, { first: 1, rails: rails4, potted: [0] }));
  check('a scratch on the break: the incoming player has the cue ball in hand behind the head string', scr.verdict.foul === 'scratch' && scr.turn === 1 && scr.inHand === 'kitchen');
  const mid = midGame([1, 2, 9, 10, 8], { open: false, groups: ['solids', 'stripes'] });
  const wrong = S.judge(mid, res(mid, { first: 9 }));
  check('any other foul (the wrong ball first): ball in hand anywhere on the table for the opponent', wrong.verdict.foul && wrong.turn === 1 && wrong.inHand === 'table');
  const norail = S.judge(mid, res(mid, { first: 1, rail: false }));
  check('no ball potted and none to a cushion after contact is a foul', !!norail.verdict.foul && norail.inHand === 'table');
  const crossFirst = Object.assign(S.copyGame(mid), { inHand: 'kitchen' });
  for (const b of crossFirst.balls) if (b.n === 1) b.x = S.HEAD_X - 0.2;
  const behind = S.judge(crossFirst, res(crossFirst, { first: 1, crossed: false }));
  check('in hand behind the head string after a break scratch: a ball behind the string may not be hit first unless the cue ball crosses it first', behind.verdict.foul === 'hit the 1 behind the head string');
  /* no three-foul rule */
  let f = mid;
  for (let i = 0; i < 3; i++) { f = S.judge(Object.assign(S.copyGame(f), { turn: 0, inHand: null }), res(f, { first: 9 })); }
  check('no three-foul rule: three fouls in a row by one player do not lose the rack', f.winner === null && !f.verdict.threeFouls);
  /* the 8 on the break */
  const e8 = S.judge(g0, res(g0, { first: 1, potted: [8] }));
  check('the 8 on a legal break is not a foul and does not win: the breaker has it spotted and plays on, or breaks again',
    !e8.verdict.foul && e8.winner === null && e8.option && e8.option.kind === 'eightBreak' && e8.option.who === 0 && e8.option.choices.join() === 'spot,rerack');
  const e8s = S.chooseOption(e8, 'spot'), e8r = S.chooseOption(e8, 'rerack');
  check('...spotted: the 8 back on the foot spot (or behind it), the breaker to shoot; re-racked: the breaker breaks again', ball(e8s, 8).on && ball(e8s, 8).y === S.FOOT[1] && ball(e8s, 8).x >= S.FOOT[0] && e8s.turn === 0 && e8r.breakShot && e8r.turn === 0);
  const e8f = S.judge(g0, res(g0, { first: 1, potted: [8, 0] }));
  check('the 8 and the cue ball down on the break: the 8 spotted, the incoming player in hand behind the head string, no loss', e8f.winner === null && ball(e8f, 8).on && e8f.turn === 1 && e8f.inHand === 'kitchen');
  /* the 8, called */
  const on8 = midGame([9, 10, 8], { open: false, groups: ['solids', 'stripes'] });
  const need = S.callNeed(on8);
  check('the 8 goes to a nominated pocket: a shot at it needs a pocket called (obvious shots are called from the aim); a shot at a group ball needs none',
    !!need && need.pocket && need.auto && S.callNeed(mid) === null, JSON.stringify(need));
  const win = S.judge(S.withCall(on8, { ball: 8, pocket: 2 }), res(on8, { first: 8, potted: [8], pocketOf: { 8: 2 } }));
  check('the 8 in its called pocket with the group clear wins the rack', win.winner === 0 && /legally/.test(win.verdict.why));
  const other = S.judge(S.withCall(on8, { ball: 8, pocket: 2 }), res(on8, { first: 8, potted: [8], pocketOf: { 8: 5 } }));
  check('the 8 in another pocket than the one called loses the rack', other.winner === 1 && /uncalled pocket/.test(other.verdict.why));
  const early = S.judge(S.withCall(mid, { ball: 1, pocket: 0 }), res(mid, { first: 1, potted: [1, 8] }));
  check('the 8 potted before the group is clear loses the rack', early.winner === 1 && /before the group/.test(early.verdict.why));
  const scr8 = S.judge(S.withCall(on8, { ball: 8, pocket: 2 }), res(on8, { first: 8, potted: [8, 0], pocketOf: { 8: 2 } }));
  check('the 8 potted on a foul (a scratch) loses the rack', scr8.winner === 1 && /foul/.test(scr8.verdict.why));
  const off8 = S.judge(S.withCall(on8, { ball: 8, pocket: 2 }), Object.assign(res(on8, { first: 8, potted: [8] }), { pocketOf: { 8: -1 } }));
  check('the 8 driven off the table loses the rack', off8.winner === 1 && /left the table/.test(off8.verdict.why));
  /* 8-ball's house rules untouched */
  S.setTable('7');
  const h = S.newGame('8'), h8 = S.judge(h, res(h, { first: 1, potted: [8] }));
  check('8-ball\'s house rules are unchanged beside it: an 8 on the break is spotted and the breaker carries on, no choice', h.rules.id === '8-house' && !h8.option && ball(h8, 8).on && h8.turn === 0);
  S.setTable('heyball');
}

/* ---------- 4. fuzz and the CPU ---------- */
{
  const rnd = S.rng(31);
  let bad = 0, out = 0, overl = 0, g = S.newGame('heyball');
  for (let i = 0; i < 250; i++) {
    if (g.winner !== null || i % 50 === 0) g = S.newGame('heyball');
    if (g.option) { g = S.chooseOption(g, g.option.choices[0]); continue; }
    if (g.inHand || !ball(g, 0).on) { const x = g.inHand === 'kitchen' ? S.HEAD_X - 0.1 : 0.3 + rnd() * 1.8; let y = 0.2 + rnd() * 0.85; for (let k = 0; k < 40 && !S.canPlace(g, x, y); k++) y = 0.1 + rnd() * 1.05; if (S.canPlace(g, x, y)) g = S.placeCue(g, x, y); else { g = S.newGame('heyball'); continue; } }
    const r = S.simulateShot(g.balls, { angle: rnd() * 2 * Math.PI, power: rnd(), spin: { x: rnd() * 2 - 1, y: rnd() * 2 - 1 } });
    if (r.balls.some(b => !Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.vx))) bad++;
    if (r.balls.some(b => b.on && (b.x < -1e-6 || b.x > S.TL + 1e-6 || b.y < -1e-6 || b.y > S.TW + 1e-6)) || r.end !== 'rest') out++;
    const on = r.balls.filter(b => b.on);
    for (let a = 0; a < on.length; a++) for (let b = a + 1; b < on.length; b++) if (Math.hypot(on[a].x - on[b].x, on[a].y - on[b].y) < 2 * S.BALL_R - 1e-4) overl++;
    g = S.judge(g, r);
  }
  check('fuzz, 250 random shots: no NaN, no ball off the bed or still rolling, no overlap', !bad && !out && !overl, JSON.stringify({ bad, out, overl }));
  const brk = () => JSON.stringify(S.simulateShot(S.newGame('heyball').balls, { angle: 0.02, power: 1, spin: { x: 0.2, y: -0.2 } }));
  check('deterministic: the same break, the same result', brk() === brk());
  /* whole racks, CPU against CPU at each level: the options answered as the page answers them, the CPU's call with its shot */
  const rack = (lv, seed) => {
    let g = S.newGame('heyball'), shots = 0, pots = 0, fouls = 0, bad = 0;
    while (g.winner === null && shots < 300) {
      if (g.option) { g = S.chooseOption(g, S.cpuOption(g, lv)); continue; }
      const s = S.cpuShot(g, seed * 1000 + shots, lv);
      if (!s || !Number.isFinite(s.angle) || (g.inHand && !(s.place && S.canPlace(g, s.place[0], s.place[1])))) { bad++; break; }
      if (g.inHand) g = S.placeCue(g, s.place[0], s.place[1]);
      g = S.judge(S.withCall(g, s.call), S.simulateShot(g.balls, s));
      shots++; if (g.verdict.foul) fouls++; pots += g.verdict.potted.filter(x => x).length;
    }
    return { lv, winner: g.winner, shots, pots, fouls, bad, why: g.verdict.why };
  };
  const racks = ['easy', 'medium', 'hard'].flatMap(lv => [rack(lv, 1), rack(lv, 2)]);
  check('the CPU plays whole racks of Chinese 8-ball at easy, medium and hard: every rack ends (a winner within 300 shots), every shot well formed, a pot or more every four shots',
    racks.every(r => r.winner !== null && !r.bad && r.pots * 4 >= r.shots), JSON.stringify(racks));
  const by = lv => racks.filter(r => r.lv === lv).reduce((a, r) => a + r.shots, 0);
  check('hard clears a rack in fewer shots than easy on the tight pockets', by('hard') < by('easy'), JSON.stringify({ easy: by('easy'), medium: by('medium'), hard: by('hard') }));
}
S.setTable('7');

/* ---------- 5. the page ---------- */
(async () => {
  const T = await open('', { viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = T.page, ev = (f, a) => page.evaluate(f, a);
  const tap = async sel => { const r = await ev(s => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }, sel); if (r) await page.touchscreen.tap(r[0], r[1]); await page.waitForTimeout(200); return !!r; };
  await page.waitForTimeout(300);
  /* the home's ninth card */
  const card = await ev(() => { const r = playH.getBoundingClientRect(), a = play8.getBoundingClientRect(), row = playRow.getBoundingClientRect(), last = [...playRow.children].pop();
    return { last: last === playH, kind: playH.dataset.kind, name: playH.querySelector('.tt b').textContent, line: playH.querySelector('.tt small').textContent, w: r.width, rowW: row.width, h: r.height, h8: a.height,
      seen: r.top >= 0 && r.bottom <= innerHeight, label: playH.getAttribute('aria-label') }; });
  check('home: the ninth card, Chinese 8-Ball ("Snooker pockets, pool balls"), closes the games a row wide and as tall as the cards beside it, on the first screen at 393x852, named for a screen reader',
    card.last && card.kind === 'heyball' && card.name === 'Chinese 8-Ball' && card.line === 'Snooker pockets, pool balls' && Math.abs(card.w - card.rowW) < 0.5 && Math.abs(card.h - card.h8) < 0.5 && card.seen && /^Chinese 8-ball/.test(card.label), JSON.stringify(card));
  const art = await ev(() => { const cv = playH.querySelector('.art'), x = cv.getContext('2d'), d = x.getImageData(0, 0, cv.width, cv.height).data; let s = 0, s2 = 0, n = 0, dark = 0;
    for (let i = 0; i < d.length; i += 16) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; s += l; s2 += l * l; n++; } const m = s / n;
    /* the pocket's hole, near the right of the card: a dark disc on the rail */
    const W = cv.width, H = cv.height, p = x.getImageData(Math.round(W * 0.6), 0, Math.round(W * 0.4), Math.round(H * 0.6)).data; for (let i = 0; i < p.length; i += 4) if (p[i] + p[i + 1] + p[i + 2] < 45) dark++;
    return { varc: s2 / n - m * m, dark }; });
  check('the card\'s picture is the game\'s pocket close up: painted, not blank, the corner\'s dark hole in its top right', art.varc > 200 && art.dark > 500, JSON.stringify(art));
  /* the setup, by a real tap on the card */
  await tap('#playH');
  await page.waitForTimeout(600);
  const su = await ev(() => ({ open: setupSheet.classList.contains('show'), kind: setupSheet.dataset.kind, title: setupTitle.textContent, sub: setupSub.textContent, pool: [...setupSheet.querySelectorAll('.pool')].every(e => e.hidden),
    tut: !tutLink.hidden && tutLink.textContent.trim(), fit: setupScroll.scrollHeight <= setupScroll.clientHeight + 1, table: TABLE }));
  check('a real tap on the card opens its setup: "Chinese 8-Ball", no table or pocket choice (its own table), the tutorial row, the form whole', su.open && su.kind === 'heyball' && su.title === 'Chinese 8-Ball' && su.pool && su.tut === 'Learn Chinese 8-Ball' && su.fit, JSON.stringify(su));
  await tap('#rulesInfo');
  const pop = await ev(() => ({ open: !rulesPop.hidden, title: rulesPopTitle.textContent, src: rulesPopSrc.textContent, body: rulesPopBody.textContent }));
  check('the rules popover: "Chinese 8-Ball Rules", the World Chinese 8-Ball Masters rules, the open table after the break and the 8 to a named pocket',
    pop.open && pop.title === 'Chinese 8-Ball Rules' && pop.src === 'World Chinese 8-Ball Masters rules' && /table open/.test(pop.body) && /pocket you name/.test(pop.body) && /another pocket/.test(pop.body), JSON.stringify(pop));
  check('setup and popover: 44 px targets, 4.5:1 text', (await smallTargets(page)).length === 0 && (await lowContrast(page)).length === 0, JSON.stringify([await smallTargets(page), await lowContrast(page)]));
  await tap('#rulesPopDone');
  await tap('#vs2p');
  await tap('#breakBtn');
  await page.waitForTimeout(300);
  const g0 = await ev(() => ({ kind: felt.game.kind, table: TABLE, rules: felt.game.rules.id, hand: felt.game.inHand, st: felt.state, arcs: JAW_ARCS.length, TL, balls: felt.game.balls.length }));
  check('Break by a real tap: Chinese 8-ball on its own table (2.54 m, rounded jaws), its rules, 16 balls, the cue ball in hand behind the head string',
    g0.kind === 'heyball' && g0.table === 'heyball' && g0.rules === 'heyball' && g0.hand === 'kitchen' && g0.st === 'aim' && g0.arcs === 12 && g0.TL === 2.54 && g0.balls === 16, JSON.stringify(g0));
  check('the game screen: 44 px targets, 4.5:1 text', (await smallTargets(page)).length === 0 && (await lowContrast(page)).length === 0, JSON.stringify([await smallTargets(page), await lowContrast(page)]));
  /* the live roll is the sim's: a break, then shots from the table as it lies */
  const live = [];
  for (const [a, p] of [[0, 1], [0.6, 0.45], [-2.2, 0.55]]) {
    await settled(page);
    const r = await ev(async ([a, p]) => {
      if (state === 'choose') choose(game.option.choices[0]);   /* an illegal break or the 8 on it: the first choice, as a tap on it */
      const snap = JSON.stringify(felt.game.balls); felt.speed = 30;
      const ok = felt.shoot(a, p, { x: 0.1, y: -0.2 });
      while (['stroke', 'rolling'].includes(felt.state)) await new Promise(r => setTimeout(r, 30));
      const row = x => JSON.stringify(x.map(o => [o.n, o.on, o.x, o.y]));
      return { ok, same: row(simulateShot(JSON.parse(snap), felt.lastShot).balls) === row(felt.lastResult.balls) };
    }, [a, p]);
    live.push(r);
  }
  check('the live roll equals simulateShot byte for byte on the Chinese 8-ball table (a break and two more)', live.every(r => r.ok && r.same), JSON.stringify(live));
  /* the potted-ball windows and the rail's seats */
  await settled(page);
  const pw = await ev(async () => {
    const g = felt.game;
    Object.assign(g, { breakShot: false, open: false, groups: ['solids', 'stripes'], inHand: null, option: null, turn: 0, winner: null });
    for (const b of g.balls) if ([1, 2, 9].includes(b.n)) b.on = false;
    hud(); await new Promise(r => setTimeout(r, 400));
    const pr = felt.potRail, rb = felt.railBar;
    return { on: pr.on, left: pr.left, right: pr.right, words: pr.words, seats: [pchip0, pchip1].map(e => !e.hidden && e.classList.contains('grp')), say: [...turnChip.querySelectorAll('.ps')].map(e => e.textContent) };
  });
  check('the potted balls sit in their windows as at 8-ball (solids up the left, stripes up the right), and each seat shows its group',
    pw.on && pw.left.join() === '1,2' && pw.right.join() === '9' && /Potted/.test(pw.words) && /solids/.test(pw.say[0]) && /stripes/.test(pw.say[1]), JSON.stringify(pw));
  /* the 8 to a named pocket by a real tap: with the group clear the 8 is the one legal ball, so a tap on a pocket's
     hole is the whole call (even with no aim or auto aim to name the ball) */
  const hole = await ev(async () => {
    const g = felt.game;
    for (const b of g.balls) if (b.n > 0 && b.n < 8) b.on = false;
    Object.assign(g, { turn: 0, inHand: null, option: null, breakShot: false });
    resetCall(); hint = null; hud(); await new Promise(r => setTimeout(r, 200)); hint = null;
    return felt.toScreen(POCKETS[2][0], POCKETS[2][1]);
  });
  await page.touchscreen.tap(hole[0], hole[1]);
  await page.waitForTimeout(250);
  const cs = await ev(() => { const c = felt.callState; return { call: c.call && { ball: c.call.ball, pocket: c.call.pocket }, ready: c.ready, lab: c.lab }; });
  check('on the 8: a real tap on a pocket\'s hole calls the 8 in that pocket, and the bar is ready', cs.call && cs.call.ball === 8 && cs.call.pocket === 2 && cs.ready, JSON.stringify(cs));
  /* the 3D view */
  const v3 = await ev(async () => { setSetting('view', '3d'); felt.start('heyball'); await new Promise(r => setTimeout(r, 600)); return { live: !!felt.view3 && felt.view3.live, drawn: felt.view3 && felt.view3.drawn.length, on: felt.game.balls.filter(b => b.on).length, table: TABLE }; });
  check('the 3D view draws the Chinese 8-ball table and every ball', v3.table === 'heyball' && (!v3.live || v3.drawn >= 1), JSON.stringify(v3));
  await ev(() => setSetting('view', 'top'));
  /* the tutorial, through Show me, step by step */
  const tut = await ev(async () => {
    felt.speed = 30; felt.tutorial('heyball');
    const out = [];
    for (let i = 0; i < 8 && felt.tut; i++) {
      await new Promise(r => setTimeout(r, 300));
      if (!felt.tut) break;
      out.push({ step: felt.tut.step, table: TABLE, text: coachText.textContent.slice(0, 40), btn: coachBtn.hidden ? '' : coachBtn.textContent });
      if (coachBtn.hidden) break;
      coachBtn.click();
      for (let k = 0; k < 400 && ['stroke', 'rolling'].includes(felt.state) || k < 3; k++) await new Promise(r => setTimeout(r, 30));
      await new Promise(r => setTimeout(r, 900));
      if (tutDone.classList.contains('show')) { out.push({ done: true }); break; }
    }
    return { out, done: tutDone.classList.contains('show'), rec: felt.tutRec.done.heyball };
  });
  check('the Chinese 8-ball tutorial on the page: Show me plays each of its four steps on its own table to the finish', tut.done && tut.out.some(o => o.step === 3) && tut.out.filter(o => o.table).every(o => o.table === 'heyball'), JSON.stringify(tut));
  await ev(() => felt.quitToHome && felt.quitToHome());
  /* How to play */
  const help = await ev(() => { showHelp('heyball'); const p = panHey; return { shown: !p.hidden, title: helpTitle.textContent, rows: [...p.querySelectorAll('.rules li b')].map(b => b.textContent), go: tutGoH.textContent.trim() }; });
  check('How to play: a Chinese 8-Ball page (the table, the break, the open table, the 8 to a named pocket) ending with its tutorial',
    help.shown && help.title === 'Chinese 8-Ball' && help.rows.join() === 'The Table,Break,Open Table,Your Shot,Fouls,Win,Lose' && /Chinese 8-Ball Tutorial/.test(help.go), JSON.stringify(help));
  check('How to play page: 44 px targets, 4.5:1 text', (await smallTargets(page)).length === 0 && (await lowContrast(page)).length === 0, JSON.stringify([await smallTargets(page), await lowContrast(page)]));
  await ev(() => backToMenu());
  /* landscape */
  await page.setViewportSize({ width: 852, height: 393 });
  await page.waitForTimeout(300);
  const ls = await ev(async () => { felt.start('heyball'); await new Promise(r => setTimeout(r, 400)); const s = stage.getBoundingClientRect();
    return { table: TABLE, st: felt.state, sw: document.documentElement.scrollWidth <= innerWidth, stage: s.width > 0 && s.height > 0 }; });
  check('on its side (852x393): the game opens on its table, nothing sideways', ls.table === 'heyball' && ls.st === 'aim' && ls.sw && ls.stage, JSON.stringify(ls));
  check('no console errors', T.errors.length === 0, T.errors.join(' | '));
  await T.browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
