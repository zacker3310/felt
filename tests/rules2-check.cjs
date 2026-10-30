/* rules2-check (Node): the rules engine (sim 1e) and the called-shot model. The RULESETS
   registry, every game's legal and illegal breaks, scratches and ball in hand, first contact and
   the rail rule, called shots (ball, pocket, banks, kicks, combinations, safeties) judged apart
   from fouls, game-ball violations, push-outs and the opponent's options, three fouls, 14.1's
   scoring and re-racks, rotation to 61, the stalemate re-rack, and CPU-against-CPU racks of every
   variant played with calls. Results are built by hand so each case isolates one rule; the CPU
   racks and the rail log run the real physics. */
'use strict';
const { check, done } = require('./lib.cjs');
const { loadSim } = require('./sim.cjs');
const S = loadSim();

/* a fake shot result: the game's balls with `potted` off the table. pocketOf: ball -> pocket;
   rails: ball -> cushion contacts (left out unless given: a hand-made result passes the break's
   rail count); kick: the cue ball's cushions before first contact */
function res(g, { first = null, rail = true, potted = [], pocketOf = {}, rails, kick = null, crossed, move } = {}) {
  const balls = g.balls.map(b => Object.assign({}, b, { vx: 0, vy: 0, on: b.on && !potted.includes(b.n) }, move && move[b.n] ? { x: move[b.n][0], y: move[b.n][1] } : {}));
  const po = {};
  for (const n of potted) po[n] = pocketOf[n] !== undefined ? pocketOf[n] : 0;
  return Object.assign({ balls, first, railAfter: rail, potted, pocketOf: po, kick, end: 'rest' }, rails ? { rails } : {}, crossed === undefined ? {} : { crossed });
}
const rules = (ruleset, call = {}, extra = {}) => ({ rules: Object.assign({ ruleset, call }, extra) });
/* a game past the break with only the listed object balls on the table */
function midGame(kind, left, opts, over = {}) {
  const g = S.newGame(kind, opts);
  g.breakShot = false; g.inHand = null;
  for (const b of g.balls) if (b.n > 0 && !left.includes(b.n)) b.on = false;
  return Object.assign(g, over);
}
const on = (g, n) => g.balls.find(b => b.n === n).on;
const ball = (g, n) => g.balls.find(b => b.n === n);
const rails4 = { 1: 1, 2: 1, 3: 1, 4: 1, 0: 1 }, rails3 = { 1: 1, 2: 1, 3: 1, 0: 1 };
const call = (g, c) => S.withCall(g, c);

