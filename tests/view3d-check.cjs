#!/usr/bin/env node
/* view3d-check: the player's 3D camera (page 4o), on a phone at 393x852 (dpr 3) with real touches.
   1. the setting: top-down by default; the table's 3D button and Settings > Graphics > Table View
      switch it at once (the next frame, a cut) and it comes back after a reload; a bad value falls back.
   2. the controls: a drag across turns the aim and the camera with it (a swipe by degrees, a slow
      finger by fractions of one), up and down tilts, a pinch moves the camera in or out (clamped),
      a tap on a ball aims at it; no table gesture ever shoots.
   3. ball in hand: the cue ball dragged in 3D lands where the finger's points meet the bed
      (unprojected), and a tap elsewhere never moves it; a called pocket by a tap on it in 3D.
   4. After the Shot. Pull Back (the default): the strike starts one smooth move (progress rising, no
      frame's step a jump) to the overview within about a second, held exactly still to the end of the
      roll, then one smooth move back down behind the cue ball at the player's own pitch and distance.
      Stay: every frame of the roll has the aiming pose, one cut at the next turn. Top Down: the roll
      drawn flat (no 3D frame), the setting still 3D, 3D again at the next turn. Reduce Motion: cuts.
      The CPU's turn cuts once when its line shows, holds while the cue swings, and pulls back at its
      strike; a replay plays top-down. The overview frames every pocket (the bed's corners on carom
      and bumper) on every table, portrait and landscape.
   5. the physics: a shot in 3D ends exactly as simulateShot says and as the same shot top-down.
   6. every table renders (8-ball 7 ft and 9 ft, snooker 10 ft and 12 ft, bumper octagon and
      rectangle, carom): the canvas is drawn (not blank), every ball on the table drawn.
   8. the aim's lines on red, green and blue cloth, read off the canvas: each line's width at half height within a
      device px of the 2D width (CSS px times the canvas scale), feathered edges, 3:1 against what it lies on; rings
      cut so no chord is over 3.5 device px up close; the call ring hidden behind its ball, shown in front of it.
   9. the polish: a pot drops in 3D (below the bed over about 260 ms, then gone) on 8-ball corner and side, snooker and
      bumper; a hit flash at its contact; the loupe under fine aim (size, place, cost); snooker's scoreboard on the
      stage's bottom row (V3_PIN_B) off the bed; the callout over the far rail; the neighbours readable at pitch 8; a ball with b.z
      drawn raised in 3D and top-down.
   7. frames while dragging the aim within budget (see the budget note below), the HUD's text over the
      3D view 4.5:1, targets 44 px, and landscape. FELT_SHOTS=<dir> saves screenshots. */
'use strict';
const path = require('path');
const { check, done, open, smallTargets, lowContrast, settled, speedFactor } = require('./lib.cjs');
const SHOTS = process.env.FELT_SHOTS || '';
const D2R = Math.PI / 180;

async function phone(opts = {}) {
  const t = await open('', Object.assign({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }, opts));
  const cdp = await t.page.context().newCDPSession(t.page);
  let ts = 1000;
  /* touches with CDP timestamps, so the finger's speed is exact */
  t.touch = async (type, pts, dt = 16) => { ts += dt / 1000; await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: i })), timestamp: ts }); };
  t.drag = async (x0, y0, x1, y1, ms, steps = 20) => {
    await t.touch('touchStart', [[x0, y0]]);
    for (let i = 1; i <= steps; i++) await t.touch('touchMove', [[x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps]], ms / steps);
    await t.touch('touchEnd', [], 16);
    await t.page.waitForTimeout(80);
  };
  t.ev = (f, a) => t.page.evaluate(f, a);
  return t;
}
/* the overview (After the Shot's Pull Back, held as the strike would hold it) on the table now set, from three
   shot directions: every pocket's mouth (on carom and bumper the bed's corners) and the cushions' tops inside
   the 3D view, and the table filling a fair part of it */
async function framed(t, key, how) {
  const r = await t.ev(() => {
    const B = felt.view3.box, out = [], fills = [], yaws = [];
    for (const a of [0, Math.PI * 0.6, -Math.PI * 0.25]) {
      aimAngle = a; V3.yaw = a;
      felt.v3Out();
      const pts = felt.v3OvPts();
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const p of pts) {
        const s = felt.v3Proj(p[0], p[1], p[2]);
        if (!s || s[0] < B.left || s[0] > B.left + B.width || s[1] < B.top || s[1] > B.top + B.height) out.push({ a, p, s });
        if (s) { x0 = Math.min(x0, s[0]); x1 = Math.max(x1, s[0]); y0 = Math.min(y0, s[1]); y1 = Math.max(y1, s[1]); }
      }
      fills.push(Math.max((x1 - x0) / B.width, (y1 - y0) / B.height));
      yaws.push(Math.abs(Math.atan2(Math.sin(felt.view3.cam.yaw - a), Math.cos(felt.view3.cam.yaw - a))) * 180 / Math.PI);
    }
    v3Sync();
    return { out, fills, yaws, pockets: POCKETS.length };
  });
  check(`overview: ${key} ${how}, every ${r.pockets ? 'pocket' : 'bed corner'} and cushion inside the view from three shot directions (fills ${r.fills.map(f => (f * 100).toFixed(0) + '%').join(', ')}, turned ${r.yaws.map(y => y.toFixed(0)).join(', ')} deg)`,
    r.out.length === 0 && r.fills.every(f => f > 0.8) && r.yaws.every(y => y <= 45.01), JSON.stringify(r).slice(0, 600));
}
const frames = (page, n = 2) => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

