/* aim-check: how aiming feels on a phone (440x956 portrait and 956x440 landscape, dpr 3, real
   touch events with their own timestamps, so finger speeds are exact). The sweep's gain is
   capped near the cue ball and about 1:1 far from it; a slow finger turns the aim finer than a
   fast one over the same path; a press held still and then nudged fine-tunes (it is not a tap);
   a short quick swipe that may yet be a tap leaves the line alone until it is decided;
   a lift-off flick after a rest leaves the aim where it rested; a tap on a ball aims at its
   centre, on the cloth at the spot, on the cue ball nowhere; the fine-aim wheel is finer rolled
   slowly. Regressions: a thumb resting on the table or the wheel never makes the power bar dead,
   and a pause during the auto-aim swing does not leave the cue half way. */
'use strict';
const { check, done, open } = require('./lib.cjs');
const DEG = Math.PI / 180;

async function phone(viewport) {
  const o = await open('', { viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const cdp = await o.page.context().newCDPSession(o.page);
  let vt = Date.now() / 1000;
  /* every touch carries a timestamp dt ms after the last one: e.timeStamp follows it exactly */
  const tch = async (type, pts, dt = 8) => {
    vt += dt / 1000;
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : pts.map((p, i) => ({ x: p[0], y: p[1], id: p[2] ?? i + 1 })), timestamp: vt });
  };
  const T = {
    ...o,
    down: (p, dt) => tch('touchStart', [p], dt), move: (p, dt) => tch('touchMove', [p], dt), up: dt => tch('touchEnd', [], dt), tch,
    land: () => o.page.waitForTimeout(40),
    aim: async () => { await o.page.waitForTimeout(40); return o.page.evaluate(() => felt.aim); },
    /* two players, no auto aim, the cue ball mid-table and not in hand, aim 0. sx: the screen
       direction aim 0 points along; c: the cue ball on screen; R: sweepR() */
    setup: () => o.page.evaluate(() => {
      settings.cpu = false; settings.autoAim = false; felt.start('8');
      game = placeCue(game, TL / 2, TW / 2); game.inHand = null; aimAngle = 0; aimLock = null; felt.speed = 40; felt.lastShot = null;
      const c = felt.game.balls[0], s = felt.toScreen(c.x, c.y), u = felt.toScreen(c.x + 0.1, c.y);
      return { c: s, sx: Math.atan2(u[1] - s[1], u[0] - s[0]), R: felt.sweepR, ball: felt.ballPx, shots: felt.game.shots };
    }),
  };
  /* the point r px from the cue ball at screen angle a */
  T.at = (S, r, a) => [S.c[0] + r * Math.cos(a), S.c[1] + r * Math.sin(a)];
  return T;
}

/* a computer with a mouse (no touch, pointer: fine): hover aims, a click holds the line, and the
   hand on its way to the power bar (across the bed, resting on it, off the table) never moves it;
   the bar shoots along the held line; Esc and a right click let go; another click holds there;
   the wheel, the arrows and the english still adjust a held aim; calls; the sign and the tip. */
