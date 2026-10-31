/* jumptricks-check: the Jump and Masse trick shots (TRICKS group 'jump', sim 1h; the list and the
   elevation tip, page 5s; .buildloop/spec/T5-jump-tricks.md). Node half (the sim region): the
   group's shape, every stored solution (tests/trick-solutions.json, the solver's: tools/trick-solver.cjs)
   making its shot on all four table settings with the raised cue it names and failing level, the
   margin (makes in the solver's sweep, and a neighbourhood re-simulated here round each solution),
   the jumps really flying (r.over), the boot shot's own pocket, and the classics untouched byte for
   byte. Page half, on a phone by touch at 393x852: the list's two groups (HIG group heads, Title
   Case, 44 px, 4.5:1), every challenge loading its layout, a stored solution replayed through the
   live page equal to simulateShot byte for byte, Show me through commit(), stars by tries, and
   the elevation tip once ever (firstRun). FELT_SHOTS=<dir> saves a setup and a mid-jump screenshot. */
'use strict';
const path = require('path');
const crypto = require('crypto');
const { check, done, open, smallTargets, lowContrast, badTitles } = require('./lib.cjs');
const { loadSim } = require('./sim.cjs');
const S = loadSim();
const FILE = require('./trick-solutions.json');
const D = Math.PI / 180, CFGS = ['7r', '9r', '7g', '9g'];
const SHOTS = process.env.FELT_SHOTS;
/* the sweep's makes every challenge keeps on every table (N), and the neighbours round its stored
   solution that make it too (of 7 angles x 3 powers x 3 elevations) */
const MIN_MAKES = 20, MIN_NEAR = 5;
const shotOf = s => ({ angle: s[0], power: s[1], spin: s[4] ? { x: s[2], y: s[3], e: s[4] * D } : { x: s[2], y: s[3] } });
const cfgOn = cfg => { S.setTable(cfg[0]); S.setPockets(cfg[1] === 'g' ? 'generous' : 'regulation'); };
const JUMP = S.TRICKS.filter(c => c.group === 'jump');
const sha = x => crypto.createHash('sha256').update(x).digest('hex');

