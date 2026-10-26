/* sim: loads the DOM-free sim region of index.html (between `// #region sim` and
   `// #endregion sim`) into a Node vm context. Physics, rules and CPU suites run against
   exactly the code the page runs. Names not defined yet come back undefined. The region runs
   inside a function with the context's own builtins bound as locals: name lookups through a
   contextified global are about ten times slower, and the CPU suite simulates thousands of
   shots. Every name is a live getter: after setTable the table globals (TL, CUSH, POCKETS, ...)
   read the new values, so read them through the returned object, not a destructured copy. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const NAMES = ['SIM_DT', 'BALL_R', 'TL', 'TW', 'MAX_V', 'HEAD_X', 'FOOT', 'MAX_SIM_T',
  'cushions', 'pockets', 'CUSH', 'CUSHION_POLYS', 'POCKETS', 'POCKET_R', 'POCKET_AIM', 'POCKET_LIP', 'MU_SLIDE', 'powerFor', 'spinOf', 'energyOf', 'newBall', 'rack', 'speedOf', 'newTable', 'strike', 'stepTable', 'resultOf', 'simulateShot',
  'newGame', 'legalTargets', 'judge', 'canPlace', 'placeCue', 'spot', 'rng', 'cpuShot', 'cpuSearch',
  'CPU_LEVELS', 'setTable', 'TABLE', 'suggestAim', 'setPockets', 'POCKETS_STYLE',
  'BUMPERS', 'BUMPER_R', 'CUP_IN', 'CUP_R', 'CUP_LIP', 'B_MARK', 'B_BALLS', 'bumperStrikers', 'bumperFree', 'CPU_BUMPER',
  'BUMPER_SHAPE', 'BED_LINES', 'OCTA_F', 'OCTA_CUP_IN', 'CUSH_W', 'bumperBanks', 'suggestBumper',
  'onTable', 'copyGame', 'canDrop', 'scatter', 'newPractice', 'practiceJudge', 'addBall', 'removeBall', 'PRACTICE_SCATTER',
  'TRICKS', 'TRICK_SOLS', 'TRICK_ZONE', 'trickById', 'trickPoints', 'trickBalls', 'trickGame', 'trickJudge', 'trickStars', 'trickSol', 'CPU_MOUTH_N', 'RACK_GAP',
  'MU_ROLL', 'CUE_RATIO', 'CUSH_MU', 'RAIL_E', 'MOUTHS', 'CAROM_SIZE', 'CAROM_PHYS', 'C_CUE', 'C_RED', 'caromGame', 'caromCount', 'caromFree', 'caromTargets', 'judgeCarom', 'CPU_CAROM', 'suggestCarom', 'cMirror'];

function regionSource() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const a = html.indexOf('// #region sim'), b = html.indexOf('// #endregion sim');
  if (a < 0 || b < a) throw new Error('sim region markers missing from index.html');
  return html.slice(a, b);
}
function loadSim() {
  const ctx = vm.createContext({});
  const exp = NAMES.map(n => `get ${n}() { return typeof ${n} === 'undefined' ? undefined : ${n}; }`).join(',');
  const builtins = 'const { Math, Object, JSON, Number, Array } = globalThis;';
  vm.runInContext(`globalThis.__sim = (function () { 'use strict'; ${builtins}\n${regionSource()}\n;return { ${exp} }; })();`, ctx);
  return ctx.__sim;
}
module.exports = { loadSim, regionSource };
