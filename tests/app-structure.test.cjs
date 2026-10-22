const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');

test('all literal app selectors point to an existing HTML id', () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const selectors = [...app.matchAll(/\$\('#([^']+)'\)/g)].map((match) => match[1]);
  const missing = [...new Set(selectors.filter((id) => !ids.has(id)))];
  assert.deepEqual(missing, [], `Missing element IDs: ${missing.join(', ')}`);
});

test('page assets referenced by HTML exist in the release package', () => {
  for (const asset of ['assets/app.css', 'assets/icon.svg', 'src/subtitles.js', 'src/app.js', 'manifest.webmanifest', 'sw.js']) {
    assert.ok(fs.existsSync(path.join(root, asset)), `Missing asset: ${asset}`);
  }
});

test('application does not persist the current API key', () => {
  assert.doesNotMatch(app, /localStorage\.setItem\([^\n]*apiKey/i);
  assert.doesNotMatch(app, /apiKey\s*:\s*\$\('#apiKey'\)\.value/i);
});
