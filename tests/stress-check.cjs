#!/usr/bin/env node
/* stress-check: volume and abuse, kept to about a minute and a half.
   1. Shots: a few thousand seeded shots across every table (7 and 9 ft with both pocket styles,
      both bumper tables, both snooker tables, carom), each from the layout the game before it
      left (judge evolves it, a won game re-racks), at every power, with spin. Every shot ends at
      rest, nothing is NaN, nothing escapes the table, no two balls overlap and every ball left
      up lies on the bed; a sample re-run gives byte-identical results.
   2. CPU against CPU: hundreds of whole racks across the games and levels: every one ends (no
      stuck state, no safety loop past the cap), and a game replayed from its seeds is identical.
   3. Storage: every localStorage record written, read back across a reload and compared, then
      corrupted (bad JSON, wrong types, wrong versions, out-of-range values, a throwing or full
      storage): the page boots, every screen opens and nothing reaches the console.
   4. Navigation: hundreds of rapid taps on whatever controls are on screen, resizes and
      rotations, pauses, resumes, replays and quits, with games started and played in between;
      and a table fuzz (random touches and mouse drags anywhere but the power bar, random keys)
      that never fires a shot. No console errors anywhere. */
'use strict';
const { check, done, open } = require('./lib.cjs');
const { loadSim } = require('./sim.cjs');
const S = loadSim();
const T0 = Date.now();
const secs = () => ((Date.now() - T0) / 1000).toFixed(1) + ' s';

/* ---- 1. shots ---- */
const TABLES = [
  { tag: '7 ft regulation', set: () => { S.setTable('7'); S.setPockets('regulation'); }, kind: '8' },
  { tag: '7 ft generous', set: () => { S.setTable('7'); S.setPockets('generous'); }, kind: '9' },
  { tag: '9 ft regulation', set: () => { S.setTable('9'); S.setPockets('regulation'); }, kind: '9' },
  { tag: '9 ft generous', set: () => { S.setTable('9'); S.setPockets('generous'); }, kind: '8' },
  { tag: 'bumper octagon', set: () => { S.setPockets('regulation'); S.setTable('bumper', 'octagon'); }, kind: 'bumper' },
  { tag: 'bumper rectangle', set: () => S.setTable('bumper', 'rect'), kind: 'bumper' },
  { tag: 'snooker compact', set: () => S.setTable('snooker', 'compact'), kind: 'snooker' },
  { tag: 'snooker full', set: () => S.setTable('snooker', 'full'), kind: 'snooker' },
  { tag: 'carom', set: () => S.setTable('carom'), kind: 'carom' },
];
const fresh = kind => kind === 'snooker' ? S.snookerGame() : S.newGame(kind, kind === 'carom' ? { race: 5 } : undefined);
const striker = g => g.kind === 'bumper' || g.kind === 'carom' ? g.striker : 0;
/* a ball left up: its centre on the cloth (a ball may hang in a mouth, its centre past the nose
   line but never past the bed's edge) and inside no cushion, jaw or post */
