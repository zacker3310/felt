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
   7. frames while dragging the aim within budget (see the budget note below), the HUD's text over the
      3D view 4.5:1, targets 44 px, and landscape. FELT_SHOTS=<dir> saves screenshots. */
'use strict';
const path = require('path');
const { check, done, open, smallTargets, lowContrast, settled } = require('./lib.cjs');
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
  const P95 = s1.soft ? 26 : 16, MAX = s1.soft ? 40 : 33;
  check(`frames: dragging the aim at 393x852, ${s1.soft ? 'software GL at ' + s1.scale + 'x' : 'GPU at ' + s1.scale + 'x'}: 95% under ${fb.p95.toFixed(1)} ms < ${P95}, max ${fb.max.toFixed(1)} ms < ${MAX} (mean ${fb.mean.toFixed(1)}, flushed, best of 3)`, fb.n >= 30 && fb.p95 < P95 && fb.max < MAX, JSON.stringify(runs));
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
