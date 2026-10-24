/* boot-check: the page boots with no console errors and no network beyond itself, opens on
   the menu, starts both games, keeps every button at least 44 px, and fits a phone without
   horizontal scrolling. */
'use strict';
const { check, done, open, smallTargets } = require('./lib.cjs');

(async () => {
  const { browser, page, errors, requests } = await open();
  await page.waitForTimeout(300);

  const origin = new URL(page.url()).origin;
  const foreign = requests.filter(u => !u.startsWith(origin) && !u.startsWith('data:'));
  check('no network requests beyond the page origin', foreign.length === 0, foreign.join(' '));
  check('opens on the menu', await page.evaluate(() => felt.state === 'menu' && getComputedStyle(menu).display !== 'none'));
  check('menu buttons are at least 44 px', (await smallTargets(page)).length === 0, JSON.stringify(await smallTargets(page)));

  await page.click('#play8');
  await page.waitForTimeout(200);
  const e = await page.evaluate(() => ({ s: felt.state, kind: felt.game.kind, balls: felt.game.balls.length, menu: getComputedStyle(menu).display }));
  check('8-ball starts: 16 balls, cue ball in hand in the kitchen', e.kind === '8' && e.balls === 16 && e.s === 'place' && e.menu === 'none', JSON.stringify(e));
  check('game buttons are at least 44 px', (await smallTargets(page)).length === 0, JSON.stringify(await smallTargets(page)));
  const lit = await page.evaluate(() => {
    const c = document.getElementById('table'), d = c.getContext('2d').getImageData(c.width / 2, c.height / 2, 1, 1).data;
    return d[3] === 255 && d[0] + d[1] + d[2] > 30;
  });
  check('the table is drawn', lit);

  await page.click('#menuBtn');
  await page.click('#vsCpu');
  await page.click('#play9');
  await page.waitForTimeout(200);
  const n = await page.evaluate(() => ({ kind: felt.game.kind, balls: felt.game.balls.length, cpu: felt.cpu }));
  check('9-ball vs CPU starts with 10 balls', n.kind === '9' && n.balls === 10 && n.cpu === true, JSON.stringify(n));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const sc = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth }));
  check('no horizontal scroll at 390 px', sc.sw <= sc.w, JSON.stringify(sc));
  check('no console errors', errors.length === 0, errors.join(' | '));

  await browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
