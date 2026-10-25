/* Dev-only ESLint flat config for the game script in index.html (tests/lint.cjs extracts it).
   Browser globals are listed by hand; every element id is a global too, since the game
   addresses elements by id. Script tag ids are not. */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const ids = {};
for (const m of html.matchAll(/<(\w+)[^>]*\sid="([A-Za-z_$][\w$]*)"/g)) if (m[1] !== 'script') ids[m[2]] = 'readonly';

const browser = {};
for (const g of [
  'window', 'document', 'navigator', 'location', 'localStorage', 'console', 'setTimeout', 'clearTimeout',
  'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'URLSearchParams', 'AudioContext',
  'webkitAudioContext', 'matchMedia', 'getComputedStyle', 'devicePixelRatio', 'innerWidth', 'innerHeight',
  'addEventListener', 'removeEventListener', 'ImageData', 'ResizeObserver', 'visualViewport', 'screen',
]) browser[g] = 'readonly';

module.exports = [
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: { ...browser, ...ids } },
    rules: {
      'no-unused-vars': ['warn', { vars: 'all', args: 'none', caughtErrors: 'none' }],
      'no-undef': 'warn',
      'no-redeclare': 'warn',
      'no-dupe-keys': 'warn',
      'no-unreachable': 'warn',
      'no-duplicate-case': 'warn',
      'no-self-assign': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      eqeqeq: ['warn', 'smart'],
    },
  },
];
