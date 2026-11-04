#!/usr/bin/env node
/* pottray-check: the potted balls in windows in the side rails (page 6b3, potTick; Zac: "like a bar table with a window
   for the balls ... just go up the left rail and the right rail").
   1. 8, 9 and 10-ball, top-down, upright (393x852, 440x956 with iOS insets, 375x667) and on its side (852x393, 956x440
      with insets, 667x375): the right balls on the right rails in the right order (8-ball solids up the screen's left
      rail, stripes up its right, in pot order, the 8 up its potter's group's side; 9 and 10-ball in pot order up the
      left, then the right), filling from the screen's foot upward; every window on the wood (between the cushion and
      the rail's outer edge), off every pocket's hole and jaws and every sight, apart from each other, off the rail row
      (every pill and 44 px target) and the controls, inside the screen.
   2. 3D (393x852 and 852x393, a raised camera): the windows on the rail tops as projected, off the holes, jaws and
      sights as projected, off the row, inside the stage.
   3. every ball of every ball set 3:1 or more against the recess (its colour, a stripe's ivory, or its rim of light),
      and a shown ball sampled from the screen in its colour; ball marks on the balls with marks on.
   4. VoiceOver: the windows aria-hidden, #potSay ("Potted: 1, 3, 9", pot order) in the accessibility tree, not live.
   5. none for snooker, carom, bumper pool, 14.1, rotation, a trick shot, the lesson, a tutorial or a replay; practice
      has them.
   6. a real pot: the ball rolls into its window after its drop (animated, on the screen's clock, done within about
      250 ms); Reduce Motion: it is just there; a ball that comes back leaves its window, the ones above it move down;
      the cue lying over a window hides it.
   7. two-digit numbers (10 to 15) in the windows and on the rail's next ball read cleanly at 375x667 and 393x852. */
'use strict';
const { check, done, open } = require('./lib.cjs');

const SIZES = [[393, 852, [59, 0, 34, 0]], [440, 956, [62, 0, 34, 0]], [375, 667, null], [852, 393, [0, 59, 21, 59]], [956, 440, [0, 62, 21, 62]], [667, 375, null]];
const frames = (page, n = 2) => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const insets = i => { if (!i) return; let st = document.getElementById('insets'); if (!st) { st = document.createElement('style'); st.id = 'insets'; document.head.appendChild(st); } st.textContent = `html:root { --sat: ${i[0]}px; --sar: ${i[1]}px; --sab: ${i[2]}px; --sal: ${i[3]}px; }`; relayout(); };

