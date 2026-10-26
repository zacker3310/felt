/* moments-check: shot moments, the game-over sheet, the sound and the haptics.
   Sim (Node): shotMoments classifies constructed shots run through simulateShot and judge: a
   routine straight pot (nothing), a bank, a kick, a combo, a long pot, a double and a triple, a
   golden break, a clean break, a run out and a break and run, bumper pool's bank and double; and
   it is pure. Page: the live roll equals simulateShot as JSON (railAt too); a bank raises its
   callout (off the cue ball, taking no input) and a straight pot raises none; a winning run out
   shows on the game-over sheet with both players' numbers, whose buttons work and whose text and
   targets pass; the haptic switch never fires before a gesture or with Haptics off, ticks at
   most once per HAP_GAP, never moves focus or changes the game; every sfx kind plays without
   throwing. */
'use strict';
const { check, done, open, settled, smallTargets, lowContrast } = require('./lib.cjs');
const { loadSim } = require('./sim.cjs');

const S = loadSim();
S.setTable('7'); S.setPockets('regulation');
const R = S.BALL_R;
/* a game of `kind` with only these balls on the table */
function layout(kind, pos, extra = {}) {
  const g = S.newGame(kind);
  for (const b of g.balls) { const p = pos[b.n]; if (p) Object.assign(b, { x: p[0], y: p[1], on: true }); else b.on = false; }
  return Object.assign(g, { breakShot: false, inHand: null }, extra);
}
const ghost = (o, t) => { const d = Math.hypot(t[0] - o[0], t[1] - o[1]); return [o[0] - 2 * R * (t[0] - o[0]) / d, o[1] - 2 * R * (t[1] - o[1]) / d]; };
const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
function run(g, angle, power, visit) {
  const r = S.simulateShot(g.balls.filter(b => b.on), { angle, power, spin: 0, ball: 0 });
  const n = S.judge(g, r);
  return { r, n, m: S.shotMoments(g, r, n, visit) };
}
/* the first angle (fanning out from base) and power whose shot satisfies want */
function find(g, base, powers, want, span = 0.03, steps = 121) {
  for (const p of powers) for (let i = 0; i < steps; i++) {
    const k = i % 2 ? (i + 1) / 2 : -i / 2, a = base + k * span / steps * 2, o = run(g, a, p);
    if (want(o)) return { a, p, o };
  }
  return null;
}
const has = k => o => o.m.keys.includes(k);
const say = f => f ? JSON.stringify({ keys: f.o.m.keys, legal: f.o.m.legal, potted: f.o.r.potted, foul: f.o.n.verdict.foul }) : 'none found';
const P = S.POCKET_AIM;

