#!/usr/bin/env node
/* lint: extracts <script id="game"> from index.html to a temp .js file and runs ESLint over it.
   Names unused inside the script but referenced from the test suites are reported as
   "external", not as findings. Exit 1 when any real finding remains. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ESLint } = require('eslint');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const OPEN = '<script id="game">';
const a = html.indexOf(OPEN), b = html.indexOf('</script>', a);
if (a < 0 || b < 0) { console.error('lint: no <script id="game"> found'); process.exit(2); }
const lineOffset = html.slice(0, a + OPEN.length).split('\n').length - 1;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'felt-lint-'));
const tmp = path.join(dir, 'game.js');
fs.writeFileSync(tmp, html.slice(a + OPEN.length, b));

const external = new Set();
for (const f of fs.readdirSync(__dirname)) {
  if (!f.endsWith('-check.cjs')) continue;
  for (const m of fs.readFileSync(path.join(__dirname, f), 'utf8').matchAll(/[A-Za-z_$][\w$]*/g)) external.add(m[0]);
}

(async () => {
  const eslint = new ESLint({ cwd: dir, overrideConfigFile: path.join(ROOT, 'eslint.config.js') });
  const [result] = await eslint.lintFiles([tmp]);
  const findings = [];
  let ext = 0;
  for (const m of result.messages) {
    const name = (m.message.match(/'([^']+)'/) || [])[1];
    if (m.ruleId === 'no-unused-vars' && name && external.has(name)) { ext++; continue; }
    findings.push(`index.html:${m.line + lineOffset}:${m.column}  ${m.ruleId}  ${m.message}`);
  }
  for (const f of findings) console.log(f);
  console.log(`\n${findings.length} finding(s), ${ext} external-only name(s)`);
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(findings.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
