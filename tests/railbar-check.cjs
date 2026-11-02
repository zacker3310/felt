#!/usr/bin/env node
/* railbar-check: the bottom rail's row (page 6b2, placeRail): the 3D switch, the score keeper (a chip per player),
   snooker's scoreboard and the replay (its offer, or the badge and Skip while one plays) inlaid on the rail nearest the
   player, top-down on the table's bottom rail and in 3D on the stage's bottom row (V3_PIN_B).
   1. the inlay on every rail look (walnut, cherry, light oak, ebony) at 430x932 and 932x430 with iOS insets, 8-ball,
      snooker and carom: every pearl inlay against the dark edge cut round it over the wood (the worst pixel), dimmed and
      lit: numerals 4.5:1, glyphs and pips 3:1.
   2. for every game and table (8-ball 7 ft and 9 ft, 9, 10, 14.1, rotation, bumper octagon and rectangle, snooker 10 ft
      and 12 ft, carom), upright (393x852, 375x667, 440x956, 430x932 with insets) and on its side (852x393, 667x375,
      932x430 with insets), top-down and in 3D, with and without the replay's offer (plain and gold):
      - no target over a pocket's hole; no pill (what shows) over a hole, its jaws (MOUTHS) or a diamond (railSights),
        as the screen shows them (top-down through the fitted view, in 3D as projected);
      - nothing shown overlaps, no two targets overlap; every target 44 px and inside the stage; type 11 px or more;
      - top-down every pill lies wholly on the rail's band (a party's overflow on the far rail's), in 3D on the bottom row;
      - the score keeper always there, whole; the scoreboard on both snooker tables; the switch missing only with no room.
   3. the table fills the room (8-ball, top-down): on its binding axis the free bands sum to FIT_PX or less (counting the
      inset its rails may run under), on its side the band across BAND_PX or less unless the column took its 24 px (a
      phone on its side is the upright layout turned: the room left across stays empty, boot-check pins the footprint), and
      the bed inside the safe area.
   4. the controls, a replay playing, a party of three and four, and what rises clear of the row (the call bar, the
      exhibition's bar, the practice tools, a tutorial's coach card).
   5. the ball to play next (railNext) on the shooter's seat, 8-ball vs the CPU with the groups set, at 393x852, 440x956 and
      956x440 (iOS insets) top-down and 393x852 in 3D: the ball the table rings (the call's ring, else auto aim's) by
      number, in the ball set's colour (sampled; a stripe's ivory caps), its number 3:1 or more on its circle, the group
      glyph on both seats, nothing over a pocket or a diamond, following the aim to another ball and a call; nothing
      extra on the CPU's turn; 9-ball's seat the lowest ball. Under house 8-ball (nothing called, issue #5) the seat follows
      the aim: the guide's first contact when it is the shooter's legal target (one of the group to another), else auto
      aim's suggestion (an opponent's ball, the 8 on an open table, nothing on the line), the white ring unchanged.
   6. VoiceOver (issue #4), top-down and in 3D: in the accessibility tree each seat is a group whose words name the
      player, what they are on (group, points) and on the shooter's turn "shooting" and the ball to play; the turn is
      spoken once by the polite #railSay (its mutations counted: one per shooter change, a real shot's too, none while
      aiming from ball to ball though the seats are laid again). */
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
/* the replay's pills scale in (rplIn, from .94): wait for the animations to end, not a fixed time, so a loaded runner
   never measures a pill mid-scale (a 44 px target reads 41) */
const rplSettled = page => page.evaluate(() => Promise.all([...document.querySelectorAll('.rpl')].flatMap(e => e.getAnimations({ subtree: true }).map(a => a.finished.catch(() => {})))));
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

/* in the page: each inlay on the rail against the edge cut round it (the sights' dark stroke, --ink-edge) over the wood
   it is set in (the table's baked image under it, every pixel: the worst one counts), at its own opacity (a dimmed
   seat, the switch off): numerals 4.5:1, glyphs and pips 3:1 */
