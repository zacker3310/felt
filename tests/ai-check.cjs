/* ai-check (Node): the CPU at its three levels. It pots a hanging ball, breaks legally, places
   the cue ball well with ball in hand, plays a legal safety when every pot is blocked, respects
   the kitchen, stays inside its simulation budget, is deterministic for a seed, and its levels
   are ordered: easy misses more than medium on a fixed set of layouts, and hard beats medium
   over 20 seeded games of each kind. The games run on worker threads to keep the suite fast. */
'use strict';
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');
const { loadSim } = require('./sim.cjs');
const S = loadSim();
const LEVELS = ['easy', 'medium', 'hard'];

/* a shot as the contract shapes it, with a legal placement exactly when the cue ball is in hand */
function wellFormed(g, s) {
  const sp = s && s.spin;
  return !!s && Number.isFinite(s.angle) && s.power >= 0 && s.power <= 1 && !!sp && Number.isFinite(sp.x) && Number.isFinite(sp.y) &&
    sp.x * sp.x + sp.y * sp.y <= 1 + 1e-9 && (g.inHand ? !!s.place && S.canPlace(g, s.place[0], s.place[1]) : s.place === null);
}
/* a whole game; levels[p] plays for player p, `first` breaks */
function play(kind, levels, seed, first) {
  let g = S.newGame(kind), shots = 0, bad = 0;
  g.turn = first;
  while (g.winner === null && shots < 300) {
    const s = S.cpuShot(g, seed * 1000 + shots, levels[g.turn]);
    if (!wellFormed(g, s)) { bad++; break; }
    if (g.inHand) g = S.placeCue(g, s.place[0], s.place[1]);
    g = S.judge(g, S.simulateShot(g.balls, s));
    shots++;
  }
  return { winner: g.winner, shots, bad };
}

if (!isMainThread) {
  parentPort.postMessage(workerData.map(j => Object.assign(j, play(j.kind, j.levels, j.seed, j.first))));
  return;
}
const { check, done } = require('./lib.cjs');

/* games, spread over worker threads */
function playAll(jobs) {
  const n = Math.max(1, Math.min(4, os.cpus().length, jobs.length)), parts = [...Array(n)].map(() => []);
  jobs.forEach((j, i) => parts[i % n].push(j));
  return Promise.all(parts.map(p => new Promise((res, rej) => {
    const w = new Worker(__filename, { workerData: p });
    w.once('message', res); w.once('error', rej);
  }))).then(r => r.flat());
}
/* a mid-game table: only `left` object balls, nobody in hand */
function midGame(kind, left) {
  const g = S.newGame(kind);
  g.breakShot = false; g.inHand = null;
  for (const b of g.balls) if (b.n > 0 && !left.includes(b.n)) b.on = false;
  return g;
}
const ball = (g, n) => g.balls.find(b => b.n === n);
const put = (g, n, x, y) => Object.assign(ball(g, n), { x, y, on: true });
/* is any ghost-ball line open for the 1 from the cue ball (the CPU's own clearance test) */
function blockedHasLine(g) {
  const c = ball(g, 0), t = ball(g, 1), R2 = 2 * S.BALL_R;
  const clear = (ax, ay, bx, by) => g.balls.every(o => {
    if (!o.on || o.n === 0 || o.n === 1) return true;
    const ex = bx - ax, ey = by - ay, u = ((o.x - ax) * ex + (o.y - ay) * ey) / (ex * ex + ey * ey);
    return u <= 0 || u >= 1 ? Math.hypot(o.x - bx, o.y - by) >= R2 : Math.hypot(o.x - ax - ex * u, o.y - ay - ey * u) >= R2;
  });
  return S.POCKET_AIM.some(p => {
    const d = Math.hypot(p[0] - t.x, p[1] - t.y), gx = t.x - (p[0] - t.x) / d * R2, gy = t.y - (p[1] - t.y) / d * R2;
    return clear(t.x, t.y, p[0], p[1]) && clear(c.x, c.y, gx, gy);
  });
}
const after = (g, s) => S.judge(g.inHand ? S.placeCue(g, s.place[0], s.place[1]) : g, S.simulateShot((g.inHand ? S.placeCue(g, s.place[0], s.place[1]) : g).balls, s));
/* seeded 9-ball layouts of the 1 and the 9 with the cue ball at least 30 cm from each */
function layouts(count) {
  const out = [];
  for (let i = 0; out.length < count; i++) {
    const r = S.rng(1000 + i), g = midGame('9', [1, 9]);
    put(g, 1, 0.5 + r() * 1.5, 0.25 + r() * 0.77); put(g, 9, 0.3 + r() * 1.9, 0.15 + r() * 0.97); put(g, 0, 0.3 + r() * 1.9, 0.15 + r() * 0.97);
    const [c, one, nine] = [ball(g, 0), ball(g, 1), ball(g, 9)];
    if ([one, nine].every(b => Math.hypot(b.x - c.x, b.y - c.y) > 0.3) && Math.hypot(one.x - nine.x, one.y - nine.y) > 0.2) out.push(g);
  }
  return out;
}

