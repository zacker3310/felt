/* hig-check: the sheets are built from the HIG token sheet and its components (index.html's token
   :root, the inset grouped list, the segmented control, the pop-up button and its menu, 6p).
   Values and their sources: .buildloop/spec/hig-tokens.md.
   1. every list row is 44 px or taller (setup, Settings, How to play, Stats, the modes, the career, drills)
   2. every word on those sheets is a size on the Dynamic Type ramp (34 28 22 20 17 16 15 13 12 11)
   3. the separators between rows are hairlines: 1 px scaled to one device pixel
   4. every segmented control has the native metrics: a 32 px track, a 2 px inset thumb, 13 px words
      (600 on the chosen one), each segment a 44 px target
   5. a pop-up menu opens by a real tap, picks by a real tap, closes, and the pick persists (a reload);
      a tap outside closes it and does nothing else; Esc closes it
   6. the setup has no eyebrow over its Large Title (34 px), and every footer sits wholly above the
      pinned Break bar once scrolled to (every game, upright at 393x852 and 375x667, and on its side) */
'use strict';
const { check, done, open, choose, openPop, smallTargets, lowContrast } = require('./lib.cjs');
const RAMP = [34, 28, 22, 20, 17, 16, 15, 13, 12, 11];
const KINDS = ['8', '9', '10', 'straight', 'rotation', 'snooker', 'carom', 'bumper'];

/* the screens the components appear on, each opened by the page's own functions */
const SCREENS = [
  ...KINDS.map(k => [`setup ${k} (two players)`, `setSetting('cpu', false); showSetup('${k}')`]),
  ['setup 8 (CPU)', `setSetting('cpu', true); showSetup('8')`],
  ['settings', 'showPrefs()'], ...['game', 'ctl', 'gfx', 'aud', 'a11y', 'about'].map(p => [`settings ${p}`, `showPrefs(); prefsPage('${p}')`]),
  ['how to play', 'showHelp()'], ['how to play 8', `showHelp('8')`], ['how to play controls', `showHelp('ctl')`],
  ['stats', 'showStats()'], ['stats 8', `showStats(); statsGo('8')`],
  ['quick tournament', `showModes('tsetup')`], ['ai exhibition', `showModes('exsetup')`], ['party', `showModes('psetup')`],
  ['new career', `showCareer(); felt.careerGo('create')`],
  ['drills', 'showDrills()'], ['a drill', `showDrills(); drillList.querySelector('.group button').click()`],
  ['tournament', `felt.tourneyCreate({ kind: '9', ruleset: '9-house', size: 4, fmt: 'single', race: 2, field: 'easy', seed: 11 }); showModes('tour')`],
  ['career hub', `if (!Career.loaded) { Career.create({ name: 'Sam Rivers', start: 'pro' }, { seed: 7 }); for (let i = 0; i < 4; i++) Career.advance('week'); } showCareer()`],
  ...['calendar', 'rankings', 'stats', 'sponsors', 'shop', 'practice', 'options'].map(p => [`career ${p}`, `showCareer(); felt.careerGo('${p}')`]),
];
const ROOTS = '#setupSheet, #prefsSheet, #helpSheet, #statsSheet, #modesSheet, #careerSheet, #drillSheet';

