/* career2-check (Node, plus one page check): the career engine (section 1z, `Career`), loaded
   with the sim by tests/sim.cjs. Determinism; the player's profile; the AI population and its
   knobs; every tournament format's bracket (byes, advancement, the losers bracket and its reset,
   round robin tiebreaks, groups, leagues, series, qualifiers); the calendar and its rules data;
   registration, qualification and clashes; fees and prizes to the credit; time that only moves
   on request, with other players' matches played once and kept; rankings (52-week window, the
   local reset); promotion and relegation; rivals and challenges; sponsors; stats with exact
   denominators; season rollover, aging, retirement, new players and the Hall of Fame; the
   player's retirement and a new career; ten seasons auto-played with a save and load after every
   event; the v1 ladder migration; corruption detected and recovered; several slots. Last, the
   page: boot keeps a copy of the v1 record and the engine runs there. */
'use strict';
const fs = require('fs');
const path = require('path');
const { check, done, open } = require('./lib.cjs');
const { loadSim } = require('./sim.cjs');

/* a localStorage stand-in: counts chars, can be told to fail writes to a key */
function memStore() {
  const m = new Map();
  const st = {
    m, failOn: null,
    getItem: k => m.has(k) ? m.get(k) : null,
    setItem: (k, v) => { if (st.failOn && st.failOn(k)) throw new Error('QuotaExceededError'); m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    chars: () => [...m].reduce((s, [k, v]) => s + k.length + v.length, 0),
  };
  return st;
}
/* a fresh engine (its own vm context) on its own store */
function fresh() { const sim = loadSim(), C = sim.Career, store = memStore(); C.useStore(store); return { C, store, sim }; }
/* the auto player: plays every due match through the model, takes offers, enters the soonest
   event it may, then moves a week. onEvent runs after each event of the player's ends. */
function auto(C, weeks, onEvent) {
  let matches = 0, events = 0;
  const end = C.now().day + weeks * 7;
  while (C.now().day < end && !C.now().retired) {
    while (C.nextMatch()) { const r = C.simMatch(); if (!r.ok) throw new Error('simMatch: ' + JSON.stringify(r)); matches++; if (r.eventDone) { events++; if (onEvent) onEvent(); } }
    for (const o of C.offers()) { if (o.type !== 'sponsor' || C.sponsors().active.length < 2) C.accept(o.id); }
    const av = C.availableEvents().filter(e => e.eligibility.ok).sort((a, b) => a.start - b.start || b.tier - a.tier || (a.id < b.id ? -1 : 1));
    if (av.length && av[0].start - C.now().day < 10) C.enter(av[0].id);
    const r = C.advance(Math.min(7, end - C.now().day));
    if (!r.ok) throw new Error('advance: ' + JSON.stringify(r));
  }
  return { matches, events };
}
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const T0 = Date.now();
  /* ---------- the region: DOM-free and clock-free ---------- */
  {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const reg = html.slice(html.indexOf('// #region career'), html.indexOf('// #endregion career'));
    const code = reg.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const bad = ['Math.random(', 'Date.', 'new Date', 'performance.', 'document.', 'window.', 'localStorage.', 'setTimeout('].filter(s => code.includes(s));
    check('the career region uses no clock, no Math.random, no DOM and no localStorage of its own', reg.length > 20000 && bad.length === 0, JSON.stringify(bad));
    check('the region sits right after the sim region and carries its header comment', html.indexOf('// #region career') > html.indexOf('// #endregion sim') && reg.includes('THE CAREER ENGINE') && !reg.includes('\u2014'));
  }

  /* ---------- creating and editing the player ---------- */
  {
    const { C } = fresh();
    const r = C.create({ name: 'Zac Example', nick: 'Zed', nat: 'GB', town: 'Leeds', hand: 'left', cue: 'cue-house', disc: '9', style: 'potter', difficulty: 'hard', start: 'skilled', age: 24, avatar: { col: '#123abc' } }, { seed: 5 });
    const p = C.profile(), me = C.me();
    check('create: a slot, the profile as given, initials for the avatar', r.ok && r.id === 'c1' && p.name === 'Zac Example' && p.nick === 'Zed' && p.nat === 'GB' && p.hand === 'left' && p.disc === '9' && p.style === 'potter' && p.avatar.ini === 'ZE' && p.avatar.col === '#123abc' && p.age === 24, JSON.stringify(p));
    check('create: the start sets tier, money and skills (skilled: tier 2, 400 cr, 45); hard means simulation purity on', me.tier === 2 && me.money === 400 && Object.values(me.sk).every(v => v === 45) && me.opt.purity === true, JSON.stringify([me.tier, me.money, me.opt]));
    C.advance(30);
    const strip = s => { const o = JSON.parse(s); delete o.profile; return JSON.stringify(o); };
    const before = strip(C.snapshot());
    const e = C.editProfile({ name: 'Zac Renamed', nat: 'IE', difficulty: 'easy', start: 'novice', age: 60, hand: 'sideways', avatar: { ini: 'zr', col: 'blue' } });
    check('edit: name, nationality and difficulty change; start, age and an unknown hand do not; the colour stays', e.name === 'Zac Renamed' && e.nat === 'IE' && e.difficulty === 'easy' && e.start === 'skilled' && e.age === 24 && e.hand === 'left' && e.avatar.ini === 'ZR' && e.avatar.col === '#123abc', JSON.stringify(e));
    check('edit: nothing but the profile changes (progress is untouched)', strip(C.snapshot()) === before);
    const { C: C2 } = fresh();
    C2.create({ name: '   ', nat: 'XX', hand: 'both', disc: 'pool', difficulty: 'insane', age: 5, start: 'legend', avatar: { col: 'red' } }, { seed: 6 });
    const q = C2.profile();
    check('create: bad input falls back (Player, US, right, 8-ball, medium, amateur, age 20, a palette colour)', q.name === 'Player' && q.nat === 'US' && q.hand === 'right' && q.disc === '8' && q.difficulty === 'medium' && q.start === 'amateur' && q.age === 20 && /^#[0-9a-f]{6}$/i.test(q.avatar.col) && C2.me().opt.purity === false, JSON.stringify(q));
    C2.editProfile({ name: 'x'.repeat(40) });
    check('edit: a long name is cut to 24 characters', C2.profile().name.length === 24);
  }

  /* ---------- the population ---------- */
  {
    const { C } = fresh();
    C.create({ name: 'Pop Check' }, { seed: 77 });
    const pop = C.population(), names = new Set(pop.map(p => p.name));
    check('population: 300 active AI players, every name distinct', pop.length === 300 && names.size === 300, `${pop.length} ${names.size}`);
    const attrs = pop.flatMap(p => Object.values(p.attrs));
    const mean = a => sum(pop, p => p.attrs[a]) / pop.length;
    check('population: attributes are whole numbers 1-99, means believable (accuracy 25-75)', attrs.every(v => Number.isInteger(v) && v >= 1 && v <= 99) && mean('acc') > 25 && mean('acc') < 75, mean('acc').toFixed(1));
    const archs = new Set(pop.map(p => p.arch)), nats = new Set(pop.map(p => p.nat)), discs = new Set(pop.map(p => p.disc));
    check('population: at least 7 archetypes, 12 nationalities, 5 preferred disciplines', archs.size >= 7 && nats.size >= 12 && discs.size >= 5, `${archs.size} ${nats.size} ${discs.size}`);
    const byT = {};
    for (const p of pop) (byT[p.tier] = byT[p.tier] || []).push(p.rating);
    const quotas = [44, 38, 34, 30, 28, 26, 24, 22, 20, 18, 16];
    check('population: tiers 1-11 filled to their quotas', quotas.every((q, i) => (byT[i + 1] || []).length === q), JSON.stringify(Object.fromEntries(Object.entries(byT).map(([t, a]) => [t, a.length]))));
    const avg = t => sum(byT[t], x => x) / byT[t].length;
    check('population: ratings rise with the tier (1 < 6 < 11)', avg(1) < avg(6) && avg(6) < avg(11), [avg(1), avg(6), avg(11)].map(v => v.toFixed(1)).join(' '));
    const ages = pop.map(p => p.age);
    check('population: ages 17-53, each player with a career record, history and town', Math.min(...ages) >= 17 && Math.max(...ages) <= 53 && pop.every(p => typeof p.town === 'string' && p.w === 0 && Array.isArray(p.history)), `${Math.min(...ages)}-${Math.max(...ages)}`);
    const { C: D } = fresh();
    D.create({ name: 'Pop Check' }, { seed: 77 });
    check('population: the same seed generates the same players', eq(D.population().map(p => [p.name, p.attrs, p.arch]), pop.map(p => [p.name, p.attrs, p.arch])));
    const pl = C.player(pop[0].id);
    check('player(id): the card, the AI knobs and its ranks per circuit', pl && pl.ai && typeof pl.ai.aimNoise === 'number' && ['easy', 'medium', 'hard'].includes(pl.ai.level) && 'local' in pl.ranks);
  }

  /* ---------- AI knobs: aiProfileOf and levelOf ---------- */
  {
    const { C, sim } = fresh();
    const at = v => ({ acc: v, cb: v, brk: v, safe: v, bank: v, tac: v, agg: 50, con: v, pres: v });
    const lv = [20, 55, 92].map(v => C.aiProfileOf(at(v), 'medium').level);
    check('aiProfileOf: weak, middling and strong attributes map to easy, medium and hard', eq(lv, ['easy', 'medium', 'hard']), lv.join());
    const L = sim.CPU_LEVELS, back = ['easy', 'medium', 'hard'].map(k => C.levelOf({ aimNoise: L[k].noise, breadth: { easy: 0.25, medium: 0.55, hard: 0.9 }[k] }));
    check('levelOf: each existing CPU level\'s own noise maps back to it', eq(back, ['easy', 'medium', 'hard']), back.join());
    const k = C.aiProfileOf(at(60), 'medium'), ke = C.aiProfileOf(at(60), 'easy');
    const inR = v => v >= 0 && v <= 1;
    check('aiProfileOf: knobs in range, easy difficulty 1.5 times the aim noise', inR(k.breadth) && inR(k.safetyBias) && inR(k.riskTolerance) && inR(k.positionWeight) && inR(k.bankWeight) && k.hillNoise >= 1 && k.breakChoice.power >= 0.8 && Math.abs(ke.aimNoise / k.aimNoise - 1.5) < 0.01, JSON.stringify(k));
  }

  /* ---------- brackets ---------- */
  {
    const { C } = fresh(), L = C.lib;
    const field = n => [...Array(n)].map((_, i) => 101 + i);
    const fav = (a, b) => a < b ? [3, 1] : [1, 3];      /* the better seed always wins */
    const played = r => r.outcomes.filter(o => o.st === 'done').length;
    const place = (r, id) => (r.placings.find(x => x[0] === id) || [])[1];
    let r = L.runBracket('single', field(16), {}, fav);
    check('single elimination, 16: 15 matches, seed 1 champion, seed 2 runner-up, semi-finalists share 3rd, quarter-finalists 5th', r.complete && played(r) === 15 && place(r, 101) === 1 && place(r, 102) === 2 && place(r, 103) === 3 && place(r, 104) === 3 && place(r, 105) === 5 && place(r, 116) === 9);
    r = L.runBracket('single', field(13), {}, fav);
    const byes = r.outcomes.filter(o => o.st === 'bye');
    check('single elimination, 13: three byes, to the top three seeds; 12 matches; all 13 placed', r.complete && byes.length === 3 && eq(byes.map(o => o.w).sort(), [101, 102, 103]) && played(r) === 12 && r.placings.length === 13 && place(r, 101) === 1);
    r = L.runBracket('single', field(8), {}, (a, b) => a === 108 ? [3, 1] : b === 108 ? [1, 3] : fav(a, b));
    check('single elimination: an upset carries the winner on (seed 8 beats everyone and wins)', place(r, 108) === 1 && place(r, 101) === 5);
    r = L.runBracket('double', field(8), {}, fav);
    const losses = res => { const m = new Map(); for (const o of res.outcomes) if (o.st === 'done') m.set(o.l, (m.get(o.l) || 0) + 1); return m; };
    let ls = losses(r);
    const gf2 = r.outcomes[r.outcomes.length - 1];
    check('double elimination, 8: 14 matches, no reset needed, seed 1 champion, seed 2 second', r.complete && played(r) === 14 && gf2.st === 'skip' && place(r, 101) === 1 && place(r, 102) === 2);
    check('double elimination: every player but the champion is out after exactly two losses', field(8).every(id => id === 101 ? !ls.get(id) : ls.get(id) === 2), JSON.stringify([...ls]));
    check('double elimination: the losers bracket fills places 3-8 (3, 4, 5-6, 7-8)', place(r, 103) === 3 && place(r, 104) === 4 && place(r, 105) === 5 && place(r, 106) === 5 && place(r, 107) === 7 && place(r, 108) === 7, JSON.stringify(r.placings));
    const T8 = L.makeBracket('double', 8), gf = T8.M.findIndex(x => x.br === 'G');
    r = L.runBracket('double', field(8), {}, (a, b, m) => m === gf ? [1, 3] : fav(a, b));
    ls = losses(r);
    check('double elimination: the losers-bracket winner takes the grand final, so it is reset and played again', r.outcomes[gf + 1].st === 'done' && place(r, 101) === 1 && ls.get(101) === 1 && ls.get(r.outcomes[gf].b) === 2, JSON.stringify(r.outcomes[gf + 1]));
    r = L.runBracket('double', field(6), {}, fav);
    check('double elimination, 6 (two byes): complete, all 6 placed, seed 1 champion', r.complete && r.placings.length === 6 && place(r, 101) === 1 && r.outcomes.some(o => o.st === 'bye'));
    r = L.runBracket('rr', field(5), {}, fav);
    const games = id => r.outcomes.filter(o => o.st === 'done' && (o.a === id || o.b === id)).length;
    check('round robin, 5 (odd: a bye each round): 10 matches, each player plays 4, the table by wins', r.complete && played(r) === 10 && field(5).every(id => games(id) === 4) && eq(r.placings.map(x => x[0]), field(5)));
    /* tiebreaks: three level on wins, each beat one of the others, so head to head is level too:
       rack difference decides; then two level where head to head decides over racks */
    const g = (a, b, sa, sb) => ({ a, b, s: [sa, sb], w: sa > sb ? a : b });
    let rows = L.standings([1, 2, 3, 4], [g(1, 2, 5, 4), g(2, 3, 5, 0), g(3, 1, 5, 3), g(1, 4, 5, 0), g(2, 4, 5, 1), g(3, 4, 5, 4)], p => p);
    check('round robin tiebreaks: a three-way tie, head to head level, goes to rack difference (2, 1, 3, then 4)', eq(rows.map(x => x.p), [2, 1, 3, 4]), JSON.stringify(rows.map(x => [x.p, x.w, x.h, x.rf - x.ra])));
    rows = L.standings([1, 2, 3], [g(1, 2, 5, 4), g(3, 1, 5, 0), g(2, 3, 5, 0)], p => p);
    check('round robin tiebreaks: everyone on one win and level head to head: rack difference decides', eq(rows.map(x => x.p), [2, 3, 1]), JSON.stringify(rows));
    rows = L.standings([1, 2, 3, 4], [g(1, 2, 5, 4), g(1, 3, 0, 5), g(2, 3, 5, 0), g(2, 4, 5, 0), g(1, 4, 5, 4), g(3, 4, 0, 5)], p => p);
    check('round robin tiebreaks: two level on wins: head to head beats a better rack difference', rows[0].p === 1 && rows[1].p === 2, JSON.stringify(rows.map(x => [x.p, x.w, x.h, x.rf - x.ra])));
    r = L.runBracket('groups', field(16), { groups: 4 }, fav);
    const T = r.T, ko = T.M.map((x, m) => [x, r.outcomes[m]]).filter(([x]) => x.br === 'K'), firstKo = ko.filter(([x]) => x.rd === ko[0][0].rd);
    const groupOf = id => T.groups.findIndex(gr => gr.includes(id - 101));
    check('groups then knockout, 16 in 4 groups: 24 group games, 7 knockout matches, seed 1 champion', r.complete && T.M.filter(x => x.br === 'P').length === 24 && ko.length === 7 && place(r, 101) === 1);
    check('groups then knockout: no first knockout match pairs two from the same group (winners meet runners-up)', firstKo.length === 4 && firstKo.every(([, o]) => groupOf(o.a) !== groupOf(o.b)), JSON.stringify(firstKo.map(([, o]) => [o.a, o.b])));
    const thirds = T.groups.map(gr => r.placings.find(x => x[0] === 101 + gr[2])[1]);
    check('groups then knockout: those out in the groups place after the knockout, group thirds level', thirds.every(p => p === thirds[0] && p > 8), JSON.stringify(thirds));
    r = L.runBracket('league', field(6), {}, fav);
    const pairs = new Map();
    for (const o of r.outcomes) { const k = [o.a, o.b].sort().join(); pairs.set(k, (pairs.get(k) || []).concat([o.a])); }
    check('league, 6: a double round robin, 30 matches, each pair twice with the sides swapped', r.complete && played(r) === 30 && pairs.size === 15 && [...pairs.values()].every(v => v.length === 2 && v[0] !== v[1]));
    r = L.runBracket('series', [201, 202], { legs: 3 }, fav);
    check('best-of-3 series: 2-0 decides it, the third leg is not played', r.complete && played(r) === 2 && r.outcomes[2].st === 'skip' && eq(r.placings, [[201, 1], [202, 2]]));
    let n = 0;
    r = L.runBracket('series', [201, 202], { legs: 5 }, () => (n++ % 2 ? [1, 3] : [3, 1]));
    check('best-of-5 series: alternating legs go the distance, 3-2', played(r) === 5 && place(r, 201) === 1);
    r = L.runBracket('qualifier', field(32), { slots: 4 }, fav);
    const q = r.placings.filter(x => x[1] === 1).map(x => x[0]);
    check('qualifier, 32 to 4 places: 28 matches, the four qualifiers share first', r.complete && played(r) === 28 && eq(q.sort(), [101, 102, 103, 104]));
    const so = L.seedOrder(8);
    check('seeding: 1 meets 8, 4 meets 5, 2 meets 7, 3 meets 6; 1 and 2 only in the final', eq(so, [1, 8, 4, 5, 2, 7, 3, 6]));
  }

  /* ---------- the calendar and its rules data ---------- */
  let C1, store1;
  {
    ({ C: C1, store: store1 } = fresh());
    C1.create({ name: 'Cal Check', nat: 'US', start: 'amateur' }, { seed: 99 });
    const cal = C1.calendar(), evs = cal.events;
    const inSeason = evs.every(e => e.start >= 0 && e.end < 364 && e.dl < e.start && e.end >= e.start);
    check('calendar: one season of events, each inside it, its deadline before its start', evs.length >= 40 && inSeason, evs.length);
    check('calendar: ids unique; series with two editions half a season apart', new Set(evs.map(e => e.id)).size === evs.length && evs.filter(e => e.ed === 1).every(e => { const a = evs.find(x => x.ser === e.ser && x.ed === 0); return e.start - a.start >= 70; }));
    const fmts = new Set(evs.map(e => e.fmt)), kinds = new Set(evs.map(e => e.kind));
    check('calendar: every format (single, double, round robin, groups, league, qualifier) and kind (open, league, qualifier, championship, major, invitational, finals)', ['single', 'double', 'rr', 'groups', 'league', 'qualifier'].every(f => fmts.has(f)) && ['open', 'league', 'qualifier', 'championship', 'major', 'invitational', 'finals'].every(k => kinds.has(k)), [...fmts, ...kinds].join());
    const lg = evs.find(e => e.fmt === 'league');
    check('calendar: a league is ten weekly match nights, finals are in week 50', lg.occupies.length === 10 && lg.occupies.every(([a, b], i) => a === b && a === lg.start + 7 * i) && evs.filter(e => e.kind === 'finals').every(e => e.week === 50));
    const qs = evs.filter(e => e.tgt);
    check('calendar: a qualifier comes before the event it feeds', qs.length > 0 && qs.every(e => evs.find(x => x.id === e.tgt).start > e.end));
    const R = C1.RULESETS, ok = e => e.rules && C1.DISCS.includes(e.rules.game) && R[e.rules.ruleset] && R[e.rules.ruleset].game === e.rules.game && ['off', '8ball', 'official', 'all'].includes(e.rules.call.require)
      && ['ball', 'pocket', 'rails', 'strict'].includes(e.rules.call.detail) && Number.isInteger(e.rules.race) && e.rules.race > 0 && e.race === e.rules.race && typeof e.rules.table === 'string' && typeof e.rules.pockets === 'string';
    check('rules data: { game, ruleset, call { require, detail }, race, table, pockets } on every event, the ruleset of its game', evs.every(ok), JSON.stringify(evs.find(e => !ok(e))));
    const pool = e => ['8', '9', '10', 'rotation'].includes(e.disc);
    check('called shots tighten: amateur tiers relaxed (off or the 8 only), leagues from tier 3 call everything, tier 6 up official', evs.filter(e => pool(e) && e.tier <= 2).every(e => ['off', '8ball'].includes(e.rules.call.require))
      && evs.filter(e => e.kind === 'league' && e.tier >= 3).every(e => e.rules.call.require === 'all') && evs.filter(e => pool(e) && e.tier >= 6 && !e.rules.custom).every(e => ['official', 'all'].includes(e.rules.call.require)));
    const elite = evs.filter(e => e.rules.custom);
    check('an elite invitational is labelled a custom format, strict calls', elite.length >= 1 && elite.every(e => e.kind === 'invitational' && e.tier === 11 && e.rules.call.detail === 'strict' && /Custom format/.test(e.rules.custom)));
    check('snooker, carom and bumper events call nothing (their own rules govern)', evs.filter(e => ['snooker', 'carom', 'bumper'].includes(e.disc) && !e.rules.custom).every(e => e.rules.call.require === 'off'));
    check('money: ranking events have a purse; invitations and finals are free to enter; one tier-1 series is a free roll', evs.filter(e => e.kind !== 'qualifier').every(e => e.purse > 0) && evs.filter(e => ['invitational', 'finals'].includes(e.kind)).every(e => e.fee === 0) && evs.some(e => e.tier === 1 && e.fee === 0));
  }

  /* ---------- registration, qualification, clashes, fees ---------- */
  {
    const C = C1;
    const av = C.availableEvents(), okEv = av.filter(e => e.eligibility.ok).sort((a, b) => a.start - b.start)[0];
    const m0 = C.now().money, r = C.enter(okEv.id);
    check('enter: an eligible event, the fee and travel paid', r.ok && C.now().money === m0 - okEv.fee - okEv.trav && C.event(okEv.id).entered, JSON.stringify(r));
    check('enter: twice refused', !C.enter(okEv.id).ok && C.eligibility(okEv.id).why.includes('already entered'));
    const hi = C.calendar().events.find(e => e.req.min > C.now().tier && !e.req.qual);
    check('enter: a tier too high is refused with the reason', !C.enter(hi.id).ok && C.eligibility(hi.id).why.some(w => /tier \d+ and up/.test(w)));
    const clash = C.calendar().events.find(e => e.id !== okEv.id && e.occupies.some(([a, b]) => C.event(okEv.id).occupies.some(([c, d]) => a <= d && c <= b)));
    check('calendar clash: an event over the same days cannot be entered', !!clash && C.eligibility(clash.id).why.some(w => w.startsWith('clashes with')), clash && clash.id);
    const inv = C.calendar().events.find(e => e.kind === 'invitational');
    check('invitations: only the circuit\'s top 8 may enter', C.eligibility(inv.id).why.some(w => w.startsWith('top 8')));
    const champ = C.calendar().events.find(e => e.kind === 'championship' && e.req.min > C.now().tier);
    const before = C.eligibility(champ.id).why.slice();
    C.lib.state().me.qual[champ.id] = 1;
    const after = C.eligibility(champ.id).why;
    check('qualification: a qualifier\'s place lifts the tier floor of the event it feeds', before.some(w => /and up/.test(w)) && !after.some(w => /and up/.test(w)), JSON.stringify([before, after]));
    delete C.lib.state().me.qual[champ.id];
    const other = C.availableEvents().filter(e => e.eligibility.ok && e.fee > 0).sort((a, b) => b.start - a.start)[0];
    const m1 = C.now().money;
    C.enter(other.id);
    const w = C.withdraw(other.id);
    check('withdraw before the deadline: the fee comes back, the travel does not', w.ok && C.now().money === m1 - other.trav && !C.event(other.id).entered);
    const st = C.lib.state(), keep = st.me.money;
    st.me.money = 0;
    check('enter: not enough credits is refused', C.eligibility(other.id).why.includes('not enough credits'));
    st.me.money = keep;
    /* play the entered event out: advance stops on the player's match, time waits for it */
    const a1 = C.advance(30);
    check('advance: stops on the day of the player\'s first match, which is due', a1.ok && a1.stopped === 'match' && a1.day === okEv.start && a1.match && a1.match.event === okEv.id, JSON.stringify([a1.stopped, a1.day, okEv.start]));
    const a2 = C.advance(30);
    check('advance: with a match due, time does not move', a2.stopped === 'match' && a2.day === a1.day);
    const nm = C.nextMatch();
    check('nextMatch: the opponent\'s card, AI knobs and a cpuSearch level, the rules and race, who breaks', nm.opponent && nm.opponent.name && nm.ai && ['easy', 'medium', 'hard'].includes(nm.level) && nm.rules.race === nm.race && [0, 1].includes(nm.breaker) && typeof nm.round === 'string');
    check('reportMatch: a bad score is refused', !C.reportMatch({ score: [nm.race, nm.race] }).ok && !C.reportMatch({ score: [1.5, 0] }).ok && !C.reportMatch({ score: [nm.race - 1, 0] }).ok);
    let guard = 0;
    while (C.event(okEv.id).status !== 'done' && guard++ < 150) { if (C.nextMatch()) C.simMatch(); else C.advance(1); }
    const b = C.bracket(okEv.id), ev = C.event(okEv.id), mine = b.placings.find(x => x[0] === C.HUMAN);
    const pays = C.lib.payouts(ev, b.placings), paid = [...pays.values()].reduce((s, v) => s + v, 0);
    const led = C.ledger(), prizeRow = led.recent.find(x => x[2] === 'prize' && x[3].startsWith(ev.name));
    check('event over: every player placed, the payouts add up to the purse exactly', ev.status === 'done' && b.placings.length === b.field.length && paid === ev.purse, `${paid} ${ev.purse}`);
    check('event over: the player\'s prize (if any) is what the payout table says, in the ledger', (pays.get(C.HUMAN) || 0) === (prizeRow ? prizeRow[1] : 0), JSON.stringify([mine, pays.get(C.HUMAN), prizeRow]));
    const t = led.totals;
    check('accounting: credits = start + prizes + sponsors + refunds + rewards - fees - travel - shop', led.money === t.start + (t.prize || 0) + (t.spons || 0) + (t.refund || 0) + (t.reward || 0) - (t.fee || 0) - (t.travel || 0) - (t.shop || 0), JSON.stringify(led.totals));
  }

  /* ---------- time: other matches played once, the same whichever way time is moved ---------- */
  {
    const run = how => { const { C } = fresh(); C.create({ name: 'Time Check' }, { seed: 31 }); how(C); return C; };
    const a = run(C => C.advance(60));
    const b = run(C => { C.advance(20); C.save(); C.load(C.id); C.advance(40); });
    const c = run(C => { for (let i = 0; i < 60; i++) C.advance(1); });
    check('advance: 60 days at once, 20 + save/load + 40, or a day at a time: the same career', a.digest() === b.digest() && a.digest() === c.digest(), [a.digest(), b.digest(), c.digest()].join());
    const doneEv = a.calendar().events.filter(e => e.status === 'done');
    const res = JSON.stringify(doneEv.map(e => a.bracket(e.id).matches.map(m => m.s)));
    a.advance(30);
    check('advance: every event over by now is done, its results kept as they were', doneEv.length > 3 && JSON.stringify(doneEv.map(e => a.bracket(e.id).matches.map(m => m.s))) === res && a.calendar().events.filter(e => e.end < a.now().day).every(e => ['done', 'cancelled'].includes(e.status)));
    const bad = a.advance('nowhere');
    check('advance: an unknown target is refused; time moves only on advance', !bad.ok);
  }

  /* ---------- determinism ---------- */
  {
    const play = seed => { const { C } = fresh(); C.create({ name: 'Det Check', start: 'amateur' }, { seed }); auto(C, 30); return C.digest(); };
    const d1 = play(1234), d2 = play(1234), d3 = play(4321);
    check('determinism: the same seed and the same actions give the same career (30 weeks auto-played)', d1 === d2, `${d1} ${d2}`);
    check('determinism: another seed, another career', d1 !== d3);
  }

  /* ---------- rankings ---------- */
  {
    const { C } = fresh();
    C.create({ name: 'Rank Check', start: 'amateur' }, { seed: 52 });
    C.advance(300);
    const reg = C.rankings('regional'), st = C.lib.state();
    check('rankings: a circuit\'s table, best first, ranks 1..n, points from its awards', reg.length > 10 && reg.every((x, i) => x.rank === i + 1 && (i === 0 || reg[i - 1].pts >= x.pts)) && reg[0].pts === sum(st.aw.filter(a => a[0] === reg[0].id && a[1] === 1), a => a[3]));
    check('rankings: per discipline too, and a movement figure', C.rankings('9').length > 0 && reg.every(x => x.move === null || Number.isInteger(x.move)));
    const aw = st.aw.find(a => a[1] === 2);
    check('rankings: points count for 52 weeks, then drop out', !!aw && (C.lib.points(2, aw[4] + 51).get(aw[0]) || 0) >= aw[3] && !((C.lib.points(2, aw[4] + 52).get(aw[0]) || 0) >= aw[3] && st.aw.filter(x => x[0] === aw[0] && x[1] === 2 && x[4] > aw[4]).length === 0));
    const localBefore = C.rankings('local').length;
    C.advance('season');
    check('rankings: the local circuit starts again each season; the others roll on', localBefore > 10 && C.rankings('local').length === 0 && C.rankings('regional').length > 10, `${localBefore} ${C.rankings('local').length}`);
    check('rankings: the save keeps only the last 52 weeks of awards', C.lib.state().aw.every(a => a[4] > Math.floor(C.now().day / 7) - 52));
  }

  /* ---------- season rollover, promotion and relegation ---------- */
  {
    const { C } = fresh();
    C.create({ name: 'Season Check', start: 'skilled' }, { seed: 61 });
    const st = C.lib.state();
    st.ss.tt = st.me.tier;
    C.advance('season');
    const s1 = C.records().seasons[0];
    check('season over: a summary archived, a title at your tier promotes (2 to 3)', C.now().season === 2 && s1.s === 1 && s1.t0 === 2 && s1.t1 === 3 && s1.moved === 'up' && C.now().tier === 3, JSON.stringify(s1));
    check('season over: a new calendar (season 2 ids), the season counters reset', C.calendar().events.every(e => e.id.startsWith('2.')) && C.stats().season.m === 0 && Object.keys(C.lib.state().es).every(k => k.startsWith('2.')));
    const st2 = C.lib.state();
    st2.me.tier = 7; st2.ss.tt = 7; st2.me.card = 0;
    C.advance('season');
    check('promotion to tier 8 needs the tour card: a title alone keeps you at 7', C.now().tier === 7 && C.news().some(n => /tour card/.test(n[1])));
    const st3 = C.lib.state();
    st3.ss.tt = 7; st3.me.card = 8;
    C.advance('season');
    check('with the tour card, the title promotes to 8 (and the card is used up)', C.now().tier === 8 && C.lib.state().me.card === 0);
    C.lib.state().me.tier = 5;
    C.advance('season');
    check('a season without a match at tier 4 and up relegates one tier (5 to 4): setbacks happen', C.now().tier === 4 && C.records().seasons[3].moved === 'down');
    const tiersBefore = new Map(C.population().map(p => [p.id, p.tier]));
    C.advance('season');
    const moved = C.population().filter(p => tiersBefore.has(p.id) && tiersBefore.get(p.id) !== p.tier);
    check('AI players move between tiers each season, both ways, the quotas kept', moved.some(p => p.tier > tiersBefore.get(p.id)) && moved.some(p => p.tier < tiersBefore.get(p.id)) && C.population().filter(p => p.tier === 11).length === 16, moved.length);
  }

  /* ---------- sponsors ---------- */
  {
    const { C } = fresh();
    C.create({ name: 'Sponsor Check', start: 'skilled' }, { seed: 71 });
    const offers = C.sponsors().offers;
    check('sponsor offers: a tier-2 player gets offers with objectives, a duration and a retainer', offers.length >= 1 && offers.every(o => o.obj.length >= 2 && [26, 52].includes(o.weeks) && o.ret > 0 && o.obj.every(x => typeof x.text === 'string')), JSON.stringify(offers[0]));
    const o = offers[0];
    check('accept: the contract starts, objectives measured from now', C.accept(o.id).ok && C.sponsors().active.length === 1 && C.sponsors().active[0].obj.every(x => x.progress === 0 || x.k === 'rank'));
    const st = C.lib.state(), c = st.spons[0], obj = c.obj.find(x => x.k !== 'rank');
    const m0 = C.now().money;
    if (obj.k === 'wins' || obj.k === 'titles' || obj.k === 'finals' || obj.k === 'events') st.st.all[{ wins: 'w', titles: 'ti', finals: 'fi', events: 'ev' }[obj.k]] += obj.n;
    else { st.st.d[obj.d] = st.st.d[obj.d] || JSON.parse(JSON.stringify(st.st.all)); st.st.d[obj.d].w += obj.n; }
    C.advance('week');
    const led = C.ledger().recent.filter(x => x[2] === 'spons');
    check('an objective met pays its reward once; the retainer is paid weekly', obj.done > 0 && led.some(x => x[1] === obj.pay) && led.some(x => /retainer/.test(x[3])) && C.now().money >= m0 + obj.pay + c.ret, JSON.stringify(led));
    C.advance('week');
    check('...and the reward is not paid twice', C.ledger().recent.filter(x => x[2] === 'spons' && x[1] === obj.pay && x[3].includes(obj.k === 'disc' ? 'matches' : '')).length === 1);
    for (const x of c.obj) x.done = x.done || C.now().day;
    c.to = C.now().day + 1;
    const m1 = C.now().money;
    C.advance('week');
    const sp = C.sponsors();
    check('the contract ends on its date: every objective met pays the bonus; it moves to the past', sp.active.length === 0 && sp.past.length === 1 && sp.past[0][3] === sp.past[0][4] && C.now().money === m1 + c.bonus, JSON.stringify(sp.past));
  }

  /* ---------- practice, the shop, assistance ---------- */
  {
    const { C } = fresh();
    C.create({ name: 'Practice Check', difficulty: 'medium' }, { seed: 81 });
    const d0 = C.now().day, aim0 = C.me().sk.aim;
    const p1 = C.practice('long-pot', 92), p2 = C.practice('long-pot', 40), p3 = C.practice('stop-shot', 60), p4 = C.practice('bank-ladder', 70);
    check('practice: a gold milestone at 90 (record only), skill up a little, the clock still', p1.ok && p1.milestone === 'gold' && p2.ok && !p2.milestone && C.me().sk.aim > aim0 && C.now().day === d0 && C.stats().mastery['long-pot'].best === 92);
    check('practice: three sessions a day, then the next day', p3.ok && !p4.ok && (C.advance(1), C.practice('bank-ladder', 70).ok));
    check('practice: a bad drill or score is refused', !C.practice('juggling', 50).ok && !C.practice('long-pot', 101).ok);
    const shop = C.shop();
    check('shop: cosmetics only (no item has an effect), the free ones owned', shop.every(i => i.effect === 'none') && shop.filter(i => i.price === 0 && !i.need).every(i => i.owned));
    const m0 = C.now().money, chalk = shop.find(i => i.id === 'chalk-green');
    check('buy: the price paid, owned, equip it; too dear and Hall of Fame items refused', C.buy('chalk-green').ok && C.now().money === m0 - chalk.price && C.equip('chalk-green').ok && C.shop().find(i => i.id === 'chalk-green').equipped && !C.buy('cue-gold').ok && !C.buy('cue-legacy').ok && !C.buy('chalk-green').ok);
    const off = C.assist();
    check('assist: purity off (medium, new player): guide, auto aim and execution variance from the skills', off.purity === false && off.guide === 'short' && off.autoAim === false && off.aimNoise > 0 && Math.abs(off.aimNoise - 0.004 * (1 - C.me().sk.aim / 100)) < 1e-4 && off.hillNoise > 1, JSON.stringify(off));
    C.setOptions({ purity: true });
    const on = C.assist();
    check('assist: simulation purity on: skills are record only (no guide override, no variance)', on.purity && on.aimNoise === 0 && on.powerNoise === 0 && on.guide === null && on.hillNoise === 1);
    C.setOptions({ purity: false, variance: false });
    check('assist: variance off keeps the assistance and drops the jitter', C.assist().aimNoise === 0 && C.assist().guide === 'short');
    check('skill effects are documented for every skill', C.SKILLS.every(k => typeof C.SKILL_EFFECTS[k] === 'string' && C.SKILL_EFFECTS[k].length > 20));
  }

  /* ---------- stats with exact denominators; rivals; challenges ---------- */
  {
    const { C } = fresh();
    C.create({ name: 'Stats Check', start: 'amateur', disc: '8' }, { seed: 91 });
    const r = auto(C, 104);
    const s = C.stats(), a = s.all, by = Object.values(s.byDisc);
    check(`stats: ${r.matches} matches auto-played over two seasons; won + lost = matches, per discipline adds up`, r.matches > 60 && a.won + a.lost === a.matches && a.winPct.d === a.matches && sum(by, x => x.matches) === a.matches && sum(by, x => x.won) === a.won && sum(by, x => x.titles) === a.titles, JSON.stringify(a.winPct));
    check('stats: break and run and legal break share one denominator (breaks); runouts are out of racks', a.breakAndRun.d === a.legalBreak.d && a.breakAndRun.d > 0 && a.runout.d >= a.breakAndRun.d && a.breakAndRun.n <= a.legalBreak.n && a.racks.won + a.racks.lost >= a.runout.d);
    check('stats: shots, calls and safeties: made never more than tried; percentages from n and d', [a.shotAccuracy, a.calledShot, a.safety].every(p => p.n <= p.d && (p.d === 0 ? p.pct === null : Math.abs(p.pct - Math.round(1000 * p.n / p.d) / 10) < 1e-9)) && a.shotAccuracy.d > 0);
    const h2h = C.lib.state().h2h;
    check('head to head: the meetings add up to the matches played', sum(Object.values(h2h), h => h[0] + h[1]) === a.matches);
    const rv = C.rivals();
    check('rivals: ordered by rivalry (meetings, finals, upsets, close ones, streaks)', rv.length > 0 && rv.every((x, i) => i === 0 || rv[i - 1].score >= x.score) && rv.every(x => x.won + x.lost >= 1));
    check('rivalry objectives for the top rivals, each with a reward', C.objectives().length > 0 && C.objectives().every(o => o.pay > 0 && typeof o.text === 'string'));
    const hh = C.headToHead(rv[0].id);
    check('headToHead: won/lost with its denominator', hh.pct.n === hh.won && hh.pct.d === hh.won + hh.lost);
    const recs = C.records();
    check('records: personal bests, titles, champions per event series, season summaries', recs.seasons.length === 2 && recs.champions.length > 10 && recs.champions.every(c => c.winners.length >= 1) && typeof recs.personal.streak[0] === 'number' && recs.titleLeaders.length > 0);
    /* a partial report: racks that do not add up are not counted, shots alone are */
    const { C: D } = fresh();
    D.create({ name: 'Partial Check', start: 'amateur' }, { seed: 92 });
    const ev = D.availableEvents().filter(e => e.eligibility.ok && e.fmt === 'single').sort((x, y) => x.start - y.start)[0];
    D.enter(ev.id);
    D.advance('event');
    const m = D.nextMatch(), rk0 = D.stats().all.runout.d;
    D.reportMatch({ score: [m.race, 0], racks: [{ won: true, broke: true, legal: true }] });
    check('report: racks that do not match the score are ignored (no rack denominators), the match counts', D.stats().all.matches === 1 && D.stats().all.runout.d === rk0 && D.stats().all.breakAndRun.d === 0);
    let guard = 0;
    while (!D.nextMatch() && guard++ < 10 && D.event(ev.id).status !== 'done') D.advance(1);
    const m2 = D.nextMatch();
    if (m2) {
      D.reportMatch({ score: [0, m2.race], shots: { att: 20, pot: 25, calls: 4, callsOk: 3, safe: 2, safeOk: 5, fouls: 1, scratches: 3 } });
      const z = D.stats().all;
      check('report: shots alone count, clamped so made never exceeds tried', z.shotAccuracy.n === 20 && z.shotAccuracy.d === 20 && z.calledShot.n === 3 && z.safety.n === 2 && z.scratches === 1 && z.runout.d === rk0, JSON.stringify(z));
    } else check('report: shots alone count (no second match to report)', false);
    /* a rival's challenge: an invitation, a two-player event of its own */
    const { C: E } = fresh();
    E.create({ name: 'Challenge Check', start: 'skilled', disc: '9' }, { seed: 93 });
    const st = E.lib.state(), rid = E.population()[5].id;
    st.h2h[rid] = [3, 4, 1, 1, 1, 0, 2, -1, 1];
    let offer = null;
    for (let i = 0; i < 40 && !offer; i++) { E.advance('week'); offer = E.offers().find(o => o.type === 'challenge'); }
    check('rival challenge: a rivalry this hot brings an invitation', !!offer && offer.opp === rid, JSON.stringify(offer));
    if (offer) {
      check('accept the challenge: it goes on the calendar as a best-of series, entered', E.accept(offer.id).ok && E.schedule().some(e => e.kind === 'challenge' && e.fmt === 'series' && e.opp === rid));
      const a1 = E.advance(60), nm = E.nextMatch();
      check('the challenge match comes up against the rival', a1.stopped === 'match' && nm && nm.opponent.id === rid && nm.round.startsWith('Leg 1'), JSON.stringify([a1.stopped, nm && nm.opponent.id]));
    }
  }

  /* ---------- the Hall of Fame, aging, the player's retirement, a new career ---------- */
  {
    const { C } = fresh();
    C.create({ name: 'Legacy Check', start: 'pro' }, { seed: 101 });
    const st = C.lib.state(), id = C.population().find(p => p.tier >= 9).id, age0 = C.player(id).age;
    st.pop.m[id].lg = 1900; st.pop.m[id].d = -80;
    st.me.leg = 1600; st.me.tier = 11;
    C.advance('season');
    const hof = C.records().hallOfFame;
    check('Hall of Fame: a great AI player retires into it', C.player(id).retired && hof.some(h => h.id === id));
    check('Hall of Fame: the player, with the legacy at tier 11, is inducted: tier 12, Legacy', C.now().tier === 12 && C.now().hof && hof.some(h => h.id === C.HUMAN));
    check('Hall of Fame: unlocks its cue', C.buy('cue-legacy').ok);
    const other = C.population().find(p => p.id < 300);
    const a0 = C.player(other.id).age;
    C.advance('season');
    check('aging: a year older each season', C.player(other.id).retired || C.player(other.id).age === a0 + 1);
    check('aging: retirement and a new generation keep 300 active', C.population().length === 300 && C.population({ all: true }).length > 300 && C.population().some(p => p.id > 300 && p.age <= 22), C.population({ all: true }).length);
    void age0;
    const recap = C.retire();
    check('retire: a recap (seasons, record, titles, best ranks, Hall of Fame)', recap.name === 'Legacy Check' && recap.seasons === 3 && recap.hallOfFame === true && typeof recap.winPct.d === 'number' && Array.isArray(recap.titles));
    check('retire: the career is closed to play, read-only', !C.advance(7).ok && C.advance(7).why === 'retired' && !C.enter('x').ok && C.stats().all && C.recap().name === 'Legacy Check');
    const first = C.id, nc = C.create({ name: 'Second Wind' }, { seed: 102 });
    const slots = C.listSlots();
    check('a new career after retirement: a second slot; the first kept, marked retired', nc.ok && slots.length === 2 && slots.find(s => s.id === first).retired && !slots.find(s => s.id === nc.id).retired && C.now().season === 1);
  }

  /* ---------- ten seasons, a save and load after every event ---------- */
  {
    const { C, store } = fresh();
    C.create({ name: 'Long Haul', nat: 'PH', disc: '9', start: 'amateur' }, { seed: 2026 });
    const t0 = Date.now();
    let loads = 0, bad = 0, maxBytes = 0, maxStore = 0;
    const r = auto(C, 520, () => {
      const s = C.save();
      maxBytes = Math.max(maxBytes, s.bytes || 0);
      maxStore = Math.max(maxStore, store.chars());
      const d = C.digest(), l = C.load(C.id);
      loads++;
      if (!l.ok || l.recovered || C.digest() !== d || !C.lib.validate(C.lib.state())) bad++;
    });
    const ms = Date.now() - t0, now = C.now(), arch = C.records().seasons;
    check(`ten seasons: ${r.matches} of the player's matches and ${r.events} events in ${(ms / 1000).toFixed(1)} s, ${loads} saves and loads, none corrupt or different`, now.season === 11 && arch.length === 10 && r.matches >= 300 && loads === r.events && bad === 0 && ms < 40000, JSON.stringify({ now, bad }));
    check(`storage: the largest save ${(maxBytes / 1024).toFixed(0)} KB, the whole store at most ${(maxStore / 1024).toFixed(0)} KB (budget 5 MB)`, maxBytes < 200000 && maxStore < 600000);
    const st = C.stats().all, tiers = arch.map(s => s.t1);
    check('ten seasons: a career that moves (a promotion at least), stats and archives consistent', Math.max(...tiers) > 1 && arch.every((s, i) => s.s === i + 1 && s.m === s.w + s.l) && sum(arch, s => s.m) === st.matches);
    const all = C.population({ all: true });
    check('ten seasons: players retire, new ones arrive, 300 stay active', all.length > 340 && C.population().length === 300 && all.filter(p => p.retired).length === all.length - 300);
    check('ten seasons: champions recorded per event series every season (defending is possible)', C.records().champions.filter(c => c.winners.length >= 9).length > 20);
    const pt = C.lib.unpack(store.getItem('felt.career.v2.' + C.id));
    check('the save is the state: unpacked and validated, identical', !!pt && JSON.stringify(pt) === C.snapshot());
  }

  /* ---------- migration from felt.career.v1 ---------- */
  {
    const { C, store } = fresh();
    const raw = JSON.stringify({ v: 1, best: { pip: [1, 0], benny: [1, 0], rosa: [2, 1], gus: [2, 0], mei: [2, 1] }, won: 6, played: 9, racksW: 14, racksL: 8 });
    check('migrate: nothing to migrate without a v1 record', C.migrate({ name: 'Nobody' }).why === 'none');
    store.setItem('felt.career.v1', raw);
    const m = C.migrate({ name: 'Ladder Climber' }, { seed: 7 });
    const lg = C.stats().legacy;
    check('migrate: a v2 slot from the ladder: five beaten is tier 2, reputation and the record kept as legacy', m.ok && C.now().tier === 2 && C.me().rep === 12 * 5 + 2 * 6 && lg.beaten.length === 5 && lg.won === 6 && lg.played === 9 && lg.winPct.n === 6 && lg.winPct.d === 9 && lg.racksW === 14, JSON.stringify(lg));
    check('migrate: the v1 record is untouched and backed up exactly', store.getItem('felt.career.v1') === raw && store.getItem('felt.career.v1.bak') === raw);
    const again = C.migrate({ name: 'Ladder Climber' });
    check('migrate: idempotent (the same slot again, no second one)', again.ok && again.already && again.id === m.id && C.listSlots().length === 1);
    const { C: D, store: s2 } = fresh();
    s2.setItem('felt.career.v1', '{not json');
    const m2 = D.migrate({ name: 'Broken Ladder' });
    check('migrate: an unreadable v1 record still gives a career (from scratch), the record kept', m2.ok && D.stats().legacy.readable === false && s2.getItem('felt.career.v1') === '{not json' && s2.getItem('felt.career.v1.bak') === '{not json');
  }

  /* ---------- corruption detection and recovery ---------- */
  {
    const { C, store } = fresh();
    C.create({ name: 'Crash Test' }, { seed: 121 });
    C.advance(10); C.save();
    const good = C.digest(), goodRaw = store.getItem('felt.career.v2.c1');
    C.advance(10); C.save();
    const newer = C.digest();
    store.setItem('felt.career.v2.c1', 'F2|garbage');
    let l = C.load('c1');
    check('corruption: a broken save is detected and the last good backup loads', l.ok && l.recovered === 'bak' && C.lib.state().day === 10, JSON.stringify(l));
    check('corruption: recovery restores the main key from the backup', C.lib.unpack(store.getItem('felt.career.v2.c1')) !== null && good !== newer);
    const raw = store.getItem('felt.career.v2.c1'), i = raw.indexOf('"day":') + 6;
    store.setItem('felt.career.v2.c1', raw.slice(0, i) + (raw[i] === '1' ? '2' : '1') + raw.slice(i + 1));
    check('corruption: one changed character fails the checksum', C.lib.unpack(store.getItem('felt.career.v2.c1')) === null && C.listSlots()[0].status === 'recoverable');
    check('validation: a save of the wrong shape is refused even with a good checksum', C.lib.unpack(C.lib.pack(Object.assign(JSON.parse(C.snapshot()), { me: { tier: 99 } }))) === null);
    store.setItem('felt.career.v2.c1', 'x'); store.setItem('felt.career.v2.c1.bak', 'y'); store.setItem('felt.career.v2.c1.tmp', goodRaw);
    l = C.load('c1');
    check('corruption: main and backup both broken, a complete temp copy loads', l.ok && l.recovered === 'tmp');
    store.setItem('felt.career.v2.c1', 'x'); store.setItem('felt.career.v2.c1.bak', 'y'); store.setItem('felt.career.v2.c1.tmp', 'z');
    l = C.load('c1');
    check('corruption: nothing readable is reported, not loaded', !l.ok && l.why === 'corrupt' && C.listSlots()[0].status === 'corrupt');
    const { C: D, store: s2 } = fresh();
    D.create({ name: 'Quota Test' }, { seed: 122 });
    D.advance(5); D.save();
    const keep = s2.getItem('felt.career.v2.c1'), d0 = D.digest();
    D.advance(5);
    s2.failOn = k => k === 'felt.career.v2.c1';
    const sv = D.save();
    s2.failOn = null;
    check('atomic save: a failed write leaves the last good save in place', !sv.ok && s2.getItem('felt.career.v2.c1') === keep && (D.load('c1'), D.digest()) === d0);
    s2.failOn = k => k.endsWith('.tmp');
    check('atomic save: a temp copy that cannot be written stops the save before the main key', !D.save().ok && s2.getItem('felt.career.v2.c1') === keep);
    s2.failOn = null;
  }

  /* ---------- several slots ---------- */
  {
    const { C, store } = fresh();
    for (const [n, s] of [['One', 1], ['Two', 2], ['Three', 3]]) C.create({ name: n }, { seed: s });
    let sl = C.listSlots();
    check('slots: three careers listed with name, season, tier and status', sl.length === 3 && eq(sl.map(x => x.name), ['One', 'Two', 'Three']) && sl.every(x => x.status === 'ok' && x.season === 1 && x.tier >= 1));
    C.load('c1');
    C.advance(14); C.save();
    C.load('c2');
    check('slots: loading switches career; each keeps its own progress', C.id === 'c2' && C.now().day === 0 && (C.load('c1'), C.now().day === 14));
    check('slots: deleteSlot removes its keys and its row', C.deleteSlot('c2').ok && C.listSlots().length === 2 && store.getItem('felt.career.v2.c2') === null && store.getItem('felt.career.v2.c2.bak') === null);
    for (const n of ['Four', 'Five', 'Six', 'Seven']) C.create({ name: n }, { seed: 9 });
    sl = C.listSlots();
    check('slots: at most six', sl.length === 6 && C.create({ name: 'Eight' }).why === 'slots');
    const idx = JSON.parse(store.getItem('felt.careers.v1'));
    check('slots: the index (felt.careers.v1) names the active slot', idx.v === 1 && idx.active === C.id && idx.slots.length === 6);
  }
  console.log(`(node checks took ${((Date.now() - T0) / 1000).toFixed(1)} s)`);

  /* ---------- the page: boot keeps the v1 record, the engine runs there ---------- */
  {
    const raw = JSON.stringify({ v: 1, best: { pip: [1, 0] }, won: 1, played: 2, racksW: 1, racksL: 1 });
    const T = await open('', { init: `try { if (!localStorage.getItem('felt.career.v1')) localStorage.setItem('felt.career.v1', ${JSON.stringify(raw)}); } catch (e) { }` });
    const pg = await T.page.evaluate(() => ({ bak: localStorage.getItem('felt.career.v1.bak'), v1: localStorage.getItem('felt.career.v1'), at: felt.careerAt, rec: felt.careerRec }));
    check('page boot: the v1 ladder record is copied to felt.career.v1.bak; the ladder still reads it', pg.bak === raw && pg.v1 === raw && pg.at === 1 && pg.rec.won === 1, JSON.stringify(pg));
    const mg = await T.page.evaluate(() => { const m = Career.migrate({ name: 'Page Player' }, { seed: 3 }); return { m, slots: Career.listSlots(), keys: Object.keys(localStorage).filter(k => k.startsWith('felt.career')).sort(), adv: Career.advance(7).ok, v1: localStorage.getItem('felt.career.v1') }; });
    check('page: Career.migrate makes a slot in localStorage, the engine plays on, v1 untouched', mg.m.ok && mg.slots.length === 1 && mg.keys.includes('felt.career.v2.c1') && mg.keys.includes('felt.careers.v1') && mg.adv && mg.v1 === raw, JSON.stringify(mg));
    check('page: no console errors', T.errors.length === 0, T.errors.join(' | '));
    await T.browser.close();
  }
  done();
})().catch(e => { console.error(e); process.exit(1); });
