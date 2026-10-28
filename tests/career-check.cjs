/* career-check: the first-run lesson and the career (section 6d), on phones (440x956, 375x667
   and 956x440, real touch events with their own timestamps).
   Lesson: a first run offers it once; Skip marks it seen; each step advances on its own action
   (a tap on the ball aims it, the wheel nudges it, a pull on the bar pots it), with a coach card
   kept off the cue ball and the controls; a miss puts the balls back; the finish sheet; the home
   row goes once it is done; nothing but the bar shoots.
   Career (the screens over Career, 1z): a first open, the new career form, the hub with every
   page as a row, the calendar with fees and eligibility reasons, enter and withdraw, time moving
   to a match, the match played on the real game with the event's locked rules and the
   opponent's CPU level, the pause menu, between racks, the result reported, the bracket, every
   other page (targets, contrast, nothing wider than the screen or cut off), practice, a reload,
   forfeits (Forfeit match, and a match left by closing the page, counted once), a CPU game left
   mid-rack counted as a loss (audit F5), delete with a confirmation, the old ladder record
   carried over and never changed, damaged saves; home still fits.
   FELT_SHOTS=<dir> also saves screenshots of each screen there. */
'use strict';
const path = require('path');
const { check, done, open, smallTargets, lowContrast, settled } = require('./lib.cjs');
const SHOTS = process.env.FELT_SHOTS || '';
const DEG = Math.PI / 180;
const DRILL_SOLS = require('./drill-solutions.json');