/* ---- the sim ---- */
{
  check(`jump and masse: ${JUMP.length} challenges (8 to 12) after the 14 classics, each with an id, a title, a one-line goal, a level and a whole-degree elevation`,
    JUMP.length >= 8 && JUMP.length <= 12 && S.TRICKS.slice(0, 14).every(c => !c.group) && S.TRICKS.slice(14).every(c => c.group === 'jump')
      && JUMP.every(c => c.title && c.goal && !/\n/.test(c.goal) && ['easy', 'medium', 'hard'].includes(c.level) && Number.isInteger(c.elev) && c.elev > 0 && c.elev <= 60 && c.sweep),
    JUMP.map(c => `${c.id}:${c.level}:${c.elev}`).join(' '));
  check('every level is used, and the hint names the elevation in degrees', ['easy', 'medium', 'hard'].every(l => JUMP.some(c => c.level === l)) && JUMP.every(c => S.TRICKS.length && /^Raise the cue to about \d+°\.$/.test(`Raise the cue to about ${c.elev}°.`)));
  /* the classics: layouts, words and stored solutions exactly as before this group (the hash of the
     build before it, every table setting), and their solutions file unchanged */
  const sig = [];
  for (const cfg of CFGS) { cfgOn(cfg); sig.push(S.TRICKS.filter(c => !c.group).map(c => [c.id, c.title, c.goal, S.trickBalls(c).map(x => [x.n, x.x, x.y]), S.TRICK_SOLS[c.id]])); }
  check('the classic trick shots are byte-identical: layouts, words and stored solutions on every table', sha(JSON.stringify(sig)) === '9aeb1050f3496ac334f9935588a8beb861bcc161f6aa691961ca31518ca430e8', sha(JSON.stringify(sig)));
  check('the classic solutions file entries are byte-identical', sha(JSON.stringify(CFGS.map(k => Object.fromEntries(Object.entries(FILE[k]).filter(([id]) => !S.trickById(id).group))))) === '08a9b50e79c64f920ceea2802d3bbf8c0a017b1771413bcc9882f3db11b49bdd');
  const bad = [], level = [], flew = [], margin = [], near = [];
  for (const cfg of CFGS) {
    cfgOn(cfg);
    for (const c of JUMP) {
      const s = FILE[cfg][c.id], b = S.trickBalls(c);
      if (!s || JSON.stringify(s) !== JSON.stringify(S.TRICK_SOLS[c.id][cfg]) || !Number.isInteger(s[4]) || s[4] < 1 || s[4] > 60) { bad.push(`${cfg}:${c.id} stored`); continue; }
      const r = S.simulateShot(b, shotOf(s));
      if (!S.trickJudge(c, r).ok) bad.push(`${cfg}:${c.id} ${S.trickJudge(c, r).why}`);
      if (S.trickJudge(c, S.simulateShot(b, shotOf([s[0] + Math.PI, 0.12, 0, 0]))).ok) bad.push(`${cfg}:${c.id} miss made it`);
      /* the same stroke on a level cue does not make it: the raised cue is the shot */
      if (S.trickJudge(c, S.simulateShot(b, shotOf(s.slice(0, 4)))).ok) level.push(`${cfg}:${c.id}`);
      /* a jump shot's solution flies (the cue ball passed over a ball before its first contact) */
      if (/jump|fly|clear/i.test(c.goal) && !(r.over && r.over.length)) flew.push(`${cfg}:${c.id}`);
      const m = (FILE.margin || {})[cfg] && FILE.margin[cfg][c.id];
      if (!m || m[0] < MIN_MAKES) margin.push(`${cfg}:${c.id}:${m ? m[0] : '-'}`);
      let n = 0;
      for (let k = -3; k <= 3; k++) for (const dp of [-0.02, 0, 0.02]) for (const de of [-1, 0, 1]) if (S.trickJudge(c, S.simulateShot(b, shotOf([s[0] + k * 0.1 * D, +(s[1] + dp).toFixed(2), s[2], s[3], s[4] + de]))).ok) n++;
      if (n < MIN_NEAR) near.push(`${cfg}:${c.id}:${n}`);
      near.ok = (near.ok || []).concat(`${cfg}:${c.id}:${n}`);
    }
  }
  cfgOn('7r');
  check('every challenge has a stored solution on all four tables (the page holds the same, with its elevation in whole degrees) that makes it, and a deliberate miss fails', !bad.length, bad.join(' | '));
  check('the raised cue is the shot: each stored stroke played on a level cue fails', !level.length, level.join(' '));
  check('the jumps fly: each jump solution passes over a ball before its first contact (r.over)', !flew.length, flew.join(' '));
  check(`margin: every challenge has at least ${MIN_MAKES} making shots in the solver's sweep on every table`, !margin.length, margin.join(' ') || CFGS.map(cfg => JUMP.map(c => `${cfg}:${c.id}:${FILE.margin[cfg][c.id][0]}`).join(' ')).join(' '));
  check(`margin: at least ${MIN_NEAR} of the 63 strokes round each stored solution (0.1 deg, 0.02 power, 1 deg of elevation) make it too`, !near.length, (near.length ? near : near.ok).join(' '));
  /* the boot: the cue ball's own pocket is the goal, any other is a scratch; off the table says so */
  const boot = S.trickById('jboot'), bb = S.trickBalls(boot);
  const fake = (k) => ({ balls: bb, potted: [0], pocketOf: { 0: k }, contacts: [], over: [1, 2], rails: {}, kick: null, first: null });
  check("Massey's Boot: the cue ball in the marked corner on the fly makes it; in another pocket it is a scratch, off the table it says so",
    S.trickJudge(boot, fake(2)).ok && /Scratch/.test(S.trickJudge(boot, fake(5)).why) && /off the table/.test(S.trickJudge(boot, fake(-1)).why) && /Scratch/.test(S.trickJudge(S.trickById('jhop'), fake(2)).why));
  check('a curve round a blocker must not go over it or off a rail first, and says so', /not over/.test(S.trickById('jmingaud').check({ contacts: [], over: [2], kick: 0, potted: [1], pocketOf: { 1: 2 } })) && /No rail first/.test(S.trickById('jswerve').check({ contacts: [], kick: 1, potted: [1], pocketOf: { 1: 2 } })));
  check('the daily shot stays with the classics', S.TRICKS.filter(c => !c.group).length === 14);
}