(async () => {
  const T = await open('', { viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const page = T.page, ev = (f, a) => page.evaluate(f, a);
  await page.waitForTimeout(300);
  const rows = [], sizes = [], seps = [], segs = [];
  for (const [where, go] of SCREENS) {
    await ev(`backToMenu(); ${go}`);
    await page.waitForTimeout(450);   /* a pushed page is in */
    const r = await ev(([ROOTS, RAMP]) => {
      const vis = e => { for (let x = e; x; x = x.parentElement) { const s = getComputedStyle(x); if (s.display === 'none' || s.visibility === 'hidden') return false; } return e.getClientRects().length > 0; };
      const root = [...document.querySelectorAll(ROOTS)].find(s => s.classList.contains('show'));
      if (!root) return { none: true };
      /* 1: the rows of every group */
      const rowEls = [...root.querySelectorAll(':is(.sgrp, .group, .cvForm):not(.about):not(.tbl) > *:not(.foes), .foe, .tutLink')].filter(vis);
      const small = rowEls.map(e => ({ c: e.className || e.tagName, h: +e.getBoundingClientRect().height.toFixed(1) })).filter(x => x.h < 44 - 0.01);
      /* 2: the size of every word shown */
      const off = [];
      for (const e of root.querySelectorAll('*')) {
        if (!vis(e) || e.closest('.ball, .av, svg, canvas, .seg.pop:not(.open)')) continue;
        if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
        const px = parseFloat(getComputedStyle(e).fontSize);
        if (!RAMP.includes(px)) off.push({ c: e.id || e.className || e.tagName, t: e.textContent.trim().slice(0, 24), px });
      }
      /* 3: the separators (a row's ::before drawn as a line) */
      const sep = [];
      for (const e of rowEls.concat([...root.querySelectorAll('.foes > .foe, .setFoot')].filter(vis))) {
        const s = getComputedStyle(e, '::before');
        if (s.content === 'none' || s.display === 'none' || parseFloat(s.height) > 2) continue;
        const m = s.transform === 'none' ? 1 : +s.transform.match(/matrix\(([^)]+)\)/)[1].split(',')[3];
        sep.push({ c: e.className, h: parseFloat(s.height), dev: +(parseFloat(s.height) * m * devicePixelRatio).toFixed(3) });
      }
      /* 4: the segmented controls */
      const sg = [...root.querySelectorAll('.seg:not(.pop)')].filter(vis).map(s => {
        const tr = getComputedStyle(s, '::before'), bs = [...s.querySelectorAll(':scope > button')].filter(vis);
        const on = bs.find(b => b.getAttribute('aria-pressed') === 'true'), th = on ? getComputedStyle(on, '::before') : null;
        return { track: parseFloat(tr.height), trR: parseFloat(tr.borderTopLeftRadius), thumb: th ? parseFloat(th.height) : null, thR: th ? parseFloat(th.borderTopLeftRadius) : null,
          fs: bs.map(b => parseFloat(getComputedStyle(b).fontSize)), fw: bs.map(b => +getComputedStyle(b).fontWeight + (b === on ? 'on' : '')), h: Math.min(...bs.map(b => b.getBoundingClientRect().height)),
          ok: parseFloat(tr.height) === 32 && (!th || parseFloat(th.height) === 28) && bs.every(b => parseFloat(getComputedStyle(b).fontSize) === 13 && +getComputedStyle(b).fontWeight === (b === on ? 600 : 500) && b.getBoundingClientRect().height >= 44) };
      });
      return { small, off, sep, sg };
    }, [ROOTS, RAMP]);
    if (r.none) { rows.push(where + ': no sheet'); continue; }
    for (const x of r.small) rows.push(`${where}: ${x.c} ${x.h}`);
    for (const x of r.off) sizes.push(`${where}: ${x.c} "${x.t}" ${x.px}`);
    for (const x of r.sep) if (x.h !== 1 || Math.abs(x.dev - 1) > 0.01) seps.push(`${where}: ${x.c} ${x.h} px = ${x.dev} device px`);
    for (const x of r.sg) if (!x.ok) segs.push(`${where}: ${JSON.stringify(x)}`);
    if (where === 'setup 8 (CPU)') {
      const n = r.sep.length;
      check('separators found between the setup\'s rows (the opponent, the CPU rows, the table and rules groups)', n >= 5, String(n));
    }
  }
  check('rows: every inset grouped row on every sheet is 44 px or taller', !rows.length, rows.slice(0, 12).join(' | '));
  check('type: every word on every sheet is a size on the Dynamic Type ramp (34 28 22 20 17 16 15 13 12 11)', !sizes.length, sizes.slice(0, 16).join(' | '));
  check('separators: every one is a hairline, one device pixel at 3x', !seps.length, seps.slice(0, 12).join(' | '));
  check('segmented controls: a 32 px track, a 28 px thumb (2 px inset), 13 px words (600 chosen, 500 not), 44 px segments', !segs.length, segs.slice(0, 6).join(' | '));

  /* 6: the setup's header: a Large Title, no eyebrow */
  const head = await ev(() => { backToMenu(); showSetup('8'); return { kicker: !!setupSheet.querySelector('.kicker'), title: getComputedStyle(setupTitle).fontSize, weight: getComputedStyle(setupTitle).fontWeight, sub: getComputedStyle(setupSub).fontSize }; });
  check('setup: the Large Title (34 px, 700) over a Subheadline line (15 px); no eyebrow over it', !head.kicker && head.title === '34px' && +head.weight === 700 && head.sub === '15px', JSON.stringify(head));

  /* 5: the pop-up menu by real taps */
  await ev(() => { backToMenu(); setSetting('table', '7'); setSetting('pockets', 'regulation'); setSetting('cpu', true); showSetup('8'); });
  await page.waitForTimeout(400);
  const btn0 = await ev(() => { const b = tb7.parentElement.nextElementSibling; return { cls: b.className, text: b.textContent.trim(), exp: b.getAttribute('aria-expanded'), hasPop: b.getAttribute('aria-haspopup') }; });
  await openPop(page, '#tb9', { touch: true });
  await page.waitForTimeout(350);   /* the menu's opening scale is over */
  const m1 = await ev(() => {
    const s = tb9.parentElement, r = s.getBoundingClientRect(), b = s.nextElementSibling.getBoundingClientRect(), cs = getComputedStyle(s);
    const items = [...s.querySelectorAll(':scope > button')].map(x => { const q = x.getBoundingClientRect(), c = x.querySelector('.mChk'); return { t: x.textContent.trim(), h: q.height, chk: getComputedStyle(c).visibility, fs: getComputedStyle(x).fontSize }; });
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + 22);
    return { open: s.classList.contains('open'), pos: cs.position, inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, near: Math.abs(r.top - b.bottom) < 12 || Math.abs(r.bottom - b.top) < 12,
      trailing: Math.abs(r.right - b.right) < 1 || r.right <= innerWidth - 7, items, onTop: s.contains(top), exp: s.nextElementSibling.getAttribute('aria-expanded'), blur: cs.backdropFilter, radius: cs.borderTopLeftRadius };
  });
  check('pop-up: the Table row is a pop-up button naming its value ("7 ft Bar"), aria-haspopup', btn0.cls === 'popBtn' && btn0.text === '7 ft Bar' && btn0.hasPop === 'true' && btn0.exp === 'false', JSON.stringify(btn0));
  check('pop-up: a real tap opens the menu: fixed, on top, inside the screen, next to its button, on the blurred material; 44 px items in 17 px Body, the checkmark on 7 ft Bar only',
    m1.open && m1.pos === 'fixed' && m1.onTop && m1.inView && m1.near && m1.trailing && m1.exp === 'true' && /blur/.test(m1.blur) && m1.items.length === 2 && m1.items.every(i => i.h >= 44 && i.fs === '17px')
    && m1.items[0].chk === 'visible' && m1.items[1].chk === 'hidden', JSON.stringify(m1));
  check('pop-up: the open menu: targets 44 px, text 4.5:1', !(await smallTargets(page)).length && !(await lowContrast(page)).length, JSON.stringify([await smallTargets(page), await lowContrast(page)]));
  await choose(page, '#tb9', { touch: true });
  const m2 = await ev(() => ({ open: !!document.querySelector('.seg.pop.open'), s: felt.settings.table, ls: JSON.parse(localStorage.getItem('felt.settings')).table, text: tb9.parentElement.nextElementSibling.textContent.trim(), pressed: tb9.getAttribute('aria-pressed'), sheet: setupSheet.classList.contains('show') }));
  check('pop-up: a real tap on 9 ft Pro picks it: the menu closes, the button says 9 ft Pro, the setting is stored', !m2.open && String(m2.s) === '9' && String(m2.ls) === '9' && m2.text === '9 ft Pro' && m2.pressed === 'true' && m2.sheet, JSON.stringify(m2));
  /* a tap outside (on the Back button, of all places) closes it and does nothing else */
  await openPop(page, '#pkGen', { touch: true });
  const o1 = await ev(() => !!document.querySelector('.seg.pop.open'));
  const back = await ev(() => { const r = setupBack.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.touchscreen.tap(back[0], back[1]);
  await page.waitForTimeout(250);
  const o2 = await ev(() => ({ open: !!document.querySelector('.seg.pop.open'), sheet: setupSheet.classList.contains('show'), p: felt.settings.pockets }));
  check('pop-up: a tap outside the menu (on Back) closes it and does nothing else: the sheet stays, the choice is unchanged', o1 && !o2.open && o2.sheet && o2.p === 'regulation', JSON.stringify([o1, o2]));
  await openPop(page, '#pkGen');
  await page.keyboard.press('Escape');
  const o3 = await ev(() => ({ open: !!document.querySelector('.seg.pop.open'), sheet: setupSheet.classList.contains('show') }));
  check('pop-up: Esc closes the menu, not the sheet', !o3.open && o3.sheet, JSON.stringify(o3));
  await page.reload(); await page.waitForFunction(() => window.booted === true);
  const m3 = await ev(() => { showSetup('8'); return { text: tb9.parentElement.nextElementSibling.textContent.trim(), table: felt.settings.table }; });
  check('pop-up: the pick persists across a reload (the setup opens on 9 ft Pro)', m3.text === '9 ft Pro' && String(m3.table) === '9', JSON.stringify(m3));
  /* the same component in Settings and the modes: a menu opens and picks there too */
  await ev(() => { backToMenu(); showPrefs(); prefsPage('gfx'); });
  await page.waitForTimeout(450);
  await choose(page, '#clRed', { touch: true });
  const c1 = await ev(() => ({ s: felt.settings.cloth, open: !!document.querySelector('.seg.pop.open'), text: clRed.parentElement.nextElementSibling.textContent.trim() }));
  check('pop-up: Settings > Graphics > Cloth picks Red by real taps, the menu closed', c1.s === 'red' && !c1.open && c1.text === 'Red', JSON.stringify(c1));
  await ev(() => { setSetting('cloth', 'green'); backToMenu(); showModes('tsetup'); });
  await page.waitForTimeout(450);
  const g0 = await ev(() => { const s = mdBody.querySelector('.seg.pop'); return s ? [...s.querySelectorAll(':scope > button')].map(b => b.textContent.trim()) : null; });
  await ev(() => { const s = mdBody.querySelector('.seg.pop'); s.querySelector(':scope > button:nth-child(2)').id = '__pick'; });
  await choose(page, '#__pick', { touch: true });
  const g1 = await ev(() => ({ text: mdBody.querySelector('.popBtn').textContent.trim(), open: !!document.querySelector('.seg.pop.open') }));
  check('pop-up: the quick tournament\'s Game is the same pop-up row; a real tap picks the second game', !!g0 && g0.length > 4 && g1.text === g0[1] && !g1.open, JSON.stringify([g0, g1]));
  await T.browser.close();

  /* 6: every footer wholly above the pinned bar, scrolled to: each game's setup, upright and on its side */
  for (const [w, h] of [[393, 852], [375, 667], [852, 393]]) {
    const P = await open('', { viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
    const out = await P.page.evaluate(KINDS => KINDS.flatMap(k => [false, true].map(cpu => {
      backToMenu(); setSetting('cpu', cpu); showSetup(k);
      setupScroll.scrollTop = 1e5;
      const bar = setFoot.getBoundingClientRect(), notes = [...setupSheet.querySelectorAll('.rnote')].filter(n => n.getClientRects().length && n.textContent.trim());
      return { k, cpu, ok: notes.every(n => { const r = n.getBoundingClientRect(); return r.bottom <= bar.top + 0.5 && r.top >= setupScroll.getBoundingClientRect().top - 0.5; }), n: notes.length };
    })), KINDS);
    const bad = out.filter(o => !o.ok);
    check(`footers ${w}x${h}: every setup's group footer (the rules' fine print) sits wholly above the pinned Break bar when scrolled to`, !bad.length && out.some(o => o.n), JSON.stringify(bad));
    /* and the modes' and the career's pinned pages: their last footer above the pinned action */
    const cv = await P.page.evaluate(() => [['tsetup', () => showModes('tsetup'), modesSheet], ['psetup', () => showModes('psetup'), modesSheet], ['create', () => { showCareer(); felt.careerGo('create'); }, careerSheet]].map(([n, go, sh]) => {
      backToMenu(); go();
      const sc = sh.querySelector('.sheet'); sc.scrollTop = 1e5;
      const pin = sh.querySelector('.cvAct.pin'), notes = [...sh.querySelectorAll('.cvNote')].filter(x => x.getClientRects().length);
      const last = notes[notes.length - 1];
      return { n, ok: !pin || !last || last.getBoundingClientRect().bottom <= pin.getBoundingClientRect().top + 0.5 };
    }));
    check(`footers ${w}x${h}: the tournament, party and new career pages' last footer sits above their pinned action`, cv.every(c => c.ok), JSON.stringify(cv));
    check(`${w}x${h}: no page errors`, !P.errors.length, P.errors.join(' | '));
    await P.browser.close();
  }
  check('no page errors', !T.errors.length, T.errors.join(' | '));
  done();
})().catch(e => { console.error(e); process.exit(1); });
