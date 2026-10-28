/* level-cue: a fixed set of level-cue shots on every table, and their fingerprint. physics-check
   runs it on the sim rebuilt as it was before audit F9 and F10 (side spin decaying at 8 rad/s^2,
   every spin zeroed at rest) and compares with LEVEL_PRINT, the fingerprint the build before the
   change gave: so the level cue's strike and everything after it are the old path exactly, apart
   from the spin decay and the stationary spin. Not a suite (run-all runs *-check.cjs only). */
'use strict';
/* FNV-1a over a string: a short, stable print of a long JSON */
const fnv = str => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
const SPINS = [0, { x: 0.6, y: 0.3 }, { x: -0.5, y: -0.5 }, { x: 0.8, y: 0 }, -0.7];
function levelPrint(S) {
  const rows = [];
  const run = (balls, angle, power, spin) => {
    const r = S.simulateShot(balls, { angle, power, spin, ball: balls[0].n });
    rows.push([r.t, r.steps, r.end, r.potted, r.balls.map(b => [b.n, b.on, b.x, b.y])]);
  };
  /* its own layouts (an LCG, so no other code's racks or tricks move the print): six balls apart
     on the bed, and a tight cluster of fifteen for a break */
  let seed = 12345;
  const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
  const layout = (n, nums) => {
    const out = [];
    while (out.length < n) {
      const x = 0.1 + rnd() * (S.TL - 0.2), y = 0.1 + rnd() * (S.TW - 0.2);
      if (out.every(b => Math.hypot(b.x - x, b.y - y) > 2.2 * S.BALL_R)) out.push(S.newBall(nums[out.length], x, y));
    }
    return out;
  };
  const cluster = () => {
    const out = [S.newBall(0, S.TL / 4, S.TW / 2)], d = 2 * S.BALL_R + 0.0002;
    for (let r = 0, n = 1; r < 5; r++) for (let j = 0; j <= r; j++) out.push(S.newBall(n++, S.TL * 0.7 + r * d * Math.sqrt(3) / 2, S.TW / 2 + (j - r / 2) * d));
    return out;
  };
  for (const size of ['7', '9']) {
    S.setTable(size);
    for (let i = 0; i < 14; i++) { const b = layout(6, [0, 1, 2, 3, 4, 5]); SPINS.forEach((sp, k) => run(b, -Math.PI + (i * 5 + k) * 0.37, 0.2 + 0.15 * k, sp)); }
    run(cluster(), 0, 1, { x: 0.3, y: 0 });
    run(cluster(), 0.01, 0.8, { x: -0.4, y: -0.6 });
  }
  S.setTable('snooker');
  SPINS.forEach((sp, k) => run([S.newBall(0, S.TL / 5, S.TW / 2), S.newBall(41, S.TL / 2, S.TW / 2 + 0.02), S.newBall(62, S.TL * 0.8, S.TW / 3)], 0.05 * k, 0.3 + 0.12 * k, sp));
  S.setTable('carom');
  SPINS.forEach((sp, k) => run([S.newBall(70, 0.7, 0.5), S.newBall(71, 1.6, 0.7), S.newBall(72, 2.2, 0.4)], 0.2 + 0.4 * k, 0.35 + 0.1 * k, sp));
  S.setTable('7');
  return fnv(JSON.stringify(rows));
}
/* what the build before F9 and F10 printed (56f7cf0) */
const LEVEL_PRINT = '7a3b9d34';
/* the sim rebuilt as it was: the old decay and the old rest */
const OLD_EDITS = [['const dw = spinA() * dt;', 'const dw = 8 * dt;'], ['if (b.wz !== 0) moving = true;', 'b.wz = 0;']];
const oldSim = (loadSim, missing) => loadSim(src => OLD_EDITS.reduce((s, [a, b]) => { if (!s.includes(a)) missing.push(a); return s.replace(a, b); }, src));
module.exports = { levelPrint, LEVEL_PRINT, oldSim, fnv };
