/* lib: what every suite shares. check() prints PASS/FAIL lines and done() prints the
   "N/M passed" trailer run-all parses. open() launches Chromium with software rendering,
   records console errors and network requests, and waits for boot (firstRun: true keeps the
   first-run lesson offer and the tutorials' first-Break offers, which every other suite skips).
   Taken from puttX. */
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
async function open(query = '', { viewport = { width: 1280, height: 800 }, hasTouch = false, isMobile = false, deviceScaleFactor = 1, screen, init, firstRun = false } = {}) {
  const pw = require('playwright-core');
  const browser = await pw.chromium.launch({
    executablePath: process.env.CHROMIUM || pw.chromium.executablePath(),
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport, hasTouch, isMobile, deviceScaleFactor, ...(screen ? { screen } : {}) });
  /* the first-run lesson offer (a sheet over home) stays out of every suite but the one that
     asks for a first run: as if it had been seen, unless the page has its own record */
  if (!firstRun) await page.addInitScript(() => { try { if (!localStorage.getItem('felt.lesson.v1')) localStorage.setItem('felt.lesson.v1', '{"v":1,"seen":true,"done":false}'); } catch (e) { } });
  /* likewise each game's tutorial offer on its first Break: as if turned down for every game */
  if (!firstRun) await page.addInitScript(() => { try { if (!localStorage.getItem('felt.tutorials.v1')) localStorage.setItem('felt.tutorials.v1', '{"v":1,"done":{},"skipped":{"8":true,"9":true,"bumper":true,"carom":true,"snooker":true},"never":false}'); } catch (e) { } });
  if (init) await page.addInitScript(init);
  const errors = [], requests = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => requests.push(r.url()));
  await page.goto(URL + query);
  await page.waitForFunction(() => window.booted === true, null, { timeout: 20000 });
  return { browser, page, errors, requests };
}
/* visible buttons, sliders and disclosure toggles smaller than `min` CSS px on either side */
const smallTargets = (page, min = 44) => page.evaluate(min => [...document.querySelectorAll('button, [role="slider"], summary')]
  .filter(b => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden')
  .map(b => { const r = b.getBoundingClientRect(); return { id: b.id || b.className, s: Math.round(Math.min(r.width, r.height)) }; })
  .filter(t => t.s < min), min);
/* wait until the table has settled back to an idle state */
const settled = (page, timeout = 30000) => page.waitForFunction(() => !['stroke', 'rolling', 'thinking'].includes(felt.state), null, { timeout });
/* visible text below 4.5:1 against what is behind it: each element's own text colour against
   its backgrounds composited up the tree onto the page colour. Text over the bare canvas is
   measured against the page colour. Large text (24 px, or 18.66 px bold) needs 3:1. */
const lowContrast = (page, min = 4.5) => page.evaluate(min => {
  const rgba = c => { const m = c.match(/[\d.]+/g).map(Number); return [m[0], m[1], m[2], m.length > 3 ? m[3] : 1]; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const over = (top, under) => [0, 1, 2].map(i => top[i] * top[3] + under[i] * (1 - top[3]));
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!el.getClientRects().length || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const layers = [];
    let hidden = false;
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.display === 'none' || +s.opacity === 0) hidden = true;
      layers.push(rgba(s.backgroundColor));
    }
    if (hidden) continue;
    let bg = rgba(getComputedStyle(document.body).backgroundColor);
    for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg);
    const fg = over(rgba(cs.color), bg), a = lum(fg), b = lum(bg), r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const px = parseFloat(cs.fontSize), large = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700);   /* WCAG large text: 3:1 */
    if (r < (large ? Math.min(min, 3) : min)) out.push({ id: el.id || el.className || el.tagName, text: el.textContent.trim().slice(0, 30), r: +r.toFixed(2) });
  }
  return out;
}, min);
/* visible titles with a word in lower case that Title Case (Apple's HIG) capitalizes: the home's
   cards and sections, sheet titles and group heads, list rows, switches, segmented choices, field
   labels, rule heads and button labels. Allowed in lower case: articles, and, but, or, nor and the
   prepositions of three letters or fewer (not first, last or after a colon), the second part of a
   hyphenated small word ("Head-to-Head"), words with a digit (14.1, 2x), units (ft, cr), "vs" and
   the brand "felt". Kickers render in caps, and a heading that is a sentence (it ends . ? or !, or
   is one of the result lines below, or is marked .prose) is sentence case and not looked at. */
const TITLE_SEL = ['#menu .tt > b', '.sect', 'h1', '.sheet h2', 'h3.ghead', 'h3.fineHead', 'h3.cvHead', '.topic .tt > b', '.cvSw .tt > b',
  '.tog > span', '.plab', '.tutLink .tt', '.seg > button', '.field > .label', '.rules li > div > b', '.pick .game b', '.foe > b', '.tcard b', 'label.prow .plab',
  'button.big', 'button.ghost', 'button.quiet', 'button.act', 'button.cvBtn', 'button.cvMini', 'button.tool', 'button.cflag', 'button.lessonGo > span', '.howAct > button', '#exBar button',
  '#optHead', '#optBtns button', '#coachBtn', '.kpis dt', '.cvFacts dt', '.cvLines li > span:first-child', '.stat > span', '.ccSum + .tt b'];
const TITLE_SKIP = ['overText', 'matchTitle', 'hoTitle', 'trickHead', 'drillHead', 'tutDoneTitle', 'tutOfferTitle', 'offerTitle', 'doneTitle', 'mdEndT'];
const badTitles = page => page.evaluate(([SEL, SKIP]) => {
  const small = /^(a|an|the|and|but|or|nor|as|at|by|for|in|of|off|on|per|to|up|via)$/, keep = /^(felt|ft|mm|cr|x|pts|vs)$/;
  const seen = new Set(), out = [];
  const shown = e => { for (let x = e; x; x = x.parentElement) { const s = getComputedStyle(x); if (s.display === 'none' || s.visibility === 'hidden' || x.hidden) return false; } return e.getClientRects().length > 0; };
  const own = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
  for (const e of document.querySelectorAll(SEL.join(','))) {
    if (seen.has(e)) continue;
    seen.add(e);
    if (!shown(e) || e.closest('.prose, .kicker, .arm') || SKIP.some(id => e.id === id || (e.parentElement && e.parentElement.id === id))) continue;
    const t = own(e);
    if (!/[a-z]/.test(t) || /[.?!]["')]?$/.test(t)) continue;
    const toks = t.split(' ').filter(w => /[A-Za-z0-9]/.test(w)), wrong = [];
    toks.forEach((w, i) => {
      const edge = i === 0 || i === toks.length - 1 || /:$/.test(toks[i - 1]);
      w.split('-').forEach((p, j) => {
        const c = p.replace(/^[^A-Za-z0-9]+/, ''), core = c.replace(/[^A-Za-z0-9']+$/, '').toLowerCase();
        if (!/^[a-z]/.test(c) || /[0-9]/.test(c) || keep.test(core)) return;
        if (small.test(core) && !(edge && j === 0)) return;
        wrong.push(p);
      });
    });
    if (wrong.length) out.push({ id: e.id || (e.closest('[id]') || {}).id || e.className, text: t, wrong });
  }
  return out;
}, [TITLE_SEL, TITLE_SKIP]);

module.exports = { URL, check, done, open, smallTargets, settled, lowContrast, badTitles };
