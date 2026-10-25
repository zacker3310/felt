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
  check('no console errors', errors.length === 0, errors.join(' | '));

  await browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
