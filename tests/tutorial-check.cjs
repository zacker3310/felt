/* tutorial-check: the play-through tutorials (sim 1l, page 6d), one per game.
   Node: five tutorials of three to five steps; the page's TUT_SOLS equal
   tests/tutorial-solutions.json (tools/tutorial-solver.cjs); every stored solution passes its
   step's goal through simulateShot and the real judge (8-ball's for stripes too), from its
   placement when the step has ball in hand; a dead-soft shot fails every step; the layouts are
   legal; the words are short and have no em dashes.
   Page, on a phone (440x956, dpr 3, real touch events): each game's tutorial opened from its setup
   sheet's link, one step per game played with real input (the power bar pulled by touch; the
   8-ball and snooker in-hand drags, bumper pool's tap on the ball to strike) and the live roll equal
   to simulateShot, the rest through the coach's Show me (and Next after a result shown), then the
   finish card; done is saved and the setup link goes. A miss puts the step back ("Close. Try
   again."); nothing but the bar and Show me shoots; the coach card keeps off the controls and the
   cue ball; the pause menu names the step. A snooker tutorial from How to play puts the 8-ball
   table and every per-table value back exactly. The offer on a first Break: Show me, Skip (that
   game no more), Don't ask again (no game); bad storage reads fresh; the stats line; How to play's
   buttons, and it still fits at 375x667. Then 956x440: each game's first step with the coach
   card. 44 px targets and 4.5:1 text on the new screens; reduced motion stills the coach.
   FELT_SHOTS=<dir> saves screenshots of each screen there. */
'use strict';
const fs = require('fs');
const path = require('path');
const { check, done, open, smallTargets, lowContrast, settled } = require('./lib.cjs');
const { loadSim, regionSource } = require('./sim.cjs');
const SHOTS = process.env.FELT_SHOTS || '';
const IDS = ['8', '9', 'bumper', 'carom', 'snooker'];
const TILE = { 8: '#play8', 9: '#play9', bumper: '#playB', carom: '#playC', snooker: '#playS' };
const GO = { 8: '#tutGo8', 9: '#tutGo9', bumper: '#tutGoB', carom: '#tutGoC', snooker: '#tutGoS' };
const WORD = { 8: '8-ball', 9: '9-ball', bumper: 'bumper pool', carom: 'three-cushion', snooker: 'snooker' };