(async () => {
  /* ---- 1. the setting and the switch ---- */
  const t = await phone();
  const { page } = t;
  const s0 = await t.ev(() => ({ view: felt.settings.view, pitch: felt.settings.viewPitch, dist: felt.settings.viewDist }));
  check('setting: the table view is top-down by default', s0.view === 'top' && s0.pitch === 24 && s0.dist === 1.1, JSON.stringify(s0));
  await t.ev(() => { felt.speed = 4; settings.autoAim = false; felt.start('8'); });
  await frames(page, 3);
  const b0 = await t.ev(() => { const r = viewBtn.getBoundingClientRect(); return { shown: !viewBtn.hidden, w: r.width, h: r.height, x: r.x + r.width / 2, y: r.y + r.height / 2, pressed: viewBtn.getAttribute('aria-pressed'), text: viewBtn.textContent.trim(), live: felt.view3.live, label: viewBtn.getAttribute('aria-label') }; });
  check('switch: the 3D button shows on the table, a 44 px target, Title Case, not pressed, view top-down', b0.shown && b0.w >= 44 && b0.h >= 44 && b0.text === '3D' && b0.label === '3D View' && b0.pressed === 'false' && !b0.live, JSON.stringify(b0));
  const cuts0 = await t.ev(() => felt.view3.cuts);
  await page.touchscreen.tap(b0.x, b0.y);
  await frames(page, 1);
  const s1 = await t.ev(() => ({ view: felt.settings.view, live: felt.view3.live, pressed: viewBtn.getAttribute('aria-pressed'), stored: JSON.parse(localStorage.getItem('felt.settings')).view, frames: felt.view3.frames, cuts: felt.view3.cuts, canvas: !t3d.hidden, renderer: felt.view3.renderer, soft: felt.view3.soft, scale: felt.view3.scale }));
  check('switch: a tap turns 3D on at once (drawn the next frame, one cut), pressed, stored', s1.view === '3d' && s1.live && s1.pressed === 'true' && s1.stored === '3d' && s1.frames >= 1 && s1.cuts === cuts0 + 1 && s1.canvas, JSON.stringify(s1));
  console.log(`GL: ${s1.renderer} (software: ${s1.soft}, drawing at ${s1.scale}x)`);
  const pose0 = await t.ev(() => { const c = felt.game.balls[0], v = felt.view3.cam; return { c: [c.x, c.y], T: v.T, E: v.E, yaw: v.yaw, aim: felt.aim }; });
  const ahead = (pose0.T[0] - pose0.c[0]) * Math.cos(pose0.aim) + (pose0.T[1] - pose0.c[1]) * Math.sin(pose0.aim), behind = (pose0.c[0] - pose0.E[0]) * Math.cos(pose0.aim) + (pose0.c[1] - pose0.E[1]) * Math.sin(pose0.aim);
  check('camera: behind the cue ball looking along the aim (eye behind, target ahead on the line)', behind > 0.3 && ahead > 0 && Math.abs(pose0.yaw - pose0.aim) < 1e-12, JSON.stringify(pose0));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'v3-aim.png') });
  await page.reload();
  await page.waitForFunction(() => window.booted === true);
  await t.ev(() => { felt.speed = 4; settings.autoAim = false; felt.start('8'); });
  await frames(page, 2);
  const s2 = await t.ev(() => ({ view: felt.settings.view, live: felt.view3.live }));
  check('setting: 3D comes back after a reload', s2.view === '3d' && s2.live, JSON.stringify(s2));
  /* Settings > Graphics > Table View */
  const tv = await t.ev(() => { pause(); showPrefs(); prefsPage('prGfx'); return { top: tvTop.textContent, d3: tv3d.textContent, head: tvLab.textContent, pressed: tv3d.getAttribute('aria-pressed') }; });
  await t.ev(() => tvTop.click());
  const tv2 = await t.ev(() => ({ view: felt.settings.view, pressed: tvTop.getAttribute('aria-pressed') }));
  check('Settings > Graphics: Table View, Top Down or 3D, shows and sets it', tv.head === 'Table View' && tv.top === 'Top Down' && tv.d3 === '3D' && tv.pressed === 'true' && tv2.view === 'top' && tv2.pressed === 'true', JSON.stringify({ tv, tv2 }));
  await t.ev(() => { tv3d.click(); closeSheets(); resume(); });
  await frames(page, 2);
  check('Settings > Graphics: back to 3D, and the game resumes in it', await t.ev(() => felt.view3.live && felt.state === 'aim'));
  await t.ev(() => localStorage.setItem('felt.settings', JSON.stringify({ sv: 3, view: 'iso', viewPitch: 400, viewDist: -3 })));
  await page.reload();
  await page.waitForFunction(() => window.booted === true);
  const bad = await t.ev(() => felt.settings);
  check('setting: a bad view falls back to top-down, a pitch and distance clamp', bad.view === 'top' && bad.viewPitch === 70 && bad.viewDist === 0.45, JSON.stringify({ v: bad.view, p: bad.viewPitch, d: bad.viewDist }));
  await t.ev(() => { setSetting('view', '3d'); setSetting('viewPitch', 24); setSetting('viewDist', 1.1); felt.speed = 4; settings.autoAim = false; felt.start('8'); });
  await frames(page, 2);

  /* ---- 2. the controls, real touches ---- */
  const st = () => t.ev(() => ({ aim: felt.aim, yaw: felt.view3.cam.yaw, pitch: felt.settings.viewPitch, dist: felt.settings.viewDist, state: felt.state, shot: felt.lastShot, c: [felt.game.balls[0].x, felt.game.balls[0].y] }));
  let a = await st();
  await t.drag(140, 300, 240, 300, 250);
  let b = await st();
  const fast = (b.aim - a.aim) / D2R;
  check(`aim: a swipe across 100 px turns the aim ${fast.toFixed(2)} deg (10 to 40), toward the finger, the camera with it`, fast > 10 && fast < 40 && b.yaw === b.aim && b.pitch === a.pitch, JSON.stringify(b));
  a = b;
  await t.drag(140, 300, 170, 300, 3000, 60);
  b = await st();
  const slow = (b.aim - a.aim) / D2R;
  check(`aim: a slow 30 px drag nudges it ${slow.toFixed(3)} deg (a fraction of a swipe's rate: under 2.5 deg, over 0)`, slow > 0 && slow < 2.5 && slow / 30 < fast / 100 / 3 && b.yaw === b.aim, JSON.stringify({ slow, fast }));
  a = b;
  await t.drag(200, 250, 200, 350, 300);
  b = await st();
  check(`tilt: a drag down 100 px raises the camera (pitch ${a.pitch} to ${b.pitch}), the aim untouched`, b.pitch > a.pitch + 15 && b.aim === a.aim && b.pitch <= 70, JSON.stringify(b));
  await t.drag(200, 400, 200, 100, 300);
  b = await st();
  check('tilt: a long drag up stops at the lowest pitch (8 deg)', b.pitch === 8, JSON.stringify(b));
  await t.drag(200, 300, 200, 250, 300);
  a = await st();
  await t.touch('touchStart', [[150, 400]]);
  await t.touch('touchStart', [[150, 400], [250, 400]]);
  for (let i = 1; i <= 10; i++) await t.touch('touchMove', [[150 - i * 5, 400], [250 + i * 5, 400]]);
  await t.touch('touchEnd', [[250 + 50, 400]]); await t.touch('touchEnd', []);
  await page.waitForTimeout(100);
  b = await st();
  check(`pinch: spreading two fingers twice as wide moves the camera in (distance ${a.dist} to ${b.dist.toFixed(3)} m), the aim put back`, Math.abs(b.dist - Math.max(0.45, a.dist / 2)) < 0.02 && b.aim === a.aim, JSON.stringify(b));
  await t.touch('touchStart', [[100, 400]]);
  await t.touch('touchStart', [[100, 400], [300, 400]]);
  for (let i = 1; i <= 10; i++) await t.touch('touchMove', [[100 + i * 9, 400], [300 - i * 9, 400]]);
  await t.touch('touchEnd', [[210, 400]]); await t.touch('touchEnd', []);
  await page.waitForTimeout(100);
  b = await st();
  check(`pinch: closing them moves it out, clamped (distance ${b.dist.toFixed(3)} m, 3.2 at most)`, b.dist > a.dist && b.dist <= 3.2, JSON.stringify(b));
  const stored = await t.ev(() => JSON.parse(localStorage.getItem('felt.settings')));
  check('the pitch and distance are kept for the next game', stored.viewPitch === b.pitch && stored.viewDist === b.dist, JSON.stringify(stored));
  await t.ev(() => { setSetting('viewPitch', 30); setSetting('viewDist', 1.1); });
  /* a tap on a ball aims at its centre */
  const one = await t.ev(() => { const o = felt.game.balls.find(x => x.n === 1); return { s: felt.toScreen(o.x, o.y), want: Math.atan2(o.y - felt.game.balls[0].y, o.x - felt.game.balls[0].x) }; });
  await frames(page, 2);
  const oneS = await t.ev(() => { const o = felt.game.balls.find(x => x.n === 1); return felt.toScreen(o.x, o.y); });
  await page.touchscreen.tap(oneS[0], oneS[1]);
  await page.waitForTimeout(80);
  b = await st();
  check('tap: a tap on the 1 in 3D aims at its centre', Math.abs(b.aim - one.want) < 1e-9, JSON.stringify({ aim: b.aim, want: one.want }));
  check('no table gesture shot: still aiming, nothing struck', b.state === 'aim' && b.shot === null, JSON.stringify({ st: b.state, shot: b.shot }));

  /* ---- 3. ball in hand and a pocket call ---- */
  await frames(page, 3);
  const bih = await t.ev(() => { const c = felt.game.balls[0], s = felt.toScreen(c.x, c.y); return { inHand: felt.game.inHand, c: [c.x, c.y], s }; });
  const to = [bih.s[0] - 40, bih.s[1] + 25];   /* back into the kitchen and across */
  const want = await t.ev(([s, e, c]) => { const p0 = felt.v3Unproj(s[0], s[1]), p1 = felt.v3Unproj(e[0], e[1]); return [c[0] + p1[0] - p0[0], c[1] + p1[1] - p0[1]]; }, [bih.s, to, bih.c]);
  const pose1 = await t.ev(() => felt.view3.cam);
  await t.touch('touchStart', [bih.s]);
  for (let i = 1; i <= 12; i++) await t.touch('touchMove', [[bih.s[0] + (to[0] - bih.s[0]) * i / 12, bih.s[1] + (to[1] - bih.s[1]) * i / 12]], 30);
  const midPose = await t.ev(() => ({ cam: felt.view3.cam, moving: felt.moving }));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'v3-ball-in-hand.png') });
  await t.touch('touchEnd', []);
  await page.waitForTimeout(100);
  b = await st();
  check(`ball in hand: dragged in 3D, the cue ball lands where the finger's points meet the bed (off by ${(Math.hypot(b.c[0] - want[0], b.c[1] - want[1]) * 1000).toFixed(3)} mm)`, bih.inHand === 'kitchen' && Math.hypot(b.c[0] - want[0], b.c[1] - want[1]) < 1e-3, JSON.stringify({ c: b.c, want }));
  check('ball in hand: the camera holds still while the ball is carried', midPose.moving && JSON.stringify(midPose.cam.E) === JSON.stringify(pose1.E), JSON.stringify(midPose));
  await frames(page, 2);
  const cut = await t.ev(() => ({ T: felt.view3.cam.T, c: [felt.game.balls[0].x, felt.game.balls[0].y], yaw: felt.view3.cam.yaw, aim: felt.aim }));
  const tAhead = Math.hypot(cut.T[0] - cut.c[0], cut.T[1] - cut.c[1]), dirOk = Math.abs(Math.atan2(cut.T[1] - cut.c[1], cut.T[0] - cut.c[0]) - cut.aim) < 1e-6;
  check('ball in hand: let go, it cuts behind the ball\'s new spot on the aim', dirOk && tAhead > 0 && cut.yaw === cut.aim, JSON.stringify(cut));
  const ofs = await t.ev(() => { const c = felt.game.balls[0], s = felt.toScreen(c.x, c.y); return [s[0] + 120, s[1] - 120]; });
  const c0 = (await st()).c;
  await page.touchscreen.tap(ofs[0], ofs[1]);
  await page.waitForTimeout(80);
  check('ball in hand: a tap away from the cue ball never moves it', JSON.stringify((await st()).c) === JSON.stringify(c0));
  /* the call: 10-ball, the 1 in line with the foot corner, tap the 1 then the pocket */
  await t.ev(() => {
    setSetting('rules10', '10-house'); felt.start('10');
    const g = felt.game, A = POCKET_AIM[5], d = [A[0] - TL / 2, A[1] - TW / 2], l = Math.hypot(d[0], d[1]), u = [d[0] / l, d[1] / l];
    const b1 = [A[0] - u[0] * 0.4, A[1] - u[1] * 0.4], c = [b1[0] - u[0] * 0.55, b1[1] - u[1] * 0.55];
    for (const x of g.balls) x.on = x.n === 0 || x.n === 1 || x.n === 10;
    Object.assign(g.balls.find(x => x.n === 0), { x: c[0], y: c[1] });
    Object.assign(g.balls.find(x => x.n === 1), { x: b1[0], y: b1[1] });
    Object.assign(g.balls.find(x => x.n === 10), { x: TL * 0.3, y: TW * 0.2 });
    Object.assign(g, { breakShot: false, inHand: null, pushAvail: false });
    aimAngle = Math.atan2(u[1], u[0]) + 0.05; hud();
  });
  await frames(page, 3);
  const b1s = await t.ev(() => { const o = felt.game.balls.find(x => x.n === 1); return felt.toScreen(o.x, o.y); });
  await page.touchscreen.tap(b1s[0], b1s[1]);
  await page.waitForTimeout(80);
  await frames(page, 2);
  const k5 = await t.ev(() => felt.pocketXY(5));
  const onScreen = await t.ev(k => { const B = felt.view3.box; return k[0] > B.left && k[0] < B.left + B.width && k[1] > B.top && k[1] < B.top + B.height; }, k5);
  await page.touchscreen.tap(k5[0], k5[1]);
  await page.waitForTimeout(80);
  const cs = await t.ev(() => felt.callState);
  check('call: in 3D a tap on the 1 and then on the foot corner (as the camera shows it) calls the 1 there', onScreen && cs.call && cs.call.ball === 1 && cs.call.pocket === 5 && cs.ready, JSON.stringify({ cs, k5 }));
  check('call: no shot came of the taps', await t.ev(() => felt.state === 'aim' && felt.game.shots === 0));

  /* ---- 4. After the Shot; 5. the physics ---- */
  /* Pull Back (the default): one smooth move up to the overview within about a second of the strike, held
     still to the end of the roll, then one smooth move back down behind the cue ball, the player's pitch and
     distance exactly as they were */
  const pre = await t.ev(() => {
    felt.speed = 1; felt.v3Clear();
    const g = felt.game, rec = { balls: g.balls.map(x => ({ ...x })), ball: 0 }, angle = aimAngle, power = 0.55, spin = { x: 0.2, y: -0.3 };
    const want = simulateShot(rec.balls, { angle, power, spin, ball: 0 });
    window.__want = JSON.stringify(want.balls);
    window.__pp = [felt.settings.viewPitch, felt.settings.viewDist];
    felt.shoot(angle, power, spin);
    return { cam: felt.view3.cam, angle, power, spin, balls: rec.balls, after: felt.settings.viewAfter };
  });
  await settled(page);
  await page.waitForFunction(() => !felt.view3.moving && felt.view3.phase === 'aim', null, { timeout: 5000 });
  await frames(page, 2);
  /* a pose's eye; the largest step between frames against the mean, through a run of poses */
  const stepStats = P => { const d = []; for (let i = 1; i < P.length; i++) d.push(Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2])); const mean = d.reduce((a, b) => a + b, 0) / Math.max(1, d.length); return { n: d.length, max: Math.max(0, ...d), mean }; };
  const pull = await t.ev(() => {
    const P = felt.v3Poses(), i0 = P.findIndex(p => p[5] === 'rolling'), roll = P.filter(p => p[5] === 'rolling');
    const out = P.filter(p => p[6] === 'out'), ov = roll.filter(p => p[6] === 'ov'), back = P.filter(p => p[6] === 'back');
    const firstOv = P.findIndex(p => p[6] === 'ov'), lastRoll = P.length - 1 - [...P].reverse().findIndex(p => p[5] === 'rolling');
    const c = felt.game.balls[0], v = felt.view3.cam;
    return { n: roll.length, phases: [...new Set(roll.map(p => p[6]))], outRun: P.slice(Math.max(0, i0 - 1), firstOv + 1), out: out.map(p => p[7]), ovMs: P[firstOv][8] - P[i0][8], ovFrames: ov.length,
      ovSame: ov.every(p => p.slice(0, 5).every((x, i) => x === ov[0][i])), ovToEnd: P.slice(firstOv, lastRoll + 1).every(p => p[6] === 'ov'),
      backRun: P.slice(P.findIndex(p => p[6] === 'back') - 1, P.findIndex(p => p[6] === 'back') + back.length + 1), back: back.map(p => p[7]),
      res: JSON.stringify(felt.lastResult.balls) === window.__want, st: felt.state, cam: v, c: [c.x, c.y], aim: felt.aim, pp: window.__pp, now: [felt.settings.viewPitch, felt.settings.viewDist] };
  });
  const so = stepStats(pull.outRun), sb = stepStats(pull.backRun), mono = a => a.every((u, i) => i === 0 || u >= a[i - 1]);
  check(`Pull Back: the strike starts one smooth move up and back (${pull.out.length} frames, progress rising, largest step ${(so.max * 100).toFixed(1)} cm, under 3x the mean ${(so.mean * 100).toFixed(1)} cm, no cut), the overview reached in ${pull.ovMs.toFixed(0)} ms`,
    pre.after === 'pull' && pull.out.length >= 10 && mono(pull.out) && so.max < 3 * so.mean + 1e-3 && so.max < 0.25 && pull.ovMs >= 600 && pull.ovMs < 1100, JSON.stringify({ so, out: pull.out.length, ms: pull.ovMs, after: pre.after }));
  check(`Pull Back: the overview holds exactly still to the end of the roll (${pull.ovFrames} frames, one pose), the balls never followed`, pull.ovFrames > 10 && pull.ovSame && pull.ovToEnd && pull.phases.join() === 'out,ov', JSON.stringify(pull.phases));
  check('physics: the live result in 3D is simulateShot\'s, byte for byte', pull.res);
  const behindOk = (cam, c, aim) => Math.abs(Math.atan2(cam.T[1] - c[1], cam.T[0] - c[0]) - aim) < 1e-6 && cam.yaw === aim;
  check(`Pull Back: the next turn eases back down in one smooth move (${pull.back.length} frames, largest step ${(sb.max * 100).toFixed(1)} cm, mean ${(sb.mean * 100).toFixed(1)}) behind the cue ball on the new aim, the pitch and distance the player chose exactly`,
    pull.st === 'aim' && pull.back.length >= 8 && mono(pull.back) && sb.max < 3 * sb.mean + 1e-3 && behindOk(pull.cam, pull.c, pull.aim) && pull.cam.pitch === pull.pp[0] && pull.cam.dist === pull.pp[1] && pull.now[0] === pull.pp[0] && pull.now[1] === pull.pp[1],
    JSON.stringify({ sb, cam: pull.cam, pp: pull.pp }));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'v3-after-pull.png') });
  /* the same shot again under each other choice */
  const again = (after, rm = false) => t.ev(([pre, after, rm]) => {
    setSetting('viewAfter', after); setSetting('reduceMotion', rm); setSetting('rules10', '10-house'); felt.start('10');
    const g = felt.game;
    g.balls = pre.balls.map(x => ({ ...x })); Object.assign(g, { breakShot: false, inHand: null, pushAvail: false });
    return 1;
  }, [pre, after, rm]);
  const fire = async () => {
    await page.waitForFunction(() => !felt.view3.moving, null, { timeout: 5000 });
    await frames(page, 2);
    await t.ev(pre => { felt.v3Clear(); window.__cuts = felt.view3.cuts; window.__f0 = felt.view3.frames; felt.shoot(pre.angle, pre.power, pre.spin); }, pre);
  };
  /* Stay: the aiming pose held through every frame of the roll, a cut at the next turn */
  await again('stay'); await fire();
  await settled(page);
  await frames(page, 2);
  const stay = await t.ev(() => {
    const P = felt.v3Poses(), rolling = P.filter(p => p[5] === 'rolling'), first = rolling[0];
    return { n: rolling.length, same: rolling.every(p => p.slice(0, 5).every((v, i) => v === first[i]) && p[6] === 'aim'), back: P.some(p => p[6] === 'back'), cuts: felt.view3.cuts - window.__cuts, res: JSON.stringify(felt.lastResult.balls) === window.__want, cam: felt.view3.cam, c: [felt.game.balls[0].x, felt.game.balls[0].y], aim: felt.aim };
  });
  check(`Stay: the camera holds exactly still through every frame of the roll (${stay.n} frames, one pose), then one cut behind the cue ball`, stay.n > 10 && stay.same && !stay.back && stay.cuts === 1 && behindOk(stay.cam, stay.c, stay.aim) && stay.res, JSON.stringify(stay));
  /* Top Down: the roll on the flat table (no 3D frame drawn), the setting still 3D, back in 3D at the next turn */
  await again('top'); await fire();
  await page.waitForFunction(() => felt.state === 'rolling', null, { timeout: 5000 });
  await frames(page, 6);
  const mid = await t.ev(() => ({ live: felt.view3.live, hidden: t3d.hidden, view: felt.settings.view, pressed: viewBtn.getAttribute('aria-pressed'), shown: !viewBtn.hidden, st: felt.state, flat: felt.toScreen(1, 0.5) }));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'v3-after-top.png') });
  await settled(page);
  await frames(page, 2);
  const top = await t.ev(() => {
    const P = felt.v3Poses();
    return { rolled3d: P.filter(p => p[5] === 'rolling').length, live: felt.view3.live, res: JSON.stringify(felt.lastResult.balls) === window.__want, cam: felt.view3.cam, c: [felt.game.balls[0].x, felt.game.balls[0].y], aim: felt.aim, pp: [felt.settings.viewPitch, felt.settings.viewDist] };
  });
  check('Top Down: the roll is drawn on the flat table (the 3D canvas hidden, no 3D frame), the setting and the 3D button still 3D', mid.st === 'rolling' && !mid.live && mid.hidden && mid.view === '3d' && mid.pressed === 'true' && mid.shown && top.rolled3d === 0, JSON.stringify({ mid, rolled3d: top.rolled3d }));
  check('Top Down: the shot ends as simulateShot says, byte for byte, and the next turn is 3D again behind the cue ball at the player\'s pitch and distance',
    top.res && top.live && behindOk(top.cam, top.c, top.aim) && top.cam.pitch === pre.cam.pitch && top.cam.dist === pre.cam.dist && top.pp[0] === pull.pp[0] && top.pp[1] === pull.pp[1], JSON.stringify(top));
  /* Reduce Motion: Pull Back's moves become cuts */
  await again('pull', true); await fire();
  await settled(page);
  await frames(page, 2);
  const rm = await t.ev(() => {
    const P = felt.v3Poses(), roll = P.filter(p => p[5] === 'rolling');
    return { n: roll.length, phases: [...new Set(P.map(p => p[6]))], allOv: roll.every(p => p[6] === 'ov' && p.slice(0, 5).every((v, i) => v === roll[0][i])), cuts: felt.view3.cuts - window.__cuts, res: JSON.stringify(felt.lastResult.balls) === window.__want, cam: felt.view3.cam, c: [felt.game.balls[0].x, felt.game.balls[0].y], aim: felt.aim };
  });
  check('Reduce Motion: Pull Back cuts to the overview at the strike and cuts back at the next turn (no move frames)', rm.n > 10 && rm.allOv && !rm.phases.includes('out') && !rm.phases.includes('back') && rm.cuts === 2 && rm.res && behindOk(rm.cam, rm.c, rm.aim), JSON.stringify(rm));
  await t.ev(() => { setSetting('reduceMotion', false); setSetting('viewAfter', 'pull'); felt.speed = 4; });
  /* the same shot top-down */
  const flat = await t.ev(pre => {
    setSetting('view', 'top'); setSetting('rules10', '10-house'); felt.start('10');
    const g = felt.game;
    g.balls = pre.balls.map(x => ({ ...x })); Object.assign(g, { breakShot: false, inHand: null, pushAvail: false });
    return 1;
  }, pre);
  await frames(page, 2);
  await t.ev(pre => { felt.shoot(pre.angle, pre.power, pre.spin); }, pre);
  await settled(page);
  const same2d = await t.ev(() => ({ live: felt.view3.live, same: JSON.stringify(felt.lastResult.balls) === window.__want }));
  check('physics: the same shot top-down ends the same, byte for byte', flat === 1 && !same2d.live && same2d.same, JSON.stringify(same2d));
  /* the CPU: a cut when its line shows, then still while the cue swings onto it */
  await t.ev(() => { setSetting('view', '3d'); setSetting('cpu', true); felt.speed = 1; felt.start('9', { level: 'easy', breaker: 1 }); felt.v3Clear(); });
  await page.waitForFunction(() => felt.state === 'stroke' || felt.state === 'rolling', null, { timeout: 30000 });
  const cpu = await t.ev(() => {
    const P = felt.v3Poses(), th = P.filter(p => p[5] === 'thinking');
    const last = th[th.length - 1], k = th.findIndex(p => p.slice(0, 5).every((v, i) => v === last[i]));
    return { n: th.length, held: th.length - k, cue: [felt.game.balls[0].x, felt.game.balls[0].y], T: felt.view3.cam.T, yaw: felt.view3.cam.yaw, angle: felt.aim, cuts: felt.view3.cuts };
  });
  check(`CPU: a cut behind its cue ball along its line, then held while the cue swings (${cpu.held} frames still)`, cpu.held >= 10 && Math.abs(cpu.yaw - cpu.angle) < 1e-9, JSON.stringify(cpu));
  await settled(page, 60000);
  const cpuRoll = await t.ev(() => { const P = felt.v3Poses(), s = P.findIndex(p => p[5] === 'stroke'), r = P.findIndex(p => p[5] === 'rolling'); return { stroke: s >= 0 && P[s][6], first: r >= 0 && P[r][6], phases: [...new Set(P.filter(p => p[5] === 'rolling').map(p => p[6]))] }; });
  check('CPU: its strike pulls back the same way (still through its stroke, then out to the overview)', cpuRoll.stroke === 'aim' && cpuRoll.first === 'out' && cpuRoll.phases.includes('ov'), JSON.stringify(cpuRoll));
  await t.ev(() => { setSetting('cpu', false); felt.speed = 4; });
  /* a replay plays top-down, and 3D comes back after it */
  await t.ev(() => { settings.autoAim = false; felt.start('8'); felt.shoot(0, 0.6, 0); });
  await settled(page);
  const rp1 = await t.ev(() => { const ok = felt.replay(); return { ok, live: felt.view3.live }; });
  await frames(page, 2);
  const rp2 = await t.ev(() => ({ live: felt.view3.live, replaying: felt.replaying }));
  await page.waitForFunction(() => !felt.replaying, null, { timeout: 30000 });
  await frames(page, 2);
  const rp3 = await t.ev(() => felt.view3.live);
  check('replay: plays top-down, and the 3D view comes back after it', rp1.ok && rp2.replaying && !rp2.live && rp3, JSON.stringify({ rp1, rp2, rp3 }));

  /* ---- 6. every table renders ---- */
  const kinds = [['8', { table: '7' }], ['9', { table: '9' }], ['snooker', { snookerTable: 'compact' }], ['snooker', { snookerTable: 'full' }], ['bumper', { bumperTable: 'octagon' }], ['bumper', { bumperTable: 'rect' }], ['carom', {}], ['straight', {}]];
  for (const [kind, set] of kinds) {
    await t.ev(([k, s]) => { for (const key of Object.keys(s)) setSetting(key, s[key]); setSetting('viewPitch', 34); setSetting('viewDist', 1.6); felt.start(k); }, [kind, set]);
    await frames(page, 3);
    const r = await t.ev(() => {
      const gl = t3d.getContext('webgl2'), W = t3d.width, H = t3d.height;
      draw(performance.now());
      const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let lit = 0, sum = 0, sum2 = 0, n = 0;
      for (let i = 0; i < px.length; i += 4 * 7) { const l = (px[i] + px[i + 1] + px[i + 2]) / 3; if (l > 30) lit++; sum += l; sum2 += l * l; n++; }
      const mean = sum / n, sd = Math.sqrt(sum2 / n - mean * mean);
      const on = felt.game.balls.filter(b => b.on).length, drawn = felt.view3.drawn.length, ahead = felt.game.balls.filter(b => b.on && felt.v3Proj(b.x, b.y)).length;
      return { lit: lit / n, sd, on, drawn, ahead, table: felt.table, key: TABLE + (TABLE === 'snooker' ? SNOOKER_SIZE : TABLE === 'bumper' ? BUMPER_SHAPE : '') };
    });
    check(`render: ${r.key} ${kind} draws (${(r.lit * 100).toFixed(0)}% lit, contrast sd ${r.sd.toFixed(0)}), every ball in front of the camera drawn (${r.drawn} of ${r.ahead})`, r.lit > 0.15 && r.sd > 12 && r.drawn === r.ahead && r.ahead > 0, JSON.stringify(r));
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `v3-${r.key}.png`) });
    await framed(t, r.key, 'portrait');
  }
  await t.ev(() => { setSetting('bumperTable', 'octagon'); setSetting('snookerTable', 'compact'); setSetting('table', '7'); });

  /* ---- 8. the aim's lines: smooth rings, anti-aliased ribbons at the 2D widths, on the cloth, behind the balls ---- */
  /* a straight shot along the camera: the cue ball, the 1 and the foot corner in a line, called, so the guide's lines
     run straight up the middle of the view; each cloth, read off the GL canvas right after a draw */
  const lineShot = (cloth, pitch, dist, calls = true) => t.ev(([cloth, pitch, dist, calls]) => {
    setSetting('cloth', cloth); setSetting('viewPitch', pitch); setSetting('viewDist', dist); settings.calls.highlight = calls;
    setSetting('rules10', '10-house'); felt.start('10');
    const g = felt.game, A = POCKET_AIM[5], u = [A[0] - TL * 0.3, A[1] - TW * 0.5], l = Math.hypot(u[0], u[1]);
    u[0] /= l; u[1] /= l;
    const b1 = [A[0] - u[0] * 0.8, A[1] - u[1] * 0.8], c = [b1[0] - u[0] * 0.5, b1[1] - u[1] * 0.5];
    for (const x of g.balls) x.on = x.n === 0 || x.n === 1 || x.n === 10;
    Object.assign(g.balls.find(x => x.n === 0), { x: c[0], y: c[1] });
    Object.assign(g.balls.find(x => x.n === 1), { x: b1[0], y: b1[1] });
    Object.assign(g.balls.find(x => x.n === 10), { x: TL * 0.25, y: TW * 0.2 });
    Object.assign(g, { breakShot: false, inHand: null, pushAvail: false });
    aimAngle = Math.atan2(u[1], u[0]); hud();
    /* the 1 turned the same way every time, so its paint under a pixel never changes between two draws */
    orient[1] = IDENT.slice();
    return { u, b1, c };
  }, [cloth, pitch, dist, calls]);
  /* the pixels across the view at the screen height of table point (x, y) on the bed: [r, g, b] per device px, and where it is */
  const rowAt = (x, y, half = 14) => t.ev(([x, y, half]) => {
    draw(performance.now());
    const gl = t3d.getContext('webgl2'), s = felt.v3Proj(x, y, 0.0012), B = felt.view3.box, k = felt.view3.scale;
    const px = Math.round((s[0] - B.left) * k), py = t3d.height - 1 - Math.round((s[1] - B.top) * k), w = 2 * half + 1, out = new Uint8Array(w * 4);
    gl.readPixels(px - half, py, w, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
    const row = [];
    for (let i = 0; i < w; i++) row.push([out[i * 4], out[i * 4 + 1], out[i * 4 + 2]]);
    return { row, px, k };
  }, [x, y, half]);
  const lumOf = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  /* a line's profile: the cloth either side, the peak, the width at half height (device px) and the feathered steps */
  const profile = row => {
    /* measured on the pixel values as drawn (sRGB), so a partly covered edge pixel reads as the coverage it got */
    const L = row.map(c => (c[0] + c[1] + c[2]) / 3), bg = (L.slice(0, 4).reduce((a, b) => a + b) + L.slice(-4).reduce((a, b) => a + b)) / 8, pk = Math.max(...L), i = L.indexOf(pk);
    const f = L.map(v => (v - bg) / Math.max(1e-9, pk - bg));
    /* the half-height width, interpolated at both edges */
    let a = i, b = i;
    while (a > 0 && f[a - 1] >= 0.5) a--;
    while (b < f.length - 1 && f[b + 1] >= 0.5) b++;
    const left = a > 0 ? a - 1 + (0.5 - f[a - 1]) / Math.max(1e-9, f[a] - f[a - 1]) : a - 0.5, right = b < f.length - 1 ? b + 1 - (0.5 - f[b + 1]) / Math.max(1e-9, f[b] - f[b + 1]) : b + 0.5;
    const soft = side => side.some(v => Math.abs(v) > 0.1 && Math.abs(v) < 0.9);
    /* the line against what it is seen on: the cloth, or its own dark edge where the 2D design gives it one */
    const edge = row.slice(Math.max(0, a - 2), b + 3).concat([row[0], row[row.length - 1]]).reduce((m, c) => lumOf(c) < lumOf(m) ? c : m), lp = lumOf(row[i]);
    return { fwhm: right - left, contrast: (lp + 0.05) / (lumOf(edge) + 0.05), onCloth: (lp + 0.05) / (lumOf(row[0]) + 0.05), feather: soft(f.slice(0, i)) && soft(f.slice(i + 1)), f: f.map(v => +v.toFixed(2)) };
  };
  for (const cloth of ['red', 'green', 'blue']) {
    const L = await lineShot(cloth, 18, 0.9);
    await frames(page, 3);
    /* the object ball's line, part way from the 1 to the pocket, and the aim line just short of the ghost ball (nearer, the cue ball hides the bed) */
    const ob = await rowAt(L.b1[0] + L.u[0] * 0.35, L.b1[1] + L.u[1] * 0.35), aim = await rowAt(L.c[0] + L.u[0] * 0.33, L.c[1] + L.u[1] * 0.33);
    const po = profile(ob.row), pa = profile(aim.row), wo = 2 * ob.k, wa = 1.25 * ob.k;
    check(`lines on ${cloth}: the object ball's line ${po.fwhm.toFixed(2)} device px wide (2D: 2 CSS px = ${wo.toFixed(2)}), feathered edges, ${po.contrast.toFixed(2)}:1 over the cloth`,
      Math.abs(po.fwhm - wo) <= 1 && po.feather && po.contrast >= 3, JSON.stringify(po));
    check(`lines on ${cloth}: the aim line ${pa.fwhm.toFixed(2)} device px wide (2D: 1.25 CSS px = ${wa.toFixed(2)}), feathered edges, ${pa.contrast.toFixed(2)}:1 over the cloth`,
      Math.abs(pa.fwhm - wa) <= 1 && pa.feather && pa.contrast >= 3, JSON.stringify(pa));
    if (SHOTS && cloth === 'red') await page.screenshot({ path: path.join(SHOTS, 'v3-lines-red.png') });
  }
  /* the rings: up close every arc's chord on screen is a few device px, so a ring stays round */
  await lineShot('red', 14, 0.6);
  await frames(page, 3);
  const arcs = await t.ev(() => ({ max: felt.view3.arcMax, ghost: felt.view3.ghost }));
  check(`rings: up close the longest chord of any ring is ${arcs.max.toFixed(2)} device px (round, not a polygon; at most 3.5), the ghost ball drawn as a ball`, arcs.max > 0 && arcs.max <= 3.5 && arcs.ghost && arcs.ghost.legal, JSON.stringify(arcs));
  /* depth: the called ball's ring behind the 1 is hidden by the ball (the same pixels with the highlight off), its near side shows */
  const ringPx = async calls => {
    const L = await lineShot('red', 16, 0.8, calls);
    await frames(page, 3);
    return t.ev(L => {
      draw(performance.now());
      const gl = t3d.getContext('webgl2'), B = felt.view3.box, k = felt.view3.scale, R = BALL_R, rr = R + 0.004;
      const at = (x, y, z) => { const s = felt.v3Proj(x, y, z), out = new Uint8Array(4); gl.readPixels(Math.round((s[0] - B.left) * k), t3d.height - 1 - Math.round((s[1] - B.top) * k), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out); return { px: [...out.slice(0, 3)], s }; };
      const far = at(L.b1[0] + L.u[0] * rr, L.b1[1] + L.u[1] * rr, 0.0012), near = at(L.b1[0] - L.u[0] * rr, L.b1[1] - L.u[1] * rr, 0.0012), ctr = felt.v3Proj(L.b1[0], L.b1[1], R), top = felt.v3Proj(L.b1[0], L.b1[1], 2 * R);
      return { far, near, inBall: Math.hypot(far.s[0] - ctr[0], far.s[1] - ctr[1]) < Math.hypot(top[0] - ctr[0], top[1] - ctr[1]) * 0.9 };
    }, L);
  };
  const on = await ringPx(true), offR = await ringPx(false);
  const dd = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
  check('depth: the call ring behind the 1 is hidden by the ball (its pixel the same with the ring off), its near side drawn on the cloth', on.inBall && dd(on.far.px, offR.far.px) <= 8 && dd(on.near.px, offR.near.px) > 30, JSON.stringify({ on, offR }));
  if (SHOTS) {
    await lineShot('red', 14, 0.6); await frames(page, 3); await page.screenshot({ path: path.join(SHOTS, 'v3-aim-red-near.png') });
    await lineShot('red', 30, 1.8); await frames(page, 3); await page.screenshot({ path: path.join(SHOTS, 'v3-aim-red-far.png') });
  }
  await t.ev(() => { settings.calls.highlight = true; setSetting('cloth', 'green'); });

  /* ---- 9. the polish: drops, flashes, the loupe, the snooker scoreboard, the neighbours, a ball in the air ---- */
  /* a pot: the ball, put on the lip of pocket k, is taken off and onPot called as frame() would; every frame after it
     records the drop drawn (its height, its projection), until it is gone */
  const dropRun = (kind, k, set = {}) => t.ev(async ([kind, k, set]) => {
    for (const key of Object.keys(set)) setSetting(key, set[key]);
    felt.speed = 1; settings.autoAim = false; setSetting('viewPitch', 20); setSetting('viewDist', 0.9); felt.start(kind);
    await new Promise(r => setTimeout(r, 300));
    const g = felt.game, P = POCKETS[k], A = POCKET_AIM[k] || P, u = [A[0] - TL / 2, A[1] - TW / 2], l = Math.hypot(u[0], u[1]);
    u[0] /= l; u[1] /= l;
    const n1 = g.balls.map(b => b.n).find(n => n !== 0 && n !== 70);
    const b1 = g.balls.find(x => x.n === n1), c = g.balls.find(x => x.n === 0) || g.balls.find(x => x !== b1);
    for (const x of g.balls) x.on = x === b1 || x === c;
    Object.assign(b1, { x: A[0] - u[0] * 0.04, y: A[1] - u[1] * 0.04 }); Object.assign(c, { x: A[0] - u[0] * 0.7, y: A[1] - u[1] * 0.7 });
    Object.assign(g, { breakShot: false, inHand: null });
    aimAngle = Math.atan2(u[1], u[0]); hud(); V3.seat.set = false;
    await new Promise(r => setTimeout(r, 200));
    const t0 = performance.now(), rec = [];
    b1.on = false; onPot(n1, k, [b1.x, b1.y], t0);
    await new Promise(res => { const f = now => { const d = (V3.drops || []).find(o => o.n === n1); rec.push({ t: now - t0, d, inDrawn: V3.drawn.some(o => o.n === n1) }); if (now - t0 < 520) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    const ds = rec.filter(r => r.d), last = ds[ds.length - 1];
    return { n: ds.length, below: ds.filter(r => r.d.z < 0).length, first: ds[0] && ds[0].d, last: last && { t: last.t, z: last.d.z, u: last.d.u }, lowest: Math.min(...ds.map(r => r.d.z)),
      sinks: ds.every((r, i) => !i || r.d.z <= ds[i - 1].d.z + 1e-9), after: rec.filter(r => !r.d && r.t > (last ? last.t : 0)).length, never: rec.every(r => !r.inDrawn),
      onScreen: ds.every(r => r.d.s && r.d.s[0] >= felt.view3.box.left && r.d.s[0] <= felt.view3.box.left + felt.view3.box.width), R: BALL_R, ms: V3_DROP_MS };
  }, [kind, k, set]);
  for (const [kind, k, set, name] of [['8', 5, {}, '8-ball corner'], ['8', 4, {}, '8-ball side'], ['snooker', 5, { snookerTable: 'compact' }, 'snooker corner (rounded jaws)'], ['bumper', 0, { bumperTable: 'rect' }, 'bumper cup']]) {
    const d = await dropRun(kind, k, set);
    check(`pot (${name}): the ball drops in 3D over ${d.last ? d.last.t.toFixed(0) : '-'} ms (${d.n} frames, ${d.below} of them below the bed, lowest ${(d.lowest * 1000).toFixed(0)} mm), sinking every frame, then gone, never drawn on the table`,
      d.n >= 5 && d.below >= 2 && d.lowest < -0.5 * d.R && d.sinks && d.last.t > d.ms * 0.7 && d.last.t < d.ms + 60 && d.after > 3 && d.never && d.onScreen, JSON.stringify(d));
    if (SHOTS && kind === '8' && k === 5) { await dropRun(kind, k, set); await page.screenshot({ path: path.join(SHOTS, 'v3-drop.png') }); }
  }
  await t.ev(() => { felt.speed = 4; setSetting('snookerTable', 'compact'); setSetting('bumperTable', 'octagon'); });
  /* a hit flash: a cushion's glow and a ball contact's ring, as onHits leaves them, drawn where they happened */
  const fx = await t.ev(() => {
    setSetting('viewPitch', 24); setSetting('viewDist', 1.1); settings.autoAim = false; felt.start('8');
    const g = felt.game;
    for (const b of g.balls) b.on = b.n === 0;
    Object.assign(g.balls[0], { x: TL * 0.3, y: TW * 0.5 }); Object.assign(g, { breakShot: false, inHand: null });
    aimAngle = 0; hud(); V3.seat.set = false; v3Update();
    const gl = t3d.getContext('webgl2'), B = felt.view3.box, k = felt.view3.scale, x = TL * 0.62, y = TW * 0.4;
    const px = s => { const o = new Uint8Array(4); gl.readPixels(Math.round((s[0] - B.left) * k), t3d.height - 1 - Math.round((s[1] - B.top) * k), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, o); return [...o.slice(0, 3)]; };
    effects.length = 0;
    let now = performance.now();
    draw(now); const s = felt.v3Proj(x, y), base = px(s);
    effects.push({ kind: 'rail', key: 'test', x, y, v: 3, t: now, d: 340 });
    draw(now += 1); const lit = px(s), list = felt.view3.fx || V3.fx;
    draw(now += 400); const gone = (V3.fx || []).length;
    return { base, lit, list, gone, inBox: s[0] > B.left && s[0] < B.left + B.width && s[1] > B.top && s[1] < B.top + B.height };
  });
  const fxD = fx.lit.map((v, i) => v - fx.base[i]);
  check(`flash: a cushion's glow shows in 3D at its contact (the pixel there ${fxD.join('/')} brighter, added as 2D's lighter), gone after its time`,
    fx.list.length === 1 && fx.list[0].kind === 'rail' && fx.inBox && fxD.every(v => v >= 0) && fxD[1] > 12 && fx.gone === 0, JSON.stringify(fx));
  /* the loupe: fine aim held, the contact in a lens off it, inside the stage */
  const loupeRun = () => t.ev(async () => {
    felt.speed = 1; settings.autoAim = false; setSetting('viewPitch', 24); setSetting('viewDist', 1.1); settings.guide = 'full';
    felt.start('8');
    const g = felt.game;
    for (const b of g.balls) b.on = [0, 1, 5].includes(b.n);
    Object.assign(g.balls.find(b => b.n === 1), { x: TL * 0.75, y: TW * 0.35 }); Object.assign(g.balls.find(b => b.n === 5), { x: TL * 0.24, y: TW * 0.7 });
    Object.assign(g.balls[0], { x: TL * 0.47, y: TW * 0.49 }); Object.assign(g, { breakShot: false, inHand: null });
    const c = g.balls[0], o = g.balls.find(b => b.n === 1), P = POCKET_AIM[2], ux = P[0] - o.x, uy = P[1] - o.y, L = Math.hypot(ux, uy);
    const gx = o.x - ux / L * 2 * BALL_R, gy = o.y - uy / L * 2 * BALL_R;
    aimAngle = Math.atan2(gy - c.y, gx - c.x); hud(); V3.seat.set = false; v3Update();
    let now = performance.now();
    const run = n => { for (let i = 0; i < n; i++) draw(now += 16); };
    fineAim = false; run(20);
    const off = !!V3.loupe;
    fineAim = true; run(20);
    const L1 = V3.loupe && { ...V3.loupe }, C = felt.v3Proj(gx, gy), B = felt.view3.box;
    /* the lens's middle shows the contact magnified: the ghost ball's middle there, so it differs from the frame without */
    const gl = t3d.getContext('webgl2'), k = felt.view3.scale, px = s => { const o = new Uint8Array(4); gl.readPixels(Math.round((s[0] - B.left) * k), t3d.height - 1 - Math.round((s[1] - B.top) * k), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, o); return [...o.slice(0, 3)]; };
    const inL = L1 ? px([L1.x, L1.y + L1.r * 0.5]) : null;
    const cost = () => { const N = 40, o = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, o); const t0 = performance.now(); for (let i = 0; i < N; i++) { draw(now += 16); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, o); } return (performance.now() - t0) / N; };
    const ms = cost();
    fineAim = false; run(20); const outL = L1 ? px([L1.x, L1.y + L1.r * 0.5]) : null; const base = cost();
    const after = !!V3.loupe;
    return { off, L1, after, d: L1 ? Math.hypot(L1.x - C[0], L1.y - C[1]) : 0, inside: L1 && L1.x - L1.r >= B.left - 4 && L1.x + L1.r <= B.left + B.width + 4 && L1.y - L1.r >= B.top - 4 && L1.y + L1.r <= B.top + B.height + 4, inL, outL, ms, base };
  });
  const lp = await loupeRun();
  check(`loupe: in 3D shown while fine aim is held, gone when it is not, ${lp.L1 ? (2 * lp.L1.r).toFixed(0) : '-'} CSS px across (120 to 150), its centre ${lp.d.toFixed(0)} px from the contact (over its radius), inside the stage, the lens drawn`,
    !lp.off && lp.L1 && lp.L1.a === 1 && 2 * lp.L1.r >= 110 && 2 * lp.L1.r <= 150 && lp.d > lp.L1.r && lp.inside && !lp.after && Math.max(...lp.inL.map((v, i) => Math.abs(v - lp.outL[i]))) > 20, JSON.stringify(lp));
  const spL = await speedFactor(page), kL = s1.soft ? spL.f : 1;
  check(`loupe: a 3D frame with it up ${lp.ms.toFixed(1)} ms, without ${lp.base.toFixed(1)} ms: under ${((s1.soft ? 26 : 16) * kL).toFixed(1)} ms (x${spL.f.toFixed(2)} for this runner) and at most twice the frame without it`,
    lp.ms < (s1.soft ? 26 : 16) * kL && lp.ms < 2 * lp.base, JSON.stringify({ ms: lp.ms, base: lp.base }));
  if (SHOTS) { await t.ev(() => { fineAim = true; }); await frames(page, 8); await page.screenshot({ path: path.join(SHOTS, 'v3-loupe.png') }); await t.ev(() => { fineAim = false; }); }
  /* snooker's scoreboard: on the stage's bottom row in 3D (with the 3D switch), inside the stage, clear of the switch and of the bed as drawn */
  const snk = await t.ev(async () => {
    felt.speed = 4; setSetting('viewPitch', 24); setSetting('viewDist', 1.1); felt.start('snooker');
    await new Promise(r => setTimeout(r, 400));
    const q = snkBar.getBoundingClientRect(), B = felt.view3.box, v = viewBtn.getBoundingClientRect();
    const bed = [[0, 0], [TL, 0], [TL, TW], [0, TW]].map(p => felt.v3Proj(p[0], p[1], 0));
    /* the bed's quad as projected (corners behind the eye are clipped toward it: sample the edges instead) */
    const inBed = (x, y) => { const u = felt.v3Unproj(x, y, 0); return !!u && u[0] >= 0 && u[0] <= TL && u[1] >= 0 && u[1] <= TW; };
    let hits = 0;
    for (let i = 0; i <= 10; i++) for (let j = 0; j <= 4; j++) if (inBed(q.left + q.width * i / 10, q.top + q.height * j / 4)) hits++;
    return { live: felt.view3.live, shown: !snkBar.hidden, q: { l: q.left, t: q.top, r: q.right, b: q.bottom }, B, inside: q.left >= B.left && q.right <= B.left + B.width && q.top >= B.top && q.bottom <= B.top + B.height,
      clearBtn: q.left >= v.right || q.right <= v.left || q.top >= v.bottom || q.bottom <= v.top, hits, bed: bed.map(p => p && p.slice(0, 2).map(Math.round)) };
  });
  check('snooker in 3D: the scoreboard sits on the stage\'s bottom row, inside the stage, clear of the 3D switch and of the bed as the camera shows it',
    snk.live && snk.shown && snk.inside && snk.clearBtn && snk.hits === 0 && snk.B.top + snk.B.height - snk.q.b < 30, JSON.stringify(snk));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'v3-snooker.png') });
  /* a moment's callout in 3D: over the far rail where the room shows, inside the stage, off the bed and the bottom row */
  const co = await t.ev(async () => {
    felt.start('8'); await new Promise(r => setTimeout(r, 300));
    showCallout('Bank');
    const q = callout.getBoundingClientRect(), B = felt.view3.box;
    const inBed = (x, y) => { const u = felt.v3Unproj(x, y, 0); return !!u && u[0] >= 0 && u[0] <= TL && u[1] >= 0 && u[1] <= TW; };
    let hits = 0;
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 4; j++) if (inBed(q.left + q.width * i / 8, q.top + q.height * j / 4)) hits++;
    return { q: { l: q.left, t: q.top, r: q.right, b: q.bottom }, B, hits, inside: q.left >= B.left && q.right <= B.left + B.width && q.top >= B.top + 4 && q.bottom <= B.top + B.height - 52 };
  });
  check('callout in 3D: a moment is called out over the far rail, inside the stage, over the bottom row, off the bed', co.inside && co.hits === 0, JSON.stringify(co));
  /* the neighbours at the lowest pitch: each one in view reads as a table (its lit rail and cloth against the wall above) */
  const nb = await t.ev(async () => {
    setSetting('viewPitch', 8); setSetting('viewDist', 1.1); felt.start('8');
    await new Promise(r => setTimeout(r, 300));
    V3.seat.set = false; aimAngle = 0.5; v3Update(); draw(performance.now());
    const gl = t3d.getContext('webgl2'), B = felt.view3.box, k = felt.view3.scale, W = t3d.width, H = t3d.height;
    const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const at = (sx, sy) => { const x = Math.round((sx - B.left) * k), y = H - 1 - Math.round((sy - B.top) * k); if (x < 0 || y < 0 || x >= W || y >= H) return null; const i = (y * W + x) * 4; return [px[i], px[i + 1], px[i + 2]]; };
    const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const out = [];
    for (const [x, y] of V3.geo.near) {
      const s = felt.v3Proj(x, y, 0.02), u = felt.v3Proj(x, y, 0.75), b = s && u && at(u[0], u[1]);
      if (!b || !at(s[0], s[1])) continue;
      let mx = 0;
      for (let dy = -6; dy <= 6; dy++) { const q = at(s[0], s[1] + dy); if (q) mx = Math.max(mx, lum(q)); }
      out.push({ x, y, ratio: (mx + 0.05) / (lum(b) + 0.05) });
    }
    return out;
  });
  check(`neighbours at pitch 8: ${nb.length} in view, each a table against the wall (lit rail and cloth over the wall above it: ${nb.map(n => n.ratio.toFixed(2) + ':1').join(', ')}, 2.5:1 at least)`,
    nb.length >= 1 && nb.every(n => n.ratio >= 2.5), JSON.stringify(nb));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'v3-low-neighbours.png') });
  /* a ball in the air (a jump shot's b.z, the height of its bottom above the bed): drawn raised in both views, its shadow on the bed */
  const air = await t.ev(() => {
    setSetting('viewPitch', 24); setSetting('viewDist', 1.1); settings.autoAim = false; felt.start('8');
    const g = felt.game, one = g.balls.find(b => b.n === 1);
    for (const b of g.balls) b.on = b.n === 0 || b.n === 1;
    Object.assign(g.balls[0], { x: TL * 0.3, y: TW * 0.5 }); Object.assign(one, { x: TL * 0.6, y: TW * 0.5 }); Object.assign(g, { breakShot: false, inHand: null });
    aimAngle = 0.3; hud(); V3.seat.set = false; v3Update();
    const gl = t3d.getContext('webgl2'), B = felt.view3.box, k = felt.view3.scale, H3 = 0.06;
    const px3 = s => { const o = new Uint8Array(4); gl.readPixels(Math.round((s[0] - B.left) * k), t3d.height - 1 - Math.round((s[1] - B.top) * k), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, o); return [...o.slice(0, 3)]; };
    const yellow = c => c[0] > 120 && c[1] > 90 && c[2] < c[1] * 0.6;
    const top = felt.v3Proj(one.x, one.y, BALL_R + H3 + BALL_R * 0.5);
    delete one.z; draw(performance.now()); const p0 = px3(top), z0 = V3.drawn.find(o => o.n === 1).z;
    one.z = H3; draw(performance.now()); const p1 = px3(top), z1 = V3.drawn.find(o => o.n === 1).z;
    /* top-down: the ball drawn a little larger (its yellow reaches further) */
    setSetting('view', 'top'); v3Update(); layout();
    const ctx2 = table.getContext('2d'), s = toScreen(one.x, one.y), r = BALL_R * view.k;
    const count = () => { draw(performance.now()); const n = Math.ceil(r * 1.4 * dpr), d = ctx2.getImageData(Math.round(s[0] * dpr) - n, Math.round(s[1] * dpr) - n, 2 * n, 2 * n).data; let c = 0; for (let i = 0; i < d.length; i += 4) if (yellow([d[i], d[i + 1], d[i + 2]])) c++; return c; };
    delete one.z; const c0 = count(); one.z = H3; const c1 = count();
    delete one.z; setSetting('view', '3d'); v3Update();
    return { z0, z1, p0, p1, c0, c1, R: BALL_R, H3 };
  });
  check(`air: a ball with b.z set draws raised in 3D (centre at ${(air.z1 * 1000).toFixed(0)} mm, its yellow where only the room or cloth was), and top-down a little larger (${air.c0} to ${air.c1} yellow px)`,
    Math.abs(air.z0 - air.R) < 1e-9 && Math.abs(air.z1 - air.R - air.H3) < 1e-9 && !(air.p0[0] > 120 && air.p0[2] < air.p0[1] * 0.6) && air.p1[0] > 120 && air.p1[2] < air.p1[1] * 0.6 && air.c1 > air.c0 * 1.08, JSON.stringify(air));
  await t.ev(() => { setSetting('viewPitch', 24); setSetting('viewDist', 1.1); felt.speed = 4; });

  /* ---- 7. frames, contrast, targets, landscape ---- */
  /* Budget: on a phone's GPU the view draws at the screen's full pixel ratio. Headless Chromium here
     has only SwiftShader (software GL), where one full-screen textured pass at 3x alone takes about
     27 ms, so on a software renderer the view draws at 1.25x (V3_SOFT_DPR). The frames are measured
     as the real cost (every frame's pixels flushed with readPixels) while a finger drags the aim: 95%
     under 16 ms and none over 33, best of three runs (the suites run side by side). */
  await t.ev(() => { setSetting('viewPitch', 24); setSetting('viewDist', 1.1); settings.autoAim = false; felt.start('8'); });
  await frames(page, 4);
  const runs = [];
  for (let run = 0; run < 3; run++) {
    await t.ev(() => { felt.v3Measure = true; felt.v3Clear(); });
    await t.touch('touchStart', [[120, 300]]);
    for (let i = 1; i <= 60; i++) { await t.touch('touchMove', [[120 + i * 2, 300]], 16); await frames(page, 1); }
    await t.touch('touchEnd', []);
    const ms = await t.ev(() => { felt.v3Measure = false; return felt.v3Ms(); });
    ms.sort((x, y) => x - y);
    runs.push({ n: ms.length, p95: ms[Math.floor(ms.length * 0.95)], max: ms[ms.length - 1], mean: ms.reduce((x, y) => x + y, 0) / ms.length });
  }
  const fb = runs.reduce((x, y) => y.p95 < x.p95 ? y : x);
  /* a GPU must hold a frame (16 ms); software GL is a regression guard only: the CI runner's
     SwiftShader measured p95 19.3 ms where this machine measures 15, neither says anything about a phone */
  const sp = await speedFactor(page), k = s1.soft ? sp.f : 1;   /* a slow runner is judged against itself (lib.cjs) */
  const P95 = (s1.soft ? 26 : 16) * k, MAX = (s1.soft ? 40 : 33) * k;
  check(`frames: dragging the aim at 393x852, ${s1.soft ? 'software GL at ' + s1.scale + 'x' : 'GPU at ' + s1.scale + 'x'}: 95% under ${fb.p95.toFixed(1)} ms < ${P95.toFixed(1)}, max ${fb.max.toFixed(1)} ms < ${MAX.toFixed(1)} (mean ${fb.mean.toFixed(1)}, runner x${sp.f.toFixed(2)}, flushed, best of 3)`, fb.n >= 30 && fb.p95 < P95 && fb.max < MAX, JSON.stringify(runs));
  console.log(`3D frame time: mean ${fb.mean.toFixed(2)} ms, p95 ${fb.p95.toFixed(2)} ms, max ${fb.max.toFixed(2)} ms`);
  const lc = await lowContrast(page);
  check('the HUD over the 3D view: every text 4.5:1', lc.length === 0, JSON.stringify(lc));
  const small = await smallTargets(page);
  check('the HUD over the 3D view: every target 44 px', small.length === 0, JSON.stringify(small));
  check('no console errors (portrait)', t.errors.length === 0, t.errors.slice(0, 3).join(' | '));
  await t.browser.close();

  const L = await phone({ viewport: { width: 852, height: 393 }, init: () => { try { localStorage.setItem('felt.settings', JSON.stringify({ sv: 3, view: '3d' })); } catch (e) { } } });
  await L.ev(() => { felt.speed = 4; felt.start('8'); });
  await frames(L.page, 3);
  const land = await L.ev(() => { const r = viewBtn.getBoundingClientRect(), B = felt.view3.box, st = stage.getBoundingClientRect(); return { live: felt.view3.live, w: r.width, h: r.height, inStage: r.left >= st.left && r.right <= st.right && r.top >= st.top, box: B, canvas: felt.view3.canvas, drawn: felt.view3.drawn.length }; });
  check('landscape: 3D fills the stage beside the column, the button inside it, balls drawn', land.live && land.w >= 44 && land.h >= 44 && land.inStage && land.box.width > land.box.height && land.drawn > 0, JSON.stringify(land));
  const before = await L.ev(() => felt.aim);
  await L.drag(300, 200, 400, 200, 250);
  const after = await L.ev(() => ({ aim: felt.aim, st: felt.state, shot: felt.lastShot }));
  check('landscape: a drag across aims, nothing shot', after.aim > before && after.st === 'aim' && after.shot === null, JSON.stringify(after));
  if (SHOTS) await L.page.screenshot({ path: path.join(SHOTS, 'v3-landscape.png') });
  for (const [kind, set] of kinds) {
    await L.ev(([k, s]) => { for (const key of Object.keys(s)) setSetting(key, s[key]); felt.start(k); }, [kind, set]);
    await frames(L.page, 3);
    await framed(L, await L.ev(() => TABLE + (TABLE === 'snooker' ? SNOOKER_SIZE : TABLE === 'bumper' ? BUMPER_SHAPE : '')), 'landscape');
  }
  const lc2 = await lowContrast(L.page);
  check('landscape: every text 4.5:1, every target 44 px', lc2.length === 0 && (await smallTargets(L.page)).length === 0, JSON.stringify(lc2));
  check('no console errors (landscape)', L.errors.length === 0, L.errors.slice(0, 3).join(' | '));
  await L.browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
