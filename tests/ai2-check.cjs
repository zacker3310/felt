/* ai2-check (Node): the CPU's personalities (cpuProfile, CPU_ARCH, sim 1f) and its think time
   (cpuThinkMs, F8). ai-check pins the levels; this suite pins what a profile adds on top:
   - the bare levels are exactly CPU_LEVELS (every personality knob neutral), and a level's
     profile plays the same shots as its name;
   - every career archetype (Career's ARCH ids) has a personality, and the career's knobs
     (aiProfileOf) reach the search: its noise, its archetype, its level; noise grows as skill falls;
   - determinism for a seed;
   - honesty: the CPU never touches the game it is given, its shot is well formed, and the shot
     played through strike/stepTable (the page's live path) ends exactly as simulateShot says;
     execution noise lands on the cue inputs only (the break's tip offset, which a bare level
     plays exactly);
   - measurable differences over the same mid-game positions: the defender plays the most
     safeties, the potter and shotmaker the fewest; the shotmaker attempts harder pots (a lower
     mean chance per attempt); only the bank-minded play banks and only the risk takers combos;
     calls carry the bank and combination flags; the defender hands back choices the potter takes;
     the breaker breaks harder; a positional player thinks longer than a potter;
   - think time: bounded, short on an obvious pot and the break, longer on hard pots and
     safeties, the search sliced so no single step is long;
   - every game kind takes a profile; hard beats easy over whole racks; personalities against
     each other always finish.
   Mid-game positions come from medium against medium 8-ball games; the games and the position
   sweeps run on worker threads. */
'use strict';
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');
const { loadSim } = require('./sim.cjs');
const S = loadSim();
const ARCHS = ['allround', 'potter', 'shotmaker', 'defender', 'positional', 'banker', 'grinder', 'breaker', 'clutch'];