/* in the page: start a game and put balls down one a frame (pot order), the 8-ball groups set */
async function potSome([kind, pots, groups, turn]) {
  felt.start(kind, { level: 'easy' });
  Object.assign(game, { breakShot: false, inHand: null, pushAvail: false });
  if (groups) Object.assign(game, { open: false, groups });
  if (turn !== undefined) game.turn = turn;
  hud();
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  for (const n of pots) { game.balls.find(b => b.n === n).on = false; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }
  await new Promise(r => setTimeout(r, 120));
}
/* in the page: every shown window against the wood, the pockets, the sights, each other, the row and the controls */
function audit() {
  const live = felt.view3.live, B = viewBase, R = felt.camRect(), co = cushionDepth(), st = stage.getBoundingClientRect();
  const at = (x, y, z = 0) => live ? felt.v3Proj(x, y, z) : screenIn(B, x, y);
  const holes = [], jaws = [], fails = [];
  POCKETS.forEach((p, i) => {
    const c = at(p[0], p[1]);
    if (!c) return;
    const rs = [[POCKET_R[i], 0], [-POCKET_R[i], 0], [0, POCKET_R[i]], [0, -POCKET_R[i]]].map(d => at(p[0] + d[0], p[1] + d[1])).filter(Boolean).map(q => Math.hypot(q[0] - c[0], q[1] - c[1]));
    holes.push({ i, c, r: Math.max(...rs) });
    const m = MOUTHS[i];
    if (m) { const poly = [m[0].p, m[0].e, m[1].e, m[1].p]; for (let e = 0; e < 4; e++) for (let t = 0; t <= 10; t++) { const a = poly[e], b = poly[(e + 1) % 4], q = at(a[0] + (b[0] - a[0]) * t / 10, a[1] + (b[1] - a[1]) * t / 10); if (q) jaws.push({ i, q }); } }
  });
  const sights = railSights().map(([x, y, hx, hy]) => {
    const c = [[x - hx, y - hy], [x + hx, y - hy], [x + hx, y + hy], [x - hx, y + hy]].map(p => at(p[0], p[1], live ? cushionTop() : 0));
    if (c.some(q => !q)) return null;
    return { l: Math.min(...c.map(q => q[0])) - 1, r: Math.max(...c.map(q => q[0])) + 1, t: Math.min(...c.map(q => q[1])) - 1, b: Math.max(...c.map(q => q[1])) + 1 };
  }).filter(Boolean);
  const wins = [...potRail.querySelectorAll('.tw')].filter(e => !e.hidden && !e.classList.contains('hid') && !e.classList.contains('out')).map(e => { const q = e.getBoundingClientRect(); return { n: +e.dataset.n, l: q.left, r: q.right, t: q.top, b: q.bottom, x: (q.left + q.right) / 2, y: (q.top + q.bottom) / 2, s: q.width }; });
  const over = (a, b) => a.l < b.r - 0.5 && a.r > b.l + 0.5 && a.t < b.b - 0.5 && a.b > b.t + 0.5;
  const rowEls = [viewBtn, pchip0, pchip1, pchip2, pchip3, snkBar, replayBtn, replayBadge, replaySkip].filter(e => !e.hidden && getComputedStyle(e).visibility !== 'hidden' && e.getClientRects().length);
  const row = rowEls.flatMap(e => [e, e.firstElementChild].filter(Boolean)).map(e => { const q = e.getBoundingClientRect(); return { id: e.id || e.parentElement.id, l: q.left, r: q.right, t: q.top, b: q.bottom }; }).filter(q => q.r > q.l);
  const ctls = [menuBtn, spinPad, powerBar, fineWheel].map(e => { const q = e.getBoundingClientRect(); return { id: e.id, l: q.left, r: q.right, t: q.top, b: q.bottom }; });
  for (const w of wins) {
    for (const h of holes) if (Math.hypot(Math.max(w.l - h.c[0], 0, h.c[0] - w.r), Math.max(w.t - h.c[1], 0, h.c[1] - w.b)) < h.r) fails.push(`the ${w.n} covers pocket ${h.i}'s hole`);
    for (const j of jaws) if (j.q[0] > w.l && j.q[0] < w.r && j.q[1] > w.t && j.q[1] < w.b) { fails.push(`the ${w.n} covers pocket ${j.i}'s jaws`); break; }
    for (const d of sights) if (over(w, d)) { fails.push(`the ${w.n} covers a sight`); break; }
    for (const q of row) if (over(w, q)) fails.push(`the ${w.n} is over the row's ${q.id}`);
    for (const q of ctls) if (over(w, q)) fails.push(`the ${w.n} is over ${q.id}`);
    if (w.l < -0.5 || w.t < -0.5 || w.r > innerWidth + 0.5 || w.b > innerHeight + 0.5) fails.push(`the ${w.n} is off the screen`);
    if (live && (w.l < st.left - 0.5 || w.r > st.right + 0.5 || w.t < st.top - 0.5 || w.b > st.bottom + 0.5)) fails.push(`the ${w.n} is off the stage`);
    if (!live) {
      /* on the wood: between the cushion's back and the rail's outer edge, across the band */
      const port = B.portrait, inX = port ? [R.left, R.left + (RAIL - co) * B.k, R.right - (RAIL - co) * B.k, R.right] : null;
      const bandOk = port ? (w.l >= inX[0] - 0.5 && w.r <= inX[1] + 0.5) || (w.l >= inX[2] - 0.5 && w.r <= inX[3] + 0.5)
        : (w.l >= R.left - 0.5 && w.r <= R.left + (RAIL - co) * B.k + 0.5) || (w.l >= R.right - (RAIL - co) * B.k - 0.5 && w.r <= R.right + 0.5);
      if (!bandOk) fails.push(`the ${w.n} is off the wood (${w.l.toFixed(1)}-${w.r.toFixed(1)})`);
    } else {
      /* in 3D on a rail's top: its centre unprojected at the rail's height lies in a side rail's wood */
      const t = felt.v3Unproj(w.x, w.y, cushionTop());
      const onWood = t && Math.min(Math.abs(t[1] + (co + RAIL) / 2), Math.abs(t[1] - TW - (co + RAIL) / 2)) < (RAIL - co) / 2;   /* 3D: the long rails, whichever way up */
      if (!onWood) fails.push(`the ${w.n} is not on a side rail's top (${t && t.map(v => v.toFixed(3))})`);
    }
  }
  for (let a = 0; a < wins.length; a++) for (let b = a + 1; b < wins.length; b++) if (over(wins[a], wins[b])) fails.push(`the ${wins[a].n} overlaps the ${wins[b].n}`);
  return { fails, wins, live };
}
/* in the page: which side and order each ball shows in, from the screen (left half or right half; bottom first) */
function sidesNow() {
  const wins = [...potRail.querySelectorAll('.tw')].filter(e => !e.hidden && !e.classList.contains('out')).map(e => { const q = e.getBoundingClientRect(); return { n: +e.dataset.n, x: (q.left + q.right) / 2, y: (q.top + q.bottom) / 2 }; });
  const mid = innerWidth / 2;
  const L = wins.filter(w => w.x < mid).sort((a, b) => b.y - a.y), R = wins.filter(w => w.x >= mid).sort((a, b) => b.y - a.y);
  return { left: L.map(w => w.n), right: R.map(w => w.n), hiddenRail: potRail.hidden, words: potSay.textContent };
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function layoutChecks() {
  for (const [w, h, ins] of SIZES) {
    const size = `${w}x${h}${ins ? ' (iOS insets)' : ''}`;
    const t = await open('', { viewport: { width: w, height: h }, hasTouch: true, isMobile: true, init: `try { localStorage.setItem('felt.settings', JSON.stringify({ sv: 3, cpu: true })); } catch (e) { }` });
    const { page } = t;
    await page.evaluate(insets, ins);
    const res = [];
    /* 8-ball, the player on stripes: solids and stripes down in a mixed order, then the 8 by the player */
    await page.evaluate(potSome, ['8', [3, 12, 1, 9, 5, 14, 2, 10, 7, 11, 4, 13, 6, 15], ['stripes', 'solids'], 0]);
    await frames(page, 2);
    const a8 = await page.evaluate(sidesNow), au8 = await page.evaluate(audit);
    await page.evaluate(async () => { game.balls.find(b => b.n === 8).on = false; await new Promise(r => setTimeout(r, 100)); });
    await frames(page, 2);
    const b8 = await page.evaluate(sidesNow), bu8 = await page.evaluate(audit);
    check(`${size}: 8-ball: solids up the left rail and stripes up the right in pot order, from the foot (left ${a8.left}, right ${a8.right}); the 8 by the player on stripes up the right (${b8.right.slice(-1)})`,
      same(a8.left, [3, 1, 5, 2, 7, 4, 6]) && same(a8.right, [12, 9, 14, 10, 11, 13, 15]) && same(b8.left, a8.left) && same(b8.right, [12, 9, 14, 10, 11, 13, 15, 8]), JSON.stringify({ a8, b8 }));
    res.push(...au8.fails, ...bu8.fails);
    /* the 8 by the player on solids (the CPU's group here), and on an open table: the left */
    await page.evaluate(potSome, ['8', [3, 12, 8], ['stripes', 'solids'], 1]);
    const c8 = await page.evaluate(sidesNow);
    await page.evaluate(async () => { felt.start('8', { level: 'easy' }); Object.assign(game, { breakShot: false }); await new Promise(r => requestAnimationFrame(r)); game.balls.find(b => b.n === 8).on = false; await new Promise(r => setTimeout(r, 100)); });
    const d8 = await page.evaluate(sidesNow);
    check(`${size}: 8-ball: the 8 by the player on solids up the left (${c8.left}), on an open table up the left (${d8.left})`, same(c8.left, [3, 8]) && same(c8.right, [12]) && same(d8.left, [8]) && !d8.right.length, JSON.stringify({ c8, d8 }));
    /* 9 and 10-ball: pot order up the left, then up the right */
    await page.evaluate(potSome, ['9', [2, 1, 4, 3, 7, 5, 6, 8, 9]]);
    const n9 = await page.evaluate(sidesNow), au9 = await page.evaluate(audit);
    await page.evaluate(potSome, ['10', [1, 3, 2, 4, 5, 6, 8, 7, 9, 10]]);
    const n10 = await page.evaluate(sidesNow), au10 = await page.evaluate(audit);
    const slots = await page.evaluate(() => felt.potRail.slots);
    check(`${size}: 9-ball and 10-ball: pot order up the left rail, then up the right (9: ${n9.left} | ${n9.right}; 10: ${n10.left} | ${n10.right}; ${slots} windows a rail), the words "${n10.words}"`,
      same(n9.left, [2, 1, 4, 3, 7, 5, 6, 8]) && same(n9.right, [9]) && same(n10.left, [1, 3, 2, 4, 5, 6, 8, 7]) && same(n10.right, [9, 10]) && n10.words === 'Potted: 1, 3, 2, 4, 5, 6, 8, 7, 9, 10' && slots.every(n => n >= 8), JSON.stringify({ n9, n10, slots }));
    res.push(...au9.fails, ...au10.fails);
    check(`${size}: every window on the wood, off every pocket's hole and jaws and every sight, apart, off the rail row and the controls, on the screen (${au8.wins.length + bu8.wins.length + au9.wins.length + au10.wins.length} windows)`,
      res.length === 0 && au10.wins.length === 10 && bu8.wins.length === 15, res.slice(0, 8).join(' | '));
    /* the replay's offer on the row: still clear of it */
    await page.evaluate(async () => { offer = { rec: null, notable: 'bank', until: performance.now() + 1e7 }; replayBtn.toggleAttribute('data-notable', true); replayBtn.hidden = false; placeReplay(); await new Promise(r => setTimeout(r, 400)); });
    const off = await page.evaluate(audit);
    await page.evaluate(() => hideOffer());
    check(`${size}: with the replay's offer on the row, the windows still clear of it`, off.fails.length === 0, off.fails.join(' | '));
    check(`${size}: no console errors`, t.errors.length === 0, t.errors.slice(0, 3).join(' | '));
    await t.browser.close();
  }
}
async function view3dChecks() {
  /* a raised camera each way up (on its side the table is small on the stage: a closer one); the windows too small to
     read where the camera has the rail far off, or on the row at the stage's foot, are not drawn */
  for (const [w, h, ins, pitch, dist, least] of [[393, 852, [59, 0, 34, 0], 55, 2.6, 4], [852, 393, [0, 59, 21, 59], 65, 1.8, 2]]) {
    const size = `${w}x${h} (iOS insets) 3D`;
    const t = await open('', { viewport: { width: w, height: h }, hasTouch: true, isMobile: true, init: `try { localStorage.setItem('felt.settings', JSON.stringify({ sv: 3, cpu: true, view: '3d', viewPitch: ${pitch}, viewDist: ${dist} })); } catch (e) { }` });
    const { page } = t;
    await page.evaluate(insets, ins);
    const out = [];
    for (const [kind, pots, groups] of [['8', [3, 12, 1, 9, 5, 14, 2, 10, 7, 11, 4, 13], ['solids', 'stripes']], ['10', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]]]) {
      await page.evaluate(potSome, [kind, pots, groups, 0]);
      await frames(page, 4);
      const a = await page.evaluate(audit), st = await page.evaluate(() => ({ live: felt.view3.live, shown: felt.potRail.items.filter(i => i.shown).length, all: felt.potRail.items.length }));
      out.push({ kind, live: a.live, fails: a.fails, wins: a.wins.length, st });
    }
    check(`${size}: the windows on the side rails' tops as the camera projects them, off the holes, jaws and sights, apart, off the row, inside the stage (${out.map(o => `${o.kind}-ball ${o.wins} of ${o.st.all} shown`).join(', ')})`,
      out.every(o => o.live && o.fails.length === 0 && o.wins >= least), JSON.stringify(out));
    /* the lowest, closest camera swung all round with balls by the cue ball: a ball whose centre projects while its edge
       does not (beside the camera) must not throw (the playtest's potCovered TypeError, every frame, on a phone on its side) */
    const sweep = await page.evaluate(async () => {
      setSetting('viewPitch', 8); setSetting('viewDist', 0.45);
      const c = felt.game.balls[0], ring = felt.game.balls.filter(b => b.n > 0).slice(0, 8);
      ring.forEach((b, i) => { b.on = true; b.x = clamp(c.x + Math.cos(i) * 0.08 * (1 + i % 3), 0.05, TL - 0.05); b.y = clamp(c.y + Math.sin(i) * 0.08 * (1 + i % 3), 0.05, TW - 0.05); });
      let n = 0;
      for (let a = 0; a < Math.PI * 2; a += 0.05) { aimAngle = a; await new Promise(r => requestAnimationFrame(r)); n++; }
      /* and pinned: a ball put where its centre projects but its edge falls behind the camera's near plane */
      aimAngle = Math.PI; for (let k = 0; k < 4; k++) await new Promise(r => requestAnimationFrame(r));   /* looking back down the table: the edge's +x is nearer the camera */
      let found = null, threw = null;
      for (let i = -60; i <= 60 && !found; i++) for (let j = -60; j <= 60 && !found; j++) {
        const x = V3.cam.Er[0] + i * 0.004, y = V3.cam.Er[1] + j * 0.004;
        if (x < 0 || y < 0 || x > TL || y > TW) continue;
        if (v3Proj(x, y, BALL_R) && !v3Proj(x + BALL_R, y, BALL_R)) found = [x, y];
      }
      if (found) { ring[0].x = found[0]; ring[0].y = found[1]; try { potCovered(100, 100, 10); } catch (e) { threw = String(e); } }
      return { n, live: felt.view3.live, found, threw };
    });
    check(`${size}: the lowest, closest camera swung all round with balls beside the cue ball: no console errors (${sweep.n} frames), and potCovered over a ball on the camera\'s near plane does not throw`, sweep.live && !!sweep.found && !sweep.threw && t.errors.length === 0, JSON.stringify({ found: sweep.found, threw: sweep.threw, errors: t.errors.slice(0, 3) }));
    await t.browser.close();
  }
}
/* 3: contrast, colour and marks */
async function lookChecks() {
  const t = await open('', { viewport: { width: 440, height: 956 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3,
    init: `try { localStorage.setItem('felt.looks.v1', '{"v":1,"own":["balls-tv","balls-vintage","balls-pro"]}'); localStorage.setItem('felt.settings', JSON.stringify({ sv: 3, cpu: false })); } catch (e) { }` });
  const { page } = t;
  const all = [];
  for (const set of ['classic', 'pro', 'vintage', 'tv']) {
    await page.evaluate(s => setSetting('balls', s), set);
    await page.evaluate(potSome, ['8', [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 8], ['solids', 'stripes'], 0]);
    await frames(page, 2);
    all.push(...await page.evaluate(set => {
      const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
      const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const rgbs = s => (s.match(/rgba?\([^)]*\)/g) || []).map(c => c.match(/[\d.]+/g).map(Number)).filter(c => c.length < 4 || c[3] > 0.9).map(c => c.slice(0, 3));
      const recess = POT_RECESS;
      return [...potRail.querySelectorAll('.tw')].map(e => {
        const nb = e.firstElementChild, cs = getComputedStyle(nb), n = +e.dataset.n;
        const body = rgbs(cs.backgroundImage + ' ' + cs.backgroundColor), ivory = n > 8 ? [cs.getPropertyValue('--nb-iv').trim().match(/[0-9a-f]{2}/gi).map(v => parseInt(v, 16))] : [];
        const rim = nb.classList.contains('rim') ? rgbs(cs.boxShadow).slice(0, 1) : [];
        const best = Math.max(...[...body, ...ivory, ...rim].map(c => ratio(c, recess)));
        return { set, n, best: +best.toFixed(2), rim: rim.length > 0 };
      });
    }, set));
  }
  const bad = all.filter(r => r.best < 3);
  check(`every ball of every ball set stands 3:1 or more from its window's recess (its colour, a stripe's ivory, or its rim; worst ${Math.min(...all.map(r => r.best))}:1, ${all.length} balls, ${all.filter(r => r.rim).length} with a rim)`,
    all.length === 60 && bad.length === 0, JSON.stringify(bad.slice(0, 5)));
  /* a shown ball in its colour, sampled from the screen: the 3 (classic) left of its number circle */
  await page.evaluate(s => setSetting('balls', s), 'classic');
  await page.evaluate(potSome, ['9', [3]]);
  await frames(page, 2);
  const r = await page.evaluate(() => { const q = potRail.querySelector('.tw .nb').getBoundingClientRect(); return [q.left, q.top, q.width, q.height]; });
  const png = await page.screenshot({ clip: { x: r[0], y: r[1], width: r[2], height: r[3] }, scale: 'device' });
  const sample = await page.evaluate(b64 => new Promise(res => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(Math.round(im.width * 0.08), Math.round(im.height * 0.45), Math.max(1, Math.round(im.width * 0.1)), Math.max(1, Math.round(im.height * 0.12))).data, s = [0, 0, 0]; for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) s[k] += d[i + k]; res({ got: s.map(v => Math.round(v / (d.length / 4))), want: colorOf(3) }); }; im.src = 'data:image/png;base64,' + b64; }), png.toString('base64'));
  const dist = Math.hypot(...sample.got.map((v, i) => v - sample.want[i]));
  check(`a window's ball shows in its colour on the screen (the 3: ${sample.got} against ${sample.want}, off by ${Math.round(dist)})`, dist <= 60, JSON.stringify(sample));
  /* ball marks: on every ball with marks on, gone with them off */
  await page.evaluate(() => setSetting('marks', true));
  await page.evaluate(potSome, ['10', [1, 9, 10]]);
  await frames(page, 2);
  const marks = await page.evaluate(() => [...potRail.querySelectorAll('.tw')].map(e => { const i = e.querySelector('.cb'); return i ? i.textContent + (i.classList.contains('d') ? 'd' : 'l') : null; }));
  await page.evaluate(() => setSetting('marks', false));
  await frames(page, 2);
  const plain = await page.evaluate(() => [...potRail.querySelectorAll('.tw')].map(e => e.querySelector('.cb') ? 'cb' : e.querySelector('.nn').textContent));
  check(`ball marks: the mark on each window's ball with marks on (${marks}), the plain number with them off (${plain})`, same(marks, ['1l', '9d', '10d']) && same(plain, ['1', '9', '10']), JSON.stringify({ marks, plain }));
  check('no console errors (looks)', t.errors.length === 0, t.errors.slice(0, 3).join(' | '));
  await t.browser.close();
}
/* 4 and 5: VoiceOver, and where there are none */
async function voiceAndNoneChecks() {
  const t = await open('', { viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true, init: `try { localStorage.setItem('felt.settings', JSON.stringify({ sv: 3, cpu: true })); } catch (e) { }` });
  const { page } = t;
  await page.evaluate(potSome, ['9', [1, 3, 2]]);
  const say = await page.evaluate(() => ({ rail: potRail.getAttribute('aria-hidden'), text: potSay.textContent, live: potSay.getAttribute('aria-live'), role: potSay.getAttribute('role'), hid: !!potSay.closest('[aria-hidden="true"]') }));
  const snap = await page.locator('#potSay').ariaSnapshot().catch(e => 'ERR ' + e.message);
  const railSnap = await page.locator('#potRail').ariaSnapshot().catch(() => '');
  check(`VoiceOver: the windows aria-hidden (${say.rail}), the hidden words in the tree ("${snap.trim()}"), not live (aria-live ${say.live}, role ${say.role})`,
    say.rail === 'true' && say.text === 'Potted: 1, 3, 2' && snap.includes('Potted: 1, 3, 2') && !say.live && !say.role && !say.hid && !/\d/.test(railSnap), JSON.stringify({ say, snap, railSnap }));
  const none = [];
  for (const [kind, o] of [['snooker', {}], ['carom', {}], ['bumper', {}], ['straight', {}], ['rotation', {}]]) {
    const r = await page.evaluate(async ([kind, o]) => {
      felt.start(kind, Object.assign({ level: 'easy' }, o));
      await new Promise(r => requestAnimationFrame(r));
      for (const b of game.balls.filter(b => b.n > 0).slice(0, 3)) b.on = false;
      await new Promise(r => setTimeout(r, 150));
      return { kind, n: potRail.children.length, hidden: potRail.hidden, words: potSay.textContent };
    }, [kind, o]);
    none.push(r);
  }
  /* a trick shot, the lesson, a tutorial: none; practice: they show */
  const solo = await page.evaluate(async () => {
    const out = {};
    const take = async k => { await new Promise(r => requestAnimationFrame(r)); for (const b of game.balls.filter(b => b.n > 0 && b.on).slice(0, 2)) b.on = false; await new Promise(r => setTimeout(r, 150)); out[k] = { n: potRail.querySelectorAll('.tw:not([hidden])').length, hidden: potRail.hidden, words: potSay.textContent }; };
    felt.trick(TRICKS[0].id); await take('trick'); felt.exitSolo();
    felt.tutorial('8'); await take('tutorial'); felt.exitSolo();
    felt.lesson && felt.lesson(); if (felt.lesson) { await take('lesson'); felt.exitSolo(); }
    felt.practice(); await take('practice'); felt.exitSolo();
    return out;
  }).catch(e => ({ err: String(e) }));
  check(`none for snooker, carom, bumper pool, 14.1 and rotation (${none.map(r => `${r.kind} ${r.n}`).join(', ')}), a trick shot, a tutorial or the lesson; practice has them (${JSON.stringify(solo)})`,
    none.every(r => r.n === 0 && r.hidden && !r.words) && solo.trick && solo.trick.n === 0 && !solo.trick.words && solo.tutorial.n === 0 && (!solo.lesson || solo.lesson.n === 0) && solo.practice.n === 2 && /^Potted: /.test(solo.practice.words), JSON.stringify({ none, solo }));
  /* a replay: none while it plays, back after */
  await page.evaluate(potSome, ['9', [1, 2]]);
  const rp = await page.evaluate(async () => {
    felt.speed = 8; const c = game.balls.find(b => b.n === 0); felt.shoot(0.3, 0.3, { x: 0, y: 0 });
    await new Promise(r => { const f = () => (felt.state === 'aim' || felt.state === 'thinking' || felt.state === 'choose' || felt.state === 'over' ? r() : setTimeout(f, 50)); f(); });
    felt.speed = 0.05; const ok = felt.replay();
    await new Promise(r => setTimeout(r, 300));
    const during = { rail: potRail.hidden, shown: [...potRail.children].filter(e => e.getClientRects().length).length };
    felt.skipReplay(); felt.speed = 1;
    await new Promise(r => setTimeout(r, 200));
    return { ok, c: !!c, during, after: potRail.hidden ? 0 : [...potRail.children].filter(e => e.getClientRects().length).length };
  });
  check(`a replay playing: no windows (${rp.during.shown}); back after it (${rp.after})`, rp.ok && rp.during.rail && rp.during.shown === 0 && rp.after >= 2, JSON.stringify(rp));
  check('no console errors (VoiceOver, none)', t.errors.length === 0, t.errors.slice(0, 3).join(' | '));
  await t.browser.close();
}
/* 6: a real pot rolls in; Reduce Motion; a ball back leaves; the cue over a window */
async function motionChecks() {
  for (const reduce of [false, true]) {
    const t = await open('', { viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true, motion: true, ...(reduce ? { reducedMotion: 'reduce' } : {}),
      init: `try { localStorage.setItem('felt.settings', JSON.stringify({ sv: 3, cpu: false })); } catch (e) { }` });
    const { page } = t;
    /* 9-ball: the 1 a few centimetres from the bottom-left corner pocket, the cue ball behind it on the line */
    const r = await page.evaluate(async () => {
      felt.start('9'); Object.assign(game, { breakShot: false, inHand: null, pushAvail: false });
      const k = POCKETS.findIndex(p => p[0] < 0.1 && p[1] < 0.1), A = POCKET_AIM[k], d = [A[0] - 0.3, A[1] - 0.3], l = Math.hypot(...d), u = [d[0] / l, d[1] / l];
      const keep = { 1: [A[0] - u[0] * 0.12, A[1] - u[1] * 0.12], 0: [A[0] - u[0] * 0.4, A[1] - u[1] * 0.4], 9: [TL * 0.75, TW * 0.5] };
      for (const b of game.balls) { const q = keep[b.n]; b.on = !!q; if (q) { b.x = q[0]; b.y = q[1]; } }
      hud(); felt.speed = 1;
      await new Promise(r => setTimeout(r, 200));
      const log = [];
      felt.shoot(Math.atan2(u[1], u[0]), 0.35, { x: 0, y: 0 });
      const t0 = performance.now();
      let gone = null;
      await new Promise(res => { const f = () => {
        const now = performance.now(), b1 = (felt.state === 'rolling' && tab ? tab : game).balls.find(b => b.n === 1);
        if (gone === null && b1 && !b1.on) gone = now;
        const e = potRail.querySelector('.tw[data-n="1"]');
        if (e) log.push({ t: Math.round(now - (gone || now)), anim: e.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length, y: e.firstElementChild.getBoundingClientRect().top - e.getBoundingClientRect().top });
        if (now - t0 > 6000 || (e && log.length > 40)) res(); else requestAnimationFrame(f); }; f(); });
      return { gone: gone !== null, first: log[0], log: log.filter((_, i) => i % 3 === 0).slice(0, 14), last: log[log.length - 1], drop: potMs(), potted: felt.potRail.order };
    });
    const name = reduce ? 'Reduce Motion' : 'motion';
    if (!reduce) check(`a real pot (${name}): the 1 drops (${r.drop} ms), then rolls up into its window (animated from below: first seen ${r.first && r.first.t} ms after the pot, moving ${r.first && r.first.anim} animation(s), ${r.first && r.first.y.toFixed(1)} px low), at rest in it within 300 ms`,
      r.gone && r.first && r.first.t >= r.drop - 40 && r.first.anim > 0 && r.first.y > 0.5 && r.last.anim === 0 && Math.abs(r.last.y - 1.5) < 1 && r.log.some(q => q.anim === 0 && q.t <= r.first.t + 330), JSON.stringify(r));
    else check(`a real pot (${name}): the 1 is simply there after its drop (first seen ${r.first && r.first.t} ms after, ${r.first && r.first.anim} animations)`, r.gone && r.first && r.first.anim === 0 && Math.abs(r.first.y - 1.5) < 1, JSON.stringify(r));
    /* a ball back on the table leaves its window; the one above moves down into its place */
    const back = await page.evaluate(async () => {
      felt.start('9'); Object.assign(game, { breakShot: false, inHand: null }); hud();
      await new Promise(r => requestAnimationFrame(r));
      for (const n of [2, 3]) { game.balls.find(b => b.n === n).on = false; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }
      await new Promise(r => setTimeout(r, 100));
      const y3 = felt.potRail.items.find(i => i.n === 3).y;
      game.balls.find(b => b.n === 2).on = true;
      await new Promise(r => setTimeout(r, 400));
      const it = felt.potRail.items.find(i => i.n === 3);
      return { left: felt.potRail.left, els: [...potRail.querySelectorAll('.tw')].map(e => e.dataset.n), moved: it && it.y > y3, words: potSay.textContent };
    });
    check(`${name}: a ball back on the table (the 2) leaves its window, the 3 moves down into its place (${JSON.stringify(back)})`, same(back.left, [3]) && same(back.els, ['3']) && back.moved && back.words === 'Potted: 3', JSON.stringify(back));
    if (!reduce) {
      /* the cue lying over a window: it gives way (the cue ball by the left rail, aimed across to the right) */
      const cue = await page.evaluate(async () => {
        felt.start('9'); Object.assign(game, { breakShot: false, inHand: null }); hud();
        await new Promise(r => requestAnimationFrame(r));
        for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) { game.balls.find(b => b.n === n).on = false; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }
        await new Promise(r => setTimeout(r, 100));
        const it = felt.potRail.items.find(i => i.n === 4), t = felt.toTable(it.x, it.y), c = game.balls.find(b => b.n === 0);
        c.x = t[0]; c.y = 0.12; aimAngle = Math.PI / 2; handAimed = true; aimLock = 'held'; aimAnim = null;
        await new Promise(r => setTimeout(r, 300));
        const hid = [...potRail.querySelectorAll('.tw.hid')].map(e => +e.dataset.n);
        aimAngle = 0; await new Promise(r => setTimeout(r, 300));
        return { hid, after: [...potRail.querySelectorAll('.tw.hid')].map(e => +e.dataset.n) };
      });
      check(`the cue lying over a window: that window gives way (${cue.hid}), and is back when the cue moves off (${cue.after})`, cue.hid.includes(4) && cue.hid.length <= 3 && !cue.after.includes(4), JSON.stringify(cue));
    }
    check(`${name}: no console errors`, t.errors.length === 0, t.errors.slice(0, 3).join(' | '));
    await t.browser.close();
  }
}
/* 7. two-digit numbers (10 to 15) read cleanly at the small sizes: in the windows and on the rail's next ball, at 375x667
   and 393x852 (dpr 3), each number's glyph box (its ink, measured on a canvas at 100 px in the number's own font, weight,
   letter-spacing and numerals, times its transform's horizontal scale) lies inside the ivory circle with room (its corners
   within 90% of the radius), the two digits apart (a positive gap, not run together), at the one-digit size (the same
   font size as the 9's) and no narrower than 0.75 of it */