(async () => {
  /* the match first, so the threads run while nothing else does */
  const jobs = [];
  for (const kind of ['8', '9']) for (let i = 0; i < 20; i++) jobs.push({ kind, seed: 7 + i, levels: i % 2 ? ['medium', 'hard'] : ['hard', 'medium'], hard: i % 2, first: (i >> 1) % 2 });
  for (const kind of ['8', '9']) jobs.push({ kind, seed: 3, levels: ['easy', 'easy'], hard: -1, first: 0 });
  const t0 = Date.now(), games = await playAll(jobs), ms = Date.now() - t0;

  for (const kind of ['8', '9']) {
    const easy = games.find(r => r.kind === kind && r.hard < 0);
    check(`easy vs easy finishes a game of ${kind}-ball with well-formed shots`, easy.winner !== null && easy.bad === 0, JSON.stringify(easy));
    const m = games.filter(r => r.kind === kind && r.hard >= 0), wins = m.filter(r => r.winner === r.hard).length;
    check(`hard vs medium: all 20 games of ${kind}-ball finish with well-formed shots and legal placements`,
      m.every(r => r.winner !== null && r.bad === 0), JSON.stringify(m.filter(r => r.winner === null || r.bad)));
    check(`hard beats medium at ${kind}-ball over 20 seeded games (breaker and seat alternate)`, wins >= 13,
      `hard won ${wins}/20, ${(m.reduce((a, r) => a + r.shots, 0) / m.length).toFixed(1)} shots a game`);
  }
  console.log(`(match: ${games.length} games in ${(ms / 1000).toFixed(1)} s)`);

  /* a 9 hanging over the corner pocket, cue ball behind it on the line: every level wins */
  {
    const g = midGame('9', [9]);
    put(g, 9, S.TL - 0.09, S.TW - 0.09); put(g, 0, S.TL - 0.6, S.TW - 0.55);
    const won = LEVELS.filter(l => after(g, S.cpuShot(g, 1, l)).winner === 0);
    check('every level pots a hanging 9 and wins', won.length === 3, won.join(','));
  }

  /* pot rate on fixed medium-difficulty layouts: easy misses noticeably, levels are ordered */
  {
    const set = layouts(30), rate = {};
    for (const l of LEVELS) rate[l] = set.filter((g, i) => { const v = after(g, S.cpuShot(g, i, l)).verdict; return !v.foul && v.potted.length > 0; }).length / set.length;
    check('easy misses noticeably: its pot rate is well under medium\'s', rate.easy <= 0.7 * rate.medium, JSON.stringify(rate));
    check('hard pots more than medium on the same layouts', rate.hard > rate.medium, JSON.stringify(rate));
  }

  /* the break at every level: from the kitchen, onto the head ball (the 1 in 9-ball) */
  for (const kind of ['8', '9']) {
    const ok = LEVELS.filter(l => {
      const g = S.newGame(kind), s = S.cpuShot(g, 2, l);
      if (!wellFormed(g, s) || s.place[0] > S.HEAD_X || s.power < 0.8) return false;
      const head = kind === '9' ? 1 : g.balls.filter(b => b.n > 0).reduce((a, b) => b.x < a.x ? b : a).n;
      return S.simulateShot(S.placeCue(g, s.place[0], s.place[1]).balls, s).first === head;
    });
    check(`${kind}-ball: every level breaks hard from the kitchen onto the head ball`, ok.length === 3, ok.join(','));
  }

  /* every pot blocked: the 1 is ringed by higher balls on its lines to all six mouths; the cue
     ball looks at it through a gap in the ring. Medium and hard play a legal shot, not a foul. */
  {
    const g = midGame('9', [1, 2, 3, 4, 5, 6, 7, 9]), one = [1.6, S.TW / 2];
    put(g, 1, one[0], one[1]); put(g, 0, one[0] + 0.5 * Math.cos(-1.22), one[1] + 0.5 * Math.sin(-1.22)); put(g, 9, 0.25, 0.2);
    S.POCKET_AIM.forEach((p, k) => {
      const d = Math.hypot(p[0] - one[0], p[1] - one[1]);
      put(g, 2 + k, one[0] + (p[0] - one[0]) / d * 0.1, one[1] + (p[1] - one[1]) / d * 0.1);
    });
    for (const l of ['medium', 'hard']) {
      const s = S.cpuShot(g, 4, l), j = after(g, s);
      check(`${l}: every pot blocked, it plays a legal safety`, wellFormed(g, s) && !j.verdict.foul && j.winner === null, JSON.stringify(j.verdict));
      if (l === 'medium') check('the blocked layout really has no pot line', !blockedHasLine(g), 'a pot line exists');
    }
  }

  /* ball in hand anywhere: it picks a spot with an easy pot and makes it */
  {
    const res = { medium: 0, hard: 0 };
    for (let i = 0; i < 5; i++) {
      const r = S.rng(77 + i), g = midGame('9', [3, 6, 9]);
      put(g, 3, 0.4 + r() * 1.7, 0.2 + r() * 0.87); put(g, 6, 0.4 + r() * 1.7, 0.2 + r() * 0.87); put(g, 9, 0.4 + r() * 1.7, 0.2 + r() * 0.87);
      g.inHand = 'table'; ball(g, 0).on = false;
      for (const l of ['medium', 'hard']) {
        const s = S.cpuShot(g, i, l);
        if (wellFormed(g, s) && after(g, s).verdict.keep) res[l]++;
      }
    }
    check('ball in hand: hard places and pots every time, medium nearly', res.hard === 5 && res.medium >= 4, JSON.stringify(res));
  }

  /* ball in hand in a crowded kitchen still finds a legal spot (v1) */
  {
    const g = S.newGame('8');
    g.breakShot = false; g.inHand = 'kitchen'; g.balls[0].on = false;
    const spots = [[S.HEAD_X - 0.05, 0.25], [S.HEAD_X - 0.05, 0.45], [S.HEAD_X - 0.05, S.TW / 2], [S.HEAD_X - 0.05, 0.82], [S.HEAD_X - 0.05, 1.02],
      [S.HEAD_X - 0.3, 0.25], [S.HEAD_X - 0.3, 0.45], [S.HEAD_X - 0.3, S.TW / 2], [S.HEAD_X - 0.3, 0.82], [S.HEAD_X - 0.3, 1.02]];
    spots.forEach((p, i) => Object.assign(g.balls[i + 1], { x: p[0], y: p[1] }));
    const ok = LEVELS.filter(l => { const s = S.cpuShot(g, 3, l); return !!s.place && S.canPlace(g, s.place[0], s.place[1]); });
    check('every level finds a legal kitchen spot when the usual ones are taken', ok.length === 3, ok.join(','));
  }

  /* in hand behind the head string, a ball in the kitchen is not a legal first contact */
  {
    const g = midGame('8', [1, 2]);
    g.inHand = 'kitchen'; ball(g, 0).on = false;
    put(g, 1, 0.25, 0.25); put(g, 2, 1.9, 0.9);
    const firsts = LEVELS.map(l => { const s = S.cpuShot(g, 5, l), p = S.placeCue(g, s.place[0], s.place[1]); return S.simulateShot(p.balls, s).first; });
    check('from the kitchen the CPU plays the ball past the head string', firsts.every(n => n === 2), JSON.stringify(firsts));
  }

  /* budget and determinism on a full mid-game table */
  {
    const g = midGame('8', [1, 2, 3, 4, 5, 9, 10, 11, 12, 8]);
    g.open = false; g.groups = ['solids', 'stripes'];
    for (const l of LEVELS) {
      const it = S.cpuSearch(g, 9, l);
      let n = 0, r;
      const t = Date.now();
      while (!(r = it.next()).done) n++;
      check(`${l}: at most ${S.CPU_LEVELS[l].sims} simulations a turn`, n <= S.CPU_LEVELS[l].sims && wellFormed(g, r.value), `${n} sims, ${Date.now() - t} ms`);
      check(`${l}: cpuShot is deterministic for a seed`, JSON.stringify(S.cpuShot(g, 5, l)) === JSON.stringify(S.cpuShot(g, 5, l)));
    }
    check('the level defaults to medium', JSON.stringify(S.cpuShot(g, 6)) === JSON.stringify(S.cpuShot(g, 6, 'medium')));
  }

  done();
})().catch(e => { console.error(e); process.exit(1); });