/* ---------- Node: the tutorials, their solutions and goals ---------- */
function nodeChecks() {
  const S = loadSim();
  const file = JSON.parse(fs.readFileSync(path.join(__dirname, 'tutorial-solutions.json'), 'utf8'));
  check('five tutorials, one per game, three to five steps each', S.TUTORIALS.map(t => t.id).join() === IDS.join() && S.TUTORIALS.every(t => t.steps.length >= 3 && t.steps.length <= 5),
    JSON.stringify(S.TUTORIALS.map(t => [t.id, t.steps.length])));
  check('the page\'s TUT_SOLS equal tests/tutorial-solutions.json (tools/tutorial-solver.cjs), a solution for every step',
    JSON.stringify(S.TUT_SOLS) === JSON.stringify(file) && S.TUTORIALS.every(t => t.steps.every((_, i) => !!S.tutSol(t.id, i))));
  const bad = [], soft = [], words = [], layout = [], extra = {};
  for (const t of S.TUTORIALS) {
    S.setTable(...t.table); S.setPockets(t.pockets);
    for (const group of t.id === '8' ? ['solids', 'stripes'] : [null]) {
      t.steps.forEach((st, i) => {
        const c = group ? { group } : {};
        let g = S.tutGame(t, i, c);
        const sol = S.tutSol(t.id, i);
        if (g.inHand && !(sol.place && S.canPlace(g, sol.place[0], sol.place[1]))) bad.push(`${t.id}/${i}: no legal placement`);
        if (sol.place) g = S.placeCue(g, sol.place[0], sol.place[1]);
        const ball = sol.ball !== undefined ? sol.ball : t.kind === 'carom' ? g.striker : 0;
        const r = S.simulateShot(g.balls, { angle: sol.angle, power: sol.power, spin: sol.spin, ball }), j = S.tutJudge(t, i, g, r);
        if (!j.ok) bad.push(`${t.id}/${group || ''}/${i}: ${j.why}`);
        extra[`${t.id}/${i}`] = { r, n: j.n, sol };
        const s = S.tutJudge(t, i, g, S.simulateShot(g.balls, { angle: sol.angle, power: 0.02, spin: { x: 0, y: 0 }, ball }));
        if (s.ok || !s.why) soft.push(`${t.id}/${i}`);
        for (const txt of [st.text(c), st.then ? st.then.text(c) : '']) {
          const n = (txt.match(/[.?!](\s|$)/g) || []).length;
          if (txt && (n < 1 || n > 2 || txt.length > 160 || /\u2014|\u2013/.test(txt))) words.push(`${t.id}/${i}: ${txt}`);
        }
        /* every ball on the bed, none touching another */
        const R = S.BALL_R;
        for (const b of g.balls) {
          const free = t.kind === 'bumper' ? S.bumperFree(g.balls, b.x, b.y, b.n) : t.kind === 'carom' ? S.caromFree(g.balls, b.x, b.y, b.n)
            : b.x > R && b.x < S.TL - R && b.y > R && b.y < S.TW - R && g.balls.every(o => o === b || Math.hypot(o.x - b.x, o.y - b.y) >= 2 * R);
          if (!free) layout.push(`${t.id}/${i}: ${b.n}`);
        }
      });
    }
  }
  check('every stored solution passes its step\'s goal through simulateShot and the real judge (8-ball\'s for solids and stripes; in-hand steps from a legal placement)', !bad.length, bad.join(' | '));
  check('a dead-soft shot fails every step, with a reason', !soft.length, soft.join());
  check('every step\'s coach words are one or two sentences, short, with no em or en dash', !words.length, words.join(' | '));
  check('every layout is legal: each ball on the bed, none touching', !layout.length, layout.join());
  const e = k => extra[k];
  check('8-ball: step 1 gives a group, step 4 wins the rack; 9-ball: step 2 is a combination (the 3 first, the 6 down), step 3 wins with the 9',
    !!e('8/0').n.groups[0] && e('8/3').n.winner === 0 && e('9/1').r.first === 3 && e('9/1').n.verdict.potted.includes(6) && e('9/2').n.winner === 0 && e('9/2').n.verdict.potted.includes(9));
  check('bumper pool: step 1 strikes the marked ball, step 2 banks it in off a cushion, step 3 shows the own-cup foul (the ball comes back, white drops one)',
    e('bumper/0').sol.ball === 21 && e('bumper/0').n.verdict.potted.includes(21) && e('bumper/1').r.rails[22] >= 1
    && e('bumper/2').n.verdict.foul === 'into your own cup' && e('bumper/2').n.verdict.back.length === 1 && e('bumper/2').n.verdict.dropped !== null);
  check('three-cushion: step 1 a one-cushion point, step 2 a three-cushion point off a centre hit (the guide\'s natural line), step 3 cushions first',
    e('carom/0').n.verdict.point && e('carom/0').n.verdict.count.cushions >= 1 && e('carom/1').n.verdict.point && e('carom/1').n.verdict.count.cushions >= 3
    && e('carom/1').sol.spin.x === 0 && e('carom/1').sol.spin.y === 0 && e('carom/2').r.seq[0] < 0 && e('carom/2').n.verdict.point);
  check('snooker: a red (1), the black (7, re-spotted, on a red again), a red from the D after an in-off, then the yellow in order (it stays down)',
    e('snooker/0').n.verdict.pts === 1 && e('snooker/1').n.verdict.pts === 7 && e('snooker/1').n.verdict.back.includes(62) && e('snooker/1').n.on === 'red'
    && e('snooker/2').n.verdict.pts >= 1 && e('snooker/3').n.verdict.potted.includes(57));
  check('the sim region has no clocks and no Math.random', !/Math\.random|Date\.now|performance\.now|new Date/.test(regionSource()));
}

