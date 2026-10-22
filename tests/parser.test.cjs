const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (!scripts.length) throw new Error('No inline application script found');
for (const [, source] of scripts) new vm.Script(source, { filename: 'index.html:inline-script' });
for (const marker of ['function parse(text)', 'function ms(t)', 'function exportSrt(bi)', 'translate']) if (!html.includes(marker)) throw new Error('Missing expected feature: ' + marker);
console.log('HTML inline JavaScript syntax and feature smoke checks passed.');