/* 1. the sim: constructed shots */
const straight = (() => {
  const o = [1.5, 0.7], t = P[5], c = [o[0] - 0.5 * (t[0] - o[0]), o[1] - 0.5 * (t[1] - o[1])];
  const g = layout('9', { 0: c, 1: o, 9: [0.5, 0.3] });
  return { g, f: find(g, ang(c, ghost(o, t)), [0.3], o => o.r.potted.includes(1) && !o.n.verdict.foul) };
})();
check('a routine straight pot is no moment', straight.f && straight.f.o.m.legal === 1 && straight.f.o.m.keys.length === 0, say(straight.f));
const bank = (() => {
  const o = [1.2, 0.3], t = [P[0][0], 2 * (S.TW - R) - P[0][1]], c = [1.5, 0.15];
  const g = layout('9', { 0: c, 1: o, 9: [1.7, 0.8] });
  return { g, f: find(g, ang(c, ghost(o, t)), [0.35, 0.45], has('bank'), 0.08, 241) };
})();
check('bank: the 1 off the far rail into a corner', bank.f && bank.f.o.m.keys[0] === 'bank' && bank.f.o.r.potted.includes(1), say(bank.f));
const kick = (() => {
  const o = [1.85, 0.13], gp = ghost(o, P[2]), c = [0.6, 0.45], m = [gp[0], 2 * (S.TW - R) - gp[1]];
  const g = layout('9', { 0: c, 1: o, 9: [0.3, 0.8] });
  return find(g, ang(c, m), [0.4, 0.5], has('kick'), 0.06, 241);
})();
check('kick: the cue ball off a cushion first, then the pot', kick && kick.o.r.kick > 0 && kick.o.m.legal === 1, say(kick));
const combo = (() => {
  const b2 = [1.7, 0.75], t = P[5], b1g = ghost(b2, t), b1 = [b1g[0] - 0.25 * (t[0] - b2[0]), b1g[1] - 0.25 * (t[1] - b2[1])];
  const c = [b1[0] - 0.4 * (t[0] - b2[0]), b1[1] - 0.4 * (t[1] - b2[1])];
  const g = layout('9', { 0: c, 1: b1, 2: b2, 9: [0.4, 0.2] });
  return find(g, ang(c, ghost(b1, b1g)), [0.4], has('combo'), 0.06, 241);
})();
check('combo: the 1 sends the 2 in', combo && combo.o.r.first === 1 && combo.o.r.potted.includes(2) && !combo.o.r.potted.includes(1), say(combo));
const long = (() => {
  const o = [0.45, 0.35], c = [0.2, 0.2];
  const g = layout('9', { 0: c, 1: o, 9: [1.0, 0.9] });
  return find(g, ang(c, ghost(o, P[5])), [0.45, 0.55], has('long'), 0.02, 121);
})();
check('long pot: the length of the table, and a graze on the nose by the pocket is no bank', long && long.o.m.keys.join() === 'long' && long.o.r.rails[1] > 0, say(long) + ' rails ' + JSON.stringify(long && long.o.r.rails));
const cluster = layout('8', { 0: [0.7, 0.5], 1: [0.95, 0.5], 2: [1.0, 0.47], 3: [1.0, 0.53], 4: [1.05, 0.44], 5: [1.05, 0.5], 6: [1.05, 0.56], 8: [0.3, 0.8], 9: [0.4, 0.2] },
  { open: false, groups: ['solids', 'stripes'] });
