#!/usr/bin/env node
/* drills-check: the drill library (sim 1m) and its page (5d), and the career's practice.
   Sim: every drill's layouts sit on the cloth on both sizes and pocket styles; the stored good
   shots (tools/drill-solver.cjs, tests/drill-solutions.json) score what the file says, and a miss
   scores less; the score is deterministic; a drill that ends on a miss stops there.
   Page: each drill loads on the table from the list (Practice, Drills, a drill's page, Start);
   the good run, played shot by shot through felt.shoot (the same strike and stepTable as the
   bar), scores higher than a bad one and exactly what the sim says; the record (felt.drills.v1)
   holds bests, history and medals, survives a reload and shrugs off corrupt data; the career's
   Practice rows launch the drill and the measured score reaches Career.practice; the sheets have
   44 px targets, 4.5:1 text and fit a 375 x 667 and a 440 x 956 phone. */
'use strict';
const path = require('path');
const { check, done, open, smallTargets, lowContrast } = require('./lib.cjs');
const { loadSim } = require('./sim.cjs');
const SOLS = require('./drill-solutions.json');
const SHOTS = process.env.FELT_SHOTS || '';
const ev = (T, f, a) => T.page.evaluate(f, a);
const shotOf = h => ({ angle: h[0], power: h[1], spin: { x: h[2], y: h[3] } });
/* a bad shot for each drill: soft and well off line (the power ladder: far too hard) */
const badOf = (id, h) => id === 'power-ladder' ? [h[0], 0.9, 0, 0] : [h[0] + 1.3, 0.06, 0, 0];

