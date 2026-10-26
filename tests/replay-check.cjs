/* replay-check: the game camera (section 3b) and the shot replay (5r). The camera maps exactly
   both ways at any zoom, never shows past the table, follows a roll and is back to the whole
   table when the next turn starts, and stays put with Camera: Fixed. A replay re-plays the shot
   byte for byte into its own table without touching game or tab, swallows every sweep, tap and
   bar pull while it plays, and a bank pot is offered as a notable replay. */
'use strict';
const { check, done, open } = require('./lib.cjs');

(async () => {
  const { browser, page, errors } = await open('', { viewport: { width: 956, height: 440 }, deviceScaleFactor: 2 });
  /* a cut on the 1 into a corner with a few balls about, not a break, auto aim off */
  const setup = () => page.evaluate(() => {
    settings.autoAim = false; felt.speed = 1;
    felt.start('8'); game.inHand = null; game.breakShot = false; game.shots = 4; state = 'aim'; hint = null;
    const at = { 0: [0.55, 0.62], 1: [1.25, 0.42], 3: [1.6, 0.75], 9: [0.9, 0.2], 8: [1.45, 0.62] };
    for (const b of game.balls) { b.on = b.n in at; if (b.on) { b.x = at[b.n][0]; b.y = at[b.n][1]; } }
    const c = game.balls[0], o = game.balls.find(b => b.n === 1), P = POCKET_AIM[2], L = Math.hypot(P[0] - o.x, P[1] - o.y);
    return Math.atan2(o.y - (P[1] - o.y) / L * 2 * BALL_R - c.y, o.x - (P[0] - o.x) / L * 2 * BALL_R - c.x);
  });
  /* the camera's zoom every frame, and its value on the frame the next turn starts */
  const watch = () => page.evaluate(() => {
    window.__cam = { max: 0, atTurn: null, steps: [] };
    let last = felt.state, z0 = felt.cam.z;
    const tick = () => {
      const z = felt.cam.z, W = window.__cam;
      W.max = Math.max(W.max, z); W.steps.push(Math.abs(z - z0)); z0 = z;
      if (last !== 'aim' && felt.state === 'aim' && W.atTurn === null) W.atTurn = z;
      last = felt.state;
      if (W.atTurn === null) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  /* 1. the transform: exact both ways, and the zoomed table covers the window it used to fill */
  const map = await page.evaluate(() => {
    felt.start('8'); state = 'aim';
    let err = 0, cover = true;
    const R = felt.camRect(), rnd = rng(7);
    for (const z of [1, 1.2, 1.35, 1.8, 2.4]) for (const c of [[0, 0], [TL / 2, TW / 2], [TL, TW], [0.3, 0.8], [TL * 0.9, 0.1]]) {
      felt.camPin(z, c[0], c[1]);
      for (let i = 0; i < 40; i++) {
        const p = [-RAIL + rnd() * (TL + 2 * RAIL), -RAIL + rnd() * (TW + 2 * RAIL)], q = felt.toTable(...felt.toScreen(p[0], p[1]));
        err = Math.max(err, Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1]));
      }
      const t = felt.tableRect();
      if (t.left > R.left + 1e-6 || t.top > R.top + 1e-6 || t.right < R.right - 1e-6 || t.bottom < R.bottom - 1e-6) cover = false;
    }
    felt.camPin(null);
    return { err, cover, z: felt.cam.z, same: felt.view === viewBase };
  });
  check('camera: toTable(toScreen(p)) == p within 1e-9 at zooms 1 to 2.4 and centres to the corners', map.err < 1e-9, String(map.err));
  check('camera: the zoomed table always covers the window it fills at z = 1 (no margin, nothing past the rails)', map.cover);
  check('camera: let go while aiming, z is exactly 1 and the view is the fitted one', map.z === 1 && map.same, JSON.stringify(map));

  /* 2. Fixed is the default (follow gave players vertigo), and a Follow saved before camV 2 is not kept */
  const def = await page.evaluate(() => ({ mode: felt.cam.mode, pressed: camOff.getAttribute('aria-pressed') }));
  check('camera: Fixed by default', def.mode === 'off' && def.pressed === 'true', JSON.stringify(def));
  /* a live shot with Follow on: the camera follows (zooms in a little, never fast) and is back to 1 when the next turn starts */
  await page.evaluate(() => camAuto.click());
  let ang = await setup();
  await watch();
  const live0 = await page.evaluate(a => felt.shoot(a, 0.62, { x: 0, y: 0.3 }), ang);
  await page.waitForFunction(() => window.__cam.atTurn !== null, null, { timeout: 30000 });
  const W = await page.evaluate(() => ({ max: window.__cam.max, atTurn: window.__cam.atTurn, step: Math.max(...window.__cam.steps), mode: felt.cam.mode }));
  check('camera follow: a roll zooms in, gently (1.05 < z <= 1.35, under 0.05 a frame)', live0 && W.mode === 'auto' && W.max > 1.05 && W.max <= 1.35 + 1e-9 && W.step < 0.05, JSON.stringify(W));
  check('camera follow: z is exactly 1 on the frame the next turn starts', W.atTurn === 1, JSON.stringify(W));
  const live = await page.evaluate(() => ({ balls: JSON.stringify(felt.lastResult.balls), game: JSON.stringify(felt.game), tab: String(tab), offer: felt.replayOffer, rec: felt.lastShot }));
  check('after the shot comes to rest the Replay pill is offered', live.offer && live.offer.shown && live.offer.label === 'Replay', JSON.stringify(live.offer));
  check('the shot record carries the balls before it, the stroke and the table', live.rec && live.rec.balls.length === 16 && typeof live.rec.angle === 'number' && live.rec.table && live.rec.kind === '8' && live.rec.ball === 0, JSON.stringify(Object.keys(live.rec || {})));

  /* 3. the replay: plays into its own table, the bar off and saying so, game and tab untouched,
     and it ends where the live roll did, byte for byte */
  const r0 = await page.evaluate(() => { felt.speed = 3; const ok = felt.replay(); return { ok, replaying: felt.replaying, lab: powerLab.textContent, badge: !replayBadge.hidden, pill: !replayBtn.hidden }; });
  await page.waitForFunction(() => felt.cam.z > 1.2, null, { timeout: 8000 }).catch(() => {});
  const mid = await page.evaluate(() => ({ z: felt.cam.z, replaying: felt.replaying }));
  check('replay: starts, the bar reads Replay, the badge shows and the pill goes', r0.ok && r0.replaying && r0.lab === 'Replay' && r0.badge && !r0.pill, JSON.stringify(r0));
  check('replay: the camera moves in close (z > 1.2, up to 1.8)', mid.replaying && mid.z > 1.2 && mid.z <= 1.8 + 1e-9, JSON.stringify(mid));
  await page.waitForFunction(() => !felt.replaying, null, { timeout: 30000 });
  const after = await page.evaluate(() => ({ balls: JSON.stringify(felt.replayResult && felt.replayResult.balls), game: JSON.stringify(felt.game), tab: String(tab), z: felt.cam.z, st: felt.state, lab: powerLab.textContent, badge: !replayBadge.hidden }));
  check('replay: ends with every ball where the live roll left it (byte for byte)', after.balls === live.balls);
  check('replay: game and tab untouched, the turn unchanged, the table back at z = 1', after.game === live.game && after.tab === live.tab && after.st === 'aim' && after.z === 1 && !after.badge && after.lab === 'Pull to shoot', JSON.stringify({ st: after.st, z: after.z, lab: after.lab }));

  /* 4. nothing gets through during a replay: a sweep across the table only ends it (the aim
     stays), and a full pull on the bar never shoots */
  const pre = await page.evaluate(() => { felt.speed = 0.5; felt.replay(); return { aim: felt.aim, shots: felt.game.shots, replaying: felt.replaying }; });
  const t = await page.evaluate(() => felt.tableRect());
  await page.mouse.move(t.left + 200, t.top + 120); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(t.left + 200 + i * 25, t.top + 120 + i * 12);
  await page.mouse.up();
  await page.waitForTimeout(100);
  const sw = await page.evaluate(() => ({ aim: felt.aim, shots: felt.game.shots, replaying: felt.replaying, st: felt.state }));
  check('replay: a sweep on the table ends it and turns nothing', pre.replaying && !sw.replaying && sw.aim === pre.aim && sw.shots === pre.shots && sw.st === 'aim', JSON.stringify({ pre, sw }));
  await page.evaluate(() => felt.replay());
  const bar = await page.evaluate(() => { const r = powerBar.getBoundingClientRect(); return { x: r.left + r.width / 2, y0: r.top + 20, y1: r.bottom - 10, shots: felt.game.shots }; });
  await page.mouse.move(bar.x, bar.y0); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(bar.x, bar.y0 + (bar.y1 - bar.y0) * i / 12);
  await page.mouse.up();
  await page.waitForTimeout(400);
  const pb = await page.evaluate(() => ({ shots: felt.game.shots, st: felt.state, replaying: felt.replaying, pulling: felt.pulling }));
  check('replay: a full pull on the power bar never shoots', pb.shots === bar.shots && pb.st === 'aim' && !pb.pulling && !pb.replaying, JSON.stringify(pb));
  const key = await page.evaluate(() => {
    felt.replay();
    const a = felt.aim;
    dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    return { aim: felt.aim === a, replaying: felt.replaying };
  });
  check('replay: a key ends it and does nothing else', key.aim && !key.replaying, JSON.stringify(key));

  /* 5. a bank pot is notable: the offer says so */
  ang = await page.evaluate(() => {
    felt.speed = 3;
    felt.start('8'); game.inHand = null; game.breakShot = false; game.shots = 4; state = 'aim'; hint = null;
    const at = { 0: [0.5, 0.5], 1: [1.0, 0.3] };
    for (const b of game.balls) { b.on = b.n in at; if (b.on) { b.x = at[b.n][0]; b.y = at[b.n][1]; } }
    const rec = { balls: game.balls, ball: 0, breakShot: false, kind: '8', g: JSON.parse(JSON.stringify(game)) };
    for (let i = 0; i < 3000; i++) {
      const a = -Math.PI + i * 2 * Math.PI / 3000, r = simulateShot(game.balls, { angle: a, power: 0.75, spin: { x: 0, y: 0 }, ball: 0 });
      if (notableOf(r, rec) === 'bank' && r.potted.includes(1) && (r.rails[1] || 0) >= 2) return a;
    }
    return null;
  });
  if (ang !== null) {
    await page.evaluate(a => felt.shoot(a, 0.75, 0), ang);
    await page.waitForFunction(() => felt.state === 'aim', null, { timeout: 20000 });
  }
  const nb = await page.evaluate(() => ({ offer: felt.replayOffer, notable: felt.lastNotable && felt.lastNotable.notable, attr: replayBtn.hasAttribute('data-notable'), h: replayBtn.offsetHeight,
    aria: replayBtn.getAttribute('aria-label'), callout: calloutText.textContent }));
  /* the callout names the moment (shotMoments); the gold pill, classified by the same call, only says Replay */
  check('a two-cushion bank pot is offered as notable: a gold Replay pill under the "Bank shot" callout, not the word twice', ang !== null && nb.offer && nb.offer.notable === 'bank' && nb.notable === 'bank' && nb.attr
    && nb.offer.label === 'Replay' && /bank/i.test(nb.aria) && nb.callout === 'Bank shot' && nb.h >= 44, JSON.stringify(nb));
  const hide = await page.evaluate(() => { const r = felt.tableRect(); return [r.left + 300, r.top + 200]; });
  await page.mouse.click(hide[0], hide[1]);
  check('the pill goes as soon as the player touches the table', !(await page.evaluate(() => felt.replayOffer)) && await page.evaluate(() => replayBtn.hidden));

  /* 6. Camera: Fixed holds z = 1 through a roll; the setting is in the Settings sheet */
  ang = await setup();
  await page.evaluate(() => { camOff.click(); felt.speed = 1; });
  await watch();
  await page.evaluate(a => felt.shoot(a, 0.62, 0), ang);
  await page.waitForFunction(() => window.__cam.atTurn !== null, null, { timeout: 30000 });
  const off = await page.evaluate(() => ({ max: window.__cam.max, mode: felt.cam.mode, saved: JSON.parse(localStorage.getItem('felt.settings')).camera, pressed: camOff.getAttribute('aria-pressed'), label: camAuto.textContent + '/' + camOff.textContent }));
  check('Camera: Fixed keeps z = 1 through a whole roll, and is remembered', off.max === 1 && off.mode === 'off' && off.saved === 'off' && off.pressed === 'true' && off.label === 'Follow/Fixed', JSON.stringify(off));
  await page.evaluate(() => camAuto.click());
  const old = await page.evaluate(() => { localStorage.setItem('felt.settings', JSON.stringify({ camera: 'auto' })); return loadSettings().camera; });
  check('camera: a Follow saved before camV 2 loads as Fixed', old === 'off', old);

  check('no console errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
