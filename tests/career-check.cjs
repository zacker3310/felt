/* career-check: the first-run lesson and the career ladder (section 6c), on a phone either way
   up (440x956 and 956x440, dpr 3, real touch events with their own timestamps).
   Lesson: a first run offers it once; Skip marks it seen; each step advances on its own action
   (a tap on the ball aims it, the wheel nudges it, a pull on the bar pots it), with a coach card
   kept off the cue ball and the controls; a miss puts the balls back; the finish sheet; the home
   row goes once it is done; nothing but the bar shoots. Career: the ladder with locks; a race
   with the score between racks and in the pause menu; a win unlocks the next player and
   persists; a loss does not; bad storage reads as a fresh ladder; home still fits.
   FELT_SHOTS=<dir> also saves screenshots of each screen there. */
'use strict';
const path = require('path');
const { check, done, open, smallTargets, lowContrast, settled } = require('./lib.cjs');
const SHOTS = process.env.FELT_SHOTS || '';
const DEG = Math.PI / 180;

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
      await T.page.click('#lessonAgain');
      await T.page.waitForTimeout(200);
      const before = await ev(T, () => JSON.stringify(felt.game.balls.map(b => [b.n, b.x, b.y])));
      await pullBar(T, 0.5);
      await T.page.waitForTimeout(100);
      await settled(T.page);
      await T.page.waitForTimeout(200);
      const miss = await ev(T, () => ({ last: felt.lastLesson, step: felt.lessonStep, st: felt.state, balls: JSON.stringify(felt.game.balls.map(b => [b.n, b.x, b.y])), coach: coachStep.textContent, done: lessonDone.classList.contains('show') }));
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

  /* ---------- the career ---------- */
  for (const vp of [{ width: 440, height: 956 }, { width: 956, height: 440 }]) {
    const tag = `${vp.width}x${vp.height}`, sfx = vp.width < vp.height ? 'p' : 'l', P = sfx === 'p';
    const T = await phone(vp);
    await T.page.waitForTimeout(250);
    await T.shot('home-' + sfx);
    const ros = await ev(T, () => felt.careerRoster());
    check(`${tag}: eight players in three tiers (2 easy, 3 medium, 3 hard), races longer up the ladder, the last a boss, generous pockets only for the first`,
      ros.length === 8 && ros.filter(c => c.level === 'easy').length === 2 && ros.filter(c => c.level === 'medium').length === 3 && ros.filter(c => c.level === 'hard').length === 3
      && ros.every((c, i) => !i || c.race >= ros[i - 1].race) && ros[7].boss && ros[7].race === 3 && ros.filter(c => c.pockets === 'generous').map(c => c.id).join() === ros[0].id, JSON.stringify(ros));
    await T.page.click('#careerBtn');
    await T.page.waitForTimeout(300);
    const lad = await ev(T, () => [...document.querySelectorAll('.rung')].map(b => ({ id: b.dataset.id, st: b.dataset.state, dis: b.disabled, av: b.querySelector('.av').textContent, play: !!b.querySelector('.play') })));
    check(`${tag}: the ladder: 8 rungs with avatars, the first to play, the other seven locked and disabled`,
      lad.length === 8 && lad[0].st === 'current' && lad[0].play && !lad[0].dis && lad.slice(1).every(r => r.st === 'locked' && r.dis) && lad.every(r => r.av.length >= 1), JSON.stringify(lad));
    check(`${tag}: the career sheet: targets 44 px, text 4.5:1`, (await smallTargets(T.page)).length === 0 && (await lowContrast(T.page)).length === 0, JSON.stringify([await smallTargets(T.page), await lowContrast(T.page)]));
    await T.shot('career-' + sfx);
    if (!P) {
      check(`${tag}: a locked player cannot be started`, await ev(T, () => felt.career('baron') === false && felt.careerMatch === null));
      await T.page.click('.rung[data-state="current"]');
      await T.page.waitForTimeout(200);
      await ev(T, () => felt.forceWin(0));
      await T.page.waitForTimeout(200);
      await ev(T, () => felt.career('benny'));
      await ev(T, () => felt.forceWin(0));
      await T.page.click('#matchLadder');
      await T.page.waitForTimeout(300);
      await T.shot('career-progress-' + sfx);
      await ev(T, () => felt.career('rosa'));
      await ev(T, () => felt.forceWin(0));
      await T.page.waitForTimeout(250);
      check(`${tag}: between racks: targets 44 px, text 4.5:1`, (await smallTargets(T.page)).length === 0 && (await lowContrast(T.page)).length === 0, JSON.stringify([await smallTargets(T.page), await lowContrast(T.page)]));
      await T.shot('between-racks-' + sfx);
      await T.page.click('#rackGo');
      await T.page.waitForTimeout(200);
      await T.page.click('#menuBtn');
      await T.page.waitForTimeout(250);
      check(`${tag}: the pause menu in a career match: targets 44 px, text 4.5:1`, (await smallTargets(T.page)).length === 0 && (await lowContrast(T.page)).length === 0, JSON.stringify([await smallTargets(T.page), await lowContrast(T.page)]));
      await T.shot('pause-career-' + sfx);
      await T.page.click('#resumeBtn');
      await ev(T, () => felt.forceWin(0));
      await T.page.waitForTimeout(250);
      await T.shot('match-won-' + sfx);
      check(`${tag}: no page errors in the career`, T.errors.length === 0, T.errors.join(' | '));
      await T.browser.close();
      continue;
    }
    /* Pip: one rack. Play, pause (the name, the line, the score), win */
    await T.page.click('#rung-pip');
    await T.page.waitForTimeout(250);
    const m1 = await ev(T, () => ({ m: felt.careerMatch, st: felt.state, cpu: felt.cpu, lv: felt.cpuLevel, kind: felt.game.kind, pk: felt.pockets, table: felt.table }));
    check('Pip: an 8-ball race to 1 against the easy CPU on the 7 ft table with generous pockets, your break',
      m1.m && m1.m.id === 'pip' && m1.m.need === 1 && m1.st === 'aim' && m1.cpu && m1.lv === 'easy' && m1.kind === '8' && m1.pk === 'generous' && m1.table === '7', JSON.stringify(m1));
    await T.page.click('#menuBtn');
    const p1 = await ev(T, () => ({ shown: !careerNow.hidden && careerNow.getClientRects().length > 0, name: cnName.textContent, line: cnLine.textContent, score: cnScore.textContent, race: cnRace.textContent, kick: soloKind.textContent, card: p1name.textContent }));
    check('pause in a career match: the player\'s name and line, the score, the race', p1.shown && p1.name === 'Pip Larkin' && p1.line === 'Just happy to be here' && p1.score === '0-0' && p1.race === 'Race to 1, rack 1' && /vs Pip Larkin/.test(p1.kick) && p1.card === 'Pip Larkin (CPU)', JSON.stringify(p1));
    await T.page.click('#resumeBtn');
    await ev(T, () => felt.forceWin(0));
    await T.page.waitForTimeout(200);
    const w1 = await ev(T, () => ({ shown: matchSheet.classList.contains('show'), over: over.classList.contains('show'), title: matchTitle.textContent, sub: matchSub.textContent, go: matchGo.textContent, at: felt.careerAt, rec: felt.careerRec, ls: JSON.parse(localStorage.getItem('felt.career.v1')) }));
    check('beating Pip: the match sheet (not game over), "You beat Pip", Next match; Benny unlocked and stored',
      w1.shown && !w1.over && w1.title === 'You beat Pip' && /Benny Okafor/.test(w1.sub) && w1.go === 'Next match' && w1.at === 1 && w1.rec.won === 1 && w1.ls.best.pip.join() === '1,0', JSON.stringify(w1));
    await T.page.reload(); await T.page.waitForFunction(() => window.booted === true);
    await T.page.waitForTimeout(200);
    const r1 = await ev(T, () => ({ at: felt.careerAt, sum: careerSum.textContent, hint: careerHint.textContent }));
    check('the unlock persists across a reload: 1 of 8, next Benny', r1.at === 1 && r1.sum === '1 of 8' && r1.hint === 'Next: Benny Okafor', JSON.stringify(r1));
    await T.page.click('#careerBtn');
    const lad2 = await ev(T, () => [...document.querySelectorAll('.rung')].slice(0, 3).map(b => [b.dataset.state, b.querySelector('.st').textContent]));
    check('the ladder after: Pip beaten with a tick and 1-0, Benny to play, Rosa locked', lad2[0].join() === 'beaten,1-0' && lad2[1][0] === 'current' && lad2[2][0] === 'locked', JSON.stringify(lad2));
    /* Benny (one rack, by the Next match path), then Rosa: a race to 2 */
    await T.page.click('#rung-benny');
    await ev(T, () => felt.forceWin(0));
    await T.page.waitForTimeout(150);
    await T.page.click('#matchGo');
    await T.page.waitForTimeout(250);
    const m3 = await ev(T, () => ({ m: felt.careerMatch, lv: felt.cpuLevel, turn: felt.game.turn }));
    check('Next match: Rosa, a race to 2 against the medium CPU, your break', m3.m.id === 'rosa' && m3.m.need === 2 && m3.lv === 'medium' && m3.turn === 0, JSON.stringify(m3));
    await ev(T, () => felt.forceWin(0));
    await T.page.waitForTimeout(200);
    const i1 = await ev(T, () => ({ shown: rackSheet.classList.contains('show'), over: over.classList.contains('show'), title: rackTitle.textContent, sub: rackSub.textContent, board: rackBoard.getAttribute('aria-label'), at: felt.careerAt }));
    check('between racks: "Rack 2. You lead 1-0.", the score board, nothing unlocked yet', i1.shown && !i1.over && i1.title === 'Rack 2' && /^You lead 1-0\. Rosa breaks\.$/.test(i1.sub) && /You 1, Rosa 0, race to 2/.test(i1.board) && i1.at === 2, JSON.stringify(i1));
    check('between racks: targets 44 px, text 4.5:1', (await smallTargets(T.page)).length === 0 && (await lowContrast(T.page)).length === 0, JSON.stringify([await smallTargets(T.page), await lowContrast(T.page)]));
    await T.shot('between-racks-' + sfx);
    await T.page.click('#rackGo');
    await T.page.waitForTimeout(200);
    const k2 = await ev(T, () => ({ turn: felt.game.turn, st: felt.state, m: felt.careerMatch }));
    check('rack 2: the break alternates (Rosa breaks: the CPU is thinking)', k2.turn === 1 && ['thinking', 'stroke', 'rolling'].includes(k2.st) && k2.m.rack === 2 && k2.m.score.join() === '1,0', JSON.stringify(k2));
    await T.page.click('#menuBtn');
    const p2 = await ev(T, () => ({ score: cnScore.textContent, race: cnRace.textContent, name: cnName.textContent }));
    check('pause in rack 2: 1-0, race to 2, rack 2', p2.score === '1-0' && p2.race === 'Race to 2, rack 2' && p2.name === 'Rosa Vance', JSON.stringify(p2));
    check('the pause menu in a career match: targets 44 px, text 4.5:1', (await smallTargets(T.page)).length === 0 && (await lowContrast(T.page)).length === 0, JSON.stringify([await smallTargets(T.page), await lowContrast(T.page)]));
    await T.shot('pause-career-' + sfx);
    await T.page.click('#resumeBtn');
    /* lose the next two: the match is lost and nothing more unlocks */
    await ev(T, () => felt.forceWin(1));
    await T.page.waitForTimeout(150);
    const i2 = await ev(T, () => rackSub.textContent);
    check('1-1: "All square at 1-1."', /^All square at 1-1\./.test(i2), i2);
    await T.page.click('#rackGo');
    await ev(T, () => felt.forceWin(1));
    await T.page.waitForTimeout(200);
    const l3 = await ev(T, () => ({ shown: matchSheet.classList.contains('show'), title: matchTitle.textContent, go: matchGo.textContent, at: felt.careerAt, rec: felt.careerRec }));
    check('losing the race 1-2: "Rosa takes it", Rematch; Gus stays locked, the loss counted', l3.shown && l3.title === 'Rosa takes it' && l3.go === 'Rematch' && l3.at === 2 && !l3.rec.best.rosa && l3.rec.played === 3 && l3.rec.won === 2, JSON.stringify(l3));
    await T.shot('match-lost-' + sfx);
    check('a locked player cannot be started', await ev(T, () => felt.career('gus') === false));
    await T.page.click('#matchHome');
    check('Home from the match: the career match is over', await ev(T, () => felt.state === 'menu' && felt.careerMatch === null && menu.classList.contains('show')));
    /* stats: the career section */
    await T.page.click('#statsBtn');
    const sk = await ev(T, () => [...careerKpis.querySelectorAll('div')].map(d => d.textContent));
    check('stats: a career section, progress 2 of 8, matches won 2 of 3', sk[0] === 'Progress2of 8' && sk[1] === 'Matches won2of 3' && sk.length === 4, JSON.stringify(sk));
    await T.page.click('#statsBack');
    /* the ordinary game is untouched: Play again and the setup still use the settings */
    await ev(T, () => { settings.cpu = false; felt.showSetup('8'); });
    await T.page.click('#breakBtn');
    check('after a career match, an ordinary game plays on the settings (two players, no career)', await ev(T, () => !felt.cpu && felt.careerMatch === null && felt.state === 'aim'));
    await ev(T, () => felt.quitToHome());
    /* bad storage: a fresh ladder */
    for (const bad of ['{nope', '{"v":1,"best":{"rosa":[2,0],"baron":[9,9]},"won":-4,"played":"x"}', '{"v":2,"best":{"pip":[1,0]}}']) {
      await ev(T, b => localStorage.setItem('felt.career.v1', b), bad);
      await T.page.reload(); await T.page.waitForFunction(() => window.booted === true);
      const f = await ev(T, () => ({ at: felt.careerAt, rec: felt.careerRec, sum: careerSum.textContent }));
      check(`a bad career record (${bad.slice(0, 24)}) reads as a fresh ladder`, f.at === 0 && f.rec.won === 0 && f.rec.played === 0 && f.sum === '0 of 8', JSON.stringify(f));
    }
    check(`${tag}: no page errors in the career`, T.errors.length === 0, T.errors.join(' | '));
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
      const rows = [careerBtn, lessonBtn, pracBtn, trickBtn, dailyBtn].map(b => b.getBoundingClientRect());
      return { size: `${w}x${h}`, sh: menu.scrollHeight, ch: menu.clientHeight, rows: rows.map(r => Math.round(r.height)), bottom: Math.round(rows[4].bottom), lim: h - ins[2] };
    }, [ins, w, h]));
    if (w === 956 && ins[1]) await H.shot('home-career-l');
    if (w === 440 && ins[0]) await H.shot('home-career-p');
  }
  check('home with Career and the lesson rows fits without scrolling (440x956, 956x440 with and without insets, 390x844), rows 44 px+',
    fits.every(f => f.sh <= f.ch && f.rows.every(r => r >= 44) && f.bottom <= f.lim + 0.5), JSON.stringify(fits));
  check('home: targets 44 px, text 4.5:1', (await smallTargets(H.page)).length === 0 && (await lowContrast(H.page)).length === 0, JSON.stringify([await smallTargets(H.page), await lowContrast(H.page)]));
  await H.browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
