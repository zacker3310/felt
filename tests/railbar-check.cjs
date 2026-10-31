#!/usr/bin/env node
/* railbar-check: the bottom rail's row (page 6b2, placeRail): the 3D switch, snooker's scoreboard and the
   replay (its offer pill, the badge and Skip while one plays) sit together on the rail nearest the player,
   top-down on the table's bottom rail and in 3D on the stage's bottom row (V3_PIN_B).
   For every game and table (8-ball 7 ft and 9 ft, 9, 10, 14.1, rotation, bumper octagon and rectangle,
   snooker 10 ft and 12 ft, carom), upright (393x852, 375x667, 440x956) and on its side (852x393, 667x375),
   top-down and in 3D, with and without the replay's offer:
   - no item (its 44 px target or its pill) covers any pocket: the hole's circle (POCKET_R) and its jaws
     (MOUTHS) as the screen shows them (top-down through the fitted view, in 3D as projected);
   - no item overlaps another; every target is 44 px and inside the stage;
   - top-down every item sits on the bottom rail (the scoreboard on it in snooker), in 3D on the bottom row;
   - the scoreboard shows whenever the replay does not (and gives way first when the rail is short).
   Then the replay playing (the badge and Skip), and what rises clear of the row: the call bar (WPA 10-ball),
   the exhibition's bar, the practice tools and a tutorial's coach card. */
'use strict';
const { check, done, open } = require('./lib.cjs');

const SIZES = [[393, 852], [375, 667], [440, 956], [852, 393], [667, 375]];
const TABLES = [['8', {}], ['8', { table: '9' }], ['9', {}], ['10', {}], ['straight', {}], ['rotation', {}], ['bumper', { bumperTable: 'octagon' }],
  ['bumper', { bumperTable: 'rect' }], ['snooker', { snooker: 'compact' }], ['snooker', { snooker: 'full' }], ['carom', {}]];
const frames = (page, n = 2) => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

