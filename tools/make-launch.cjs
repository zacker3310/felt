#!/usr/bin/env node
/* make-launch: the launch images iOS shows while the home-screen app starts (apple-touch-startup-
   image), one per current iPhone screen, upright and on its side. Each is the home's own first
   frame: index.html itself rendered in headless Chromium with scripts off, at the phone's size,
   pixel ratio and safe-area insets (the page's --sat/--sab/--sal/--sar), with everything but the
   background and the felt. wordmark hidden. So the launch image, the first paint (the markup and
   the CSS come before the script) and the home all put the wordmark on the same pixels over the
   same colour, and the cards then rise in under it: no blank flash, no jump.
   Offline and deterministic for a given Chromium and font (the suites' Inter, see
   tests/fonts/prefer-inter.conf). Writes icons/launch/*.png, rewrites the link block in
   index.html (between <!-- launch:begin --> and <!-- launch:end -->) and the precache entries in
   sw.js (between the launch markers). Bump sw.js VERSION when the list changes.

   Usage: node tools/make-launch.cjs        (npm run launch) */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'icons', 'launch');
/* CSS points, pixel ratio, the top inset upright (the side insets on its side), home indicator */
const PHONES = [
  [375, 667, 2, 20, 0, 'iPhone SE (2nd, 3rd), 8'],
  [414, 736, 3, 20, 0, 'iPhone 8 Plus'],
  [375, 812, 3, 47, 34, 'iPhone X, XS, 11 Pro, 12 mini, 13 mini'],
  [414, 896, 2, 48, 34, 'iPhone XR, 11'],
  [414, 896, 3, 44, 34, 'iPhone XS Max, 11 Pro Max'],
  [390, 844, 3, 47, 34, 'iPhone 12, 13, 14, 16e'],
  [428, 926, 3, 47, 34, 'iPhone 12 and 13 Pro Max, 14 Plus'],
  [393, 852, 3, 59, 34, 'iPhone 14 Pro, 15, 15 Pro, 16'],
  [430, 932, 3, 59, 34, 'iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus'],
  [402, 874, 3, 62, 34, 'iPhone 16 Pro, 17, 17 Pro'],
  [420, 912, 3, 68, 34, 'iPhone Air'],
  [440, 956, 3, 62, 34, 'iPhone 16 Pro Max, 17 Pro Max'],
];
const name = (w, h) => `launch-${w}x${h}.png`;

(async () => {
  const pw = require('playwright-core');
  const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || pw.chromium.executablePath() });
  fs.mkdirSync(OUT, { recursive: true });
  const links = [], files = [];
  for (const [w, h, dpr, inset, home, who] of PHONES) {
    for (const side of [false, true]) {
      const vw = side ? h : w, vh = side ? w : h, pxW = vw * dpr, pxH = vh * dpr;
      const ins = side ? { t: 0, r: inset, b: home ? 21 : 0, l: inset } : { t: inset, r: 0, b: home, l: 0 };
      const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, javaScriptEnabled: false });
      const page = await ctx.newPage();
      await page.goto('file://' + path.join(ROOT, 'index.html'));
      /* the page's scripts are off; Playwright's own evaluate still runs (addStyleTag would wait for a script) */
      await page.evaluate(css => { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); return document.fonts.ready.then(() => true); },
        `:root { --sat: ${ins.t}px !important; --sar: ${ins.r}px !important; --sab: ${ins.b}px !important; --sal: ${ins.l}px !important; }
        #menu .newgame > :not(.brand), #menu .brand .foot, #ui, #table, .overlay:not(#menu) { visibility: hidden !important; }
        *, *::before, *::after { animation: none !important; transition: none !important; }`);
      const png = await page.screenshot({ type: 'png' });
      const file = name(pxW, pxH);
      fs.writeFileSync(path.join(OUT, file), png);
      console.log(`wrote icons/launch/${file}  ${who}${side ? ', on its side' : ''}`);
      files.push(file);
      links.push(`<link rel="apple-touch-startup-image" media="screen and (device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: ${side ? 'landscape' : 'portrait'})" href="icons/launch/${file}">`);
      await ctx.close();
    }
  }
  await browser.close();
  /* the links in the page's head, the files in the service worker's precache */
  const html = path.join(ROOT, 'index.html'), sw = path.join(ROOT, 'sw.js');
  const swap = (file, a, b, body) => {
    const s = fs.readFileSync(file, 'utf8'), i = s.indexOf(a), j = s.indexOf(b);
    if (i < 0 || j < i) throw new Error(`no ${a} ... ${b} in ${path.basename(file)}`);
    fs.writeFileSync(file, s.slice(0, i + a.length) + '\n' + body + '\n' + s.slice(j));
  };
  swap(html, '<!-- launch:begin -->', '<!-- launch:end -->', links.join('\n'));
  swap(sw, '/* launch:begin */', '  /* launch:end */', files.map(f => `  './icons/launch/${f}',`).join('\n'));
  console.log(`${files.length} launch images; index.html and sw.js updated`);
})().catch(e => { console.error('make-launch: ' + (e.stack || e)); process.exit(1); });