/* ---------- the page ---------- */
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
/* the coach card: on screen, clear of every control and of the ball the cue strikes */
const coachClear = T => ev(T, () => {
  const R = e => e.getBoundingClientRect(), c = R(coach), n = ['bumper', 'carom'].includes(felt.game.kind) ? felt.striker : 0, cb = felt.game.balls.find(b => b.n === n);
  const s = cb ? felt.toScreen(cb.x, cb.y) : [-1e4, -1e4], r = felt.ballPx / 2;
  const hits = [powerBar, fineWheel, spinPad, menuBtn].filter(e => { const q = R(e); return c.left < q.right && c.right > q.left && c.top < q.bottom && c.bottom > q.top; }).map(e => e.id);
  const dx = Math.max(c.left - s[0], 0, s[0] - c.right), dy = Math.max(c.top - s[1], 0, s[1] - c.bottom);
  return { shown: !coach.hidden && c.width > 0, hits, cueGap: Math.round(Math.hypot(dx, dy) - r), inside: c.left >= 0 && c.top >= 0 && c.right <= innerWidth && c.bottom <= innerHeight,
    ring: !coachRing.hidden, step: coachStep.textContent, text: coachText.textContent, btn: coachBtn.hidden ? '' : coachBtn.textContent };
});
const coachOk = c => c.shown && c.inside && !c.hits.length && c.cueGap > 0;
/* a pull along the power bar to exactly `power` (past its dead zone, as the bar measures it), then let go */
async function pullTo(T, power) {
  const b = await ev(T, () => { const r = powerBar.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, arm: felt.armPx }; });
  const up = b.h > b.w, lo = up ? b.t : b.l, hi = up ? b.b : b.r, pos0 = lo + 6, span = Math.max(hi - pos0, (hi - lo) * 0.5) * 0.92, arm = Math.min(b.arm, span * 0.2);
  const d = arm + power * (span - arm), at = u => up ? [b.l + b.w / 2, pos0 + u] : [pos0 + u, b.t + b.h / 2];
  await T.down(at(0));
  for (let i = 1; i <= 12; i++) await T.move(at(d * i / 12), 16);
  await T.up(16);
}
/* the solution's aim and english set as a finished aim would leave them (the aim is not a shot) */
const aimAt = (T, sol) => ev(T, s => { aimAnim = null; aimLock = null; handAimed = true; aimAngle = s.angle; cueSpin = spinOf(s.spin); }, sol);
const ballsNow = T => ev(T, () => JSON.stringify(felt.game.balls.map(b => [b.n, b.x, b.y, b.on])));
/* a real shot with the stored solution's line: the bar pulled by touch; the live roll against simulateShot */
async function realShot(T, id, i) {
  const sol = await ev(T, a => felt.tutSol(a[0], a[1]), [id, i]);
  await aimAt(T, sol);
  const before = await ev(T, () => JSON.parse(JSON.stringify(felt.game.balls)));
  await pullTo(T, sol.power);
  await T.page.waitForTimeout(60);
  const st = await ev(T, () => felt.state);
  await settled(T.page);
  await T.page.waitForTimeout(150);
  return ev(T, ([balls, st]) => {
    const s = felt.lastShot, r = simulateShot(balls, { angle: s.angle, power: s.power, spin: s.spin, ball: s.ball });
    return { st, shot: !!s, power: s.power, live: JSON.stringify(felt.lastResult) === JSON.stringify(r), last: felt.lastTut, tut: felt.tut, done: tutDone.classList.contains('show') };
  }, [before, st]);
}
/* Show me (or Next), and the roll it starts */
async function coachTap(T) {
  await T.page.click('#coachBtn');
  await T.page.waitForTimeout(80);
  await settled(T.page);
  await T.page.waitForTimeout(150);
}
const geo = T => ev(T, () => JSON.stringify({ TABLE, POOL_TABLE, BUMPER_SHAPE, SNOOKER_SIZE, POCKETS_STYLE, TL, TW, BALL_R, MU_ROLL, CUE_RATIO, CUSH_MU, RAIL_E, HEAD_X, POCKET_R, CUSH, POCKETS }));

