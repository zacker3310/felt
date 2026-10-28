#!/usr/bin/env node
/* cosmetics-check: the look (section 4l) and Stats and records (6s), on the page.
   1. every cosmetic renders: each cloth, rail, ball set, cue and chalk changes the pixels it should
      against the default, and a profile frame rings the avatar on the career hub's card.
   2. contrast on the new cloths: every overlay on the bed (white at the cloth's floor alpha, the
      illegal ring, the game ball's halo, the called-ball colour, the loupe's rim) keeps 3:1 on the
      brightest lit cloth, as render-check measures the first three; the sheets' text keeps 4.5:1 on
      each cloth's accent.
   3. physics never depends on a look: one fixed shot played in every look (every item of every
      slot, and the career's) gives a byte-identical resultOf, and the table's physics constants are
      the same in each.
   4. buy, equip, persist: the career shop buys and equips (credits, achievements, no randomness),
      the equipped items are what a career match wears, what a career owns is unlocked in Settings >
      Graphics, and both survive a reload.
   5. Stats and records: a scripted game's numbers on the record and on the screen (the game's page,
      the records book with its date, the form); the pages fit and read at 375x667 and 440x956.
   6. storage: a v1 record migrates keeping every value (backed up once as it was), and a corrupted
      record recovers from the copy kept before the last write; nothing throws. */
'use strict';
const { check, done, open, smallTargets, lowContrast, settled } = require('./lib.cjs');

const ALL_LOOKS = ['cloth-grey', 'cloth-teal', 'cloth-midnight', 'cloth-plum', 'cue-maple', 'cue-ebony', 'cue-carbon', 'cue-gold', 'cue-legacy', 'cue-champion', 'cue-centurion',
  'chalk-green', 'chalk-red', 'rail-cherry', 'rail-oak', 'rail-ebony', 'balls-pro', 'balls-vintage', 'balls-tv'];
const UNLOCK = `try { localStorage.setItem('felt.looks.v1', ${JSON.stringify(JSON.stringify({ v: 1, own: ALL_LOOKS }))}); } catch (e) { }`;
const HELPERS = () => {
  window.__lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  /* draw a still frame (fixed ball orientations), then read device pixels at CSS points */
  window.__still = () => { for (const n of Object.keys(orient)) orient[n] = rotate(IDENT, [1, 0.6, 0.2], 0.9); draw(performance.now()); return table.getContext('2d'); };
  window.__px = pts => { const c = __still(); return pts.map(([x, y]) => Array.from(c.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data)); };
  /* a region's pixels round a CSS point (r CSS px) */
  window.__box = (x, y, r) => { const c = __still(), d = Math.round(r * dpr); return Array.from(c.getImageData(Math.round(x * dpr) - d, Math.round(y * dpr) - d, 2 * d, 2 * d).data); };
  window.__diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
  /* the look of every slot set through Settings (the career's is set by its own test) */
  window.__wear = o => { for (const k of Object.keys(o)) setSetting(k, o[k]); };
  window.__DEF = { cloth: 'green', cue: 'house', chalk: 'blue', rail: 'walnut', balls: 'classic' };
};
const ev = (t, f, a) => t.page.evaluate(f, a);

