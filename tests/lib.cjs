/* lib: what every suite shares. check() prints PASS/FAIL lines and done() prints the
   "N/M passed" trailer run-all parses. open() launches Chromium with software rendering,
   records console errors and network requests, and waits for boot. Taken from puttX. */
'use strict';
const URL = process.env.FELT_URL || 'http://127.0.0.1:4173/index.html';
const results = [];

function check(name, ok, detail) {
  results.push(!!ok);
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  -- ' + detail : ''));
}
function done() {
  const p = results.filter(Boolean).length;
  console.log(`\n${p}/${results.length} passed`);
  process.exit(p === results.length ? 0 : 1);
}
async function open(query = '', { viewport = { width: 1280, height: 800 }, hasTouch = false } = {}) {
  const pw = require('playwright-core');
  const browser = await pw.chromium.launch({
    executablePath: process.env.CHROMIUM || pw.chromium.executablePath(),
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport, hasTouch });
  const errors = [], requests = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => requests.push(r.url()));
  await page.goto(URL + query);
  await page.waitForFunction(() => window.booted === true, null, { timeout: 20000 });
  return { browser, page, errors, requests };
}
/* visible buttons smaller than `min` CSS px on either side */
const smallTargets = (page, min = 44) => page.evaluate(min => [...document.querySelectorAll('button')]
  .filter(b => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden')
  .map(b => { const r = b.getBoundingClientRect(); return { id: b.id || b.className, s: Math.round(Math.min(r.width, r.height)) }; })
  .filter(t => t.s < min), min);
/* wait until the table has settled back to an idle state */
const settled = (page, timeout = 30000) => page.waitForFunction(() => felt.state !== 'rolling' && felt.state !== 'thinking', null, { timeout });

module.exports = { URL, check, done, open, smallTargets, settled };
