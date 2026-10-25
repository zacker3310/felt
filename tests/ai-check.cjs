/* ai-check (Node): the CPU at its three levels. It pots a hanging ball, breaks legally, places
   the cue ball well with ball in hand (also when the ball on hangs in a jaw), plays a legal
   safety when every pot is blocked, respects the kitchen, stays inside its simulation budget, is
   deterministic for a seed, and its levels are ordered: easy misses more than medium on a fixed
   set of layouts, and hard beats medium over 20 seeded games of each kind. Hard against hard
   never stalls in a safety loop. The games run on worker threads to keep the suite fast.
   Tables: everything is measured on the default 7 ft table, layouts placed in fractions of the
   bed (written as 9 ft metres scaled by TL / 2.54 and TW / 1.27); a shorter set of games on the
   9 ft table checks that every level still finishes there. suggestAim, the human's starting
   aim, is checked on both. */
'use strict';
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');
const { loadSim } = require('./sim.cjs');
const S = loadSim();
const LEVELS = ['easy', 'medium', 'hard'];
/* a 9 ft table position, scaled onto the current bed */
const X = x => x * S.TL / 2.54, Y = y => y * S.TW / 1.27;

/* a shot as the contract shapes it, with a legal placement exactly when the cue ball is in hand */
function wellFormed(g, s) {
  const sp = s && s.spin;
  return !!s && Number.isFinite(s.angle) && s.power >= 0 && s.power <= 1 && !!sp && Number.isFinite(sp.x) && Number.isFinite(sp.y) &&
    sp.x * sp.x + sp.y * sp.y <= 1 + 1e-9 && (g.inHand ? !!s.place && S.canPlace(g, s.place[0], s.place[1]) : s.place === null);
}
/* a whole game; levels[p] plays for player p, `first` breaks; shot i is searched with seed
   seed * mult + i (the page counts its seed up by one a shot, mult 1) */
function play(kind, levels, seed, first, mult = 1000) {
  let g = S.newGame(kind), shots = 0, bad = 0;
  g.turn = first;
  while (g.winner === null && shots < 300) {
    const s = S.cpuShot(g, seed * mult + shots, levels[g.turn]);
    if (!wellFormed(g, s)) { bad++; break; }
    if (g.inHand) g = S.placeCue(g, s.place[0], s.place[1]);
    g = S.judge(g, S.simulateShot(g.balls, s));
    shots++;
  }
  return { winner: g.winner, shots, bad };
}