/* in the page: every item of the row against the pockets, each other, the stage and the rail */
function audit() {
  const st = stage.getBoundingClientRect(), live = felt.view3.live, B = viewBase, R = felt.camRect(), rail = RAIL * B.k;
  const at = (x, y) => { if (live) { const q = felt.v3Proj(x, y, 0); return q ? [q[0], q[1]] : null; } return screenIn(B, x, y); };
  /* the pockets on screen: each hole a circle, its jaws as points along the mouth's outline */
  const holes = [], jaws = [];
  POCKETS.forEach((p, i) => {
    const c = at(p[0], p[1]), r = POCKET_R[i];
    if (!c) return;
    const rs = [[r, 0], [-r, 0], [0, r], [0, -r]].map(d => at(p[0] + d[0], p[1] + d[1])).filter(Boolean).map(q => Math.hypot(q[0] - c[0], q[1] - c[1]));
    holes.push({ i, c, r: Math.max(...rs) });
    const m = MOUTHS[i];
    if (!m) return;
    const poly = [m[0].p, m[0].e, m[1].e, m[1].p];
    for (let e = 0; e < 4; e++) for (let t = 0; t <= 10; t++) {
      const a = poly[e], b = poly[(e + 1) % 4], q = at(a[0] + (b[0] - a[0]) * t / 10, a[1] + (b[1] - a[1]) * t / 10);
      if (q) jaws.push({ i, q });
    }
  });
  const box = q => ({ l: q.left, t: q.top, r: q.right, b: q.bottom });
  const items = [];
  for (const el of [viewBtn, snkBar, replayBtn, replayBadge, replaySkip]) {
    if (el.hidden || getComputedStyle(el).visibility === 'hidden') continue;
    const t = el.getBoundingClientRect();
    if (!t.width) continue;
    const pill = el === snkBar ? t : el.firstElementChild.getBoundingClientRect();
    items.push({ id: el.id, target: box(t), pill: box(pill), button: el.tagName === 'BUTTON' });
  }
  const fails = [];
  const hitCircle = (q, h) => Math.hypot(Math.max(q.l - h.c[0], 0, h.c[0] - q.r), Math.max(q.t - h.c[1], 0, h.c[1] - q.b)) < h.r;
  const inBox = (q, p) => p[0] > q.l && p[0] < q.r && p[1] > q.t && p[1] < q.b;
  const over = (a, b) => a.l < b.r - 0.5 && a.r > b.l + 0.5 && a.t < b.b - 0.5 && a.b > b.t + 0.5;
  for (const it of items) for (const q of [it.target, it.pill]) {
    for (const h of holes) if (hitCircle(q, h)) fails.push(`${it.id} covers pocket ${h.i}'s hole`);
    for (const j of jaws) if (inBox(q, j.q)) { fails.push(`${it.id} covers pocket ${j.i}'s jaws`); break; }
  }
  for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) {
    const x = items[a], y = items[b];
    if (over(x.target, y.target) || over(x.pill, y.pill)) fails.push(`${x.id} overlaps ${y.id}`);
  }
  for (const it of items) {
    const q = it.target, cy = (it.pill.t + it.pill.b) / 2;
    if (it.button && Math.min(q.r - q.l, q.b - q.t) < 44) fails.push(`${it.id} target under 44 px`);
    if (q.l < st.left - 0.5 || q.r > st.right + 0.5 || q.t < st.top - 0.5 || q.b > st.bottom + 0.5) fails.push(`${it.id} outside the stage`);
    if (live ? cy < st.bottom - 52 || cy > st.bottom : cy < R.bottom - rail - 1 || cy > R.bottom + 1) fails.push(`${it.id} off the ${live ? 'bottom row' : 'bottom rail'} (${cy.toFixed(1)})`);
  }
  return { live, fails, items: items.map(i => [i.id, Math.round(i.pill.l), Math.round(i.pill.r), Math.round((i.pill.t + i.pill.b) / 2)]), holes: holes.length,
    snk: !snkBar.hidden, snkShown: items.some(i => i.id === 'snkBar'), view: items.some(i => i.id === 'viewBtn'), offer: items.some(i => i.id === 'replayBtn'), text: snkBar.textContent };
}
/* the replay's offer as frame() makes it after a shot (the pill, its words), held for the check */
function offerNow(notable) {
  offer = { rec: null, notable: notable ? 'bank' : null, until: performance.now() + 1e7 };
  replayBtn.toggleAttribute('data-notable', !!notable);
  replayBtn.hidden = false;
  placeReplay();
}
/* a rect from the page against the row's items */
function clearOfRow(sel) {
  const el = document.querySelector(sel);
  if (!el || el.hidden || !el.getClientRects().length) return { shown: false };
  const q = el.getBoundingClientRect(), st = stage.getBoundingClientRect();
  if (q.left < st.left - 0.5 || q.right > st.right + 0.5) return { shown: true, hits: ['outside the stage'], rect: [q.left, q.right] };
  const hits = [viewBtn, snkBar, replayBtn, replayBadge, replaySkip].filter(e => !e.hidden && getComputedStyle(e).visibility !== 'hidden').map(e => [e.id, e.getBoundingClientRect()])
    .filter(([, r]) => r.width && q.left < r.right - 0.5 && q.right > r.left + 0.5 && q.top < r.bottom - 0.5 && q.bottom > r.top + 0.5).map(([id]) => id);
  return { shown: true, hits, rect: [q.left, q.top, q.right, q.bottom].map(Math.round) };
}