async function desk(vp) {
  const tag = `mouse ${vp.width}x${vp.height}`;
  const o = await open('', { viewport: vp, init: () => { try { if (!sessionStorage.getItem('fresh')) { sessionStorage.setItem('fresh', '1'); localStorage.removeItem('felt.mouseTip.v1'); } } catch (e) { } } });
  const { page } = o, M = page.mouse;
  const fine = await page.evaluate(() => matchMedia('(pointer: fine)').matches && matchMedia('(hover: hover)').matches);
  check(`${tag}: the page sees a fine pointer that hovers`, fine);
  const setup = () => page.evaluate(() => {
    settings.cpu = false; settings.autoAim = false; felt.start('8');
    game = placeCue(game, TL / 2, TW / 2); game.inHand = null; aimAngle = 0; aimLock = null; felt.speed = 40; felt.lastShot = null;
    hud();
    const S = (x, y) => felt.toScreen(x, y);
    return { p1: S(TL * 0.82, TW * 0.22), p2: S(TL * 0.22, TW * 0.78), p3: S(TL * 0.7, TW * 0.85), p4: S(TL * 0.3, TW * 0.2), c: S(TL / 2, TW / 2) };
  });
  const aimAt = pt => page.evaluate(([x, y]) => { const p = felt.toTable(x, y), c = felt.game.balls[0]; return Math.atan2(p[1] - c.y, p[0] - c.x); }, pt);
  const st = () => page.evaluate(() => ({ aim: felt.aim, held: felt.aimHeld, s: felt.state, cursor: table.style.cursor, shots: felt.game.shots }));
  const bar = () => page.evaluate(() => { const r = powerBar.getBoundingClientRect(); const up = r.height > r.width; return { up, a: up ? [r.x + r.width / 2, r.y + 10] : [r.x + 10, r.y + r.height / 2], b: up ? [r.x + r.width / 2, r.y + r.height * 0.6] : [r.x + r.width * 0.6, r.y + r.height / 2] }; });
  let P = await setup();

  /* the tip: the first hover of the cloth, once, and stored */
  await M.move(P.c[0] + 5, P.c[1] - 160, { steps: 4 });
  await M.move(P.p1[0], P.p1[1], { steps: 10 });
  const tip = await page.evaluate(() => ({ t: felt.mouseTip || {}, head: bannerHead.textContent, sub: bannerSub.textContent, on: banner.classList.contains('show'), saved: localStorage.getItem('felt.mouseTip.v1') }));
  check(`${tag}: the first hover shows the mouse tip once: "Click the cloth to lock your aim, then pull the power bar."`,
    tip.t.shows === 1 && tip.t.seen && tip.on && tip.sub === 'Click the cloth to lock your aim, then pull the power bar.' && /"seen":true/.test(tip.saved), JSON.stringify(tip));

  /* hover aims */
  let s0 = await st(), want = await aimAt(P.p1);
  check(`${tag}: hover aims at the pointer, unheld`, Math.abs(s0.aim - want) < 0.01 && !s0.held, JSON.stringify({ s0, want }));
  const lineAt = () => page.evaluate(() => {
    const c = felt.game.balls[0], a = felt.aim, s = felt.toScreen(c.x + Math.cos(a) * 0.12, c.y + Math.sin(a) * 0.12), d = dpr;
    const g = table.getContext('2d').getImageData(Math.round(s[0] * d) - 1, Math.round(s[1] * d) - 1, 3, 3).data;
    let m = 0; for (let i = 0; i < g.length; i += 4) m = Math.max(m, g[i] + g[i + 1] + g[i + 2]); return m;
  });
  await page.waitForTimeout(60);
  const soft = await lineAt();

  /* a click holds it */
  await M.down(); await M.up();
  await page.waitForTimeout(60);
  const A = (await st()).aim, s1 = await st();
  check(`${tag}: a click on the cloth holds the aim there (cursor a pointer)`, s1.held && Math.abs(A - want) < 0.01 && s1.cursor === 'pointer', JSON.stringify(s1));
  const solid = await lineAt();
  const sign = await page.evaluate(() => {
    const h = felt.heldAt, d = dpr;
    if (!h) return { h: null, px: [] };
    const g = table.getContext('2d').getImageData(Math.round((h[0] - 3) * d), Math.round((h[1] + 0.5) * d), 1, 1).data;
    return { h, px: [...g].slice(0, 3) };
  });
  check(`${tag}: held, the aim line is drawn solid (brighter than the soft hover line) and a white padlock stands by the ghost ball`,
    solid > soft && !!sign.h && sign.px.length === 3 && sign.px.every(v => v >= 240), JSON.stringify({ soft, solid, sign }));

  /* the dash to the bar: across the bed, a rest on it well over DWELL_MS, more bed, off the table, onto the bar */
  await M.move(P.p2[0], P.p2[1], { steps: 25 });
  await page.waitForTimeout(350);
  await M.move(P.p2[0] + 12, P.p2[1] - 8, { steps: 3 });
  await page.waitForTimeout(250);
  await M.move(P.p3[0], P.p3[1], { steps: 15 });
  await page.waitForTimeout(250);
  await M.move(2, 2, { steps: 10 });
  const B = await bar();
  await M.move(B.a[0], B.a[1], { steps: 20 });
  await page.waitForTimeout(200);
  const s2 = await st();
  check(`${tag}: KEY: the mouse crossing the bed, resting on it, leaving the table and landing on the power bar leaves the held aim exactly where it was`,
    s2.aim === A && s2.held, JSON.stringify({ A, s2 }));
  await M.down(); await M.move(B.b[0], B.b[1], { steps: 8 });
  const pulling = await page.evaluate(() => felt.pulling);
  await M.up();
  await page.waitForFunction(() => !!felt.lastShot, null, { timeout: 3000 }).catch(() => {});
  const shot = await page.evaluate(() => felt.lastShot);
  check(`${tag}: a mouse pull on the bar shoots along the held angle exactly`, pulling && shot && shot.angle === A, JSON.stringify({ pulling, shot, A }));
  await page.waitForFunction(() => felt.state === 'aim' || felt.state === 'over', null, { timeout: 30000 });
  check(`${tag}: the next turn starts unheld`, !(await st()).held);

  /* Esc lets go (and does not pause); hover aims again; Esc unheld still pauses */
  P = await setup();
  await M.move(P.p1[0], P.p1[1], { steps: 6 }); await M.down(); await M.up();
  const e0 = await st();
  await page.keyboard.press('Escape');
  const e1 = await st();
  await M.move(P.p4[0], P.p4[1], { steps: 12 });
  const e2 = await st(), want4 = await aimAt(P.p4);
  check(`${tag}: Esc lets a held aim go without pausing, and hover aims again`, e0.held && !e1.held && e1.s === 'aim' && e1.aim === e0.aim && Math.abs(e2.aim - want4) < 0.01 && e2.cursor === '', JSON.stringify({ e0, e1, e2, want4 }));
  await page.keyboard.press('Escape');
  const paused = await page.evaluate(() => felt.state);
  await page.evaluate(() => felt.resume());
  await page.waitForTimeout(100);
  check(`${tag}: Esc with nothing held pauses as before`, paused === 'menu', paused);

  /* another click holds there; a right click on the table lets go and moves nothing */
  P = await setup();
  await M.move(P.p1[0], P.p1[1], { steps: 6 }); await M.down(); await M.up();
  const r0 = await st();
  await M.move(P.p3[0], P.p3[1], { steps: 12 });
  const r1 = await st();
  await M.down(); await M.up();
  const r2 = await st(), want3 = await aimAt(P.p3);
  await M.move(P.p4[0], P.p4[1], { steps: 12 });
  const r3 = await st();
  await M.click(P.p4[0], P.p4[1], { button: 'right' });
  const r4 = await st();
  const menu = await page.evaluate(() => !elevPop.hidden);
  await M.move(P.p2[0], P.p2[1], { steps: 12 });
  const r5 = await st(), want2 = await aimAt(P.p2);
  check(`${tag}: a second click re-aims and holds at the new point (one click)`, r0.held && r1.aim === r0.aim && r2.held && Math.abs(r2.aim - want3) < 0.01 && r3.aim === r2.aim, JSON.stringify({ r0, r1, r2, want3, r3 }));
  check(`${tag}: a right click on the table lets go (the aim stays until the mouse moves, then hover follows; no elevation sheet)`,
    !r4.held && r4.aim === r3.aim && !menu && Math.abs(r5.aim - want2) < 0.01, JSON.stringify({ r4, r5, want2 }));

  /* the wheel, the arrows and the english still adjust a held aim, which stays held */
  P = await setup();
  await M.move(P.p1[0], P.p1[1], { steps: 6 }); await M.down(); await M.up();
  const w0 = await st();
  const wh = await page.evaluate(() => { const r = fineWheel.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await M.move(wh[0], wh[1], { steps: 12 });
  await M.wheel(0, 100);
  await page.waitForTimeout(60);
  const w1 = await st();
  await M.move(wh[0], wh[1] - 20, { steps: 4 }); await M.down(); await M.move(wh[0], wh[1] + 20, { steps: 8 }); await M.up();
  const w2 = await st();
  await page.keyboard.press('ArrowRight');
  const w3 = await st();
  const pad = await page.evaluate(() => { const r = spinPad.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height * 0.3]; });
  await M.move(pad[0], pad[1], { steps: 10 }); await M.down(); await M.up();
  const w4 = await page.evaluate(() => ({ aim: felt.aim, held: felt.aimHeld, spin: felt.cueSpin }));
  await M.move(P.p2[0], P.p2[1], { steps: 20 });
  await page.waitForTimeout(250);
  await M.move(P.p4[0], P.p4[1], { steps: 20 });
  const w5 = await st();
  check(`${tag}: the mouse wheel, a wheel drag and the arrows turn a held aim and it stays held`, w0.held && w1.held && w1.aim !== w0.aim && w2.held && w2.aim !== w1.aim && w3.held && w3.aim !== w2.aim, JSON.stringify({ w0, w1, w2, w3 }));
  check(`${tag}: the english pad sets spin and leaves the held aim; hovering the bed after leaves it exactly`, w4.held && w4.aim === w3.aim && w4.spin.y > 0.2 && w5.held && w5.aim === w3.aim, JSON.stringify({ w4, w5 }));

  /* ball in hand: a grab near the cue ball still moves it, and the move lets the held aim go */
  P = await setup();
  await page.evaluate(() => { game.inHand = 'table'; enterHand(); hud(); });
  await M.move(P.p1[0], P.p1[1], { steps: 6 }); await M.down(); await M.up();
  const h0 = await st();
  const cs = await page.evaluate(() => { const c = felt.game.balls[0]; return { s: felt.toScreen(c.x, c.y), to: felt.toScreen(c.x - 0.15, c.y + 0.1), x: c.x, y: c.y }; });
  await M.move(cs.s[0] + 4, cs.s[1] + 2, { steps: 4 });
  const grab = await page.evaluate(() => table.style.cursor);
  await M.down(); await M.move(cs.to[0] + 4, cs.to[1] + 2, { steps: 10 }); await M.up();
  await page.waitForTimeout(100);
  const h1 = await page.evaluate(() => { const c = felt.game.balls[0]; return { x: c.x, y: c.y, held: felt.aimHeld, s: felt.state }; });
  check(`${tag}: ball in hand: the mouse still grabs and moves the cue ball near it, and the move lets the held aim go`,
    h0.held && grab === 'grab' && Math.abs(h1.x - (cs.x - 0.15)) < 0.004 && Math.abs(h1.y - (cs.y + 0.1)) < 0.004 && !h1.held && h1.s === 'aim', JSON.stringify({ h0, grab, h1, cs }));

  /* calls (house 10-ball, the 1 lined up on the foot corner): held, a click on the 1 calls it and a
     click on the pocket calls that, and neither moves the held aim; the bar shoots the call along it */
  await page.evaluate(() => { setSetting('rules10', '10-house'); settings.autoAim = false; felt.speed = 40; felt.start('10'); });
  const C = await page.evaluate(() => {
    const g = felt.game, Q = POCKET_AIM[5], d = [Q[0] - TL / 2, Q[1] - TW / 2], l = Math.hypot(d[0], d[1]), u = [d[0] / l, d[1] / l];
    const b1 = [Q[0] - u[0] * 0.4, Q[1] - u[1] * 0.4], c = [b1[0] - u[0] * 0.55, b1[1] - u[1] * 0.55];
    for (const b of g.balls) b.on = b.n === 0 || b.n === 1 || b.n === 10;
    Object.assign(g.balls.find(b => b.n === 0), { x: c[0], y: c[1] });
    Object.assign(g.balls.find(b => b.n === 1), { x: b1[0], y: b1[1] });
    Object.assign(g.balls.find(b => b.n === 10), { x: TL * 0.3, y: TW * 0.2 });
    Object.assign(g, { breakShot: false, inHand: null, pushAvail: false });
    aimAngle = Math.atan2(u[1], u[0]); aimLock = null; felt.lastShot = null;
    hud();
    const S = (x, y) => felt.toScreen(x, y), pill = callPill.getBoundingClientRect();
    /* a cut a little off the straight line: a cloth point just to one side of the 1 */
    return { cloth: S(b1[0] - u[1] * 0.03 + u[0] * 0.05, b1[1] + u[0] * 0.03 + u[1] * 0.05), ball: S(b1[0], b1[1]), pocket: S(POCKETS[5][0], POCKETS[5][1]), pill: [pill.x + pill.width / 2, pill.y + pill.height / 2] };
  });
  await page.waitForTimeout(100);
  await M.click(C.pill[0], C.pill[1]);
  await M.move(C.cloth[0], C.cloth[1], { steps: 10 }); await M.down(); await M.up();
  const k0 = await page.evaluate(() => ({ aim: felt.aim, held: felt.aimHeld, call: felt.callState.call }));
  await M.move(C.ball[0], C.ball[1], { steps: 8 }); await M.down(); await M.up();
  const k1 = await page.evaluate(() => ({ aim: felt.aim, held: felt.aimHeld, call: felt.callState.call }));
  await M.move(C.pocket[0], C.pocket[1], { steps: 8 }); await M.down(); await M.up();
  const k2 = await page.evaluate(() => ({ aim: felt.aim, held: felt.aimHeld, call: felt.callState.call, ready: felt.callState.ready }));
  check(`${tag}: calls: held, a click on the 1 calls it and a click on the corner calls that; the held aim never moves`,
    k0.held && k1.call && k1.call.ball === 1 && k1.aim === k0.aim && k1.held && k2.call && k2.call.ball === 1 && k2.call.pocket === 5 && k2.ready && k2.aim === k0.aim && k2.held, JSON.stringify({ k0, k1, k2 }));
  const B2 = await bar();
  await M.move(B2.a[0], B2.a[1], { steps: 20 }); await M.down(); await M.move(B2.b[0], B2.b[1], { steps: 8 }); await M.up();
  await page.waitForFunction(() => !!felt.lastShot, null, { timeout: 3000 }).catch(() => {});
  const ks = await page.evaluate(() => felt.lastShot);
  check(`${tag}: calls: the bar shoots the called shot along the held aim`, ks && ks.angle === k0.aim, JSON.stringify({ ks, aim: k0.aim }));
  await page.waitForFunction(() => felt.state === 'aim' || felt.state === 'over', null, { timeout: 30000 });

  /* 3D: hover never aims, a click there never holds, and the dash to the bar leaves the aim alone */
  await page.evaluate(() => { settings.cpu = false; settings.autoAim = false; setSetting('view', '3d'); felt.start('8'); game = placeCue(game, TL / 2, TW / 2); game.inHand = null; aimLock = null; hud(); });
  const has3 = await page.waitForFunction(() => V3.live, null, { timeout: 5000 }).then(() => true, () => false);
  if (has3) {
    await page.waitForTimeout(300);
    const v0 = await st();
    await M.move(vp.width * 0.3, vp.height * 0.4, { steps: 10 });
    await M.move(vp.width * 0.6, vp.height * 0.5, { steps: 10 });
    const v1 = await st();
    await M.down(); await M.up();
    const v2 = await st();
    const B3 = await bar();
    await M.move(vp.width * 0.2, vp.height * 0.3, { steps: 10 });
    await M.move(B3.a[0], B3.a[1], { steps: 10 });
    const v3 = await st();
    check(`${tag}: 3D: hover never aims, a click never holds, and moving to the bar leaves the aim as the click set it`,
      v1.aim === v0.aim && !v2.held && v3.aim === v2.aim && !v3.held, JSON.stringify({ v0, v1, v2, v3 }));
  } else check(`${tag}: 3D view (no WebGL 2 here: top-down only)`, true);
  await page.evaluate(() => setSetting('view', 'top'));

  /* the padlock keeps 3:1 against the cloth it stands on (the same box drawn unheld: Esc lets go, the
     mouse stays put, so only the sign goes), on green, red and blue; then a click holds it again */
  P = await setup();
  const nine = await page.evaluate(() => { const b = felt.game.balls.find(o => o.n === 9); b.x = TL * 0.3; b.y = TW * 0.3; return felt.toScreen(b.x, b.y); });
  await M.move(nine[0], nine[1], { steps: 8 }); await M.down(); await M.up();
  await page.waitForTimeout(60);
  const ct = [];
  for (const cloth of ['green', 'red', 'blue']) {
    await page.evaluate(c => setSetting('cloth', c), cloth);
    await page.waitForTimeout(120);
    const box = () => page.evaluate(() => {
      const h = felt.heldAt, d = dpr, x2 = table.getContext('2d');
      const L = q => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(q[0]) + 0.7152 * f(q[1]) + 0.0722 * f(q[2]); };
      const g = x2.getImageData(Math.round((h[0] - 8) * d), Math.round((h[1] - 9) * d), Math.round(16 * d), Math.round(18 * d)).data;
      /* the cloth under it: the box's median (a guide line may cross the box; the glyph's dark edge parts it from that) */
      const ls = []; for (let k = 0; k < g.length; k += 4) ls.push(L([g[k], g[k + 1], g[k + 2]]));
      ls.sort((p, q) => p - q);
      const hi = ls[Math.floor(ls.length / 2)];
      const c = [...x2.getImageData(Math.round((h[0] - 3) * d), Math.round((h[1] + 0.5) * d), 1, 1).data];
      return { hi, glyph: L(c), held: felt.aimHeld };
    });
    const on = await box();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(80);
    const off = await box();
    await M.down(); await M.up();
    await page.waitForTimeout(60);
    ct.push({ cloth, held: on.held, unheld: !off.held, bg: +off.hi.toFixed(3), ratio: +((on.glyph + 0.05) / (off.hi + 0.05)).toFixed(2) });
  }
  check(`${tag}: the padlock keeps 3:1 on the green, red and blue cloths`, ct.every(c => c.held && c.unheld && c.ratio >= 3), JSON.stringify(ct));
  await page.evaluate(() => setSetting('cloth', 'green'));
  await page.waitForTimeout(60);

  /* the tip is stored: a fresh visit hovers without it */
  await page.reload(); await page.waitForFunction(() => window.felt && felt.state);
  await page.evaluate(() => { settings.cpu = false; settings.autoAim = false; felt.start('8'); });
  await M.move(10, 10); await M.move(vp.width / 2 - 60, vp.height / 2 - 40, { steps: 10 });
  const tip2 = await page.evaluate(() => felt.mouseTip || {});
  check(`${tag}: the tip never shows again on a later visit`, tip2.seen && tip2.shows === 0, JSON.stringify(tip2));
  if (vp.width === 1280) {
    P = await setup();
    await M.move(P.p1[0], P.p1[1], { steps: 6 }); await M.down(); await M.up();
    await M.move(P.p2[0], P.p2[1], { steps: 10 });
    await page.waitForTimeout(150);
    const dir = process.env.MOUSE_SHOT;
    if (dir) await page.screenshot({ path: dir });
  }
  check(`${tag}: no console errors`, o.errors.length === 0, o.errors.join(' | '));
  await o.browser.close();
}

