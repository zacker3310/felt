/* boot-check: the page boots with no console errors and no network beyond itself, opens on
   the menu, starts both games, keeps every target at least 44 px and every text at 4.5:1, and
   on a phone fills the width with the table, keeps the controls off it and never scrolls
   sideways. The game screen is the table and the controls: no player cards, no status text, no
   tray; two player chips, as tall as the controls, say whose turn it is, and the pause menu holds the rest.
   Ball size is the target metric: measured at each listed viewport (iOS insets simulated with
   --sat/--sar/--sab/--sal, which headless env() leaves at 0) against the sizes before the
   maximised layout. */
'use strict';
const { check, done, open, smallTargets, lowContrast } = require('./lib.cjs');

/* the words laid over the home's art (the eight game cards): each line's colour against the art's
   own pixels under it (the scrim is painted into the canvas), worst case at the 2nd percentile
   so a stray anti-aliased speck does not decide it */
const artContrast = page => page.evaluate(() => {
  const rgba = c => { const m = c.match(/[\d.]+/g).map(Number); return [m[0], m[1], m[2], m.length > 3 ? m[3] : 1]; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const out = [];
  for (const card of [play8, play9, play10, playStr, playRot, playS, playC, playB]) {
    const cv = card.querySelector('.art'), cr = cv.getBoundingClientRect(), k = cv.width / cr.width, g = cv.getContext('2d');
    for (const el of card.querySelectorAll('.tt small, .tt b')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !el.getClientRects().length || getComputedStyle(el).display === 'none') continue;
      const x = Math.max(0, Math.floor((r.left - cr.left) * k)), y = Math.max(0, Math.floor((r.top - cr.top) * k)), w = Math.min(cv.width - x, Math.ceil(r.width * k)), h = Math.min(cv.height - y, Math.ceil(r.height * k));
      const d = g.getImageData(x, y, w, h).data, fg = rgba(getComputedStyle(el).color), rs = [];
      for (let i = 0; i < d.length; i += 16) {
        const bg = [d[i], d[i + 1], d[i + 2]], f = [0, 1, 2].map(j => fg[j] * fg[3] + bg[j] * (1 - fg[3])), a = lum(f), b = lum(bg);
        rs.push((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05));
      }
      rs.sort((p, q) => p - q);
      out.push({ id: card.id, text: el.textContent.slice(0, 20), r: +rs[Math.floor(rs.length * 0.02)].toFixed(2) });
    }
  }
  return out;
});

