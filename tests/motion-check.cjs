/* motion-check: the premium feel (page 6m), on a phone with real touch (CDP touch events).
   1. One button style: every primary action a white capsule with a near-black label (weight 600,
      50 px, full radius), secondary a dark grey capsule, destructive red words (a red fill once armed),
      each label 4.5:1.
   2. The morph: a tap on a game card opens its setup at once and carries the card into the hero
      (a transformed layer mid-flight; the hero's shot starts only after it lands), Back carries it
      back into the card; a mode card morphs into its page and back; with Reduce Motion each is a
      plain cross-fade with no layer.
   3. Interactive sheets: every sheet (setup, settings, stats, help, career, modes, drills, practice)
      dismisses on a real pull down past a quarter of its height, springs back from a short one; a
      pull inside scrolled content scrolls it instead; a push page swipes back from the left edge.
   4. The launch: an apple-touch-startup-image for each iPhone size, upright and on its side, each a
      PNG at exactly its size and precached; with no script at all the first paint is the home's
      colour with the wordmark where the home has it.
   5. Numbers: tabular figures on the scores, races and stats; a score that goes up rolls (not with
      Reduce Motion).
   6. The power bar: powerFull() is called once per pull at 100%, the bar ticks (.full). */
'use strict';
const fs = require('fs');
const path = require('path');
const { check, done, open, lowContrast } = require('./lib.cjs');

const PHONE = { viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, motion: true };

