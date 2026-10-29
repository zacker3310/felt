#!/usr/bin/env node
/* settings-check: the grouped Settings sheet (a list of six groups, a page pushed per group) and
   every setting it holds doing what it says, on the page.
   1. migration: a save from sv 2 (and one with no version) keeps every value it had, takes the
      sv 3 defaults, keeps unknown keys, and is backed up once before the first sv 3 write.
   2. navigation: the list, each page pushed and popped, Esc, targets 44 px and text 4.5:1 on every
      page, at 375x667 and 440x956 (fits the width, scrolls in height), on every cloth.
   3. Gameplay: the default rules per game (built from RULESETS) start a game on them; races;
      locked by an event (rules off limits).
   4. Controls: left-handed and the power bar at the edge move the controls; a bar shot still plays.
   5. Graphics: replays off offers none; reduce motion is honoured by the page and the canvas.
   6. Audio: the master and table-sound volumes set the audio graph's gains.
   7. Accessibility: ball marks paint an upright badge (light on solids, dark on stripes); the
      high-contrast aim line is 4.5:1 or better on every cloth; text size grows the sheets and still
      fits at 375 px. (Space on the power bar is audit F7, in audit-check.) */
'use strict';
const fs = require('fs');
const { check, done, open, smallTargets, lowContrast, settled } = require('./lib.cjs');
const SHOTS = process.env.FELT_SHOTS || '';
const PAGES = [['prGame', 'Gameplay'], ['prCtl', 'Controls'], ['prGfx', 'Graphics'], ['prAud', 'Audio and Haptics'], ['prA11y', 'Accessibility'], ['prAbout', 'About']];

/* a full sv 2 save with nothing at its default */
const V2 = { guide: 'short', cpu: true, level: 'hard', sound: false, haptics: false, table: '9', pockets: 'generous', autoAim: false, cloth: 'blue', bumperTable: 'rect',
  caromRace: 15, caromCush: 1, camera: 'auto', camV: 2, names: ['Ann', 'Bo'], last: 'straight', snookerTable: 'full', snookerFrames: 3, sv: 2,
  rules8: '8-wpa', rules9: '9-wpa', rules10: '10-house', race141: 150, stalemate: true,
  calls: { mode: 'all', detail: 'rails', safety: false, eight: true, obvious: false, change: false, highlight: false, confirm: false, sound: false, warn: false, history: false },
  future: { kept: 1 } };

