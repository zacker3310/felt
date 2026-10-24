/* sim: loads the DOM-free sim region of index.html (between `// #region sim` and
   `// #endregion sim`) into a Node vm context. Physics, rules and CPU suites run against
   exactly the code the page runs. Names not defined yet come back undefined. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const NAMES = ['SIM_DT', 'BALL_R', 'TL', 'TW', 'MAX_V', 'HEAD_X', 'FOOT', 'MAX_SIM_T',
  'cushions', 'pockets', 'newBall', 'rack', 'speedOf', 'newTable', 'strike', 'stepTable', 'simulateShot',
  'newGame', 'legalTargets', 'judge', 'canPlace', 'placeCue', 'spot', 'rng', 'cpuShot', 'cpuSearch'];

function regionSource() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const a = html.indexOf('// #region sim'), b = html.indexOf('// #endregion sim');
  if (a < 0 || b < a) throw new Error('sim region markers missing from index.html');
  return html.slice(a, b);
}
function loadSim() {
  const ctx = vm.createContext({});
  const exp = NAMES.map(n => `${n}: typeof ${n} === 'undefined' ? undefined : ${n}`).join(',');
  vm.runInContext(regionSource() + `\n;globalThis.__sim = { ${exp} };`, ctx);
  return ctx.__sim;
}
module.exports = { loadSim, regionSource };
