const fs = require('node:fs');
const html = fs.readFileSync('index.html', 'utf8');
if (!html.includes('function parse(text)')) throw new Error('parse() missing');
const match = html.match(/function ms\(t\)\{([\s\S]*?)\}\nfunction stamp/);
if (!match) throw new Error('timestamp parser body not found');
const fn = new Function('t', match[1]);
const cases = [['00:00:01,250',1250],['00:01:02.500',62500],['01:02:03,004',3723004]];
for (const [input, expected] of cases) { const actual = fn(input); if (actual !== expected) throw new Error(input + ': expected ' + expected + ', got ' + actual); }
console.log('timestamp parser smoke tests passed:', cases.length);