(async () => {
  const { browser, page, errors } = await open('', PHONE);
  const ev = (f, a) => page.evaluate(f, a);
  const cdp = await page.context().newCDPSession(page);
  let ts = Date.now() / 1000;
  const T = (type, x, y) => { ts += 0.016; return cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }], timestamp: ts }); };
  /* a real drag: start, n moves (each 16 ms of finger time apart), lift (unless held) */
  const drag = async (x0, y0, x1, y1, n = 20, lift = true) => {
    await T('touchStart', x0, y0);
    for (let i = 1; i <= n; i++) await T('touchMove', x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n);
    if (lift) await T('touchEnd');
  };
  const tapAt = async (x, y) => { await T('touchStart', x, y); await T('touchEnd'); };
  const centre = sel => ev(s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, sel);
  const tap = async sel => { const [x, y] = await centre(sel); await tapAt(x, y); };
  const landed = () => page.waitForFunction(() => !felt.motion.busy && !document.querySelector('.mLayer, .mPiece'), null, { timeout: 5000 }).then(() => true, () => false);
  const settle = () => page.waitForFunction(() => !felt.motion.dragging && !document.querySelector('.overlay.dragging'), null, { timeout: 5000 }).then(() => page.waitForTimeout(80));
  await page.waitForTimeout(400);

  /* ---- 1. one button style ---- */
  const look = sel => ev(s => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e);
    return { bg: c.backgroundColor, fg: c.color, w: c.fontWeight, h: c.minHeight, r: parseFloat(c.borderTopLeftRadius) }; }, sel);
  const PRI = { bg: 'rgb(255, 255, 255)', fg: 'rgb(11, 11, 12)', w: '600', h: '50px' };
  const isPri = s => s && s.bg === PRI.bg && s.fg === PRI.fg && s.w === PRI.w && s.h === PRI.h && s.r >= 25;
  await ev(() => { felt.tourneyCreate({ kind: '9', size: 4, race: 1, seed: 3 }); felt.quitToHome(); });
  const pri = {};
  for (const sel of ['#breakBtn', '#resumeBtn', '#rematch', '#rackGo', '#matchGo', '#hoGo', '#drillGo', '#offerGo', '#tutOfferGo', '#donePlay', '#trickRetry', '#drillAgain', '#leftOk', '.howAct > button']) pri[sel] = await look(sel);
  for (const [page_, sel] of [['tsetup', '#mdStartT'], ['exsetup', '#mdWatch'], ['psetup', '#mdStartP']]) { await ev(p => felt.showModes(p), page_); pri[sel] = await look(sel); }
  await ev(() => felt.showCareer('create')); pri['Start Career'] = await ev(() => { const b = [...document.querySelectorAll('#careerSheet .cvBtn')].find(x => /Start Career|Carry Over/.test(x.textContent)); const c = b && getComputedStyle(b); return c && { bg: c.backgroundColor, fg: c.color, w: c.fontWeight, h: c.minHeight, r: parseFloat(c.borderTopLeftRadius) }; });
  const offPri = Object.entries(pri).filter(([, s]) => !isPri(s));
  check('every primary action is the one white capsule: white fill, near-black label, 600, 50 px, full radius (Break, Resume, Rematch, Next Rack, Next Match, Ready, Start Drill, Start Tournament, Watch, Start, Start Career...)', offPri.length === 0, JSON.stringify(offPri));
  const sec = {};
  for (const sel of ['#overMenu', '#offerSkip', '#matchHome', '#drillHome', '#pracBack']) sec[sel] = await look(sel);
  const offSec = Object.entries(sec).filter(([, s]) => !s || s.bg !== 'rgb(44, 44, 48)' || s.fg !== 'rgb(245, 245, 247)' || s.r < 25);
  check('secondary actions are the dark grey capsule', offSec.length === 0, JSON.stringify(offSec));
  await ev(() => felt.showModes('tour'));
  const warn = {};
  for (const sel of ['#concedeBtn', '#rackQuit', '#mdEndT']) warn[sel] = await look(sel);
  await ev(() => { exitBtn.dataset.forfeit = '1'; });
  warn['#exitBtn (Forfeit Match)'] = await look('#exitBtn');
  const offWarn = Object.entries(warn).filter(([, s]) => !s || s.fg !== 'rgb(255, 138, 122)' || s.bg !== 'rgb(44, 44, 48)');
  check('destructive actions (Concede Frame, Forfeit Match, End Tournament) are red words on the dark capsule', offWarn.length === 0, JSON.stringify(offWarn));
  const armed = await ev(() => { concedeBtn.classList.add('arm'); const c = getComputedStyle(concedeBtn), r = { bg: c.backgroundColor, fg: c.color }; concedeBtn.classList.remove('arm'); delete exitBtn.dataset.forfeit; return r; });
  check('armed, a destructive action is a red fill with white words', armed.bg === 'rgb(192, 57, 43)' && armed.fg === 'rgb(255, 255, 255)', JSON.stringify(armed));
  await ev(() => { felt.quitToHome(); felt.showSetup('8'); });
  const lc = await lowContrast(page);
  check('the setup with its white Break: every label 4.5:1', lc.length === 0, JSON.stringify(lc));
  await ev(() => backToMenu());
  await page.waitForTimeout(300);

  /* ---- 2. the morph ---- */
  const f0 = await ev(() => felt.hero.frames);
  await tap('#play9');
  const mid = await ev(() => {
    const L = document.querySelector('.mLayer'), a = L && L.getAnimations()[0];
    return { sync: setupSheet.classList.contains('show') && !menu.classList.contains('show'), layer: !!L, tf: L && getComputedStyle(L).transform, t: a && a.currentTime,
      title: !!document.querySelector('.mTitle'), last: felt.motion.last, hold: felt.motion.hold, frames: felt.hero.frames, card: play9.classList.contains('mHide') };
  });
  check('a tap on a game card: the setup is open at once (showSetup stays synchronous) and a layer carries the card (a transform mid-flight), the name flying', mid.sync && mid.layer && mid.tf && mid.tf !== 'none' && mid.title && mid.card && mid.last.type === 'morph' && mid.last.dir === 'open' && mid.last.to === 'setupSheet', JSON.stringify(mid));
  check('the hero waits for the landing: no frame of its shot while the card flies', mid.hold && mid.frames === f0, JSON.stringify({ f0, mid: mid.frames }));
  const l1 = await landed();
  await page.waitForTimeout(300);
  const land = await ev(() => ({ show: setupSheet.classList.contains('show'), title: setupTitle.textContent, op: getComputedStyle(setupTitle).opacity, last: felt.motion.last, heroAt: felt.motion.heroAt, hero: felt.hero.state, frames: felt.hero.frames,
    card: play9.classList.contains('mHide'), morphing: setupSheet.classList.contains('morphing'), keep: menu.classList.contains('keep') }));
  check('it lands on the setup sheet (about 380 ms), then the hero starts its shot', l1 && land.show && land.title === '9-Ball' && land.op === '1' && !land.morphing && !land.keep && !land.card && land.last.t1 - land.last.t0 >= 360 && land.heroAt >= land.last.t0 + 300 && land.frames > f0 && ['play', 'done'].includes(land.hero), JSON.stringify(land));
  await tap('#setupBack');
  const back = await ev(() => ({ home: menu.classList.contains('show'), layer: !!document.querySelector('.mLayer'), last: felt.motion.last, card: play9.classList.contains('mHide') }));
  const l2 = await landed();
  const backed = await ev(() => ({ home: menu.classList.contains('show'), setup: setupSheet.classList.contains('show') || setupSheet.classList.contains('keep'), card: play9.classList.contains('mHide'), left: document.querySelectorAll('.mLayer, .mPiece, .mTitle, .mGhost').length }));
  check('Back reverses it: home at once, the hero flying back into its card, then the card itself', back.home && back.layer && back.card && back.last.dir === 'close' && back.last.to === 'play9' && l2 && backed.home && !backed.setup && !backed.card && backed.left === 0, JSON.stringify({ back, backed }));
  await tap('#modeEx');
  const mm = await ev(() => ({ show: modesSheet.classList.contains('show'), layer: !!document.querySelector('.mLayer'), last: felt.motion.last }));
  await landed();
  await page.waitForTimeout(100);
  await tap('#modesBack');
  const mb = await ev(() => ({ home: menu.classList.contains('show'), layer: !!document.querySelector('.mLayer'), last: felt.motion.last }));
  await landed();
  check('a mode card (AI Exhibition) morphs into its page and Back morphs it home', mm.show && mm.layer && mm.last.type === 'morph' && mm.last.to === 'modesSheet' && mb.home && mb.layer && mb.last.dir === 'close' && mb.last.to === 'modeEx', JSON.stringify({ mm, mb }));
  await tap('#careerBtn');
  const cm = await ev(() => ({ show: careerSheet.classList.contains('show'), last: felt.motion.last }));
  await landed();
  await tap('#careerBack');
  await landed();
  check('the career card morphs into the career and back', cm.show && cm.last.to === 'careerSheet' && (await ev(() => felt.motion.last.to === 'careerBtn' && menu.classList.contains('show'))), JSON.stringify(cm));
  /* the screenshots: a morph frozen half way, for the record */
  const shots = process.env.MOTION_SHOTS;
  if (shots) {
    await tap('#play8');
    await ev(() => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = 170; } });
    await page.screenshot({ path: path.join(shots, 'morph-mid.png') });
    await ev(() => { for (const a of document.getAnimations()) a.play(); });
    await landed(); await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(shots, 'setup-white-break.png') });
    await tap('#setupBack'); await landed();
  }
  /* Reduce Motion: a cross-fade, no layer */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await tap('#play8');
  const rm = await ev(() => ({ show: setupSheet.classList.contains('show'), layer: !!document.querySelector('.mLayer'), last: felt.motion.last, fade: setupSheet.getAnimations().some(a => a.effect.getKeyframes().some(k => 'opacity' in k)) }));
  await landed();
  await tap('#setupBack');
  const rb = await ev(() => ({ home: menu.classList.contains('show'), layer: !!document.querySelector('.mLayer'), last: felt.motion.last }));
  await landed();
  check('Reduce Motion: the card opens its setup with a plain cross-fade, and Back fades home (no flying layer)', rm.show && !rm.layer && rm.fade && rm.last.type === 'fade' && rm.last.dir === 'open' && rb.home && !rb.layer && rb.last.type === 'fade' && rb.last.dir === 'close', JSON.stringify({ rm, rb }));
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  /* ---- 3. interactive sheets ---- */
  const OPEN = {
    setup: () => felt.showSetup('8'), settings: () => showPrefs(), stats: () => felt.showStats(), help: () => felt.showHelp(), career: () => felt.showCareer(),
    modes: () => felt.showModes(), drills: () => felt.showDrills(null, true), practice: () => pracBtn.click(),
  };
  const shown = () => ev(() => [...document.querySelectorAll('.overlay.show')].map(o => o.id));
  const res = {};
  for (const [name, fn] of Object.entries(OPEN)) {
    await ev(fn);
    await page.waitForTimeout(350);
    const g = await ev(() => { const ov = document.querySelector('.overlay.show:not(#menu)'), s = ov.querySelector(':scope > .sheet'), r = s.getBoundingClientRect(), hd = ov.querySelector('.howTop, .hero, .shead');
      const h = hd ? hd.getBoundingClientRect() : r; return { id: ov.id, H: Math.min(r.height, innerHeight), x: r.left + r.width / 2, y: Math.max(r.top, 0) + Math.min(60, h.height / 2) + 4 }; });
    /* a short, slow pull springs back */
    await drag(g.x, g.y, g.x, g.y + g.H * 0.12, 30);
    await settle();
    const kept = await ev(id => document.getElementById(id).classList.contains('show') && !document.getElementById(id).querySelector(':scope > .sheet').style.transform, g.id);
    /* a slow pull past a quarter of the height dismisses */
    await drag(g.x, g.y, g.x, g.y + g.H * 0.36, 40, false);
    const midDrag = await ev(id => { const s = document.getElementById(id).querySelector(':scope > .sheet'); return { tf: s.style.transform, home: menu.classList.contains('keep') || menu.classList.contains('show') }; }, g.id);
    if (shots && name === 'settings') await page.screenshot({ path: path.join(shots, 'sheet-mid-drag.png') });
    await T('touchEnd');
    await settle();
    await page.waitForTimeout(200);
    const after = await shown();
    res[name] = { kept, midDrag: /translateY\(\d/.test(midDrag.tf) && midDrag.home, gone: !after.includes(g.id) && after.includes('menu') };
  }
  const bad = Object.entries(res).filter(([, r]) => !r.kept || !r.midDrag || !r.gone);
  check('every sheet (setup, settings, stats, help, career, modes, drills, practice): a short pull springs back, a real pull past a quarter follows the finger over the home and dismisses', bad.length === 0, JSON.stringify(res));
  /* a flick dismisses too, however short */
  await ev(() => felt.showHelp());
  await page.waitForTimeout(350);
  await drag(200, 120, 200, 200, 5);
  await settle(); await page.waitForTimeout(150);
  check('a fast flick down dismisses a sheet even short of a quarter', !(await shown()).includes('helpSheet') && (await ev(() => felt.motion.drags.slice(-1)[0])) === 'dismiss');
  /* scrolled content scrolls: a pull down inside it brings the content back, the sheet stays */
  await ev(() => { felt.showHelp('snooker'); });
  await page.waitForTimeout(500);
  await ev(() => { howSheet.scrollTop = 300; });
  const st0 = await ev(() => howSheet.scrollTop);
  await drag(200, 500, 200, 650, 20);
  await page.waitForTimeout(400);
  const sc = await ev(() => ({ top: howSheet.scrollTop, show: helpSheet.classList.contains('show'), tf: howSheet.style.transform }));
  check('a pull down inside scrolled content scrolls it (the sheet stays, unmoved)', st0 > 100 && sc.show && sc.top < st0 && !sc.tf, JSON.stringify({ st0, sc }));
  /* the edge swipe back on a push page */
  await ev(() => { howSheet.scrollTop = 0; });
  const p0 = await ev(() => helpPage);
  await drag(4, 420, 260, 424, 16);
  await settle(); await page.waitForTimeout(300);
  const eg = await ev(() => ({ page: helpPage, show: helpSheet.classList.contains('show'), list: !howList.hidden }));
  await ev(() => { showPrefs('game'); });
  await page.waitForTimeout(400);
  const pp0 = await ev(() => prefsAt);
  await drag(6, 500, 250, 502, 16);
  await settle(); await page.waitForTimeout(300);
  const ep = await ev(() => ({ at: prefsAt, show: prefsSheet.classList.contains('show') }));
  check('a push page swipes back from the left edge (How to play\'s Snooker page, Settings\' Gameplay): the list, the sheet still up', p0 && !eg.page && eg.show && eg.list && pp0 && !ep.at && ep.show, JSON.stringify({ p0, eg, pp0, ep }));
  await ev(() => showPrefs('game'));
  await page.waitForTimeout(400);
  await drag(6, 500, 40, 501, 20);
  await settle();
  check('a short, slow edge swipe springs back to the page', await ev(() => !!prefsAt && prefsSheet.classList.contains('show')));
  await ev(() => backToMenu());
  /* the table is never touched: a drag on it in a game moves no sheet and counts no sheet gesture */
  const nd = await ev(() => felt.motion.drags.length);
  await ev(() => felt.start('8'));
  await page.waitForTimeout(300);
  const tb = await ev(() => { const r = table.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 3]; });
  await drag(tb[0], tb[1], tb[0], tb[1] + 120, 15);
  check('a drag on the table in a game is the table\'s own (no sheet gesture)', (await ev(() => felt.motion.drags.length)) === nd && !(await ev(() => felt.motion.dragging)));

  /* ---- 6. the power bar ---- */
  await ev(() => { window.pf = 0; window.powerFull = () => { window.pf++; }; });
  await page.waitForFunction(() => felt.state === 'aim', null, { timeout: 10000 });
  const bar = await ev(() => { const r = powerBar.getBoundingClientRect(); return { l: r.left + 4, r: r.right, y: r.top + r.height / 2 }; });
  await T('touchStart', bar.l, bar.y);
  for (let i = 1; i <= 20; i++) await T('touchMove', bar.l + (bar.r + 30 - bar.l) * i / 20, bar.y);
  const at1 = await ev(() => ({ pf: window.pf, full: powerBar.classList.contains('full'), live: powerBar.classList.contains('live'), lab: powerLab.textContent }));
  for (let i = 1; i <= 10; i++) await T('touchMove', bar.r + 30 - (bar.r - bar.l) * 0.4 * i / 10, bar.y);
  const back1 = await ev(() => ({ pf: window.pf, full: powerBar.classList.contains('full') }));
  for (let i = 1; i <= 10; i++) await T('touchMove', bar.r + 30 - (bar.r - bar.l) * 0.4 + (bar.r - bar.l) * 0.5 * i / 10, bar.y);
  const at2 = await ev(() => window.pf);
  await T('touchEnd');
  check('the power bar at 100%: the end ticks (.full) and powerFull() is called once per pull, however often the pull touches full', at1.pf === 1 && at1.full && at1.live && at1.lab === '100%' && !back1.full && back1.pf === 1 && at2 === 1, JSON.stringify({ at1, back1, at2 }));
  await page.waitForFunction(() => !['stroke', 'rolling', 'thinking'].includes(felt.state), null, { timeout: 30000 }).catch(() => {});

  /* ---- 5. numbers ---- */
  await ev(() => felt.start('straight'));
  await page.waitForTimeout(300);
  const tab = await ev(() => {
    const sel = ['.pchip .num', '.pchip .of', '#snkBar', '.board .side b', '.hoBoard li b', '#careerNow .score b', '.kpis dd', '.cvFacts dd', '#over .stats', '.soloStats dd', '#powerLab', '.ccSum', '.acc', '.dshots li', '.rec'];
    const probe = document.createElement('div'); document.body.appendChild(probe);
    probe.innerHTML = '<div class="board"><div class="side"><b>1</b></div></div><ul class="hoBoard"><li><b>2</b></li></ul><dl class="kpis"><dd>3</dd></dl><dl class="cvFacts"><dd>4</dd></dl><dl class="soloStats"><dd>5</dd></dl><ul class="dshots"><li>6</li></ul><table class="rec"></table>';
    const out = sel.map(s => { const e = document.querySelector(s); return [s, e ? getComputedStyle(e).fontVariantNumeric : 'none'].join(': '); }).filter(x => !/tabular-nums/.test(x));
    probe.remove();
    return out;
  });
  check('tabular figures on every score, race, stat and counter (chips, snooker\'s bar, boards, the handoff, Stats, the career, the meter)', tab.length === 0, JSON.stringify(tab));
  await ev(() => { felt.game.score[0] = 0; hud(); felt.game.score[0] = 12; hud(); });
  const r1 = await ev(() => { const e = pchip0.querySelector('.num') || pchip1.querySelector('.num'); return { t: e.textContent, v: e.dataset.v, rolling: e.classList.contains('rolling') }; });
  await page.waitForTimeout(150);
  const r2 = await ev(() => (pchip0.querySelector('.num') || pchip1.querySelector('.num')).textContent);
  await page.waitForTimeout(400);
  const r3 = await ev(() => { const e = pchip0.querySelector('.num') || pchip1.querySelector('.num'); return { t: e.textContent, rolling: e.classList.contains('rolling'), rolls: felt.motion.rolls }; });
  check('a score that goes up rolls up to it (from 0, through the numbers between, to 12 in about 250 ms)', r1.v === '12' && r1.rolling && +r1.t < 12 && +r2 <= 12 && r3.t === '12' && !r3.rolling && r3.rolls >= 1, JSON.stringify({ r1, r2, r3 }));
  await ev(() => { felt.game.score[0] = 5; hud(); });
  const down = await ev(() => (pchip0.querySelector('.num') || pchip1.querySelector('.num')).textContent);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ev(() => { felt.game.score[0] = 20; hud(); });
  const rmRoll = await ev(() => { const e = pchip0.querySelector('.num') || pchip1.querySelector('.num'); return { t: e.textContent, rolling: e.classList.contains('rolling') }; });
  check('a score that falls is set at once, and with Reduce Motion a rise is too', down === '5' && rmRoll.t === '20' && !rmRoll.rolling, JSON.stringify({ down, rmRoll }));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await ev(() => felt.quitToHome());

  /* ---- 4. the launch ---- */
  const launch = await ev(async () => {
    const links = [...document.querySelectorAll('link[rel="apple-touch-startup-image"]')];
    const out = [];
    for (const l of links) {
      const m = l.media.match(/device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)\) and \(orientation: (\w+)\)/);
      const r = await fetch(l.getAttribute('href')), b = new Uint8Array(await r.arrayBuffer());
      const be = i => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
      const png = b[1] === 80 && b[2] === 78 && b[3] === 71, w = be(16), h = be(20);
      const want = m && (m[4] === 'portrait' ? [m[1] * m[3], m[2] * m[3]] : [m[2] * m[3], m[1] * m[3]]);
      out.push({ href: l.getAttribute('href'), ok: r.ok && png && !!want && w === want[0] && h === want[1], w, h, want, orient: m && m[4] });
    }
    return { out, scheme: (document.querySelector('meta[name="color-scheme"]') || {}).content };
  });
  const sizes = new Set(launch.out.map(o => o.want && o.want.join('x')));
  const WANT = ['1179x2556', '1290x2796', '1206x2622', '1320x2868', '1260x2736', '1170x2532', '1284x2778', '1125x2436', '750x1334', '828x1792'];
  check('launch images: an apple-touch-startup-image for every current iPhone, upright and on its side, each a PNG at exactly its size', launch.out.length >= 24 && launch.out.every(o => o.ok) && WANT.every(s => sizes.has(s)) && launch.out.filter(o => o.orient === 'landscape').length === launch.out.length / 2,
    JSON.stringify(launch.out.filter(o => !o.ok)).slice(0, 600) + ` n=${launch.out.length}`);
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  check('every launch image is precached by the service worker', launch.out.every(o => sw.includes(`'./${o.href}'`)), launch.out.filter(o => !sw.includes(`'./${o.href}'`)).map(o => o.href).join(' '));
  /* the first paint, before any script: the home's colour and the wordmark (scripts off) */
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, javaScriptEnabled: false });
  const np = await ctx.newPage();
  await np.goto(page.url());
  const fp = await np.evaluate(() => { const h = menuTitle.getBoundingClientRect(), c = getComputedStyle(menuTitle); return { h: [Math.round(h.left), Math.round(h.top), Math.round(h.width), Math.round(h.height)], color: c.color, vis: c.visibility, op: c.opacity, anim: c.animationName }; });
  const shot = await np.screenshot({ clip: { x: 0, y: 0, width: 4, height: 4 } });
  const px = await page.evaluate(async b64 => { const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob()); const c = document.createElement('canvas'); c.width = 4; c.height = 4; const g = c.getContext('2d'); g.drawImage(bmp, 0, 0); return [...g.getImageData(1, 1, 1, 1).data]; }, shot.toString('base64'));
  check('first paint (no script yet): the home\'s colour #09090a and the felt. wordmark in place, not fading in; dark color-scheme', px[0] === 9 && px[1] === 9 && px[2] === 10 && fp.vis === 'visible' && fp.op === '1' && fp.h[2] > 40 && fp.h[3] > 20 && fp.color === 'rgb(245, 245, 247)' && launch.scheme === 'dark', JSON.stringify({ px, fp, scheme: launch.scheme }));
  await ctx.close();

  check('no console errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