/* ---- the registry ---- */
{
  const ids = Object.keys(S.RULESETS);
  check('registry: every ruleset has its id, game, name, description and source', ids.every(id => { const r = S.RULESETS[id]; return r.id === id && r.game && r.name && r.description && /WPA|felt house rule|UMB|WPBSA|rotation/.test(r.source); }), ids.join(' '));
  check('registry: 8, 9, 10, 14.1 and rotation have WPA or house rulesets; every game a default', ['8', '9', '10', 'straight', 'rotation', 'bumper', 'carom', 'snooker'].every(k => S.RULESETS[S.DEFAULT_RULESET[k]].game === k)
    && S.rulesetsFor('8').length >= 2 && S.rulesetsFor('9').length >= 2 && S.rulesetsFor('10').length >= 2 && S.RULESETS['8-wpa'].source === 'WPA world standardized rules' && S.RULESETS['8-house'].source === 'felt house rule');
  const r = S.makeRules('9', { ruleset: '8-wpa' });
  check('registry: another game\'s ruleset is never applied (9-ball given 8-ball WPA plays 9-ball rules)', r.id === '9-house' && r.game === '9');
  const c = S.makeCall({ mode: 'nonsense', detail: 'rails', safety: 'yes', eight: true });
  check('registry: a call configuration is cleaned (unknown mode to the default, non-booleans ignored)', c.mode === 'official' && c.detail === 'rails' && c.safety === S.CALL_DEFAULT.safety && c.eight === true);
  const L = S.makeRules('10', { ruleset: '10-house', call: { mode: 'all' }, options: { stalemate: 3, bogus: 1 }, locked: true });
  check('registry: rules carry overrides, the lock and only known options', L.locked && L.stalemate === 3 && L.bogus === undefined && L.call.mode === 'all' && L.obvious === true);
  check('registry: rules made pass through makeRules unchanged', S.makeRules('10', L) === L);
  check('registry: a 14.1 race comes from the event', S.makeRules('straight', { race: 100 }).race === 100 && S.makeRules('straight').race === 50 && S.makeRules('rotation').race === 61);
}
/* ---- racks ---- */
{
  const r10 = S.newGame('10').balls, rot = S.newGame('rotation').balls, st = S.newGame('straight').balls, F = S.FOOT;
  check('rack: 10-ball racks ten balls, the 1 on the foot spot', r10.length === 11 && Math.abs(ball({ balls: r10 }, 1).x - F[0]) < 1e-9);
  const row3 = r10.filter(b => b.n > 0 && Math.abs(b.x - ball({ balls: r10 }, 10).x) < 1e-6).map(b => b.n).sort((a, b) => a - b);
  check('rack: the 10 sits in the middle of the third row', row3.length === 3 && Math.abs(ball({ balls: r10 }, 10).y - F[1]) < 1e-9, row3.join());
  const b2 = ball({ balls: rot }, 2), b3 = ball({ balls: rot }, 3), b15 = ball({ balls: rot }, 15), back = Math.max(...rot.map(b => b.x));
  check('rack: rotation has the 2 and 3 in the back corners and the 15 in the middle', Math.abs(b2.x - back) < 1e-9 && Math.abs(b3.x - back) < 1e-9 && Math.abs(Math.abs(b2.y - b3.y) - 4 * (2 * S.BALL_R + 0.0002)) < 1e-6 && Math.abs(b15.y - F[1]) < 1e-9);
  check('rack: 14.1 racks all fifteen', st.filter(b => b.n > 0).length === 15);
  check('targets: 14.1 any ball, 10-ball and rotation the lowest', S.legalTargets(S.newGame('straight')).length === 15 && S.legalTargets(S.newGame('10')).join() === '1' && S.legalTargets(S.newGame('rotation')).join() === '1');
}
/* ---- breaks ---- */
{
  const g = S.newGame('8', rules('8-wpa'));
  const a = S.judge(g, res(g, { first: 1, rails: rails3 }));
  check('8 WPA: three balls to the rails is an illegal break: the incoming player chooses', a.verdict.foul === 'illegal break' && a.option && a.option.who === 1 && a.option.choices.join() === 'take,rebreak,break' && a.turn === 1 && a.inHand === null);
  const b = S.judge(g, res(g, { first: 1, rails: rails4 }));
  check('8 WPA: four balls to the rails is a legal break', !b.verdict.foul && !b.option && b.turn === 1);
  const c = S.judge(g, res(g, { first: 1, rails: { 1: 1 }, potted: [3] }));
  check('8 WPA: a ball down makes the break legal whatever the rails', !c.verdict.foul && c.turn === 0);
  const t = S.chooseOption(a, 'take'), rb = S.chooseOption(a, 'rebreak'), bk = S.chooseOption(a, 'break');
  check('8 WPA: accept the table: the incoming player shoots it as it lies', t.turn === 1 && !t.option && !t.breakShot && t.inHand === null);
  check('8 WPA: re-rack: the breaker breaks again, or the incoming player breaks', rb.breakShot && rb.turn === 0 && bk.breakShot && bk.turn === 1 && rb.inHand === 'kitchen');
  check('options: a choice not on offer is refused', S.chooseOption(a, 'pass') === null && S.chooseOption(b, 'take') === null);
  const s = S.judge(g, res(g, { first: 1, rails: rails4, potted: [0] }));
  check('8 WPA: a scratch on a legal break: ball in hand behind the head string', s.verdict.foul === 'scratch' && s.inHand === 'kitchen' && s.turn === 1);
  const h = S.newGame('8');
  check('8 felt rules: no rail count on the break', !S.judge(h, res(h, { first: 1, rails: { 1: 1 } })).verdict.foul);
  const n9 = S.newGame('9', rules('9-wpa')), i9 = S.judge(n9, res(n9, { first: 1, rails: rails3 }));
  check('9 WPA: an illegal break is a foul, ball in hand anywhere', i9.verdict.foul === 'illegal break' && i9.inHand === 'table' && i9.turn === 1 && !i9.option);
  const w9 = S.judge(n9, res(n9, { first: 2, rails: rails4 }));
  check('9 WPA: the break must hit the 1 first', w9.verdict.foul === 'hit the 2 first');
  const sc9 = S.judge(n9, res(n9, { first: 1, rails: rails4, potted: [0] }));
  check('9 WPA: a break scratch gives ball in hand anywhere (felt rules: behind the line)', sc9.inHand === 'table' && S.judge(S.newGame('9'), res(S.newGame('9'), { first: 1, potted: [0] })).inHand === 'kitchen');
  const g10 = S.newGame('10'), i10 = S.judge(g10, res(g10, { first: 1, rails: rails3 }));
  check('10-ball: an illegal break: take it, or the breaker breaks again; not one of the three fouls', i10.option && i10.option.choices.join() === 'take,rebreak' && i10.fouls[0] === 0);
  check('10-ball: re-break puts the breaker back on a full rack', (x => x.breakShot && x.turn === 0 && S.onTable(x).length === 10)(S.chooseOption(i10, 'rebreak')));
  check('10-ball: taking an illegal break keeps the push-out', S.chooseOption(i10, 'take').pushAvail === true);
  const gr = S.newGame('rotation');
  check('rotation: the break must hit the 1 first', S.judge(gr, res(gr, { first: 2 })).verdict.foul === 'hit the 2 first');
}
/* ---- scratches, ball in hand, first contact, the rail ---- */
{
  const g = midGame('10', [3, 5, 10]);
  const a = S.judge(g, res(g, { first: 5 }));
  check('10-ball: the wrong ball first is a foul, ball in hand anywhere', a.verdict.foul === 'hit the 5 first' && a.inHand === 'table');
  const b = S.judge(g, res(g, { first: 3, rail: false }));
  check('10-ball: no rail after contact is a foul', b.verdict.foul === 'no rail after contact');
  const k = Object.assign(S.copyGame(g), { inHand: 'kitchen' });
  check('ball in hand: behind the head string only when the hand is the kitchen', !S.canPlace(k, S.HEAD_X + 0.1, S.TW / 2) && S.canPlace(Object.assign({}, k, { inHand: 'table' }), S.HEAD_X + 0.1, S.TW / 2));
  const st = midGame('straight', [1, 2, 3, 4, 5]);
  const c = S.judge(st, res(st, { first: 4, rail: false }));
  check('14.1: no rail is a foul: -1, the cue ball stays where it lies', c.verdict.foul && c.score[0] === -1 && c.inHand === null && c.turn === 1);
  const d = S.judge(st, res(st, { first: 2, potted: [0] }));
  check('14.1: a scratch: -1 and ball in hand behind the head string', d.score[0] === -1 && d.inHand === 'kitchen');
  check('14.1: any ball may be hit first', !S.judge(st, res(st, { first: 5 })).verdict.foul);
}
/* ---- called shots ---- */
{
  const opts = rules('10-wpa', { mode: 'official', detail: 'pocket' });
  const g = midGame('10', [3, 5, 7, 10], opts);
  check('calls: 10-ball needs ball and pocket on every shot', (n => n && n.pocket && !n.auto)(S.callNeed(g)));
  const a = S.judge(call(g, { ball: 3, pocket: 2 }), res(g, { first: 3, potted: [3], pocketOf: { 3: 2 } }));
  check('calls: the called ball in the called pocket keeps the turn', !a.verdict.foul && a.turn === 0 && a.verdict.call.made === true);
  const b = S.judge(call(g, { ball: 3, pocket: 2 }), res(g, { first: 3, potted: [3], pocketOf: { 3: 5 } }));
  check('calls: the wrong pocket is not a foul: the opponent chooses (10-ball)', b.verdict.foul === null && b.verdict.call.made === false && b.option && b.option.kind === 'uncalled' && b.option.who === 1 && !on(b, 3));
  check('calls: take the table, or hand it back to the shooter', S.chooseOption(b, 'take').turn === 1 && S.chooseOption(b, 'pass').turn === 0);
  const c = S.judge(call(g, { ball: 3, pocket: 2 }), res(g, { first: 3 }));
  check('calls: a called ball that misses just ends the turn', !c.verdict.foul && c.turn === 1 && !c.option);
  const ball1 = midGame('10', [3, 5, 10], rules('10-wpa', { detail: 'ball' }));
  check('calls: with ball-only detail any pocket counts', S.judge(call(ball1, { ball: 3 }), res(ball1, { first: 3, potted: [3], pocketOf: { 3: 4 } })).turn === 0);
  const sf = S.judge(call(g, { safety: true }), res(g, { first: 3, potted: [5], pocketOf: { 5: 1 } }));
  check('calls: a declared safety ends the turn; a ball down on it stays down (10-ball)', !sf.verdict.foul && sf.turn === 1 && !on(sf, 5) && !sf.option && sf.verdict.call.safety);
  const loose = midGame('10', [3, 5, 7, 10], rules('10-wpa', { safety: false })), none = S.judge(loose, res(loose, { first: 3, potted: [3] }));
  check('calls: no call where one is needed counts as a safety (safeties not required)', none.turn === 1 && none.verdict.call.safety && none.verdict.call.missing);
  const req = midGame('10', [3, 5, 10], rules('10-wpa'));
  const nr = S.judge(req, res(req, { first: 3, potted: [3] }));
  check('calls: with safeties required (the default), a shot with no call is a missed call', nr.verdict.call.why === 'no call' && !nr.verdict.call.safety && nr.option && nr.option.kind === 'uncalled');
  /* 8-ball */
  const e = midGame('8', [1, 2, 9, 10, 8], rules('8-wpa'), { open: false, groups: ['solids', 'stripes'] });
  check('calls: 8-ball WPA lets an obvious shot be called from the aim', S.callNeed(e).auto === true && S.callNeed(midGame('10', [3, 10], opts)).auto === false);
  const f = S.judge(call(e, { ball: 1, pocket: 0 }), res(e, { first: 1, potted: [1], pocketOf: { 1: 3 } }));
  check('calls: 8-ball wrong pocket: no foul, turn over, the ball stays down', !f.verdict.foul && f.turn === 1 && !on(f, 1) && !f.option);
  const sp = midGame('8', [1, 2, 9, 10, 8], rules('8-wpa'), { open: false, groups: ['solids', 'stripes'] });
  const s8 = S.judge(call(sp, { safety: true }), res(sp, { first: 1, potted: [2] }));
  check('calls: 8-ball safety: the pot stays down and the turn ends', s8.turn === 1 && !on(s8, 2) && !s8.verdict.foul);
  /* 14.1 */
  const st = midGame('straight', [1, 2, 3, 4, 5]);
  const s1 = S.judge(call(st, { ball: 2, pocket: 0 }), res(st, { first: 2, potted: [2, 4], pocketOf: { 2: 0, 4: 5 } }));
  check('calls: 14.1 a called ball scores, and so does a ball down with it', s1.score[0] === 2 && s1.turn === 0 && s1.verdict.scored === 2);
  const s2 = S.judge(call(st, { ball: 2, pocket: 0 }), res(st, { first: 2, potted: [2], pocketOf: { 2: 1 } }));
  check('calls: 14.1 a missed call: no score, the ball spotted, the turn over, no foul', s2.score[0] === 0 && on(s2, 2) && s2.turn === 1 && !s2.verdict.foul && Math.abs(ball(s2, 2).y - S.FOOT[1]) < 1e-9);
  const s3 = S.judge(call(st, { safety: true }), res(st, { first: 2, potted: [3] }));
  check('calls: 14.1 a safety: no score and the ball spotted', s3.score[0] === 0 && on(s3, 3) && s3.turn === 1);
  /* custom detail: banks, kicks, combinations */
  const cu = midGame('10', [3, 5, 10], rules('10-wpa', { detail: 'rails' }));
  check('calls: custom detail asks for the shot type', S.callNeed(cu).flags === true);
  const bk = S.judge(call(cu, { ball: 3, pocket: 2, bank: true }), res(cu, { first: 3, potted: [3], pocketOf: { 3: 2 }, rails: { 3: 1 } }));
  check('calls: a called bank that banks counts', bk.turn === 0 && bk.verdict.call.made);
  const nb = S.judge(call(cu, { ball: 3, pocket: 2 }), res(cu, { first: 3, potted: [3], pocketOf: { 3: 2 }, rails: { 3: 1 } }));
  check('calls: an uncalled bank is a missed call under custom detail', !nb.verdict.call.made && /bank/.test(nb.verdict.call.why) && !nb.verdict.foul);
  const kk = S.judge(call(cu, { ball: 3, pocket: 2, kick: true }), res(cu, { first: 3, potted: [3], pocketOf: { 3: 2 }, kick: 1 }));
  check('calls: a called kick that kicks counts', kk.verdict.call.made);
  const cm = midGame('10', [3, 5, 10], rules('10-wpa', { detail: 'rails' }));
  const co = S.judge(call(cm, { ball: 5, pocket: 2, combo: true }), res(cm, { first: 3, potted: [5], pocketOf: { 5: 2 } }));
  check('calls: a called combination (the 3 into the 5) counts', co.verdict.call.made && co.turn === 0);
  const co2 = S.judge(call(cm, { ball: 5, pocket: 2 }), res(cm, { first: 3, potted: [5], pocketOf: { 5: 2 } }));
  check('calls: the same combination uncalled as one is missed', !co2.verdict.call.made);
  const plain = midGame('10', [3, 5, 10], opts);
  check('calls: under ball and pocket a combination needs no flag', S.judge(call(plain, { ball: 5, pocket: 2 }), res(plain, { first: 3, potted: [5], pocketOf: { 5: 2 } })).verdict.call.made);
  const sx = midGame('10', [3, 5, 7, 10], rules('10-wpa', { detail: 'strict' }));
  const sxr = S.judge(call(sx, { ball: 3, pocket: 2 }), res(sx, { first: 3, potted: [3, 7], pocketOf: { 3: 2, 7: 0 } }));
  check('calls: strict detail: another ball down makes the call missed', !sxr.verdict.call.made && /7/.test(sxr.verdict.call.why));
  /* fouls judged apart from the call */
  const fc = S.judge(call(g, { ball: 3, pocket: 2 }), res(g, { first: 3, potted: [3, 0], pocketOf: { 3: 2 } }));
  check('calls: a made call on a scratch is still a foul (the two are judged apart)', fc.verdict.foul === 'scratch' && fc.verdict.call.made === true && fc.inHand === 'table' && fc.turn === 1);
}
/* ---- call scope ---- */
{
  const g8 = midGame('8', [1, 2, 9, 10, 8], rules('8-house', { mode: 'official' }), { open: false, groups: ['solids', 'stripes'] });
  check('scope: 8-ball felt rules, official: no calls', S.callNeed(g8) === null);
  const g8e = midGame('8', [9, 8], rules('8-house', { mode: 'official', eight: true }), { open: false, groups: ['solids', 'stripes'] });
  check('scope: "require called 8 pocket": a call only on the 8', S.callNeed(g8e) && S.callScope(g8e) === 'game' && S.callNeed(Object.assign(S.copyGame(g8e), { groups: ['stripes', 'solids'] })) === null);
  const g9 = midGame('9', [2, 9], rules('9-house', { mode: 'eight' })), g8o = midGame('8', [1, 9, 8], rules('8-house', { mode: 'eight' }), { open: false, groups: ['solids', 'stripes'] });
  check('scope: "8-ball only" calls every 8-ball shot and no 9-ball shot', S.callNeed(g9) === null && !!S.callNeed(g8o));
  check('scope: "all shots" calls 9-ball and rotation too; "off" calls nothing, even 10-ball', !!S.callNeed(midGame('9', [2, 9], rules('9-house', { mode: 'all' }))) && !!S.callNeed(midGame('rotation', [2, 9], rules('rotation', { mode: 'all' })))
    && S.callNeed(midGame('10', [2, 10], rules('10-wpa', { mode: 'off' }))) === null);
  check('scope: no call on the break; 14.1\'s break may carry one', S.callNeed(S.newGame('10')) === null && S.callOpen(S.newGame('straight')) && !S.callOpen(S.newGame('9')));
  check('scope: never in bumper, carom, snooker or practice', S.callScope(S.newGame('bumper')) === 'none' && S.callScope(S.newPractice('8')) === 'none');
}
/* ---- game-ball violations ---- */
{
  const g = midGame('8', [1, 9, 10, 8], rules('8-wpa'), { open: false, groups: ['solids', 'stripes'] });
  const a = S.judge(call(g, { ball: 1, pocket: 0 }), res(g, { first: 1, potted: [8], pocketOf: { 8: 2 } }));
  check('8: the 8 down before the group is clear loses', a.winner === 1);
  const g2 = midGame('8', [9, 10, 8], rules('8-wpa'), { open: false, groups: ['solids', 'stripes'] });
  const b = S.judge(call(g2, { ball: 8, pocket: 0 }), res(g2, { first: 8, potted: [8], pocketOf: { 8: 5 } }));
  check('8: the 8 in a pocket not called loses', b.winner === 1 && /uncalled/.test(b.verdict.why));
  const c = S.judge(call(g2, { ball: 8, pocket: 5 }), res(g2, { first: 8, potted: [8], pocketOf: { 8: 5 } }));
  check('8: the 8 in its called pocket wins', c.winner === 0);
  const d = S.judge(call(g2, { safety: true }), res(g2, { first: 8, potted: [8] }));
  check('8: the 8 down on a declared safety loses', d.winner === 1);
  const n8 = S.newGame('8', rules('8-wpa')), e = S.judge(n8, res(n8, { first: 1, potted: [8], rails: rails4 }));
  check('8 WPA: the 8 on the break: the breaker chooses spot or re-rack', e.option && e.option.kind === 'eightBreak' && e.option.who === 0 && e.winner === null && !on(e, 8));
  const es = S.chooseOption(e, 'spot'), er = S.chooseOption(e, 'rerack');
  check('8 WPA: spot: the 8 back on the foot spot, the breaker carries on', on(es, 8) && es.turn === 0 && !es.breakShot);
  check('8 WPA: re-rack: a full rack and the breaker breaks again', er.breakShot && er.turn === 0 && S.onTable(er).length === 15);
  const h = S.newGame('8'), hs = S.judge(h, res(h, { first: 1, potted: [8] }));
  check('8 felt rules: the 8 on the break is spotted at once', on(hs, 8) && hs.turn === 0 && !hs.option);
  const n9 = S.newGame('9', rules('9-wpa'));
  check('9: the 9 on the break wins (WPA and felt rules)', S.judge(n9, res(n9, { first: 1, potted: [9], rails: rails4 })).winner === 0 && S.judge(S.newGame('9'), res(S.newGame('9'), { first: 1, potted: [9] })).winner === 0);
  const n10 = S.newGame('10'), t = S.judge(n10, res(n10, { first: 1, potted: [10], rails: rails4 }));
  check('10: the 10 on the break is spotted, no win, the breaker carries on', t.winner === null && on(t, 10) && t.turn === 0);
  const g10 = midGame('10', [3, 5, 10]);
  const u = S.judge(call(g10, { ball: 3, pocket: 2 }), res(g10, { first: 3, potted: [3, 10], pocketOf: { 3: 2, 10: 0 } }));
  check('10: the 10 down early on a made call is spotted and the shooter carries on', u.winner === null && on(u, 10) && u.turn === 0);
  const w = S.judge(call(g10, { ball: 10, pocket: 2 }), res(g10, { first: 3, potted: [10], pocketOf: { 10: 2 } }));
  check('10: a called 10 (a combination) wins', w.winner === 0);
  const off = midGame('10', [3, 5, 10], rules('10-wpa', { mode: 'off' }));
  check('10 with calls off: a combination on the 10 is still spotted', (x => x.winner === null && on(x, 10))(S.judge(off, res(off, { first: 3, potted: [10] }))));
  const offLast = midGame('10', [10], rules('10-wpa', { mode: 'off' }));
  check('10 with calls off: the 10 as the ball on wins', S.judge(offLast, res(offLast, { first: 10, potted: [10] })).winner === 0);
  const f10 = S.judge(call(g10, { ball: 10, pocket: 2 }), res(g10, { first: 5, potted: [10] }));
  check('10: the 10 on a foul is spotted and ball in hand', f10.winner === null && on(f10, 10) && f10.inHand === 'table');
  const mc = S.judge(call(g10, { ball: 3, pocket: 2 }), res(g10, { first: 3, potted: [10], pocketOf: { 10: 1 } }));
  check('10: the 10 down on a missed call is spotted', on(mc, 10) && mc.winner === null);
}
/* ---- push-outs ---- */
{
  const g = S.newGame('9', rules('9-wpa'));
  const a = S.judge(g, res(g, { first: 1, rails: rails4 }));
  check('push: available on the shot after the break (WPA 9-ball)', a.pushAvail === true && S.newGame('9').pushAvail === false && S.judge(S.newGame('9'), res(S.newGame('9'), { first: 1 })).pushAvail === false);
  const p = S.judge(call(a, { push: true }), res(a, { first: 5, rail: false }));
  check('push: the wrong ball and no rail are not fouls; the opponent chooses', !p.verdict.foul && p.verdict.push && p.option && p.option.kind === 'push' && p.option.who === 0 && p.pushAvail === false);
  check('push: no call is needed on a push-out', S.callNeed(call(a, { push: true })) === null);
  const take = S.chooseOption(p, 'take'), pass = S.chooseOption(p, 'pass');
  check('push: take shoots it; pass hands it back to the pusher', take.turn === 0 && pass.turn === 1 && !take.option && !pass.pushAvail);
  const sc = S.judge(call(a, { push: true }), res(a, { first: 5, potted: [0] }));
  check('push: a scratch on a push-out is still a foul', sc.verdict.foul === 'scratch' && sc.inHand === 'table' && !sc.option);
  const nine = S.judge(call(a, { push: true }), res(a, { first: 5, potted: [9] }));
  check('push: the 9 down on a push-out is spotted', nine.winner === null && on(nine, 9));
  const later = S.judge(call(take, { push: true }), res(take, { first: 5 }));
  check('push: only once, straight after the break (later it is a plain shot)', later.verdict.foul === 'hit the 5 first');
  const t10 = S.newGame('10'), b10 = S.judge(t10, res(t10, { first: 1, potted: [2], rails: rails4 }));
  check('push: a breaker who carries on may push out (10-ball)', b10.turn === 0 && b10.pushAvail === true);
}
/* ---- three fouls ---- */
{
  let g = midGame('9', [2, 3, 9], rules('9-wpa'));
  g = S.judge(g, res(g, { first: 3 })); g.turn = 0;
  const two = S.judge(g, res(g, { first: 3 }));
  check('three fouls: a warning after two (the shooter coming back on two)', two.fouls[0] === 2 && (two.turn = 0, true));
  const three = S.judge(two, res(two, { first: 3 }));
  check('three fouls: the third in a row loses (9-ball)', three.winner === 1 && /three fouls/.test(three.verdict.why));
  let h = midGame('10', [2, 3, 10]);
  for (let i = 0; i < 3; i++) { h = S.judge(h, res(h, { first: 3 })); if (h.winner === null) h.turn = 0; }
  check('three fouls: 10-ball too', h.winner === 1);
  let k = midGame('9', [2, 3, 9], rules('9-wpa'));
  k = S.judge(k, res(k, { first: 3 })); k.turn = 0;
  k = S.judge(k, res(k, { first: 2 })); k.turn = 0;
  check('three fouls: a legal shot clears the count', k.fouls[0] === 0);
  let s = midGame('straight', [1, 2, 3, 4, 5]);
  for (let i = 0; i < 3; i++) { s = S.judge(s, res(s, { first: 2, rail: false })); if (i < 2) s.turn = 0; }
  check('14.1 three fouls: -1, -1, then -16; the fouler breaks a full rack', s.score[0] === -18 && s.verdict.threeFouls && s.breakShot && s.turn === 0 && S.onTable(s).length === 15 && s.inHand === 'kitchen' && s.verdict.rerack === 'fouls');
}
/* ---- 14.1 ---- */
{
  const g = S.newGame('straight', { rules: { race: 25 } });
  check('14.1: a race from the setup', g.race === 25 && g.score.join() === '0,0');
  const brk = S.judge(g, res(g, { first: 1, rails: { 0: 1, 1: 1, 2: 1 } }));
  check('14.1 break: two balls and the cue ball to the rails is legal; the turn passes', !brk.verdict.foul && brk.turn === 1 && brk.score[0] === 0);
  const bad = S.judge(g, res(g, { first: 1, rails: { 0: 1, 1: 1 } }));
  check('14.1 break: short of that: a breaking foul, -2, the incoming player chooses', bad.verdict.foul === 'breaking foul' && bad.score[0] === -2 && bad.option && bad.option.choices.join() === 'take,rebreak' && bad.fouls[0] === 0);
  const rb = S.chooseOption(bad, 'rebreak');
  check('14.1 break: re-break: the same breaker, a full rack', rb.breakShot && rb.turn === 0 && rb.score[0] === -2);
  const cb = S.judge(call(g, { ball: 5, pocket: 2 }), res(g, { first: 1, potted: [5], pocketOf: { 5: 2 }, rails: { 1: 1 } }));
  check('14.1 break: a called ball made is a legal break and scores', !cb.verdict.foul && cb.score[0] === 1 && cb.turn === 0);
  const unc = S.judge(g, res(g, { first: 1, potted: [6], rails: { 0: 1, 1: 1, 2: 1 } }));
  check('14.1 break: an uncalled ball down on the break is spotted', on(unc, 6) && unc.score[0] === 0);
  /* runs and the high run */
  let r = midGame('straight', [1, 2, 3, 4, 5]);
  for (const n of [1, 2, 3]) r = S.judge(call(r, { ball: n, pocket: 0 }), res(r, { first: n, potted: [n], pocketOf: { [n]: 0 } }));
  check('14.1: a run counts point by point', r.score[0] === 3 && r.run === 3 && r.high[0] === 3 && r.turn === 0);
  r = S.judge(call(r, { ball: 4, pocket: 0 }), res(r, { first: 4 }));
  check('14.1: a miss ends the run; the high run stays', r.run === 0 && r.high[0] === 3 && r.turn === 1);
  /* the re-rack: 14 down */
  const two = midGame('straight', [7, 9]);
  const away = [S.TL * 0.3, S.TW * 0.3], awayCue = [S.TL * 0.4, S.TW * 0.7];
  const q = S.judge(call(two, { ball: 7, pocket: 0 }), res(two, { first: 7, potted: [7], pocketOf: { 7: 0 }, move: { 9: away, 0: awayCue } }));
  const spots = S.rackSpots();
  const apexFree = q.balls.every(b => !b.on || Math.hypot(b.x - spots[0][0], b.y - spots[0][1]) > 1e-6);
  check('14.1 re-rack: the 14 racked with the apex empty, the break ball and cue ball where they lay', q.verdict.rerack === 'fourteen' && S.onTable(q).length === 15 && apexFree && Math.abs(ball(q, 9).x - away[0]) < 1e-9 && Math.abs(ball(q, 0).x - awayCue[0]) < 1e-9 && q.inHand === null && q.turn === 0 && q.score[0] === 1);
  const inRack = [spots[3][0], spots[3][1]];
  const q2 = S.judge(call(two, { ball: 7, pocket: 0 }), res(two, { first: 7, potted: [7], pocketOf: { 7: 0 }, move: { 9: inRack, 0: awayCue } }));
  check('14.1 re-rack: a break ball in the rack goes to the head spot', Math.abs(ball(q2, 9).x - S.HEAD_X) < 1e-9 && Math.abs(ball(q2, 9).y - S.TW / 2) < 1e-9 && q2.inHand === null);
  const q3 = S.judge(call(two, { ball: 7, pocket: 0 }), res(two, { first: 7, potted: [7], pocketOf: { 7: 0 }, move: { 9: away, 0: inRack } }));
  check('14.1 re-rack: a cue ball in the rack: ball in hand behind the head string', q3.inHand === 'kitchen' && Math.abs(ball(q3, 9).x - away[0]) < 1e-9);
  const q4 = S.judge(call(two, { ball: 7, pocket: 0 }), res(two, { first: 7, potted: [7], pocketOf: { 7: 0 }, move: { 9: [spots[5][0], spots[5][1]], 0: inRack } }));
  check('14.1 re-rack: both in the rack: break ball to the head spot, cue ball in hand', q4.inHand === 'kitchen' && Math.abs(ball(q4, 9).x - S.HEAD_X) < 1e-9);
  const q5 = S.judge(call(two, { ball: 7, pocket: 0 }), res(two, { first: 7, potted: [7], pocketOf: { 7: 0 }, move: { 9: inRack, 0: [S.HEAD_X, S.TW / 2] } }));
  check('14.1 re-rack: break ball in the rack, cue ball on the head spot: the centre spot', Math.abs(ball(q5, 9).x - S.TL / 2) < 1e-9);
  const q6 = S.judge(call(two, { ball: 7, pocket: 0 }), res(two, { first: 7, potted: [7, 9], pocketOf: { 7: 0, 9: 2 } }));
  check('14.1 re-rack: the 14th and 15th together: all fifteen racked, ball in hand behind the line', q6.verdict.rerack === 'fifteen' && S.onTable(q6).length === 15 && q6.inHand === 'kitchen' && q6.score[0] === 2 && q6.verdict.potted.join() === '7,9');
  const win = midGame('straight', [1, 2, 3], { rules: { race: 25 } }, { score: [24, 3] });
  const wv = S.judge(call(win, { ball: 1, pocket: 0 }), res(win, { first: 1, potted: [1], pocketOf: { 1: 0 } }));
  check('14.1: the race won on the point that reaches it', wv.winner === 0 && /25 points/.test(wv.verdict.why));
}
/* ---- rotation ---- */
{
  const g = midGame('rotation', [1, 2, 14, 15]);
  const a = S.judge(g, res(g, { first: 1, potted: [1, 15] }));
  check('rotation: every ball down on a legal shot scores its number', a.score[0] === 16 && a.turn === 0 && a.verdict.scored === 16);
  const b = S.judge(g, res(g, { first: 2, potted: [15] }));
  check('rotation: a foul scores nothing, the balls spotted, ball in hand', b.score[0] === 0 && on(b, 15) && b.inHand === 'table' && b.turn === 1);
  const c = Object.assign(midGame('rotation', [1, 2, 14, 15]), { score: [50, 10] });
  const d = S.judge(c, res(c, { first: 1, potted: [1, 14] }));
  check('rotation: 61 wins', d.winner === 0 && d.score[0] === 65);
  const e = Object.assign(midGame('rotation', [15]), { score: [45, 60] });
  const f = S.judge(e, res(e, { first: 15, potted: [15] }));
  check('rotation: 60-60 with the table empty: the last ball takes it', f.winner === 0 && f.score[0] === 60 && f.score[1] === 60);
}
/* ---- the stalemate ---- */
{
  let g = midGame('9', [2, 3, 9], rules('9-wpa', {}, { options: { stalemate: 2 } }));
  g.breaker = 1;
  for (let i = 0; i < 4; i++) g = S.judge(g, res(g, { first: 2 }));
  check('stalemate: dry innings in a row re-rack the balls, the breaker breaks again', g.verdict.rerack === 'stalemate' && g.breakShot && g.turn === 1 && S.onTable(g).length === 9);
}
/* ---- the declaration history ---- */
{
  const g = midGame('10', [3, 5, 10]);
  const a = S.judge(call(g, { ball: 3, pocket: 2 }), res(g, { first: 3, potted: [3], pocketOf: { 3: 2 } }));
  const b = S.judge(call(a, { ball: 5, pocket: 0 }), res(a, { first: 5 }));
  check('history: each declaration and how it went', b.calls.length === 2 && b.calls[0].made === true && b.calls[1].made === false && b.calls[1].ball === 5 && b.calls[0].p === 0);
}
/* ---- the rail log (the real physics) ---- */
{
  S.setTable('7');
  const g = S.newGame('9');
  const r = S.simulateShot(g.balls, { angle: 0, power: 1, spin: { x: 0, y: -0.2 } });
  const counts = {};
  for (const [n] of r.railSeq) counts[n] = (counts[n] || 0) + 1;
  check('rails: the log holds every cushion contact of every ball, in order', r.railSeq.length > 4 && Object.keys(r.rails).every(n => r.rails[n] === counts[n]), JSON.stringify(r.rails));
  const r2 = S.simulateShot(g.balls, { angle: 0, power: 1, spin: { x: 0, y: -0.2 } });
  check('rails: deterministic, run to run', JSON.stringify(r2.railSeq) === JSON.stringify(r.railSeq));
}
/* ---- the CPU: calls, push-outs and options, every variant to the end ---- */
{
  const variants = [['8', '8-wpa', 'official'], ['8', '8-house', 'all'], ['9', '9-wpa', 'official'], ['9', '9-house', 'all'], ['10', '10-wpa', 'official'], ['10', '10-house', 'official'],
    ['straight', 'straight-wpa', 'official', 15], ['rotation', 'rotation', 'all']];
  for (const [kind, ruleset, mode, race] of variants) {
    let g = S.newGame(kind, { rules: { ruleset, call: { mode, detail: 'pocket' }, race } }), seed = 7, shots = 0, missing = 0, bad = 0, calls = 0, opts = 0;
    while (g.winner === null && shots < 260) {
      if (g.option) { const c = S.cpuOption(g, 'easy'); if (!g.option.choices.includes(c)) bad++; g = S.chooseOption(g, c); opts++; continue; }
      const s = S.cpuShot(g, seed++, 'easy');
      let g1 = s.place ? S.placeCue(g, s.place[0], s.place[1]) : g;
      const need = S.callNeed(g1);
      if (need && !(s.call && (s.call.safety || s.call.push || (s.call.ball != null && s.call.pocket != null)))) missing++;
      if (s.call && s.call.ball != null && !S.legalTargets(g1).includes(s.call.ball) && kind !== '8') bad++;
      if (need) calls++;
      g1 = S.withCall(g1, s.call);
      g = S.judge(g1, S.simulateShot(g1.balls, s));
      shots++;
    }
    check(`CPU: ${S.RULESETS[ruleset].name} (${mode} calls), CPU against CPU, the rack finishes with every shot called`, g.winner !== null && missing === 0 && bad === 0 && (S.callScope(S.newGame(kind, { rules: { ruleset, call: { mode } } })) === 'none' || calls > 0),
      `${shots} shots, ${calls} calls, ${opts} options, winner ${g.winner}, ${g.verdict.why}`);
  }
  const p = S.newGame('9', rules('9-wpa'));
  const after = S.judge(p, res(p, { first: 1, rails: rails4 }));
  const pushed = S.judge(call(after, { push: true }), res(after, { first: 5 }));
  const ch = S.cpuOption(pushed, 'hard');
  check('CPU: answers a push-out with take or pass', ['take', 'pass'].includes(ch), ch);
  check('CPU: spots an 8 on the break', S.cpuOption(S.judge(S.newGame('8', rules('8-wpa')), res(S.newGame('8', rules('8-wpa')), { first: 1, potted: [8], rails: rails4 })), 'medium') === 'spot');
}
/* ---- a ball off the table (a jump over a cushion, sim 1a: pocketOf -1) ----
   a foul in every game (WPA General Rules; WPBSA Section 3 Rule 12; UMB; bumper's house rule);
   the turn passes. Spotted or not by the game's rules: house sets and 14.1 and rotation spot it on
   the foot spot, WPA 8, 9 and 10-ball leave it off but for the game ball (9 and 10 spot it; the 8
   off a shot that is not the break loses), snooker spots a colour and leaves a red off, carom and
   bumper pool put it back. A called ball that flew off is not a pot. */
{
  const off = (g, n, first) => res(g, { first, potted: [n], pocketOf: { [n]: -1 } });
  const cases = [];
  const pool = (kind, ruleset, left, n, spotted) => {
    const g = midGame(kind, left, rules(ruleset)), j = S.judge(g, off(g, n, left[0]));
    cases.push([ruleset, n, !!j.verdict.foul, j.turn !== g.turn, on(j, n) === spotted, j.winner, JSON.stringify(j.verdict.off)]);
    return j;
  };
  pool('8', '8-house', [3, 4, 11, 8], 4, true);
  pool('8', '8-wpa', [3, 4, 11, 8], 4, false);
  pool('9', '9-house', [3, 5, 9], 5, true);
  pool('9', '9-wpa', [3, 5, 9], 5, false);
  pool('9', '9-wpa', [3, 5, 9], 9, true);
  pool('10', '10-wpa', [2, 6, 10], 6, false);
  pool('10', '10-wpa', [2, 6, 10], 10, true);
  pool('straight', 'straight-wpa', [2, 6, 10, 12], 6, true);
  pool('rotation', 'rotation', [2, 6, 10], 6, true);
  const ok = cases.every(c => c[2] && c[3] && c[4] && c[5] === null && c[6] === `[${c[1]}]`);
  check('off the table, pocket games: a foul and the turn passes; spotted under house rules, 14.1 and rotation, left off under WPA 8, 9 and 10-ball but for the 9 and 10 (spotted); verdict.off names it',
    ok, JSON.stringify(cases));
  /* the 8: lost off any shot but the break, spotted off the break */
  const g8 = midGame('8', [3, 11, 8], rules('8-wpa'), { open: false, groups: ['solids', 'stripes'] }), j8 = S.judge(g8, off(g8, 8, 3));
  const b8 = S.newGame('8', rules('8-house')), jb8 = S.judge(b8, Object.assign(res(b8, { first: 1, potted: [8, 2], pocketOf: { 8: -1, 2: 0 } }), { rails: { 1: 1, 2: 1, 3: 1, 4: 1 } }));
  check('off the table: the 8 off a shot that is not the break loses the rack (WPA 8-ball); off the break it is spotted and the game goes on',
    j8.winner === 1 - g8.turn && /left the table/.test(j8.verdict.why) && jb8.winner === null && on(jb8, 8) && !!jb8.verdict.foul, JSON.stringify({ w: j8.winner, why: j8.verdict.why, b: [jb8.winner, on(jb8, 8), jb8.verdict.foul] }));
  /* a 9 or 10 that flew off never wins, even called */
  const g9 = midGame('9', [9], rules('9-wpa')), j9 = S.judge(g9, off(g9, 9, 9));
  const g10 = S.withCall(midGame('10', [10], rules('10-wpa')), { ball: 10, pocket: 2 }), j10 = S.judge(g10, off(g10, 10, 10));
  check('off the table: the game ball flown off is no win (9-ball, a called 10), spotted, a foul', j9.winner === null && on(j9, 9) && j9.verdict.foul && j10.winner === null && on(j10, 10) && j10.verdict.foul,
    JSON.stringify([j9.verdict, j10.verdict.foul]));
  /* the cue ball off the table: the scratch's ball in hand */
  const gc = midGame('9', [3, 9], rules('9-wpa')), jc = S.judge(gc, res(gc, { first: 3, potted: [0], pocketOf: { 0: -1 } }));
  check('off the table: the cue ball flown off is a foul with ball in hand anywhere (9-ball WPA), worded as such', jc.verdict.foul === 'the cue ball left the table' && jc.inHand === 'table' && jc.turn !== gc.turn, JSON.stringify(jc.verdict));
  /* snooker: a colour off is spotted, a red stays off; a foul worth at least 4, the colour's value when more */
  const sg = S.snookerGame(), red = sg.balls.find(b => S.isRed(b.n)).n;
  Object.assign(sg, { breakShot: false });
  const sr = S.judge(sg, Object.assign(res(sg, { first: red, potted: [red], pocketOf: { [red]: -1 } }), { seq: [red] }));
  const sc = S.judge(sg, Object.assign(res(sg, { first: red, potted: [62], pocketOf: { 62: -1 } }), { seq: [red] }));
  check('off the table, snooker: a foul; a red off stays off, a colour off is spotted; the penalty 4, or the colour\'s value (the black, 7)',
    !!sr.verdict.foul && !on(sr, red) && sr.verdict.pen === 4 && !!sc.verdict.foul && on(sc, 62) && sc.verdict.pen === 7, JSON.stringify([sr.verdict.foul, sr.verdict.pen, sc.verdict.foul, sc.verdict.pen]));
  /* snooker: the cue ball jumping a ball before its first contact is a jump shot (Section 3 Rule 10) */
  const sj = S.judge(sg, Object.assign(res(sg, { first: red }), { seq: [red], over: [61] }));
  check('snooker: a cue ball that jumped a ball before hitting the ball on is a foul (a jump shot), at the jumped ball\'s value', sj.verdict.foul === 'a jump shot' && sj.verdict.pen === 6, JSON.stringify(sj.verdict));
  /* carom and bumper pool: a ball off comes back, a foul */
  const cg = S.caromGame(); cg.breakShot = false;
  const cj = S.judge(cg, Object.assign(res(cg, { first: S.C_RED, potted: [S.C_RED], pocketOf: { [S.C_RED]: -1 } }), { seq: [S.C_RED] }));
  const bg = S.newGame('bumper'); bg.opening = 0;
  const bj = S.judge(bg, Object.assign(res(bg, { potted: [32], pocketOf: { 32: -1 } }), { cue: 21 }));
  check('off the table, carom and bumper pool: a foul, the ball comes back', !!cj.verdict.foul && on(cj, S.C_RED) && !!bj.verdict.foul && on(bj, 32), JSON.stringify([cj.verdict.foul, bj.verdict.foul]));
  S.setTable('7');
}
done();