const gap = (c, x, y) => { const ex = c[2] - c[0], ey = c[3] - c[1], L2 = ex * ex + ey * ey, t = L2 ? Math.max(0, Math.min(1, ((x - c[0]) * ex + (y - c[1]) * ey) / L2)) : 0; return Math.hypot(c[0] + ex * t - x, c[1] + ey * t - y); };
function onBed(b) {
  if (!b.on) return true;
  const R = S.BALL_R, e = 1e-6;
  if (S.BED_LINES ? !S.BED_LINES.every(l => l[0] * b.x + l[1] * b.y - l[2] >= -e) : !(b.x >= -e && b.x <= S.TL + e && b.y >= -e && b.y <= S.TW + e)) return false;
  if (S.CUSH.some(c => gap(c, b.x, b.y) < R - 1e-5)) return false;
  if (S.JAW_ARCS.some(q => Math.hypot(q[0] - b.x, q[1] - b.y) < q[2] + R - 1e-5)) return false;
  return S.BUMPERS.every(q => Math.hypot(q[0] - b.x, q[1] - b.y) >= S.BUMPER_R + R - 1e-5);
}
const PER_TABLE = +(process.env.STRESS_SHOTS || 260);
const bad = { nan: [], escape: [], rest: [], overlap: [], off: [], judge: [] };
let shots = 0;
const sample = [];
for (const T of TABLES) {
  T.set();
  const rnd = S.rng(9001 + shots);
  let g = fresh(T.kind);
  for (let i = 0; i < PER_TABLE; i++) {
    /* ball in hand: a legal spot near the middle of what is allowed, else where it lies */
    if (g.inHand && g.kind !== 'bumper' && g.kind !== 'carom') {
      const spots = S.cpuSpots(g, S.cpuTargets(g), S.CPU_LEVELS.easy);
      if (spots.length) g = S.placeCue(g, spots[0][0], spots[0][1]);
    }
    const p = rnd(), shot = { angle: rnd() * 2 * Math.PI, power: p < 0.15 ? 0.95 + 0.05 * rnd() : p, spin: { x: rnd() * 2 - 1, y: rnd() * 2 - 1 }, ball: striker(g) };
    if (!g.balls.some(b => b.n === shot.ball && b.on)) { g = fresh(T.kind); continue; }
    /* simulateShot by hand, to read the table's escape count (a pool ball through a cushion) */
    const tab = S.strike(S.newTable(g.balls, shot.ball), shot.angle, shot.power, shot.spin);
    while (S.stepTable(tab));
    const r = S.resultOf(tab);
    shots++;
    const id = `${T.tag} #${i}`;
    if (r.balls.some(b => ![b.x, b.y, b.vx, b.vy, b.wx, b.wy, b.wz].every(Number.isFinite))) bad.nan.push(id);
    if (r.end !== 'rest') bad.rest.push(`${id} ${r.end}`);
    const up = r.balls.filter(b => b.on);
    if (up.some(b => !onBed(b))) bad.off.push(id);
    for (let a = 0; a < up.length; a++) for (let c = a + 1; c < up.length; c++) if (Math.hypot(up[a].x - up[c].x, up[a].y - up[c].y) < 2 * S.BALL_R - 1e-4) bad.overlap.push(`${id} ${up[a].n}/${up[c].n}`);
    /* a ball out of a pocketless table comes back by the rules; on a pool table nothing may leave */
    if (S.MOUTHS.length && (tab.escaped || r.potted.some(n => r.pocketOf[n] < 0))) bad.escape.push(id);
    if (i % 37 === 0) sample.push({ T, balls: g.balls.map(b => Object.assign({}, b)), shot, json: JSON.stringify(S.simulateShot(g.balls, shot)) });
    let n;
    try { n = S.judge(g, r); } catch (e) { bad.judge.push(`${id} ${e.message}`); g = fresh(T.kind); continue; }
    g = n.winner !== null ? fresh(T.kind) : n;
  }
}
check(`${shots} shots across ${TABLES.length} tables: every one comes to rest (no timeout)`, !bad.rest.length, bad.rest.slice(0, 5).join(', '));
check('no NaN anywhere in any result', !bad.nan.length, bad.nan.slice(0, 5).join(', '));
check('nothing escapes a pocketed table, every ball left up lies on the bed', !bad.escape.length && !bad.off.length, bad.escape.concat(bad.off).slice(0, 5).join(', '));
check('no two balls overlap at rest', !bad.overlap.length, bad.overlap.slice(0, 5).join(', '));
check('judge takes every result without throwing', !bad.judge.length, bad.judge.slice(0, 5).join(', '));
const diff = sample.filter(s => { s.T.set(); return JSON.stringify(S.simulateShot(s.balls, s.shot)) !== s.json; });
check(`determinism: ${sample.length} sampled shots re-run (after every table change) give byte-identical results`, !diff.length, diff.map(s => s.T.tag).join(', '));
console.log(`  (shots: ${secs()})`);

