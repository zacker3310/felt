/* qa-check: one regression per finding of the QA pass (F1 to F10, and the note on a CPU game left
   by closing the app). Where the finding was about input, the input is real: a CDP touch or a
   mouse click at the element's centre, never a JS .click(), so a layer that eats the taps fails.
   F1  the exhibition bar (Pause, 1x, 2x, 4x) takes taps and clicks
   F2  text size Large and Larger: the home's cards keep their size and the home scrolls
   F3  the default text size on 375x667: every card's name and line inside the card
   F4  the career card's faces are whole, clear of its title, at every size
   F5  the hidden attribute hides (the call pill's display: flex no longer shows a dead pill)
   F6  Forfeit match and Concede frame take a second tap; Forfeit has a flag, not a home
   F7  the career calendar's Open to you lists only events you can enter
   F8  a party's game over: the winner's name has the others' room
   F9  the home's game cards carry the whole setup (Play again is gone: each setup opens on the
       choices last made, so a game is two taps away again), every card opens its setup by touch
   F10 straight pool's Race to buttons are 44 px at 375x667
   home every game and mode card opens its own setup by a real tap; the setup remembers
   and a CPU game left by closing the app: a one-time notice at the next boot. */
'use strict';
const { check, done, open, smallTargets, lowContrast } = require('./lib.cjs');

const SIZES = { '375x667': [375, 667], '393x852': [393, 852], '440x956': [440, 956], '956x440': [956, 440] };
const phone = (w, h, o = {}) => open('', { viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, ...o });
const settingsInit = s => `try { if (!sessionStorage.getItem('qa.set')) { localStorage.setItem('felt.settings', ${JSON.stringify(JSON.stringify(s))}); sessionStorage.setItem('qa.set', '1'); } } catch (e) { }`;
/* the centre of an element, scrolled into view first */
async function centre(page, sel) {
  const l = page.locator(sel).first();
  await l.scrollIntoViewIfNeeded();
  return page.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
}
const touchAt = async (page, sel) => { const [x, y] = await centre(page, sel); await page.touchscreen.tap(x, y); await page.waitForTimeout(150); };
const clickAt = async (page, sel) => { const [x, y] = await centre(page, sel); await page.mouse.click(x, y); await page.waitForTimeout(150); };
/* what is on top at the element's centre is the element (or inside it) */
const onTop = (page, sel) => page.evaluate(sel => { const b = document.querySelector(sel), r = b.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!t && b.contains(t); }, sel);

/* the home's measures: each card's box (the eight games, the four modes), its words inside it and
   not cut, the career's faces, the game cards on the first screen, the page's scroll */
