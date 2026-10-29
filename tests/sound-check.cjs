/* sound-check: the synthesised sound (section 2) and the haptics map (2h).
   Rendered offline through the page's own graph (soundRender, an OfflineAudioContext): a harder
   ball hit peaks higher and is brighter, a soft glancing one quiet and dull; the cue, cushion, jaw,
   bumper post, corner and side pockets and snooker's net each make their own sound; a harder
   cushion is louder; the roll bed follows the speed and fades to nothing when the balls stop; the
   master and table-sound volumes scale the table's sounds (the UI's are not table sounds), sound
   off is silent. Live: a real roll lifts the roll bed and it falls to zero once the table settles,
   sound off makes no nodes, a break and a flood of hits stay under the node cap. Haptics: a pot two
   toggles, a foul a distinct double, a win three, a hard cushion one and a soft none, impacts never
   faster than HAP_HIT, nothing in a replay; the power bar fires powerFull once per pull at 100%
   (a sound and one tick), not below it. */
'use strict';
const { check, done, open, settled } = require('./lib.cjs');

(async () => {
  const { browser, page, errors } = await open('', { init: () => Object.defineProperty(HTMLInputElement.prototype, 'switch', { value: false, writable: true, configurable: true }) });
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
  check('roll: louder fast than slow, and silent once the balls stop', roll.fast.rms > roll.slow.rms && roll.slow.rms > 0 && roll.gone.pk < 1e-4, JSON.stringify(roll));

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
  check('live roll: the roll bed rises while the balls run and is back to zero once they stop', live.state === 'running' && live.rollMax > 0.01 && live.rollEnd === 0 && live.rollGain < 1e-3, JSON.stringify(live));
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
  check('no console errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