(async () => {
  /* ---------- sim ---------- */
  const S = loadSim();
  check('eight to twelve drills, each with a name, goal, scoring words, shots and rising medal thresholds',
    S.DRILL_LIB.length >= 8 && S.DRILL_LIB.length <= 12 && S.DRILL_LIB.every(d => d.name && d.goal && d.how && d.shots > 0 && d.tiers.length === 3 && d.tiers[0] < d.tiers[1] && d.tiers[1] <= d.tiers[2] && d.tiers[2] <= 100));
  const ids = S.DRILL_LIB.map(d => d.id), car = S.Career.DRILLS.map(d => d.id);
  check('every career drill is a drill on the table, and every drill is in the career', car.every(id => ids.includes(id)) && ids.every(id => car.includes(id)), JSON.stringify({ ids, car }));
  const off = [];
  for (const cfg of ['7r', '9r', '7g', '9g']) {
    S.setTable(cfg[0]); S.setPockets(cfg[1] === 'g' ? 'generous' : 'regulation');
    for (const d of S.DRILL_LIB) for (let i = 0; i < d.shots; i++) {
      const Sh = S.drillShot(d, i, null), g = { kind: '9', inHand: 'table', balls: [] };
      for (const [n, p] of Sh.balls) {
        if (d.id !== 'break-box' && !S.canPlace(g, p[0], p[1])) off.push([cfg, d.id, i, n]);
        if (g.balls.some(b => Math.hypot(b.x - p[0], b.y - p[1]) < 2 * S.BALL_R)) off.push([cfg, d.id, i, n, 'overlap']);
        g.balls.push(S.newBall(n, p[0], p[1]));
      }
      if (Sh.zone && !(Sh.zone.at[0] > 0 && Sh.zone.at[0] < S.TL && Sh.zone.at[1] > 0 && Sh.zone.at[1] < S.TW)) off.push([cfg, d.id, i, 'zone']);
    }
  }
  check('every layout, on 7 and 9 ft, regulation and generous: on the cloth, clear of cushions, pockets and each other', !off.length, JSON.stringify(off.slice(0, 6)));
  S.setTable('7'); S.setPockets('regulation');
  const simRuns = {}, simBad = [];
  for (const d of S.DRILL_LIB) {
    const sol = SOLS['7r'][d.id], good = S.drillRun(d, sol.shots.map(shotOf)), bad = S.drillRun(d, sol.shots.map(h => shotOf(badOf(d.id, h))));
    simRuns[d.id] = good;
    if (!(good.total === sol.total && good.total > bad.total && good.total >= d.tiers[0])) simBad.push({ id: d.id, good: good.total, file: sol.total, bad: bad.total });
  }
  check('sim: each drill\'s stored good run scores what the file says (a medal at least), a bad run less', !simBad.length, JSON.stringify(simBad));
  const again = S.drillRun(S.drillById('break-box'), SOLS['7r']['break-box'].shots.map(shotOf));
  check('sim: the same shots, the same scores (the break, run twice)', JSON.stringify(again) === JSON.stringify(simRuns['break-box']));
  const pr = S.drillRun(S.drillById('pressure-nine'), [[0, 0.05, 0, 0], ...SOLS['7r']['pressure-nine'].shots.slice(1)].map(shotOf));
  check('sim: Pressure 9 ends on the first miss (one shot, 0)', pr.js.length === 1 && pr.total === 0, JSON.stringify(pr));
  const d0 = S.drillById('stop-shot');
  check('sim: tiers by score (49 none, 50 bronze, 75 silver, 90 gold)', [49, 50, 75, 90].map(v => S.drillTier(d0, v)).join() === '0,1,2,3');

  /* ---------- page ---------- */
  const T = await open('', { viewport: { width: 440, height: 956 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const P = T.page;
  const shot = async name => { if (SHOTS) await P.screenshot({ path: path.join(SHOTS, name + '.png') }); };
  const a11y = async () => ({ small: await smallTargets(P), low: await lowContrast(P) });
  const fits = () => ev(T, () => { const s = document.querySelector('#drillSheet.show .sheet') || document.querySelector('.overlay.show .sheet'); return !!s && s.scrollWidth <= s.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1; });
  await ev(T, () => { felt.speed = 40; felt.drillBeat = 0; });
  /* the way in: Practice, then Drills */
  await P.click('#pracBtn');
  const pe = await ev(T, () => ({ shown: prac.classList.contains('show'), row: !!document.querySelector('#prac #drillBtn'), sum: drillSum.textContent }));
  check('Practice holds the Drills entry, with the medals won', pe.shown && pe.row && /^0 of \d+$/.test(pe.sum), JSON.stringify(pe));
  await P.click('#drillBtn');
  const li = await ev(T, () => ({ page: felt.drillPage, rows: [...drillList.querySelectorAll('.topic')].map(b => b.id) }));
  check('Drills: the list, a row per drill', li.page === 'list' && li.rows.length === ids.length && ids.every(id => li.rows.includes('drillRow-' + id)), JSON.stringify(li));
  const a0 = await a11y();
  check('the list: targets 44 px, text 4.5:1, fits', !a0.small.length && !a0.low.length && await fits(), JSON.stringify(a0));
  await shot('drills-list');
  await P.click('#drillRow-cut-ladder');
  await P.waitForTimeout(450);
  const pg = await ev(T, () => ({ page: felt.drillPage, title: drillTitle.textContent, rules: drillRules.textContent, go: drillGo.textContent, hist: drillHist.hidden }));
  check('a drill\'s page: its goal, scoring and medals, no history yet, Start pinned at the foot', pg.page === 'cut-ladder' && pg.title === 'Cut ladder' && /15, 30, 45/.test(pg.rules) && /Bronze at 60/.test(pg.rules) && pg.hist && /Start/.test(pg.go), JSON.stringify(pg));
  const a1 = await a11y();
  check('the page: targets 44 px, text 4.5:1, fits', !a1.small.length && !a1.low.length && await fits(), JSON.stringify(a1));
  await shot('drills-page');
  await P.click('#drillBack');
  check('Back pops to the list', await ev(T, () => felt.drillPage === 'list'));
  await P.click('#drillBack');
  check('Back from the list goes to Practice', await ev(T, () => prac.classList.contains('show') && felt.drillPage === null));
  await ev(T, () => { prac.classList.remove('show'); felt.showDrills('cut-ladder'); });
  await P.click('#drillGo');
  /* each drill loads on the table: its layout, game.mode 'drill', aiming */
  const loads = await ev(T, ids => ids.map(id => {
    felt.drill(id);
    const n = felt.drillNow, g = felt.game, want = n.S.balls;
    return { id, ok: felt.state === 'aim' && g.mode === 'drill' && n.i === 0 && want.length === g.balls.length && want.every(([k, p]) => g.balls.some(b => b.n === k && Math.abs(b.x - p[0]) < 1e-9 && Math.abs(b.y - p[1]) < 1e-9)) };
  }), ids);
  check('each drill loads on the table (its first layout, aiming, mode drill)', loads.every(x => x.ok), JSON.stringify(loads.filter(x => !x.ok)));
  await ev(T, () => felt.drill('stop-shot'));
  await P.waitForTimeout(250);
  await shot('drills-table');
  /* a run on the page, shot by shot through the ordinary turn */
  const play = async (id, shots) => {
    await ev(T, id => felt.drill(id), id);
    for (const h of shots) {
      const st = await ev(T, () => ({ s: felt.state, live: !!felt.drillNow, res: drillRes.classList.contains('show') }));
      if (st.res || !st.live) break;
      await P.waitForFunction(() => felt.state === 'aim', null, { timeout: 20000 });
      await ev(T, h => felt.shoot(h[0], h[1], { x: h[2], y: h[3] }), h);
      await P.waitForFunction(() => felt.state !== 'rolling' && felt.state !== 'stroke', null, { timeout: 30000 });
    }
    await P.waitForFunction(() => drillRes.classList.contains('show'), null, { timeout: 20000 });
    return ev(T, () => felt.lastDrill);
  };
  const live = [];
  for (const d of S.DRILL_LIB) {
    const sol = SOLS['7r'][d.id], good = await play(d.id, sol.shots), bad = await play(d.id, sol.shots.map(h => badOf(d.id, h)));
    live.push({ id: d.id, good: good.total, bad: bad.total, sim: simRuns[d.id].total, gs: good.scores.join(), ss: simRuns[d.id].js.map(j => j.s).join() });
  }
  const lbad = live.filter(x => !(x.good > x.bad && x.good === x.sim && x.gs === x.ss));
  check('page: every drill\'s good run beats a bad one, scored exactly as the sim scores it (shot by shot)', !lbad.length, JSON.stringify(lbad));
  await shot('drills-result');
  const r0 = await ev(T, () => ({ kind: drillKind.textContent, head: drillHead.textContent, chips: drillShots.children.length, a: !drillToList.hidden, c: drillToCareer.hidden }));
  check('the result: the drill, the score, a chip per shot, All drills (no Career outside a career)', /^Drill: /.test(r0.kind) && /of 100/.test(r0.head) && r0.chips === S.drillById('pressure-nine').shots && r0.a && r0.c, JSON.stringify(r0));
  const a2 = await a11y();
  check('the result: targets 44 px, text 4.5:1', !a2.small.length && !a2.low.length, JSON.stringify(a2));
  /* determinism on the page: the same run again, the same scores */
  const b1 = await play('break-box', SOLS['7r']['break-box'].shots), b2 = await play('break-box', SOLS['7r']['break-box'].shots);
  check('page: the same shots score the same (the break twice)', b1.scores.join() === b2.scores.join() && b1.total === b2.total && b1.total === simRuns['break-box'].total, JSON.stringify([b1.scores, b2.scores]));
  /* the record: bests, plays, history, medals */
  const rec = await ev(T, () => ({ r: felt.drillRec, raw: JSON.parse(localStorage.getItem('felt.drills.v1')), sum: drillSum.textContent }));
  const bb = rec.r['break-box'], BB = live.find(x => x.id === 'break-box');
  check('the record: best, plays and history kept per drill, versioned in felt.drills.v1', rec.raw.v === 1 && bb && bb.n === 4 && bb.best === simRuns['break-box'].total && bb.hist.length === 4 && bb.hist.map(h => h[0]).join() === [BB.good, BB.bad, b1.total, b2.total].join(), JSON.stringify(bb));
  const medals = S.DRILL_LIB.reduce((a, d) => a + S.drillTier(d, Math.max(...live.filter(x => x.id === d.id).map(x => x.good))), 0);
  check('the medals: the best score\'s tier on every drill, counted in Practice', rec.sum === `${medals} of ${ids.length * 3}`, JSON.stringify({ sum: rec.sum, medals }));
  await ev(T, () => felt.showDrills('break-box'));
  const hp = await ev(T, () => ({ rows: drillHist.querySelectorAll('.topic').length, best: drillRules.textContent }));
  check('a played drill\'s page: its scores listed, the best', hp.rows === 4 && /4 played/.test(hp.best), JSON.stringify(hp));
  await P.reload(); await P.waitForFunction(() => window.booted === true);
  const rl = await ev(T, () => ({ r: felt.drillRec, sum: drillSum.textContent }));
  check('reload: the record and the medals come back', JSON.stringify(rl.r) === JSON.stringify(rec.r) && rl.sum === rec.sum, JSON.stringify(rl.sum));
  /* corruption: junk, a wrong version, bad fields; never an error, the good parts kept */
  const corrupt = [
    ['not json {', {}],
    ['{"v":2,"d":{"long-pot":{"best":80,"n":1,"hist":[[80,"2026-10-01"]]}}}', {}],
    ['null', {}], ['[1,2]', {}],
    ['{"v":1,"d":{"long-pot":{"best":500,"n":"x","hist":[[70,"2026-10-01"],[50,"2026-13-45"],"junk",[101,"2026-10-02"]]},"nope":{"best":90,"n":1,"hist":[]},"cut-ladder":null}}', { 'long-pot': { best: 70, n: 1, hist: [[70, '2026-10-01']] } }],
  ];
  const cr = [];
  for (const [raw, want] of corrupt) {
    await ev(T, raw => localStorage.setItem('felt.drills.v1', raw), raw);
    await P.reload(); await P.waitForFunction(() => window.booted === true);
    const got = await ev(T, () => felt.drillRec);
    if (JSON.stringify(got) !== JSON.stringify(want)) cr.push({ raw: raw.slice(0, 40), got });
  }
  await ev(T, () => { felt.speed = 40; felt.drillBeat = 0; felt.drill('long-pot'); });
  const after = await play('long-pot', SOLS['7r']['long-pot'].shots);
  const saved = await ev(T, () => JSON.parse(localStorage.getItem('felt.drills.v1')));
  check('corrupt records load as what is valid in them (nothing else), and the next score saves cleanly', !cr.length && T.errors.length === 0 && saved.v === 1 && saved.d['long-pot'].n === 2 && saved.d['long-pot'].best === Math.max(70, after.total), JSON.stringify({ cr, errors: T.errors.slice(0, 3), saved }));
  /* the pause menu in a drill, and Restart */
  await ev(T, () => { felt.drill('cut-ladder'); });
  await ev(T, h => felt.shoot(h[0], h[1], { x: h[2], y: h[3] }), SOLS['7r']['cut-ladder'].shots[0]);
  await P.waitForFunction(() => felt.state === 'aim', null, { timeout: 20000 });
  await P.click('#menuBtn');
  const pm = await ev(T, () => ({ kind: soloKind.textContent, title: soloTitle.textContent, stats: soloStats.textContent }));
  check('the pause menu in a drill: the shot, the name, the shots and points so far', /Drill, shot 2 of 5/.test(pm.kind) && pm.title === 'Cut ladder' && /1\/5/.test(pm.stats), JSON.stringify(pm));
  await P.click('#restartBtn');
  check('Restart: the drill again from its first shot', await ev(T, () => felt.drillNow && felt.drillNow.i === 0 && felt.drillNow.scores.length === 0 && felt.state === 'aim'));
  await T.browser.close();

  /* ---------- the career's practice, and a small phone ---------- */
  const C = await open('', { viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const Q = C.page, cev = (f, a) => Q.evaluate(f, a);
  await Q.click('#pracBtn');
  await Q.click('#drillBtn');
  const s0 = { small: await smallTargets(Q), low: await lowContrast(Q) };
  check('375 x 667: the list has 44 px targets, 4.5:1 text, and scrolls without spilling sideways',
    !s0.small.length && !s0.low.length && await cev(() => { const s = document.querySelector('#drillSheet .sheet'); return s.scrollHeight > s.clientHeight && s.scrollWidth <= s.clientWidth + 1; }), JSON.stringify(s0));
  if (SHOTS) await Q.screenshot({ path: path.join(SHOTS, 'drills-list-375.png') });
  await cev(() => { felt.showCareer(); });
  await Q.click('#cvNew');
  await Q.fill('#cvf-name', 'Dee Rill');
  await Q.click('#cvCreate');
  await cev(() => { felt.careerGo('practice'); felt.speed = 40; felt.drillBeat = 0; });
  const cp = await cev(() => ({ page: felt.careerPage, play: [...cvBody.querySelectorAll('button[id^="drill-"]')].map(b => b.id), inputs: cvBody.querySelectorAll('input').length }));
  check('career Practice: a Play button per drill, no typed score', cp.page === 'practice' && cp.play.length === ids.length && cp.inputs === 0, JSON.stringify(cp));
  const ca = { small: await smallTargets(Q), low: await lowContrast(Q) };
  check('career Practice: targets 44 px, text 4.5:1', !ca.small.length && !ca.low.length, JSON.stringify(ca));
  if (SHOTS) await Q.screenshot({ path: path.join(SHOTS, 'career-practice.png') });
  await Q.click('#drill-stop-shot');
  check('Play: the drill on the table, as the career\'s session', await cev(() => felt.drillNow && felt.drillNow.id === 'stop-shot' && felt.drillNow.career && felt.state === 'aim'));
  for (const h of SOLS['7r']['stop-shot'].shots) {
    await Q.waitForFunction(() => felt.state === 'aim' || drillRes.classList.contains('show'), null, { timeout: 20000 });
    if (await cev(() => drillRes.classList.contains('show'))) break;
    await cev(h => felt.shoot(h[0], h[1], { x: h[2], y: h[3] }), h);
    await Q.waitForFunction(() => felt.state !== 'rolling', null, { timeout: 30000 });
  }
  await Q.waitForFunction(() => drillRes.classList.contains('show'), null, { timeout: 20000 });
  const cm = await cev(() => ({ m: Career.stats().mastery['stop-shot'], d: felt.lastDrill, day: Career.calendar().practiceToday, words: drillCareer.textContent, car: !drillToCareer.hidden }));
  check('the measured score reaches Career.practice: mastery best and a session used, the result says so',
    cm.m && cm.m.best === cm.d.total && cm.d.total === simRuns['stop-shot'].total && cm.day === 1 && /Recorded in your career/.test(cm.words) && cm.car, JSON.stringify(cm));
  if (SHOTS) await Q.screenshot({ path: path.join(SHOTS, 'drills-career-result.png') });
  await Q.click('#drillToCareer');
  const back = await cev(() => ({ page: felt.careerPage, sub: cvBody.textContent }));
  check('Career: back on the practice page, the best shown, one of three sessions used', back.page === 'practice' && /1 of 3 sessions/.test(await cev(() => careerKick.textContent)) && new RegExp(`Best ${cm.d.total}`).test(back.sub), JSON.stringify(back.page));
  check('no console errors', !T.errors.length && !C.errors.length, JSON.stringify([...T.errors, ...C.errors].slice(0, 3)));
  await C.browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