let dbl = null, tpl = null;
for (const p of [0.6, 0.8, 1.0]) for (let i = -40; i <= 40 && !(dbl && tpl); i++) {
  const o = run(cluster, i * 0.003, p);
  if (!dbl && o.m.keys.includes('double')) dbl = { a: i * 0.003, p, o };
  if (!tpl && o.m.keys.includes('triple')) tpl = { a: i * 0.003, p, o };
}
check('double: two of the group down, legally', dbl && dbl.o.m.legal === 2 && !dbl.o.n.verdict.foul, say(dbl));
check('triple: three or more down, legally (never also a double)', tpl && tpl.o.m.legal >= 3 && !tpl.o.m.keys.includes('double'), say(tpl));
const golden = (() => {
  const b9 = [1.7, 0.75], t = P[5], g1 = ghost(b9, t), b1 = [g1[0] - 0.2 * (t[0] - b9[0]), g1[1] - 0.2 * (t[1] - b9[1])];
  const c = [b1[0] - 0.5 * (t[0] - b9[0]), b1[1] - 0.5 * (t[1] - b9[1])];
  const g = layout('9', { 0: c, 1: b1, 9: b9 }, { breakShot: true });
  return find(g, ang(c, ghost(b1, g1)), [0.5], has('golden'), 0.06, 241);
})();
check('golden break: the 9 on the break wins, and only that is called', golden && golden.o.n.verdict.win === 0 && golden.o.m.keys.join() === 'golden', say(golden));
const brk = (() => {
  const g = S.newGame('8'), c = g.balls.find(b => b.n === 0);
  c.x = S.HEAD_X - 0.1; c.y = S.TW / 2 + 0.05;
  for (let i = 0; i < 60; i++) { const a = ang([c.x, c.y], S.FOOT) + (i - 30) * 0.0015, o = run(g, a, 1); if (o.m.keys.includes('cleanBreak')) return { a, p: 1, o }; }
  return null;
})();
check('clean break: two or more down on the break, no foul, and no double or combo called with it', brk && brk.o.r.potted.filter(n => n).length >= 2 && brk.o.m.keys.join() === 'cleanBreak', say(brk));
const win8 = (() => {
  const o = [1.5, 0.7], t = P[5], c = [o[0] - 0.5 * (t[0] - o[0]), o[1] - 0.5 * (t[1] - o[1])];
  const g = layout('8', { 0: c, 8: o, 9: [0.5, 0.3] }, { open: false, groups: ['solids', 'stripes'] });
  const f = find(g, ang(c, ghost(o, t)), [0.3], o => o.n.verdict.win === 0);
  return f && { g, f };
})();
const mo = v => win8 && run(win8.g, win8.f.a, win8.f.p, v).m.keys.join();
check('run out: the 8 to win at the end of a visit of seven; break and run when the visit began with the break; a short visit is neither',
  mo({ pots: 7, fromBreak: false }) === 'runOut' && mo({ pots: 7, fromBreak: true }) === 'breakRun' && mo({ pots: 1, fromBreak: false }) === '' && mo(undefined) === '',
  JSON.stringify([mo({ pots: 7, fromBreak: false }), mo({ pots: 7, fromBreak: true }), mo({ pots: 1, fromBreak: false })]));
{
  /* 9-ball: an early 9 after a run of pots wins, but leaves balls up: no run out */
  const g = layout('9', { 0: [1.0, 0.5], 9: [1.5, 0.7], 5: [0.3, 0.3] });
  const n = Object.assign(S.copyGame(g), { winner: 0, verdict: { foul: null, win: 0, potted: [9] }, balls: g.balls.map(b => Object.assign({}, b, { on: b.on && b.n !== 9 })) });
  const r = { potted: [9], first: 9, rails: {}, railAt: {}, pocketOf: { 9: 5 }, contacts: [[0, 9]], kick: 0, cue: 0 };
  const left = S.shotMoments(g, r, n, { pots: 6, fromBreak: false }).keys.join();
  n.balls.find(b => b.n === 5).on = false;
  const clear = S.shotMoments(g, r, n, { pots: 6, fromBreak: false }).keys.join();
  check('9-ball: a run out needs the table clear', left === '' && clear === 'runOut', JSON.stringify([left, clear]));
}
{
  /* bumper pool: a legal pot off a cushion is a bank; two down is a double; nothing else is known */
  S.setTable('bumper', 'rect');
  const g = S.newGame('bumper'); g.opening = 0; g.striker = 22;
  const n = Object.assign(S.copyGame(g), { verdict: { foul: null, potted: [22, 23], win: null } });
  const cup = S.POCKETS[1];
  const r = { potted: [22, 23], first: 24, cue: 22, rails: { 22: 1 }, railAt: { 22: [cup[0] - 0.5, 0.03] }, pocketOf: { 22: 1, 23: 1 }, contacts: [[22, 24], [23, 24]], kick: 1 };
  const m = S.shotMoments(g, r, n);
  const foul = S.shotMoments(g, r, Object.assign({}, n, { verdict: { foul: 'into your own cup', potted: [] } }));
  check('bumper pool: bank and double only (no kick or combo), nothing on a foul', m.keys.join() === 'bank,double' && m.legal === 2 && foul.keys.length === 0, JSON.stringify([m, foul]));
  S.setTable('7'); S.setPockets('regulation');
}
{
  const g = bank.g, r = bank.f.o.r, n = bank.f.o.n, before = JSON.stringify([g, r, n]);
  S.shotMoments(g, r, n, { pots: 2, fromBreak: false });
  check('shotMoments is pure: the game, the result and the judged game are untouched', JSON.stringify([g, r, n]) === before);
}