(async () => {
  /* ---- 1 and 2. every cosmetic renders; contrast on the new cloths ---- */
  {
    const t = await open('', { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, init: UNLOCK });
    await ev(t, HELPERS);
    await ev(t, () => { felt.today = '2026-10-28'; setSetting('reduceMotion', true); settings.guide = 'off'; hideOverlays(); felt.start('8'); felt.place(TL * 0.2, TW * 0.3); });
    const shown = await ev(t, () => ({ look: look(), def: JSON.stringify(look()) === JSON.stringify(Object.assign({}, __DEF, { ring: null })), own: [...lookOwn].length, state: felt.state }));
    check('setup: every look unlocked, the defaults worn, a rack to aim at', shown.own === 26 && shown.def && shown.state === 'aim', JSON.stringify(shown));
    /* the bed (a clear spot of cloth), the wood, the rack's 1 and the cue ball, and the cue's whole length */
    const sample = () => ev(t, () => {
      const bed = __box(...toScreen(TL * 0.75, TW * 0.2), 6), wood = __box(...toScreen(TL * 0.3, -RAIL * 0.55), 5);
      const one = game.balls.find(b => b.n === 1), cue = game.balls.find(b => b.n === 0), r = BALL_R * view.k;
      const ball1 = __box(...toScreen(one.x, one.y), r * 0.9), cueBall = __box(...toScreen(cue.x, cue.y), r * 0.95);
      /* the cue lies back from the cue ball, away from the aim: read a strip along it */
      aimAnim = null; aimAngle = Math.PI;
      const c = __still(), dx = Math.cos(aimAngle), dy = Math.sin(aimAngle), strip = [];
      for (let s = 0.02; s < 1.5; s += 0.004) { const [x, y] = toScreen(cue.x - dx * s, cue.y - dy * s); strip.push(...c.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data); }
      return { bed, wood, ball1, cueBall, strip };
    });
    const base = await sample();
    const res = {};
    for (const id of ALL_LOOKS) {
      const [slot, key] = [id.slice(0, id.indexOf('-')), id.slice(id.indexOf('-') + 1)];
      await ev(t, ([slot, key]) => { __wear(__DEF); __wear({ [slot]: key }); }, [slot, key]);
      const s = await sample(), d = k => +(await_diff(base[k], s[k])).toFixed(2);
      res[id] = { bed: d('bed'), wood: d('wood'), ball1: d('ball1'), cueBall: d('cueBall'), strip: d('strip') };
    }
    await ev(t, () => __wear(__DEF));
    const want = { cloth: 'bed', rail: 'wood', cue: 'strip', chalk: 'strip' };
    const bad = Object.entries(res).filter(([id, r]) => {
      const slot = id.slice(0, id.indexOf('-'));
      if (slot === 'balls') return !(r.ball1 > 2 || r.cueBall > 2) || r.wood > 0.5;
      return !(r[want[slot]] > (slot === 'chalk' ? 0.05 : 2));
    });
    check(`every cosmetic renders: each of ${ALL_LOOKS.length} looks changes its pixels against the default (cloth the bed, rails the wood, a ball set the balls, a cue or chalk the cue)`,
      !bad.length, JSON.stringify(bad.length ? bad : res).slice(0, 900));
    check('a look changes only its own part: a cue leaves the bed and the wood as they were, a cloth leaves the wood',
      ALL_LOOKS.filter(id => id.startsWith('cue-')).every(id => res[id].bed < 0.5 && res[id].wood < 0.5) && ALL_LOOKS.filter(id => id.startsWith('cloth-')).every(id => res[id].wood < 3), JSON.stringify(res).slice(0, 600));
    /* contrast: every overlay against the brightest lit spot of each new cloth's bed */
    const con = [];
    for (const cloth of ['green', 'red', 'blue', 'grey', 'teal', 'midnight', 'plum']) {
      con.push(await ev(t, cloth => {
        __wear({ cloth }); draw(performance.now());
        let best = [0, 0, 0], bl = 0;
        const balls = game.balls.filter(b => b.on), clear = (x, y) => balls.every(b => Math.hypot(b.x - x, b.y - y) > BALL_R * 3);
        for (let i = 1; i < 12; i++) for (let j = 1; j < 7; j++) {
          const x = TL * i / 12, y = TW * j / 7;
          if (!clear(x, y)) continue;
          const [sx, sy] = toScreen(x, y), c = Array.from(tableImg.getContext('2d').getImageData(Math.round(sx * dpr), Math.round(sy * dpr), 1, 1).data), l = __lum(c);
          if (l > bl) { bl = l; best = c; }
        }
        const over = (f, a) => f.map((v, i) => v * a + best[i] * (1 - a)), hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
        const cr = c => { const a = __lum(c); return +((Math.max(a, bl) + 0.05) / (Math.min(a, bl) + 0.05)).toFixed(2); };
        return { cloth, white: cr(over([255, 255, 255], CL.ovMin)), illegal: cr(hex(ILLEGAL)), halo: cr(over([255, 236, 190], 0.95)), call: cr(hex(CL.call)), loupe: cr(over([255, 255, 255], 0.85)), bed: best };
      }, cloth));
    }
    check('contrast: on every cloth (the four new ones too) each overlay keeps 3:1 on the brightest lit bed (white lines and rings at the floor alpha, illegal, halo, called ball, loupe rim)',
      con.every(c => ['white', 'illegal', 'halo', 'call', 'loupe'].every(k => c[k] >= 3)), JSON.stringify(con));
    /* the near-black balls take a light rim on the darkest cloths */
    const rim = await ev(t, () => { __wear({ cloth: 'midnight' }); const b8 = game.balls.find(b => b.n === 8), [x, y] = toScreen(b8.x, b8.y), r = BALL_R * view.k;
      const ring = __px([[x + r * 0.93, y], [x - r * 0.93, y], [x, y + r * 0.93], [x, y - r * 0.93]]).map(__lum);
      __wear({ cloth: 'green' }); return { CLrim: CLOTHS.midnight.rim, ring: Math.max(...ring) }; });
    check('midnight: the 8 wears its light rim on the dark cloth', rim.CLrim && rim.ring > 0.25, JSON.stringify(rim));
    /* the sheets' text on each cloth's accent: Settings > Graphics and Stats */
    const low = [];
    for (const cloth of ['grey', 'teal', 'midnight', 'plum']) {
      await ev(t, cloth => { __wear({ cloth }); felt.quitToHome(); showPrefs('gfx'); }, cloth);
      await t.page.waitForTimeout(200);
      const a = await lowContrast(t.page), s = await smallTargets(t.page);
      if (a.length || s.length) low.push({ cloth, a, s });
      await ev(t, () => showStats());
      await t.page.waitForTimeout(200);
      const b = await lowContrast(t.page);
      if (b.length) low.push({ cloth, b });
    }
    await ev(t, () => { __wear({ cloth: 'green' }); felt.quitToHome(); });
    check('the new cloths: Settings > Graphics and Stats keep 4.5:1 text and 44 px targets on each', !low.length, JSON.stringify(low).slice(0, 600));
    check('render: no console errors', t.errors.length === 0, t.errors.join(' | '));
    await t.browser.close();
  }

  /* ---- 3. physics never depends on a look ---- */
  {
    const t = await open('', { init: UNLOCK });
    await ev(t, HELPERS);
    const runs = await ev(t, async ALL => {
      const idle = () => new Promise(r => { const w = () => ['stroke', 'rolling', 'thinking'].includes(felt.state) ? setTimeout(w, 5) : r(); w(); });
      felt.speed = 40; settings.cpu = false; cpuMode = false;
      hideOverlays(); felt.start('8');
      const layout = JSON.parse(JSON.stringify(game.balls)), out = {};
      const play = async tag => {
        hideOverlays(); felt.start('8');
        game.balls = JSON.parse(JSON.stringify(layout)); game.inHand = null;
        const consts = [BALL_R, MU_ROLL, CUE_RATIO, CUSH_MU, RAIL_E, TL, TW, JSON.stringify(POCKETS)].join();
        const sim = JSON.stringify(simulateShot(game.balls, { angle: 0.02, power: 0.85, spin: { x: 0.2, y: -0.3 } }));
        felt.shoot(0.02, 0.85, { x: 0.2, y: -0.3 });
        await idle();
        out[tag] = { r: JSON.stringify(felt.lastResult), sim, consts };
      };
      await play('default');
      for (const id of ALL) { const i = id.indexOf('-'); __wear(__DEF); __wear({ [id.slice(0, i)]: id.slice(i + 1) }); await play(id); }
      /* everything at once */
      __wear({ cloth: 'midnight', cue: 'legacy', chalk: 'red', rail: 'oak', balls: 'tv' });
      await play('all');
      __wear(__DEF);
      felt.speed = 1;
      return out;
    }, ALL_LOOKS);
    const ref = runs.default, diff = Object.keys(runs).filter(k => runs[k].r !== ref.r || runs[k].sim !== ref.sim || runs[k].consts !== ref.consts);
    check(`physics: one shot with english in ${Object.keys(runs).length} looks (every item of every slot, and all at once) gives a byte-identical resultOf and simulateShot`, !diff.length && ref.r.length > 1000, diff.join(','));
    check('physics: the live roll equals simulateShot in every look', Object.values(runs).every(r => JSON.stringify(JSON.parse(r.r).balls) === JSON.stringify(JSON.parse(r.sim).balls)));
    check('physics: no console errors', t.errors.length === 0, t.errors.join(' | '));
    await t.browser.close();
  }

  /* ---- 4. buy, equip, persist; a career match wears the career's look ---- */
  {
    const t = await open('', { viewport: { width: 440, height: 956 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await ev(t, HELPERS);
    const a = await ev(t, () => {
      Career.create({ name: 'Lou Cosmo', start: 'pro' }, { seed: 77 });
      const S = Career.lib.state();
      S.me.money = 50000;
      const before = { own: [...lookOwn].length, shop: Career.shop().length };
      const champ0 = Career.buy('cue-champion'), drill0 = Career.buy('cloth-plum');
      const r = ['cloth-midnight', 'rail-cherry', 'balls-pro', 'cue-gold', 'chalk-red', 'ring-gold'].map(id => [id, Career.buy(id).ok, Career.equip(id).ok]);
      const m1 = Career.now().money;
      S.st.all.ti = 1;
      const champ1 = Career.buy('cue-champion'), m2 = Career.now().money;
      S.me.mas['long-pot'] = { best: 92, n: 1, lv: 3 };
      const drill1 = Career.buy('cloth-plum');
      Career.save();
      const shop = Career.shop();
      return { before, champ0, drill0, r, m1, champ1, m2, drill1, eq: Career.equipped(), effects: shop.every(i => i.effect === 'none'), allFixed: shop.every(i => Number.isInteger(i.price) && i.price >= 0), needs: shop.filter(i => i.need).map(i => [i.id, i.needWords]) };
    });
    check('shop: a locked achievement item is refused until its achievement (first title, gold in a drill), then claimed free',
      !a.champ0.ok && a.champ0.why === 'Win a title' && !a.drill0.ok && a.drill0.why === 'Gold mastery in a drill' && a.champ1.ok && a.m2 === a.m1 && a.drill1.ok, JSON.stringify(a));
    check('shop: bought at their prices and equipped; every item cosmetic, a fixed price, no randomness', a.r.every(x => x[1] && x[2]) && a.m1 === 50000 - (1500 + 400 + 900 + 9000 + 50 + 2000) && a.effects && a.allFixed
      && a.eq.cloth === 'cloth-midnight' && a.eq.ring === 'ring-gold', JSON.stringify(a));
    /* the shop page: the honest note, every slot, swatches, Claim for an achievement item */
    await ev(t, () => { felt.showCareer(); felt.careerGo('shop'); });
    await t.page.waitForTimeout(450);
    const sp = await ev(t, () => ({ note: cvBody.querySelector('.cvNote').textContent, heads: [...cvBody.querySelectorAll('.cvHead')].map(h => h.textContent), sw: cvBody.querySelectorAll('.shopSw').length,
      rows: cvBody.querySelectorAll('.topic').length, eqd: (document.getElementById('shop-cloth-midnight') || {}).textContent }));
    check('shop page: the note says what happens (career matches show it, Settings can wear it, fixed prices, nothing random), a heading per slot and a swatch per item',
      /career matches show/.test(sp.note) && /Settings, Graphics/.test(sp.note) && /nothing random/.test(sp.note) && !/do not change how the game looks/.test(sp.note)
      && sp.heads.join() === 'Cues,Cloths,Chalk,Rails,Ball sets,Profile frames' && sp.sw === sp.rows && sp.rows === 32 && /Equipped/.test(sp.eqd), JSON.stringify(sp));
    const sm = await smallTargets(t.page), lc = await lowContrast(t.page), fit = await ev(t, () => [cvSheet.scrollWidth, cvSheet.clientWidth]);
    check('shop page: targets 44 px, text 4.5:1, fits the width at 440', !sm.length && !lc.length && fit[0] <= fit[1] + 1, JSON.stringify({ sm, lc, fit }));
    /* the hub's card: the avatar in its frame (a ring of the frame's colour, pixels differ from no frame) */
    await ev(t, () => { felt.showCareer(); });
    await t.page.waitForTimeout(450);
    const av = await t.page.$('#cvMe .av');
    const fr = await ev(t, () => { const e = document.querySelector('#cvMe .av'); return { cls: e.className, frame: e.dataset.frame, sh: getComputedStyle(e).boxShadow }; });
    const shotA = await av.screenshot();
    await ev(t, () => { Career.lib.state().inv.eq.ring = null; felt.showCareer(); });
    await t.page.waitForTimeout(450);
    const shotB = await (await t.page.$('#cvMe .av')).screenshot();
    await ev(t, () => { Career.equip('ring-gold'); felt.showCareer(); });
    check('profile frame: the hub card\'s avatar wears the equipped frame (a gold ring), and the pixels differ from no frame', /\bfr\b/.test(fr.cls) && fr.frame === 'gold' && /242, 201, 76/.test(fr.sh) && !shotA.equals(shotB), JSON.stringify(fr));
    /* owned in the career: unlocked in Settings > Graphics */
    const gfx = await ev(t, () => { felt.quitToHome(); showPrefs('gfx'); return { own: lookOwned('cloth', 'midnight') && lookOwned('cue', 'gold') && lookOwned('balls', 'pro'), btn: !document.getElementById('clMidnight').hidden && !document.getElementById('lk-cue-gold').hidden,
      locked: document.getElementById('lk-rail-oak').hidden, note: lookNote.textContent }; });
    check('Settings > Graphics: what the career owns is unlocked and shown; what it does not own stays hidden', gfx.own && gfx.btn && gfx.locked && /looks unlocked/.test(gfx.note), JSON.stringify(gfx));
    await t.page.click('#lk-cue-gold');
    await t.page.click('#clMidnight');
    const set = await ev(t, () => ({ cue: settings.cue, cloth: settings.cloth, look: look(), pressed: document.getElementById('lk-cue-gold').getAttribute('aria-pressed') }));
    check('Settings: a tap wears an unlocked look outside the career', set.cue === 'gold' && set.cloth === 'midnight' && set.look.cue === 'gold' && set.look.cloth === 'midnight' && set.pressed === 'true', JSON.stringify(set));
    await t.page.reload(); await t.page.waitForFunction(() => window.booted === true);
    await ev(t, HELPERS);
    const per = await ev(t, () => { const idx = Career.index(); Career.load(idx.active); return { look: look(), own: lookOwned('rail', 'cherry'), eq: Career.equipped(), owned: Career.shop().filter(i => i.owned).length }; });
    check('persist: after a reload the settings\' look, the unlocked set and the career\'s purchases and equipment are all kept',
      per.look.cue === 'gold' && per.look.cloth === 'midnight' && per.own && per.eq.cloth === 'cloth-midnight' && per.eq.cue === 'cue-gold' && per.eq.ring === 'ring-gold' && per.owned === 5 + 6 + 2, JSON.stringify(per));
    /* a career match wears the career's look (not the settings'), and the table shows it */
    await ev(t, () => { __wear({ cloth: 'green', cue: 'house' }); felt.quitToHome(); });
    let guard = 0;
    await ev(t, () => { if (!Career.nextMatch() && !Career.schedule().length) { const e = Career.availableEvents().find(x => x.eligibility.ok && x.live); if (e) Career.enter(e.id); } });
    while (!(await ev(t, () => !!Career.nextMatch() && Career.GAMES[Career.nextMatch().rules.game].live)) && guard++ < 30) await ev(t, () => felt.careerAdvance('week'));
    const cm = await ev(t, () => {
      const ok = felt.careerPlay();
      if (!ok) return { ok };
      const L = look(), bed = __px([toScreen(TL * 0.75, TW * 0.2)])[0];
      const out = { ok, L, cl: CL === CLOTHS.midnight, bed };
      felt.quitToHome();
      out.after = look();
      return out;
    });
    check('career match: the table wears the career\'s equipped look (midnight cloth, cherry rails, pro balls, gold cue, red chalk), and the settings\' look returns after',
      cm.ok && cm.L.cloth === 'midnight' && cm.L.rail === 'cherry' && cm.L.balls === 'pro' && cm.L.cue === 'gold' && cm.L.chalk === 'red' && cm.cl && cm.bed[2] > cm.bed[1] && cm.after.cloth === 'green' && cm.after.cue === 'house', JSON.stringify(cm));
    check('shop and career: no console errors', t.errors.length === 0, t.errors.join(' | '));
    await t.browser.close();
  }

  /* ---- 5. Stats and records: a scripted game's numbers ---- */
  for (const vp of [{ width: 375, height: 667 }, { width: 440, height: 956 }]) {
    const t = await open('', { viewport: vp, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const sc = await ev(t, async () => {
      const idle = () => new Promise(r => { const w = () => ['stroke', 'rolling', 'thinking'].includes(felt.state) ? setTimeout(w, 5) : r(); w(); });
      felt.today = '2026-10-28'; felt.speed = 40;
      settings.cpu = false; cpuMode = false;
      hideOverlays(); felt.start('9');
      /* the 1 straight in to a corner pocket, the 9 out of the way: a two-player shot */
      const P = POCKETS.reduce((a, p) => p[0] + p[1] > a[0] + a[1] ? p : a), c = [TL * 0.4, TW * 0.5], o = [c[0] + (P[0] - c[0]) * 0.55, c[1] + (P[1] - c[1]) * 0.55];
      game.balls = game.balls.map(b => Object.assign({}, b, b.n === 0 ? { x: c[0], y: c[1] } : b.n === 1 ? { x: o[0], y: o[1] } : b.n === 9 ? { x: TL * 0.15, y: TW * 0.2 } : { on: false }));
      game = Object.assign({}, game, { breakShot: false, inHand: null });
      const r0 = felt.record.kinds['9'];
      felt.shoot(Math.atan2(P[1] - c[1], P[0] - c[0]), 0.45, 0);
      await idle();
      const r1 = felt.record.kinds['9'], cm = Math.round(100 * Math.hypot(P[0] - o[0], P[1] - o[1]));
      felt.forceWin(0);
      const r2 = felt.record.kinds['9'];
      /* and a win against the CPU at 8-ball */
      settings.cpu = true; settings.level = 'hard'; cpuMode = true; cpuLevel = 'hard';
      hideOverlays(); felt.start('8'); felt.forceWin(0);
      felt.speed = 1;
      return { r0, r1, r2, cm, potted: felt.lastResult.potted, rec: felt.record };
    });
    const k = sc.r1;
    check(`${vp.width}x${vp.height}: a scripted pot is recorded (1 shot, 1 legal pot, no foul, a best run of 1 and the longest pot in cm, dated)`,
      sc.potted.includes(1) && k.sh === sc.r0.sh + 1 && k.pot === sc.r0.pot + 1 && k.fo === 0 && k.br === 0 && k.run[0] === 1 && k.run[1] === '2026-10-28' && k.lp[0] === sc.cm && k.lp[1] === '2026-10-28', JSON.stringify(sc));
    check(`${vp.width}x${vp.height}: the game counts as played and two-player; the CPU win joins the form with its level and date, and the best streak its date`,
      sc.r2.played === 1 && sc.r2.two === 1 && sc.rec.form.length === 1 && JSON.stringify(sc.rec.form[0]) === '["8","W","hard","2026-10-28"]' && sc.rec.best === 1 && sc.rec.bestD === '2026-10-28', JSON.stringify(sc.rec));
    await ev(t, () => felt.quitToHome());
    await t.page.click('#statsBtn');
    await t.page.waitForTimeout(300);
    const root = await ev(t, () => ({ rows: [...statsKinds.querySelectorAll('.topic')].map(b => b.textContent), book: stBookSub.textContent, form: stFormSub.textContent, page: felt.statsPage, title: statsTitle.textContent }));
    check(`${vp.width}x${vp.height}: Stats lists every game with what was played (9-ball: 1 played, none vs CPU; 8-ball: 1 won of 1 vs CPU), the records book and the form`,
      root.rows.length === 8 && /9-ball1 played, none vs CPU$/.test(root.rows[1]) && /8-ball1 played, 1 won of 1 vs CPU$/.test(root.rows[0]) && /3 records/.test(root.book) && /Last 1: W/.test(root.form) && root.page === null && root.title === 'Stats', JSON.stringify(root));
    const a0 = { s: await smallTargets(t.page), l: await lowContrast(t.page), f: await ev(t, () => [statsBody.scrollWidth, statsBody.clientWidth, statsBody.scrollHeight, statsBody.clientHeight]) };
    await t.page.click('#st-9');
    await t.page.waitForTimeout(450);
    const pg = await ev(t, () => ({ page: felt.statsPage, title: statsTitle.textContent, rows: Object.fromEntries([...statsPage.querySelectorAll('.stat')].map(r => [r.firstChild.firstChild.textContent, r.lastChild.textContent])) }));
    check(`${vp.width}x${vp.height}: the 9-ball page shows the scripted numbers with their denominators (played 1, potting 1 of 1, fouls 0 of 1, best run 1 ball dated, the longest pot)`,
      pg.page === '9' && pg.title === '9-ball' && pg.rows.Played === '1' && pg.rows['Wins against the CPU'] === 'none yet' && pg.rows.Potting === '1 of 1, 100%' && pg.rows.Fouls === '0 of 1, 0%'
      && pg.rows['Break success'] === 'none yet' && pg.rows['Best run'] === '1 ball28 Oct 2026' && pg.rows['Longest pot'] === `${sc.cm} cm28 Oct 2026`, JSON.stringify(pg));
    const a1 = { s: await smallTargets(t.page), l: await lowContrast(t.page), f: await ev(t, () => [statsBody.scrollWidth, statsBody.clientWidth]) };
    await t.page.click('#statsBack'); await t.page.waitForTimeout(450);
    await t.page.click('#stBook'); await t.page.waitForTimeout(450);
    const bk = await ev(t, () => [...statsPage.querySelectorAll('.stat')].map(r => r.textContent));
    check(`${vp.width}x${vp.height}: the records book: the win streak, 9-ball's best run and longest pot, each dated`,
      bk.length === 3 && /^Longest win streak against the CPU28 Oct 20261 game$/.test(bk[0]) && /^9-ball: best run28 Oct 20261 ball$/.test(bk[1]) && new RegExp(`^9-ball: longest pot28 Oct 2026${sc.cm} cm$`).test(bk[2]), JSON.stringify(bk));
    const a2 = { s: await smallTargets(t.page), l: await lowContrast(t.page) };
    await t.page.click('#statsBack'); await t.page.waitForTimeout(450);
    await t.page.click('#stForm'); await t.page.waitForTimeout(450);
    const fm = await ev(t, () => ({ chips: [...statsPage.querySelectorAll('.form i')].map(i => i.textContent).join(''), rows: [...statsPage.querySelectorAll('.stat')].map(r => r.textContent) }));
    check(`${vp.width}x${vp.height}: the form: one W, the game by name, opponent and date`, fm.chips === 'W' && fm.rows.length === 1 && fm.rows[0] === '8-ball vs Hustler28 Oct 2026Won', JSON.stringify(fm));
    const a3 = { s: await smallTargets(t.page), l: await lowContrast(t.page) };
    await t.page.click('#statsBack'); await t.page.waitForTimeout(450);
    const back = await ev(t, () => felt.statsPage === null && statsSheet.classList.contains('show') && !statsList.hidden);
    await t.page.click('#statsBack'); await t.page.waitForTimeout(200);
    const home = await ev(t, () => menu.classList.contains('show') && !statsSheet.classList.contains('show'));
    const all = [a0, a1, a2, a3];
    check(`${vp.width}x${vp.height}: every Stats page: targets 44 px, text 4.5:1, fits the width (the overview scrolls), Back pops to the overview and then goes home`,
      all.every(a => !a.s.length && !a.l.length) && a0.f[0] <= a0.f[1] + 1 && a0.f[2] > a0.f[3] && a1.f[0] <= a1.f[1] + 1 && back && home, JSON.stringify(all).slice(0, 600));
    check(`${vp.width}x${vp.height}: stats, no console errors`, t.errors.length === 0, t.errors.join(' | '));
    await t.browser.close();
  }

  /* ---- 6. storage: migration and corruption ---- */
  {
    const V1 = { v: 1, kinds: { 8: { played: 12, two: 3, cpu: { easy: { w: 4, l: 1 }, medium: { w: 2, l: 1 }, hard: { w: 0, l: 1 } } }, 9: { played: 5, two: 5, cpu: { easy: { w: 0, l: 0 }, medium: { w: 0, l: 0 }, hard: { w: 0, l: 0 } } },
      snooker: { played: 2, two: 0, cpu: { easy: { w: 1, l: 1 }, medium: { w: 0, l: 0 }, hard: { w: 0, l: 0 } }, frames: 4, high: 37 } }, streak: 2, best: 5 };
    const t = await open('', { init: `try { if (!sessionStorage.getItem('mig')) { localStorage.setItem('felt.record.v1', ${JSON.stringify(JSON.stringify(V1))}); localStorage.removeItem('felt.record.v1.bak'); localStorage.removeItem('felt.record.prev'); sessionStorage.setItem('mig', '1'); } } catch (e) { }` });
    const m = await ev(t, () => ({ r: felt.record, bak: localStorage.getItem('felt.record.v1.bak') }));
    const k8 = m.r.kinds['8'];
    check('migration: a v1 record keeps every value it had (played, two-player, each level\'s wins and losses, snooker\'s frames and highest break, the streaks)',
      m.r.v === 2 && k8.played === 12 && k8.two === 3 && k8.cpu.easy.w === 4 && k8.cpu.hard.l === 1 && m.r.kinds['9'].two === 5 && m.r.kinds.snooker.frames === 4 && m.r.kinds.snooker.high === 37 && m.r.streak === 2 && m.r.best === 5, JSON.stringify(m.r));
    check('migration: the new numbers start at nothing (shots, pots, fouls, breaks, bests without dates, no form)', k8.sh === 0 && k8.pot === 0 && k8.run[0] === 0 && k8.run[1] === null && m.r.form.length === 0 && m.r.bestD === null && m.bak === null, JSON.stringify(m));
    const w = await ev(t, () => { felt.today = '2026-10-28'; settings.cpu = true; settings.level = 'easy'; cpuMode = true; cpuLevel = 'easy'; hideOverlays(); felt.start('8'); felt.forceWin(0); felt.quitToHome();
      return { main: JSON.parse(localStorage.getItem('felt.record.v1')), bak: localStorage.getItem('felt.record.v1.bak'), prev: JSON.parse(localStorage.getItem('felt.record.prev')) }; });
    check('migration: the first write keeps the v1 record as it was (felt.record.v1.bak), and the new record has the old values and the game',
      w.bak === JSON.stringify(V1) && w.main.v === 2 && w.main.kinds['8'].played === 13 && w.main.kinds['8'].cpu.easy.w === 5 && w.main.streak === 3 && w.main.kinds.snooker.high === 37 && w.prev.v === 1, JSON.stringify(w).slice(0, 500));
    /* a second game, then the record corrupted: the copy kept before the last write comes back */
    const c = await ev(t, () => { hideOverlays(); felt.start('8'); felt.forceWin(0); felt.quitToHome(); const good = felt.record; localStorage.setItem('felt.record.v1', '{"v":2,"kinds":'); return good; });
    await t.page.reload(); await t.page.waitForFunction(() => window.booted === true);
    const rc = await ev(t, () => felt.record);
    check('corruption: an unreadable record is recovered from the copy kept before the last write (one game short at most, never empty)',
      rc.kinds['8'].played === c.kinds['8'].played - 1 && rc.kinds['8'].cpu.easy.w === c.kinds['8'].cpu.easy.w - 1 && rc.kinds.snooker.high === 37, JSON.stringify({ rc: rc.kinds['8'], c: c.kinds['8'] }));
    await ev(t, () => { localStorage.setItem('felt.record.v1', JSON.stringify({ v: 2, kinds: { 8: { played: 'x', sh: -4, pot: 1.5, fo: 3, br: 2, brOk: 9, run: [7, 'not a date'], lp: ['x', '2026-01-01'], cpu: null }, nope: { played: 9 } }, streak: -1, best: 'y', form: [['8', 'W', 'easy', '2026-10-01'], ['x', 'W', 'easy'], ['9', 'Q', 'hard'], 'z'], bestD: 5 })); });
    await t.page.reload(); await t.page.waitForFunction(() => window.booted === true);
    const g = await ev(t, () => felt.record);
    check('corruption: bad values read as zero or none (a count that is not one, a date that is not a date, a break count over the breaks), unknown kinds and bad form entries dropped',
      g.kinds['8'].played === 0 && g.kinds['8'].sh === 0 && g.kinds['8'].pot === 0 && g.kinds['8'].fo === 3 && g.kinds['8'].brOk === 2 && g.kinds['8'].run[0] === 7 && g.kinds['8'].run[1] === null && g.kinds['8'].lp[0] === 0
      && !g.kinds.nope && g.streak === 0 && g.best === 0 && g.form.length === 1 && g.form[0][3] === '2026-10-01', JSON.stringify(g));
    await ev(t, () => { localStorage.setItem('felt.record.v1', '[]'); localStorage.setItem('felt.record.prev', '{nope'); localStorage.setItem('felt.looks.v1', '{"v":1,"own":[1,"cloth-nope","__proto__","cue-gold"]}'); });
    await t.page.reload(); await t.page.waitForFunction(() => window.booted === true);
    const z = await ev(t, () => ({ r: felt.record, own: [...lookOwn], polluted: ({}).polluted === 1 }));
    check('corruption: a record and its copy both unreadable start from nothing; a bad unlock list keeps only real looks', z.r.kinds['8'].played === 0 && z.r.v === 2 && z.own.includes('cue-gold') && !z.own.includes('cloth-nope') && z.own.length === 8 && !z.polluted, JSON.stringify(z));
    await ev(t, () => showStats());
    check('storage: no console errors', t.errors.length === 0, t.errors.join(' | '));
    await t.browser.close();
  }
  done();
})().catch(e => { console.error(e); process.exit(1); });

function await_diff(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; }