function inlayContrast() {
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const mix = (top, a, under) => top.map((v, i) => v * a + under[i] * (1 - a));
  const rgb = c => c.match(/[\d.]+/g).slice(0, 3).map(Number);
  const g = tableImg.getContext('2d'), out = [], em = getComputedStyle(stage).getPropertyValue('--ink-edge').match(/[\d.]+/g).map(Number), edge = em.slice(0, 3), ea = em[3];
  for (const el of [pchip0, pchip1, snkBar, viewBtn.firstElementChild, replayBtn.firstElementChild]) {
    if (el.closest('[hidden]') || !el.getClientRects().length || getComputedStyle(el.parentElement).visibility === 'hidden' || getComputedStyle(el).visibility === 'hidden') continue;
    const cs = getComputedStyle(el), ink = rgb(cs.color), a = +cs.opacity, num = /\d/.test([...el.querySelectorAll('.num, b:not(.inw), .of')].map(e => e.textContent).join(''));
    const q = el.getBoundingClientRect(), d = dpr, px = g.getImageData(Math.round(q.left * d), Math.round(q.top * d), Math.max(1, Math.round(q.width * d)), Math.max(1, Math.round(q.height * d))).data;
    let worst = Infinity, wood = null;
    for (let i = 0; i < px.length; i += 4) { const c = [px[i], px[i + 1], px[i + 2]], r = ratio(mix(ink, a, c), mix(edge, ea * a, c)); if (r < worst) { worst = r; wood = c; } }
    out.push({ id: el.id || el.parentElement.id, num, ratio: +worst.toFixed(2), need: num ? 4.5 : 3, ink, a, wood });
  }
  return out;
}

/* in the page: the shooter's seat and what the table rings (5): the call's ring (drawCall: the player's or the obvious
   call from the aim) when there is one, else auto aim's (drawHint) */
function nextNow() {
  const c = felt.callState.call, ringed = c && c.ball != null ? c.ball : felt.hint ? felt.hint.n : null;
  const seat = el => { const nb = el.querySelector('.nb'), g = el.querySelector('.grp'), r = nb && nb.getBoundingClientRect(), i = nb && nb.firstElementChild, cs = i && getComputedStyle(i);
    return { id: el.id, on: el.classList.contains('on'), n: nb ? +nb.dataset.n : null, text: i ? i.textContent : null, grp: g ? g.className : null, words: el.children[1].textContent,
      rect: r ? [r.left, r.top, r.width, r.height] : null, fg: cs && cs.color, bg: cs && cs.backgroundColor, font: cs ? parseFloat(cs.fontSize) : 0 }; };
  return { ringed, seats: [pchip0, pchip1].map(seat), turn: game.turn, human: felt.state === 'aim' && !(cpuMode && game.turn === 1) };
}
/* a seat's ball against the ball set's colour: from a screenshot of it, the band (or the solid's body) left of the
   number circle, and a stripe's ivory cap above it; the number against its circle by the computed colours */
