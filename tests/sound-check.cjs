/* sound-check: the recorded table sounds (section 2) and the haptics map (2h).
   The takes: every file in SFX_FILES is in sounds/, loads and decodes in the page, and the page
   decodes the whole set once the context is made; the service worker precaches each one; each is
   credited in CREDITS.md (its source, author and CC0) and Settings > About shows the credits; a
   ball take is a short clack (most of its energy at 1.5 to 6 kHz, 20 dB down within 30 ms and
   no long ring), the roll's loop is dark and seamless; the payload stays small.
   Rendered offline through the page's own graph (soundRender, an OfflineAudioContext): a harder
   ball hit peaks higher and is brighter, a soft glancing one quiet and dull; the cue, cushion,
   jaw, bumper post, corner and side pockets and snooker's net each make their own sound; a harder
   cushion is louder; the roll bed follows the speed and fades to nothing when the balls stop; the
   master and table-sound volumes scale the table's sounds (the UI's are not table sounds), sound
   off is silent. Live: a real roll lifts the roll bed and it falls to zero once the table settles,
   the roll path makes no nodes, sound off makes no nodes, a break and a flood of hits stay under
   the node cap. Haptics: a pot two toggles, a foul a distinct double, a win three, a hard cushion
   one and a soft none, impacts never faster than HAP_HIT, nothing in a replay; the power bar fires
   powerFull once per pull at 100% (a sound and one tick), not below it. Sound off from the start:
   a gesture makes no audio context and fetches no takes. */
'use strict';
const fs = require('fs');
const path = require('path');
const { check, done, open, settled } = require('./lib.cjs');
const ROOT = path.resolve(__dirname, '..');

/* a 16-bit mono WAV's samples and rate */
function readWav(file) {
  const b = fs.readFileSync(file);
  let p = 12, sr = 0;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), n = b.readUInt32LE(p + 4), d = p + 8;
    if (id === 'fmt ') sr = b.readUInt32LE(d + 4);
    else if (id === 'data') { const x = new Float64Array(n / 2); for (let i = 0; i < x.length; i++) x[i] = b.readInt16LE(d + i * 2) / 32768; return { x, sr }; }
    p = d + n + (n & 1);
  }
  return { x: new Float64Array(0), sr };
}
/* a take's shape: the level in 2 ms windows, ms from the peak until it is 20 dB down, the share of
   energy left after 60 ms, and the share in 1.5 to 6 kHz of the 20 ms from the peak (a DFT) */
function shape({ x, sr }) {
  const h = Math.round(sr * 0.002), env = [];
  for (let i = 0; i + h <= x.length; i += h) { let e = 0; for (let k = i; k < i + h; k++) e += x[k] * x[k]; env.push(Math.sqrt(e / h)); }
  const i0 = env.indexOf(Math.max(...env));
  let t20 = env.length;
  for (let i = i0; i < env.length; i++) if (env[i] < env[i0] / 10) { t20 = i; break; }
  let all = 0, late = 0;
  for (let i = 0; i < x.length; i++) { all += x[i] * x[i]; if (i > i0 * h + 0.06 * sr) late += x[i] * x[i]; }
  const a = i0 * h, n = Math.round(sr * 0.02);
  let band = 0, tot = 0;
  for (let f = 100; f < sr / 2 && f < 12000; f += 100) {
    let re = 0, im = 0;
    for (let k = 0; k < n && a + k < x.length; k++) { const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * k / n), v = x[a + k] * w; re += v * Math.cos(2 * Math.PI * f * k / sr); im -= v * Math.sin(2 * Math.PI * f * k / sr); }
    const p2 = re * re + im * im; tot += p2; if (f >= 1500 && f <= 6000) band += p2;
  }
  return { t20: (t20 - i0) * 2, late: late / all, band: band / tot };
}