async function portrait() {
  const T = await phone({ width: 440, height: 956 }, { firstRun: true });
  await T.page.waitForTimeout(300);
  await T.page.click('#offerSkip');   /* the controls lesson's own first-run offer */
  await ev(T, () => { felt.speed = 6; });
  const fresh = await ev(T, () => felt.tutRec);
  check('a first run: no tutorial done, none skipped, offers on', JSON.stringify(fresh) === JSON.stringify({ v: 1, done: {}, skipped: {}, never: false }), JSON.stringify(fresh));
  let liveAll = true;
  for (const id of IDS) {
    await T.page.click(TILE[id]);
    await T.page.waitForTimeout(250);
    const link = await ev(T, () => ({ shown: setupSheet.classList.contains('show') && !tutLink.hidden && tutLink.getClientRects().length > 0, text: tutLink.textContent.trim(), icon: !!tutLink.querySelector('.ic svg path') }));
    check(`${id}: the setup sheet's quiet link "New to ${WORD[id]}? Play the tutorial", with the graduation cap`, link.shown && link.text === `New to ${WORD[id]}? Play the tutorial` && link.icon, JSON.stringify(link));
    if (id === '8' || id === 'snooker') {
      check(`${id}: the setup sheet with the link: targets 44 px, text 4.5:1`, (await smallTargets(T.page)).length === 0 && (await lowContrast(T.page)).length === 0, JSON.stringify([await smallTargets(T.page), await lowContrast(T.page)]));
      await T.shot('setup-link-' + id + '-p');
    }
    if (id === 'snooker') {
      /* snooker's link opens it too; its run is the How to play one below (the table check) */
      await T.page.click('#tutLink');
      await T.page.waitForTimeout(250);
      check('snooker: the link opens step 1 on the snooker table', await ev(T, () => !!felt.tut && felt.tut.id === 'snooker' && felt.tut.step === 0 && felt.table === 'snooker' && felt.game.kind === 'snooker'));
      await T.page.click('#menuBtn');
      const pm = await ev(T, () => ({ kind: soloKind.textContent, title: soloTitle.textContent, concede: !concedeBtn.hidden }));
      check('the pause menu names the tutorial and the step; no Concede in a tutorial', pm.kind === 'Snooker tutorial, step 1 of 4' && pm.title === 'On a red' && !pm.concede, JSON.stringify(pm));
      await T.page.click('#exitBtn');
      check('quit: home, the coach gone', await ev(T, () => felt.state === 'menu' && coach.hidden && coachRing.hidden && felt.tut === null));
      break;
    }
    await T.page.click('#tutLink');
    await T.page.waitForTimeout(350);
    const n = await ev(T, id => tutById(id).steps.length, id);
    const c0 = await coachClear(T);
    check(`${id}: the link starts step 1: its coach card on screen, off the controls and the ${id === 'bumper' || id === 'carom' ? 'ball to strike' : 'cue ball'}, a ring, Show me`,
      coachOk(c0) && c0.ring && c0.step.startsWith(`${await ev(T, id => tutById(id).name, id)}, step 1 of ${n}:`) && c0.btn === 'Show me' && await ev(T, () => felt.tut.step === 0 && felt.state === 'aim' && !felt.game.mode), JSON.stringify(c0));
    await T.shot(`tut-${id}-1-p`);
    for (let i = 0; i < n; i++) {
      await ev(T, () => { felt.lastTut = null; });
      const real = (id === '8' && (i === 0 || i === 2)) || (id !== '8' && i === 0);
      if (real) {
        if (id === '8' && i === 2) {
          /* ball in hand: the cue ball dragged by touch to the solution's spot */
          const p = await ev(T, () => { const c = felt.game.balls.find(b => b.n === 0), s = felt.tutSol('8', 2); return { from: felt.toScreen(c.x, c.y), to: felt.toScreen(s.place[0], s.place[1]), place: s.place, ring: coachRing.getBoundingClientRect().width }; });
          await T.down(p.from, 30);
          for (let k = 1; k <= 14; k++) await T.move([p.from[0] + (p.to[0] - p.from[0]) * k / 14, p.from[1] + (p.to[1] - p.from[1]) * k / 14], 20);
          await T.up(30);
          await T.page.waitForTimeout(150);
          const mv = await ev(T, pl => { const c = felt.game.balls.find(b => b.n === 0); return { d: Math.hypot(c.x - pl[0], c.y - pl[1]), st: felt.state, shot: felt.lastShot && felt.lastShot.ball, ok: felt.place(pl[0], pl[1]) }; }, p.place);
          check('8-ball step 3: a drag moves the cue ball in hand to the spot (and does not shoot); the coach ring moves on to the ball to pot',
            mv.d < 0.01 && mv.st === 'aim' && mv.ok && await ev(T, () => {
              const n = tutNum(tutById('8'), 2, solo.ctx, 5), b = felt.game.balls.find(o => o.n === n), s = felt.toScreen(b.x, b.y), a = coachRing.getBoundingClientRect();
              return Math.hypot((a.left + a.right) / 2 - s[0], (a.top + a.bottom) / 2 - s[1]) < 2;
            }), JSON.stringify(mv));
        }
        if (id === 'bumper') {
          /* a tap on the marked red picks it */
          const p = await ev(T, () => { const b = felt.game.balls.find(o => o.n === 21); return felt.toScreen(b.x, b.y); });
          await T.down(p, 30); await T.up(60);
          await T.page.waitForTimeout(200);
          check('bumper pool step 1: a tap on the marked red picks it to strike', await ev(T, () => felt.striker === 21 && felt.state === 'aim'));
        }
        const r = await realShot(T, id, i);
        liveAll = liveAll && r.live;
        check(`${id} step ${i + 1}: played with a touch pull on the power bar (stroke, roll), judged by the real rules: done, on to the next`,
          ['stroke', 'rolling'].includes(r.st) && r.shot && r.last && r.last.ok && !r.last.demo && (r.done || (r.tut && (r.tut.step === i + 1 || r.tut.then))), JSON.stringify(r));
        if (r.tut && r.tut.then) await coachTap(T);
      } else {
        const st = await ev(T, () => felt.tut.step);
        await coachTap(T);
        let t = await ev(T, () => ({ last: felt.lastTut, tut: felt.tut, done: tutDone.classList.contains('show') }));
        if (t.tut && t.tut.then) {
          const c = await coachClear(T);
          check(`${id} step ${i + 1}: the result stays on show, the coach explains it with a ring and a Next button`, c.shown && c.ring && c.btn === 'Next' && await ev(T, () => felt.state === 'over'), JSON.stringify(c));
          await T.shot(`tut-${id}-then-p`);
          await coachTap(T);
          t = await ev(T, () => ({ last: felt.lastTut, tut: felt.tut, done: tutDone.classList.contains('show') }));
        }
        check(`${id} step ${i + 1}: Show me plays the stored solution and the step is done`, t.last && t.last.ok && t.last.demo && st === i && (t.done || (t.tut && t.tut.step === i + 1)), JSON.stringify(t));
      }
      if (i === 1 && id !== '8') { const c = await coachClear(T); check(`${id} step 2's coach card is clear of the controls and the struck ball`, coachOk(c), JSON.stringify(c)); }
    }
    const fin = await ev(T, () => ({ shown: tutDone.classList.contains('show'), title: tutDoneTitle.textContent, kick: tutDoneKick.textContent, btns: [tutPlay.textContent, tutHome.textContent], rec: felt.tutRec, coach: coach.hidden }));
    const name = await ev(T, id => tutById(id).name, id);
    check(`${id}: the finish card ("Tutorial complete", "That's ${name}.", Play ${name} / Home), done stored`,
      fin.shown && fin.kick === 'Tutorial complete' && fin.title === `That's ${name}.` && fin.btns.join() === `Play ${name},Home` && fin.rec.done[id] === true && fin.coach && JSON.parse(await ev(T, () => localStorage.getItem('felt.tutorials.v1'))).done[id] === true, JSON.stringify(fin));
    if (id === '8') {
      check('the finish card: targets 44 px, text 4.5:1', (await smallTargets(T.page)).length === 0 && (await lowContrast(T.page)).length === 0, JSON.stringify([await smallTargets(T.page), await lowContrast(T.page)]));
      await T.shot('tut-done-p');
    }
    await T.page.click('#tutPlay');
    await T.page.waitForTimeout(250);
    const after = await ev(T, () => ({ setup: setupSheet.classList.contains('show'), title: setupTitle.textContent, link: tutLink.hidden && !tutLink.getClientRects().length }));
    check(`${id}: Play opens its setup, and the setup link has gone now it is done`, after.setup && after.title === name && after.link, JSON.stringify(after));
    await T.page.click('#setupBack');
  }
  check('every real-input step\'s live roll equals simulateShot byte for byte', liveAll);

  /* a miss: the step comes back, "Close. Try again." (9-ball again, from How to play's Replay) */
  await T.page.click('#helpBtn');
  await T.page.click('#tab9');
  const rp = await ev(T, () => ({ text: tutGo9.textContent.trim(), lesson: lessonAgain.hidden }));
  check('How to play, 9-ball: the tutorial is done, so its button says "Replay the 9-ball tutorial"; the lesson button is the Controls tab\'s', rp.text === 'Replay the 9-ball tutorial' && rp.lesson, JSON.stringify(rp));
  await T.page.click('#tutGo9');
  await T.page.waitForTimeout(300);
  await ev(T, () => { felt.lastShot = null; });
  const layout = await ballsNow(T);
  /* nothing but the bar shoots: a drag on the table, keys, a tap on the coach card's words */
  const cue = await ev(T, () => { const c = felt.game.balls[0]; return felt.toScreen(c.x, c.y); });
  await T.down([cue[0] + 60, cue[1] + 90]);
  for (let i = 1; i <= 10; i++) await T.move([cue[0] + 60 + 4 * i, cue[1] + 90 + 6 * i], 16);
  await T.up(16);
  for (const k of ['Enter', ' ', 's', 'ArrowUp']) await T.page.keyboard.press(k);
  const words = await ev(T, () => { const r = coachText.getBoundingClientRect(); return [r.left + 20, r.top + r.height / 2]; });
  await T.down(words, 30); await T.up(60);
  await T.page.waitForTimeout(200);
  check('in a tutorial a drag on the table, keys and a tap on the coach card never shoot', await ev(T, () => felt.state === 'aim' && felt.lastShot === null && felt.tut.step === 0));
  const away = await ev(T, () => ({ angle: felt.aim + Math.PI, power: 0.3, spin: { x: 0, y: 0 } }));
  await aimAt(T, away);
  await pullTo(T, 0.3);
  await T.page.waitForTimeout(60);
  await settled(T.page);
  await T.page.waitForTimeout(200);
  const miss = await ev(T, () => ({ last: felt.lastTut, step: coachStep.textContent, text: coachText.textContent, tut: felt.tut, st: felt.state }));
  check('a miss puts the step\'s balls back and says "Close. Try again." with why', miss.last && !miss.last.ok && miss.step === 'Close. Try again.' && miss.tut.step === 0 && miss.tut.again && miss.st === 'aim'
    && (await ballsNow(T)) === layout && miss.text.startsWith(miss.last.why), JSON.stringify(miss));
  await T.shot('tut-again-p');
  await T.page.click('#menuBtn');
  await T.page.click('#exitBtn');

  /* the snooker tutorial from How to play puts the 8-ball table back exactly */
  await T.page.click('#play8');
  await T.page.click('#tb9');
  await T.page.click('#pkGen');
  await T.page.click('#setupBack');
  const g0 = await geo(T), s0 = await ev(T, () => JSON.stringify(settings));
  await T.page.click('#helpBtn');
  await T.page.click('#tabSnk');
  await T.page.click('#tutGoS');
  await T.page.waitForTimeout(300);
  check('How to play, Snooker: "Play the snooker tutorial" starts it on the compact snooker table', await ev(T, () => felt.tut && felt.tut.id === 'snooker' && TABLE === 'snooker' && SNOOKER_SIZE === 'compact' && felt.game.on === 'red' && !snkBar.hidden));
  const cs = await coachClear(T);
  check('snooker step 1: the coach rings the scoreboard on the top rail ("On Red") and keeps off it', cs.ring && coachOk(cs) && await ev(T, () => {
    const a = coachRing.getBoundingClientRect(), b = snkBar.getBoundingClientRect(), c = coach.getBoundingClientRect();
    return a.left <= b.left && a.right >= b.right && a.top <= b.top && a.bottom >= b.bottom && /On\s*Red/.test(snkBar.textContent) && !(c.left < b.right && c.right > b.left && c.top < b.bottom && c.bottom > b.top);
  }), JSON.stringify(cs));
  await T.shot('tut-snooker-1-p');
  const sn = await realShot(T, 'snooker', 0);
  check('snooker step 1 by the bar: a red, live equals simulateShot', sn.last && sn.last.ok && sn.live && sn.tut.step === 1, JSON.stringify(sn));
  await coachTap(T);
  check('snooker step 2: the black down and back on its spot, the coach rings the spot; Next', await ev(T, () => {
    const b = felt.game.balls.find(o => o.n === 62), a = coachRing.getBoundingClientRect(), s = felt.toScreen(SPOTS[62][0], SPOTS[62][1]);
    return felt.tut.then && b.on && b.x === SPOTS[62][0] && b.y === SPOTS[62][1] && Math.abs((a.left + a.right) / 2 - s[0]) < 2 && Math.abs((a.top + a.bottom) / 2 - s[1]) < 2 && coachBtn.textContent === 'Next';
  }));
  await T.shot('tut-snooker-then-p');
  await coachTap(T);
  const d = await ev(T, () => ({ hand: felt.game.inHand, ring: coachRing.getBoundingClientRect(), D: [felt.toScreen(HEAD_X - D_R, TW / 2 - D_R), felt.toScreen(HEAD_X, TW / 2 + D_R)], score: felt.game.score }));
  const dIn = q => q[0] >= d.ring.left && q[0] <= d.ring.right && q[1] >= d.ring.top && q[1] <= d.ring.bottom;
  check('snooker step 3: ball in hand in the D after the in-off, 4 points to you, the coach rings the D', d.hand === 'D' && d.score[0] === 4 && d.D.every(dIn), JSON.stringify(d));
  await T.shot('tut-snooker-3-p');
  for (let i = 2; i < 4; i++) await coachTap(T);
  check('snooker: Show me places the cue ball in the D, pots a red, then the yellow: the finish card', await ev(T, () => tutDone.classList.contains('show') && felt.tutRec.done.snooker));
  await T.page.click('#tutHome');
  await T.page.waitForTimeout(200);
  const g1 = await geo(T), s1 = await ev(T, () => JSON.stringify(settings));
  check('after the snooker tutorial: the 8-ball table (9 ft, generous) and every per-table value exactly as before, the settings untouched', g1 === g0 && s1 === s0 && await ev(T, () => felt.game.kind === '8' && felt.state === 'menu'), g1 === g0 ? s1 : g1 + ' vs ' + g0);
  await T.page.click('#play8');
  await T.page.click('#breakBtn');
  await T.page.waitForTimeout(200);
  check('and an 8-ball game breaks on that table', await ev(T, () => felt.game.kind === '8' && !felt.tut && TABLE === '9' && POCKETS_STYLE === 'generous' && ['aim', 'thinking'].includes(felt.state)));
  await T.page.click('#menuBtn'); await T.page.click('#exitBtn');

  /* stats: tutorials done */
  await T.page.click('#statsBtn');
  check('the stats sheet: "Tutorials: 5 of 5 done."', await ev(T, () => tutStat.textContent === 'Tutorials: 5 of 5 done.'));
  await T.page.click('#statsBack');

  /* the offer on a first Break */
  await ev(T, () => localStorage.removeItem('felt.tutorials.v1'));
  await T.page.reload(); await T.page.waitForFunction(() => window.booted === true);
  await ev(T, () => { felt.speed = 6; });
  await T.page.click('#play8'); await T.page.click('#breakBtn');
  await T.page.waitForTimeout(250);
  const of = await ev(T, () => ({ shown: tutOffer.classList.contains('show'), title: tutOfferTitle.textContent, sub: tutOfferSub.textContent, btns: [tutOfferGo, tutOfferSkip, tutOfferNever].map(b => b.textContent), st: felt.state }));
  check('a first Break of 8-ball offers its tutorial ("First time playing 8-ball?", Show me / Skip / Don\'t ask again), no game yet',
    of.shown && of.title === 'First time playing 8-ball?' && /one minute tutorial/.test(of.sub) && of.btns.join() === 'Show me,Skip,Don\'t ask again' && of.st === 'menu', JSON.stringify(of));
  check('the offer: targets 44 px, text 4.5:1', (await smallTargets(T.page)).length === 0 && (await lowContrast(T.page)).length === 0, JSON.stringify([await smallTargets(T.page), await lowContrast(T.page)]));
  await T.shot('tut-offer-p');
  await T.page.click('#tutOfferSkip');
  await T.page.waitForTimeout(200);
  check('Skip: the 8-ball game breaks, and 8-ball is marked skipped', await ev(T, () => !tutOffer.classList.contains('show') && felt.game.kind === '8' && !felt.tut && ['aim', 'thinking'].includes(felt.state) && felt.tutRec.skipped['8'] === true));
  await T.page.click('#menuBtn'); await T.page.click('#exitBtn');
  await T.page.click('#play8'); await T.page.click('#breakBtn');
  await T.page.waitForTimeout(200);
  check('after Skip, the next 8-ball Break goes straight to the game', await ev(T, () => !tutOffer.classList.contains('show') && felt.game.kind === '8' && ['aim', 'thinking'].includes(felt.state)));
  await T.page.click('#menuBtn'); await T.page.click('#exitBtn');
  await T.page.click('#play9'); await T.page.click('#breakBtn');
  await T.page.waitForTimeout(200);
  const o9 = await ev(T, () => tutOffer.classList.contains('show') && tutOfferTitle.textContent === 'First time playing 9-ball?');
  await T.page.click('#tutOfferGo');
  await T.page.waitForTimeout(250);
  check('9-ball\'s first Break offers its own; Show me starts the 9-ball tutorial', o9 && await ev(T, () => felt.tut && felt.tut.id === '9' && felt.tut.step === 0));
  await T.page.click('#menuBtn'); await T.page.click('#exitBtn');
  await T.page.click('#playB'); await T.page.click('#breakBtn');
  await T.page.waitForTimeout(200);
  const oB = await ev(T, () => tutOffer.classList.contains('show') && tutOfferTitle.textContent === 'First time playing bumper pool?');
  await T.page.click('#tutOfferNever');
  await T.page.waitForTimeout(200);
  check('bumper pool\'s offer, Don\'t ask again: the game breaks, and offers are off for every game', oB && await ev(T, () => felt.game.kind === 'bumper' && !felt.tut && felt.tutRec.never === true));
  await T.page.click('#menuBtn'); await T.page.click('#exitBtn');
  await T.page.click('#playC'); await T.page.click('#breakBtn');
  await T.page.waitForTimeout(200);
  check('after Don\'t ask again, a first carom Break goes straight to the game (its setup link stays)', await ev(T, () => !tutOffer.classList.contains('show') && felt.game.kind === 'carom' && ['aim', 'thinking'].includes(felt.state)));
  await T.page.click('#menuBtn'); await T.page.click('#exitBtn');

  /* bad storage reads fresh */
  await ev(T, () => localStorage.setItem('felt.tutorials.v1', '{oops'));
  await T.page.reload(); await T.page.waitForFunction(() => window.booted === true);
  await T.page.click('#play8');
  check('a bad tutorials record reads fresh: none done, offers on, the setup link back', await ev(T, () => JSON.stringify(felt.tutRec) === '{"v":1,"done":{},"skipped":{},"never":false}' && !tutLink.hidden));
  await T.page.click('#setupBack');
  /* reduced motion: the coach card and ring do not animate */
  await T.page.emulateMedia({ reducedMotion: 'reduce' });
  await ev(T, () => felt.tutorial('carom'));
  await T.page.waitForTimeout(200);
  check('reduced motion: the coach card and its ring stand still', await ev(T, () => getComputedStyle(coach).animationName === 'none' && getComputedStyle(coachRing).animationName === 'none'));
  await T.page.emulateMedia({ reducedMotion: 'no-preference' });
  await ev(T, () => felt.quitToHome());

  /* How to play at 375x667: each game's tutorial button, the sheet inside the screen */
  await T.page.setViewportSize({ width: 375, height: 667 });
  await T.page.click('#helpBtn');
  const tabs = [];
  for (const [tab, go] of [['#tabCtl', null], ['#tab8', '#tutGo8'], ['#tab9', '#tutGo9'], ['#tabBump', '#tutGoB'], ['#tabCarom', '#tutGoC'], ['#tabSnk', '#tutGoS']]) {
    await T.page.click(tab);
    tabs.push(await ev(T, ([go]) => {
      const sh = document.querySelector('#helpSheet .sheet').getBoundingClientRect(), b = go ? document.querySelector(go) : lessonAgain;
      return { go, text: b.textContent.trim(), shown: b.getClientRects().length > 0, lesson: !lessonAgain.hidden, fits: sh.left >= 0 && sh.right <= innerWidth + 0.5 && document.documentElement.scrollWidth <= innerWidth,
        reach: (b.scrollIntoView({ block: 'nearest' }), (r => r.top >= 0 && r.bottom <= innerHeight + 0.5)(b.getBoundingClientRect())) };
    }, [go]));
    tabs[tabs.length - 1].small = (await smallTargets(T.page)).length;
    tabs[tabs.length - 1].low = (await lowContrast(T.page)).length;
    await T.page.click('#helpBack');
  }
  check('How to play at 375x667: Controls keeps "Play the lesson", each game\'s page ends with "Play the <game> tutorial" (scrolled to, on screen); the sheet inside the screen\'s width; 44 px, 4.5:1',
    tabs[0].text === 'Play the lesson' && tabs[0].lesson && tabs.slice(1).every((t, k) => t.shown && !t.lesson && t.text === `Play the ${WORD[IDS[k]]} tutorial`) && tabs.every(t => t.fits && t.reach && !t.small && !t.low), JSON.stringify(tabs));
  check('no em dashes on the page', await ev(T, () => !document.documentElement.outerHTML.includes('\u2014')));
  check('portrait: no page errors', T.errors.length === 0, T.errors.join(' | '));
  await T.browser.close();
}

