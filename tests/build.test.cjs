const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

test('release build copies frontend assets but never publishes backend source', () => {
  execFileSync(process.execPath, ['scripts/build-static.cjs'], { cwd: root, stdio: 'pipe' });
  for (const item of [
    'index.html',
    'assets/app.css',
    'assets/icon.svg',
    'src/app.js',
    'src/subtitles.js',
    'manifest.webmanifest',
    'sw.js',
    'version.json'
  ]) {
    assert.ok(fs.statSync(path.join(dist, item)).isFile(), 'Missing public artifact: ' + item);
  }
  for (const item of ['backend', 'tests', 'userscript', 'Dockerfile', 'docker-compose.yml', 'package.json', '.github']) {
    assert.equal(fs.existsSync(path.join(dist, item)), false, 'Server-only item leaked into public artifact: ' + item);
  }
  const version = JSON.parse(fs.readFileSync(path.join(dist, 'version.json'), 'utf8'));
  assert.equal(version.version, JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version);
  assert.equal(version.offlineAiRequiresBackend, true);
});