/* ---- 2. CPU against CPU ---- */
const CAP = 500;
function rackPlay(kind, level, set, seed0, opts) {
  set();
  let g = kind === 'snooker' ? S.snookerGame() : S.newGame(kind, opts);
  const log = [];
  let k = 0, seed = seed0;
  for (; k < CAP && g.winner === null; k++) {
    /* snooker's choice after a foul (free ball, put back): the CPU's answer, as the page plays it */
    if (kind === 'snooker' && g.option) { g = S.chooseOption(g, S.cpuOption(g, level)); log.push('o' + g.verdict.chose); continue; }
    const s = S.cpuShot(g, seed++, level);
    let g1 = s.place ? S.placeCue(g, s.place[0], s.place[1]) : g;
    if (g1.kind === 'bumper' && s.ball != null) { g1 = S.copyGame(g1); g1.striker = s.ball; }
    const r = S.simulateShot(g1.balls, { angle: s.angle, power: s.power, spin: s.spin, ball: striker(g1) });
    if (r.end !== 'rest' || r.balls.some(b => !Number.isFinite(b.x + b.y))) return { k, stuck: 'roll ' + r.end };
    g = S.judge(g1, r);
    log.push(s.angle.toFixed(9));
  }
  return { k, winner: g.winner, stuck: g.winner === null ? 'cap' : null, sig: log.join() + '|' + g.winner };
}
const RACKS = [
  ['9', 'easy', 150, () => S.setTable('7')], ['9', 'medium', 5, () => S.setTable('9')],
  ['8', 'easy', 40, () => S.setTable('7')], ['8', 'medium', 2, () => S.setTable('9')],
  ['bumper', 'easy', 3, () => S.setTable('bumper', 'octagon')], ['bumper', 'easy', 2, () => S.setTable('bumper', 'rect')],
  ['carom', 'easy', 3, () => S.setTable('carom'), { race: 5, cushions: 1 }],
  ['snooker', 'easy', 1, () => S.setTable('snooker', 'compact')],
];
let racks = 0, maxShots = 0;
const stuck = [], sigs = {};
for (const [kind, level, n, set, opts] of RACKS) {
  for (let i = 0; i < n; i++) {
    const o = rackPlay(kind, level, set, 1 + 7919 * i, opts);
    racks++; maxShots = Math.max(maxShots, o.k);
    if (o.stuck) stuck.push(`${kind}/${level} #${i}: ${o.stuck} after ${o.k}`);
    if (i === 0) sigs[kind + level] = { o, set, kind, level, opts };
  }
}
check(`CPU against CPU: ${racks} racks (8, 9, bumper, carom, snooker; easy and medium) all end, none stuck (longest ${maxShots} shots, cap ${CAP})`, !stuck.length, stuck.slice(0, 5).join(', '));
const redo = Object.values(sigs).filter(s => rackPlay(s.kind, s.level, s.set, 1, s.opts).sig !== s.o.sig);
check('CPU against CPU: each game replayed from its seeds is identical', !redo.length, redo.map(s => s.kind + s.level).join(', '));
console.log(`  (cpu: ${secs()})`);

/* ---- 3 and 4. the page ---- */
const KEYS = ['felt.settings', 'felt.tricks', 'felt.daily.v1', 'felt.record.v1', 'felt.lesson.v1', 'felt.tutorials.v1', 'felt.career.v1', 'felt.muted'];
const CORRUPT = ['{', 'null', '[]', '"x"', '123', 'true', '{"v":1}', '{"v":2,"kinds":{}}', '{"__proto__":{"polluted":1},"v":1}',
  '{"v":1,"kinds":{"8":{"played":-5,"cpu":{"easy":{"w":"x","l":1e400}}}},"best":{"pip":[1,0],"benny":"x","rosa":[2,5]},"won":99,"played":3,"streak":2.5}',
  '{"guide":"bogus","names":[{"a":1},"' + 'x'.repeat(3000) + '"],"last":"nope","level":"insane","table":9,"cpu":"yes","camV":2,"camera":"spin"}',
  '{"last":"2099-01-01","streak":1e9,"best":-1,"made":"y"}', '{"v":1,"done":{"8":true,"nope":true},"skipped":"x","never":"yes","seen":1}'];