(async () => {
  const { browser, page, errors, requests } = await open();
  await page.waitForTimeout(300);

  const origin = new URL(page.url()).origin;
  const foreign = requests.filter(u => !u.startsWith(origin) && !u.startsWith('data:'));
  check('no network requests beyond the page origin', foreign.length === 0, foreign.join(' '));
  check('opens on the menu', await page.evaluate(() => felt.state === 'menu' && getComputedStyle(menu).display !== 'none'));
  check('menu targets are at least 44 px', (await smallTargets(page)).length === 0, JSON.stringify(await smallTargets(page)));
  check('home: the eight game cards, the four modes, the solo list and Stats, Settings, How to play; no pause part',
    await page.evaluate(() => [play8, play9, play10, playStr, playRot, playS, playC, playB, careerBtn, modeTour, modeEx, modeParty, pracBtn, drillsRow, trickBtn, dailyBtn, statsBtn, prefsBtn, helpBtn].every(b => b.getClientRects().length)
      && getComputedStyle(document.querySelector('#menu .pausePart')).display === 'none' && !resumeBtn.getClientRects().length));
  /* no Play again hero and no More rows: every game and mode is its own card, in three sections */
  const secs = await page.evaluate(() => ({ gone: ['againBtn', 'heroArt', 'playMore', 'playModes', 'moreSheet'].filter(id => document.getElementById(id)), heads: [...document.querySelectorAll('.newgame .sect')].map(h => h.textContent),
    games: [...playRow.children].map(b => b.dataset.kind).join(), modes: [...modeRow.children].map(b => b.id).join() }));
  check('home: no Play again hero and no More games or More modes; sections Games, Modes, Solo; the eight games and four modes in order', !secs.gone.length && secs.heads.join() === 'Games,Modes,Solo'
    && secs.games === '8,9,10,straight,rotation,snooker,carom,bumper' && secs.modes === 'careerBtn,modeTour,modeEx,modeParty', JSON.stringify(secs));
  /* the header: three round icon buttons, 44 px, each named for a screen reader, no visible words */
  const hdr = await page.evaluate(() => [statsBtn, prefsBtn, helpBtn].map(b => { const r = b.getBoundingClientRect(); return { l: b.getAttribute('aria-label'), w: r.width, h: r.height, round: parseFloat(getComputedStyle(b).borderTopLeftRadius) >= r.width / 2 - 0.5, text: b.textContent.trim() }; }));
  check('home header: Stats, Settings, How to play are 44 px round icon buttons with aria-labels',
    hdr.map(h => h.l).join() === 'Stats,Settings,How to play' && hdr.every(h => h.w >= 44 && h.h >= 44 && h.round && h.text === ''), JSON.stringify(hdr));
  /* the solo list: one grouped container, a row each at least 44 px, stacked */
  const rows = await page.evaluate(() => [pracBtn, trickBtn, dailyBtn].map(b => { const r = b.getBoundingClientRect(); return { t: Math.round(r.top), h: r.height, box: b.parentElement === soloRow }; }));
  check('home solo list: Practice, Trick shots, Daily shot in one list, each row 44 px or more', rows.every(r => r.h >= 44 && r.box) && rows[0].t < rows[1].t && rows[1].t < rows[2].t, JSON.stringify(rows));
  const dr = await page.evaluate(() => ({ box: drillsRow.parentElement === soloRow, after: drillsRow.previousElementSibling === pracBtn, sum: drillsRowSum.textContent, label: drillsRow.getAttribute('aria-label') }));
  check('home solo list: Drills is its own row after Practice, with its medals', dr.box && dr.after && /^\d+ of \d+$/.test(dr.sum) && /^Drills: /.test(dr.label), JSON.stringify(dr));
  /* each game card has its rack drawn edge to edge at the device's pixels */
  const art = await page.evaluate(() => [...document.querySelectorAll('#playRow .art')].map(c => { const d = c.getContext('2d').getImageData(c.width / 2, c.height / 2, 1, 1).data, p = c.parentElement.getBoundingClientRect(), r = c.getBoundingClientRect();
    return { w: c.width, ok: c.width === Math.round(c.clientWidth * devicePixelRatio) && c.height === Math.round(c.clientHeight * devicePixelRatio), a: d[3], bleed: Math.abs(r.width - p.width) < 1 && Math.abs(r.height - p.height) < 1 }; }));
  check('home: every game card shows its table edge to edge, drawn at the device pixel ratio', art.length === 8 && art.every(a => a.ok && a.a === 255 && a.bleed), JSON.stringify(art));
  check('home words over the art read at 4.5:1 on the cloth', (await artContrast(page)).every(c => c.r >= 4.5), JSON.stringify(await artContrast(page)));
  /* bumper setup: the Table control (Octagon, Rectangle) only, 44 px each, the octagon by default */
  await page.click('#playB');
  /* measure once the sheet has finished rising (mid-animation sizes come out a hair under 44) */
  await page.waitForFunction(() => !document.getAnimations().some(a => a.playState === 'running'));
  const bt = await page.evaluate(() => [btOct, btRect].map(b => { const r = b.getBoundingClientRect(); return { t: b.textContent, w: r.width, h: r.height, p: b.getAttribute('aria-pressed'), lab: b.parentElement.previousElementSibling.textContent, pool: !!tb7.getClientRects().length }; }));
  check('setup (bumper pool): its Table control (Octagon, Rectangle), 44 px targets, the octagon by default; no pool table options',
    bt[0].t === 'Octagon' && bt[1].t === 'Rectangle' && bt.every(b => b.w >= 44 && b.h >= 44 && b.lab === 'Table' && !b.pool) && bt[0].p === 'true' && bt[1].p === 'false', JSON.stringify(bt));
  check('setup (bumper pool): targets 44 px, text 4.5:1', (await smallTargets(page)).length === 0 && (await lowContrast(page)).length === 0, JSON.stringify([await smallTargets(page), await lowContrast(page)]));
  await page.click('#setupBack');
  /* 8-ball setup: size and pockets, regulation by default, no bumper control */
  await page.click('#play8');
  const pk = await page.evaluate(() => [pkReg, pkGen].map(b => { const r = b.getBoundingClientRect(); return { t: b.textContent, w: r.width, h: r.height, p: b.getAttribute('aria-pressed'), bump: !!btOct.getClientRects().length }; }));
  check('setup (8-ball): Pockets, Regulation / Generous, 44 px each, regulation by default; no bumper control', pk[0].t === 'Regulation' && pk[1].t === 'Generous' && pk.every(b => b.w >= 44 && b.h >= 44 && !b.bump)
    && pk[0].p === 'true' && pk[1].p === 'false' && await page.evaluate(() => felt.pockets === 'regulation'), JSON.stringify(pk));
  check('setup (8-ball): targets 44 px, text 4.5:1', (await smallTargets(page)).length === 0 && (await lowContrast(page)).length === 0, JSON.stringify([await smallTargets(page), await lowContrast(page)]));
  await page.keyboard.press('Escape');
  check('Esc closes the setup sheet back to home', await page.evaluate(() => !setupSheet.classList.contains('show') && menu.classList.contains('show') && felt.state === 'menu'));
  /* how to play, settings and stats sheets: every tab, targets and contrast */
  /* on a small phone: a sheet must never grow past the screen (the tab row scrolls inside it) */
  const wide = page.viewportSize();
  await page.setViewportSize({ width: 375, height: 667 });
  await page.click('#helpBtn');
  const fitsNow = async () => (await page.waitForFunction(() => !document.getAnimations().some(a => a.playState === 'running' && helpSheet.contains(a.effect.target))), page.evaluate(() => (r => r.left >= 0 && r.right <= innerWidth + 0.5 && r.top >= -0.5 && r.bottom <= innerHeight + 0.5)(howSheet.getBoundingClientRect()) && document.documentElement.scrollWidth <= innerWidth && howSheet.scrollWidth <= howSheet.clientWidth));
  const root = await page.evaluate(() => ({ list: !howList.hidden, rows: [...howList.querySelectorAll('.topic')].map(b => b.id), title: helpTitle.textContent, pages: [...document.querySelectorAll('#helpSheet .pan')].filter(p => !p.hidden).length }));
  check('how to play from home: the list of fifteen topics (the three More games and Called shots after snooker; cue elevation, More modes, Drills and the career after Solo modes), no page open', root.list && root.rows.join() === 'tabCtl,tab8,tab9,tabBump,tabCarom,tabSnk,tab10,tabStr,tabRot,tabCall,tabSolo,tabCue,tabModes,tabDrills,tabCareer' && root.title === 'How to play' && root.pages === 0 && await fitsNow()
    && (await smallTargets(page)).length === 0 && (await lowContrast(page)).length === 0, JSON.stringify(root));
  const tabs = [];
  for (const id of ['tabCtl', 'tab8', 'tab9', 'tabBump', 'tabCarom', 'tabSnk', 'tabSolo', 'tabCue', 'tabModes', 'tabDrills', 'tabCareer']) {
    await page.click('#' + id);
    tabs.push(await page.evaluate(id => ({ id, list: !howList.hidden, shown: [...document.querySelectorAll('#helpSheet .pan')].filter(p => !p.hidden).map(p => p.id), title: helpTitle.textContent === document.getElementById(id).querySelector('b').textContent, text: document.querySelector('#helpSheet .pan:not([hidden])').textContent.length }), id));
    const t = tabs[tabs.length - 1];
    t.fits = await fitsNow(); t.small = (await smallTargets(page)).length; t.low = await lowContrast(page);
    await page.click('#helpBack');
    t.back = await page.evaluate(() => helpSheet.classList.contains('show') && !howList.hidden && helpTitle.textContent === 'How to play');
  }
  check('how to play: eleven topic pages (controls, 8-ball, 9-ball, bumper, carom, snooker, solo, cue elevation, More modes, Drills, career), each alone with its title, the sheet inside the screen, 44 px, text 4.5:1; back returns to the list', tabs.length === 11 && tabs.every(t => !t.list && t.shown.length === 1 && t.title && t.text > 100 && t.fits && !t.small && !t.low.length && t.back), JSON.stringify(tabs));
  await page.click('#tabSnk');
  const pin = await page.evaluate(() => { const r = tutGoS.getBoundingClientRect(), s = howSheet.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, foot: s.bottom, long: howSheet.scrollHeight > howSheet.clientHeight }; });
  check('how to play: the longest page (snooker) scrolls under its tutorial button, pinned at the foot of the screen', pin.long && pin.bottom <= pin.foot + 0.5 && pin.bottom >= pin.foot - 40, JSON.stringify(pin));
  await page.keyboard.press('Escape');
  check('how to play: Esc on a page closes the sheet back to home', await page.evaluate(() => !helpSheet.classList.contains('show') && menu.classList.contains('show')));
  /* the new pages: cue elevation says how the pad opens it (touch: a hold); More modes, Drills and
     the career each end with a button that opens their sheet */
  const opens = [];
  for (const [tab, btn, sheet] of [['tabModes', 'helpModes', 'modesSheet'], ['tabDrills', 'helpDrills', 'drillSheet'], ['tabCareer', 'helpCareer', 'careerSheet']]) {
    await page.evaluate(() => showHelp());
    await page.click('#' + tab);
    await page.click('#' + btn);
    opens.push(await page.evaluate(s => ({ s, open: document.getElementById(s).classList.contains('show'), help: helpSheet.classList.contains('show') }), sheet));
    await page.evaluate(() => backToMenu());
  }
  const cue = await page.evaluate(() => { showHelp('cue'); const t = [...panCue.querySelectorAll('li')].filter(l => l.getClientRects().length).map(l => l.textContent).join(' '); const a = { hold: (matchMedia('(hover: none) and (pointer: coarse)').matches ? /Hold the english pad/ : /Right click the english pad/).test(t), swerve: /Swerve/.test(t), masse: /Masse/.test(t), level: /Level/.test(t) }; backToMenu(); return a; });
  check('how to play: the cue elevation page says how to open it (hold the english pad, or right click it with a mouse) and what swerve and masse do; More modes, Drills and Career open their sheets',
    cue.hold && cue.swerve && cue.masse && cue.level && opens.every(o => o.open && !o.help), JSON.stringify({ cue, opens }));
  await page.click('#helpBtn');
  /* nothing frosts the table: no CSS rule sets a backdrop or blur filter (they read as smeared on iOS) */
  const blurs = await page.evaluate(() => [...document.styleSheets].flatMap(sh => [...sh.cssRules]).flatMap(function all(r) { return r instanceof CSSGroupingRule ? [...r.cssRules].flatMap(all) : [r]; })
    .filter(r => r.style && ['backdrop-filter', '-webkit-backdrop-filter', 'filter'].some(k => /blur/.test(r.style.getPropertyValue(k)))).map(r => r.selectorText));
  check('no backdrop or blur filters anywhere (the table behind a sheet or a callout stays sharp)', blurs.length === 0, JSON.stringify(blurs));
  /* no colour accents: no side stripe (an inset shadow offset on one side, or a border on one side wider than a
     hairline) and no coloured underline bar on any rule (the owner's call: emphasis is weight, never a stripe) */
  const stripes = await page.evaluate(() => [...document.styleSheets].flatMap(sh => [...sh.cssRules]).flatMap(function all(r) { return r instanceof CSSGroupingRule ? [...r.cssRules].flatMap(all) : [r]; })
    .filter(r => r.style && (/inset\s+-?[1-9][\d.]*px\s+0(px)?\s+0(px)?(\s|,|$)|inset\s+0(px)?\s+-?[1-9][\d.]*px\s+0(px)?\s+(?!0)/.test(r.style.getPropertyValue('box-shadow'))
      || ['border-left', 'border-right', 'border-inline-start', 'border-inline-end', 'border-bottom', 'border-top'].some(k => { const w = parseFloat(r.style.getPropertyValue(k + '-width') || (r.style.getPropertyValue(k).match(/([\d.]+)px/) || [])[1]); return w > 1; })))
    .map(r => r.selectorText + ' { ' + r.style.getPropertyValue('box-shadow') + ' }'));
  check('no colour accents: no side stripes or underline bars anywhere (emphasis is weight)', stripes.length === 0, JSON.stringify(stripes));
  check('no em dashes anywhere on the page', await page.evaluate(() => !document.documentElement.outerHTML.includes('\u2014')));
  await page.click('#helpBack');
  await page.setViewportSize(wide);
  for (const [btn, back] of [['#prefsBtn', '#prefsBack'], ['#statsBtn', '#statsBack']]) {
    await page.click(btn);
    await page.waitForTimeout(250);
    check(`${btn.slice(1, -3)} sheet: targets 44 px, text 4.5:1, back returns home`, (await smallTargets(page)).length === 0 && (await lowContrast(page)).length === 0, JSON.stringify([await smallTargets(page), await lowContrast(page)]));
    await page.click(back);
  }
  check('back from the sheets: home again', await page.evaluate(() => menu.classList.contains('show') && ![setupSheet, prefsSheet, statsSheet, helpSheet].some(s => s.classList.contains('show'))));

  /* the home's eight games are all on the first screen, inside the safe area: an iPhone 18 Pro Max
     either way up (insets simulated), an iPhone 17 Pro upright with its insets, and the other
     listed sizes but the smallest; the rest (modes, solo) is a scroll away, never sideways */
  const fits = [];
  for (const [w, h, ins] of [[440, 956, [62, 0, 34, 0]], [956, 440, [0, 62, 21, 62]], [393, 852, [59, 0, 34, 0]], [440, 956, [0, 0, 0, 0]], [956, 440, [0, 0, 0, 0]], [390, 844, [0, 0, 0, 0]], [1280, 800, [0, 0, 0, 0]], [768, 1024, [0, 0, 0, 0]]]) {
    await page.setViewportSize({ width: w, height: h });
    fits.push(await page.evaluate(async ([ins, w, h]) => {
      let st = document.getElementById('insets');
      if (!st) { st = document.createElement('style'); st.id = 'insets'; document.head.appendChild(st); }
      st.textContent = `html:root { --sat: ${ins[0]}px; --sar: ${ins[1]}px; --sab: ${ins[2]}px; --sal: ${ins[3]}px; }`;
      settings.last = '8'; relayout(); showMenu();
      await new Promise(r => setTimeout(r, 300));
      const R = el => el.getBoundingClientRect(), all = [statsBtn, helpBtn, ...playRow.children].map(R), rest = [careerBtn, modeParty, pracBtn, dailyBtn].map(R);
      const top = menu.scrollTop;
      menu.scrollTop = 1e6;
      const end = dailyBtn.getBoundingClientRect().bottom <= h - ins[2] + 0.5;
      menu.scrollTop = top;
      return { size: `${w}x${h}`, ins: ins.join(), sh: menu.scrollHeight, ch: menu.clientHeight, sw: document.documentElement.scrollWidth, vw: innerWidth, end,
        inside: all.every(r => r.top >= ins[0] - 0.5 && r.bottom <= h - ins[2] + 0.5 && r.left >= ins[3] - 0.5 && r.right <= w - ins[1] + 0.5),
        across: rest.every(r => r.left >= ins[3] - 0.5 && r.right <= w - ins[1] + 0.5) };
    }, [ins, w, h]));
  }
  check('home: all eight game cards on the first screen inside the safe area (440x956 and 956x440 with and without the iOS insets, 393x852 with them, 390x844, 1280x800, 768x1024); the modes and solo list inside it across, the last row reached by scrolling; no sideways scroll', fits.every(f => f.sw <= f.vw && f.inside && f.across && f.end), JSON.stringify(fits));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  const h390 = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth }));
  check('home: no horizontal scroll at 390 px', h390.sw <= h390.w, JSON.stringify(h390));
  check('home at 390x844: targets 44 px, text 4.5:1', (await smallTargets(page)).length === 0 && (await lowContrast(page)).length === 0, JSON.stringify([await smallTargets(page), await lowContrast(page)]));
  await page.evaluate(() => setSetting('cloth', 'red'));
  await page.waitForTimeout(100);
  check('home at 390x844 on the red cloth: words over the art 4.5:1, text 4.5:1', (await artContrast(page)).every(c => c.r >= 4.5) && (await lowContrast(page)).length === 0, JSON.stringify([await artContrast(page), await lowContrast(page)]));
  await page.setViewportSize({ width: 956, height: 440 });
  await page.waitForTimeout(250);
  check('home at 956x440 on the red cloth: words over the art 4.5:1, targets 44 px', (await artContrast(page)).every(c => c.r >= 4.5) && (await smallTargets(page)).length === 0, JSON.stringify([await artContrast(page), await smallTargets(page)]));
  await page.evaluate(() => { setSetting('cloth', 'green'); document.getElementById('insets').remove(); settings.last = null; syncMenu(); });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(200);

  await page.click('#play8');
  await page.click('#breakBtn');
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
  await page.click('#exitBtn');
  await page.click('#play9');
  await page.click('#vsCpu');
  await page.click('#breakBtn');
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
     chips show both players, as tall as the controls beside them, the active one lit. */
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
        msg: { w: m.width, h: m.height, live: msg.getAttribute('aria-live'), role: msg.getAttribute('role') }, chip: { h: chip.height, shown: seen(turnChip), name: turnChip.dataset.name, chips: [...document.querySelectorAll('.pchip')].filter(e => !e.hidden).map(e => ({ h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width), on: e.classList.contains('on'), name: e.firstChild.textContent })), ctlH: Math.round(spinPad.getBoundingClientRect().height), layout: document.documentElement.dataset.layout } };
    }));
  }
  check('game screen: no player cards, no status text, no tray (view.tray null, no band)', clean.every(c => !c.cards.length && !c.text.length && c.tray === null && !c.band), JSON.stringify(clean));
  check('the status line stays for screen readers: visually hidden, role status, aria-live polite', clean.every(c => c.msg.w <= 1 && c.msg.h <= 1 && c.msg.live === 'polite' && c.msg.role === 'status'), JSON.stringify(clean.map(c => c.msg)));
  check('two player chips, the active one lit; in the strip they are as tall as the controls, in a column as wide', clean.every(c => c.chip.shown && c.chip.name === 'You' && c.chip.chips.length === 2 && c.chip.chips[0].on && !c.chip.chips[1].on
    && c.chip.chips[1].name === 'CPU' && c.chip.chips.every(k => (c.chip.layout === 'portrait' ? k.h === 56 : k.h >= 36) && k.w >= 34)), JSON.stringify(clean.map(c => c.chip)));

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
        first: sec.top < res.top && res.top < R(restartBtn).top && !play8.getClientRects().length && getComputedStyle(document.querySelector('#menu .newgame')).display === 'none',
        acts: [restartBtn, exitBtn, pPrefsBtn, pHelpBtn].every(b => b.getClientRects().length), primary: resumeBtn.classList.contains('big') };
    });
    check(`pause menu at ${w}x${h}: both cards (active marker, group, remaining dots inside), the potted balls in order, the status line, then Resume, then Restart, Quit, Settings, How to play; no home tiles`,
      pm.shown && pm.first && pm.acts && pm.primary && pm.cards[0].on && !pm.cards[1].on && pm.cards[0].meta === 'Solids' && pm.cards[1].meta === 'Stripes' && pm.cards[0].n === 5 && pm.cards[1].n === 6
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
  /* floors from before the table-max layout (440x956 without insets went to 20.1 while the side
     pockets' casting bulged past the rail; with the side holes set inside the rail it is back) */
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
  /* the side pockets sit inside the rail: at each listed viewport (insets simulated), both pocket
     styles, 7 and 9 ft, each side hole and its ring end at least SIDE_WOOD inside the rail's outer
     edge, so the table's footprint is the rail and the ball is as big as fitting the rail allows */
  const sides = [];
  for (const key of ['440x956 ios', '956x440 ios', '390x844', '1280x800', '844x390', '430x932']) {
    const [w, h] = key.split(' ')[0].split('x').map(Number), ins = INSETS[key] || [0, 0, 0, 0];
    await page.setViewportSize({ width: w, height: h });
    for (const pk of ['regulation', 'generous']) for (const size of ['7', '9']) {
      sides.push(await page.evaluate(([i, pk, size, key]) => {
        let st = document.getElementById('insets');
        if (!st) { st = document.createElement('style'); st.id = 'insets'; document.head.appendChild(st); }
        st.textContent = `html:root { --sat: ${i[0]}px; --sar: ${i[1]}px; --sab: ${i[2]}px; --sal: ${i[3]}px; }`;
        settings.table = size; settings.pockets = pk; felt.start('8'); relayout();
        const co = cushionDepth(), wood = [1, 4].map(k => { const S = pocketShape(k, co); return +(1000 * (RAIL - Math.abs(S.C[1] - (k === 1 ? 0 : TW)) - S.rc)).toFixed(2); });
        const sr = stage.getBoundingClientRect(), W = TL + 2 * RAIL, H = TW + 2 * RAIL;
        const k0 = view.portrait ? Math.min(sr.width / H, sr.height / W) : Math.min(sr.width / W, sr.height / H);
        return { key, pk, size, wood, min: 1000 * SIDE_WOOD, ball: +felt.ballPx.toFixed(2), loss: +(100 * (1 - view.k / k0)).toFixed(2) };
      }, [ins, pk, size, key]));
    }
  }
  console.log('side pockets, ball px: ' + sides.map(e => `${e.key} ${e.pk[0]}${e.size} ${e.ball}`).join(', '));
  check('side pockets: every side hole and its ring inside the rail, SIDE_WOOD from its outer edge, at every listed viewport, both pocket styles, 7 and 9 ft', sides.every(e => e.wood.every(v => v >= e.min - 0.01)), JSON.stringify(sides.filter(e => !e.wood.every(v => v >= e.min - 0.01))));
  check('side pockets: the table fits by its rail alone (no ball size lost to the pockets)', sides.every(e => Math.abs(e.loss) < 0.01), JSON.stringify(sides.filter(e => Math.abs(e.loss) >= 0.01)));
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
      menu: [ta('#menu'), ta('#over'), ta('#menu .sheet'), ta('#play8'), ta('#setupSheet'), ta('#helpSheet')],
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

  /* an iOS home-screen app on a 440x956 pt screen under the opaque status bar (the page's
     setting): the page starts below the bar, so innerHeight (894) is the real height. Sizing
     from the screen there pushed the bottom of every sheet and the controls off the screen. */
  const ios = await open('', { viewport: { width: 440, height: 894 }, screen: { width: 440, height: 956 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3,
    init: () => Object.defineProperty(navigator, 'standalone', { get: () => true }) });
  const st0 = await ios.page.evaluate(() => { felt.start('8'); const c = ctl.getBoundingClientRect(); return { appH: getComputedStyle(document.documentElement).getPropertyValue('--app-h').trim(), uiH: ui.getBoundingClientRect().height, ctlBottom: c.bottom, back: table.height, dpr, bar: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').content }; });
  check('home-screen app, opaque status bar: sized to innerHeight; the controls end inside the screen', st0.bar === 'black' && st0.appH === '894px' && st0.uiH === 894 && st0.ctlBottom <= 894 && st0.ctlBottom > 894 - 30 && st0.back === 894 * st0.dpr, JSON.stringify(st0));
  /* the menu's sheets fit too: the lesson offer's buttons are on screen */
  const off = await ios.page.evaluate(() => { felt.quit && felt.quit(); lessonOffer.classList.add('show'); const r = lessonOffer.querySelector('.sheet').getBoundingClientRect(); lessonOffer.classList.remove('show'); return { bottom: r.bottom, h: innerHeight }; });
  check('home-screen app: a bottom sheet ends inside the screen', off.bottom <= off.h, JSON.stringify(off));
  /* the app is sized to the window a fixed element can fill, never to the screen: the screen-height
     guess is what pushed everything off the bottom of the home-screen app */
  await ios.page.evaluate(() => { document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').content = 'black-translucent'; relayout(); });
  const st = await ios.page.evaluate(() => ({ appH: getComputedStyle(document.documentElement).getPropertyValue('--app-h').trim(), uiBottom: ui.getBoundingClientRect().bottom, h: innerHeight }));
  check('home-screen app: whatever the status bar, the app is the window (never the taller screen)', st.appH === st.h + 'px' && st.uiBottom <= st.h, JSON.stringify(st));
  /* iOS changing its size with no resize event: the watch lays out again within a couple of seconds */
  await ios.page.setViewportSize({ width: 440, height: 800 });
  await ios.page.waitForTimeout(2300);
  const st2 = await ios.page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--app-h').trim());
  check('a size change is picked up', st2 === '800px', st2);
  /* iOS reporting a layout window taller than what is visible (seen on smaller iPhones as a home-screen
     app): the app follows the visible height, so the controls stay on screen */
  const vis = await ios.page.evaluate(() => { const real = visualViewport.height; Object.defineProperty(visualViewport, 'height', { configurable: true, get: () => real - 60 }); relayout(); const c = ctl.getBoundingClientRect(); return { appH: getComputedStyle(document.documentElement).getPropertyValue('--app-h').trim(), want: Math.floor(real - 60), ctlBottom: c.bottom }; });
  check('home-screen app: never taller than the visible area (visualViewport); the controls end inside it', vis.appH === vis.want + 'px' && vis.ctlBottom <= vis.want, JSON.stringify(vis));
  check('Settings shows which build is running', await ios.page.evaluate(() => /^build \d{4}-\d{2}-\d{2}/.test(diag.textContent)), await ios.page.evaluate(() => diag.textContent));
  check('home-screen app: no console errors', ios.errors.length === 0, ios.errors.join(' | '));
  await ios.browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