(async () => {
  /* ---- 1. migration ---- */
  {
    const t = await open('', { viewport: { width: 440, height: 956 }, init: `try { if (!sessionStorage.getItem('mig')) { localStorage.setItem('felt.settings', ${JSON.stringify(JSON.stringify(V2))}); localStorage.removeItem('felt.settings.bak'); sessionStorage.setItem('mig', '1'); } } catch (e) { }` });
    const s = await t.page.evaluate(() => felt.settings);
    const kept = Object.keys(V2).filter(k => k !== 'sv' && k !== 'future').filter(k => JSON.stringify(s[k]) !== JSON.stringify(V2[k]));
    check('migration: an sv 2 save keeps every value it had (none at its default), and is now sv 3', kept.length === 0 && s.sv === 3, JSON.stringify({ kept, s }));
    check('migration: the sv 3 settings take their defaults', s.hand === 'right' && s.bar === 'mid' && s.replays === true && s.reduceMotion === false && s.vol === 100 && s.volFx === 100
      && s.marks === false && s.text === 100 && s.hcAim === false && s.keyShoot === false, JSON.stringify(s));
    const bak = await t.page.evaluate(() => localStorage.getItem('felt.settings.bak'));
    check('migration: the sv 2 record is backed up as it was, before anything is written', bak === JSON.stringify(V2), bak);
    await t.page.evaluate(() => setSetting('marks', true));
    const st = await t.page.evaluate(() => JSON.parse(localStorage.getItem('felt.settings')));
    check('migration: the first write stores sv 3 with every old value, the new one, and the unknown key it found', st.sv === 3 && st.marks === true && st.future && st.future.kept === 1
      && Object.keys(V2).filter(k => k !== 'sv').every(k => JSON.stringify(st[k]) === JSON.stringify(V2[k])), JSON.stringify(st));
    await t.page.evaluate(() => { localStorage.setItem('felt.settings', JSON.stringify({ guide: 'off', cloth: 'red', sound: false })); localStorage.setItem('felt.settings.bak', 'older'); });
    await t.page.reload();
    await t.page.waitForFunction(() => window.booted === true);
    const v1 = await t.page.evaluate(() => ({ s: felt.settings, bak: localStorage.getItem('felt.settings.bak') }));
    check('migration: a save with no version keeps its values too; an existing backup is never overwritten', v1.s.guide === 'off' && v1.s.cloth === 'red' && v1.s.sound === false && v1.s.sv === 3 && v1.bak === 'older', JSON.stringify(v1));
    await t.page.evaluate(() => localStorage.setItem('felt.settings', '{"hand":"middle","bar":3,"vol":"loud","volFx":-20,"text":120,"marks":"yes","__proto__":{"polluted":1},"constructor":{"x":1}}'));
    await t.page.reload();
    await t.page.waitForFunction(() => window.booted === true);
    const bad = await t.page.evaluate(() => { setSetting('hcAim', true); return { s: felt.settings, polluted: ({}).polluted === 1, stored: localStorage.getItem('felt.settings') }; });
    check('migration: unreadable sv 3 values fall back (a volume clamps), and no prototype key is carried over', bad.s.hand === 'right' && bad.s.bar === 'mid' && bad.s.vol === 100 && bad.s.volFx === 0 && bad.s.text === 100
      && bad.s.marks === false && !bad.polluted && !/__proto__|constructor/.test(bad.stored), JSON.stringify(bad));
    /* the table view (4o): top-down by default, stored, a bad value back to top-down */
    const tv0 = await t.page.evaluate(() => felt.settings.view);
    await t.page.evaluate(() => setSetting('view', '3d'));
    await t.page.reload();
    await t.page.waitForFunction(() => window.booted === true);
    const tv1 = await t.page.evaluate(() => ({ view: felt.settings.view, stored: JSON.parse(localStorage.getItem('felt.settings')).view, pressed: tv3d.getAttribute('aria-pressed') }));
    await t.page.evaluate(() => localStorage.setItem('felt.settings', '{"sv":3,"view":"sideways","viewPitch":"steep","viewDist":99}'));
    await t.page.reload();
    await t.page.waitForFunction(() => window.booted === true);
    const tv2 = await t.page.evaluate(() => felt.settings);
    check('Table View: top-down by default, 3D stored and back after a reload, a bad value falls back (pitch default, distance clamped)', tv0 === 'top' && tv1.view === '3d' && tv1.stored === '3d' && tv1.pressed === 'true'
      && tv2.view === 'top' && tv2.viewPitch === 24 && tv2.viewDist === 3.2, JSON.stringify({ tv0, tv1, v: tv2.view, p: tv2.viewPitch, d: tv2.viewDist }));
    /* After the Shot (4o): Pull Back by default, Top Down and Stay stored and back after a reload, a bad value back to Pull Back */
    const va0 = await t.page.evaluate(() => { localStorage.removeItem('felt.settings'); return 1; });
    await t.page.reload();
    await t.page.waitForFunction(() => window.booted === true);
    const va1 = await t.page.evaluate(() => { const d = felt.settings.viewAfter; showPrefs(); prefsPage('prGfx'); const r = { d, head: vaLab.textContent, opts: [vaPull, vaTop, vaStay].map(b => b.textContent), pressed: vaPull.getAttribute('aria-pressed') }; vaTop.click(); r.top = [felt.settings.viewAfter, vaTop.getAttribute('aria-pressed'), JSON.parse(localStorage.getItem('felt.settings')).viewAfter]; return r; });
    await t.page.reload();
    await t.page.waitForFunction(() => window.booted === true);
    const va2 = await t.page.evaluate(() => { const top = felt.settings.viewAfter; setSetting('viewAfter', 'stay'); return { top, stay: JSON.parse(localStorage.getItem('felt.settings')).viewAfter }; });
    await t.page.evaluate(() => localStorage.setItem('felt.settings', '{"sv":3,"view":"3d","viewAfter":"spin"}'));
    await t.page.reload();
    await t.page.waitForFunction(() => window.booted === true);
    const va3 = await t.page.evaluate(() => felt.settings.viewAfter);
    check('After the Shot: Pull Back by default, Pull Back, Top Down or Stay in Graphics, Top Down and Stay stored and back after a reload, a bad value back to Pull Back',
      va0 === 1 && va1.d === 'pull' && va1.head === 'After the Shot' && va1.opts.join() === 'Pull Back,Top Down,Stay' && va1.pressed === 'true' && va1.top.join() === 'top,true,top' && va2.top === 'top' && va2.stay === 'stay' && va3 === 'pull', JSON.stringify({ va1, va2, va3 }));
    check('migration: no console errors', t.errors.length === 0, t.errors.join(' | '));
    await t.browser.close();
  }

  /* ---- 2. navigation, at both phone sizes and on every cloth ---- */
  for (const vp of [{ width: 375, height: 667 }, { width: 440, height: 956 }]) {
    const t = await open('', { viewport: vp, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const p = t.page;
    await p.click('#prefsBtn');
    await p.waitForTimeout(250);
    const root = await p.evaluate(() => ({ rows: [...prefsList.querySelectorAll('.topic b')].map(b => b.textContent), title: prefsTitle.textContent, pages: [...prefsSheet.querySelectorAll('.pan')].filter(x => !x.hidden).length }));
    check(`${vp.width}x${vp.height}: Settings is a list of six groups, no page open`, root.rows.join() === PAGES.map(x => x[1]).join() && root.title === 'Settings' && root.pages === 0, JSON.stringify(root));
    const bad = [];
    for (const cloth of ['green', 'red', 'blue']) {
      await p.evaluate(c => setSetting('cloth', c), cloth);
      for (const [row, name] of PAGES) {
        await p.click('#' + row);
        await p.waitForTimeout(450);
        const pg = await p.evaluate(() => {
          const s = prefsBody, open = [...prefsSheet.querySelectorAll('.pan')].filter(x => !x.hidden);
          return { title: prefsTitle.textContent, open: open.map(x => x.id), list: !prefsList.hidden, sw: s.scrollWidth, cw: s.clientWidth, sh: s.scrollHeight, ch: s.clientHeight,
            backLab: prefsBack.getAttribute('aria-label'), page: felt.prefsPage };
        });
        const small = await smallTargets(p), low = await lowContrast(p);
        if (pg.title !== name || pg.open.length !== 1 || pg.list || pg.sw > pg.cw + 1 || small.length || low.length || pg.backLab !== 'Back to Settings') bad.push({ cloth, name, pg, small, low });
        if (cloth === 'green' && SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: `${SHOTS}/${vp.width}x${vp.height}-${row.slice(2).toLowerCase()}.png` }); }
        /* a page taller than the screen scrolls to its foot */
        if (pg.sh > pg.ch) {
          const end = await p.evaluate(() => { prefsBody.scrollTop = 1e6; const last = [...prefsSheet.querySelectorAll('.pan')].find(x => !x.hidden).lastElementChild.getBoundingClientRect(); return last.bottom <= innerHeight + 1 && prefsBody.scrollTop > 0; });
          if (!end) bad.push({ cloth, name, scroll: 'the foot does not scroll into view' });
        }
        await p.click('#prefsBack');
        await p.waitForTimeout(400);
      }
    }
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/${vp.width}x${vp.height}-list.png` });
    check(`${vp.width}x${vp.height}: each of the six pages pushes with its title, fits the width (scrolls in height), targets 44 px, text 4.5:1 on green, red and blue; Back pops to the list`, bad.length === 0, JSON.stringify(bad).slice(0, 1500));
    await p.click('#prA11y');
    await p.keyboard.press('Escape');
    const esc = await p.evaluate(() => ({ menu: menu.classList.contains('show'), prefs: prefsSheet.classList.contains('show') }));
    await p.click('#prefsBtn');
    const again = await p.evaluate(() => ({ list: !prefsList.hidden, title: prefsTitle.textContent }));
    check(`${vp.width}x${vp.height}: Esc closes Settings from a page; it opens on the list again`, esc.menu && !esc.prefs && again.list && again.title === 'Settings', JSON.stringify({ esc, again }));
    /* text size Larger: the sheets grow and still fit the width */
    await p.evaluate(() => setSetting('text', 130));
    await p.click('#prGame');
    await p.waitForTimeout(300);
    const big = await p.evaluate(() => { const r = cmLab.getBoundingClientRect(); return { h: r.height, bottom: prefsBody.getBoundingClientRect().bottom, scrolls: prefsBody.scrollHeight > prefsBody.clientHeight, sw: prefsBody.scrollWidth, cw: prefsBody.clientWidth, attr: document.documentElement.dataset.text, right: Math.max(...[...prefsSheet.querySelectorAll('#ppGame .seg button')].map(b => b.getBoundingClientRect().right)) }; });
    await p.evaluate(() => setSetting('text', 100));
    const norm = await p.evaluate(() => cmLab.getBoundingClientRect().height);
    check(`${vp.width}x${vp.height}: text size Larger grows the words by about 1.3; the page still fits the screen and scrolls inside it`, big.attr === '130' && big.h / norm > 1.2 && big.sw <= big.cw + 1 && big.right <= vp.width && big.bottom <= vp.height + 1 && big.scrolls, JSON.stringify({ big, norm }));
    check(`${vp.width}x${vp.height}: no console errors`, t.errors.length === 0, t.errors.join(' | '));
    await t.browser.close();
  }

  const t = await open('', { viewport: { width: 440, height: 956 }, hasTouch: true, isMobile: true });
  const p = t.page;

  /* ---- 3. Gameplay ---- */
  await p.click('#prefsBtn');
  await p.click('#prGame');
  const rows = await p.evaluate(() => [...rulesRows.querySelectorAll('.prow .plab')].map(l => l.textContent));
  check('Gameplay: a default-rules row for each game with a choice of rulesets (8, 9 and 10-ball), then the stalemate re-rack', rows.join('|') === '8-Ball|9-Ball|10-Ball|House Re-Rack on a Stalemate (8 and 9-Ball)', JSON.stringify(rows));
  await p.click('#prs8-wpa');
  await p.click('#prs10-house');
  await p.click('#prc25');
  await p.click('#pcr5');
  const g = await p.evaluate(() => { felt.start('8'); const a = felt.game.rules.id; felt.start('10'); const b = felt.game.rules.id; felt.start('straight'); const c = felt.game.rules.race || felt.game.race; felt.start('carom'); const d = felt.game.race; felt.quitToHome(); return { a, b, c, d, pressed: document.getElementById('prs8-wpa').getAttribute('aria-pressed'), setup: rs8Wpa.getAttribute('aria-pressed') }; });
  check('Gameplay: the default rules and races chosen here start the next games on them (8-ball WPA, 10-ball obvious free, 14.1 to 25, carom to 5), the setup agreeing',
    g.a === '8-wpa' && g.b === '10-house' && g.c === 25 && g.d === 5 && g.pressed === 'true' && g.setup === 'true', JSON.stringify(g));
  await p.evaluate(() => { setSetting('rules8', '8-house'); setSetting('rules10', '10-wpa'); setSetting('race141', 50); setSetting('caromRace', 10); });
  await p.evaluate(() => { felt.start('8', { level: 'easy', table: '7', pockets: 'regulation', rules: { ruleset: '8-wpa', call: { mode: 'all' } } }); felt.pause(); });
  await p.click('#pPrefsBtn');
  await p.click('#prGame');
  const lk = await p.evaluate(() => ({ note: !lockNote.hidden, sub: prGameSub.textContent, dis: [...rulesRows.querySelectorAll('button')].every(b => b.disabled) && cmAll.disabled, free: !gFull.disabled }));
  check('Gameplay: locked by an event, the note shows, the list row says so, the rule choices are off limits (the aim guide is not)', lk.note && /Locked by event/.test(lk.sub) && lk.dis && lk.free, JSON.stringify(lk));
  await p.evaluate(() => { prefsBack.click(); prefsBack.click(); felt.quitToHome(); });

  /* ---- 4. Controls: the layout ---- */
  const rects = () => p.evaluate(() => Object.fromEntries(['powerBar', 'menuBtn', 'spinPad', 'fineWheel', 'stage', 'ctl'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return [id, { l: r.left, r: r.right, t: r.top, b: r.bottom }]; })));
  await p.evaluate(() => felt.start('8'));
  const r0 = await rects();
  await p.evaluate(() => setSetting('hand', 'left'));
  const r1 = await rects();
  check('Controls: left-handed mirrors the strip (the english at the right edge, pause at the left)', r0.spinPad.l < r0.powerBar.l && r0.menuBtn.l > r0.powerBar.l && r1.spinPad.l > r1.powerBar.l && r1.menuBtn.l < r1.powerBar.l, JSON.stringify({ r0, r1 }));
  await p.evaluate(() => setSetting('bar', 'edge'));
  const r2 = await rects();
  check('Controls: the power bar at the edge is the outermost control (left-handed: the left end)', r2.powerBar.l <= Math.min(r2.menuBtn.l, r2.spinPad.l, r2.fineWheel.l), JSON.stringify(r2));
  /* a real bar pull still shoots, mirrored */
  const bar = r2.powerBar, y = (bar.t + bar.b) / 2;
  const s0 = await p.evaluate(() => felt.game.shots);
  await p.mouse.move(bar.l + 6, y); await p.mouse.down();
  for (let i = 1; i <= 10; i++) await p.mouse.move(bar.l + 6 + i * (bar.r - bar.l - 12) / 10 * 0.5, y);
  await p.mouse.up();
  await p.waitForFunction(n => felt.game.shots > n || felt.state === 'rolling' || felt.state === 'stroke', s0, { timeout: 3000 }).catch(() => {});
  check('Controls: a pull along the mirrored bar shoots', await p.evaluate(n => felt.game.shots > n || ['stroke', 'rolling'].includes(felt.state), s0));
  await p.evaluate(() => { felt.speed = 40; });
  await settled(p);
  await p.setViewportSize({ width: 956, height: 440 });
  await p.waitForTimeout(400);
  const w1 = await rects(), tr = await p.evaluate(() => felt.tableRect());
  check('Controls: on its side, left-handed puts the column left of the table; at the edge the bar is its foot', w1.ctl.r <= w1.stage.l + 1 && tr.left >= w1.ctl.r && w1.powerBar.t > w1.fineWheel.t, JSON.stringify({ w1, tr }));
  await p.evaluate(() => { setSetting('hand', 'right'); setSetting('bar', 'mid'); });
  const w2 = await rects();
  check('Controls: back to right-handed, the column is on the right again, the bar above the wheel', w2.ctl.l >= w2.stage.r - 1 && w2.powerBar.t < w2.fineWheel.t, JSON.stringify(w2));
  await p.setViewportSize({ width: 440, height: 956 });
  await p.waitForTimeout(300);

  /* ---- 5. Graphics: replays and motion ---- */
  const offerAfter = async () => {
    await p.evaluate(() => { felt.quitToHome(); felt.start('9'); felt.speed = 40; felt.shoot(0, 0.5, 0); });
    await settled(p);
    await p.waitForTimeout(100);
    return p.evaluate(() => ({ offer: !!felt.replayOffer, shown: !replayBtn.hidden, last: !!felt.lastShot }));
  };
  await p.evaluate(() => setSetting('replays', false));
  const nr = await offerAfter();
  await p.evaluate(() => setSetting('replays', true));
  const yr = await offerAfter();
  check('Graphics: Replays Never offers no Replay pill after a shot; Offer does', !nr.offer && !nr.shown && nr.last && yr.offer && yr.shown, JSON.stringify({ nr, yr }));
  const mo = await p.evaluate(async () => {
    const before = reducedMotion();
    setSetting('reduceMotion', true);
    showMenu(); openSheet(prefsSheet, prefsBack);
    const sheet = prefsBody, dur = getComputedStyle(sheet).animationDuration;
    const both = [tgMotion.getAttribute('aria-checked'), tgMotion2.getAttribute('aria-checked')];
    const after = reducedMotion(), attr = document.documentElement.dataset.motion;
    setSetting('reduceMotion', false);
    return { before, after, attr, dur, both, off: reducedMotion() };
  });
  check('Graphics: Reduce motion makes the page (sheets come in at once) and the canvas (reducedMotion) still; both switches show it', !mo.before && mo.after && mo.attr === 'reduce' && parseFloat(mo.dur) < 0.01 && mo.both.join() === 'true,true' && !mo.off, JSON.stringify(mo));
  await p.evaluate(() => backToMenu());

  /* ---- 6. Audio: the volumes are the graph's gains ---- */
  const au = await p.evaluate(() => {
    audioOn();
    setSetting('vol', 40); setSetting('volFx', 0);
    const a = felt.audio;
    setSetting('vol', 100); setSetting('volFx', 100);
    return { a, b: felt.audio };
  });
  check('Audio: the master volume scales the bus (40% of 0.55), table sounds have their own gain (0 is silent); both back to full', Math.abs(au.a.master - 0.22) < 1e-3 && au.a.fx === 0 && Math.abs(au.b.master - 0.55) < 1e-3 && au.b.fx === 1, JSON.stringify(au));
  await p.click('#prefsBtn'); await p.click('#prAud');
  await p.waitForTimeout(500);
  const range = await p.$('#volMaster');
  const box = await range.boundingBox();
  await p.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2);
  const ui = await p.evaluate(() => ({ vol: settings.vol, lab: volMasterVal.textContent, stored: JSON.parse(localStorage.getItem('felt.settings')).vol }));
  check('Audio: the master slider sets the volume, shows it and stores it', ui.vol > 0 && ui.vol < 50 && ui.lab === ui.vol + '%' && ui.stored === ui.vol, JSON.stringify(ui));
  await p.evaluate(() => { setSetting('vol', 100); backToMenu(); });

  /* ---- 7. Accessibility: ball marks and the high-contrast aim line ---- */
  const px = (x, y) => p.evaluate(([x, y]) => { const d = table.getContext('2d').getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data; return [d[0], d[1], d[2]]; }, [x, y]);
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  /* two balls alone on the cloth: a solid (3, red) and a stripe (11, red) */
  const marks = async on => {
    await p.evaluate(on => { setSetting('marks', on); felt.quitToHome(); felt.start('8'); felt.speed = 1;
      game.balls.forEach(b => { if (b.n !== 0 && b.n !== 3 && b.n !== 11) b.on = false; });
      const b3 = game.balls.find(b => b.n === 3), b11 = game.balls.find(b => b.n === 11);
      b3.x = TL * 0.62; b3.y = TW * 0.3; b11.x = TL * 0.62; b11.y = TW * 0.7; }, on);
    await p.waitForTimeout(150);
    const at = await p.evaluate(() => [3, 11].map(n => { const b = game.balls.find(q => q.n === n), q = toScreen(b.x, b.y); return [q[0] + felt.ballPx * 0.23, q[1]]; }));
    return [await px(...at[0]), await px(...at[1])];
  };
  await p.setViewportSize({ width: 1280, height: 800 });   /* balls big enough to sample a badge beside its number */
  await p.waitForTimeout(300);
  const m0 = await marks(false), m1 = await marks(true);
  await p.setViewportSize({ width: 440, height: 956 });
  await p.waitForTimeout(300);
  check('Accessibility: ball marks put a light badge on a solid and a dark one on a stripe, told apart by lightness alone (off: neither)',
    lum(m1[0]) > 0.6 && lum(m1[1]) < 0.05 && !(lum(m0[0]) > 0.6 && lum(m0[1]) < 0.05), JSON.stringify({ m0, m1 }));
  /* the small dots wear the marks too: the turn chips, the pause menu's cards and potted row, game over */
  const dotMarks = on => p.evaluate(async on => {
    setSetting('marks', on); felt.quitToHome(); felt.start('8'); felt.speed = 1;
    game.groups = ['solids', 'stripes']; stats.potted[0] = [3]; stats.potted[1] = [11];
    for (const n of [3, 11]) game.balls.find(b => b.n === n).on = false;
    hud();
    const read = sel => [...document.querySelectorAll(sel)].filter(d => d.getClientRects().length).map(d => { const c = d.querySelector('.cb'); return c ? `${c.textContent}${c.classList.contains('d') ? 'd' : 'l'}` : '-'; });
    const chip = read('#turnChip .dot');
    pause(); await new Promise(r => setTimeout(r, 60));
    const pz = read('#gameNow .dot');
    resume(); felt.forceWin(0); await new Promise(r => setTimeout(r, 60));
    const ov = read('#over .stats .dot');
    return { chip, pz, ov };
  }, on);
  const dm0 = await dotMarks(false), dm1 = await dotMarks(true);
  const dmLow = await lowContrast(p);
  const allMarked = a => a.length > 0 && a.every(x => x !== '-');
  check('Accessibility: ball marks on the small dots too: turn chips, the pause menu and game over (solids light, stripes dark; off: none), text 4.5:1',
    allMarked(dm1.chip) && allMarked(dm1.pz) && allMarked(dm1.ov) && dm1.pz.includes('3l') && dm1.pz.includes('11d') && dm1.ov.includes('3l') && dm1.ov.includes('11d')
    && [dm0.chip, dm0.pz, dm0.ov].every(a => a.every(x => x === '-')) && !dmLow.length, JSON.stringify({ dm0, dm1, dmLow }));
  await p.evaluate(() => { felt.quitToHome(); setSetting('marks', false); });
  const aimLine = async () => {
    await p.evaluate(() => { felt.quitToHome(); felt.start('8'); game.balls.forEach(b => { if (b.n !== 0) b.on = false; }); const c = game.balls[0]; c.x = TL * 0.3; c.y = TW / 2; game.inHand = null; aimAngle = 0; aimLock = 'pending'; });
    await p.waitForTimeout(150);
    const s = await p.evaluate(() => { const c = game.balls[0], a = toScreen(c.x + 0.25, c.y), b = toScreen(c.x + 0.25, c.y + 0.06); return [a, b]; });
    const line = [];
    for (let d = -2; d <= 2; d++) line.push(await px(s[0][0] + (view.portrait ? d : 0), s[0][1] + (view.portrait ? 0 : d)));
    return { line: line.sort((x, y) => lum(y) - lum(x))[0], cloth: await px(...s[1]) };
  };
  const view = await p.evaluate(() => ({ portrait: felt.view.portrait }));
  const hc = [];
  for (const cloth of ['green', 'red', 'blue']) {
    await p.evaluate(c => { setSetting('cloth', c); setSetting('hcAim', false); }, cloth);
    const off = await aimLine();
    await p.evaluate(() => setSetting('hcAim', true));
    const on = await aimLine();
    hc.push({ cloth, off: +ratio(off.line, off.cloth).toFixed(2), on: +ratio(on.line, on.cloth).toFixed(2) });
  }
  check('Accessibility: the high-contrast aim line is 4.5:1 or better on green, red and blue, and stronger than the default line', hc.every(h => h.on >= 4.5 && h.on > h.off), JSON.stringify(hc));
  await p.evaluate(() => { setSetting('hcAim', false); setSetting('cloth', 'green'); });
  check('no console errors', t.errors.length === 0, t.errors.join(' | '));
  await t.browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