(async () => {
  for (const view of ['top', '3d']) for (const [w, h] of SIZES) {
    const size = `${w}x${h} ${view === '3d' ? '3D' : 'top-down'}`;
    const t = await open('', { viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 1,
      init: `try { localStorage.setItem('felt.settings', JSON.stringify({ sv: 3, view: '${view}' })); } catch (e) { }` });
    const { page } = t;
    await page.evaluate(() => { felt.speed = 8; });
    const bad = [], snkOff = [], seen = [];
    for (const [kind, o] of TABLES) {
      const name = kind + (Object.values(o)[0] ? ' ' + Object.values(o)[0] : '');
      await page.evaluate(([k, o]) => { hideOffer(); felt.start(k, Object.assign({ level: 'easy' }, o)); }, [kind, o]);
      await frames(page, 3);
      const a = await page.evaluate(audit);
      if (a.live !== (view === '3d')) bad.push(`${name}: 3D ${a.live}`);
      if (!a.view) bad.push(`${name}: no 3D switch`);
      if (kind === 'snooker' && !a.snkShown) snkOff.push(name);
      a.fails.forEach(f => bad.push(`${name}: ${f}`));
      for (const notable of [false, true]) {
        await page.evaluate(offerNow, notable);
        await page.waitForTimeout(350);   /* the pill scales in over 200 ms (rplIn) */
        const b = await page.evaluate(audit);
        if (!b.offer) bad.push(`${name}: the replay pill does not show${notable ? ' (gold)' : ''}`);
        b.fails.forEach(f => bad.push(`${name} with the replay${notable ? ' (gold)' : ''}: ${f}`));
        if (kind === 'snooker' && !notable) seen.push(`${name}: ${b.snkShown ? 'scoreboard kept' : 'scoreboard gives way'}`);
      }
      await page.evaluate(() => hideOffer());
    }
    check(`${size}: every game and table, with and without the replay's offer: the 3D switch, the scoreboard and the replay on the ${view === '3d' ? 'stage\'s bottom row' : 'bottom rail'}, off every pocket's hole and jaws, apart, 44 px targets inside the stage`,
      bad.length === 0, bad.slice(0, 8).join(' | '));
    check(`${size}: snooker's scoreboard shows on the ${view === '3d' ? 'bottom row' : 'bottom rail'} on both snooker tables (${seen.join(', ')})`, snkOff.length === 0, snkOff.join());

    /* the replay playing: the badge and Skip on the row, Skip a 44 px target, apart and off the pockets (replays are drawn top-down) */
    await page.evaluate(() => { felt.start('8', { level: 'easy' }); felt.speed = 8; felt.shoot(0.02, 0.6, { x: 0, y: 0 }); });
    await page.waitForFunction(() => felt.state === 'aim' || felt.state === 'thinking' || felt.state === 'choose', null, { timeout: 30000 }).catch(() => { });
    const rp0 = await page.evaluate(() => { felt.speed = 0.05; return felt.replay(); });
    await page.waitForTimeout(500);   /* past the badge's and Skip's scale-in (rplIn) on a slow runner */
    const rp1 = await page.evaluate(audit);
    const both = rp1.items.some(i => i[0] === 'replayBadge') && rp1.items.some(i => i[0] === 'replaySkip');
    check(`${size}: a replay playing: its badge and Skip on the bottom rail, apart, off the pockets`, rp0 && both && rp1.fails.length === 0, JSON.stringify({ rp0, items: rp1.items, fails: rp1.fails }));
    await page.evaluate(() => { felt.skipReplay(); felt.speed = 8; });

    /* what rises clear of the row: the call bar, the exhibition's bar, the practice tools, the coach's card */
    const clear = [];
    await page.evaluate(() => {
      felt.start('10', { level: 'easy', table: '7', pockets: 'regulation', rules: { ruleset: '10-wpa', call: { mode: 'all', detail: 'ball', safety: false } } });
      Object.assign(felt.game, { breakShot: false, inHand: null, pushAvail: false }); hud();
    });
    await frames(page, 3);
    clear.push(['call bar', await page.evaluate(clearOfRow, '#callBar')]);
    await page.evaluate(() => { felt.exhibition({ kind: '9', a: { level: 'easy' }, b: { level: 'easy' }, seed: 3 }); felt.speed = 0.01; });
    await frames(page, 3);
    clear.push(['exhibition bar', await page.evaluate(clearOfRow, '#exBar')]);
    await page.evaluate(() => { felt.speed = 8; felt.practice(); });
    await frames(page, 2);
    await page.evaluate(() => toolBtn.click());
    await frames(page, 2);
    clear.push(['practice tools', await page.evaluate(clearOfRow, '#tools')]);
    await page.evaluate(() => { felt.exitSolo(); felt.tutorial('8'); });
    await frames(page, 4);
    clear.push(['coach card', await page.evaluate(clearOfRow, '#coach')]);
    check(`${size}: the call bar, the exhibition's bar, the practice tools and the coach's card shown and clear of the row`,
      clear.every(([, c]) => c.shown && c.hits.length === 0), JSON.stringify(clear));
    check(`${size}: no console errors`, t.errors.length === 0, t.errors.slice(0, 3).join(' | '));
    await t.browser.close();
  }
  done();
})();