(async () => {
  /* 2. the page. Haptics take the switch path (Safari's input switch, faked) so the label's
     clicks can be counted */
  const { browser, page, errors } = await open('', {
    viewport: { width: 440, height: 956 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2,
    init: () => Object.defineProperty(HTMLInputElement.prototype, 'switch', { value: false, writable: true, configurable: true }),
  });
  await page.evaluate(() => { window.__taps = 0; hapTick.addEventListener('click', () => { window.__taps++; }); });
  const setUp = (pos, kind = '9') => page.evaluate(([pos, kind]) => {
    setSetting('table', '7'); setSetting('pockets', 'regulation'); settings.cpu = false; settings.autoAim = false;
    felt.start(kind); felt.speed = 30;
    for (const b of game.balls) { const p = pos[b.n]; if (p) Object.assign(b, { x: p[0], y: p[1], on: true }); else b.on = false; }
    game.breakShot = false; game.inHand = null; hud();
  }, [pos, kind]);

  /* a bank in a real game: the callout, the live result equal to simulateShot as JSON */
  await setUp({ 0: [1.5, 0.15], 1: [1.2, 0.3], 9: [1.7, 0.8] });
  const want = await page.evaluate(([a, p]) => JSON.stringify(simulateShot(game.balls, { angle: a, power: p, spin: 0 })), [bank.f.a, bank.f.p]);
  await page.evaluate(([a, p]) => felt.shoot(a, p, 0), [bank.f.a, bank.f.p]);
  await settled(page);
  const c1 = await page.evaluate(() => {
    const r = callout.getBoundingClientRect(), cs = getComputedStyle(callout), c = game.balls.find(b => b.n === 0), s = c.on ? felt.toScreen(c.x, c.y) : null;
    return { text: calloutText.textContent, shown: callout.classList.contains('show'), pe: cs.pointerEvents, anim: cs.animationName,
      overCue: !!s && s[0] > r.left - 4 && s[0] < r.right + 4 && s[1] > r.top - 4 && s[1] < r.bottom + 4, notes: stats.notes[0], pots: stats.pots[0], last: stats.last };
  });
  check('live roll equals simulateShot as JSON (railAt included)', await page.evaluate(() => JSON.stringify(felt.lastResult)) === want);
  check('a bank calls out "Bank shot": shown, off the cue ball, taking no touches, counted', c1.text === 'Bank shot' && c1.shown && c1.pe === 'none' && c1.anim === 'callIn' && !c1.overCue && c1.notes.bank === 1 && c1.pots === 1, JSON.stringify(c1));
  await page.waitForTimeout(1500);
  check('the callout is gone after about 1.2 s', await page.evaluate(() => !callout.classList.contains('show') && getComputedStyle(callout).visibility === 'hidden'));

  /* a routine straight pot: no callout */
  const sc = straight.g.balls.find(b => b.n === 0);
  await setUp({ 0: [sc.x, sc.y], 1: [1.5, 0.7], 9: [0.5, 0.3] });
  await page.evaluate(([a, p]) => felt.shoot(a, p, 0), [straight.f.a, straight.f.p]);
  await settled(page);
  const c2 = await page.evaluate(() => ({ shown: callout.classList.contains('show'), last: stats.last, pots: stats.pots[0], potted: felt.lastResult.potted }));
  check('a routine straight pot raises no callout', !c2.shown && c2.last.length === 0 && c2.pots === 1 && c2.potted.includes(1), JSON.stringify(c2));

  /* reduced motion: a plain fade */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const rm = await page.evaluate(() => { felt.showCallout('Combo'); return getComputedStyle(callout).animationName; });
  check('reduced motion: the callout only fades', rm === 'callFade', rm);
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  /* a winning run out in 8-ball: the sheet with its chip and both players' numbers */
  const wc = win8.g.balls.find(b => b.n === 0);
  await setUp({ 0: [wc.x, wc.y], 8: [1.5, 0.7], 9: [0.5, 0.3] }, '8');
  await page.evaluate(() => {
    game.open = false; game.groups = ['solids', 'stripes'];
    Object.assign(stats, { shots: [6, 3], pots: [6, 1], best: [6, 1], potted: [[1, 2, 3, 4, 5, 6], [9]], visit: { p: 0, pots: 6, fromBreak: false }, notes: [{ bank: 2, combo: 1 }, {}] });
  });
  await page.evaluate(([a, p]) => felt.shoot(a, p, 0), [win8.f.a, win8.f.p]);
  await settled(page);
  const ov = await page.evaluate(() => ({ st: felt.state, title: overText.textContent, chips: [...overNotes.children].map(e => e.textContent), top: overNotes.firstChild && overNotes.firstChild.className,
    rows: [...overStats.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(c => c.textContent)), mood: over.dataset.mood, ball: overBall.textContent }));
  check('a run out wins: the chip says so, in the accent', ov.st === 'over' && ov.chips.join() === 'Run out' && ov.top === 'top' && ov.mood === 'win' && ov.ball === '8', JSON.stringify(ov));
  const row = n => (ov.rows.find(r => r[0] === n) || []).slice(1);
  check('the sheet: best run, accuracy, fouls and shots of note for both players', row('Best run').join() === '7,1' && row('Accuracy').join() === '100%,33%' && row('Fouls').join() === '0,0'
    && /Run out, Combo, Bank ×2/.test(row('Shots of note')[0]) && row('Shots of note')[1] === 'None', JSON.stringify(ov.rows));
  for (const cloth of ['green', 'red']) {
    await page.evaluate(c => { document.documentElement.dataset.cloth = c; }, cloth);
    const lc = await lowContrast(page), st = await smallTargets(page);
    check(`game over on the ${cloth} cloth: text 4.5:1, targets 44 px`, lc.length === 0 && st.length === 0, JSON.stringify([lc, st]));
  }
  await page.evaluate(() => { document.documentElement.dataset.cloth = settings.cloth; });
  await page.click('#overMenu');
  check('Menu goes to the menu', await page.evaluate(() => menu.classList.contains('show') && !over.classList.contains('show') && felt.state === 'menu'));
  await page.evaluate(() => felt.forceWin(1));
  const q = await page.evaluate(() => ({ chips: overNotes.children.length, rows: overStats.querySelectorAll('tbody tr').length, vis: getComputedStyle(over).display }));
  check('forceWin: the sheet shows the numbers, no chips for a forced win', q.vis !== 'none' && q.rows === 5 && q.chips === 0, JSON.stringify(q));
  await page.click('#rematch');
  check('Rematch starts a fresh rack', await page.evaluate(() => felt.state === 'aim' && felt.game.shots === 0 && felt.game.winner === null && felt.stats.best.join() === '0,0'));

  /* 3. haptics */
  const fresh = await open('', { init: () => Object.defineProperty(HTMLInputElement.prototype, 'switch', { value: false, writable: true, configurable: true }) });
  const hp = fresh.page;
  await hp.evaluate(() => { window.__taps = 0; hapTick.addEventListener('click', () => { window.__taps++; }); felt.start('8'); });
  const pre = await hp.evaluate(() => { sfx('foul', 1); sfx('ball', 5); return { taps: __taps, armed: felt.haptics.armed, via: felt.haptics.viaSwitch }; });
  check('haptics: nothing before the first gesture', pre.taps === 0 && !pre.armed && pre.via, JSON.stringify(pre));
  await hp.keyboard.press('Shift');
  const h = await hp.evaluate(async () => {
    spinPad.focus();
    const before = { el: document.activeElement.id, game: JSON.stringify(felt.game), state: felt.state, scroll: [scrollX, scrollY] };
    const t0 = __taps;
    for (let i = 0; i < 25; i++) sfx('ball', 4);
    const burst = __taps - t0;
    sfx('ball', 0.3);
    await new Promise(r => setTimeout(r, 80));
    sfx('ball', 4);
    const later = __taps - t0;
    await new Promise(r => setTimeout(r, 80));
    const p0 = __taps; sfx('pocket', 1); await new Promise(r => setTimeout(r, 200)); const pocket = __taps - p0;
    const w0 = __taps; sfx('win', 1); await new Promise(r => setTimeout(r, 400)); const win = __taps - w0;
    const f0 = __taps; sfx('foul', 1); await new Promise(r => setTimeout(r, 100)); const foul = __taps - f0;
    const after = { el: document.activeElement.id, game: JSON.stringify(felt.game), state: felt.state, scroll: [scrollX, scrollY] };
    return { burst, later, pocket, win, foul, same: JSON.stringify(before) === JSON.stringify(after), el: after.el, checked: hapTick.firstElementChild.checked, count: felt.haptics.count };
  });
  check('haptics: a burst of hard contacts ticks once (rate limited), a soft one never, the next after the gap', h.burst === 1 && h.later === 2, JSON.stringify(h));
  check('haptics: a pot two ticks, a win three, a foul one', h.pocket === 2 && h.win === 3 && h.foul === 1, JSON.stringify(h));
  check('haptics: the switch clicks never move focus, scroll or touch the game', h.same && h.el === 'spinPad', JSON.stringify(h));
  await hp.evaluate(() => { showMenu(); openSheet(prefsSheet, prefsBack); });
  await hp.click('#hapOff');
  const off = await hp.evaluate(async () => { const t = __taps; sfx('foul', 1); sfx('pocket', 1); await new Promise(r => setTimeout(r, 200)); return { taps: __taps - t, s: settings.haptics, ls: JSON.parse(localStorage.getItem('felt.settings')).haptics, pressed: hapOff.getAttribute('aria-pressed') }; });
  check('haptics: Settings turns them off (remembered), and then nothing ticks', off.taps === 0 && off.s === false && off.ls === false && off.pressed === 'true', JSON.stringify(off));
  await hp.click('#hapOn');
  check('haptics: back on, a tick to say so', await hp.evaluate(() => settings.haptics === true && hapOn.getAttribute('aria-pressed') === 'true'));
  const hidden = await hp.evaluate(() => ({ disp: getComputedStyle(hapTick).display, aria: hapTick.getAttribute('aria-hidden'), tab: hapTick.firstElementChild.tabIndex, sw: hapTick.firstElementChild.hasAttribute('switch') }));
  check('haptics: the switch is not rendered, hidden from assistive tech, never tabbable', hidden.disp === 'none' && hidden.aria === 'true' && hidden.tab === -1 && hidden.sw, JSON.stringify(hidden));
  check('haptics page: no console errors', fresh.errors.length === 0, fresh.errors.join(' | '));
  await fresh.browser.close();

  /* Android: navigator.vibrate takes the place of the switch */
  const and = await open('', { init: () => { navigator.vibrate = () => { window.__vib = (window.__vib || 0) + 1; return true; }; } });
  await and.page.keyboard.press('Shift');
  const v = await and.page.evaluate(async () => { sfx('pocket', 1); await new Promise(r => setTimeout(r, 200)); return { vib: window.__vib || 0, via: felt.haptics.viaSwitch }; });
  check('haptics: navigator.vibrate where there is no switch (Android)', v.vib === 2 && !v.via, JSON.stringify(v));
  await and.browser.close();

  /* 4. sound: every kind at every level, never a throw, the context running */
  const snd = await page.evaluate(async () => {
    audioOn(); await new Promise(r => setTimeout(r, 100));
    const bad = [];
    for (const k of [...Object.keys(VOICE), 'nonsense']) for (const v of [undefined, 0, 0.03, 0.2, 1, 3, 6, 9, 20]) {
      try { sfx(k, v); sfxAt(k, v, ac.currentTime + 0.5 + Math.random() * 0.5); } catch (e) { bad.push(k + ':' + v + ':' + e.message); }
    }
    return { bad, state: ac.state, kinds: Object.keys(VOICE) };
  });
  check('sfx: every kind at every level plays without throwing', snd.bad.length === 0 && snd.state === 'running' && ['ball', 'cue', 'rail', 'jaw', 'pocket', 'brk', 'foul', 'turn', 'win', 'tap', 'moment'].every(k => snd.kinds.includes(k)), JSON.stringify(snd));
  check('no console errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
