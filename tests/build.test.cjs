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

test('direct Cloudflare deploy creates dist during the bun install lifecycle', () => {
  const wrangler = JSON.parse(fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8'));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const buildScript = fs.readFileSync(path.join(root, 'scripts/build-static.cjs'), 'utf8');
  assert.equal(wrangler.assets.directory, './dist');
  assert.equal(pkg.scripts.postinstall, 'node scripts/build-static.cjs',
    'Cloudflare bun install must create dist before npx wrangler deploy runs.');
  assert.ok(buildScript.includes("const staticFiles = ['index.html', 'manifest.webmanifest', 'sw.js']"));
  assert.ok(buildScript.includes("const staticDirectories = ['assets', 'src']"));
  execFileSync(process.execPath, ['scripts/build-static.cjs'], { cwd: root, stdio: 'pipe' });
  assert.ok(fs.statSync(path.join(dist, 'index.html')).isFile(),
    'Configured Wrangler asset directory must exist before the deploy command executes.');
});
