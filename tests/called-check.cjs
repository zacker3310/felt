/* called-check (page): the called-shot system and the new games on the page. Settings >
   Gameplay persists (versioned) and a save from before it migrates; a phone at 440x956 calls by
   touch (an obvious shot from the aim, the pill's tap to change, a tap on a ball, a tap on a
   pocket, a changed call, the Safety chip); the power bar refuses to arm without a needed call and
   shoots with one, the live roll equal to simulateShot byte for byte; an event's locked rules
   beat the settings and say so; a push-out's option box; the CPU calls its shots and answers
   the options; More games opens the three new games' setups; targets and contrast hold; the call
   row (5c) stays off the table at five phone sizes with their insets, and a game that never calls keeps its old table. */
'use strict';
const { check, done, open, choose, openPop, settled, smallTargets, lowContrast } = require('./lib.cjs');

const OLD = { guide: 'short', cloth: 'red', table: '9', last: '9', camV: 2, camera: 'auto', names: ['Ann', ''] };
(async () => {
  /* ---- 1. settings: a save from before Gameplay migrates, then persists ---- */
  {
    const t = await open('', { init: `try { if (!sessionStorage.getItem('mig')) { localStorage.setItem('felt.settings', ${JSON.stringify(JSON.stringify(OLD))}); sessionStorage.setItem('mig', '1'); } } catch (e) { }` });
    const s0 = await t.page.evaluate(() => felt.settings);
    check('settings: an old save keeps its choices and takes the Gameplay defaults', s0.guide === 'short' && s0.cloth === 'red' && s0.table === '9' && s0.last === '9' && s0.names[0] === 'Ann'
      && s0.calls.mode === 'official' && s0.calls.detail === 'pocket' && s0.calls.highlight === true && s0.rules8 === '8-house' && s0.sv === 3, JSON.stringify(s0));
    await t.page.click('#prefsBtn');
    await t.page.click('#prGame');
    await choose(t.page, '#cmAll');
    await choose(t.page, '#cdRails');
    await t.page.click('#tgHighlight');
    const stored = await t.page.evaluate(() => JSON.parse(localStorage.getItem('felt.settings')));
    check('settings: Gameplay choices are stored, versioned, beside the old ones', stored.sv === 3 && stored.calls.mode === 'all' && stored.calls.detail === 'rails' && stored.calls.highlight === false && stored.guide === 'short', JSON.stringify(stored));
    await t.page.reload();
    await t.page.waitForFunction(() => window.booted === true);
    const s1 = await t.page.evaluate(() => ({ s: felt.settings, all: cmAll.getAttribute('aria-pressed'), hi: tgHighlight.getAttribute('aria-checked') }));
    check('settings: they come back on the next visit, the buttons and switches showing them', s1.s.calls.mode === 'all' && s1.s.calls.detail === 'rails' && s1.all === 'true' && s1.hi === 'false' && s1.s.guide === 'short', JSON.stringify(s1));
    await t.page.evaluate(() => localStorage.setItem('felt.settings', '{"calls":{"mode":"bogus","detail":7,"safety":"no","sound":false},"race141":33,"rules9":"8-wpa"}'));
    await t.page.reload();
    await t.page.waitForFunction(() => window.booted === true);
    const s2 = await t.page.evaluate(() => felt.settings);
    check('settings: unreadable values fall back to the defaults (another game\'s rules too)', s2.calls.mode === 'official' && s2.calls.detail === 'pocket' && s2.calls.safety === true && s2.calls.sound === false && [50, 100].includes(s2.race141) && s2.rules9 === '9-house', JSON.stringify(s2));
    check('settings: no console errors', t.errors.length === 0, t.errors.join(' | '));
    await t.browser.close();
  }

  /* ---- 2. a phone, 440x956: calling by touch ---- */
  const m = await open('', { viewport: { width: 440, height: 956 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const p = m.page, cdp = await p.context().newCDPSession(p);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const tap = async (x, y) => { await p.touchscreen.tap(x, y); await p.waitForTimeout(60); };
  const state = () => p.evaluate(() => Object.assign(felt.callState, { st: felt.state, shots: felt.game.shots, lab: powerLab.textContent, pulling: felt.pulling }));
  /* a set-up 10-ball table: the 1 straight in line with the foot corner (5), the 10 away from it */
  await p.evaluate(() => { felt.speed = 40; setSetting('rules10', '10-house'); settings.autoAim = false; felt.start('10'); });
  await p.evaluate(() => {
    const g = felt.game, A = POCKET_AIM[5], d = [A[0] - TL / 2, A[1] - TW / 2], l = Math.hypot(d[0], d[1]), u = [d[0] / l, d[1] / l];
    const b1 = [A[0] - u[0] * 0.4, A[1] - u[1] * 0.4], c = [b1[0] - u[0] * 0.55, b1[1] - u[1] * 0.55];
    for (const b of g.balls) b.on = b.n === 0 || b.n === 1 || b.n === 10;
    Object.assign(g.balls.find(b => b.n === 0), { x: c[0], y: c[1] });
    Object.assign(g.balls.find(b => b.n === 1), { x: b1[0], y: b1[1] });
    Object.assign(g.balls.find(b => b.n === 10), { x: TL * 0.3, y: TW * 0.2 });
    Object.assign(g, { breakShot: false, inHand: null, pushAvail: false });
    aimAngle = Math.atan2(u[1], u[0]);
    hud();
  });
  await p.waitForTimeout(150);
  let s = await state();
  check('touch: an obvious shot is called from the aim (house 10-ball): "Calling: 1 in top right corner, tap to change"', s.open && s.bar && s.call && s.call.ball === 1 && s.call.pocket === 5 && s.call.auto && s.ready && /Calling: 1 in (top|bottom) (left|right) corner/.test(s.text) && /tap to change/.test(s.sub), JSON.stringify(s));
  check('touch: the call bar\'s pill and chips are 44 px targets, nothing on screen under 44 px', (await smallTargets(p)).length === 0, JSON.stringify(await smallTargets(p)));
  const pill = await p.evaluate(() => { const r = callPill.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await tap(pill[0], pill[1]);
  s = await state();
  check('touch: tap the pill to change: the aim\'s call goes, "Call your shot"', !s.call && !s.ready && s.text === 'Call your shot' && s.lab === 'Call your shot', JSON.stringify(s));
  /* the bar refuses to arm */
  const bb = await p.evaluate(() => { const r = powerBar.getBoundingClientRect(); return { lo: r.left, hi: r.right, y: r.y + r.height / 2 }; });
  let armed = false;
  await touch('touchStart', bb.lo + 10, bb.y);
  for (let i = 1; i <= 6; i++) { await touch('touchMove', bb.lo + 10 + (bb.hi - bb.lo) * 0.6 * i / 6, bb.y); armed = armed || (await state()).pulling; }
  await touch('touchEnd');
  await p.waitForTimeout(150);
  s = await state();
  check('touch: with no call the power bar does not arm and nothing is shot', !armed && s.st === 'aim' && s.shots === 0, JSON.stringify(s));
  /* tap the ball, then the pocket */
  const b1s = await p.evaluate(() => { const b = felt.game.balls.find(o => o.n === 1); return felt.toScreen(b.x, b.y); });
  await tap(b1s[0], b1s[1]);
  s = await state();
  check('touch: a tap on the 1 calls it: "Calling the 1, now tap a pocket"', s.call && s.call.ball === 1 && s.call.pocket == null && /Calling the 1/.test(s.text) && /now tap a pocket/.test(s.sub) && !s.ready, JSON.stringify(s));
  const k5 = await p.evaluate(() => felt.pocketXY(5)), k2 = await p.evaluate(() => felt.pocketXY(2));
  await tap(k5[0], k5[1]);
  s = await state();
  check('touch: a tap on the foot corner calls the pocket: ready to shoot', s.call && s.call.ball === 1 && s.call.pocket === 5 && !s.call.auto && s.ready && s.lab === 'Pull to shoot' && /Calling: 1 in (top|bottom) (left|right) corner/.test(s.text), JSON.stringify(s));
  await tap(k2[0], k2[1]);
  s = await state();
  check('touch: the call can change before the shot (another pocket, its own words)', s.call && s.call.pocket === 2 && /Calling: 1 in (top|bottom) (left|right) corner/.test(s.text) && s.text !== (await p.evaluate(() => 'Calling: 1 in ' + pocketWords(5))), JSON.stringify(s));
  const sb = await p.evaluate(() => { const r = safetyBtn.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await tap(sb[0], sb[1]);
  s = await state();
  check('touch: the Safety chip declares a safety', s.call && s.call.safety && s.text === 'Safety' && s.ready && (await p.evaluate(() => safetyBtn.getAttribute('aria-pressed'))) === 'true', JSON.stringify(s));
  await tap(sb[0], sb[1]);
  await tap(k5[0], k5[1]);
  s = await state();
  check('touch: Safety off again, the call back on the 1 in the foot corner', s.call && s.call.ball === 1 && s.call.pocket === 5, JSON.stringify(s));
  /* the ring round the called ball, in the cloth's call colour, beside the aim line */
  await p.waitForTimeout(100);
  const ring = await p.evaluate(() => {
    const c = felt.game.balls.find(o => o.n === 1), q = felt.toScreen(c.x, c.y), rp = BALL_R * view.k, w = Math.max(2, rp * 0.12), r = rp + 2 + w / 2;
    const a = Math.atan2(felt.toScreen(TL / 2, 0)[1] - felt.toScreen(TL / 2, TW)[1], 1) + Math.PI / 2, out = [];
    for (const t of [0, Math.PI / 2, Math.PI, 1.5 * Math.PI]) {
      const x = Math.round((q[0] + Math.cos(a + t) * r) * dpr), y = Math.round((q[1] + Math.sin(a + t) * r) * dpr), d = table.getContext('2d').getImageData(x, y, 1, 1).data;
      out.push([d[0], d[1], d[2]]);
    }
    return { out, want: CL.call };
  });
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), want = hex(ring.want);
  check('touch: the called ball wears a ring in the call colour (highlight on)', ring.out.filter(c => c.every((v, i) => Math.abs(v - want[i]) < 40)).length >= 2, JSON.stringify(ring));
  check('touch: contrast on the call bar holds (4.5:1 text)', (await lowContrast(p)).length === 0, JSON.stringify(await lowContrast(p)));
  /* shoot it through the bar: the call goes with the shot, the roll is simulateShot's */
  await p.evaluate(() => { aimAngle = Math.atan2(felt.game.balls.find(b => b.n === 1).y - felt.game.balls[0].y, felt.game.balls.find(b => b.n === 1).x - felt.game.balls[0].x); });
  await touch('touchStart', bb.lo + 10, bb.y);
  for (let i = 1; i <= 6; i++) await touch('touchMove', bb.lo + 10 + (bb.hi - bb.lo) * 0.45 * i / 6, bb.y);
  await touch('touchEnd');
  await settled(p);
  const shot = await p.evaluate(() => {
    const r = felt.lastResult, sh = felt.lastShot, want = simulateShot(sh.balls, { angle: sh.angle, power: sh.power, spin: sh.spin });
    return { same: JSON.stringify(r) === JSON.stringify(want), calls: felt.game.calls, v: felt.game.verdict.call, shots: felt.game.shots, potted: felt.game.verdict.potted };
  });
  check('bar: the shot carries the call and is judged on it', shot.shots === 1 && shot.calls.length === 1 && shot.calls[0].ball === 1 && shot.calls[0].pocket === 5 && shot.v.need && shot.v.made === shot.potted.includes(1), JSON.stringify(shot));
  check('bar: the live roll with a call equals simulateShot byte for byte (rail log and all)', shot.same);
  check('touch: no console errors', m.errors.length === 0, m.errors.join(' | '));

  /* ---- 3. a push-out and its option box (9-ball WPA, two players) ---- */
  await p.evaluate(() => { setSetting('rules9', '9-wpa'); felt.start('9'); });
  await p.evaluate(() => felt.shoot(0, 1, { x: 0, y: -0.2 }));
  await settled(p);
  await p.evaluate(() => { if (felt.game.option) felt.choose('take'); });
  const po = await p.evaluate(() => ({ push: !pushBtn.hidden, avail: felt.game.pushAvail, st: felt.state, w: felt.game.winner }));
  if (po.w === null && po.avail) {
    const pb = await p.evaluate(() => { const r = pushBtn.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    await tap(pb[0], pb[1]);
    const pusher = await p.evaluate(() => felt.game.turn);
    const ps = await state();
    check('push: the Push out chip shows after the break and declares one', po.push && ps.call && ps.call.push && ps.ready, JSON.stringify({ po, ps }));
    await p.evaluate(() => felt.shoot(Math.PI, 0.15, 0));
    await settled(p);
    const ob = await p.evaluate(() => ({ st: felt.state, box: !optBox.hidden, btns: [...optBtns.children].map(b => b.textContent), opt: felt.game.option, foul: felt.game.verdict.foul }));
    if (!ob.foul) {
      check('push: the opponent gets the option box: shoot it, or hand it back', ob.st === 'choose' && ob.box && ob.btns.join() === 'Shoot It,Hand It Back' && ob.opt.who === 1 - pusher, JSON.stringify(ob));
      check('push: the option box keeps 44 px targets', (await smallTargets(p)).length === 0);
      const hb = await p.evaluate(() => { const r = optBtns.children[1].getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
      await tap(hb[0], hb[1]);
      const after = await p.evaluate(() => ({ st: felt.state, turn: felt.game.turn, box: !optBox.hidden }));
      check('push: hand it back: the pusher shoots again', after.st === 'aim' && after.turn === pusher && !after.box, JSON.stringify(after));
    } else check('push: (the push-out scratched: a foul, no option)', ob.st === 'aim');
  } else check('push: (the break ended the rack or kept the turn without a push)', true);

  /* ---- 4. an event's locked rules beat the settings ---- */
  await p.evaluate(() => { setSetting('calls.mode', 'off'); felt.start('10'); });
  const off = await p.evaluate(() => ({ need: callNeed(Object.assign({}, felt.game, { breakShot: false })), mode: felt.game.rules.call.mode, locked: felt.game.rules.locked }));
  check('locked: with Called shots off, a quick 10-ball game calls nothing', off.need === null && off.mode === 'off' && !off.locked, JSON.stringify(off));
  await p.evaluate(() => felt.start('10', { level: 'easy', table: '7', pockets: 'regulation', rules: { ruleset: '10-wpa', call: { mode: 'all', detail: 'ball', safety: false } } }));
  const ev = await p.evaluate(() => ({ r: felt.game.rules, need: callNeed(Object.assign({}, felt.game, { breakShot: false })) }));
  check('locked: an event\'s rules (passed to start) override the settings', ev.r.locked && ev.r.call.mode === 'all' && ev.r.call.detail === 'ball' && ev.r.id === '10-wpa' && ev.need && ev.need.pocket === false, JSON.stringify(ev));
  await p.evaluate(() => felt.pause());
  await p.click('#pPrefsBtn');
  await p.click('#prGame');
  const lk = await p.evaluate(() => ({ note: !lockNote.hidden, text: lockNote.textContent, dis: cmAll.disabled && cdPocket.disabled && tgSafety.disabled, free: !tgSound.disabled, state: felt.callState.locked }));
  check('locked: Settings shows "Locked by event" and the rule choices are off limits (presentation ones are not)', lk.note && /Locked by event/.test(lk.text) && lk.dis && lk.free && lk.state, JSON.stringify(lk));
  await p.evaluate(() => cmOfficial.click());
  check('locked: a click on a locked choice changes nothing', (await p.evaluate(() => felt.game.rules.call.mode)) === 'all');
  await p.evaluate(() => { setSetting('calls.mode', 'official'); });
  check('locked: nor does changing the setting itself', (await p.evaluate(() => felt.game.rules.call.mode)) === 'all');
  await p.evaluate(() => { document.getElementById('prefsBack').click(); felt.resume && felt.resume(); });

  /* ---- 5. the CPU calls its shots and answers options (10-ball, the CPU breaking) ---- */
  await p.evaluate(() => { setSetting('rules10', '10-wpa'); felt.speed = 60; felt.start('10', { level: 'easy', table: '7', pockets: 'regulation', breaker: 1, rules: { ruleset: '10-wpa' } }); });
  /* the player hands the table straight back (a declared safety, softly at the ball on) until the CPU has called a few */
  let cpu = null;
  for (let i = 0; i < 12; i++) {
    await p.waitForFunction(() => felt.game.winner !== null || (felt.game.turn === 0 && ['aim', 'choose'].includes(felt.state)), null, { timeout: 120000 });
    cpu = await p.evaluate(() => ({ calls: felt.game.calls.filter(c => c.p === 1), all: felt.game.calls.length, shots: felt.game.shots, st: felt.state, w: felt.game.winner }));
    if (cpu.w !== null || cpu.calls.length >= 3) break;
    await p.evaluate(() => {
      if (felt.state === 'choose') { felt.choose(felt.game.option.choices[0]); return; }
      const g = felt.game, c = g.balls[0], t = g.balls.find(b => b.n === legalTargets(g)[0]);
      felt.setCall({ safety: true });
      felt.shoot(Math.atan2(t.y - c.y, t.x - c.x), 0.12, 0);
    });
    await settled(p);
  }
  check('CPU: it calls every shot it plays (ball and pocket, or a safety or push), and plays on', cpu.calls.length >= 3 && cpu.calls.every(c => c.safety || c.push || (c.ball != null && c.pocket != null)) || (cpu.w !== null && cpu.calls.every(c => c.safety || c.push || c.ball != null)), JSON.stringify(cpu));
  const opt = await p.evaluate(() => felt.game.calls.filter(c => c.p === 0).every(c => c.safety));
  check('CPU: the player\'s declared safeties are on the record too', opt);

  /* ---- 6. the three newer games: their cards on home, their setups, and their rules notes ---- */
  await p.evaluate(() => felt.quitToHome());
  const ms = await p.evaluate(() => ({ home: menu.classList.contains('show'), tiles: [play10, playStr, playRot].map(b => b.parentElement === playRow && b.getClientRects().length ? b.dataset.kind : null) }));
  check('more: 10-ball, straight pool and rotation are cards on home with the other games', ms.home && ms.tiles.join() === '10,straight,rotation', JSON.stringify(ms));
  await p.click('#playStr');
  const st = await p.evaluate(() => ({ title: setupTitle.textContent, race: !document.querySelector('#setupSheet .str').hidden, note: rulesPopSrc.textContent + ' ' + rulesPopBody.textContent, info: !!rulesInfo }));
  check('more: straight pool\'s setup has the race, and its (i) the WPA 14.1 rules', st.title === 'Straight Pool' && st.race && st.info && /14\.1/.test(st.note) && /WPA/.test(st.note), JSON.stringify(st));
  await choose(p, '#rc25');
  await p.click('#breakBtn');
  const sp = await p.evaluate(() => ({ kind: felt.game.kind, race: felt.game.race, n: felt.game.balls.filter(b => b.on).length, last: settings.last }));
  check('more: Break starts 14.1 to the race chosen; Play again remembers it', sp.kind === 'straight' && sp.race === 25 && sp.n === 16 && sp.last === 'straight', JSON.stringify(sp));
  check('no console errors', m.errors.length === 0, m.errors.join(' | '));
  await m.browser.close();

  /* ---- 7. the call row: never over the table. A game that can call (9-ball WPA with every shot called, 8-ball WPA)
     reserves a row of its own for the whole game (upright between the table and the strip, on its side a band over
     the table): every call control off the table's footprint (rails included), inside the safe area and clear of a
     modelled 62 pt display corner on a phone with a home indicator; the table the same on a turn that needs a call, one
     that does not and the CPU's; a game that never calls laid out exactly as before the row (9cc059b's rects) ---- */
  {
    const SIZES = { '440x956': [62, 0, 34, 0], '393x852': [59, 0, 34, 0], '375x667': [20, 0, 0, 0], '956x440': [0, 62, 21, 62], '844x390': [0, 47, 21, 47] };
    /* felt.tableRect() before the call row (build 9cc059b), 7 ft, regulation pockets, the default (house) rules */
    const BASE = { '440x956': [2, 62.81, 438, 861.19], '393x852': [2, 45.65, 391, 758], '375x667': [23.4, 2, 351.6, 603], '956x440': [25.62, 2, 824, 438], '844x390': [15.14, 2, 722, 388] };
    const BASE_SNK = { '440x956': [2, 39.34, 438, 862], '393x852': [4.05, 34.58, 388.95, 758], '375x667': [26.54, 2, 348.46, 603], '956x440': [36.2, 6.34, 842, 433.66], '844x390': [22.6, 2.81, 745, 387.19] };
    const t = await open('', { viewport: { width: 440, height: 956 }, hasTouch: true, isMobile: true });
    const q = t.page, rows = [], plain = [], costs = [];
    for (const [key, ins] of Object.entries(SIZES)) {
      const [w, h] = key.split('x').map(Number);
      await q.setViewportSize({ width: w, height: h });
      await q.evaluate(i => {
        let st = document.getElementById('insets');
        if (!st) { st = document.createElement('style'); st.id = 'insets'; document.head.appendChild(st); }
        st.textContent = `html:root { --sat: ${i[0]}px; --sar: ${i[1]}px; --sab: ${i[2]}px; --sal: ${i[3]}px; }`;
      }, ins);
      /* the games that never call: 8- and 9-ball house rules (official calls) and snooker, rects as before */
      plain.push(await q.evaluate(([key, B, S]) => {
        setSetting('calls.mode', 'official'); setSetting('calls.detail', 'pocket'); setSetting('rules8', '8-house'); setSetting('rules9', '9-house');
        const out = { key };
        for (const g of ['8', '9', 'snooker']) {
          felt.start(g, { level: 'easy', table: '7', pockets: 'regulation' }); relayout();
          const r = felt.tableRect(), want = g === 'snooker' ? S : B;
          out[g] = { row: 'callrow' in document.documentElement.dataset, same: [r.left, r.top, r.right, r.bottom].every((v, j) => Math.abs(v - want[j]) < 0.05), r: [r.left, r.top, r.right, r.bottom].map(v => +v.toFixed(2)) };
        }
        out.ok = ['8', '9', 'snooker'].every(g => !out[g].row && out[g].same);
        return out;
      }, [key, BASE[key], BASE_SNK[key]]));
      for (const game of ['9 called', '8 calls', '8 rails']) {
        rows.push(await q.evaluate(async ([key, ins, game, B]) => {
          if (game === '9 called') { setSetting('calls.mode', 'all'); setSetting('calls.detail', 'pocket'); setSetting('rules9', '9-wpa'); }
          else { setSetting('calls.mode', 'official'); setSetting('calls.detail', game === '8 rails' ? 'rails' : 'pocket'); setSetting('rules8', '8-wpa'); }
          const kind = game[0];
          felt.start(kind, { level: 'easy', table: '7', pockets: 'regulation' }); relayout();
          const g = felt.game, tr = () => { const r = felt.tableRect(); return [r.left, r.top, r.right, r.bottom].map(v => +v.toFixed(2)); };
          const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
          /* a turn that needs a call (and, in 9-ball, offers the push-out) */
          Object.assign(g, { breakShot: false, inHand: null, pushAvail: kind === '9', turn: 0 });
          hud(); await frame();
          const need = { t: tr(), bar: !callBar.hidden, open: felt.callState.open };
          const cs = getComputedStyle(document.documentElement), px = v => parseFloat(cs.getPropertyValue(v)) || 0;
          const safe = { l: px('--sal'), r: innerWidth - px('--sar'), t: px('--sat'), b: innerHeight - px('--sab') };
          const T = felt.tableRect(), bar = callBar.getBoundingClientRect(), R = 62, home = px('--sab') > 0;
          const inGlass = (x, y) => { const cx = Math.min(Math.max(x, R), innerWidth - R), cy = Math.min(Math.max(y, R), innerHeight - R); return Math.hypot(x - cx, y - cy) <= R; };
          const ctrls = [callPill, flagBank, flagKick, flagCombo, safetyBtn, pushBtn].filter(e => e.getClientRects().length).map(e => {
            const a = e.getBoundingClientRect(), br = parseFloat(getComputedStyle(e).borderTopLeftRadius) || 0, k = Math.min(br, a.height / 2) * (1 - Math.SQRT1_2);
            /* what shows of it: the row clips a crowded line (it scrolls) */
            const v = { left: Math.max(a.left, bar.left), right: Math.min(a.right, bar.right), top: a.top, bottom: a.bottom };
            const shown = v.right - v.left > 0.5;
            const offTable = !shown || v.right <= T.left + 0.5 || v.left >= T.right - 0.5 || v.bottom <= T.top + 0.5 || v.top >= T.bottom - 0.5;
            const inSafe = !shown || (v.left >= safe.l - 0.5 && v.right <= safe.r + 0.5 && v.top >= safe.t - 0.5 && v.bottom <= safe.b + 0.5);
            const glass = !shown || !home || [[v.left + k, v.top + k], [v.right - k, v.top + k], [v.left + k, v.bottom - k], [v.right - k, v.bottom - k]].every(([x, y]) => inGlass(x, y));
            return { id: e.id, r: [a.left, a.top, a.right, a.bottom].map(Math.round), offTable, inSafe, glass, big: a.height >= 44 && a.width >= 44 };
          });
          /* a turn that needs none (a break), then the CPU's turn: the row stays, the table does not move */
          Object.assign(g, { breakShot: true, pushAvail: false }); hud(); await frame();
          const none = { t: tr(), bar: !callBar.hidden };
          Object.assign(g, { breakShot: false, turn: 1 }); hud(); await frame();
          const cpu = { t: tr(), bar: !callBar.hidden };
          Object.assign(g, { turn: 0 }); hud();
          const still = JSON.stringify(need.t) === JSON.stringify(none.t) && JSON.stringify(need.t) === JSON.stringify(cpu.t);
          const ok = need.bar && need.open && ctrls.length >= 2 && ctrls.every(c => c.offTable && c.inSafe && c.glass && c.big)
            && (game !== '9 called' || ctrls.some(c => c.id === 'pushBtn')) && (game !== '8 rails' || ctrls.some(c => c.id === 'flagBank'));
          return { key, game, ok, still, row: 'callrow' in document.documentElement.dataset, ball: +felt.ballPx.toFixed(2), table: need.t, bar: [bar.left, bar.top, bar.right, bar.bottom].map(Math.round), none: none.bar, cpu: cpu.bar, ctrls: ctrls.filter(c => !(c.offTable && c.inSafe && c.glass && c.big)) };
        }, [key, ins, game, BASE[key]]));
      }
      costs.push(`${key} ${await q.evaluate(() => { setSetting('rules8', '8-house'); felt.start('8', { level: 'easy', table: '7', pockets: 'regulation' }); relayout(); return +felt.ballPx.toFixed(2); })} -> ${rows[rows.length - 3].ball}`);
    }
    console.log('call row, ball px (no calls -> 9-ball called, 7 ft): ' + costs.join(', '));
    check('call row: in a called-shot 9-ball game and in 8-ball with calls (house and custom detail), at 440x956, 393x852, 375x667, 956x440 and 844x390 with their insets, every call control is off the table\'s footprint (rails included), inside the safe area, clear of a 62 pt display corner on a home-indicator phone, and a 44 pt target',
      rows.every(r => r.ok && r.row), JSON.stringify(rows.filter(r => !(r.ok && r.row))));
    check('call row: the table does not move between a turn that needs a call, one that does not (the bar hidden) and the CPU\'s turn',
      rows.every(r => r.still && !r.none && !r.cpu), JSON.stringify(rows.filter(r => !(r.still && !r.none && !r.cpu)).map(r => ({ key: r.key, game: r.game, still: r.still, none: r.none, cpu: r.cpu }))));
    check('call row: a game that never calls (8- and 9-ball house rules, snooker) reserves no row and lays out exactly as before it (the same table rect at every size)',
      plain.every(p => p.ok), JSON.stringify(plain.filter(p => !p.ok)));
    /* turning calls on mid-game (pause menu > Settings) reserves the row at once, so the bar is never hidden when needed */
    const mid = await q.evaluate(() => {
      setSetting('calls.mode', 'official'); setSetting('rules9', '9-house');
      felt.start('9', { level: 'easy', table: '7', pockets: 'regulation' });
      Object.assign(felt.game, { breakShot: false, inHand: null, turn: 0 }); hud();
      const before = 'callrow' in document.documentElement.dataset;
      setSetting('calls.mode', 'all'); hud(); hudCall();
      const r = { before, after: 'callrow' in document.documentElement.dataset, bar: !callBar.hidden };
      setSetting('calls.mode', 'official'); hud();
      r.back = 'callrow' in document.documentElement.dataset;
      return r;
    });
    check('call row: Called Shots turned on mid-game reserves the row (the bar shows), and off again gives it back', !mid.before && mid.after && mid.bar && !mid.back, JSON.stringify(mid));
    check('call row: no console errors', t.errors.length === 0, t.errors.join(' | '));
    await t.browser.close();
  }
  done();
})().catch(e => { console.error(e); process.exit(1); });
