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


test('direct Cloudflare deploy uses an existing root directory and a frontend-only asset allowlist', () => {
  const wrangler = JSON.parse(fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8'));
  const ignore = fs.readFileSync(path.join(root, '.assetsignore'), 'utf8');
  const version = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8'));
  assert.equal(wrangler.assets.directory, './dist');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.postinstall, 'node scripts/build-static.cjs', 'Cloudflare dependency install must create dist before Wrangler runs.');
  assert.ok(fs.existsSync(path.join(root, 'index.html')), 'Root frontend must exist for direct Wrangler deploy.');
  assert.equal(version.version, JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version);
  for (const entry of ['backend/', 'tests/', 'userscript/', 'scripts/', 'docs/', 'node_modules/', 'dist/', 'package.json', 'wrangler.jsonc', 'worker.js', '.assetsignore']) {
    assert.ok(ignore.split(/\r?\n/).includes(entry), 'Missing deployment exclusion: ' + entry);
  }
  for (const entry of ['!index.html', '!manifest.webmanifest', '!sw.js', '!version.json', '!assets/**', '!src/**']) {
    assert.ok(ignore.split(/\r?\n/).includes(entry), 'Missing public asset allowlist entry: ' + entry);
  }
});