/* every screen once: home, the sheets, a game of each kind with a shot, practice, a trick, the daily, a tutorial, the career */
const TOUR = async page => page.evaluate(async () => {
  const idle = () => new Promise(r => { const w = () => ['stroke', 'rolling', 'thinking'].includes(felt.state) ? setTimeout(w, 10) : r(); w(); });
  felt.speed = 40;
  felt.showStats(); felt.showCareer(); felt.showTricks(); felt.showHelp(); felt.showSetup('snooker'); felt.quitToHome();
  for (const k of ['8', '9', 'bumper', 'carom', 'snooker']) { felt.start(k); felt.shoot(0.1, 0.5, 0); await idle(); felt.pause(); felt.resume(); felt.quitToHome(); }
  felt.practice('scatter', 3); felt.shoot(0, 0.4, 0); await idle(); felt.undo(); felt.quitToHome();
  felt.trick('long'); felt.shoot(0, 0.4, 0); await idle(); felt.quitToHome();
  felt.daily(); felt.quitToHome(); felt.tutorial('9'); felt.quitToHome(); felt.careerPlay(); felt.quitToHome();
  felt.speed = 1;
  return { polluted: ({}).polluted === 1, state: felt.state, settings: typeof felt.settings.names[0] === 'string' && felt.settings.names[0].length <= 12 };
});