async function ballLooks(page, seat, want) {
  const png = await page.screenshot({ clip: { x: seat.rect[0], y: seat.rect[1], width: seat.rect[2], height: seat.rect[3] }, scale: 'device' });
  return page.evaluate(([b64, want, fg, bg]) => new Promise(res => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      const W = im.width, H = im.height, avg = (x0, y0, x1, y1) => { const d = x.getImageData(Math.round(x0 * W), Math.round(y0 * H), Math.max(1, Math.round((x1 - x0) * W)), Math.max(1, Math.round((y1 - y0) * H))).data, s = [0, 0, 0];
        for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) s[k] += d[i + k]; return s.map(v => Math.round(v / (d.length / 4))); };
      const band = avg(0.1, 0.42, 0.17, 0.58), cap = avg(0.42, 0.07, 0.58, 0.15), dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      const lum = q => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(q[0]) + 0.7152 * f(q[1]) + 0.0722 * f(q[2]); };
      const rgb = s => s.match(/[\d.]+/g).slice(0, 3).map(Number), lf = lum(rgb(fg)), lb = lum(rgb(bg));
      res({ band, cap, want: want.col, dBand: Math.round(dist(band, want.col)), dCap: Math.round(dist(cap, want.iv)), num: +((Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05)).toFixed(2) });
    };
    im.src = 'data:image/png;base64,' + b64;
  }), [png.toString('base64'), want, seat.fg, seat.bg]);
}
async function nextBallChecks() {
  for (const [w, h, ins, view, balls] of [[393, 852, null, 'top', 'classic'], [440, 956, [62, 0, 34, 0], 'top', 'tv'], [956, 440, [0, 62, 21, 62], 'top', 'classic'], [393, 852, null, '3d', 'vintage']]) {
    const size = `${w}x${h}${ins ? ' (iOS insets)' : ''} ${view === '3d' ? '3D' : 'top-down'}, ${balls} balls`;
    const t = await open('', { viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 3,
      init: `try { localStorage.setItem('felt.looks.v1', '{"v":1,"own":["balls-tv","balls-vintage"]}'); localStorage.setItem('felt.settings', JSON.stringify({ sv: 3, cpu: true, view: '${view}', balls: '${balls}' })); } catch (e) { }` });
    const { page } = t;
    /* 8-ball vs the CPU, stripes for the player, a few balls on the table: the 11 and the 14 each on a line from the
       cue ball (the middle of the bed) to a corner pocket, so aiming at either makes an obvious call (8-ball WPA calls) */
    const setup = await page.evaluate(i => {
      if (i) { const st = document.createElement('style'); st.id = 'insets'; document.head.appendChild(st); st.textContent = `html:root { --sat: ${i[0]}px; --sar: ${i[1]}px; --sab: ${i[2]}px; --sal: ${i[3]}px; }`; }
      felt.start('8', { level: 'easy', rules: { ruleset: '8-wpa' } }); relayout();
      Object.assign(game, { breakShot: false, open: false, groups: ['stripes', 'solids'], inHand: null, pushAvail: false });
      const keep = { 0: [TL / 2, TW / 2], 8: [TL * 0.85, TW * 0.5], 4: [TL * 0.2, TW * 0.5], 6: [TL * 0.8, TW * 0.85] };
      const via = (k, f) => [TL / 2 + (POCKET_AIM[k][0] - TL / 2) * f, TW / 2 + (POCKET_AIM[k][1] - TW / 2) * f];
      keep[11] = via(0, 0.55); keep[14] = via(2, 0.55);
      for (const b of game.balls) { const q = keep[b.n]; b.on = !!q; if (q) { b.x = q[0]; b.y = q[1]; } }
      autoAim(); hud();
      return { stripes: game.groups[0], look: look().balls };
    }, ins);
    await page.waitForTimeout(500);
    const aimAt = n => page.evaluate(n => { const c = game.balls.find(b => b.n === 0), o = game.balls.find(b => b.n === n); aimAngle = Math.atan2(o.y - c.y, o.x - c.x); handAimed = true; aimLock = 'held'; aimAnim = null; }, n);
    const read = async () => { await frames(page, 3); return page.evaluate(nextNow); };
    const res = [];
    for (const n of [11, 14]) { await aimAt(n); res.push(Object.assign(await read(), { aimed: n })); }
    const a = res[1], me = a.seats.find(s => s.on), other = a.seats.find(s => !s.on);
    const want = await page.evaluate(n => { const B = BALLSETS[look().balls]; const c = B.col && B.col[n > 8 ? n - 8 : n] || colorOf(n); return { col: c, iv: B.ivory.match(/[0-9a-f]{2}/gi).map(v => parseInt(v, 16)) }; }, me.n || 14);
    const looks = me.rect ? await ballLooks(page, me, want) : null;
    const audit0 = await page.evaluate(audit);
    check(`${size}: the shooter's seat shows the ball the table rings, by number (aimed at the 11: the ${res[0].seats.find(s => s.on).n}, rings the ${res[0].ringed}; at the 14: the ${me.n}, rings the ${a.ringed}), its words for VoiceOver ("${me.words}")`,
      res.every(r => { const s = r.seats.find(q => q.on); return r.human && s.n === r.aimed && s.n === r.ringed && s.text === String(r.aimed); }) && me.words === 'Next: the 14, stripe' && !other.n && !other.words, JSON.stringify(res));
    check(`${size}: the ball in the player's ball set's colour (band ${looks && looks.band} vs ${want.col}, off by ${looks && looks.dBand}), a stripe's ivory cap (off by ${looks && looks.dCap}), its number ${looks && looks.num}:1 on its circle at ${me.font} px`,
      !!looks && looks.dBand <= 40 && looks.dCap <= 40 && looks.num >= 3 && me.font >= 7, JSON.stringify({ looks, me }));
    check(`${size}: the group glyph on both seats (stripes for the shooter, solids for the CPU), the row off every pocket, jaw and diamond`,
      me.grp === 'grp t' && other.grp === 'grp s' && audit0.chips && audit0.fails.length === 0, JSON.stringify({ me: me.grp, other: other.grp, fails: audit0.fails }));
    /* a call set by taps (the 4, a solid: not the player's group, still what the table rings), then the CPU's turn */
    await page.evaluate(() => felt.setCall({ ball: 4, pocket: 0 }));
    const called = await read();
    await page.evaluate(() => { felt.setCall(null); game.turn = 1; hud(); });
    const cpu = await read();
    await page.evaluate(() => { game.turn = 0; hud(); });
    check(`${size}: a call set shows the called ball (the ${called.seats.find(s => s.on).n}, rings the ${called.ringed}); on the CPU's turn neither seat shows a ball to play, both keep the group`,
      called.seats.find(s => s.on).n === 4 && called.ringed === 4 && cpu.seats.every(s => s.n === null && !s.words && s.grp), JSON.stringify({ called: called.seats, cpu: cpu.seats }));
    /* 9-ball: the lowest ball on */
    await page.evaluate(() => { felt.start('9', { level: 'easy' }); Object.assign(game, { breakShot: false, inHand: null, pushAvail: false }); for (const n of [1, 2]) game.balls.find(b => b.n === n).on = false; autoAim(); hud(); });
    const nine = await read();
    const s9 = nine.seats.find(s => s.on);
    const want9 = await page.evaluate(() => { const B = BALLSETS[look().balls]; return { col: B.col && B.col[3] || colorOf(3), iv: [0, 0, 0] }; });
    const l9 = s9.rect ? await ballLooks(page, s9, want9) : null;
    const audit9 = await page.evaluate(audit);
    check(`${size}: 9-ball: the shooter's seat shows the lowest ball, the 3 (${s9.n}), in its colour (off by ${l9 && l9.dBand}), off the pockets and diamonds`,
      s9.n === 3 && s9.text === '3' && !!l9 && l9.dBand <= 40 && audit9.fails.length === 0, JSON.stringify({ nine, l9, fails: audit9.fails }));
    check(`${size}: no console errors (the ball to play)`, t.errors.length === 0, t.errors.slice(0, 3).join(' | '));
    await t.browser.close();
  }
}
/* 5 (house 8-ball, issue #5) and 6 (VoiceOver, issue #4) */
async function aimAndVoiceChecks() {
  for (const view of ['top', '3d']) {
    const size = `393x852 ${view === '3d' ? '3D' : 'top-down'}`;
    const t = await open('', { viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1,
      init: `try { localStorage.setItem('felt.settings', JSON.stringify({ sv: 3, cpu: true, view: '${view}' })); } catch (e) { }` });
    const { page } = t;
    /* house 8-ball vs the CPU, stripes for the player: the 11 and the 14 (the player's) and the 4 (the CPU's) on lines
       from the cue ball in the middle of the bed */
    await page.evaluate(() => {
      felt.start('8', { level: 'easy' }); relayout();
      Object.assign(game, { breakShot: false, open: false, groups: ['stripes', 'solids'], inHand: null, pushAvail: false });
      const keep = { 0: [TL / 2, TW / 2], 8: [TL * 0.85, TW * 0.5], 4: [TL * 0.2, TW * 0.5], 6: [TL * 0.8, TW * 0.85] };
      const via = (k, f) => [TL / 2 + (POCKET_AIM[k][0] - TL / 2) * f, TW / 2 + (POCKET_AIM[k][1] - TW / 2) * f];
      keep[11] = via(0, 0.55); keep[14] = via(2, 0.55);
      for (const b of game.balls) { const q = keep[b.n]; b.on = !!q; if (q) { b.x = q[0]; b.y = q[1]; } }
      autoAim(); hud();
      /* the live region's words as they change (non-empty: what VoiceOver would speak) */
      window.sayLog = [];
      const el = document.getElementById('railSay');
      if (el) new MutationObserver(() => { if (el.textContent) sayLog.push(el.textContent); }).observe(el, { childList: true, characterData: true, subtree: true });
    });
    await page.waitForTimeout(300);
    const aimAt = n => page.evaluate(n => { const c = game.balls.find(b => b.n === 0), o = typeof n === 'number' ? game.balls.find(b => b.n === n) : null;
      aimAngle = o ? Math.atan2(o.y - c.y, o.x - c.x) : n.a; handAimed = true; aimLock = 'held'; aimAnim = null; }, n);
    const seatNow = () => page.evaluate(() => { const nb = pchip0.querySelector('.nb'), c = cueBall(), h = aimTrace(c.x, c.y, Math.cos(aimAngle), Math.sin(aimAngle), [0], 6);
      return { n: nb ? +nb.dataset.n : null, hint: felt.hint ? felt.hint.n : null, contact: h.kind === 'ball' && h.ball ? h.ball.n : null, on: pchip0.classList.contains('on') }; });
    const aims = [];
    for (const n of [11, 14, 11, 4, { a: Math.PI / 2 }, 14]) { await aimAt(n); await frames(page, 3); aims.push(Object.assign(await seatNow(), { aimed: typeof n === 'number' ? n : 'nothing' })); }
    const [a11, a14, b11, a4, none, c14] = aims, ring = aims.map(a => a.hint);
    check(`${size}: house 8-ball (no call): the shooter's seat follows the aim from one of the group to another (the 11: ${a11.n}, the 14: ${a14.n}, the 11 again: ${b11.n}, the 14 again: ${c14.n}), the white ring unchanged (the ${ring[0]})`,
      a11.on && a11.contact === 11 && a11.n === 11 && a14.contact === 14 && a14.n === 14 && b11.n === 11 && c14.n === 14 && ring.every(r => r === ring[0] && [11, 14].includes(r)), JSON.stringify(aims));
    check(`${size}: house 8-ball: aimed at the CPU's ball (the 4: ${a4.n}) or at nothing (${none.n}), the seat falls back to auto aim's suggestion, the ringed ${ring[0]}`,
      a4.contact === 4 && a4.n === ring[0] && none.contact === null && none.n === ring[0], JSON.stringify({ a4, none }));
    /* an open table: any ball but the 8 is the shooter's; the 8 falls back to the suggestion */
    const open8 = [];
    await page.evaluate(() => { Object.assign(game, { open: true, groups: [null, null] }); autoAim(); hud(); });
    for (const n of [4, 8]) { await aimAt(n); await frames(page, 3); open8.push(Object.assign(await seatNow(), { aimed: n })); }
    check(`${size}: house 8-ball, an open table: aimed at the 4 the seat shows it (${open8[0].n}); aimed at the 8, the suggestion (${open8[1].n}, rings the ${open8[1].hint})`,
      open8[0].n === 4 && open8[1].contact === 8 && open8[1].n === open8[1].hint && open8[1].hint !== 8 && open8[1].hint !== null, JSON.stringify(open8));
    await page.evaluate(() => { Object.assign(game, { open: false, groups: ['stripes', 'solids'] }); autoAim(); hud(); });

    /* 6: the accessibility tree: each seat a group with its words (aria snapshots: nothing under aria-hidden) */
    await aimAt(14); await frames(page, 3);
    const snap = async () => ({ row: await page.locator('#turnChip').ariaSnapshot().catch(e => 'ERR ' + e.message), s0: await page.locator('#pchip0').ariaSnapshot().catch(() => ''), s1: await page.locator('#pchip1').ariaSnapshot().catch(() => '') });
    const mine = await snap();
    await page.evaluate(() => { game.turn = 1; hud(); });
    await frames(page, 2);
    const theirs = await snap();
    await page.evaluate(() => { game.turn = 0; hud(); });
    check(`${size}: VoiceOver: the rail's seats are in the accessibility tree, each a group: the player's seat ${JSON.stringify(mine.s0)}, the CPU's ${JSON.stringify(mine.s1)}`,
      /^- group:?/.test(mine.s0) && /^- group:?/.test(mine.s1) && mine.s0.includes('You, stripes, shooting, next: the 14, stripe') && mine.s1.includes('CPU, solids') && !mine.s1.includes('shooting') && !/next/.test(mine.s1)
        && (mine.row.match(/- group/g) || []).length === 2, JSON.stringify(mine));
    check(`${size}: VoiceOver: on the CPU's turn its seat says shooting and neither names a ball to play (${JSON.stringify(theirs.s1)})`,
      theirs.s1.includes('CPU, solids, shooting') && theirs.s0.includes('You, stripes') && !/shooting|next/.test(theirs.s0) && !/next/.test(theirs.s1), JSON.stringify(theirs));
    /* points: 14.1 and snooker, two players */
    const pts = await page.evaluate(() => {
      const out = {};
      felt.start('straight', { level: 'easy' }); game.score = [12, 7]; hud(); out.straight = [pchip0, pchip1].map(e => e.children[2].textContent);
      felt.start('snooker', { level: 'easy' }); game.score = [23, 8]; hud(); out.snooker = [pchip0, pchip1].map(e => e.children[2].textContent);
      return out;
    });
    const race = await page.evaluate(() => game.race);
    check(`${size}: VoiceOver: a seat says the score where the game counts it (14.1 ${JSON.stringify(pts.straight)}, snooker ${JSON.stringify(pts.snooker)})`,
      pts.straight.some(w => /^You, 12 of \d+ points/.test(w)) && pts.straight.some(w => /^CPU, 7 of \d+ points/.test(w)) && pts.snooker.some(w => /^You, 23 points/.test(w)) && pts.snooker.some(w => /^CPU, 8 points/.test(w)), JSON.stringify({ pts, race }));

    check(`${size}: no console errors (the aim and VoiceOver)`, t.errors.length === 0, t.errors.slice(0, 3).join(' | '));
    await t.browser.close();
    /* the live region: two players (no CPU), the turn spoken once a change, never while aiming */
    if (view === 'top') {
      const t = await open('', { viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1,
        init: `try { localStorage.setItem('felt.settings', JSON.stringify({ sv: 3, cpu: false, view: 'top' })); } catch (e) { }` });
      const { page } = t;
      const aimAt = n => page.evaluate(n => { const c = game.balls.find(b => b.n === 0), o = game.balls.find(b => b.n === n); aimAngle = Math.atan2(o.y - c.y, o.x - c.x); handAimed = true; aimLock = 'held'; aimAnim = null; }, n);
      await page.evaluate(() => {
        window.sayLog = [];
        const el = document.getElementById('railSay');
        if (el) new MutationObserver(() => { if (el.textContent) sayLog.push(el.textContent); }).observe(el, { childList: true, characterData: true, subtree: true });
        felt.start('8'); relayout();   /* no options: the settings' two players */
        Object.assign(game, { breakShot: false, open: false, groups: ['stripes', 'solids'], inHand: null, pushAvail: false });
        const keep = { 0: [TL / 2, TW / 2], 8: [TL * 0.85, TW * 0.5], 4: [TL * 0.2, TW * 0.5], 6: [TL * 0.8, TW * 0.85] };
        const via = (k, f) => [TL / 2 + (POCKET_AIM[k][0] - TL / 2) * f, TW / 2 + (POCKET_AIM[k][1] - TW / 2) * f];
        keep[11] = via(0, 0.55); keep[14] = via(2, 0.55);
        for (const b of game.balls) { const q = keep[b.n]; b.on = !!q; if (q) { b.x = q[0]; b.y = q[1]; } }
        autoAim(); hud();
      });
      await page.waitForTimeout(200);
      const live = await page.evaluate(() => { const el = document.getElementById('railSay'); return { role: el && el.getAttribute('role'), live: el && el.getAttribute('aria-live'), text: el && el.textContent, start: sayLog.slice() }; });
      await page.evaluate(() => { sayLog.length = 0; window.nxLog = []; new MutationObserver(() => nxLog.push(pchip0.children[1].textContent)).observe(pchip0.children[1], { childList: true, characterData: true, subtree: true }); });
      for (const n of [11, 14, 4, 11, 14, 11]) { await aimAt(n); await frames(page, 3); }
      const aiming = await page.evaluate(() => ({ say: sayLog.slice(), nx: nxLog.slice() }));
      await page.evaluate(() => { sayLog.length = 0; game.turn = 1; hud(); hud(); railNextTick(); hud(); });
      await frames(page, 4);
      await page.waitForTimeout(150);
      const turn = await page.evaluate(() => sayLog.slice());
      /* a real shot: the words once if the turn passed, none if the shooter goes again */
      await page.evaluate(() => { sayLog.length = 0; game.turn = 0; hud(); });
      await page.waitForTimeout(150);
      const back = await page.evaluate(() => sayLog.slice());
      await page.evaluate(() => { sayLog.length = 0; felt.speed = 8; window.turnBefore = game.turn; felt.shoot(Math.PI / 2, 0.15, { x: 0, y: 0 }); });
      await page.waitForFunction(() => felt.state === 'aim' || felt.state === 'over' || felt.state === 'choose', null, { timeout: 30000 }).catch(() => { });
      await frames(page, 4);
      await page.waitForTimeout(150);
      const shot = await page.evaluate(() => ({ say: sayLog.slice(), passed: game.turn !== turnBefore, turn: game.turn }));
      check(`${size}: VoiceOver: the turn is spoken by a polite live region, once as the game starts (#railSay ${live.role}, ${live.live}: ${JSON.stringify(live.start)})`,
        live.role === 'status' && live.live === 'polite' && live.text === "Player 1's turn, open table" && live.start.length === 1 && live.start[0] === live.text, JSON.stringify(live));
      check(`${size}: VoiceOver: aiming from ball to ball changes the seat's words (${aiming.nx.length} times) but speaks nothing (${aiming.say.length})`,
        aiming.nx.length >= 4 && aiming.say.length === 0, JSON.stringify(aiming));
      check(`${size}: VoiceOver: a shooter change is spoken once (${JSON.stringify(turn)}), and back (${JSON.stringify(back)}); a real shot once if the turn passed, else nothing (passed ${shot.passed}: ${JSON.stringify(shot.say)})`,
        turn.length === 1 && turn[0] === "Player 2's turn, solids" && back.length === 1 && back[0] === "Player 1's turn, stripes" && shot.say.length === (shot.passed ? 1 : 0), JSON.stringify({ turn, back, shot }));
      check(`${size}: no console errors (the turn spoken)`, t.errors.length === 0, t.errors.slice(0, 3).join(' | '));
      await t.browser.close();
    }
  }
}
(async () => {
  await nextBallChecks();
  await aimAndVoiceChecks();
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
    for (const rail of ['walnut', 'cherry', 'oak', 'ebony']) for (const kind of ['8', 'snooker', 'carom']) {
      res.push(...await t.page.evaluate(async ([i, rail, kind, fn]) => {
        if (!document.getElementById('insets')) { const st = document.createElement('style'); st.id = 'insets'; document.head.appendChild(st); st.textContent = `html:root { --sat: ${i[0]}px; --sar: ${i[1]}px; --sab: ${i[2]}px; --sal: ${i[3]}px; }`; }
        setSetting('rail', rail); felt.start(kind); relayout();
        offer = { rec: null, notable: null, until: performance.now() + 1e7 }; replayBtn.hidden = false; placeReplay();
        await new Promise(r => setTimeout(r, 300));
        const f = new Function('return ' + fn)();
        return f().map(o => Object.assign(o, { rail, kind, look: look().rail }));
      }, [ins, rail, kind, inlayContrast.toString()]));
    }
    const bad = res.filter(r => r.ratio < r.need || r.look !== r.rail);
    check(`${w}x${h} (iOS insets): every inlay on the rail against the wood it is set in, on every rail look: numerals 4.5:1, glyphs and pips 3:1 (worst numeral ${Math.min(...res.filter(r => r.num).map(r => r.ratio))}:1, worst glyph ${Math.min(...res.filter(r => !r.num).map(r => r.ratio))}:1, ${res.length} inlays)`,
      res.length >= 36 && res.some(r => r.num) && bad.length === 0, JSON.stringify(bad.length ? bad : res.slice(0, 3)));
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
        return { vert: +vert.toFixed(1), horiz: +horiz.toFixed(1), wide, rot: document.documentElement.dataset.rot || null, colx, bedSafe, k: +viewBase.k.toFixed(1), R: [R.left, R.top, R.right, R.bottom].map(Math.round), ball: +felt.ballPx.toFixed(2) };
      }, ins || null);
      check(`${size}: the table fills the room (binding axis free bands ${Math.min(fit.vert, fit.horiz)} px <= ${FIT_PX}${fit.wide ? (fit.rot ? `, across: a phone on its side is the upright layout turned, the room left stays empty (${fit.horiz} px)` : `, across ${fit.horiz} px <= ${BAND_PX} or the column wider by 24 px`) : ''}), its bed inside the safe area (ball ${fit.ball} px)`,
        Math.min(fit.vert, fit.horiz) <= FIT_PX && (!fit.wide || fit.rot || fit.horiz <= BAND_PX || fit.colx >= 24) && fit.bedSafe, JSON.stringify(fit));
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
        await page.waitForTimeout(350);   /* the pill scales in over 200 ms (rplIn) */ await rplSettled(page);
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
       tall: a phone's column is the upright strip turned (data-rot, 2026-11-02), so its wheel is the upright one's
       72 px or more turned, 56 across; a tablet's column keeps 112 px or more), every control 44 px and on screen,
       the power bar still the biggest */
    const ctlr = await page.evaluate(() => {
      felt.start('8', { level: 'easy' });
      const R = e => e.getBoundingClientRect(), wl = R(fineWheel), bar = R(powerBar), port = document.documentElement.dataset.layout === 'portrait';
      const ctls = [menuBtn, spinPad, powerBar, fineWheel].map(R);
      return { port, rot: document.documentElement.dataset.rot || null, wheel: [Math.round(wl.width), Math.round(wl.height)], bar: [Math.round(bar.width), Math.round(bar.height)], offStrip: !ctl.contains(turnChip),
        ok: ctls.every(r => Math.min(r.width, r.height) >= 44 && r.left >= -0.5 && r.right <= innerWidth + 0.5 && r.top >= -0.5 && r.bottom <= innerHeight + 0.5),
        barBig: ctls.every(r => r === ctls[2] || r.width * r.height < bar.width * bar.height) };
    });
    check(`${size}: the controls: no chips in the strip, the fine-aim wheel wide upright, tall on its side (${ctlr.wheel.join('x')}), the bar the biggest (${ctlr.bar.join('x')}), all 44 px and on screen`,
      ctlr.offStrip && ctlr.ok && ctlr.barBig && (ctlr.port ? ctlr.wheel[0] >= 72 : ctlr.rot ? ctlr.wheel[1] >= 72 && ctlr.wheel[0] === 56 : ctlr.wheel[1] >= 112), JSON.stringify(ctlr));
    /* the replay playing: the badge and Skip on the row, Skip a 44 px target, apart and off the pockets (replays are drawn top-down) */
    await page.evaluate(() => { felt.start('8', { level: 'easy' }); felt.speed = 8; felt.shoot(0.02, 0.6, { x: 0, y: 0 }); });
    await page.waitForFunction(() => felt.state === 'aim' || felt.state === 'thinking' || felt.state === 'choose', null, { timeout: 30000 }).catch(() => { });
    const rp0 = await page.evaluate(() => { felt.speed = 0.05; return felt.replay(); });
    await page.waitForTimeout(500);   /* past the badge's and Skip's scale-in (rplIn) on a slow runner */ await rplSettled(page);
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
      const shown = await page.evaluate(() => [...turnChip.querySelectorAll('.pchip')].filter(e => !e.hidden).map(e => e.textContent).join('|'));
      party.push({ n, shown, chips: a.chips, fails: a.fails });
    }
    check(`${size}: a party of three and four: every chip (name and points) on the row, whole, off the pockets`,
      party.every(q => q.chips && q.fails.length === 0 && q.shown.split('|').length === q.n), JSON.stringify(party));
    /* what rises clear of the row: the call bar, the exhibition's bar, the practice tools, the coach's card */
    const clear = [];
    await page.evaluate(() => {
      felt.start('10', { level: 'easy', table: '7', pockets: 'regulation', rules: { ruleset: '10-wpa', call: { mode: 'all', detail: 'ball', safety: false } } });
      Object.assign(felt.game, { breakShot: false, inHand: null, pushAvail: false }); hud();
    });
    await frames(page, 3);
    /* the call (5c): its menu, opened from the power bar, stands clear of the row too */
    await page.evaluate(() => { hudCall(); callMenuToggle(); });
    await page.waitForTimeout(350);
    clear.push(['call menu', await page.evaluate(clearOfRow, '#callBar')]);
    await page.evaluate(() => popClose());
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
    check(`${size}: the call menu, the exhibition's bar, the practice tools and the coach's card shown and clear of the row`,
      clear.every(([, c]) => c.shown && c.hits.length === 0), JSON.stringify(clear));
    check(`${size}: no console errors`, t.errors.length === 0, t.errors.slice(0, 3).join(' | '));
    await t.browser.close();
  }
  done();
})();
