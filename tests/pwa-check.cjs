/* pwa-check: felt installs as a home-screen web app and plays offline. The manifest parses and
   carries what iOS and Chrome need; every icon exists at exactly the pixel size it claims (read
   from the PNG header); the apple-touch-icon is 180 x 180 and fully opaque; the service worker
   registers and takes control; after the first load the page boots with the network off; no
   request ever leaves the origin; no console errors. From file:// the game still boots, with
   no service worker and no errors. */
'use strict';
const path = require('path');
const { check, done, open } = require('./lib.cjs');

/* in the page: fetch a PNG, read IHDR, and when it has an alpha channel decode it and look */
const pngInfo = src => fetch(src).then(async r => {
  if (!r.ok) return { src, ok: false, status: r.status };
  const b = new Uint8Array(await r.arrayBuffer());
  const sig = [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v);
  const be = i => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
  const ihdr = String.fromCharCode(b[12], b[13], b[14], b[15]) === 'IHDR';
  const w = be(16), h = be(20), colorType = b[25];
  let opaque = colorType === 0 || colorType === 2;
  if (!opaque) {
    const bmp = await createImageBitmap(new Blob([b], { type: 'image/png' }));
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    const g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    opaque = true;
    for (let i = 3; i < d.length; i += 4) if (d[i] !== 255) { opaque = false; break; }
  }
  return { src, ok: sig && ihdr, w, h, colorType, opaque, type: r.headers.get('content-type') };
});

