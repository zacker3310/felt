#!/usr/bin/env node
/* railbar-check: the bottom rail's row (page 6b2, placeRail): the 3D switch, the score keeper (a chip per player),
   snooker's scoreboard and the replay (its offer, or the badge and Skip while one plays) inlaid on the rail nearest the
   player, top-down on the table's bottom rail and in 3D on the stage's bottom row (V3_PIN_B).
   1. the inlay on every rail look (walnut, cherry, light oak, ebony) at 430x932 and 932x430 with iOS insets: every word
      4.5:1 against the wood under it (its brightest pixel) through the recess, dimmed and lit.
   2. for every game and table (8-ball 7 ft and 9 ft, 9, 10, 14.1, rotation, bumper octagon and rectangle, snooker 10 ft
      and 12 ft, carom), upright (393x852, 375x667, 440x956, 430x932 with insets) and on its side (852x393, 667x375,
      932x430 with insets), top-down and in 3D, with and without the replay's offer (plain and gold):
      - no target over a pocket's hole; no pill (what shows) over a hole, its jaws (MOUTHS) or a diamond (railSights),
        as the screen shows them (top-down through the fitted view, in 3D as projected);
      - nothing shown overlaps, no two targets overlap; every target 44 px and inside the stage; type 11 px or more;
      - top-down every pill lies wholly on the rail's band (a party's overflow on the far rail's), in 3D on the bottom row;
      - the score keeper always there, whole; the scoreboard on both snooker tables; the switch missing only with no room.
   3. the table fills the room (8-ball, top-down): on its binding axis the free bands sum to FIT_PX or less (counting the
      inset its rails may run under), on its side the band across BAND_PX or less unless the column took its 24 px, and
      the bed inside the safe area.
   4. the controls, a replay playing, a party of three and four, and what rises clear of the row (the call bar, the
      exhibition's bar, the practice tools, a tutorial's coach card). */
'use strict';
const { check, done, open } = require('./lib.cjs');

/* [w, h, iOS safe-area insets top, right, bottom, left (emulated through --sat.. as boot-check does)] */
const SIZES = [[393, 852], [375, 667], [440, 956], [852, 393], [667, 375], [430, 932, [59, 0, 34, 0]], [932, 430, [0, 59, 21, 59]]];
/* the room the table leaves (px): the free bands on its binding axis sum to at most FIT_PX (it touches the stage, or
   the inset it may run its rails under, there); on its side the band across is at most BAND_PX unless the
   column has taken the most it takes (24 px) */