if (!isMainThread) {
  parentPort.postMessage(workerData.map(j => { S.setTable(j.size || '7'); return Object.assign(j, play(j.kind, j.levels, j.seed, j.first, j.mult)); }));
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
    put(g, 1, X(0.5 + r() * 1.5), Y(0.25 + r() * 0.77)); put(g, 9, X(0.3 + r() * 1.9), Y(0.15 + r() * 0.97)); put(g, 0, X(0.3 + r() * 1.9), Y(0.15 + r() * 0.97));
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
  /* hard against hard: no endless safety exchange. 4888 (= 5 * 977 + 3) is the playtest's
     150-shot 9-ball game, both players tapping the 7 frozen on the head rail */
  for (const kind of ['8', '9']) for (const [seed, mult] of [[4888, 1], [4870, 1], [4881, 1], [23, 1000], [25, 1000]]) jobs.push({ kind, seed, mult, levels: ['hard', 'hard'], hard: -2, first: 0 });
  /* the 9 ft table: every pairing of levels finishes a game of each kind */
  for (const kind of ['8', '9']) for (const [i, levels] of [['easy', 'easy'], ['medium', 'easy'], ['hard', 'medium'], ['medium', 'hard'], ['hard', 'hard']].entries())
    jobs.push({ kind, seed: 40 + i, levels, hard: -3, first: i % 2, size: '9' });
  const t0 = Date.now(), games = await playAll(jobs), ms = Date.now() - t0;

  for (const kind of ['8', '9']) {
    const easy = games.find(r => r.kind === kind && r.hard === -1);
    check(`easy vs easy finishes a game of ${kind}-ball with well-formed shots`, easy.winner !== null && easy.bad === 0, JSON.stringify(easy));
    const m = games.filter(r => r.kind === kind && r.hard >= 0), wins = m.filter(r => r.winner === r.hard).length;
    check(`hard vs medium: all 20 games of ${kind}-ball finish with well-formed shots and legal placements`,
      m.every(r => r.winner !== null && r.bad === 0), JSON.stringify(m.filter(r => r.winner === null || r.bad)));
    check(`hard beats medium at ${kind}-ball over 20 seeded games (breaker and seat alternate)`, wins >= 13,
      `hard won ${wins}/20, ${(m.reduce((a, r) => a + r.shots, 0) / m.length).toFixed(1)} shots a game`);
    const hh = games.filter(r => r.kind === kind && r.hard === -2);
    check(`hard vs hard: every ${kind}-ball game finishes within 120 shots (no safety loop)`, hh.every(r => r.winner !== null && r.bad === 0 && r.shots <= 120),
      hh.map(r => `${r.seed}:${r.shots}`).join(' '));
    const nine = games.filter(r => r.kind === kind && r.hard === -3);
    check(`9 ft table: every pairing of levels finishes a game of ${kind}-ball within 120 shots, shots well-formed`, nine.length === 5 && nine.every(r => r.winner !== null && r.bad === 0 && r.shots <= 120),
      nine.map(r => `${r.levels.join('-')}:${r.shots}`).join(' '));
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
    const g = midGame('9', [1, 2, 3, 4, 5, 6, 7, 9]), one = [X(1.6), S.TW / 2];
    put(g, 1, one[0], one[1]); put(g, 0, one[0] + 0.5 * Math.cos(-1.22), one[1] + 0.5 * Math.sin(-1.22)); put(g, 9, X(0.25), Y(0.2));
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
      put(g, 3, X(0.4 + r() * 1.7), Y(0.2 + r() * 0.87)); put(g, 6, X(0.4 + r() * 1.7), Y(0.2 + r() * 0.87)); put(g, 9, X(0.4 + r() * 1.7), Y(0.2 + r() * 0.87));
      g.inHand = 'table'; ball(g, 0).on = false;
      for (const l of ['medium', 'hard']) {
        const s = S.cpuShot(g, i, l);
        if (wellFormed(g, s) && after(g, s).verdict.keep) res[l]++;
      }
    }
    check('ball in hand: hard places and pots every time, medium nearly', res.hard === 5 && res.medium >= 4, JSON.stringify(res));
  }

  /* ball in hand with the ball on hanging in a jaw (the playtest's 2 at (2.5162, 0.0222) on the
     9 ft table, 23.8 mm from the foot rail's nose, then
     one per pocket among random balls): no level fouls, medium and hard pot it. Before the fix
     no pot line reached a ball past the mouth line, the spot fell back blind and the one-rail
     kick went through the side pocket's mouth: a scratch at every level. */
  {
    const set = [], fouls = [], missed = [];
    for (let i = 0; i < 13; i++) {
      const r = S.rng(500 + i), g = midGame('9', [2, 9]);
      g.inHand = 'table'; ball(g, 0).on = false;
      if (i === 12) { put(g, 2, S.TL - 0.0238, 0.0222); set.push(g); continue; }
      /* a side ball on the mouth line, a micron onto the bed: the line is the hole's edge, so a
         centre exactly on it drops or not by rounding (it did on the 7 ft table, untouched). A
         corner ball a third of the way into the shelf. */
      const k = i % 6, P = S.POCKETS[k], A = S.POCKET_AIM[k], f = 0.68;
      if (k === 1 || k === 4) put(g, 2, A[0], A[1] + (A[1] > S.TW / 2 ? -1e-6 : 1e-6));
      else put(g, 2, P[0] + (A[0] - P[0]) * f, P[1] + (A[1] - P[1]) * f);
      for (let n = 3; n < 9; n++) if (r() < 0.5) {
        for (;;) {
          const x = 0.2 + r() * (S.TL - 0.4), y = 0.15 + r() * (S.TW - 0.3);
          if (g.balls.every(o => !o.on || o.n === n || Math.hypot(o.x - x, o.y - y) > 0.07)) { put(g, n, x, y); break; }
        }
      }
      for (;;) {
        const x = 0.2 + r() * (S.TL - 0.4), y = 0.15 + r() * (S.TW - 0.3);
        if (g.balls.every(o => !o.on || o.n === 9 || Math.hypot(o.x - x, o.y - y) > 0.07)) { put(g, 9, x, y); break; }
      }
      set.push(g);
    }
    set.forEach((g, i) => {
      for (const l of LEVELS) {
        const s = S.cpuShot(g, i, l), j = wellFormed(g, s) ? after(g, s) : null;
        if (!j || j.verdict.foul) fouls.push(`${l}#${i}:${j ? j.verdict.foul : 'malformed'}`);
        else if (l !== 'easy' && !j.verdict.potted.includes(2)) missed.push(`${l}#${i}`);
      }
    });
    check('ball in hand, the ball on hanging in a jaw: no level fouls', !fouls.length, fouls.join(' '));
    check('ball in hand, the ball on hanging in a jaw: medium and hard pot it', !missed.length, missed.join(' '));
  }

  /* ball in hand in a crowded kitchen still finds a legal spot (v1) */
  {
    const g = S.newGame('8');
    g.breakShot = false; g.inHand = 'kitchen'; g.balls[0].on = false;
    const spots = [[S.HEAD_X - 0.05, Y(0.25)], [S.HEAD_X - 0.05, Y(0.45)], [S.HEAD_X - 0.05, S.TW / 2], [S.HEAD_X - 0.05, Y(0.82)], [S.HEAD_X - 0.05, Y(1.02)],
      [S.HEAD_X - 0.3, Y(0.25)], [S.HEAD_X - 0.3, Y(0.45)], [S.HEAD_X - 0.3, S.TW / 2], [S.HEAD_X - 0.3, Y(0.82)], [S.HEAD_X - 0.3, Y(1.02)]];
    spots.forEach((p, i) => Object.assign(g.balls[i + 1], { x: p[0], y: p[1] }));
    const ok = LEVELS.filter(l => { const s = S.cpuShot(g, 3, l); return !!s.place && S.canPlace(g, s.place[0], s.place[1]); });
    check('every level finds a legal kitchen spot when the usual ones are taken', ok.length === 3, ok.join(','));
  }

  /* in hand behind the head string, a ball in the kitchen is not a legal first contact */
  {
    const g = midGame('8', [1, 2]);
    g.inHand = 'kitchen'; ball(g, 0).on = false;
    put(g, 1, X(0.25), Y(0.25)); put(g, 2, X(1.9), Y(0.9));
    const firsts = LEVELS.map(l => { const s = S.cpuShot(g, 5, l), p = S.placeCue(g, s.place[0], s.place[1]); return S.simulateShot(p.balls, s).first; });
    check('from the kitchen the CPU plays the ball past the head string', firsts.every(n => n === 2), JSON.stringify(firsts));
  }

  /* suggestAim, the aim a human turn starts on, on both tables: the easiest clean pot of a legal
     ball (the CPU's ghost-ball lines and clearance), else straight at the nearest legal ball */
  for (const size of ['7', '9']) {
    S.setTable(size);
    const T = `${size} ft: suggestAim: `, cue = (g, x, y) => put(g, 0, x, y);
    const pots = (g, a) => S.simulateShot(g.balls, { angle: a.angle, power: S.powerFor(1.6), spin: 0 }).potted.includes(a.n);
    /* a 1 hanging in a corner jaw and one on a side's mouth line: the line into that pocket, and it drops */
    const hang = [5, 1].map(k => {
      const g = midGame('9', [1, 2, 9]), P = S.POCKETS[k], A = S.POCKET_AIM[k];
      if (k === 1) put(g, 1, A[0], A[1] + 1e-6); else put(g, 1, P[0] + (A[0] - P[0]) * 0.68, P[1] + (A[1] - P[1]) * 0.68);
      put(g, 2, X(0.6), Y(0.9)); put(g, 9, X(1.2), Y(0.85));
      if (k === 1) cue(g, S.TL / 2 + X(0.35), Y(0.45)); else cue(g, S.TL - X(0.6), S.TW - Y(0.45));
      const a = S.suggestAim(g);
      return { k, a, ok: !!a && a.n === 1 && a.k === k && pots(g, a) };
    });
    check(T + 'a hanging 1 in 9-ball gives the line into its pocket, and that shot drops it', hang.every(h => h.ok), JSON.stringify(hang.map(h => [h.k, h.a])));
    /* the 1 a cut into either foot corner: block the line the free table picks, it takes the other */
    {
      const g = midGame('9', [1, 2, 9]), one = [S.TL - X(0.5), S.TW / 2];
      put(g, 1, one[0], one[1]); put(g, 9, X(0.4), Y(1.0)); put(g, 2, X(0.3), Y(0.3)); cue(g, S.TL - X(1.1), S.TW / 2 + 0.02);
      const free = S.suggestAim(g), A = free ? S.POCKET_AIM[free.k] : one;
      put(g, 2, (one[0] + A[0]) / 2, (one[1] + A[1]) / 2);
      const blocked = S.suggestAim(g);
      check(T + 'a blocked pot line is skipped for an open one', free && free.n === 1 && [2, 5].includes(free.k) && blocked && blocked.n === 1 && blocked.k >= 0 && blocked.k !== free.k,
        JSON.stringify({ free, blocked }));
    }
    /* every line blocked (the ring): straight at the 1's centre, k = -1 */
    {
      const g = midGame('9', [1, 2, 3, 4, 5, 6, 7, 9]), one = [X(1.6), S.TW / 2];
      put(g, 1, one[0], one[1]); cue(g, one[0] + 0.5 * Math.cos(-1.22), one[1] + 0.5 * Math.sin(-1.22)); put(g, 9, X(0.25), Y(0.2));
      S.POCKET_AIM.forEach((p, k) => { const d = Math.hypot(p[0] - one[0], p[1] - one[1]); put(g, 2 + k, one[0] + (p[0] - one[0]) / d * 0.1, one[1] + (p[1] - one[1]) / d * 0.1); });
      const a = S.suggestAim(g), c = ball(g, 0);
      check(T + 'no clean pot: straight at the nearest legal ball\'s centre, k = -1', a && a.n === 1 && a.k === -1 && Math.abs(a.angle - Math.atan2(one[1] - c.y, one[0] - c.x)) < 1e-12, JSON.stringify(a));
    }
    /* legal balls only: in 9-ball the lowest even with the 9 hanging; in 8-ball the shooter's group */
    {
      const g = midGame('9', [3, 9]);
      put(g, 9, S.POCKETS[0][0] + (S.POCKET_AIM[0][0] - S.POCKETS[0][0]) * 0.68, S.POCKETS[0][1] + (S.POCKET_AIM[0][1] - S.POCKETS[0][1]) * 0.68);
      put(g, 3, S.TL - X(0.5), S.TW - Y(0.3)); cue(g, X(0.3), Y(0.4));
      const nine = S.suggestAim(g);
      const e = midGame('8', [1, 9, 8]);
      e.open = false; e.groups = ['solids', 'stripes'];
      put(e, 9, S.POCKETS[3][0] + (S.POCKET_AIM[3][0] - S.POCKETS[3][0]) * 0.68, S.POCKETS[3][1] + (S.POCKET_AIM[3][1] - S.POCKETS[3][1]) * 0.68);
      put(e, 8, X(0.3), Y(0.5)); put(e, 1, S.TL - X(0.4), Y(0.35)); cue(e, X(1.4), Y(0.8));
      const solid = S.suggestAim(e);
      e.turn = 1;
      const stripe = S.suggestAim(e);
      check(T + 'legal balls only: the lowest in 9-ball, the shooter\'s own group in 8-ball', nine && nine.n === 3 && solid && solid.n === 1 && stripe && stripe.n === 9 && stripe.k === 3,
        JSON.stringify({ nine, solid, stripe }));
    }
    /* in hand in the kitchen, cue ball placed: an easy pot behind the string is passed over for a ball past it */
    {
      const g = midGame('8', [1, 2]);
      g.inHand = 'kitchen';
      put(g, 1, X(0.2), Y(0.12)); put(g, 2, S.TL - X(0.6), S.TW / 2); cue(g, X(0.45), Y(0.35));
      const k = S.suggestAim(g), free = S.suggestAim(Object.assign(S.placeCue(g, X(0.45), Y(0.35)), { inHand: null }));
      check(T + 'from the kitchen it aims at a ball past the head string, though one behind it is easier', k && k.n === 2 && free && free.n === 1, JSON.stringify({ k, free }));
    }
    /* the break: at the head ball; nothing to aim at once the game is over or the cue ball is down */
    {
      const e = S.newGame('8'), n = S.newGame('9'), a = S.suggestAim(e), b = S.suggestAim(n);
      const head = e.balls.filter(x => x.n > 0).reduce((p, q) => q.x < p.x ? q : p);
      const over = Object.assign(S.newGame('9'), { winner: 0 }), down = midGame('9', [1, 9]);
      ball(down, 0).on = false;
      check(T + 'the break aims full at the head ball (the 1 in 9-ball); null when the game is over or the cue ball is off',
        a && a.n === head.n && a.k === -1 && Math.abs(a.angle) < 1e-12 && b && b.n === 1 && S.suggestAim(over) === null && S.suggestAim(down) === null, JSON.stringify({ a, b }));
    }
    /* pure, deterministic and cheap on a full mid-game table */
    {
      const g = midGame('8', [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 8]);
      const r = S.rng(31);
      for (const b of g.balls) if (b.on) for (;;) {
        const x = 0.1 + r() * (S.TL - 0.2), y = 0.1 + r() * (S.TW - 0.2);
        if (g.balls.every(o => o === b || !o.on || Math.hypot(o.x - x, o.y - y) > 2.2 * S.BALL_R)) { b.x = x; b.y = y; break; }
      }
      const snap = JSON.stringify(g), first = JSON.stringify(S.suggestAim(g)), t0 = process.hrtime.bigint();
      for (let i = 0; i < 200; i++) S.suggestAim(g);
      const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 200;
      check(T + 'pure, deterministic, well under 5 ms on 16 scattered balls', JSON.stringify(g) === snap && JSON.stringify(S.suggestAim(g)) === first && first !== 'null' && ms < 1, `${ms.toFixed(3)} ms, ${first}`);
    }
  }
  S.setTable('7');

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