const homeFit = page => page.evaluate(() => {
  const R = e => e.getBoundingClientRect(), bad = [];
  const inside = (a, b, s = 0.5) => a.left >= b.left - s && a.right <= b.right + s && a.top >= b.top - s && a.bottom <= b.bottom + s;
  const cards = [...document.querySelectorAll('#playRow > button, #modeRow > button')];
  for (const c of cards) {
    const r = R(c);
    if (r.height < 44 || r.width < 44) bad.push(c.id + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    for (const w of c.querySelectorAll('.tt b, .tt small')) {
      if (!w.getClientRects().length) continue;
      if (!inside(R(w), r)) bad.push(c.id + ' words outside: ' + w.textContent);
      if (w.scrollWidth > w.clientWidth + 1) bad.push(c.id + ' words cut: ' + w.textContent);
    }
  }
  /* the career card: each face whole inside the card and its box, above the title */
  const cc = careerBtn, cr = R(cc), title = R(cc.querySelector('.tt b'));
  for (const a of careerAvs.querySelectorAll('.av')) {
    const ar = R(a);
    if (!inside(ar, cr) || !inside(ar, R(careerAvs), 3.5)) bad.push('career face clipped');
    if (ar.bottom > title.top + 1) bad.push('career face over the title ' + Math.round(ar.bottom) + '>' + Math.round(title.top));
  }
  for (const b of cards) if (R(b).right > innerWidth + 0.5 || R(b).left < -0.5) bad.push(b.id + ' overflows');
  const tiles = cards.map(c => Math.round(R(c).height)), games = [...playRow.children].map(R);
  return { bad, tiles, first: menu.scrollTop === 0 && games.length === 8 && games.every(r => r.top >= 0 && r.bottom <= innerHeight + 0.5), sh: menu.scrollHeight, ch: menu.clientHeight, sw: Math.max(menu.scrollWidth - menu.clientWidth, document.documentElement.scrollWidth - innerWidth), text: document.documentElement.dataset.text };
});

(async () => {
  /* ---------- F2, F3, F4: the home at four sizes and three text sizes ---------- */
  for (const [tag, [w, h]] of Object.entries(SIZES)) for (const ts of [100, 115, 130]) {
    const T = await phone(w, h, { init: settingsInit({ sv: 3, text: ts }) });
    await T.page.waitForTimeout(300);
    const f = await homeFit(T.page);
    check(`home ${tag}, text ${ts}%: every card 44 px or more, its name and line inside it and whole; the career faces whole; no card past the edge; no sideways scroll`,
      f.text === String(ts) && !f.bad.length && f.sw <= 1, JSON.stringify(f));
    if (ts === 100 && h > 800) check(`home ${tag} at the default text size: all eight game cards on the first screen, no scrolling needed; the modes and solo list scroll`, f.first && f.sh > f.ch, JSON.stringify(f));
    if (ts === 100 && tag === '375x667') check('home 375x667 (F3): the cards are at least 62 px (were 48), so it scrolls a little', Math.min(...f.tiles) >= 61 && f.sh > f.ch, JSON.stringify(f.tiles));
    if (ts > 100 && w < 500) {
      /* the last solo row comes into view by scrolling, and a card is tapped where it is */
      await T.page.evaluate(() => { menu.scrollTop = 1e6; });
      const end = await T.page.evaluate(() => { const r = dailyBtn.getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.top >= 0; });
      check(`home ${tag}, text ${ts}%: it scrolls to the last row (Daily shot)`, end && f.sh > f.ch);
      await touchAt(T.page, '#playS');
      check(`home ${tag}, text ${ts}%: a real tap on Snooker opens its setup`, await T.page.evaluate(() => setupSheet.classList.contains('show') && setupSheet.dataset.kind === 'snooker'));
    }
    check(`home ${tag}, text ${ts}%: no page errors`, !T.errors.length, T.errors.join(' | '));
    await T.browser.close();
  }

  const T = await phone(375, 667);
  const { page, errors } = T;
  const ev = (f, a) => page.evaluate(f, a);

  /* ---------- F9: the setup in full on each game card, and the setup remembered ---------- */
  await ev(() => { setSetting('cpu', true); setSetting('level', 'medium'); setSetting('table', 9); setSetting('pockets', 'generous'); setSetting('rules8', '8-wpa'); setSetting('last', '8'); syncMenu(); });
  const lab = await ev(() => play8.getAttribute('aria-label'));
  check('F9: the 8-ball card names the whole setup it opens on for a screen reader', lab === '8-ball vs Regular (CPU medium), 9 ft, generous, WPA', lab);
  await ev(() => { setSetting('cpu', false); setSetting('table', 7); setSetting('pockets', 'regulation'); setSetting('rules8', '8-house'); syncMenu(); });

  /* ---------- F10: straight pool's races ---------- */
  await touchAt(page, '#playStr');
  const races = await ev(() => ['rc25', 'rc50', 'rc100', 'rc150'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return Math.round(Math.min(r.width, r.height)); }));
  check('F10: straight pool\'s Race to buttons are 44 px or more at 375x667', races.every(s => s >= 44), JSON.stringify(races));
  check('F10: the straight pool setup has no target under 44 px', !(await smallTargets(page)).length, JSON.stringify(await smallTargets(page)));
  await ev(() => backToMenu());

  /* ---------- F1: the exhibition bar takes real taps and clicks ---------- */
  await ev(() => felt.exhibition({ kind: '9', a: { level: 'easy', arch: 'potter' }, b: { level: 'easy', arch: 'defender' }, seed: 5 }));
  await page.waitForTimeout(300);
  check('F1: each exhibition button is on top at its centre (not the table)', (await Promise.all(['#exPause', '#exS1', '#exS2', '#exS4'].map(s => onTop(page, s)))).every(Boolean));
  await touchAt(page, '#exS4');
  const s4 = await ev(() => [exS4.getAttribute('aria-pressed'), felt.speed]);
  check('F1: a touch tap on 4x sets 4x', s4[0] === 'true' && s4[1] === 4, JSON.stringify(s4));
  await clickAt(page, '#exS2');
  const s2 = await ev(() => [exS2.getAttribute('aria-pressed'), felt.speed]);
  check('F1: a mouse click on 2x sets 2x', s2[0] === 'true' && s2[1] === 2, JSON.stringify(s2));
  await touchAt(page, '#exPause');
  check('F1: a touch tap on Pause pauses (the pause menu shows)', await ev(() => felt.paused && menu.classList.contains('show')));
  await ev(() => felt.quitToHome());

  /* ---------- F5: the hidden attribute hides, over a display rule ---------- */
  const hid = await ev(() => {
    callBar.hidden = false; callPill.hidden = true;
    const pill = getComputedStyle(callPill).display;
    callBar.hidden = true; callPill.hidden = false;
    const shown = [...document.querySelectorAll('[hidden]')].filter(e => getComputedStyle(e).display !== 'none').map(e => e.id || e.className);
    return { pill, shown };
  });
  check('F5: a hidden call pill is not displayed (no dead "Call your shot"), and no hidden element anywhere is', hid.pill === 'none' && !hid.shown.length, JSON.stringify(hid));

  /* ---------- F6: snooker's Concede frame takes a second tap ---------- */
  await ev(() => { felt.start('snooker'); felt.pause(); });
  await page.waitForTimeout(150);
  await touchAt(page, '#concedeBtn');
  const c1 = await ev(() => ({ st: felt.state, w: felt.game.winner, txt: concedeBtn.textContent.trim(), arm: concedeBtn.classList.contains('arm'), menu: menu.classList.contains('show') }));
  check('F6: one tap on Concede frame only arms it ("Tap again to concede"); the frame goes on', c1.w === null && c1.menu && c1.arm && c1.txt === 'Tap again to concede', JSON.stringify(c1));
  const a6 = { small: await smallTargets(page), low: await lowContrast(page) };
  check('F6: the armed pause menu: 44 px, 4.5:1', !a6.small.length && !a6.low.length, JSON.stringify(a6));
  await page.waitForTimeout(4300);
  const c2 = await ev(() => ({ txt: concedeBtn.textContent.trim(), arm: concedeBtn.classList.contains('arm') }));
  check('F6: left alone, it disarms after a few seconds', !c2.arm && c2.txt === 'Concede frame', JSON.stringify(c2));
  await touchAt(page, '#concedeBtn'); await touchAt(page, '#concedeBtn');
  await page.waitForTimeout(200);
  check('F6: two taps concede the frame', await ev(() => felt.state === 'over' && felt.game.winner !== null));
  await ev(() => felt.quitToHome());

  /* ---------- F6: a tournament match's Forfeit match ---------- */
  await ev(() => { felt.tourneyCreate({ kind: '9', size: 4, fmt: 'single', race: 2, field: 'easy', seed: 4 }); felt.tourneyPlay(); felt.pause(); });
  await page.waitForTimeout(150);
  const q0 = await ev(() => ({ txt: exitBtn.textContent.trim(), flag: /M6 21V4/.test(exitBtn.querySelector('svg').innerHTML), home: /M4 11 12 4/.test(exitBtn.querySelector('svg').innerHTML) }));
  check('F6: in a tournament match the pause menu says Forfeit match, with a flag (not the home icon)', q0.txt === 'Forfeit match' && q0.flag && !q0.home, JSON.stringify(q0));
  await touchAt(page, '#exitBtn');
  const q1 = await ev(() => ({ mode: felt.mode, txt: exitBtn.textContent.trim(), done: felt.tourney && felt.tourney.done, menu: menu.classList.contains('show') }));
  check('F6: one tap on Forfeit match only arms it; the match and the tournament go on', q1.mode === 'tourney' && q1.txt === 'Tap again to forfeit' && !q1.done && q1.menu, JSON.stringify(q1));
  await touchAt(page, '#resumeBtn');
  await ev(() => felt.pause());
  check('F6: resuming disarms it', await ev(() => exitBtn.textContent.trim() === 'Forfeit match' && !exitBtn.classList.contains('arm')));
  await touchAt(page, '#exitBtn'); await touchAt(page, '#exitBtn');
  check('F6: two taps forfeit the match', await ev(() => felt.mode === null && felt.state === 'menu'));
  await ev(() => { backToMenu(); felt.start('8'); felt.pause(); });
  const q2 = await ev(() => ({ txt: exitBtn.textContent.trim(), home: /M4 11 12 4/.test(exitBtn.querySelector('svg').innerHTML) }));
  check('F6: an ordinary game: Quit to home with the home icon, one tap', q2.txt === 'Quit to home' && q2.home, JSON.stringify(q2));
  await touchAt(page, '#exitBtn');
  check('F6: Quit to home goes at once', await ev(() => felt.state === 'menu' && !felt.paused));

  /* ---------- F6 and F7: the career ---------- */
  const made = await ev(() => Career.create({ name: 'Sam Rivers', nick: '', nat: 'IE', town: '', hand: 'right', disc: '9', style: Object.keys(Career.STYLES)[0], difficulty: 'medium', start: 'novice', age: 20 }));
  check('career: created', made && made.ok, JSON.stringify(made));
  await ev(() => { felt.showCareer(); felt.careerGo('calendar'); });
  await page.waitForTimeout(450);
  const cal = await ev(() => ({ rows: cvBody.querySelectorAll('.topic').length, bad: cvBody.querySelectorAll('.val.bad').length, ok: Career.availableEvents().filter(e => e.eligibility.ok).length, all: Career.availableEvents().length }));
  check('F7: Open to you lists only the events you can enter (the hub\'s count), none marked Not eligible', cal.rows === cal.ok && cal.bad === 0 && cal.all > cal.ok, JSON.stringify(cal));
  await page.getByRole('button', { name: 'All', exact: true }).tap();
  await page.waitForTimeout(300);
  const calAll = await ev(() => ({ rows: cvBody.querySelectorAll('.topic').length, bad: cvBody.querySelectorAll('.val.bad').length, why: /Tier|tier|credits/.test(cvBody.textContent) }));
  check('F7: All lists the season, the events you cannot enter marked with why', calAll.rows > cal.rows && calAll.bad > 0 && calAll.why, JSON.stringify(calAll));
  const entered = await ev(() => { const e = Career.availableEvents().find(e => e.eligibility.ok && e.live && e.kind !== 'league'); return !!e && Career.enter(e.id).ok; });
  check('career: an event entered', entered);
  let guard = 0;
  while (!(await ev(() => !!Career.nextMatch())) && guard++ < 20) await ev(() => felt.careerAdvance('week'));
  const played = await ev(() => felt.careerPlay());
  await page.waitForTimeout(200);
  await ev(() => felt.pause());
  await page.waitForTimeout(150);
  const lost0 = await ev(() => Career.stats().all.lost);
  await touchAt(page, '#exitBtn');
  const k1 = await ev(() => ({ m: !!felt.careerMatch, txt: exitBtn.textContent.trim(), flag: /M6 21V4/.test(exitBtn.querySelector('svg').innerHTML) }));
  check('F6: a career match: one tap on Forfeit match only arms it (flag icon); the match goes on', played && k1.m && k1.txt === 'Tap again to forfeit' && k1.flag, JSON.stringify(k1));
  await touchAt(page, '#exitBtn');
  const k2 = await ev(() => ({ m: felt.careerMatch, lost: Career.stats().all.lost, st: felt.state }));
  check('F6: the second tap forfeits it (a loss)', k2.m === null && k2.lost === lost0 + 1 && k2.st === 'menu', JSON.stringify(k2));

  /* ---------- F8: a party's game over at 375 wide ---------- */
  await ev(() => { backToMenu(); felt.party({ ruleset: '9-ring', names: ['', '', ''] }); });
  await page.waitForTimeout(200);
  await ev(() => felt.forceWin(0));
  await page.waitForTimeout(500);
  const p8 = await ev(() => ({ over: over.classList.contains('show'), heads: [...overStats.querySelectorAll('thead th')].filter(t => t.textContent).map(t => ({ t: t.textContent, cut: t.scrollWidth > t.clientWidth + 1, win: t.classList.contains('win') })) }));
  check('F8: the party\'s game over: no player\'s name cut, the winner\'s marked', p8.over && p8.heads.length === 3 && p8.heads.every(x => !x.cut) && p8.heads.some(x => x.win), JSON.stringify(p8));
  const l8 = await lowContrast(page);
  check('F8: the game over text 4.5:1', !l8.length, JSON.stringify(l8));
  check('no page errors', !errors.length, errors.join(' | '));
  await T.browser.close();

  /* ---------- the note: a CPU game left by closing the app ---------- */
  const N = await phone(393, 852, { init: `try { if (!sessionStorage.getItem('qa.ab')) { localStorage.setItem('felt.abandon.v1', '{"kind":"9","level":"hard"}'); sessionStorage.setItem('qa.ab', '1'); } } catch (e) { }` });
  const n0 = await N.page.evaluate(() => ({ shown: !leftNote.hidden && !!leftNote.getClientRects().length, text: leftNote.textContent, l: felt.record.kinds['9'].cpu.hard.l, mark: localStorage.getItem('felt.abandon.v1') }));
  check('note: at the boot after a CPU game left by closing the app, a notice says it counted as a loss (the loss counted, the marker gone)',
    n0.shown && /left unfinished and counted as a loss/.test(n0.text) && n0.l === 1 && n0.mark === null, JSON.stringify(n0));
  const a9 = { small: await smallTargets(N.page), low: await lowContrast(N.page) };
  check('note: 44 px, 4.5:1', !a9.small.length && !a9.low.length, JSON.stringify(a9));
  check('note: it blocks nothing (Settings still takes a tap)', await onTop(N.page, '#prefsBtn'));
  await touchAt(N.page, '#leftOk');
  check('note: OK puts it away', await N.page.evaluate(() => leftNote.hidden));
  await N.page.reload(); await N.page.waitForFunction(() => window.booted === true);
  check('note: once only (not at the next boot)', await N.page.evaluate(() => leftNote.hidden && felt.record.kinds['9'].cpu.hard.l === 1));
  check('note: no page errors', !N.errors.length, N.errors.join(' | '));
  await N.browser.close();
  /* ---------- the home (build 2026-10-28c): every game and every mode a card, by a real tap ---------- */
  const H = await phone(393, 852);
  const hp = H.page, hev = (f, a) => hp.evaluate(f, a);
  await hp.waitForTimeout(300);
  check('home 393x852: no Play again hero, no More games or More modes row', await hev(() => !['againBtn', 'playMore', 'playModes', 'moreSheet'].some(id => document.getElementById(id))));
  const GAMES = [['#play8', '8'], ['#play9', '9'], ['#play10', '10'], ['#playStr', 'straight'], ['#playRot', 'rotation'], ['#playS', 'snooker'], ['#playC', 'carom'], ['#playB', 'bumper']];
  const opened = [];
  for (const [sel, kind] of GAMES) {
    await hev(() => { menu.scrollTop = 0; });
    const seen = await hev(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }, sel);
    await touchAt(hp, sel);
    const o = await hev(() => ({ open: setupSheet.classList.contains('show'), kind: setupSheet.dataset.kind, title: setupTitle.textContent }));
    await touchAt(hp, '#setupBack');
    const back = await hev(() => menu.classList.contains('show') && !setupSheet.classList.contains('show'));
    opened.push({ sel, kind, seen, ...o, back });
  }
  check('home 393x852: a real tap on each of the eight game cards (each on screen without scrolling) opens that game\'s setup; Back goes straight home',
    opened.every(o => o.seen && o.open && o.back) && opened.every((o, i) => o.kind === GAMES[i][1]), JSON.stringify(opened));
  const MODES = [['#careerBtn', 'careerSheet', null], ['#modeTour', 'modesSheet', 'tsetup'], ['#modeEx', 'modesSheet', 'exsetup'], ['#modeParty', 'modesSheet', 'psetup']];
  const mo = [];
  for (const [sel, sheet, pg] of MODES) {
    await touchAt(hp, sel);
    await hp.waitForTimeout(150);
    const o = await hev(([sheet, pg]) => ({ open: document.getElementById(sheet).classList.contains('show'), page: pg ? mdBody.dataset.page : null, depth: pg ? md.stack.length : null }), [sheet, pg]);
    if (pg) { await touchAt(hp, '#modesBack'); o.back = await hev(() => menu.classList.contains('show') && !modesSheet.classList.contains('show')); }
    else { await hev(() => backToMenu()); o.back = true; }
    mo.push({ sel, ...o, want: pg });
  }
  check('home 393x852: a real tap on Career, Quick tournament, AI exhibition and Party opens each one\'s own page directly (no list between); Back goes straight home',
    mo.every(o => o.open && o.page === o.want && (o.want ? o.depth === 1 : true) && o.back), JSON.stringify(mo));
  await touchAt(hp, '#drillsRow');
  const d1 = await hev(() => ({ open: drillSheet.classList.contains('show'), list: !drillList.hidden }));
  await touchAt(hp, '#drillBack');
  const d2 = await hev(() => ({ home: menu.classList.contains('show'), drills: drillSheet.classList.contains('show'), prac: prac.classList.contains('show') }));
  check('home 393x852: a real tap on Drills opens the drill list, and Back goes home', d1.open && d1.list && d2.home && !d2.drills && !d2.prac, JSON.stringify([d1, d2]));
  /* the setup remembers: choices made by taps in one game's setup are where it opens next time,
     after a reload too (Play again's one-tap convenience lives on as card, Break) */
  await touchAt(hp, '#play9');
  for (const sel of ['#vsCpu', '#lvHard', '#tb9', '#pkGen', '#rs9Wpa']) await touchAt(hp, sel);
  await touchAt(hp, '#breakBtn');
  await hp.waitForTimeout(300);
  const st = await hev(() => felt.game.kind);
  await hev(() => felt.quitToHome());
  await hp.reload(); await hp.waitForFunction(() => window.booted === true);
  await hp.waitForTimeout(300);
  await touchAt(hp, '#play9');
  const mem = await hev(() => ['vsCpu', 'lvHard', 'tb9', 'pkGen', 'rs9Wpa'].map(id => document.getElementById(id).getAttribute('aria-pressed')));
  check('setup remembers: 9-ball set up by taps (CPU, Hustler, 9 ft, generous, WPA) opens on the same choices after a reload', st === '9' && mem.every(v => v === 'true'), JSON.stringify({ st, mem }));
  await hev(() => backToMenu());
  await touchAt(hp, '#play8');
  const mem8 = await hev(() => ['vsCpu', 'lvHard', 'tb9', 'pkGen'].map(id => document.getElementById(id).getAttribute('aria-pressed')));
  check('setup remembers: the opponent and table carry to the other games\' setups too (as Play again had them)', mem8.every(v => v === 'true'), JSON.stringify(mem8));
  check('home taps: no page errors', !H.errors.length, H.errors.join(' | '));
  await H.browser.close();
  /* 440x956: the eight games on the first screen too */
  const H2 = await phone(440, 956);
  await H2.page.waitForTimeout(300);
  const g440 = await H2.page.evaluate(() => [...playRow.children].map(b => { const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
  check('home 440x956: all eight game cards on screen without scrolling', g440.length === 8 && g440.every(Boolean), JSON.stringify(g440));
  await touchAt(H2.page, '#playRot');
  check('home 440x956: a real tap on Rotation opens its setup', await H2.page.evaluate(() => setupSheet.classList.contains('show') && setupSheet.dataset.kind === 'rotation'));
  await H2.browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