async function numberChecks() {
  for (const [w, h] of [[375, 667], [393, 852]]) {
    const t = await open('', { viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 3,
      init: `try { localStorage.setItem('felt.settings', JSON.stringify({ sv: 3, cpu: true })); } catch (e) { }` });
    const { page } = t;
    await page.evaluate(potSome, ['8', [9, 10, 11, 13, 14, 15, 1], ['stripes', 'solids'], 0]);
    await page.evaluate(() => { const c = game.balls.find(b => b.n === 0), o = game.balls.find(b => b.n === 12); Object.assign(c, { x: TL / 2, y: TW / 2 }); Object.assign(o, { x: TL * 0.3, y: TW * 0.3 }); aimAngle = Math.atan2(o.y - c.y, o.x - c.x); handAimed = true; aimLock = 'held'; aimAnim = null; });
    await frames(page, 4);
    const r = await page.evaluate(() => {
      const cv = document.createElement('canvas').getContext('2d');
      const one = e => {
        const c = e.getBoundingClientRect(), t = e.textContent, x = e.querySelector('.nd') || e, cs = getComputedStyle(x);
        const fs = parseFloat(cs.fontSize), K = 100 / fs, ls = parseFloat(cs.letterSpacing) || 0;
        cv.font = `${cs.fontWeight} 100px ${cs.fontFamily}`; cv.fontVariantNumeric = cs.fontVariantNumeric; cv.letterSpacing = (ls * K) + 'px';
        const sx = cs.transform === 'none' ? 1 : new DOMMatrix(cs.transform).a;
        const m = cv.measureText(t), d = [...t].map(ch => cv.measureText(ch));
        const gap = t.length === 2 ? ((d[0].width + ls * K - d[0].actualBoundingBoxRight) + d[1].actualBoundingBoxLeft) / K * sx : null;
        const gw = (m.actualBoundingBoxLeft + m.actualBoundingBoxRight - (t.length === 2 ? ls * K : 0)) / K * sx, gh = (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) / K;
        return { t, D: +c.width.toFixed(2), fs: +fs.toFixed(2), sx, fit: +(Math.hypot(gw / 2, gh / 2) / (c.width / 2)).toFixed(3), gap: gap === null ? null : +(gap / fs).toFixed(3) };
      };
      const nb = pchip0.querySelector('.nb .nn');
      return { wins: [...potRail.querySelectorAll('.tw .nn')].map(one), next: nb ? one(nb) : null };
    });
    const nine = r.wins.find(x => x.t === '9'), two = r.wins.filter(x => x.t.length === 2);
    const ok = x => x.fit <= 0.9 && x.gap > 0 && x.sx >= 0.75;
    check(`${w}x${h}: the windows' 10, 11, 13, 14 and 15 read cleanly: each glyph box inside the ivory circle with room (at most ${Math.max(...two.map(x => x.fit))} of the radius), the digits apart (${Math.min(...two.map(x => x.gap))} em), at the 9's size`,
      two.length === 5 && !!nine && two.every(x => ok(x) && x.fs === nine.fs && x.D === nine.D), JSON.stringify(r.wins));
    check(`${w}x${h}: the rail's next ball, the 12, reads cleanly the same way (${r.next && r.next.fit} of the radius, ${r.next && r.next.gap} em apart)`, !!r.next && r.next.t === '12' && ok(r.next), JSON.stringify(r.next));
    check(`${w}x${h}: no console errors (the numbers)`, t.errors.length === 0, t.errors.slice(0, 3).join(' | '));
    await t.browser.close();
  }
}
(async () => {
  /* a part that throws (a page without the windows: the base build) fails as a check, and the rest still run */
  for (const [name, part] of [['the layout', layoutChecks], ['3D', view3dChecks], ['the looks', lookChecks], ['VoiceOver and where there are none', voiceAndNoneChecks], ['the motion', motionChecks], ['the two-digit numbers', numberChecks]]) {
    try { await part(); } catch (e) { check(`${name}: ran through`, false, String(e.message || e).split('\n')[0]); }
  }
  done();
})();