const FIT_PX = 2, BAND_PX = 4;
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
  /* the sights (diamonds) as drawn: each one's box on screen, 1 px more (in 3D at the rail's top) */
  const sights = railSights().map(([x, y, hx, hy]) => {
    const c = [[x - hx, y - hy], [x + hx, y - hy], [x + hx, y + hy], [x - hx, y + hy]].map(p => live ? felt.v3Proj(p[0], p[1], cushionTop()) : screenIn(B, p[0], p[1]));
    if (c.some(q => !q)) return null;
    return { x, y, l: Math.min(...c.map(q => q[0])) - 1, r: Math.max(...c.map(q => q[0])) + 1, t: Math.min(...c.map(q => q[1])) - 1, b: Math.max(...c.map(q => q[1])) + 1 };
  }).filter(Boolean);
  const box = q => ({ l: q.left, t: q.top, r: q.right, b: q.bottom });
  const items = [];
  const chipEls = turnChip.hidden ? [] : [pchip0, pchip1, pchip2, pchip3];
  for (const el of [viewBtn, ...chipEls, snkBar, replayBtn, replayBadge, replaySkip]) {
    if (el.hidden || getComputedStyle(el).visibility === 'hidden') continue;
    const t = el.getBoundingClientRect();
    if (!t.width) continue;
    const pill = el.tagName === 'BUTTON' || el.classList.contains('rpl') ? el.firstElementChild.getBoundingClientRect() : t;
    items.push({ id: el.id, target: box(t), pill: box(pill), button: el.tagName === 'BUTTON', chip: el.classList.contains('pchip') });
  }
  const fails = [];
  const hitCircle = (q, h) => Math.hypot(Math.max(q.l - h.c[0], 0, h.c[0] - q.r), Math.max(q.t - h.c[1], 0, h.c[1] - q.b)) < h.r;
  const inBox = (q, p) => p[0] > q.l && p[0] < q.r && p[1] > q.t && p[1] < q.b;
  const over = (a, b) => a.l < b.r - 0.5 && a.r > b.l + 0.5 && a.t < b.b - 0.5 && a.b > b.t + 0.5;
  /* a target (44 px, clear) never over a hole; a pill (what shows) never over a hole, its jaws or a diamond */
  for (const it of items) for (const q of [it.target, it.pill]) for (const h of holes) if (hitCircle(q, h)) fails.push(`${it.id} covers pocket ${h.i}'s hole`);
  for (const it of items) {
    for (const j of jaws) if (inBox(it.pill, j.q)) { fails.push(`${it.id} covers pocket ${j.i}'s jaws`); break; }
    for (const d of sights) if (over(it.pill, d)) { fails.push(`${it.id} covers the diamond at ${d.x.toFixed(2)}, ${d.y.toFixed(2)}`); break; }
  }
  for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) {
    const x = items[a], y = items[b];
    /* what shows never overlaps; two targets never do (a clear target may run over a label, which takes no touch) */
    if ((x.button && y.button && over(x.target, y.target)) || over(x.pill, y.pill)) fails.push(`${x.id} overlaps ${y.id}`);
  }
  for (const it of items) {
    const q = it.target, cy = (it.pill.t + it.pill.b) / 2;
    if (it.button && Math.min(q.r - q.l, q.b - q.t) < 44) fails.push(`${it.id} target under 44 px`);
    if (q.l < st.left - 0.5 || q.r > st.right + 0.5 || q.t < st.top - 0.5 || q.b > st.bottom + 0.5) fails.push(`${it.id} outside the stage`);
    if (live ? cy < st.bottom - 52 || cy > st.bottom : cy < R.bottom - rail - 1 || cy > R.bottom + 1) {
      /* a party too many for the bottom rail carries on along the far one (top-down only) */
      const far = !live && it.chip && it.pill.t >= R.top - 0.5 && it.pill.b <= R.top + rail + 0.5;
      if (!far) fails.push(`${it.id} off the ${live ? 'bottom row' : 'bottom rail'} (${cy.toFixed(1)})`);
    }
    /* top-down every pill lies wholly on the rail: inside its band, from the nose to the wood's outer edge */
    const onBand = (lo, hi) => it.pill.t >= lo - 0.5 && it.pill.b <= hi + 0.5;
    if (!live && !onBand(R.bottom - rail, R.bottom) && !(it.chip && onBand(R.top, R.top + rail))) fails.push(`${it.id} hangs off the rail (${Math.round(it.pill.t)}-${Math.round(it.pill.b)}, rail ${Math.round(R.bottom - rail)}-${Math.round(R.bottom)})`);
  }
  return { live, fails, items: items.map(i => [i.id, Math.round(i.pill.l), Math.round(i.pill.r), Math.round((i.pill.t + i.pill.b) / 2)]), holes: holes.length,
    chips: !turnChip.hidden && [...turnChip.querySelectorAll('.pchip')].filter(c => !c.hidden).every(c => items.some(i => i.id === c.id) && c.scrollWidth <= c.clientWidth + 0.5),
    font: Math.min(...items.map(i => parseFloat(getComputedStyle(document.getElementById(i.id)).fontSize))),
    free: felt.railBar.free, snk: !snkBar.hidden, snkShown: items.some(i => i.id === 'snkBar'), view: items.some(i => i.id === 'viewBtn'), offer: items.some(i => i.id === 'replayBtn'), text: snkBar.textContent };
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
  const hits = [viewBtn, pchip0, pchip1, pchip2, pchip3, snkBar, replayBtn, replayBadge, replaySkip].filter(e => !e.hidden && getComputedStyle(e).visibility !== 'hidden').map(e => [e.id, e.getBoundingClientRect()])
    .filter(([, r]) => r.width && q.left < r.right - 0.5 && q.right > r.left + 0.5 && q.top < r.bottom - 0.5 && q.bottom > r.top + 0.5).map(([id]) => id);
  return { shown: true, hits, rect: [q.left, q.top, q.right, q.bottom].map(Math.round) };
}

/* in the page: each word on the rail against the wood it is inlaid on (the table's baked image under the pill, its
   brightest pixel: the worst case), through the recess (--inlay): the dimmed words (white at .8) and the lit ones */
