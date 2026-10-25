/* boot-check: the page boots with no console errors and no network beyond itself, opens on
   the menu, starts both games, keeps every target at least 44 px and every text at 4.5:1, and
   on a phone fills the width with the table, keeps the controls off it and never scrolls
   sideways. The game screen is the table and the controls: no player cards, no status text, no
   tray; a turn chip (32 px or less) says whose turn it is, and the pause menu holds the rest.
   Ball size is the target metric: measured at each listed viewport (iOS insets simulated with
   --sat/--sar/--sab/--sal, which headless env() leaves at 0) against the sizes before the
   maximised layout. */
'use strict';
const { check, done, open, smallTargets, lowContrast } = require('./lib.cjs');

(async () => {
  const { browser, page, errors, requests } = await open();
  await page.waitForTimeout(300);

  const origin = new URL(page.url()).origin;
  const foreign = requests.filter(u => !u.startsWith(origin) && !u.startsWith('data:'));
  check('no network requests beyond the page origin', foreign.length === 0, foreign.join(' '));
  check('opens on the menu', await page.evaluate(() => felt.state === 'menu' && getComputedStyle(menu).display !== 'none'));
  check('menu targets are at least 44 px', (await smallTargets(page)).length === 0, JSON.stringify(await smallTargets(page)));
  /* the Pockets control in the Table section: two 44 px choices, regulation pressed by default */
  const pk = await page.evaluate(() => [pkReg, pkGen].map(b => { const r = b.getBoundingClientRect(); return { t: b.textContent, w: r.width, h: r.height, p: b.getAttribute('aria-pressed') }; }));
  check('menu: Pockets, Regulation / Generous, 44 px each, regulation by default', pk[0].t === 'Regulation' && pk[1].t === 'Generous' && pk.every(b => b.w >= 44 && b.h >= 44)
    && pk[0].p === 'true' && pk[1].p === 'false' && await page.evaluate(() => felt.pockets === 'regulation'), JSON.stringify(pk));
  await page.click('#how summary');
  check('menu text is 4.5:1 or better, how-to open', (await lowContrast(page)).length === 0, JSON.stringify(await lowContrast(page)));

  await page.click('#play8');
  await page.waitForTimeout(200);
  const e = await page.evaluate(() => ({ s: felt.state, hand: felt.game.inHand, kind: felt.game.kind, balls: felt.game.balls.length, menu: getComputedStyle(menu).display }));
  check('8-ball starts: 16 balls, cue ball in hand in the kitchen', e.kind === '8' && e.balls === 16 && e.s === 'aim' && e.hand === 'kitchen' && e.menu === 'none', JSON.stringify(e));
  check('game targets are at least 44 px', (await smallTargets(page)).length === 0, JSON.stringify(await smallTargets(page)));
  check('game text is 4.5:1 or better', (await lowContrast(page)).length === 0, JSON.stringify(await lowContrast(page)));
  const lit = await page.evaluate(() => {
    const c = document.getElementById('table'), d = c.getContext('2d').getImageData(c.width / 2, c.height / 2, 1, 1).data;
    return d[3] === 255 && d[0] + d[1] + d[2] > 30;
  });
  check('the table is drawn', lit);
  check('the power bar is empty while idle', await page.evaluate(() => powerFill.getBoundingClientRect().width * powerFill.getBoundingClientRect().height < 1));

  await page.click('#menuBtn');
  await page.click('#vsCpu');
  await page.click('#play9');
  await page.waitForTimeout(200);
  const n = await page.evaluate(() => ({ kind: felt.game.kind, balls: felt.game.balls.length, cpu: felt.cpu }));
  check('9-ball vs CPU starts with 10 balls', n.kind === '9' && n.balls === 10 && n.cpu === true, JSON.stringify(n));

  /* phone portrait: the layout the spec cares most about */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const sc = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth }));
  check('no horizontal scroll at 390 px', sc.sw <= sc.w, JSON.stringify(sc));
  const ph = await page.evaluate(() => {
    const t = felt.tableRect(), c = ctl.getBoundingClientRect(), h = stage.getBoundingClientRect();
    return { w: t.right - t.left, vw: innerWidth, layout: document.documentElement.dataset.layout, portrait: felt.view.portrait, gapBelow: c.top - t.bottom, gapAbove: t.top - h.top, inside: t.left >= -0.01 && t.right <= innerWidth + 0.01 };
  });
  check('phone portrait: the table is at least 97% of the viewport width', ph.w >= 0.97 * ph.vw && ph.portrait && ph.layout === 'portrait' && ph.inside, JSON.stringify(ph));
  check('phone portrait: the controls below never overlap the table, which stays inside its stage', ph.gapBelow >= 0 && ph.gapAbove >= 0, JSON.stringify(ph));
  check('phone targets are at least 44 px', (await smallTargets(page)).length === 0, JSON.stringify(await smallTargets(page)));
  check('phone text is 4.5:1 or better', (await lowContrast(page)).length === 0, JSON.stringify(await lowContrast(page)));
  /* AC1 (T2.2): on the default 7 ft table a ball is at least 17 px across at 390x844 */
  const bp = await page.evaluate(() => ({ px: +felt.ballPx.toFixed(2), table: felt.table, def: felt.settings.table, TL, rail: RAIL }));
  check('AC1 phone portrait: a ball is at least 17 px across on the default 7 ft table', bp.def === '7' && bp.table === '7' && bp.px >= 17 && bp.rail >= 0.1, JSON.stringify(bp));

  /* phone landscape: the table is as big as the height allows, controls to the side */
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(300);
  const ls = await page.evaluate(() => {
    const t = felt.tableRect(), c = ctl.getBoundingClientRect();
    return { h: t.bottom - t.top, vh: innerHeight, overlap: c.left < t.right, sw: document.documentElement.scrollWidth, w: innerWidth };
  });
  check('phone landscape: the table takes most of the height, controls beside it', ls.h >= 0.8 * ls.vh && !ls.overlap && ls.sw <= ls.w, JSON.stringify(ls));

  /* the game screen is the table and the controls: no player cards, no status text, no tray
     band; #msg stays for screen readers (visually hidden, still a polite live region). The turn
     chip shows the active player, 32 px tall or less, and pulses while the CPU thinks. */
  const clean = [];
  for (const [w, h] of [[390, 844], [844, 390], [1280, 800]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(150);
    clean.push(await page.evaluate(() => {
      const seen = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('.overlay:not(.show)'); };
      const text = [...document.querySelectorAll('#ui *')].filter(el => seen(el) && el.id !== 'banner' && !el.closest('#banner') && !el.closest('#powerBar') && !el.closest('#turnChip')
        && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())).map(el => el.id || el.className);
      const m = msg.getBoundingClientRect(), chip = turnChip.getBoundingClientRect();
      return { size: innerWidth + 'x' + innerHeight, cards: ['p0', 'p1'].filter(id => seen(document.getElementById(id))), text, tray: felt.view.tray, band: !!document.getElementById('trayBand'),
        msg: { w: m.width, h: m.height, live: msg.getAttribute('aria-live'), role: msg.getAttribute('role') }, chip: { h: chip.height, shown: seen(turnChip), name: chipName.textContent } };
    }));
  }
  check('game screen: no player cards, no status text, no tray (view.tray null, no band)', clean.every(c => !c.cards.length && !c.text.length && c.tray === null && !c.band), JSON.stringify(clean));
  check('the status line stays for screen readers: visually hidden, role status, aria-live polite', clean.every(c => c.msg.w <= 1 && c.msg.h <= 1 && c.msg.live === 'polite' && c.msg.role === 'status'), JSON.stringify(clean.map(c => c.msg)));
  check('the turn chip shows the active player and is 32 px tall or less', clean.every(c => c.chip.shown && c.chip.h <= 32 && c.chip.name === 'You'), JSON.stringify(clean.map(c => c.chip)));

  /* every layout: nothing overlaps the table (hud, pause, english, power bar, fine-aim wheel),
     every control is on screen and at least 44 px, no sideways scroll, the rail is 0.10 m or
     more (the pockets need it), the power bar is the biggest control */
  const lays = [];
  for (const [w, h] of [[390, 844], [375, 667], [430, 932], [844, 390], [1280, 800], [1920, 1080]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(150);
    lays.push(await page.evaluate(() => {
      const t = felt.tableRect(), R = el => el.getBoundingClientRect(), hit = (a, b) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
      const els = { chip: R(turnChip), menu: R(menuBtn), pad: R(spinPad), bar: R(powerBar), wheel: R(fineWheel), ctl: R(ctl), banner: R(stage) };
      const over = Object.keys(els).filter(k => k !== 'banner' && hit(els[k], t));
      const out = Object.keys(els).filter(k => els[k].left < -0.5 || els[k].top < -0.5 || els[k].right > innerWidth + 0.5 || els[k].bottom > innerHeight + 0.5);
      const small = ['menu', 'pad', 'bar', 'wheel'].filter(k => Math.min(els[k].width, els[k].height) < 44);
      const area = k => els[k].width * els[k].height, barBig = ['menu', 'pad', 'wheel'].every(k => area('bar') > area(k));
      return { size: innerWidth + 'x' + innerHeight, ball: +felt.ballPx.toFixed(1), over, out, small, barBig, rail: RAIL, scroll: document.documentElement.scrollWidth > innerWidth };
    }));
  }
  check('every layout: nothing overlaps the table, controls on screen and 44 px, no sideways scroll, rail 0.10 m or more, the bar the biggest control',
    lays.every(l => !l.over.length && !l.out.length && !l.small.length && !l.scroll && l.rail >= 0.1 - 1e-9 && l.barBig), JSON.stringify(lays));
  console.log('ball px: ' + lays.map(l => l.size + ' ' + l.ball).join(', '));

  /* the pause menu holds the game: both cards (name, turn marker, group and its balls, or the
     ball on and fouls in 9-ball), the potted balls in pot order and the latest status line, at
     the top, then Resume as the primary button. Checked at 844x390 (dots wrap inside the cards,
     nothing clipped) and at 390x844. */
  for (const [w, h] of [[844, 390], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => {
      settings.cpu = false; felt.start('8'); game.groups = ['solids', 'stripes']; game.open = false;
      for (const n of [1, 9, 3]) game.balls.find(b => b.n === n).on = false;
      stats.potted = [[1, 3], [9]]; msg.textContent = 'Player 1 to shoot.'; hud();
    });
    await page.click('#menuBtn');
    await page.waitForTimeout(100);
    const pm = await page.evaluate(() => {
      const R = el => el.getBoundingClientRect(), sec = R(gameNow), res = R(resumeBtn);
      const cards = [0, 1].map(p => {
        const card = R(document.getElementById('p' + p)), dots = [...document.querySelectorAll(`#p${p}dots .dot`)].map(R);
        return { name: document.getElementById('p' + p + 'name').textContent, meta: document.getElementById('p' + p + 'meta').textContent, on: document.getElementById('p' + p).classList.contains('on'), n: dots.length,
          inside: dots.every(d => d.left >= card.left && d.right <= card.right && d.top >= card.top && d.bottom <= card.bottom), h: card.height };
      });
      return { size: innerWidth + 'x' + innerHeight, shown: !gameNow.hidden && sec.height > 0, cards, potted: [...potDots.querySelectorAll('.dot')].map(d => d.title), say: menuMsg.textContent,
        first: sec.top < res.top && res.top < R(document.querySelector('#menu .brand')).top, primary: resumeBtn.classList.contains('big') };
    });
    check(`pause menu at ${w}x${h}: both cards (active marker, group, remaining dots inside), the potted balls in order, the status line, then Resume`,
      pm.shown && pm.first && pm.primary && pm.cards[0].on && !pm.cards[1].on && pm.cards[0].meta === 'Solids' && pm.cards[1].meta === 'Stripes' && pm.cards[0].n === 5 && pm.cards[1].n === 6
      && pm.cards.every(c => c.inside) && pm.potted.join() === '1,3,9' && pm.say === 'Player 1 to shoot.', JSON.stringify(pm));
    check(`pause menu at ${w}x${h}: targets 44 px, text 4.5:1`, (await smallTargets(page)).length === 0 && (await lowContrast(page)).length === 0, JSON.stringify([await smallTargets(page), await lowContrast(page)]));
    const dk = await page.evaluate(() => {
      const rgba = c => { const m = c.match(/[\d.]+/g).map(Number); return [m[0], m[1], m[2], m.length > 3 ? m[3] : 1]; };
      const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
      const cr = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
      return [...document.querySelectorAll('#gameNow .dot')].map(d => {
        const bg = rgba(getComputedStyle(d.closest('.pc') || document.querySelector('#menu .sheet')).backgroundColor);
        const cs = getComputedStyle(d), ball = rgba(cs.backgroundColor), ring = cs.boxShadow.match(/rgb\([^)]*\)(?= 0px 0px 0px 1\.5px)/);
        return { n: d.title, r: +Math.max(d.classList.contains('stripe') ? 99 : cr(ball, bg), ring ? cr(rgba(ring[0]), bg) : 0).toFixed(2) };
      });
    });
    check(`pause menu at ${w}x${h}: every ball dot reads at 3:1 (dark ones by their ring)`, dk.length >= 14 && dk.every(d => d.r >= 3), JSON.stringify(dk.filter(d => d.r < 3)));
    await page.click('#resumeBtn');
  }
  const gone = await page.evaluate(() => ({ s: felt.state, hidden: gameNow.hidden }));
  check('resume hides the menu and its game section', gone.s !== 'menu' && gone.hidden, JSON.stringify(gone));

  /* the ball, the target metric: at least 20 px across at 956x440 with the iOS insets, and never
     smaller than before the maximised layout at any listed viewport */
  const BEFORE = { '440x956 ios': 18.13, '956x440 ios': 17.19, '390x844': 17.4, '440x956': 20.33, '844x390': 17.08, '1280x800': 30.29, '375x667': 12.76, '768x1024': 23.37 };
  const INSETS = { '440x956 ios': [62, 0, 34, 0], '956x440 ios': [0, 62, 21, 62] };
  const sizes = {};
  for (const key of Object.keys(BEFORE)) {
    const [w, h] = key.split(' ')[0].split('x').map(Number), ins = INSETS[key] || [0, 0, 0, 0];
    await page.setViewportSize({ width: w, height: h });
    sizes[key] = await page.evaluate(i => {
      let st = document.getElementById('insets');
      if (!st) { st = document.createElement('style'); st.id = 'insets'; document.head.appendChild(st); }
      st.textContent = `html:root { --sat: ${i[0]}px; --sar: ${i[1]}px; --sab: ${i[2]}px; --sal: ${i[3]}px; }`;
      relayout();
      const t = felt.tableRect(), rs = [menuBtn, turnChip, spinPad, powerBar, fineWheel].map(el => el.getBoundingClientRect());
      const c = { left: Math.min(...rs.map(r => r.left)), right: Math.max(...rs.map(r => r.right)), top: Math.min(...rs.map(r => r.top)), bottom: Math.max(...rs.map(r => r.bottom)) };
      const cs = getComputedStyle(document.documentElement), px = v => parseFloat(cs.getPropertyValue(v)) || 0;
      const safe = { l: px('--sal'), r: innerWidth - px('--sar'), t: px('--sat'), b: innerHeight - px('--sab') };
      const ctlSafe = c.left >= safe.l - 0.5 && c.right <= safe.r + 0.5 && c.top >= safe.t - 0.5 && c.bottom <= safe.b + 0.5;
      const tableSafe = t.left >= safe.l - 0.5 && t.right <= safe.r + 0.5 && t.top >= safe.t - 0.5 && t.bottom <= innerHeight + 0.5;
      return { ball: +felt.ballPx.toFixed(2), ctlSafe, tableSafe };
    }, ins);
  }
  /* the side pockets' ears: a side drop is 2 POCKET_R deep past the nose, past a phone's rail, so
     its cap swells past the long rails in an ear. At each listed viewport (insets simulated), both
     pocket styles, 7 and 9 ft: each ear is on the screen, inside the safe area (the bottom on its
     side may run over the home indicator, as the table does), and clear of every control; and the
     ball loses at most 4% (regulation) or 6% (generous) against fitting the rail alone. */
  const ears = [];
  for (const key of ['440x956 ios', '956x440 ios', '390x844', '1280x800', '844x390', '430x932']) {
    const [w, h] = key.split(' ')[0].split('x').map(Number), ins = INSETS[key] || [0, 0, 0, 0];
    await page.setViewportSize({ width: w, height: h });
    for (const pk of ['regulation', 'generous']) for (const size of ['7', '9']) {
      ears.push(await page.evaluate(([i, pk, size, key]) => {
        let st = document.getElementById('insets');
        if (!st) { st = document.createElement('style'); st.id = 'insets'; document.head.appendChild(st); }
        st.textContent = `html:root { --sat: ${i[0]}px; --sar: ${i[1]}px; --sab: ${i[2]}px; --sal: ${i[3]}px; }`;
        settings.table = size; settings.pockets = pk; felt.start('8'); relayout();
        const co = cushionDepth(), cs = getComputedStyle(document.documentElement), px = v => parseFloat(cs.getPropertyValue(v)) || 0;
        const wide = document.documentElement.dataset.layout === 'wide';
        const safe = { l: px('--sal'), r: innerWidth - px('--sar'), t: px('--sat'), b: wide ? innerHeight : innerHeight - px('--sab') };
        const ctls = [menuBtn, turnChip, spinPad, powerBar, fineWheel, ctl].map(el => el.getBoundingClientRect());
        const hit = (a, b) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
        const out = [];
        for (const k of [1, 4]) {
          const e = pocketShape(k, co).ear;
          if (!e) continue;
          const s = k === 1 ? -1 : 1, y0 = k === 1 ? 0 : TW, pts = [[TL / 2 - e.uf, y0 + s * RAIL], [TL / 2 + e.uf, y0 + s * RAIL], [TL / 2 - e.rw, y0 + s * e.vc], [TL / 2 + e.rw, y0 + s * e.vc], [TL / 2, y0 + s * e.reach]].map(p => toScreen(p[0], p[1]));
          const r = { left: Math.min(...pts.map(p => p[0])), right: Math.max(...pts.map(p => p[0])), top: Math.min(...pts.map(p => p[1])), bottom: Math.max(...pts.map(p => p[1])) };
          if (r.left < safe.l - 0.5 || r.right > safe.r + 0.5 || r.top < safe.t - 0.5 || r.bottom > safe.b + 0.5 || ctls.some(c => hit(c, r))) out.push(k);
        }
        const sr = stage.getBoundingClientRect(), W = TL + 2 * RAIL, H = TW + 2 * RAIL;
        const k0 = view.portrait ? Math.min(sr.width / H, sr.height / W) : Math.min(sr.width / W, sr.height / H);
        return { key, pk, size, bad: out, ball: +felt.ballPx.toFixed(2), loss: +(100 * (1 - view.k / k0)).toFixed(2) };
      }, [ins, pk, size, key]));
    }
  }
  console.log('side ears, ball px and loss %: ' + ears.map(e => `${e.key} ${e.pk[0]}${e.size} ${e.ball} (${e.loss}%)`).join(', '));
  check('side ears: on screen, inside the safe area and clear of the controls at every listed viewport, both pocket styles, 7 and 9 ft', ears.every(e => !e.bad.length), JSON.stringify(ears.filter(e => e.bad.length)));
  check('side ears: the ball loses at most 4% (regulation) or 6% (generous) against fitting the rail alone', ears.every(e => e.loss <= (e.pk === 'regulation' ? 4 : 6)), JSON.stringify(ears.filter(e => e.loss > 0)));
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.evaluate(() => { settings.table = '7'; settings.pockets = 'regulation'; felt.start('8'); });
  await page.evaluate(() => { document.getElementById('insets').remove(); relayout(); });
  console.log('ball px (before -> now): ' + Object.keys(BEFORE).map(k => `${k} ${BEFORE[k]} -> ${sizes[k].ball}`).join(', '));
  check('ball: at least 20 px across at 956x440 with the iOS insets', sizes['956x440 ios'].ball >= 20, JSON.stringify(sizes['956x440 ios']));
  check('ball: at every listed viewport no smaller than before', Object.keys(BEFORE).every(k => sizes[k].ball >= BEFORE[k]), JSON.stringify(sizes));
  check('insets: every control inside the safe area; the table inside it but for its bottom rail (home indicator)', Object.values(sizes).every(s => s.ctlSafe && s.tableSafe), JSON.stringify(sizes));

  /* game over at 844x390: the sheet fits the screen; its dark dots are ringed to 3:1 */
  await page.evaluate(() => { stats.potted = [[8, 7, 4, 2, 1], [6, 3, 15]]; felt.forceWin(0); });
  await page.waitForTimeout(100);
  const sheet = await page.evaluate(() => { const r = document.querySelector('#over .sheet').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, vh: innerHeight }; });
  check('game over at 844x390: the sheet fits the screen', sheet.top >= 0 && sheet.bottom <= sheet.vh, JSON.stringify(sheet));
  const dots = await page.evaluate(() => {
    const rgba = c => { const m = c.match(/[\d.]+/g).map(Number); return [m[0], m[1], m[2], m.length > 3 ? m[3] : 1]; };
    const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const cr = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    const bg = rgba(getComputedStyle(document.querySelector('#over .sheet')).backgroundColor);
    return [...document.querySelectorAll('#overStats .dot')].map(d => {
      const cs = getComputedStyle(d), ball = rgba(cs.backgroundColor), ring = cs.boxShadow.match(/rgb\([^)]*\)(?= 0px 0px 0px 1\.5px)/);
      return { n: d.title, r: +Math.max(d.classList.contains('stripe') ? 99 : cr(ball, bg), ring ? cr(rgba(ring[0]), bg) : 0).toFixed(2) };
    });
  });
  check('potted dots: every ball reads at 3:1 on the panel (dark ones by their ring)', dots.length === 8 && dots.every(d => d.r >= 3), JSON.stringify(dots));
  check('no console errors', errors.length === 0, errors.join(' | '));

  /* how to play speaks mouse and keyboard here */
  const howDesk = await page.evaluate(() => [getComputedStyle(document.querySelector('.how .keys')).display, getComputedStyle(document.querySelector('.how .touch')).display]);
  check('how to play: mouse and keyboard words with a fine pointer', howDesk[0] !== 'none' && howDesk[1] === 'none', JSON.stringify(howDesk));

  await browser.close();

  /* a phone (touch, dpr 3): no zoom, touch words, a sharp canvas that stays cheap */
  const ph3 = await open('', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const z = await ph3.page.evaluate(() => {
    const ta = s => getComputedStyle(document.querySelector(s)).touchAction;
    return {
      meta: document.querySelector('meta[name="viewport"]').content,
      none: ['html', 'body', '#table', '#ui', '#turnChip', '#ctl', '#menuBtn', '#spinPad', '#powerBar', '#fineWheel', '#banner'].map(ta),
      menu: [ta('#menu'), ta('#over'), ta('#menu .sheet'), ta('#play8')],
      how: [getComputedStyle(document.querySelector('.how .keys')).display, getComputedStyle(document.querySelector('.how .touch')).display],
    };
  });
  check('no pinch zoom: the viewport refuses scaling and every game element takes no browser gesture', /user-scalable=no/.test(z.meta) && /maximum-scale=1/.test(z.meta) && z.none.every(v => v === 'none'), JSON.stringify(z));
  check('the menu and game-over overlays still scroll (pan-y only)', z.menu.every(v => v === 'pan-y'), JSON.stringify(z.menu));
  check('how to play: touch words on a touch screen', z.how[0] === 'none' && z.how[1] !== 'none', JSON.stringify(z.how));
  await ph3.page.evaluate(() => felt.start('8'));
  const perf = await ph3.page.evaluate(() => {
    const ts = [];
    for (let i = 0; i < 30; i++) { const t0 = performance.now(); draw(t0); ts.push(performance.now() - t0); }
    ts.sort((a, b) => a - b);
    return { dpr, w: table.width, cssW: innerWidth, median: +ts[15].toFixed(2) };
  });
  check('phone: the canvas backs onto all 3 device pixels and a frame stays cheap', perf.dpr === 3 && perf.w === perf.cssW * 3 && perf.median < 12, JSON.stringify(perf));
  const fit = await ph3.page.evaluate(() => ({ appH: getComputedStyle(document.documentElement).getPropertyValue('--app-h').trim(), uiH: ui.getBoundingClientRect().height, h: innerHeight, back: [table.width, table.height], css: [table.clientWidth, table.clientHeight], dpr }));
  check('browser: the app is the window\'s height and the canvas backs its exact CSS size at dpr', fit.appH === fit.h + 'px' && fit.uiH === fit.h && fit.back[0] === fit.css[0] * fit.dpr && fit.back[1] === fit.css[1] * fit.dpr, JSON.stringify(fit));
  check('phone: no console errors', ph3.errors.length === 0, ph3.errors.join(' | '));
  await ph3.browser.close();

  /* an iOS home-screen app on a 440x956 pt screen reporting innerHeight short by the status bar
     (62 pt): the app must still fill the screen, so no dead strip under the controls */
  const ios = await open('', { viewport: { width: 440, height: 894 }, screen: { width: 440, height: 956 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3,
    init: () => Object.defineProperty(navigator, 'standalone', { get: () => true }) });
  const st = await ios.page.evaluate(() => { felt.start('8'); const c = ctl.getBoundingClientRect(); return { appH: getComputedStyle(document.documentElement).getPropertyValue('--app-h').trim(), uiH: ui.getBoundingClientRect().height, ctlBottom: c.bottom, back: table.height, dpr, diag: diag.textContent }; });
  check('home-screen app: sized from the screen when iOS reports a short innerHeight; controls sit at the bottom', st.appH === '956px' && st.uiH === 956 && st.ctlBottom > 956 - 30 && st.back === 956 * st.dpr, JSON.stringify(st));
  /* iOS changing its size with no resize event: the watch lays out again within a couple of seconds */
  await ios.page.setViewportSize({ width: 440, height: 956 });
  await ios.page.evaluate(() => Object.defineProperty(window.screen, 'height', { get: () => 1000 }));
  await ios.page.waitForTimeout(2300);
  const st2 = await ios.page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--app-h').trim());
  check('a size change without a resize event is picked up', st2 === '1000px', st2);
  check('home-screen app: no console errors', ios.errors.length === 0, ios.errors.join(' | '));
  await ios.browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
