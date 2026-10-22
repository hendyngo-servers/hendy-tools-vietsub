const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('src/app.js', 'utf8');

test('frontend exposes built-in offline Vietsub tools without third-party API credential fields', () => {
  for (const marker of [
    'offlineBackendUrl',
    'checkOfflineBtn',
    'offlineSourceLanguage',
    'translateMissingBtn',
    'transcribeBtn',
    'burnVideoBtn',
    'KHÔNG CẦN API KEY'
  ]) assert.ok(html.includes(marker), 'Missing offline UI marker: ' + marker);
  for (const marker of [
    'function checkOfflineBackend()',
    'async function translateCues',
    'async function transcribeVideo()',
    'async function burnVideo()',
    '/api/translate-batch',
    '/api/transcribe',
    '/api/render'
  ]) assert.ok(app.includes(marker), 'Missing frontend function: ' + marker);
  assert.ok(!html.includes('id="apiKey"'), 'Third-party API key field must not be shown.');
  assert.ok(!html.includes('id="providerSelect"'), 'External provider selector must be removed.');
});


test('public deployment rejects stale localhost backend URL and gives secure setup guidance', () => {
  for (const marker of [
    'function isLoopbackHostname(hostname)',
    'function isLoopbackBackendUrl(value)',
    'isLoopbackBackendUrl(backendUrl)',
    'website workers.dev',
    'URL HTTPS công khai',
    'location.origin'
  ]) assert.ok(app.includes(marker), 'Missing backend connection safety behavior: ' + marker);
  assert.ok(html.includes('https://ten-backend.onrender.com'));
  assert.ok(html.includes('id="offlineBackendHint"'));
});