function inlayContrast() {
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const mix = (top, a, under) => top.map((v, i) => v * a + under[i] * (1 - a));
  const g = tableImg.getContext('2d'), m = getComputedStyle(stage).getPropertyValue('--inlay').match(/[\d.]+/g).map(Number), ink = m.slice(0, 3), A = m[3];
  const out = [];
  for (const el of [pchip0, pchip1, snkBar, viewBtn.firstElementChild, replayBtn.firstElementChild]) {
    const host = el.closest('[hidden]');
    if (host || !el.getClientRects().length || getComputedStyle(el.parentElement).visibility === 'hidden' || getComputedStyle(el).visibility === 'hidden') continue;
    const q = el.getBoundingClientRect(), d = dpr, x0 = Math.round(q.left * d), y0 = Math.round(q.top * d), w = Math.max(1, Math.round(q.width * d)), h = Math.max(1, Math.round(q.height * d));
    const px = g.getImageData(x0, y0, w, h).data;
    let worst = null, wl = -1;
    for (let i = 0; i < px.length; i += 4) { const c = [px[i], px[i + 1], px[i + 2]], l = lum(c); if (l > wl) { wl = l; worst = c; } }
    const bg = mix(ink, A, worst);
    out.push({ id: el.id || el.parentElement.id, dim: +ratio(mix([255, 255, 255], 0.8, bg), bg).toFixed(2), lit: +ratio([255, 255, 255], bg).toFixed(2), wood: worst });
  }
  return out;
}
(async () => {
  /* an inset applied after the first layout with no resize event (an iOS home-screen app, Zac's 430x932): the table is
     laid out again within the second (sizeSig carries the insets and the stage's size), never left under the controls */
  {
    const t = await open('', { viewport: { width: 430, height: 932 }, hasTouch: true, isMobile: true });
    const r = await t.page.evaluate(async () => {
      const st = document.createElement('style'); st.textContent = 'html:root { --sat: 59px; --sar: 0px; --sab: 0px; --sal: 0px; }'; document.head.appendChild(st);
      felt.start('8'); relayout();
      /* the home indicator's inset applied afterwards, no resize event (as the screenshot showed: the strip moved up over the rail) */
      st.textContent = 'html:root { --sat: 59px; --sar: 0px; --sab: 34px; --sal: 0px; }';
      await new Promise(res => setTimeout(res, 1600));
      const R = felt.camRect(), c = ctl.getBoundingClientRect(), a = felt.toScreen(0, 0), b = felt.toScreen(TL, TW);
      return { tableBottom: Math.round(R.bottom), ctlTop: Math.round(c.top), bedTop: Math.round(Math.min(a[1], b[1])) };
    });
    check('an inset that arrives late (no resize event): within a second the table is laid out again, its whole outline clear of the controls and its bed under the status bar inset',
      r.tableBottom <= r.ctlTop && r.bedTop >= 59, JSON.stringify(r));
    await t.browser.close();
  }
  /* the inlay on every rail look (walnut, cherry, light oak, ebony), upright and on its side */
  for (const [w, h, ins] of [[430, 932, [59, 0, 34, 0]], [932, 430, [0, 59, 21, 59]]]) {
    const t = await open('', { viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2,
      init: `try { localStorage.setItem('felt.looks.v1', '{"v":1,"own":["rail-cherry","rail-oak","rail-ebony"]}'); localStorage.setItem('felt.settings', JSON.stringify({ sv: 3, cpu: false })); } catch (e) { }` });
    const res = [];
    for (const rail of ['walnut', 'cherry', 'oak', 'ebony']) for (const kind of ['8', 'snooker']) {
      res.push(...await t.page.evaluate(async ([i, rail, kind, fn]) => {
        if (!document.getElementById('insets')) { const st = document.createElement('style'); st.id = 'insets'; document.head.appendChild(st); st.textContent = `html:root { --sat: ${i[0]}px; --sar: ${i[1]}px; --sab: ${i[2]}px; --sal: ${i[3]}px; }`; }
        setSetting('rail', rail); felt.start(kind); relayout();
        offer = { rec: null, notable: null, until: performance.now() + 1e7 }; replayBtn.hidden = false; placeReplay();
        await new Promise(r => setTimeout(r, 300));
        const f = new Function('return ' + fn)();
        return f().map(o => Object.assign(o, { rail, kind, look: look().rail }));
      }, [ins, rail, kind, inlayContrast.toString()]));
    }
    const bad = res.filter(r => r.dim < 4.5 || r.lit < 4.5 || r.look !== r.rail);
    check(`${w}x${h} (iOS insets): every word inlaid on the rail 4.5:1 against the wood under it on every rail look (worst dimmed ${Math.min(...res.map(r => r.dim))}:1, ${res.length} pills)`,
      res.length >= 24 && bad.length === 0, JSON.stringify(bad.length ? bad : res.slice(0, 3)));
    await t.browser.close();
  }
  for (const view of ['top', '3d']) for (const [w, h, ins] of SIZES) {
    const size = `${w}x${h}${ins ? ' (iOS insets)' : ''} ${view === '3d' ? '3D' : 'top-down'}`;
    const t = await open('', { viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 1,
      init: `try { localStorage.setItem('felt.settings', JSON.stringify({ sv: 3, view: '${view}' })); } catch (e) { }` });
    const { page } = t;
    await page.evaluate(i => {
      felt.speed = 8;
      if (!i) return;
      const st = document.createElement('style'); st.id = 'insets'; document.head.appendChild(st);
      st.textContent = `html:root { --sat: ${i[0]}px; --sar: ${i[1]}px; --sab: ${i[2]}px; --sal: ${i[3]}px; }`;
      relayout();
    }, ins || null);
    /* the table as big as the room allows (8-ball top-down; the bed inside the safe area) */
    if (view === 'top') {
      const fit = await page.evaluate(i => {
        felt.start('8', { level: 'easy' });
        const st = stage.getBoundingClientRect(), e = felt.tableExt, R = felt.camRect(), rk = RAIL * viewBase.k, wide = document.documentElement.dataset.layout === 'wide';
        const vert = Math.max(0, R.top - Math.max(st.top - e.t, st.top - rk)) + Math.max(0, st.bottom + e.b - R.bottom);
        const horiz = Math.max(0, R.left - Math.max(st.left - e.l, st.left - rk)) + Math.max(0, Math.min(st.right + e.r, st.right + rk) - R.right);
        const a = screenIn(viewBase, 0, 0), b = screenIn(viewBase, TL, TW), ins = i || [0, 0, 0, 0];
        const bedSafe = Math.min(a[0], b[0]) >= ins[3] - 0.5 && Math.max(a[0], b[0]) <= innerWidth - ins[1] + 0.5 && Math.min(a[1], b[1]) >= ins[0] - 0.5 && Math.max(a[1], b[1]) <= innerHeight - ins[2] + 0.5;
        const colx = parseFloat(document.documentElement.style.getPropertyValue('--colx')) || 0;
        return { vert: +vert.toFixed(1), horiz: +horiz.toFixed(1), wide, colx, bedSafe, k: +viewBase.k.toFixed(1), R: [R.left, R.top, R.right, R.bottom].map(Math.round), ball: +felt.ballPx.toFixed(2) };
      }, ins || null);
      check(`${size}: the table fills the room (binding axis free bands ${Math.min(fit.vert, fit.horiz)} px <= ${FIT_PX}${fit.wide ? `, across ${fit.horiz} px <= ${BAND_PX} or the column wider by 24 px` : ''}), its bed inside the safe area (ball ${fit.ball} px)`,
        Math.min(fit.vert, fit.horiz) <= FIT_PX && (!fit.wide || fit.horiz <= BAND_PX || fit.colx >= 24) && fit.bedSafe, JSON.stringify(fit));
    }
    const bad = [], snkOff = [], seen = [];
    for (const [kind, o] of TABLES) {
      const name = kind + (Object.values(o)[0] ? ' ' + Object.values(o)[0] : '');
      await page.evaluate(([k, o]) => { hideOffer(); felt.start(k, Object.assign({ level: 'easy' }, o)); }, [kind, o]);
      await frames(page, 3);
      const a = await page.evaluate(audit);
      if (a.live !== (view === '3d')) bad.push(`${name}: 3D ${a.live}`);
      if (!a.view && a.free >= 40) bad.push(`${name}: no 3D switch, with ${Math.round(a.free)} px free`);
      if (a.font < 11) bad.push(`${name}: type under 11 px (${a.font})`);
      if (!a.chips) bad.push(`${name}: the score keeper is not on the row whole`);
      if (kind === 'snooker' && !a.snkShown) snkOff.push(name);
      a.fails.forEach(f => bad.push(`${name}: ${f}`));
      for (const notable of [false, true]) {
        await page.evaluate(offerNow, notable);
        await page.waitForTimeout(350);   /* the pill scales in over 200 ms (rplIn) */
        const b = await page.evaluate(audit);
        if (!b.offer) bad.push(`${name}: the replay pill does not show${notable ? ' (gold)' : ''}`);
        if (!b.chips) bad.push(`${name}: the score keeper gave way to the replay`);
        b.fails.forEach(f => bad.push(`${name} with the replay${notable ? ' (gold)' : ''}: ${f}`));
        if (kind === 'snooker' && !notable) seen.push(`${name}: ${b.snkShown ? 'scoreboard kept' : 'scoreboard gives way'}`);
      }
      await page.evaluate(() => hideOffer());
    }
    check(`${size}: every game and table, with and without the replay's offer: the 3D switch, the scoreboard and the replay on the ${view === '3d' ? 'stage\'s bottom row' : 'bottom rail'}, off every pocket's hole and jaws, apart, 44 px targets inside the stage`,
      bad.length === 0, bad.slice(0, 8).join(' | '));
    check(`${size}: snooker's scoreboard shows on the ${view === '3d' ? 'bottom row' : 'bottom rail'} on both snooker tables (${seen.join(', ')})`, snkOff.length === 0, snkOff.join());

    /* the controls: the chips gone from the strip, the fine-aim wheel takes their room (upright wide, on its side
       tall), every control 44 px and on screen, the power bar still the biggest */
    const ctlr = await page.evaluate(() => {
      felt.start('8', { level: 'easy' });
      const R = e => e.getBoundingClientRect(), wl = R(fineWheel), bar = R(powerBar), port = document.documentElement.dataset.layout === 'portrait';
      const ctls = [menuBtn, spinPad, powerBar, fineWheel].map(R);
      return { port, wheel: [Math.round(wl.width), Math.round(wl.height)], bar: [Math.round(bar.width), Math.round(bar.height)], offStrip: !ctl.contains(turnChip),
        ok: ctls.every(r => Math.min(r.width, r.height) >= 44 && r.left >= -0.5 && r.right <= innerWidth + 0.5 && r.top >= -0.5 && r.bottom <= innerHeight + 0.5),
        barBig: ctls.every(r => r === ctls[2] || r.width * r.height < bar.width * bar.height) };
    });
    check(`${size}: the controls: no chips in the strip, the fine-aim wheel wide upright, tall on its side (${ctlr.wheel.join('x')}), the bar the biggest (${ctlr.bar.join('x')}), all 44 px and on screen`,
      ctlr.offStrip && ctlr.ok && ctlr.barBig && (ctlr.port ? ctlr.wheel[0] >= 72 : ctlr.wheel[1] >= 112), JSON.stringify(ctlr));
    /* the replay playing: the badge and Skip on the row, Skip a 44 px target, apart and off the pockets (replays are drawn top-down) */
    await page.evaluate(() => { felt.start('8', { level: 'easy' }); felt.speed = 8; felt.shoot(0.02, 0.6, { x: 0, y: 0 }); });
    await page.waitForFunction(() => felt.state === 'aim' || felt.state === 'thinking' || felt.state === 'choose', null, { timeout: 30000 }).catch(() => { });
    const rp0 = await page.evaluate(() => { felt.speed = 0.05; return felt.replay(); });
    await page.waitForTimeout(500);   /* past the badge's and Skip's scale-in (rplIn) on a slow runner */
    const rp1 = await page.evaluate(audit);
    /* Skip always (the badge is only a label: it gives way on a short rail), the score keeper too */
    const both = rp1.items.some(i => i[0] === 'replaySkip') && rp1.items.some(i => i[0].startsWith('pchip')) && (rp1.items.some(i => i[0] === 'replayBadge') || rp1.free < 40);
    check(`${size}: a replay playing: Skip (and its badge where there is room) on the bottom rail with the score keeper, apart, off the pockets`, rp0 && both && rp1.fails.length === 0, JSON.stringify({ rp0, items: rp1.items, fails: rp1.fails }));
    await page.evaluate(() => { felt.skipReplay(); felt.speed = 8; });

    /* a party of three and four (6f): every player's chip on the rail, whole, off the pockets */
    const party = [];
    for (const n of [3, 4]) {
      await page.evaluate(n => { felt.party({ ruleset: 'rotation-ring', names: ['Ann', 'Bob', 'Cy', 'Dee'].slice(0, n) }); hoGo.click(); game.score = game.score.map((_, i) => 10 * i + 5); hud(); }, n);
      await frames(page, 3);
      const a = await page.evaluate(audit);
      const shown = await page.evaluate(() => [...turnChip.querySelectorAll('.pchip')].filter(e => !e.hidden).map(e => e.textContent).join());
      party.push({ n, shown, chips: a.chips, fails: a.fails });
    }
    check(`${size}: a party of three and four: every chip (name and points) on the row, whole, off the pockets`,
      party.every(q => q.chips && q.fails.length === 0 && q.shown.split(',').length === q.n), JSON.stringify(party));
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