async function phone(viewport, opts = {}) {
  const o = await open('', { viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 3, ...opts });
  const cdp = await o.page.context().newCDPSession(o.page);
  let vt = Date.now() / 1000;
  const tch = async (type, p, dt = 16) => {
    vt += dt / 1000;
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: p[0], y: p[1], id: 1 }], timestamp: vt });
  };
  const shot = async name => { if (SHOTS) await o.page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
  return { ...o, down: (p, dt) => tch('touchStart', p, dt), move: (p, dt) => tch('touchMove', p, dt), up: dt => tch('touchEnd', null, dt), shot };
}
const ev = (T, f, a) => T.page.evaluate(f, a);
const rect = (T, sel) => ev(T, s => { const r = document.querySelector(s).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, sel);
const meets = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
/* the coach card: on screen, clear of every control and of the cue ball */
const coachClear = T => ev(T, () => {
  const R = e => e.getBoundingClientRect(), c = R(coach), cb = felt.game.balls.find(b => b.n === 0), s = felt.toScreen(cb.x, cb.y), r = felt.ballPx / 2;
  const hits = [powerBar, fineWheel, spinPad, menuBtn].filter(e => { const q = R(e); return c.left < q.right && c.right > q.left && c.top < q.bottom && c.bottom > q.top; }).map(e => e.id);
  const dx = Math.max(c.left - s[0], 0, s[0] - c.right), dy = Math.max(c.top - s[1], 0, s[1] - c.bottom);
  return { shown: !coach.hidden && c.width > 0, hits, cueGap: Math.round(Math.hypot(dx, dy) - r), inside: c.left >= 0 && c.top >= 0 && c.right <= innerWidth && c.bottom <= innerHeight, ring: !coachRing.hidden, step: coachStep.textContent, text: coachText.textContent };
});
/* a pull along the power bar from its start to frac of its length, then let go */
async function pullBar(T, frac) {
  const b = await rect(T, '#powerBar'), up = b.h > b.w;
  const at = u => up ? [b.l + b.w / 2, b.t + 6 + u * (b.h - 6)] : [b.l + 6 + u * (b.w - 6), b.t + b.h / 2];
  await T.down(at(0));
  for (let i = 1; i <= 16; i++) await T.move(at(frac * i / 16), 16);
  await T.up(16);
}

(async () => {
  /* ---------- the lesson, both ways up ---------- */
  for (const vp of [{ width: 440, height: 956 }, { width: 956, height: 440 }]) {
    const tag = `${vp.width}x${vp.height}`, sfx = vp.width < vp.height ? 'p' : 'l';
    const T = await phone(vp, { firstRun: true });
    await T.page.waitForTimeout(300);
    const offer = await ev(T, () => ({ shown: lessonOffer.classList.contains('show'), title: offerTitle.textContent, rec: felt.lessonRec }));
    check(`${tag}: a first run offers the lesson ("New to felt?", Show me / Skip)`, offer.shown && offer.title === 'New to felt?' && !offer.rec.seen, JSON.stringify(offer));
    check(`${tag}: the offer: targets 44 px, text 4.5:1`, (await smallTargets(T.page)).length === 0 && (await lowContrast(T.page)).length === 0, JSON.stringify([await smallTargets(T.page), await lowContrast(T.page)]));
    await T.shot('offer-' + sfx);
    if (sfx === 'p') {
      await T.page.click('#offerSkip');
      const sk = await ev(T, () => ({ shown: lessonOffer.classList.contains('show'), rec: felt.lessonRec, ls: localStorage.getItem('felt.lesson.v1'), row: !lessonBtn.hidden && lessonBtn.getClientRects().length > 0 }));
      check('Skip: the offer goes, marked seen (stored), the lesson row stays on home', !sk.shown && sk.rec.seen && !sk.rec.done && JSON.parse(sk.ls).seen === true && sk.row, JSON.stringify(sk));
      await T.page.reload(); await T.page.waitForFunction(() => window.booted === true);
      await T.page.waitForTimeout(200);
      check('after a skip, a reload offers it no more', await ev(T, () => !lessonOffer.classList.contains('show')));
      await T.page.click('#lessonBtn');
    } else await T.page.click('#offerGo');
    await T.page.waitForTimeout(300);
    const s1 = await ev(T, () => ({ step: felt.lessonStep, mode: felt.game.mode, cpu: felt.cpu, balls: felt.game.balls.filter(b => b.on).length, off: Math.abs(Math.atan2(Math.sin(felt.aim - felt.lessonLine), Math.cos(felt.aim - felt.lessonLine))), shots: felt.game.shots }));
    check(`${tag}: the lesson starts at step 1: the cue ball and the 1, no CPU, the aim well off the line`, s1.step === 1 && s1.mode === 'practice' && !s1.cpu && s1.balls === 2 && s1.off > 10 * DEG, JSON.stringify(s1));
    const c1 = await coachClear(T);
    check(`${tag}: step 1 coach card: the aim sentence, on screen, off the controls and the cue ball, a ring on the ball`,
      c1.shown && c1.ring && c1.inside && !c1.hits.length && c1.cueGap > 0 && /Step 1 of 3/.test(c1.step) && /Drag anywhere on the table/.test(c1.text), JSON.stringify(c1));
    await T.shot('lesson1-' + sfx);
    /* a sweep away from the line, and keys: none of it shoots, and the step waits */
    const cue = await ev(T, () => { const c = felt.game.balls[0]; return felt.toScreen(c.x, c.y); });
    const st = await rect(T, '#stage');
    const far = [cue[0] > (st.l + st.r) / 2 ? st.l + 40 : st.r - 40, cue[1] > (st.t + st.b) / 2 ? st.t + 60 : st.b - 60];
    await T.down(far);
    for (let i = 1; i <= 10; i++) await T.move([far[0] + 3 * i, far[1]], 16);
    await T.up(16);
    for (const k of ['Enter', ' ', 's', 'ArrowUp']) await T.page.keyboard.press(k);
    await T.page.waitForTimeout(150);
    const k1 = await ev(T, () => ({ st: felt.state, shot: felt.lastShot, step: felt.lessonStep }));
    check(`${tag}: a drag on the table and keys never shoot in the lesson`, k1.st === 'aim' && k1.shot === null && k1.step === 1, JSON.stringify(k1));
    /* step 1: a tap on the 1 aims straight at it */
    const one = await ev(T, () => { const b = felt.game.balls.find(o => o.n === 1); return felt.toScreen(b.x, b.y); });
    await T.down(one, 30); await T.up(60);
    await T.page.waitForTimeout(200);
    const s2 = await ev(T, () => ({ step: felt.lessonStep, off: Math.abs(Math.atan2(Math.sin(felt.aim - felt.lessonLine), Math.cos(felt.aim - felt.lessonLine))) }));
    const c2 = await coachClear(T);
    check(`${tag}: a tap on the ball aims within 2 deg of straight in, and step 2 (the wheel) comes up, clear of the controls`,
      s2.step === 2 && s2.off < 2 * DEG && c2.shown && !c2.hits.length && c2.inside && /Roll the wheel/.test(c2.text), JSON.stringify([s2, c2]));
    const ringW = await ev(T, () => { const a = coachRing.getBoundingClientRect(), b = fineWheel.getBoundingClientRect(); const H = innerHeight - 2.5, W = innerWidth - 2.5; return a.left <= Math.max(b.left, 2.5) && a.right >= Math.min(b.right, W) && a.top <= Math.max(b.top, 2.5) && a.bottom >= Math.min(b.bottom, H); });
    check(`${tag}: step 2's ring goes round the wheel (outside it, or at a screen edge hugging it)`, ringW);
    await T.shot('lesson2-' + sfx);
    /* step 2: a roll of the wheel */
    const a2 = await ev(T, () => felt.aim);
    const w = await rect(T, '#fineWheel'), wc = [w.l + w.w / 2, w.t + w.h / 2 - 20];
    await T.down(wc, 30);
    for (let i = 1; i <= 8; i++) await T.move([wc[0], wc[1] + 4 * i], 30);
    await T.up(30);
    await T.page.waitForTimeout(200);
    const s3 = await ev(T, () => ({ step: felt.lessonStep, aim: felt.aim, shot: felt.lastShot }));
    const c3 = await coachClear(T);
    check(`${tag}: rolling the wheel nudges the aim and brings up step 3 (the bar), the card off the controls`,
      s3.step === 3 && s3.aim !== a2 && Math.abs(s3.aim - a2) < 1 * DEG && s3.shot === null && c3.shown && !c3.hits.length && /power bar/.test(c3.text), JSON.stringify([s3, (s3.aim - a2) / DEG, c3]));
    await T.shot('lesson3-' + sfx);
    /* step 3: the bar, full power: the 1 goes down */
    await pullBar(T, 1);
    await T.page.waitForTimeout(100);
    const st3 = await ev(T, () => felt.state);
    await settled(T.page);
    const fired = { st: st3, shot: await ev(T, () => felt.lastShot) };
    await T.page.waitForTimeout(300);
    const fin = await ev(T, () => ({ last: felt.lastLesson, rec: felt.lessonRec, shown: lessonDone.classList.contains('show'), title: doneTitle.textContent, btns: [donePlay.textContent, doneHome.textContent], coach: coach.hidden }));
    check(`${tag}: a full pull on the bar strokes and shoots (the only thing that did) and pots the 1: "You're ready.", Play 8-ball / Home, stored done`,
      ['stroke', 'rolling'].includes(fired.st) && !!fired.shot && fired.shot.power > 0.9 && fin.last.made && fin.shown && fin.title === 'You\'re ready.' && fin.btns.join() === 'Play 8-ball,Home' && fin.rec.done && fin.coach, JSON.stringify([fired, fin]));
    check(`${tag}: the finish sheet: targets 44 px, text 4.5:1`, (await smallTargets(T.page)).length === 0 && (await lowContrast(T.page)).length === 0, JSON.stringify([await smallTargets(T.page), await lowContrast(T.page)]));
    await T.shot('lesson-done-' + sfx);
    if (sfx === 'p') {
      await T.page.click('#donePlay');
      check('Play 8-ball opens 8-ball\'s setup', await ev(T, () => setupSheet.classList.contains('show') && setupTitle.textContent === '8-ball'));
      await T.page.click('#setupBack');
      check('done: the lesson row has left home', await ev(T, () => lessonBtn.hidden && !lessonBtn.getClientRects().length && careerBtn.getClientRects().length > 0));
      await T.page.reload(); await T.page.waitForFunction(() => window.booted === true);
      check('done persists across a reload: no row, no offer; How to play still has "Play the lesson"',
        await ev(T, () => lessonBtn.hidden && !lessonOffer.classList.contains('show') && lessonAgain.textContent.trim() === 'Play the lesson'));
      /* a miss: well off the line at step 1, a soft pull: the balls go back, "Close. Try again." */
      await T.page.click('#helpBtn');
      await T.page.click('#tabCtl');
      await T.page.click('#lessonAgain');
      await T.page.waitForTimeout(200);
      const before = await ev(T, () => JSON.stringify(felt.game.balls.map(b => [b.n, b.x, b.y])));
      await pullBar(T, 0.5);
      await T.page.waitForTimeout(100);
      await settled(T.page);
      await T.page.waitForTimeout(200);
      const miss = await ev(T, () => ({ last: felt.lastLesson, step: felt.lessonStep, st: felt.state, balls: JSON.stringify(felt.game.balls.map(b => [b.n, b.x, b.y])), coach: coachStep.textContent, done: lessonDone.classList.contains('show') }));
      const rpl = await ev(T, () => ({ offer: !!(felt.replayOffer && felt.replayOffer.shown), start: felt.replay(), on: felt.replaying }));
      check('the lesson offers no replay and none can start (the coach card stays the focus)', !rpl.offer && rpl.start === false && !rpl.on, JSON.stringify(rpl));
      check('a miss puts the balls back, keeps the step and says "Close. Try again."', miss.last && !miss.last.made && miss.step === 1 && miss.st === 'aim' && miss.balls === before && miss.coach === 'Close. Try again.' && !miss.done, JSON.stringify(miss));
      await T.page.click('#menuBtn');
      check('the pause menu in the lesson names the step', await ev(T, () => /Lesson, step 1 of 3/.test(soloKind.textContent) && /Drag anywhere/.test(soloGoal.textContent)));
      await T.page.click('#exitBtn');
      check('quit: home, the coach gone', await ev(T, () => felt.state === 'menu' && coach.hidden && coachRing.hidden && felt.lessonStep === null));
      /* bad storage reads as a first run */
      await ev(T, () => localStorage.setItem('felt.lesson.v1', '{oops'));
      await T.page.reload(); await T.page.waitForFunction(() => window.booted === true);
      check('a bad lesson record reads as a first run (the offer, the row)', await ev(T, () => lessonOffer.classList.contains('show') && !lessonBtn.hidden && !felt.lessonRec.seen));
    }
    check(`${tag}: no page errors in the lesson`, T.errors.length === 0, T.errors.join(' | '));
    await T.browser.close();
  }

  /* ---------- the career (Career, 1z): the screens, a match on the table, forfeits ---------- */
  const fitOf = T => ev(T, () => {
    const sh = cvSheet, out = [];
    for (const e of sh.querySelectorAll('*')) {
      if (!e.getClientRects().length) continue;
      const r = e.getBoundingClientRect();
      if (r.width && (r.left < -0.5 || r.right > innerWidth + 0.5)) out.push((e.id || e.className || e.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right));
    }
    const cut = [...sh.querySelectorAll('b, small, .val, dd, dt, .title, .kicker')].filter(e => e.getClientRects().length && e.scrollWidth > e.clientWidth + 1).map(e => e.textContent.slice(0, 20));
    return { wide: out.slice(0, 5), cut: cut.slice(0, 5), sw: sh.scrollWidth, cw: sh.clientWidth, scrolls: sh.scrollHeight <= sh.clientHeight || getComputedStyle(sh).overflowY === 'auto' };
  });
  const fine = f => !f.wide.length && !f.cut.length && f.sw <= f.cw + 1 && f.scrolls;
  const still = T => T.page.waitForTimeout(450);   /* the push animation settles */
  const a11y = async T => ({ small: await smallTargets(T.page), low: await lowContrast(T.page) });
  for (const vp of [{ width: 440, height: 956 }, { width: 375, height: 667 }, { width: 956, height: 440 }]) {
    const tag = `${vp.width}x${vp.height}`, sfx = vp.width === 440 ? 'p' : vp.width === 375 ? 's' : 'l', FULL = vp.width === 440;
    const T = await phone(vp);
    await T.page.waitForTimeout(250);
    await T.page.click('#careerBtn');
    await still(T);
    const s0 = await ev(T, () => ({ page: felt.careerPage, rows: [...cvBody.querySelectorAll('.topic')].map(b => b.id), loaded: Career.loaded, migrate: !!document.getElementById('cvMigrate') }));
    check(`${tag}: a first open: the careers page, New career, no carry-over offer without a ladder record`, s0.page === 'slots' && s0.rows.includes('cvNew') && !s0.loaded && !s0.migrate, JSON.stringify(s0));
    await T.page.click('#cvNew');
    await still(T);
    const a0 = await a11y(T);
    check(`${tag}: the new career form: targets 44 px, text 4.5:1, fits`, !a0.small.length && !a0.low.length && fine(await fitOf(T)), JSON.stringify(a0));
    await T.shot('career-create-' + sfx);
    await T.page.click('#cvCreate');
    check(`${tag}: no name: the form stays and says so`, await ev(T, () => felt.careerPage === 'create' && /needs a name/.test(cvBody.textContent) && !Career.loaded));
    await T.page.fill('#cvf-name', 'Sam Rivers');
    await T.page.fill('#cvf-nick', 'Slim');
    await T.page.selectOption('#cvf-nat', 'IE');
    await T.page.selectOption('#cvf-disc', '9');
    await T.page.click('#cvCreate');
    await still(T);
    const h0 = await ev(T, () => ({ page: felt.careerPage, p: Career.profile(), slots: Career.listSlots(), key: !!localStorage.getItem('felt.career.v2.' + Career.id), title: careerTitle.textContent, rows: [...cvBody.querySelectorAll('.topic')].map(b => b.id).filter(Boolean), me: !!document.getElementById('cvMe'), next: !!document.getElementById('cvNext') }));
    check(`${tag}: create: the hub of the new career (saved in a slot), the profile as entered`,
      h0.page === 'hub' && h0.p.name === 'Sam Rivers' && h0.p.nick === 'Slim' && h0.p.nat === 'IE' && h0.p.disc === '9' && h0.slots.length === 1 && h0.key && h0.title === 'Sam Rivers' && h0.me && h0.next, JSON.stringify(h0));
    check(`${tag}: the hub: every page as a row (calendar, bracket, rankings, stats, rivals, sponsors, shop, practice, news, options, switch, retire)`,
      ['cvCal', 'cvBracket', 'cvRank', 'cvStats', 'cvRivals', 'cvSpons', 'cvShop', 'cvPractice', 'cvNews', 'cvOpts', 'cvSwitch', 'cvRetire'].every(i => h0.rows.includes(i)), JSON.stringify(h0.rows));
    const a1 = await a11y(T), f1 = await fitOf(T);
    check(`${tag}: the hub: targets 44 px, text 4.5:1, nothing wider than the screen or cut off, the page scrolls`, !a1.small.length && !a1.low.length && fine(f1), JSON.stringify([a1, f1]));
    await T.shot('career-hub-' + sfx);
    /* the calendar: open events with fees, an ineligible one with its reasons */
    await T.page.click('#cvCal');
    await still(T);
    const c0 = await ev(T, () => ({ page: felt.careerPage, rows: cvBody.querySelectorAll('.topic').length, bad: [...cvBody.querySelectorAll('.val.bad')].length, fee: [...cvBody.querySelectorAll('.val')].some(v => / cr$/.test(v.textContent)) }));
    check(`${tag}: the calendar opens on Open to you: the events you can enter, with their fees, none ineligible (QA F7)`, c0.page === 'calendar' && c0.rows > 3 && c0.bad === 0 && c0.fee, JSON.stringify(c0));
    /* All: the season, the ineligible ones marked */
    await T.page.getByRole('button', { name: 'All', exact: true }).click();
    await still(T);
    const c1 = await ev(T, () => ({ rows: cvBody.querySelectorAll('.topic').length, bad: [...cvBody.querySelectorAll('.val.bad')].length }));
    check(`${tag}: the calendar's All: the season, the ineligible ones marked`, c1.rows > c0.rows && c1.bad > 0, JSON.stringify(c1));
    const a2 = await a11y(T);
    check(`${tag}: the calendar: targets 44 px, text 4.5:1, fits`, !a2.small.length && !a2.low.length && fine(await fitOf(T)), JSON.stringify(a2));
    await T.shot('career-calendar-' + sfx);
    if (!FULL) { check(`${tag}: no page errors`, T.errors.length === 0, T.errors.join(' | ')); await T.browser.close(); continue; }
    const ids = await ev(T, () => { const a = Career.availableEvents(); return { ok: a.filter(e => e.eligibility.ok && e.live && e.kind !== 'league').map(e => e.id), bad: a.find(e => !e.eligibility.ok).id }; });
    await T.page.click('#ev-' + ids.bad.replace(/\./g, '-'));
    await still(T);
    const e1 = await ev(T, () => ({ page: felt.careerPage, enter: !!document.getElementById('cvEnter'), why: /Why you cannot enter/.test(cvBody.textContent), text: cvBody.textContent }));
    check('an ineligible event: no Enter, the reasons listed (its tier)', e1.page === 'event' && !e1.enter && e1.why && /tier \d+ and (up|below)/i.test(e1.text), JSON.stringify(e1).slice(0, 300));
    await T.page.click('#careerBack');
    await still(T);
    /* enter one, enter and withdraw another: the fee back, the travel kept */
    const m0 = await ev(T, () => Career.now().money);
    await T.page.click('#ev-' + ids.ok[0].replace(/\./g, '-'));
    await still(T);
    await T.shot('career-event-' + sfx);
    await T.page.click('#cvEnter');
    const e2 = await ev(T, id => ({ m: Career.now().money, ev: Career.event(id), msg: (document.getElementById('cvMsg') || {}).textContent, saved: Career.lib.unpack(localStorage.getItem('felt.career.v2.' + Career.id)).es[id] }), ids.ok[0]);
    check('Enter: the fee and travel paid, the entry saved at once, the page says so', e2.m === m0 - e2.ev.fee - e2.ev.trav && e2.ev.entered && /^Entered/.test(e2.msg) && e2.saved && e2.saved.en === 1, JSON.stringify(e2).slice(0, 300));
    const wd = await ev(T, id => { const before = Career.now().money, ev = Career.event(id); const en = Career.enter(id); const w = Career.withdraw(id); return { en: en.ok, w: w.ok, d: before - Career.now().money, trav: ev.trav, entered: Career.event(id).entered }; }, ids.ok.find(i => i !== ids.ok[0] && true));
    check('withdraw before the deadline: the fee comes back, the travel does not', wd.en && wd.w && wd.d === wd.trav && !wd.entered, JSON.stringify(wd));
    await ev(T, () => { felt.showCareer(); });
    await still(T);
    /* time: advance to the match */
    let guard = 0;
    while (!(await ev(T, () => !!Career.nextMatch())) && guard++ < 12) await ev(T, () => felt.careerAdvance('week'));
    await still(T);
    const n0 = await ev(T, () => { const n = Career.nextMatch(); return { n, play: !!document.getElementById('cvPlay'), card: cvNext.textContent }; });
    check('advance: the next match card (opponent, rating and archetype, event, round, race, rules with the call mode, head to head) and Play',
      n0.n && n0.play && n0.card.includes(n0.n.opponent.name) && n0.card.includes(n0.n.round) && n0.card.includes(n0.n.opponent.archName) && /First to \d+/.test(n0.card) && /call/.test(n0.card) && /Head to head/.test(n0.card), JSON.stringify(n0).slice(0, 400));
    const a3 = await a11y(T);
    check('the hub with a match due: targets 44 px, text 4.5:1, fits', !a3.small.length && !a3.low.length && fine(await fitOf(T)), JSON.stringify(a3));
    await T.shot('career-hub-match-' + sfx);
    /* play it: the event's rules (locked), the opponent's level, the race */
    const set0 = await ev(T, () => JSON.stringify(felt.settings));
    await T.page.click('#cvPlay');
    await T.page.waitForTimeout(250);
    const p0 = await ev(T, () => ({ m: felt.careerMatch, kind: felt.game.kind, rules: felt.game.rules, lv: felt.cpuLevel, cpu: felt.cpu, live: JSON.parse(localStorage.getItem('felt.career.live.v1') || 'null'), nm: Career.nextMatch() }));
    check('Play: the real game on the event\'s terms: its game, its rules locked, the opponent\'s CPU level, the race; a live marker kept',
      p0.m && p0.kind === p0.nm.rules.game && p0.rules.locked && p0.lv === p0.nm.level && p0.cpu && p0.m.need === p0.nm.race && p0.live && p0.live.event === p0.nm.event && p0.live.match === p0.nm.match, JSON.stringify(p0).slice(0, 400));
    check('Play: the settings are not touched', await ev(T, () => JSON.stringify(felt.settings)) === set0);
    await T.page.click('#menuBtn');
    await T.page.waitForTimeout(200);
    const q0 = await ev(T, () => ({ cn: !careerNow.hidden, name: cnName.textContent, restart: restartBtn.hidden && !restartBtn.getClientRects().length, exit: exitBtn.textContent.trim(), locked: lockNote ? !lockNote.hidden : null }));
    check('pause in a career match: the opponent and score, no Restart, Quit reads Forfeit match', q0.cn && q0.name === p0.nm.opponent.name && q0.restart && q0.exit === 'Forfeit match', JSON.stringify(q0));
    const a4 = await a11y(T);
    check('the pause menu in a career match: targets 44 px, text 4.5:1', !a4.small.length && !a4.low.length, JSON.stringify(a4));
    await T.shot('career-pause-' + sfx);
    await T.page.click('#resumeBtn');
    /* win it by racks: between racks, then the result, reported */
    for (let i = 0; i < 30; i++) {
      const s = await ev(T, () => ({ rack: rackSheet.classList.contains('show'), match: matchSheet.classList.contains('show') }));
      if (s.match) break;
      if (s.rack) {
        if (i === 1) { const a = await a11y(T); check('between racks: targets 44 px, text 4.5:1', !a.small.length && !a.low.length, JSON.stringify(a)); await T.shot('career-rack-' + sfx); }
        await T.page.click('#rackGo'); await T.page.waitForTimeout(80); continue;
      }
      await ev(T, () => felt.forceWin(0));
      await T.page.waitForTimeout(60);
    }
    const r0 = await ev(T, () => ({ res: felt.lastCareerResult, shown: matchSheet.classList.contains('show'), over: over.classList.contains('show'), title: matchTitle.textContent, st: Career.stats().all, live: localStorage.getItem('felt.career.live.v1'), m: felt.careerMatch }));
    check('the match won: the result sheet (not game over), reported to the career (1 match, 1 won), the live marker gone',
      r0.shown && !r0.over && r0.res.won && /^You beat/.test(r0.title) && r0.st.matches === 1 && r0.st.won === 1 && r0.live === null && r0.m.done, JSON.stringify(r0).slice(0, 400));
    const a5 = await a11y(T);
    check('the match result: targets 44 px, text 4.5:1', !a5.small.length && !a5.low.length, JSON.stringify(a5));
    await T.shot('career-result-' + sfx);
    await T.page.click('#matchLadder');
    await still(T);
    check('Career from the result: back to the hub', await ev(T, () => felt.careerPage === 'hub' && felt.careerMatch === null));
    await ev(T, id => felt.careerGo('bracket', { id }), r0.res.event);
    await still(T);
    const b0 = await ev(T, () => ({ page: felt.careerPage, me: cvBody.querySelectorAll('.bm .me').length, bm: cvBody.querySelectorAll('.bm').length }));
    check('the bracket: the draw, your matches marked', b0.page === 'bracket' && b0.me >= 1 && b0.bm > 2, JSON.stringify(b0));
    const a6 = await a11y(T);
    check('the bracket: targets 44 px, text 4.5:1, fits', !a6.small.length && !a6.low.length && fine(await fitOf(T)), JSON.stringify(a6));
    await T.shot('career-bracket-' + sfx);
    /* every other page renders, fits and reads */
    const bad = [];
    for (const p of ['rankings', 'stats', 'records', 'sponsors', 'shop', 'rivals', 'news', 'practice', 'options', 'slots']) {
      await ev(T, p => { felt.showCareer(); felt.careerGo(p); }, p);
      await still(T);
      const a = await a11y(T), f = await fitOf(T), pg = await ev(T, () => felt.careerPage);
      if (pg !== p || a.small.length || a.low.length || !fine(f)) bad.push({ p, pg, a, f });
    }
    check('rankings, stats, records, sponsors, shop, rivals, news, practice, options, slots: each renders, targets 44 px, text 4.5:1, fits', !bad.length, JSON.stringify(bad).slice(0, 600));
    /* practice: Play launches the drill on the table; its measured score reaches Career.practice */
    await ev(T, () => { felt.showCareer(); felt.careerGo('practice'); felt.drillBeat = 0; });
    await T.page.click('#drill-long-pot');
    for (const h of DRILL_SOLS['7r']['long-pot'].shots) {
      await T.page.waitForFunction(() => felt.state === 'aim' && felt.drillNow, null, { timeout: 20000 });
      await ev(T, h => felt.shoot(h[0], h[1], { x: h[2], y: h[3] }), h);
      await T.page.waitForFunction(() => felt.state !== 'rolling', null, { timeout: 30000 });
    }
    await T.page.waitForFunction(() => drillRes.classList.contains('show'), null, { timeout: 20000 });
    const pr = await ev(T, () => ({ m: Career.stats().mastery['long-pot'], d: felt.lastDrill, msg: drillCareer.textContent }));
    check('practice: Play runs the drill on the table, its measured score is recorded (the result says so)', pr.m && pr.m.n === 1 && pr.m.best === pr.d.total && pr.d.career.ok && /Recorded/.test(pr.msg), JSON.stringify(pr));
    await T.page.click('#drillToCareer');
    check('practice: Career from the result goes back to the practice page', await ev(T, () => felt.careerPage === 'practice' && felt.drillNow === null));
    /* reload: the career persists */
    await T.page.reload(); await T.page.waitForFunction(() => window.booted === true);
    await ev(T, () => felt.showCareer());
    const rl = await ev(T, () => ({ page: felt.careerPage, st: Career.stats().all, name: Career.profile().name, sum: careerSum.textContent }));
    check('reload: the career comes back (the hub, 1 match won, the drill)', rl.page === 'hub' && rl.st.won === 1 && rl.name === 'Sam Rivers' && /^Tier \d/.test(rl.sum), JSON.stringify(rl));
    /* a forfeit by quitting mid-match (audit F5) */
    const lost0 = rl.st.lost;
    await ev(T, () => { if (!Career.nextMatch() && !Career.schedule().length) { const e = Career.availableEvents().find(x => x.eligibility.ok && x.live); if (e) Career.enter(e.id); } });
    guard = 0;
    while (!(await ev(T, () => !!Career.nextMatch())) && guard++ < 20) await ev(T, () => felt.careerAdvance('week'));
    const f0 = await ev(T, () => { const n = Career.nextMatch(); return n && { ok: felt.careerPlay(), opp: n.opponent.id }; });
    if (f0 && f0.ok) {
      await T.page.waitForTimeout(150);
      await T.page.click('#menuBtn');
      await T.page.click('#exitBtn');   /* the first tap arms it (QA F6), the second forfeits */
      check('Forfeit match: the first tap only asks again', await ev(T, () => !!felt.careerMatch && exitBtn.textContent.trim() === 'Tap again to forfeit'));
      await T.page.click('#exitBtn');
      await T.page.waitForTimeout(150);
      const f1x = await ev(T, opp => ({ st: Career.stats().all, h2h: Career.headToHead(opp), live: localStorage.getItem('felt.career.live.v1'), m: felt.careerMatch, state: felt.state }), f0.opp);
      check('Forfeit match from the pause menu: counted as a loss (the record and the head to head), the marker gone', f1x.st.lost === lost0 + 1 && f1x.h2h && f1x.h2h.lost >= 1 && f1x.live === null && f1x.m === null && f1x.state === 'menu', JSON.stringify(f1x));
      await ev(T, () => felt.showCareer());
      check('the hub says the match was forfeited', await ev(T, () => /Forfeit/.test((document.getElementById('cvMsg') || {}).textContent || '')));
    } else check('a second match to forfeit', false, JSON.stringify(f0));
    /* a forfeit by closing the page mid-match (entered in a new event if out of the last) */
    await ev(T, () => { if (!Career.nextMatch() && !Career.schedule().length) { const e = Career.availableEvents().find(x => x.eligibility.ok && x.live); if (e) Career.enter(e.id); } });
    guard = 0;
    while (!(await ev(T, () => !!Career.nextMatch())) && guard++ < 20) await ev(T, () => felt.careerAdvance('week'));
    const g0 = await ev(T, () => ({ ok: felt.careerPlay(), lost: Career.stats().all.lost }));
    if (g0.ok) {
      await ev(T, () => felt.forceWin(1));   /* a rack down, then the page goes */
      await T.page.waitForTimeout(100);
      await T.page.reload(); await T.page.waitForFunction(() => window.booted === true);
      const g1 = await ev(T, () => ({ lost: Career.loaded ? Career.stats().all.lost : null, live: localStorage.getItem('felt.career.live.v1') }));
      check('a match left by closing the page: forfeited at the next boot, counted once', g1.lost === g0.lost + 1 && g1.live === null, JSON.stringify([g0, g1]));
      await T.page.reload(); await T.page.waitForFunction(() => window.booted === true);
      check('...and not again on the boot after', await ev(T, n => { felt.showCareer(); return Career.stats().all.lost === n; }, g0.lost + 1));
    } else check('a third match to forfeit by closing the page', false, JSON.stringify(g0));
    /* the stats sheet's career section reads the career */
    await ev(T, () => felt.quitToHome());
    await T.page.click('#statsBtn');
    const sk = await ev(T, () => [...careerKpis.querySelectorAll('div')].map(d => d.textContent));
    check('stats: the career section shows the tier and matches won', /^Tier\d/.test(sk[0]) && /^Matches won1of 3/.test(sk[1]) && sk.length === 4, JSON.stringify(sk));
    await T.page.click('#statsBack');
    /* the ordinary game is untouched after a career match */
    await ev(T, () => { settings.cpu = false; felt.showSetup('8'); });
    await T.page.click('#breakBtn');
    check('after a career match, an ordinary game plays on the settings (two players, no career)', await ev(T, () => !felt.cpu && felt.careerMatch === null && felt.state === 'aim' && !felt.game.rules.locked));
    await ev(T, () => felt.quitToHome());
    /* a CPU game left mid-rack counts as a loss (audit F5); before the player shoots it does not */
    const q1 = await ev(T, async () => {
      const idle = () => new Promise(r => { const w = () => ['stroke', 'rolling', 'thinking'].includes(felt.state) ? setTimeout(w, 10) : r(); w(); });
      settings.cpu = true; settings.level = 'easy';
      const l0 = felt.record.kinds['8'].cpu.easy.l, p0 = felt.record.kinds['8'].played;
      felt.start('8'); felt.quitToHome();
      const l1 = felt.record.kinds['8'].cpu.easy.l;
      felt.speed = 40; felt.start('8'); await idle();
      while (felt.game.turn !== 0 && felt.game.winner === null) { await new Promise(r => setTimeout(r, 30)); await idle(); }
      felt.shoot(0.3, 0.6, 0); await idle();
      felt.pause(); felt.quitToHome();
      felt.speed = 1;
      return { l0, l1, l2: felt.record.kinds['8'].cpu.easy.l, p2: felt.record.kinds['8'].played - p0, streak: felt.record.streak, mark: localStorage.getItem('felt.abandon.v1') };
    });
    check('a CPU game quit before the player\'s first shot: nothing counted; quit after it: a loss, the streak reset', q1.l1 === q1.l0 && q1.l2 === q1.l0 + 1 && q1.p2 === 1 && q1.streak === 0 && q1.mark === null, JSON.stringify(q1));
    const q2 = await ev(T, async () => {
      const idle = () => new Promise(r => { const w = () => ['stroke', 'rolling', 'thinking'].includes(felt.state) ? setTimeout(w, 10) : r(); w(); });
      felt.speed = 40; felt.start('9'); await idle();
      while (felt.game.turn !== 0 && felt.game.winner === null) { await new Promise(r => setTimeout(r, 30)); await idle(); }
      felt.shoot(0.3, 0.6, 0); await idle(); felt.speed = 1;
      return { l: felt.record.kinds['9'].cpu.easy.l, mark: JSON.parse(localStorage.getItem('felt.abandon.v1') || 'null'), over: felt.game.winner !== null };
    });
    await T.page.reload(); await T.page.waitForFunction(() => window.booted === true);
    const q3 = await ev(T, () => ({ l: felt.record.kinds['9'].cpu.easy.l, mark: localStorage.getItem('felt.abandon.v1') }));
    check('a CPU game left by closing the page: a loss at the next boot', q2.over || (q2.mark && q2.mark.kind === '9' && q3.l === q2.l + 1 && q3.mark === null), JSON.stringify([q2, q3]));
    /* switch career: delete with a confirmation */
    await ev(T, () => { felt.showCareer(); felt.careerGo('slots'); });
    await still(T);
    const id0 = await ev(T, () => Career.id);
    await T.page.click(`[aria-label="Delete Sam Rivers"]`);
    await still(T);
    check('Delete asks first', await ev(T, () => felt.careerPage === 'confirm' && !!document.getElementById('cvYes')));
    await T.page.click('#cvNo');
    check('Cancel keeps it', await ev(T, () => felt.careerPage === 'slots' && Career.listSlots().length === 1));
    await T.page.click(`[aria-label="Delete Sam Rivers"]`);
    await T.page.click('#cvYes');
    check('Delete career removes the slot and its keys', await ev(T, id => felt.careerPage === 'slots' && Career.listSlots().length === 0 && localStorage.getItem('felt.career.v2.' + id) === null && !Career.loaded, id0));
    check(`${tag}: no page errors in the career`, T.errors.length === 0, T.errors.join(' | '));
    await T.browser.close();
  }
  /* the old ladder record: carried over by Career.migrate, never changed; damaged saves shown as such */
  {
    const raw = '{"v":1,"best":{"pip":[1,0],"benny":[1,0],"rosa":[2,1],"gus":[2,0],"mei":[2,1]},"won":5,"played":7,"racksW":9,"racksL":4}';
    const T = await phone({ width: 375, height: 667 }, { init: `try { if (!localStorage.getItem('felt.career.v1')) localStorage.setItem('felt.career.v1', ${JSON.stringify(raw)}); } catch (e) { }` });
    const l0 = await ev(T, () => ({ at: felt.careerAt, rec: felt.careerRec }));
    check('the ladder record still reads (5 of 8 beaten, 5 of 7 won)', l0.at === 5 && l0.rec.won === 5 && l0.rec.played === 7, JSON.stringify(l0));
    await T.page.click('#careerBtn');
    await still(T);
    const m0 = await ev(T, () => ({ page: felt.careerPage, offer: document.getElementById('cvMigrate') && document.getElementById('cvMigrate').textContent }));
    check('a ladder record and no career: the offer to carry it over', m0.page === 'slots' && /5 of 8 players beaten, 5 of 7 matches won/.test(m0.offer || ''), JSON.stringify(m0));
    await T.page.click('#cvMigrate');
    await still(T);
    await T.page.fill('#cvf-name', 'Old Hand');
    await T.page.click('#cvCreate');
    await still(T);
    const m1 = await ev(T, () => ({ page: felt.careerPage, tier: Career.now().tier, legacy: Career.stats().legacy, v1: localStorage.getItem('felt.career.v1'), bak: localStorage.getItem('felt.career.v1.bak') }));
    check('carry over: a new career at tier 2 with the ladder as its legacy; felt.career.v1 untouched (and backed up)', m1.page === 'hub' && m1.tier === 2 && m1.legacy && m1.legacy.beaten.length === 5 && m1.v1 === raw && m1.bak === raw, JSON.stringify(m1));
    await ev(T, () => { felt.careerGo('slots'); });
    check('carried over once: no second offer', await ev(T, () => !document.getElementById('cvMigrate')));
    /* a damaged save: from the backup if it can, else marked and not loadable */
    const d0 = await ev(T, () => {
      const id = Career.id;
      Career.save(); Career.save();
      Career.close();
      localStorage.setItem('felt.career.v2.' + id, 'F2|damaged');
      felt.showCareer();
      const rec = (document.getElementById('cvMsg') || {}).textContent;
      Career.close();
      localStorage.setItem('felt.career.v2.' + id, 'x'); localStorage.setItem('felt.career.v2.' + id + '.bak', 'y'); localStorage.removeItem('felt.career.v2.' + id + '.tmp');
      felt.showCareer();
      return { rec, page: felt.careerPage, slot: (document.getElementById('slot-' + id) || {}).textContent, load: [...document.querySelectorAll('#slot-' + id + ' .cvMini')].map(b => [b.textContent, b.disabled]) };
    });
    check('a damaged save opens from its backup and says so; one beyond its backup is marked damaged and cannot be loaded', /restored from its backup/.test(d0.rec || '') && d0.page === 'slots' && /Damaged: cannot be loaded/.test(d0.slot || '') && d0.load[0][1] === true && d0.load[1][1] === false, JSON.stringify(d0));
    for (const bad of ['{nope', '{"v":1,"best":{"rosa":[2,0],"baron":[9,9]},"won":-4,"played":"x"}', '{"v":2,"best":{"pip":[1,0]}}']) {
      await ev(T, b => localStorage.setItem('felt.career.v1', b), bad);
      await T.page.reload(); await T.page.waitForFunction(() => window.booted === true);
      const f = await ev(T, () => ({ at: felt.careerAt, rec: felt.careerRec }));
      check(`a bad ladder record (${bad.slice(0, 24)}) reads as nothing beaten`, f.at === 0 && f.rec.won === 0 && f.rec.played === 0, JSON.stringify(f));
    }
    check('the rules a career event passes map onto the rules engine (8 bar: the 8 called; 14.1: its race; custom: strict)', await ev(T, () => {
      const a = felt.careerRules({ game: '8', ruleset: '8-bar', call: { require: '8ball', detail: 'pocket' } }), b = felt.careerRules({ game: 'straight', ruleset: '14.1-wpa', call: { require: 'all', detail: 'rails' }, race: 75 }), c = felt.careerRules({ game: '9', ruleset: '9-wpa', call: { require: 'all', detail: 'strict' } });
      return a.ruleset === '8-house' && a.call.mode === 'off' && a.call.eight && b.ruleset === 'straight-wpa' && b.race === 75 && b.call.mode === 'all' && c.call.detail === 'strict' && Career.DISCS.every(d => Career.GAMES[d].live);
    }));
    check('no page errors (ladder, carry over, damaged saves)', T.errors.length === 0, T.errors.join(' | '));
    await T.browser.close();
  }

  /* ---------- home with the Career row and the lesson row: fits, 44 px, contrast ---------- */
  const H = await phone({ width: 440, height: 956 });
  const fits = [];
  for (const [w, h, ins] of [[440, 956, [62, 0, 34, 0]], [956, 440, [0, 62, 21, 62]], [440, 956, [0, 0, 0, 0]], [956, 440, [0, 0, 0, 0]], [390, 844, [0, 0, 0, 0]]]) {
    await H.page.setViewportSize({ width: w, height: h });
    fits.push(await ev(H, async ([ins, w, h]) => {
      let st = document.getElementById('insets');
      if (!st) { st = document.createElement('style'); st.id = 'insets'; document.head.appendChild(st); }
      st.textContent = `html:root { --sat: ${ins[0]}px; --sar: ${ins[1]}px; --sab: ${ins[2]}px; --sal: ${ins[3]}px; }`;
      settings.last = '8'; relayout(); showMenu();
      await new Promise(r => setTimeout(r, 300));
      const rows = [careerBtn, lessonBtn, pracBtn, trickBtn, dailyBtn].map(b => b.getBoundingClientRect()), top = menu.scrollTop;
      menu.scrollTop = 1e6;
      const end = Math.round(dailyBtn.getBoundingClientRect().bottom);
      menu.scrollTop = top;
      return { size: `${w}x${h}`, sh: menu.scrollHeight, ch: menu.clientHeight, rows: rows.map(r => Math.round(r.height)), bottom: end, lim: h - ins[2], sw: document.documentElement.scrollWidth - innerWidth };
    }, [ins, w, h]));
    if (w === 956 && ins[1]) await H.shot('home-career-l');
    if (w === 440 && ins[0]) await H.shot('home-career-p');
  }
  check('home with Career and the lesson rows (440x956, 956x440 with and without insets, 390x844): rows 44 px+, the last row reached by scrolling inside the safe area, no sideways scroll',
    fits.every(f => f.rows.every(r => r >= 44) && f.bottom <= f.lim + 0.5 && f.sw <= 0), JSON.stringify(fits));
  check('home: targets 44 px, text 4.5:1', (await smallTargets(H.page)).length === 0 && (await lowContrast(H.page)).length === 0, JSON.stringify([await smallTargets(H.page), await lowContrast(H.page)]));
  await H.browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