(async () => {
  /* ---- the page, on a phone by touch, the tip's first run ---- */
  const { browser, page, errors } = await open('', { viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3, firstRun: true,
    init: () => { try { if (!sessionStorage.getItem('jt')) { sessionStorage.setItem('jt', '1'); for (const k of ['felt.tricks', 'felt.trickTries.v1', 'felt.elevTip.v1']) localStorage.removeItem(k); localStorage.setItem('felt.lesson.v1', '{"v":1,"seen":true,"done":false}'); } } catch (e) { } } });
  await page.evaluate(() => { felt.speed = 40; });
  const shoot = (a, p, s) => page.evaluate(([a, p, s]) => felt.shoot(a, p, s), [a, p, s]);
  const idle = () => page.waitForFunction(() => felt.state === 'aim' || felt.state === 'over', null, { timeout: 30000 });
  const sol = id => page.evaluate(id => TRICK_SOLS[id]['7r'], id);
  const spin = s => (s[4] ? { x: s[2], y: s[3], e: s[4] * Math.PI / 180 } : { x: s[2], y: s[3] });

  await page.tap('#trickBtn');
  const L = await page.evaluate(() => ({ shown: tricks.classList.contains('show'),
    groups: [...trickGrid.querySelectorAll('.tgroup')].map(g => ({ id: g.dataset.group, head: g.querySelector('.ghead').textContent, n: g.querySelectorAll('.tcard').length,
      lv: [...g.querySelectorAll('.tcard .lvl')].map(x => x.textContent) })) }));
  check('Trick shots: two groups, Classic Shots then Jump and Massé, each under a group head; the jump cards carry their level',
    L.shown && L.groups.length === 2 && L.groups[0].head === 'Classic Shots' && L.groups[0].n === 14 && L.groups[1].head === 'Jump and Massé' && L.groups[1].n === S.TRICKS.length - 14
      && L.groups[1].lv.length === L.groups[1].n && L.groups[1].lv.every(t => ['Easy', 'Medium', 'Hard'].includes(t)) && !L.groups[0].lv.length, JSON.stringify(L));
  check('trick list: targets 44 px, text 4.5:1, titles Title Case', (await smallTargets(page)).length === 0 && (await lowContrast(page)).length === 0 && (await badTitles(page)).length === 0,
    JSON.stringify([await smallTargets(page), await lowContrast(page), await badTitles(page)]));
  const scroll = await page.evaluate(() => { const c = document.querySelector('.tcard[data-id="jboot"]'); c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: innerHeight }; });
  check('the list scrolls to its last jump card, whole on screen', scroll.top >= 0 && scroll.bottom <= scroll.h, JSON.stringify(scroll));

  /* the first jump card, by a real tap: its layout, its hint, and the elevation tip by the pad */
  await page.tap('.tcard[data-id="jhop"]');
  await page.waitForTimeout(150);
  const t0 = await page.evaluate(() => ({ id: felt.game.trick, s: felt.state, n: felt.game.balls.length, chip: turnChip.dataset.name, tip: felt.elevTip, text: elevTipText.textContent,
    stored: localStorage.getItem('felt.elevTip.v1'), box: elevTip.getBoundingClientRect().toJSON(), pad: spinPad.getBoundingClientRect().toJSON(), flash: document.body.textContent.includes('Raise the cue to about 50°') }));
  check('a jump challenge loads its layout (Try 1); the first ever shows the elevation tip by the english pad, stored at once',
    t0.id === 'jhop' && t0.s === 'aim' && t0.n === 3 && t0.chip === 'Try 1' && t0.tip.shown && t0.tip.shows === 1 && /Hold the english pad/.test(t0.text) && JSON.parse(t0.stored).seen === true
      && t0.box.bottom <= t0.pad.top + 1 && t0.box.left >= 0 && t0.box.right <= 393, JSON.stringify(t0));
  check('the tip: targets 44 px, text 4.5:1', (await smallTargets(page)).length === 0 && (await lowContrast(page)).length === 0, JSON.stringify([await smallTargets(page), await lowContrast(page)]));
  if (SHOTS) { await page.evaluate(() => hideElevTip()); await page.waitForTimeout(2600); await page.screenshot({ path: path.join(SHOTS, 'jump-shot-setup.png') }); await page.evaluate(() => { elevTip.hidden = false; placeElevTip(); }); }
  await page.tap('#elevTipOk');
  const t1 = await page.evaluate(() => felt.elevTip);
  check('Got It closes the tip', !t1.shown && t1.seen, JSON.stringify(t1));
  await page.evaluate(() => felt.pause && 0);
  /* pause menu: the goal and the hint */
  await page.tap('#menuBtn');
  const pm = await page.evaluate(() => ({ title: soloTitle.textContent, goal: soloGoal.textContent }));
  check('pause in a jump challenge: its title and goal, with the elevation to use', pm.title === 'Jump Shot' && /over the 2/.test(pm.goal) && /Raise the cue to about 50°\./.test(pm.goal), JSON.stringify(pm));
  await page.tap('#resumeBtn');

  /* stars by tries (the boot shot: two misses, then the make on try 3 earns 2) and Show me */
  await page.evaluate(() => felt.showTricks());
  await page.evaluate(() => document.querySelector('.tcard[data-id="jboot"]').scrollIntoView({ block: 'center' }));
  await page.tap('.tcard[data-id="jboot"]');
  const B = await sol('jboot');
  const tries0 = await page.evaluate(() => felt.solo.attempts);
  for (let i = 0; i < 2; i++) { await shoot(B[0] + Math.PI, 0.12, 0); await idle(); await page.tap('#trickRetry'); }
  await shoot(B[0], B[1], spin(B)); await idle();
  const st = await page.evaluate(() => ({ t: felt.lastTrick, best: felt.trickBest.jboot, tries: felt.trickTries.jboot, stars: trickStarsNow.getAttribute('aria-label') }));
  check("stars by tries: Massey's Boot made on try 3 (two misses before) earns 2 stars, kept", tries0 === 0 && st.t.ok && st.t.attempts === 3 && st.t.stars === 2 && st.best === 2 && st.tries === 3 && st.stars === '2 of 3 stars', JSON.stringify({ tries0, st }));
  await page.evaluate(() => { felt.speed = 0.5; });
  await page.tap('#trickShow');
  /* mid-jump: the Show me roll, caught with the cue ball in the air */
  await page.waitForFunction(() => felt.airNow && felt.airNow.some(b => b.n === 0 && b.z > 0.03), null, { timeout: 20000, polling: 'raf' }).catch(() => null);
  const mid = await page.evaluate(() => felt.airNow);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'massey-boot-mid-jump.png') });
  await page.evaluate(() => { felt.speed = 40; });
  await idle();
  const sm = await page.evaluate(() => ({ t: felt.lastTrick, head: trickHead.textContent, best: felt.trickBest.jboot, shot: felt.lastShot && felt.lastShot.spin }));
  check('Show me plays the stored solution through commit(): the raised cue goes with it, the cue ball flies, it makes the shot, is not an attempt and the stars stay',
    sm.t.ok && sm.t.demo && sm.t.attempts === 3 && sm.best === 2 && sm.head === 'Like that' && !!mid && mid.some(b => b.n === 0 && b.z > 0.03) && sm.shot && Math.abs(sm.shot.e - B[4] * Math.PI / 180) < 1e-9, JSON.stringify({ sm, mid }));

  /* every challenge loads; its stored solution replayed through the live page equals simulateShot byte for byte */
  const live = [];
  for (const c of S.TRICKS.filter(x => x.group === 'jump')) {
    await page.evaluate(id => felt.trick(id), c.id);
    const s = await sol(c.id);
    const want = await page.evaluate(s => JSON.stringify(simulateShot(felt.game.balls, { angle: s[0], power: s[1], spin: spinOf(s[4] ? { x: s[2], y: s[3], e: s[4] * Math.PI / 180 } : { x: s[2], y: s[3] }) })), s);
    const lay = await page.evaluate(id => JSON.stringify(trickBalls(trickById(id))) === JSON.stringify(felt.game.balls) && felt.state === 'aim', c.id);
    await shoot(s[0], s[1], spin(s)); await idle();
    const got = await page.evaluate(() => ({ r: JSON.stringify(felt.lastResult), t: felt.lastTrick }));
    live.push({ id: c.id, lay, same: got.r === want, ok: got.t.ok, why: got.t.why });
  }
  check('every jump and massé challenge loads its layout, and its stored solution through the live page makes it, byte for byte with simulateShot',
    live.every(x => x.lay && x.same && x.ok), JSON.stringify(live.filter(x => !(x.lay && x.same && x.ok))));
  const t2 = await page.evaluate(() => felt.elevTip);
  check('the tip shows once ever: none on the other jump challenges (Show me and the boot shot included)', t2.shows === 1 && !t2.shown, JSON.stringify(t2));

  /* a reload: the tip stays seen, the stars and tries stay */
  await page.reload();
  await page.waitForFunction(() => window.booted === true);
  await page.evaluate(() => felt.trick('jwall'));
  const rl = await page.evaluate(() => ({ tip: felt.elevTip, best: felt.trickBest.jboot, tries: felt.trickTries.jboot, sum: trickSum.textContent }));
  check('after a reload: no tip on a jump challenge, the stars and tries are kept', !rl.tip.shown && rl.tip.seen && rl.best === 2 && rl.tries === 4, JSON.stringify(rl));
  check('jump tricks: no console errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
