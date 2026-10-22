'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const backend = fs.readFileSync('backend/server.js', 'utf8');
new vm.Script(backend, { filename: 'backend/server.js' });
for (const marker of [
  "app.get('/health'",
  "app.post('/api/translate'",
  "app.post('/api/render'",
  "LIBRETRANSLATE_URL",
  "ffmpeg",
  "LIMIT_FILE_SIZE"
]) {
  assert.ok(backend.includes(marker), 'Missing backend feature: ' + marker);
}
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert.ok(pkg.dependencies.express, 'Express dependency missing');
assert.ok(pkg.scripts.start, 'Backend start script missing');
console.log('Backend syntax and feature smoke checks passed.');
