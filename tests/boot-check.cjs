/* boot-check: the page boots with no console errors and no network beyond itself, opens on
   the menu, starts both games, keeps every target at least 44 px and every text at 4.5:1, and
   on a phone fills the width with the table, keeps the controls off it and never scrolls
   sideways. */
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
  await page.click('#how summary');
  check('menu text is 4.5:1 or better, how-to open', (await lowContrast(page)).length === 0, JSON.stringify(await lowContrast(page)));

  await page.click('#play8');
  await page.waitForTimeout(200);
  const e = await page.evaluate(() => ({ s: felt.state, kind: felt.game.kind, balls: felt.game.balls.length, menu: getComputedStyle(menu).display }));
  check('8-ball starts: 16 balls, cue ball in hand in the kitchen', e.kind === '8' && e.balls === 16 && e.s === 'place' && e.menu === 'none', JSON.stringify(e));
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
    const t = felt.tableRect(), c = ctl.getBoundingClientRect(), h = hudBar.getBoundingClientRect();
    return { w: t.right - t.left, vw: innerWidth, layout: document.documentElement.dataset.layout, portrait: felt.view.portrait, gapBelow: c.top - t.bottom, gapAbove: t.top - h.bottom, inside: t.left >= 0 && t.right <= innerWidth };
  });
  check('phone portrait: the table is at least 85% of the viewport width', ph.w >= 0.85 * ph.vw && ph.portrait && ph.layout === 'portrait' && ph.inside, JSON.stringify(ph));
  check('phone portrait: hud above and controls below never overlap the table', ph.gapBelow >= 0 && ph.gapAbove >= 0, JSON.stringify(ph));
  check('phone targets are at least 44 px', (await smallTargets(page)).length === 0, JSON.stringify(await smallTargets(page)));
  check('phone text is 4.5:1 or better', (await lowContrast(page)).length === 0, JSON.stringify(await lowContrast(page)));

  /* phone landscape: the table is as big as the height allows, controls to the side */
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(300);
  const ls = await page.evaluate(() => {
    const t = felt.tableRect(), c = ctl.getBoundingClientRect();
    return { h: t.bottom - t.top, vh: innerHeight, overlap: c.left < t.right, sw: document.documentElement.scrollWidth, w: innerWidth };
  });
  check('phone landscape: the table takes most of the height, controls beside it', ls.h >= 0.8 * ls.vh && !ls.overlap && ls.sw <= ls.w, JSON.stringify(ls));

  /* the tray strip: in every layout, outside the table and the controls, inside the screen,
     tall enough for balls at least 16 px across */
  const trays = [];
  for (const [w, h] of [[1280, 800], [1920, 1080], [390, 844], [375, 667], [844, 390], [768, 1024]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(150);
    trays.push(await page.evaluate(() => {
      const T = felt.view.tray, t = felt.tableRect(), c = ctl.getBoundingClientRect();
      const hit = (a, b) => a.x < b.right && a.x + a.w > b.left && a.y < b.bottom && a.y + a.h > b.top;
      return { size: innerWidth + 'x' + innerHeight, T, ok: !!T && T.h >= 22 && T.w >= 15 * (T.h - 4) * 0.8 && !hit(T, t) && !hit(T, c) && T.x >= 0 && T.y >= 0 && T.x + T.w <= innerWidth && T.y + T.h <= innerHeight };
    }));
  }
  check('view.tray: a strip outside the table and the controls in every layout, balls 16 px or more', trays.every(r => r.ok), JSON.stringify(trays.filter(r => !r.ok)));

  /* short landscape: a card's ball dots wrap rather than clip */
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => { felt.start('8'); game.groups = ['solids', 'stripes']; game.open = false; hud(); });
  const clip = await page.evaluate(() => [0, 1].map(p => {
    const card = document.getElementById('p' + p).getBoundingClientRect();
    const dots = [...document.querySelectorAll(`#p${p}dots .dot`)].map(d => d.getBoundingClientRect());
    return { n: dots.length, inside: dots.every(d => d.left >= card.left && d.right <= card.right && d.top >= card.top && d.bottom <= card.bottom) };
  }));
  check('short landscape: all seven group dots show inside each card', clip.every(c => c.n === 7 && c.inside), JSON.stringify(clip));

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
      none: ['html', 'body', '#table', '#ui', '#hudBar', '#ctl', '#menuBtn', '#spinLabel', '#spinPad', '#powerBar', '#banner', '#trayBand'].map(ta),
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
  check('phone: no console errors', ph3.errors.length === 0, ph3.errors.join(' | '));
  await ph3.browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