(async () => {
  const { browser, page, errors, requests } = await open('', { init: () => Object.defineProperty(HTMLInputElement.prototype, 'switch', { value: false, writable: true, configurable: true }) });
  await page.evaluate(() => {
    /* peak, rms, and the share of energy in the first difference (a brightness measure), of a render */
    window.__an = (x, a = 0, b = 1e9) => {
      let pk = 0, e = 0, d = 0, n = 0;
      const lo = Math.floor(a * 48000), hi = Math.min(x.length, Math.floor(b * 48000));
      for (let i = Math.max(1, lo); i < hi; i++) { const v = x[i]; pk = Math.max(pk, Math.abs(v)); e += v * v; d += (v - x[i - 1]) ** 2; n++; }
      return { pk, rms: Math.sqrt(e / Math.max(1, n)), hf: e ? d / e : 0 };
    };
    window.__r = async (ev, secs = 0.6, rolls = null) => __an(await soundRender(ev, secs, rolls));
  });

  /* 0. the takes: on disk, credited, precached, decoded in the page */
  const urls = await page.evaluate(() => sfxUrls());
  const files = urls.map(u => path.join(ROOT, u)), missing = files.filter(f => !fs.existsSync(f));
  const bytes = files.filter(f => fs.existsSync(f)).reduce((n, f) => n + fs.statSync(f).size, 0);
  check('the takes: every file SFX_FILES names is in sounds/ (22), and nothing else is', urls.length === 22 && !missing.length && fs.readdirSync(path.join(ROOT, 'sounds')).length === urls.length, JSON.stringify({ n: urls.length, missing }));
  check('the takes weigh under 600 KB together', bytes < 600 * 1024, `${(bytes / 1024).toFixed(1)} KB`);
  const credits = fs.existsSync(path.join(ROOT, 'CREDITS.md')) ? fs.readFileSync(path.join(ROOT, 'CREDITS.md'), 'utf8') : '';
  const uncredited = urls.map(u => path.basename(u)).filter(f => !credits.split('\n').some(l => l.includes('`' + f + '`') && /CC0/.test(l) && /https:\/\//.test(l)));
  check('CREDITS.md credits every take: its file, the recording\'s link and author, CC0', credits && !uncredited.length, 'uncredited: ' + uncredited.join());
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), unc = urls.filter(u => !sw.includes(`'./${u}'`));
  check('sw.js precaches every take (offline needs no network)', !unc.length, 'missing: ' + unc.join());
  const dec = await page.evaluate(async () => {
    const O = new OfflineAudioContext(1, 1, 44100), out = [];
    for (const u of sfxUrls()) {
      try { const r = await fetch(u), b = await O.decodeAudioData(await r.arrayBuffer()); out.push({ u, ok: r.ok, s: b.duration, ch: b.numberOfChannels }); } catch (e) { out.push({ u, err: String(e) }); }
    }
    return out;
  });
  const bad = dec.filter(d => !d.ok || !(d.s > 0.03 && d.s < 1.2) || d.ch !== 1);
  check('every take loads and decodes in the page (mono, 30 ms to 1.2 s)', dec.length === 22 && !bad.length, JSON.stringify(bad));
  const shapes = urls.filter(u => /ball-/.test(u)).map(u => ({ u: path.basename(u), ...shape(readWav(path.join(ROOT, u))) }));
  const ringy = shapes.filter(t => !(t.t20 <= 30 && t.late < 0.02 && t.band > 0.3));
  check('a ball take is a short clack: 20 dB down within 30 ms, under 2% of its energy after 60 ms, mostly 1.5 to 6 kHz', !ringy.length, JSON.stringify(ringy.length ? ringy : shapes.map(t => [t.u, t.t20, +t.late.toFixed(3), +t.band.toFixed(2)])));
  const rollShape = shape(readWav(path.join(ROOT, 'sounds/roll.wav'))), rw = readWav(path.join(ROOT, 'sounds/roll.wav')).x;
  check('the roll loop is dark (no energy in 1.5 to 6 kHz to speak of) and seamless (its two ends meet)', rollShape.band < 0.05 && Math.abs(rw[0] - rw[rw.length - 1]) < 0.02, JSON.stringify({ band: rollShape.band, ends: [rw[0], rw[rw.length - 1]] }));
  const about = await page.evaluate(() => { showPrefs('about'); const r = { shown: !ppAbout.hidden && sfxCredits.getClientRects().length > 0, rows: sfxCredits.querySelectorAll('p').length, text: sfxCredits.textContent }; backToMenu(); return r; });
  check('Settings > About shows the sound credits, a row per kind of sound, naming the authors', about.shown && about.rows >= 5 && ['Za-Games', 'bsumusictech', 'craigsmith', 'Kenney', 'Yarmonics', 'Caitlin_100', 'csaszi', 'RossJuterbock'].every(a => about.text.includes(a)), JSON.stringify(about));

  /* 1. loudness and brightness scale with the impact */
  const ball = await page.evaluate(async () => ({ soft: await __r([['ball', 0.3, 0.02]]), mid: await __r([['ball', 2, 0.02]]), hard: await __r([['ball', 6, 0.02]]) }));
  check('ball: a harder hit peaks higher (soft < mid < hard)', ball.soft.pk > 0 && ball.soft.pk < ball.mid.pk && ball.mid.pk < ball.hard.pk && ball.hard.pk > 4 * ball.soft.pk, JSON.stringify(ball));
  check('ball: a soft, glancing hit is duller than a hard one', ball.soft.hf < ball.hard.hf * 0.85, JSON.stringify([ball.soft.hf, ball.hard.hf]));
  const same = await page.evaluate(async () => { const a = await soundRender([['ball', 3, 0.02]], 0.2), b = await soundRender([['ball', 3, 0.02]], 0.2), c = await soundRender([['ball', 3.01, 0.02]], 0.2);
    let ab = 0, ac2 = 0; for (let i = 0; i < a.length; i++) { ab = Math.max(ab, Math.abs(a[i] - b[i])); ac2 = Math.max(ac2, Math.abs(a[i] - c[i])); } return { ab, ac2 }; });
  check('ball: the same hit sounds the same, a slightly different one differs (pitch varies per hit)', same.ab === 0 && same.ac2 > 1e-4, JSON.stringify(same));

  /* 2. every kind makes its own sound */
  const kinds = await page.evaluate(async () => {
    setTable('7');
    const corner = POCKETS.findIndex(p => p[0] < TL * 0.1), side = POCKETS.findIndex(p => Math.abs(p[0] - TL / 2) < TL * 0.1);
    const o = {
      cueSoft: await __r([['cue', 1, 0.02]]), cueHard: await __r([['cue', 7, 0.02]]),
      railSoft: await __r([['rail', 0.8, 0.02]]), railHard: await __r([['rail', 4, 0.02]]),
      jaw: await __r([['jaw', 3, 0.02]]), post: await __r([['rail', 3, 0.02, 'post']]),
      corner: await __r([['pocket', 1.5, 0.02, corner]], 1.4), side: await __r([['pocket', 1.5, 0.02, side]], 1.4),
      cornerTail: await __an(await soundRender([['pocket', 1.5, 0.02, corner]], 1.4), 0.55, 1.4), sideTail: await __an(await soundRender([['pocket', 1.5, 0.02, side]], 1.4), 0.55, 1.4),
      full: await __r([['full', 1, 0.02]]), corner_i: corner, side_i: side
    };
    setTable('snooker', 'full'); o.net = await __r([['pocket', 1.5, 0.02, 0]], 1.4); setTable('7');
    const a = await soundRender([['rail', 3, 0.02]], 0.3), b = await soundRender([['rail', 3, 0.02, 'post']], 0.3);
    let d = 0; for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i] - b[i]));
    o.postDiff = d;
    return o;
  });
  const heard = ['cueHard', 'railHard', 'jaw', 'post', 'corner', 'side', 'net', 'full'].filter(k => !(kinds[k].pk > 0.003));
  check('each event makes a sound: cue, cushion, jaw, post, corner and side pocket, snooker net, power full', !heard.length && kinds.corner_i >= 0 && kinds.side_i >= 0, 'silent: ' + heard.join());
  check('cue: a harder stroke is louder; cushion: a harder hit is louder', kinds.cueHard.pk > 2 * kinds.cueSoft.pk && kinds.railHard.pk > 3 * kinds.railSoft.pk, JSON.stringify([kinds.cueSoft.pk, kinds.cueHard.pk, kinds.railSoft.pk, kinds.railHard.pk]));
  check('cushion: a low, dull thud (duller than a ball click); a post is its own rubbery sound', kinds.railHard.hf < ball.hard.hf / 4 && kinds.postDiff > 0.01, JSON.stringify([kinds.railHard.hf, ball.hard.hf, kinds.postDiff]));
  check('pocket: a corner sends the ball round a longer return than a side; snooker\'s net is softer', kinds.cornerTail.rms > kinds.sideTail.rms && kinds.net.pk < kinds.corner.pk, JSON.stringify([kinds.cornerTail.rms, kinds.sideTail.rms, kinds.net.pk, kinds.corner.pk]));
  check('power full: a soft tick, far quieter than a ball click', kinds.full.pk < ball.hard.pk / 5, JSON.stringify(kinds.full));

  /* 3. the roll bed: follows the speed, fades to nothing */
  const roll = await page.evaluate(async () => {
    const x = await soundRender([], 2, [[0, 6], [0.6, 1], [1, 0]]);
    return { fast: __an(x, 0.3, 0.6), slow: __an(x, 0.8, 1), gone: __an(x, 1.8, 2) };
  });
  check('roll: the roll bed is off (its loop pulsed): silent fast, slow and stopped', roll.fast.pk < 1e-4 && roll.slow.pk < 1e-4 && roll.gone.pk < 1e-4, JSON.stringify(roll));

  /* 4. the volumes and sound off */
  const vol = await page.evaluate(async () => {
    const full = await __r([['ball', 5, 0.02]]), uiFull = await __r([['foul', 1, 0.02]]);
    setSetting('vol', 40); const m40 = await __r([['ball', 5, 0.02]]);
    setSetting('vol', 100); setSetting('volFx', 0); const fx0 = await __r([['ball', 5, 0.02]]), roll0 = await __r([], 0.6, [[0, 6]]), ui0 = await __r([['foul', 1, 0.02]]);
    setSetting('volFx', 50); const fx50 = await __r([['ball', 5, 0.02]]);
    setSetting('volFx', 100); setSetting('sound', false); const off = await __r([['ball', 5, 0.02], ['pocket', 1, 0.05, 0]]);
    setSetting('sound', true);
    return { full: full.pk, m40: m40.pk, fx0: fx0.pk, roll0: roll0.pk, ui0: ui0.pk, uiFull: uiFull.pk, fx50: fx50.pk, off: off.pk };
  });
  check('volume: the master at 40% scales a hit to 40%, table sounds at 50% to half', Math.abs(vol.m40 / vol.full - 0.4) < 0.02 && Math.abs(vol.fx50 / vol.full - 0.5) < 0.02, JSON.stringify(vol));
  check('volume: table sounds at 0 silence the hits and the roll, not the UI cues; sound off is silent', vol.fx0 === 0 && vol.roll0 === 0 && Math.abs(vol.ui0 - vol.uiFull) < 1e-6 && vol.ui0 > 0 && vol.off === 0, JSON.stringify(vol));

  /* 5. live: the roll rises and falls, the node budget holds, sound off makes nothing */
  await page.keyboard.press('Shift');   /* a gesture: audio and haptics armed */
  const live = await page.evaluate(async () => {
    audioOn(); await new Promise(r => setTimeout(r, 100));
    felt.start('8'); felt.speed = 1; felt.sound.reset();
    const c = felt.game.balls.find(b => b.n === 0), apex = felt.game.balls.find(b => b.n === 1);
    felt.shoot(Math.atan2(apex.y - c.y, apex.x - c.x), 1, 0);
    let rollMax = 0, nodesMax = 0;
    for (let i = 0; i < 60 && felt.state !== 'rolling'; i++) await new Promise(r => setTimeout(r, 20));
    while (felt.state === 'rolling') { rollMax = Math.max(rollMax, felt.sound.roll); nodesMax = Math.max(nodesMax, felt.sound.nodes); await new Promise(r => setTimeout(r, 30)); }
    await new Promise(r => setTimeout(r, 600));
    const s = felt.sound;
    return { state: ac.state, rollMax, rollEnd: s.roll, rollGain: s.rollGain, nodesMax, peak: s.peak, cap: s.cap, made: s.made };
  });
  check('live roll: no roll bed while the balls run (it is off), nothing left once they stop', live.state === 'running' && live.rollMax === 0 && live.rollEnd === 0 && live.rollGain < 1e-3, JSON.stringify(live));
  const rp0 = await page.evaluate(() => {
    const names = ['createBufferSource', 'createGain', 'createBiquadFilter', 'createOscillator', 'createBuffer'], keep = {};
    let made = 0, moved = 0, last = rollTgt;
    for (const n of names) { keep[n] = ac[n]; ac[n] = function () { made++; return keep[n].apply(this, arguments); }; }
    try { for (let i = 0; i < 300; i++) { rollAt(ac.currentTime + i * 0.01, (i % 40) / 10); if (rollTgt !== last) { moved++; last = rollTgt; } soundFrame(); last = rollTgt; } }
    finally { for (const n of names) delete ac[n]; }
    rollAt(ac.currentTime, 0);
    return { made, moved, own: names.filter(n => Object.prototype.hasOwnProperty.call(ac, n)), sfx: SFX && Object.fromEntries(Object.entries(SFX).map(([k, v]) => [k, Array.isArray(v) ? v.length : !!v])) };
  });
  check('the roll path (rollAt, soundFrame) makes no audio nodes and never lifts the silenced bed', rp0.made === 0 && rp0.moved === 0 && !rp0.own.length, JSON.stringify(rp0));
  check('live: the page decoded every take once the context was made (10 balls, 4 cues, 3 cushions, 3 pockets, the break, the roll)', rp0.sfx && rp0.sfx.ball === 10 && rp0.sfx.cue === 4 && rp0.sfx.rail === 3 && rp0.sfx.pocket === 3 && rp0.sfx.break === 1 && rp0.sfx.roll === true, JSON.stringify(rp0.sfx));
  check('live break: the voices stay under the node cap', live.made > 20 && live.peak <= live.cap && live.nodesMax <= live.cap, JSON.stringify(live));
  const flood = await page.evaluate(() => {
    felt.sound.reset();
    for (let i = 0; i < 300; i++) for (const k of ['ball', 'rail', 'pocket', 'jaw', 'cue']) sfxAt(k, 1 + (i % 7), ac.currentTime + 0.01 + i * 0.0005, 0);
    return { peak: felt.sound.peak, nodes: felt.sound.nodes, cap: felt.sound.cap };
  });
  check('a flood of 1500 hits in 150 ms stays under the node cap', flood.peak <= flood.cap && flood.peak > flood.cap / 3, JSON.stringify(flood));
  const muted = await page.evaluate(async () => {
    await new Promise(r => setTimeout(r, 1500));
    setSetting('sound', false); felt.sound.reset();
    sfx('ball', 5); sfx('pocket', 1, 0); sfx('rail', 3);
    const made = felt.sound.made;
    setSetting('sound', true);
    return { made };
  });
  check('sound off: no nodes are made', muted.made === 0, JSON.stringify(muted));

  /* 6. the haptics map */
  const hap = await page.evaluate(async () => {
    window.__taps = 0; hapTick.addEventListener('click', () => { window.__taps++; });
    const wait = ms => new Promise(r => setTimeout(r, ms)), count = async (f, ms) => { await wait(200); const t = __taps; f(); await wait(ms); return __taps - t; };
    return {
      pot: await count(() => sfx('pocket', 1, 0), 200),
      foul: await count(() => sfx('foul', 1), 300),
      win: await count(() => sfx('win', 1), 400),
      railSoft: await count(() => sfx('rail', 1), 50),
      railHard: await count(() => sfx('rail', 4), 50),
      post: await count(() => sfx('rail', 4, 'post'), 50),
      burst: await count(() => { for (let i = 0; i < 25; i++) { sfx('rail', 4); sfx('ball', 5); } }, 50),
      ballSoft: await count(() => sfx('ball', 1), 50),
      replay: await count(() => { rp = { fake: true, tab: null }; sfx('foul', 1); sfx('rail', 5); sfx('pocket', 1); rp = null; }, 250),
      count: felt.haptics.count
    };
  });
  check('haptics: a pot two toggles (a firm tick), a foul a double, a win three', hap.pot === 2 && hap.foul === 2 && hap.win === 3, JSON.stringify(hap));
  check('haptics: a hard cushion or post one light tick, a soft one or a soft contact none', hap.railHard === 1 && hap.post === 1 && hap.railSoft === 0 && hap.ballSoft === 0, JSON.stringify(hap));
  check('haptics: a burst of hard impacts ticks once (HAP_HIT), a replay none; felt.haptics counts them', hap.burst === 1 && hap.replay === 0 && hap.count >= 10, JSON.stringify(hap));

  /* 7. powerFull: once per pull at 100%, from the real bar */
  await page.evaluate(() => { felt.quitToHome(); felt.start('8'); felt.speed = 1; });
  await settled(page);
  const pull = async (to, wiggle) => {
    const b = await page.$('#powerBar'), r = await b.boundingBox(), up = r.height > r.width;
    const at = u => up ? [r.x + r.width / 2, r.y + r.height * u] : [r.x + r.width * u, r.y + r.height / 2];
    const f0 = await page.evaluate(() => ({ f: felt.sound.fulls, t: __taps }));
    await page.mouse.move(...at(0.03)); await page.mouse.down();
    for (let u = 0.05; u <= to; u += 0.05) await page.mouse.move(...at(u));
    if (wiggle) for (let i = 0; i < 3; i++) { await page.mouse.move(...at(0.85)); await page.mouse.move(...at(1.05)); }
    const mid = await page.evaluate(() => ({ power: felt.power !== undefined ? felt.power : power, f: felt.sound.fulls }));
    await page.mouse.move(...at(-0.6)); await page.mouse.up();   /* back past the start: the pull is cancelled */
    await page.waitForTimeout(150);
    const f1 = await page.evaluate(() => ({ f: felt.sound.fulls, t: __taps, state: felt.state }));
    return { fulls: f1.f - f0.f, ticks: f1.t - f0.t, power: mid.power, state: f1.state };
  };
  const p1 = await pull(1.1, true), p2 = await pull(1.1, false), p3 = await pull(0.6, false);
  check('powerFull: a pull to the end fires once (one tick), however long it is held or wiggled there', p1.fulls === 1 && p1.ticks === 1 && p1.power >= 1, JSON.stringify(p1));
  check('powerFull: the next pull fires again; a pull short of 100% does not', p2.fulls === 1 && p3.fulls === 0 && p3.power < 1, JSON.stringify([p2, p3]));
  /* 8. sound off from the start: a gesture makes no context and fetches nothing */
  await page.evaluate(() => setSetting('sound', false));
  const before = requests.length;
  await page.reload();
  await page.waitForFunction(() => window.booted === true, null, { timeout: 20000 });
  await page.keyboard.press('Shift');
  const offStart = await page.evaluate(async () => { audioOn(); felt.start('8'); sfx('ball', 5); await new Promise(r => setTimeout(r, 300)); return { ac: ac === null, muted }; });
  const fetched = requests.slice(before).filter(u => /\/sounds\//.test(u));
  check('sound off from the start: no audio context is made and no take is fetched', offStart.ac && offStart.muted && !fetched.length, JSON.stringify({ offStart, fetched }));
  await page.evaluate(async () => { setSetting('sound', true); await new Promise(r => setTimeout(r, 400)); });
  const onAgain = await page.evaluate(() => ({ ac: !!ac, sfx: !!SFX }));
  check('turning sound on makes the context and loads the takes', onAgain.ac && onAgain.sfx, JSON.stringify(onAgain));
  check('no console errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