/* mid-game 8-ball positions (nobody in hand, not the break), every third shot of seeded games */
function positions(count, kind = '8', rules) {
  S.setTable('7'); S.setPockets('regulation');
  const out = [];
  for (let seed = 1; out.length < count; seed++) {
    let g = S.newGame(kind, rules ? { rules } : undefined);
    for (let i = 0; i < 40 && g.winner === null && out.length < count; i++) {
      const s = S.cpuShot(g, seed * 1000 + i, 'medium');
      if (i >= 2 && i % 3 === 0 && !g.inHand && !g.breakShot) out.push(g);
      if (g.inHand) g = S.placeCue(g, s.place[0], s.place[1]);
      g = S.judge(g, S.simulateShot(g.balls, s));
    }
  }
  return out;
}
function wellFormed(g, s) {
  const sp = s && s.spin;
  return !!s && Number.isFinite(s.angle) && s.power >= 0 && s.power <= 1 && !!sp && Number.isFinite(sp.x) && Number.isFinite(sp.y) &&
    sp.x * sp.x + sp.y * sp.y <= 1 + 1e-9 && (g.inHand ? !!s.place && S.canPlace(g, s.place[0], s.place[1]) : s.place === null);
}
/* a whole game between two profiles */
function play(kind, profs, seed, first) {
  S.setTable('7'); S.setPockets('regulation');
  let g = S.newGame(kind), shots = 0, bad = 0;
  g.turn = first;
  while (g.winner === null && shots < 300) {
    const s = S.cpuShot(g, seed * 1000 + shots, profs[g.turn]);
    if (!wellFormed(g, s)) { bad++; break; }
    if (g.inHand) g = S.placeCue(g, s.place[0], s.place[1]);
    g = S.judge(g, S.simulateShot(g.balls, s));
    shots++;
  }
  return { winner: g.winner, shots, bad };
}
/* one archetype over the shared positions: what it chose, and whether it kept the table */
function sweep(arch, level, count) {
  const pos = positions(count), out = { arch, types: {}, q: [], kept: 0, think: 0, calls: [] };
  pos.forEach((g, i) => {
    const P = { level, arch }, s = S.cpuShot(g, 77 + i, P), t = s.intent.type;
    out.types[t] = (out.types[t] || 0) + 1;
    if (t === 'pot' || t === 'bank' || t === 'combo') out.q.push(s.intent.q);
    const j = S.judge(g, S.simulateShot(g.balls, s));
    if (j.turn === g.turn && !j.verdict.foul) out.kept++;
    out.think += S.cpuThinkMs(g, s, P, i);
  });
  return out;
}
if (!isMainThread) {
  parentPort.postMessage(workerData.map(j => j.sweep ? sweep(j.arch, j.level, j.count) : Object.assign(j, play(j.kind, j.profs, j.seed, j.first))));
  return;
}
const { check, done } = require('./lib.cjs');
function runAll(jobs) {
  const n = Math.max(1, Math.min(4, os.cpus().length, jobs.length)), parts = [...Array(n)].map(() => []);
  jobs.forEach((j, i) => parts[i % n].push(j));
  return Promise.all(parts.map(p => new Promise((res, rej) => {
    const w = new Worker(__filename, { workerData: p });
    w.once('message', res); w.once('error', rej);
  }))).then(r => r.flat());
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;

(async () => {
  const t0 = Date.now();
  /* the threads first: the sweeps and the games */
  const NPOS = 60, jobs = ARCHS.filter(a => a !== 'clutch').map(arch => ({ sweep: true, arch, level: 'medium', count: NPOS }));
  for (const kind of ['8', '9']) for (let i = 0; i < 8; i++) {
    const archH = ARCHS[i % ARCHS.length], archE = ARCHS[(i + 3) % ARCHS.length], h = { level: 'hard', arch: archH }, e = { level: 'easy', arch: archE };
    jobs.push({ kind, seed: 300 + i, profs: i % 2 ? [e, h] : [h, e], hard: i % 2, first: (i >> 1) % 2, tag: 'he' });
  }
  for (const [i, [a, b]] of [['shotmaker', 'defender'], ['defender', 'defender'], ['banker', 'grinder'], ['potter', 'positional']].entries())
    jobs.push({ kind: i % 2 ? '9' : '8', seed: 500 + i, profs: [{ level: 'medium', arch: a }, { level: 'medium', arch: b }], first: 0, tag: 'mix' });
  const pending = runAll(jobs);

  /* ---- the bare levels are the levels ---- */
  const KEYS = Object.keys(S.CPU_NEUTRAL);
  for (const lv of ['easy', 'medium', 'hard']) {
    const P = S.cpuProfile(lv), L = S.CPU_LEVELS[lv];
    check(`cpuProfile('${lv}'): every field of CPU_LEVELS.${lv}, every personality knob neutral`,
      Object.keys(L).every(k => same(P[k], L[k])) && KEYS.every(k => same(P[k], S.CPU_NEUTRAL[k])) && P.level === lv && P.arch === null,
      JSON.stringify(P));
  }
  check('cpuProfile: an unknown level is medium; a made profile passes through', S.cpuProfile('nope').level === 'medium' && S.cpuProfile(S.cpuProfile('hard')).level === 'hard');
  const pos = positions(24);
  const byName = pos.slice(0, 6).every((g, i) => same(S.cpuShot(g, 9 + i, 'hard'), S.cpuShot(g, 9 + i, S.cpuProfile('hard'))));
  check('a level\'s profile plays exactly the shots its name does', byName);

  /* ---- archetypes and the career's knobs ---- */
  const C = S.Career, cIds = C.ARCH.map(a => a.id);
  check('every career archetype has a CPU personality, and every personality is a career archetype',
    cIds.every(id => S.CPU_ARCH[id]) && Object.keys(S.CPU_ARCH).every(id => cIds.includes(id)), cIds.join());
  const knobs = ['noise', 'pnoise', 'snoise', 'riskBonus', 'safeBonus', 'safeBar', 'safe', 'minCos', 'position', 'look', 'posW', 'spin', 'brk', 'take', 'push', 'bank', 'kick', 'combo', 'think'];
  const all0 = S.cpuProfile({ level: 'medium', arch: 'allround' });
  const hill0 = S.cpuProfile({ level: 'medium', arch: 'allround' }, { hill: true });
  const differ = Object.keys(S.CPU_ARCH).filter(a => a !== 'allround').filter(a => {
    const P = S.cpuProfile({ level: 'medium', arch: a }), Q = S.cpuProfile({ level: 'medium', arch: a }, { hill: true });
    return knobs.some(k => !same(P[k], all0[k])) || Q.noise !== hill0.noise;
  });
  check('each archetype turns at least one search knob away from the all-rounder', differ.length === Object.keys(S.CPU_ARCH).length - 1, differ.join());
  const ATTR = C.ATTRS, at = v => Object.fromEntries(ATTR.map(a => [a, v]));
  const weak = C.aiProfileOf({ attrs: at(25), arch: 'grinder' }, 'medium'), strong = C.aiProfileOf({ attrs: at(90), arch: 'shotmaker' }, 'medium');
  const Pw = S.cpuProfile(weak), Ps = S.cpuProfile(strong);
  check('aiProfileOf carries the archetype, and cpuProfile takes it whole: its aim noise, archetype and level',
    weak.arch === 'grinder' && strong.arch === 'shotmaker' && Pw.arch === 'grinder' && Ps.arch === 'shotmaker' && Pw.noise === weak.aimNoise && Ps.noise === strong.aimNoise &&
    Pw.level === weak.level && Ps.level === strong.level && Ps.level === 'hard', JSON.stringify({ weak, strong }));
  check('noise scales with skill: a weak player errs more on angle, speed and tip offset', Pw.noise > 2 * Ps.noise && Pw.pnoise > Ps.pnoise && Pw.snoise > Ps.snoise,
    JSON.stringify([Pw.noise, Ps.noise, Pw.pnoise, Ps.pnoise, Pw.snoise, Ps.snoise]));
  const hillP = S.cpuProfile({ level: 'medium', arch: 'allround', hillNoise: 1.4 }, { hill: true }), clutchP = S.cpuProfile({ level: 'medium', arch: 'clutch', hillNoise: 1.4 }, { hill: true });
  check('on the hill the noise grows by hillNoise; the big-match player feels it far less', Math.abs(hillP.noise / S.CPU_LEVELS.medium.noise - 1.4) < 1e-9 && clutchP.noise < hillP.noise && clutchP.noise > S.CPU_LEVELS.medium.noise,
    JSON.stringify([hillP.noise, clutchP.noise]));

  /* ---- determinism and honesty ---- */
  const prof = { level: 'medium', arch: 'shotmaker' };
  check('determinism: the same game, seed and profile give the same shot', pos.slice(0, 5).every((g, i) => same(S.cpuShot(g, 40 + i, prof), S.cpuShot(g, 40 + i, prof))));
  let untouched = true, formed = true, live = true, bad = '';
  for (const arch of ARCHS) for (let i = 0; i < 2; i++) {
    const g = pos[(ARCHS.indexOf(arch) * 2 + i) % pos.length], before = JSON.stringify(g), s = S.cpuShot(g, 11 + i, { level: 'medium', arch });
    if (JSON.stringify(g) !== before) { untouched = false; bad = arch; }
    if (!wellFormed(g, s)) { formed = false; bad = arch; }
    /* the page's live path: strike, then stepTable to rest, against simulateShot */
    const g1 = g.inHand ? S.placeCue(g, s.place[0], s.place[1]) : g, tab = S.strike(S.newTable(g1.balls), s.angle, s.power, s.spin);
    for (let k = 0; k < 200000 && S.stepTable(tab); k++);
    if (JSON.stringify(S.resultOf(tab)) !== JSON.stringify(S.simulateShot(g1.balls, s))) { live = false; bad = arch; }
  }
  check('honesty: no personality changes the game it is given (byte for byte)', untouched, bad);
  check('honesty: every personality\'s shot is well formed (power 0-1, tip inside the ball, a legal placement only in hand)', formed, bad);
  check('honesty: each chosen shot played through strike/stepTable ends exactly as simulateShot says', live, bad);
  const brk = S.newGame('8'), bare = S.cpuShot(brk, 5, 'medium'), pers = [1, 2, 3, 4, 5, 6].map(sd => S.cpuShot(brk, sd, { level: 'medium', arch: 'allround' }));
  check('noise is on the cue only: a bare level breaks with the planned tip offset exactly, a person errs around it',
    bare.spin.x === 0 && bare.spin.y === -0.2 && pers.some(s => s.spin.x !== 0) && pers.every(s => Math.abs(s.spin.y + 0.2) < 0.2) && JSON.stringify(brk) === JSON.stringify(S.newGame('8')),
    JSON.stringify(pers.map(s => s.spin)));
  const easyK = C.aiProfileOf({ attrs: at(20) }, 'medium'), hardK = C.aiProfileOf({ attrs: at(95) }, 'medium');
  const spread = k => { const a = [1, 2, 3, 4, 5, 6, 7, 8].map(sd => S.cpuShot(brk, sd, k).spin.x); return Math.sqrt(mean(a.map(x => x * x))); };
  check('tip offset error scales with skill (break, 8 seeds)', spread(easyK) > 2 * spread(hardK), JSON.stringify([spread(easyK), spread(hardK)]));

  /* ---- calls: banks and combinations carry their flags ---- */
  const rails = S.makeRules('8', { call: { mode: 'all', detail: 'rails' } });
  const cpos = positions(30, '8', rails);
  const flagged = [];
  for (const [i, g] of cpos.entries()) for (const arch of ['banker', 'shotmaker']) {
    const s = S.cpuShot(g, 60 + i, { level: 'medium', arch });
    if (s.intent.type === 'bank' || s.intent.type === 'combo') flagged.push({ t: s.intent.type, call: s.call });
  }
  check('called shots (rails detail): every bank is called as a bank and every combination as one', flagged.length > 0 &&
    flagged.every(f => f.call && f.call.ball != null && f.call.pocket != null && (f.t === 'bank' ? f.call.bank === true && !f.call.combo : f.call.combo === true && !f.call.bank)),
    JSON.stringify(flagged.slice(0, 4)) + ` (${flagged.length})`);

  /* ---- options and the break ---- */
  let potTakes = 0, defTakes = 0, asked = 0;
  for (const g of pos) {
    const o = Object.assign({}, g, { option: { kind: 'push', who: g.turn } });
    asked++;
    if (S.cpuOption(o, { level: 'medium', arch: 'potter' }) === 'take') potTakes++;
    if (S.cpuOption(o, { level: 'medium', arch: 'defender' }) === 'take') defTakes++;
  }
  check('options: the potter takes a pushed table more often than the defender (same positions)', potTakes > defTakes && S.cpuOption(Object.assign({}, pos[0], { option: { kind: 'push', who: pos[0].turn } }), 'medium') !== null,
    `potter ${potTakes}, defender ${defTakes} of ${asked}`);
  const brkPow = arch => mean([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(sd => S.cpuShot(brk, sd, { level: 'medium', arch }).power));
  check('the breaker breaks harder than the defender (mean of 10 breaks)', brkPow('breaker') > brkPow('defender') + 0.02, JSON.stringify([brkPow('breaker'), brkPow('defender')]));

  /* ---- think time (F8) ---- */
  const g0 = pos[0], th = (type, q, p = 'medium', seed = 1, g = g0) => S.cpuThinkMs(g, { intent: { type, q } }, p, seed);
  const range = ['break', 'pot', 'bank', 'combo', 'safety', 'kick', 'push', 'blind', 'carom', 'bumper'].every(t => [0, 0.5, 1].every(q => [1, 2, 3].every(sd => { const m = th(t, q, 'medium', sd); return m >= 350 && m <= 3500; })));
  check('think time: always 0.35 to 3.5 s, and the same for the same seed', range && th('pot', 0.4) === th('pot', 0.4) && S.cpuThinkMs(g0, {}, 'hard', 3) >= 350);
  check('think time: an obvious pot is quick, a hard pot slower, a safety slower still', th('pot', 0.98) < 900 && th('pot', 0.98) < th('pot', 0.2) && th('pot', 0.98) < th('safety', 0),
    JSON.stringify([th('pot', 0.98), th('pot', 0.2), th('safety', 0)]));
  const brkT = S.cpuThinkMs(brk, { intent: { type: 'break', q: 1 } }, 'medium', 1);
  check('think time: the break is brief; ball in hand adds a little', brkT < 1200 && th('pot', 0.5, 'medium', 1, Object.assign({}, g0, { inHand: 'table' })) > th('pot', 0.5), String(brkT));
  check('think time: the grinder and the defender take longer than the potter over the same shot', th('pot', 0.5, { arch: 'grinder' }) > th('pot', 0.5, { arch: 'potter' }) && th('safety', 0, { arch: 'defender' }) > th('safety', 0, { arch: 'potter' }));
  /* ---- every game kind takes a profile ---- */
  const kinds = [];
  S.setTable('bumper', 'octagon');
  { const g = S.newGame('bumper'), s = S.cpuShot(g, 3, { level: 'hard', arch: 'potter' }); kinds.push(['bumper', !!s && Number.isFinite(s.angle) && s.ball != null && s.intent.type === 'bumper']); }
  const cg = S.caromGame();
  { const s = S.cpuShot(cg, 3, { level: 'easy', arch: 'grinder' }); kinds.push(['carom', !!s && Number.isFinite(s.angle) && s.intent.type === 'carom']); }
  const sg = S.snookerGame();
  { const s = S.cpuShot(sg, 3, { level: 'medium', arch: 'defender' }); kinds.push(['snooker', wellFormed(sg, s)]); }
  const rec = S.cpuRecord(S.cpuProfile({ level: 'medium', arch: 'grinder', aimNoise: 0.008, powerNoise: 0.06 }), 'carom');
  kinds.push(['carom noise scale', Math.abs(rec.noise / S.CPU_CAROM.medium.noise - 2) < 1e-9 && S.cpuRecord(S.cpuProfile('hard'), 'carom') === S.CPU_CAROM.hard]);
  const snk = S.cpuRecord(S.cpuProfile({ level: 'hard', arch: 'defender' }), 'snooker');
  kinds.push(['snooker keeps the extra safeties', snk.sims === S.SNK_CPU.hard.sims && snk.safe === S.SNK_CPU.hard.safe + 6]);
  S.setTable('7');
  check('every game kind plays from a profile (bumper, carom, snooker; noise scaled, snooker\'s lean levels kept)', kinds.every(k => k[1]), JSON.stringify(kinds));

  /* ---- the sweeps and the games ---- */
  const res = await pending, sw = Object.fromEntries(res.filter(r => r.arch).map(r => [r.arch, r]));
  const safeRate = a => ((sw[a].types.safety || 0) + (sw[a].types.kick || 0) + (sw[a].types.push || 0)) / NPOS;
  const table = Object.values(sw).map(r => `${r.arch} ${JSON.stringify(r.types)} meanQ ${mean(r.q).toFixed(3)} kept ${r.kept} think ${Math.round(r.think / NPOS)}`).join('\n    ');
  console.log(`    ${table}`);
  check('the defender plays the most safeties, the potter and shotmaker fewer than the all-rounder',
    Object.keys(sw).every(a => safeRate('defender') >= safeRate(a)) && safeRate('defender') > safeRate('allround') + 0.05 && safeRate('potter') < safeRate('allround') && safeRate('shotmaker') < safeRate('allround'),
    ARCHS.filter(a => sw[a]).map(a => `${a} ${safeRate(a).toFixed(2)}`).join(', '));
  check('the shotmaker attempts harder pots (a lower mean chance per attempt) than the all-rounder and the defender',
    mean(sw.shotmaker.q) < mean(sw.allround.q) - 0.05 && mean(sw.shotmaker.q) < mean(sw.defender.q) - 0.05, `${mean(sw.shotmaker.q).toFixed(3)} vs ${mean(sw.allround.q).toFixed(3)}, ${mean(sw.defender.q).toFixed(3)}`);
  check('only the bank-minded play banks, only the risk takers combinations',
    (sw.banker.types.bank || 0) >= 3 && (sw.shotmaker.types.bank || 0) >= 1 && ['allround', 'defender', 'grinder', 'positional'].every(a => !sw[a].types.bank && !sw[a].types.combo) && (sw.shotmaker.types.combo || 0) + (sw.potter.types.combo || 0) >= 3,
    JSON.stringify(Object.fromEntries(Object.values(sw).map(r => [r.arch, [r.types.bank || 0, r.types.combo || 0]]))));
  check('pace: over the same positions the positional player and the grinder think longer than the potter', sw.positional.think > sw.potter.think && sw.grinder.think > sw.potter.think,
    JSON.stringify(Object.fromEntries(Object.values(sw).map(r => [r.arch, Math.round(r.think / NPOS)]))));
  const he = res.filter(r => r.tag === 'he'), hw = he.filter(r => r.winner === r.hard).length;
  check(`hard beats easy over ${he.length} racks of 8 and 9-ball (personalities on both sides)`, hw >= Math.ceil(he.length * 0.7) && he.every(r => !r.bad), `${hw}/${he.length}`);
  const mix = res.filter(r => r.tag === 'mix');
  check('personalities against each other always finish (no endless safety exchange)', mix.every(r => r.winner !== null && !r.bad), JSON.stringify(mix.map(r => [r.profs.map(p => p.arch).join('-'), r.shots, r.winner])));
  /* the slicing, measured once the worker threads are done (they share the cores): no
     personality adds a long step between yields to what the bare level already has, the same
     positions searched in turn by each, the step's wall time compared with the bare hard level's */
  const steps = {}, turns = {};
  const ipos = pos.slice(0, 8).concat([Object.assign(S.copyGame(pos[1]), { inHand: 'table' })]);
  const PROFS = { hard: 'hard', shotmaker: { level: 'hard', arch: 'shotmaker' }, banker: { level: 'hard', arch: 'banker' }, defender: { level: 'hard', arch: 'defender' } };
  for (let rep = 0; rep < 2; rep++) for (const [i, g] of ipos.entries()) for (const [name, p] of Object.entries(PROFS)) {
    const it = S.cpuSearch(g, i, p), a0 = performance.now(), st = [];
    for (;;) { const a = performance.now(), r = it.next(); st.push(performance.now() - a); if (r.done) break; }
    if (rep) { (steps[name] = steps[name] || []).push(...st); turns[name] = Math.max(turns[name] || 0, performance.now() - a0); }
  }
  const p99 = a => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length * 0.99)]; };
  const sl = Object.fromEntries(Object.keys(PROFS).map(k => [k, +p99(steps[k]).toFixed(1)]));
  check('the search is sliced: a personality\'s steps between yields are as short as the bare level\'s (99th percentile within 2x + 5 ms; the page runs 12 ms of steps a frame)',
    Object.keys(PROFS).every(k => sl[k] <= 2 * sl.hard + 5), JSON.stringify({ p99ms: sl, maxTurnMs: Object.fromEntries(Object.entries(turns).map(([k, v]) => [k, Math.round(v)])) }));
  console.log(`    ${Date.now() - t0} ms`);
  done();
})();