(async () => {
  for (const vp of [{ width: 440, height: 956 }, { width: 956, height: 440 }]) {
    const tag = `${vp.width}x${vp.height}`;
    const T = await phone(vp);
    let S = await T.setup();
    check(`${tag}: sweepR is about a third of the table's short side on screen (90 to 140 px on this phone)`, S.R > 90 && S.R < 140, JSON.stringify(S));

    /* 1. near the ball the gain is capped: 50 px out, a quick 20 px radial in and out (past the
       tap window; it turns nothing), then 10 px tangential. Raw angle would be 11.3 deg. */
    const a = S.sx + 90 * DEG, tan = [-Math.sin(a), Math.cos(a)];
    await T.down(T.at(S, 50, a));
    for (const r of [40, 30, 40, 50]) await T.move(T.at(S, r, a), 8);
    const aR = await T.aim();
    const p50 = T.at(S, 50, a);
    for (let i = 1; i <= 5; i++) await T.move([p50[0] + tan[0] * 2 * i, p50[1] + tan[1] * 2 * i], 4);
    const aN = await T.aim();
    await T.up(8);
    check(`${tag}: a radial drag near the cue ball turns nothing; 10 px tangential 50 px out turns the aim 2 to 6 deg (not 11)`,
      Math.abs(aR) < 1e-9 && Math.abs(aN - aR) / DEG > 2 && Math.abs(aN - aR) / DEG < 6, JSON.stringify({ radial: aR / DEG, turn: (aN - aR) / DEG, R: S.R }));

    /* 2. far from the ball a swipe is 1:1: 40 deg of arc 1.3 sweepR out, at a normal speed */
    S = await T.setup();
    const rF = 1.3 * S.R;
    await T.down(T.at(S, rF, S.sx + 90 * DEG));
    for (let i = 1; i <= 20; i++) await T.move(T.at(S, rF, S.sx + (90 + 2 * i) * DEG), 8);
    const aF = await T.aim();
    await T.up(8);
    const aF2 = await T.aim();
    check(`${tag}: far from the cue ball a normal swipe turns the aim 1:1 (40 deg of arc, 40 +-1), and a let-go while moving keeps it`,
      Math.abs(aF / DEG - 40) < 1 && aF2 === aF, JSON.stringify({ deg: aF / DEG, after: aF2 / DEG }));

    /* 3. precision by speed: the same 24 px tangential path 1.3 sweepR out, fast then slow */
    const path = async (ms, first) => {
      const S2 = await T.setup(), p = T.at(S2, rF, S2.sx + 90 * DEG), t2 = [-Math.sin(S2.sx + 90 * DEG), Math.cos(S2.sx + 90 * DEG)];
      await T.down(p);
      for (let i = 1; i <= 12; i++) await T.move([p[0] + t2[0] * 2 * i, p[1] + t2[1] * 2 * i], i === 1 && first ? first : ms);
      const got = await T.aim();
      await T.up(300);
      return got;
    };
    const fast = await path(4), slow = await path(60);
    check(`${tag}: a slow drag (0.03 px/ms) turns the aim under half what a fast one (0.5 px/ms) does over the same 24 px`,
      Math.abs(slow) > 0.1 * Math.abs(fast) && Math.abs(slow) < 0.5 * Math.abs(fast) && Math.abs(fast) / DEG > 6, JSON.stringify({ fast: fast / DEG, slow: slow / DEG }));

    /* 4. a press held still, then nudged 4 px slowly: a fraction of a degree, never a tap (a
       tap would aim at the finger, 90 deg off) */
    S = await T.setup();
    const ph = T.at(S, rF, S.sx + 90 * DEG), th = [-Math.sin(S.sx + 90 * DEG), Math.cos(S.sx + 90 * DEG)];
    await T.down(ph);
    for (let i = 1; i <= 4; i++) await T.move([ph[0] + th[0] * i, ph[1] + th[1] * i], i === 1 ? 400 : 40);
    await T.up(300);
    const aH = await T.aim();
    check(`${tag}: hold, then a slow 4 px nudge turns the aim a fraction of a degree (0.05 to 1), not a tap`,
      Math.abs(aH) / DEG > 0.05 && Math.abs(aH) / DEG < 1, JSON.stringify({ deg: aH / DEG }));

    /* 5. lift-off: a sweep, a rest, then a 4 px flick as the finger lifts: the aim is the rested one */
    S = await T.setup();
    await T.down(T.at(S, rF, S.sx + 90 * DEG));
    for (let i = 1; i <= 10; i++) await T.move(T.at(S, rF, S.sx + (90 + 2 * i) * DEG), 8);
    const aRest = await T.aim();
    const pe = T.at(S, rF, S.sx + 110 * DEG), te = [-Math.sin(S.sx + 110 * DEG), Math.cos(S.sx + 110 * DEG)];
    await T.move([pe[0] + te[0] * 4, pe[1] + te[1] * 4], 250);
    const aFlick = await T.aim();
    await T.up(15);
    const aLift = await T.aim();
    check(`${tag}: a lift with a final 4 px flick after a rest does not move the aim (the flick alone moved it ${((aFlick - aRest) / DEG).toFixed(2)} deg)`,
      aLift === aRest && Math.abs(aFlick - aRest) > 0.2 * DEG, JSON.stringify({ rest: aRest / DEG, flick: aFlick / DEG, lift: aLift / DEG }));

    /* 5b. a quick short swipe (15 px in 40 ms) could still be a sloppy tap: the line waits, then
       the release aims at the press point once (it never sweeps and then snaps) */
    S = await T.setup();
    const q = T.at(S, rF, S.sx + 90 * DEG), tq = [-Math.sin(S.sx + 90 * DEG), Math.cos(S.sx + 90 * DEG)];
    const wantQ = await T.page.evaluate(([x, y]) => { const p = felt.toTable(x, y), c = felt.game.balls[0]; return Math.atan2(p[1] - c.y, p[0] - c.x); }, q);
    await T.down(q);
    for (let i = 1; i <= 5; i++) await T.move([q[0] + tq[0] * 3 * i, q[1] + tq[1] * 3 * i], 8);
    const aQ = await T.aim();
    await T.up(8);
    const aQ2 = await T.aim();
    check(`${tag}: a quick 15 px swipe leaves the line still until the release, which aims at the press point (no sweep, then snap)`,
      aQ === 0 && Math.abs(aQ2 - wantQ) < 1e-9, JSON.stringify({ during: aQ / DEG, after: aQ2 / DEG, want: wantQ / DEG }));

    /* 6. taps: on an object ball, its centre (full ball); on the cloth, the spot; on the cue ball, nothing */
    S = await T.setup();
    const tb = await T.page.evaluate(() => {
      const b = felt.game.balls.find(o => o.n === 1), c = felt.game.balls[0];
      b.x = TL / 2 + 0.3; b.y = TW / 2 + 0.15;
      return { s: felt.toScreen(b.x, b.y), want: Math.atan2(b.y - c.y, b.x - c.x), cloth: felt.toScreen(TL / 2 - 0.3, TW / 2 + 0.2), wantCloth: Math.atan2(0.2, -0.3) };
    });
    const off = 0.8 * S.ball / 2;
    await T.down([tb.s[0] + off, tb.s[1] - off * 0.3]); await T.up(60);
    const aBall = await T.aim();
    await T.down(tb.cloth); await T.up(60);
    const aCloth = await T.aim();
    await T.down([S.c[0] + S.ball * 0.3, S.c[1] - S.ball * 0.2]); await T.up(60);
    const aCue = await T.aim();
    check(`${tag}: a tap on an object ball 0.8 radii off its centre aims at the centre (a full-ball line)`, Math.abs(aBall - tb.want) < 1e-9, JSON.stringify({ got: aBall, want: tb.want }));
    check(`${tag}: a tap on the cloth aims at that spot; a tap on the cue ball leaves the aim alone`,
      Math.abs(aCloth - tb.wantCloth) < 0.01 && aCue === aCloth, JSON.stringify({ aCloth, want: tb.wantCloth, aCue }));
    /* a finger never holds the aim (the mouse's click-to-hold, desk() below, is mouse only) */
    const tHeld = await T.page.evaluate(() => ({ held: felt.aimHeld, lock: JSON.stringify(aimLock) }));
    check(`${tag}: a finger's taps and sweeps never hold the aim (mouse only)`, tHeld.held === false && tHeld.lock !== '"held"', JSON.stringify(tHeld));

    /* 7. the fine-aim wheel: 40 px rolled slowly is finer than 40 px rolled fast */
    const roll = async ms => {
      await T.setup();
      const r = await T.page.evaluate(() => { const r = fineWheel.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 - 20 }; });
      await T.down([r.x, r.y]);
      const n = ms > 20 ? 20 : 4;
      for (let i = 1; i <= n; i++) await T.move([r.x, r.y + 40 * i / n], ms);
      await T.up(ms > 20 ? 300 : 8);
      return T.aim();
    };
    const wFast = await roll(8), wSlow = await roll(100);
    check(`${tag}: the fine wheel rolled slowly (0.02 px/ms) turns under 0.4x what it does rolled fast over the same 40 px; fast is 0.6 to 1.1 deg`,
      wSlow !== 0 && Math.abs(wSlow) < 0.4 * Math.abs(wFast) && Math.abs(wFast) / DEG > 0.6 && Math.abs(wFast) / DEG < 1.1, JSON.stringify({ fast: wFast / DEG, slow: wSlow / DEG }));

    /* 8. a thumb resting on the table, or on the wheel, never makes the power bar dead; the
       aim it shoots at is the one the table had */
    for (const rest of ['table', 'wheel']) {
      S = await T.setup();
      const br = await T.page.evaluate(() => { const r = powerBar.getBoundingClientRect(), w = fineWheel.getBoundingClientRect(); return { up: r.height > r.width, x: r.x, y: r.y, w: r.width, h: r.height, wheel: [w.x + w.width / 2, w.y + w.height / 2] }; });
      const thumb = rest === 'table' ? T.at(S, rF, S.sx + 90 * DEG) : br.wheel;
      const st = br.up ? [br.x + br.w / 2, br.y + 8] : [br.x + 8, br.y + br.h / 2], len = (br.up ? br.h : br.w) * 0.6;
      await T.down(thumb);
      await T.move([thumb[0] + 1, thumb[1]], 30);
      const a0 = await T.aim();
      await T.tch('touchStart', [[thumb[0] + 1, thumb[1], 1], [st[0], st[1], 2]], 30);
      for (let i = 1; i <= 8; i++) await T.tch('touchMove', [[thumb[0] + 1, thumb[1], 1], br.up ? [st[0], st[1] + len * i / 8, 2] : [st[0] + len * i / 8, st[1], 2]], 16);
      await T.land();
      const mid = await T.page.evaluate(() => ({ pulling: felt.pulling, power: felt.power }));
      await T.up(16);
      await T.page.waitForFunction(() => !!felt.lastShot, null, { timeout: 3000 }).catch(() => {});
      const fired = await T.page.evaluate(() => ({ s: felt.state, shot: felt.lastShot }));
      check(`${tag}: a thumb resting on the ${rest}: the power bar still arms and shoots, at the aim the table had`,
        mid.pulling && mid.power > 0.1 && fired.s !== 'aim' && fired.shot && fired.shot.angle === a0, JSON.stringify({ mid, fired, a0 }));
      await T.page.waitForFunction(() => felt.state === 'aim' || felt.state === 'over', null, { timeout: 30000 });
    }

    /* 9. a pause during the auto-aim swing: on resume the cue is on the suggested line, not half way */
    const pa = await T.page.evaluate(() => {
      settings.cpu = false; settings.autoAim = true; felt.speed = 1; felt.start('8'); aimAngle = 1;
      autoAim();
      const c = felt.game.balls[0], t = felt.game.balls.find(b => b.n === felt.hint.n), want = Math.atan2(t.y - c.y, t.x - c.x);
      felt.pause();
      return { want };
    });
    await T.page.waitForTimeout(400);
    await T.page.evaluate(() => felt.resume());
    await T.page.waitForTimeout(100);
    const pr = await T.page.evaluate(() => ({ aim: felt.aim, s: felt.state }));
    check(`${tag}: a pause during the auto-aim swing: after resume the cue is on the suggested line`, pr.s === 'aim' && Math.abs(pr.aim - pa.want) < 1e-9, JSON.stringify({ pr, want: pa.want }));
    await T.page.evaluate(() => { felt.speed = 40; settings.autoAim = false; });

    check(`${tag}: no console errors`, T.errors.length === 0, T.errors.join(' | '));
    await T.browser.close();
  }
  for (const vp of [{ width: 1280, height: 800 }, { width: 956, height: 440 }]) await desk(vp);
  done();
})().catch(e => { console.error(e); process.exit(1); });