(async () => {
  /* round trips: write every record through the game, reload, read it back identical */
  {
    const { browser, page, errors } = await open('', { viewport: { width: 440, height: 956 }, hasTouch: true, isMobile: true });
    const snap = () => page.evaluate(keys => Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)])), KEYS);
    const reads = () => page.evaluate(() => JSON.stringify([felt.settings, felt.record, felt.trickBest, felt.dailyRec, felt.lessonRec, felt.tutRec, felt.careerRec]));
    let same = 0, trips = 0;
    const rounds = [];
    for (let i = 0; i < 12; i++) {
      await page.evaluate(i => {
        felt.today = `2026-04-${String(10 + i).padStart(2, '0')}`;
        document.getElementById(['clGreen', 'clRed', 'clBlue'][i % 3]).click();
        document.getElementById(i % 2 ? 'tb9' : 'tb7').click();
        document.getElementById(i % 2 ? 'sndOff' : 'sndOn').click();
        felt.start(['8', '9', 'bumper', 'carom', 'snooker'][i % 5]); felt.forceWin(i % 2);
        felt.quitToHome();
      }, i);
      const before = await reads(), raw = await snap();
      await page.reload();
      await page.waitForFunction(() => window.booted === true);
      const after = await reads(), raw2 = await snap();
      trips++;
      if (before === after && JSON.stringify(raw) === JSON.stringify(raw2)) same++; else rounds.push(i);
    }
    const kept = await page.evaluate(() => felt.record);
    check(`storage round trips: ${trips} write, reload, read cycles each read back exactly what was written`, same === trips, 'differs at ' + rounds.join(','));
    check('storage round trips: the game record counts every game played', Object.values(kept.kinds).reduce((a, k) => a + k.played, 0) === 12, JSON.stringify(kept.kinds));
    check('storage round trips: no console errors', errors.length === 0, errors.join(' | '));
    await browser.close();
  }
  /* corrupted records, a storage that throws, a full storage */
  {
    const fails = [];
    const { browser, page, errors } = await open('');
    for (const v of CORRUPT) {
      await page.evaluate(([keys, v]) => { for (const k of keys) localStorage.setItem(k, v); }, [KEYS, v]);
      await page.reload();
      await page.waitForFunction(() => window.booted === true);
      const t = await TOUR(page).catch(e => ({ err: String(e) }));
      if (t.err || t.polluted || !t.settings || errors.length) fails.push({ v: v.slice(0, 30), t, errors: errors.splice(0) });
    }
    await browser.close();
    check(`storage corruption: ${CORRUPT.length} kinds of bad record in every key: boot, every screen, no pollution, no console errors`, !fails.length, JSON.stringify(fails).slice(0, 600));
    const odd = [];
    for (const [tag, init] of [
      ['throwing', '(() => { const t = () => { throw new DOMException("denied", "SecurityError"); }; Storage.prototype.getItem = t; Storage.prototype.setItem = t; })()'],
      ['full', '(() => { Storage.prototype.setItem = () => { throw new DOMException("full", "QuotaExceededError"); }; })()'],
    ]) {
      const { browser, page, errors } = await open('', { init });
      const t = await TOUR(page).catch(e => ({ err: String(e) }));
      if (t.err || errors.length) odd.push({ tag, t, errors });
      await browser.close();
    }
    check('storage that throws on every access, and a full storage: the game plays on, nothing on the console', !odd.length, JSON.stringify(odd).slice(0, 600));
  }
  /* rapid navigation, resizes, replays, pauses */
  {
    const { browser, page, errors } = await open('', { viewport: { width: 440, height: 956 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const SIZES = [[440, 956], [956, 440], [375, 667], [1280, 800], [667, 375]];
    const rnd = S.rng(4242);
    let taps = 0, bad = null;
    for (let i = 0; i < 200 && !bad; i++) {
      const r = rnd();
      if (r < 0.06) await page.setViewportSize({ width: SIZES[i % 5][0], height: SIZES[i % 5][1] });
      else if (r < 0.12) await page.evaluate(k => { felt.quitToHome(); felt.start(k); felt.speed = 20; felt.shoot(1, 0.6, 0); }, ['8', '9', 'bumper', 'carom', 'snooker'][i % 5]);
      else if (r < 0.16) await page.evaluate(() => { felt.replay(); });
      else if (r < 0.2) await page.keyboard.press('Escape');
      else {
        /* a tap on a visible enabled control, the power bar aside (a tap never shoots anyway) */
        const ok = await page.evaluate(u => {
          const els = [...document.querySelectorAll('button, [role="slider"]')].filter(b => b.id !== 'powerBar' && !b.disabled && b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden' && b.offsetParent !== null);
          if (!els.length) return false;
          els[Math.floor(u * els.length)].click();
          return true;
        }, rnd());
        if (ok) taps++;
      }
      const st = await page.evaluate(() => ({ s: felt.state, ok: ['menu', 'aim', 'stroke', 'rolling', 'thinking', 'over'].includes(felt.state) }));
      if (!st.ok) bad = st;
    }
    await page.evaluate(() => { felt.speed = 1; });
    check(`navigation: ${taps} rapid taps among resizes, rotations, game starts, replays and Esc: always a known state`, !bad, JSON.stringify(bad));
    check('navigation: no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    /* the table fuzz: random touches, drags and keys over the table never shoot */
    await page.setViewportSize({ width: 440, height: 956 });
    await page.evaluate(() => { felt.quitToHome(); felt.start('8'); });
    await page.waitForFunction(() => felt.state === 'aim');
    const cdp = await page.context().newCDPSession(page);
    const box = await page.evaluate(() => { const t = felt.tableRect(), b = powerBar.getBoundingClientRect(); return { t, b: [b.left, b.top, b.right, b.bottom] }; });
    const pt = () => { for (;;) { const x = box.t.left + rnd() * (box.t.right - box.t.left), y = box.t.top + rnd() * (box.t.bottom - box.t.top); if (!(x > box.b[0] - 30 && x < box.b[2] + 30 && y > box.b[1] - 30 && y < box.b[3] + 30)) return [x, y]; } };
    let fired = 0;
    const KEYSET = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' ', 'm', 'r', 'b', 'Shift+ArrowLeft', 'Alt+ArrowRight'];
    for (let i = 0; i < 120; i++) {
      const u = rnd();
      if (u < 0.45) {
        let p = pt();
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p[0], y: p[1], id: 1 }] });
        for (let j = 0, n = Math.floor(rnd() * 8); j < n; j++) { p = [p[0] + (rnd() - 0.5) * 120, p[1] + (rnd() - 0.5) * 120]; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p[0], y: p[1], id: 1 }] }); }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else if (u < 0.75) {
        const p = pt(), q = pt();
        await page.mouse.move(p[0], p[1]); await page.mouse.down(); await page.mouse.move(q[0], q[1], { steps: 4 }); await page.mouse.up();
      } else await page.keyboard.press(KEYSET[Math.floor(rnd() * KEYSET.length)]);
      const s = await page.evaluate(() => felt.state);
      if (s === 'stroke' || s === 'rolling') fired++;
      if (s === 'menu') await page.evaluate(() => { if (felt.paused) felt.resume(); });
    }
    check('table fuzz: 120 random touches, drags and keys over the table and nothing fires a shot (only the bar shoots)', fired === 0, `fired ${fired}`);
    check('table fuzz: no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await browser.close();
  }
  console.log(`  (total: ${secs()})`);
  done();
})().catch(e => { console.error(e); process.exit(1); });