(async () => {
  const { browser, page, errors, requests } = await open();
  const ctxRequests = [];
  page.context().on('request', r => ctxRequests.push(r.url()));
  const origin = new URL(page.url()).origin;

  /* the head */
  const head = await page.evaluate(() => {
    const m = n => (document.querySelector(`meta[name="${n}"]`) || {}).content;
    const l = r => { const e = document.querySelector(`link[rel="${r}"]`); return e && { href: e.getAttribute('href'), sizes: e.getAttribute('sizes') }; };
    return {
      manifest: l('manifest'), apple: l('apple-touch-icon'), icon: l('icon'),
      capable: m('apple-mobile-web-app-capable'), mcapable: m('mobile-web-app-capable'),
      bar: m('apple-mobile-web-app-status-bar-style'), title: m('apple-mobile-web-app-title'), theme: m('theme-color'),
      viewport: m('viewport'),
    };
  });
  check('head: manifest, apple-touch-icon and icon links', head.manifest && head.apple && head.apple.href === 'icons/apple-touch-icon.png' && head.icon, JSON.stringify(head));
  check('head: standalone on iOS, opaque black bar (iOS 26 blurs content under a translucent one), title "felt", cover viewport', head.capable === 'yes' && head.mcapable === 'yes' && head.bar === 'black' && head.title === 'felt' && /viewport-fit=cover/.test(head.viewport), JSON.stringify(head));

  /* the manifest */
  const man = await page.evaluate(href => fetch(href).then(async r => ({ type: r.headers.get('content-type'), json: await r.json() })).catch(e => ({ err: String(e) })), head.manifest.href);
  const M = man.json || {};
  check('manifest parses', !!man.json, JSON.stringify(man).slice(0, 200));
  check('manifest: name, short_name, standalone, any orientation, relative start_url and scope',
    M.name === 'felt' && M.short_name === 'felt' && M.display === 'standalone' && M.orientation === 'any' && M.start_url === './' && M.scope === './', JSON.stringify(M));
  check('manifest: background and theme colour are the page --bg', M.background_color === '#0f0f10' && M.theme_color === '#0f0f10' && head.theme === '#0f0f10');
  const icons = M.icons || [];
  const sizesOf = p => icons.filter(i => (i.purpose || 'any').split(' ').includes(p)).map(i => i.sizes);
  check('manifest: icons 192 and 512, plus a maskable 512', sizesOf('any').includes('192x192') && sizesOf('any').includes('512x512') && sizesOf('maskable').includes('512x512') && icons.every(i => !/^\/|^https?:/.test(i.src)), JSON.stringify(icons));

  /* every icon: a real PNG at the size it claims */
  const claims = icons.map(i => ({ src: i.src, size: +i.sizes.split('x')[0] }));
  claims.push({ src: head.apple.href, size: 180 }, { src: head.icon.href, size: +(head.icon.sizes || '32x32').split('x')[0] });
  const infos = [];
  for (const c of claims) infos.push({ ...(await page.evaluate(pngInfo, c.src)), claim: c.size });
  const bad = infos.filter(i => !i.ok || i.w !== i.claim || i.h !== i.claim || !/image\/png/.test(i.type || ''));
  check('every icon exists as a PNG at exactly the size it claims', bad.length === 0, JSON.stringify(bad));
  const apple = infos.find(i => i.src === head.apple.href);
  check('apple-touch-icon is 180 x 180 and fully opaque', apple && apple.w === 180 && apple.h === 180 && apple.opaque, JSON.stringify(apple));
  check('every icon is opaque (iOS fills transparency with black)', infos.every(i => i.opaque), JSON.stringify(infos.filter(i => !i.opaque)));

  /* the service worker */
  const sw = await page.evaluate(() => Promise.race([
    navigator.serviceWorker.ready.then(r => ({ scope: r.scope, script: r.active && r.active.scriptURL })),
    new Promise(res => setTimeout(() => res(null), 15000)),
  ]));
  check('the service worker registers and activates, scoped to the page folder', sw && sw.script && sw.script.endsWith('/sw.js') && page.url().startsWith(sw.scope), JSON.stringify(sw));
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
  check('it takes control of the page it was installed from', await page.evaluate(() => !!navigator.serviceWorker.controller));
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys(), out = [];
    for (const k of keys) for (const r of await (await caches.open(k)).keys()) out.push(new URL(r.url).pathname.replace(/^.*\//, '/'));
    return { keys, out };
  });
  check('the page, the manifest and the icons are precached', ['/', '/index.html', '/manifest.webmanifest', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png'].every(p => cached.out.includes(p)), JSON.stringify(cached));
  /* nothing the app asks for is left out: every same-origin URL in the page (links, scripts,
     images, media) and every icon of the manifest is in the precache, so offline needs no network */
  const wants = await page.evaluate(async () => {
    const urls = new Set(['./', './index.html']);
    for (const el of document.querySelectorAll('[href], [src]')) { const u = el.getAttribute('href') || el.getAttribute('src'); if (u && !u.startsWith('#') && !u.startsWith('data:')) urls.add(u); }
    const m = await (await fetch(document.querySelector('link[rel=manifest]').href)).json();
    for (const i of m.icons || []) urls.add(i.src);
    return [...urls].map(u => new URL(u, location.href)).filter(u => u.origin === location.origin).map(u => u.pathname);
  });
  const full = await page.evaluate(async () => { const out = []; for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(new URL(r.url).pathname); return out; });
  check('every same-origin URL the page and the manifest reference is precached (one file, its icons, the manifest)', wants.length >= 6 && wants.every(u => full.includes(u)), JSON.stringify({ missing: wants.filter(u => !full.includes(u)), wants }));

  /* offline: airplane mode, then reload and play */
  await page.context().setOffline(true);
  await page.reload();
  const off = await page.waitForFunction(() => window.booted === true, null, { timeout: 15000 }).then(() => true, () => false);
  check('with the network off, a reload boots the game from the cache', off);
  if (off) {
    await page.click('#play8');
    await page.click('#breakBtn');
    await page.waitForTimeout(200);
    check('and a game starts offline', await page.evaluate(() => felt.state === 'aim' && felt.game.inHand === 'kitchen' && felt.game.balls.length === 16));
    const modes = await page.evaluate(() => {
      felt.quitToHome(); felt.showHelp('modes'); const help = !panModes.hidden;
      felt.party({ ruleset: '9-ring', names: ['A', 'B', 'C'] }); const pty = felt.mode === 'party' && !pchip2.hidden;
      felt.quitToHome(); felt.tourneyCreate({ kind: 'snooker', size: 4, race: 1, seed: 4 }); felt.tourneyPlay(); const tm = felt.mode === 'tourney' && felt.game.kind === 'snooker';
      felt.quitToHome(); felt.showDrills(); const dr = drillSheet.classList.contains('show');
      return { help, pty, tm, dr };
    });
    check('offline, the newer screens work too: How to play\'s More modes page, a party of three, a snooker tournament match, the drills', modes.help && modes.pty && modes.tm && modes.dr, JSON.stringify(modes));
  }
  await page.context().setOffline(false);

  const foreign = [...requests, ...ctxRequests].filter(u => !u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:'));
  check('no request ever leaves the origin (page or service worker)', foreign.length === 0, foreign.join(' '));
  check('no console errors, online or offline', errors.length === 0, errors.join(' | '));
  await browser.close();

  /* file://: the game boots, no service worker, no errors */
  {
    const pw = require('playwright-core');
    const b = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || pw.chromium.executablePath() });
    const p = await b.newPage();
    const errs = [];
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    p.on('pageerror', e => errs.push(String(e)));
    await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
    const ok = await p.waitForFunction(() => window.booted === true, null, { timeout: 20000 }).then(() => true, () => false);
    await p.waitForTimeout(500);
    const reg = await p.evaluate(() => 'serviceWorker' in navigator ? navigator.serviceWorker.getRegistrations().then(r => r.length).catch(() => 0) : 0);
    check('from file:// the game boots, registers no service worker, logs no errors', ok && reg === 0 && errs.length === 0, JSON.stringify({ ok, reg, errs }));
    await b.close();
  }
  done();
})().catch(e => { console.error(e); process.exit(1); });