/* landscape: each game's first step, the coach card clear of the controls; a Show me; the link and the offer */
async function landscape() {
  const T = await phone({ width: 956, height: 440 }, { firstRun: true });
  await T.page.waitForTimeout(300);
  await T.page.click('#offerSkip');
  await ev(T, () => { felt.speed = 6; });
  const out = [];
  for (const id of IDS) {
    await ev(T, id => felt.tutorial(id), id);
    await T.page.waitForTimeout(350);
    const c = await coachClear(T);
    out.push({ id, ok: coachOk(c) && c.ring, c });
    await T.shot(`tut-${id}-1-l`);
  }
  check('956x440: every game\'s first step has its coach card on screen, off the controls and the struck ball, with a ring', out.every(o => o.ok), JSON.stringify(out.filter(o => !o.ok)));
  check('956x440: the tutorial screen: targets 44 px, text 4.5:1', (await smallTargets(T.page)).length === 0 && (await lowContrast(T.page)).length === 0, JSON.stringify([await smallTargets(T.page), await lowContrast(T.page)]));
  await coachTap(T);
  check('956x440: Show me plays snooker\'s first step', await ev(T, () => felt.lastTut && felt.lastTut.ok && felt.tut.step === 1));
  await ev(T, () => felt.tutorial('9'));
  await T.page.waitForTimeout(200);
  for (let i = 0; i < 3; i++) await coachTap(T);
  check('956x440: the 9-ball finish card', await ev(T, () => tutDone.classList.contains('show')));
  await T.shot('tut-done-l');
  await T.page.click('#tutHome');
  await T.page.click('#playS');
  await T.page.waitForTimeout(250);
  const ln = await ev(T, () => { const r = tutLink.getBoundingClientRect(), b = breakBtn.getBoundingClientRect(); return { shown: r.height >= 44, inside: r.bottom <= innerHeight && b.bottom <= innerHeight + 0.5 || setupSheet.scrollHeight > setupSheet.clientHeight }; });
  check('956x440: the snooker setup shows the tutorial link (44 px), and Break is reachable', ln.shown && ln.inside, JSON.stringify(ln));
  await T.shot('setup-link-snooker-l');
  await T.page.click('#breakBtn');
  await T.page.waitForTimeout(250);
  check('956x440: the offer on snooker\'s first Break', await ev(T, () => tutOffer.classList.contains('show') && tutOfferTitle.textContent === 'First time playing snooker?'));
  await T.shot('tut-offer-l');
  check('landscape: no page errors', T.errors.length === 0, T.errors.join(' | '));
  await T.browser.close();
}

(async () => {
  nodeChecks();
  await portrait();
  await landscape();
  done();
})().catch(e => { console.error(e); process.exit(1); });
