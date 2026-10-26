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
  done();
})().catch(e => { console.error(e); process.exit(1); });
