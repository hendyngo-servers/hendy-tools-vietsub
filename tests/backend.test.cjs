const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const backend = fs.readFileSync('backend/server.js', 'utf8');
new vm.Script(backend, { filename: 'backend/server.js' });
const worker = fs.readFileSync('backend/offline_worker.py', 'utf8');
const docker = fs.readFileSync('Dockerfile', 'utf8');
const installer = fs.readFileSync('backend/install_models.py', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

test('backend includes offline translation, speech transcription and hard subtitle rendering', () => {
  for (const marker of [
    "app.get('/health'",
    "app.post('/api/translate'",
    "app.post('/api/translate-batch'",
    "app.post('/api/transcribe'",
    "app.post('/api/render'",
    'externalTranslationApiRequired: false',
    'callWorker'
  ]) assert.ok(backend.includes(marker), 'Missing backend feature: ' + marker);
});

test('offline worker uses local Argos and Whisper models, without third-party translation keys', () => {
  for (const marker of ['argostranslate.translate', 'faster_whisper', 'translate_text', 'def transcribe']) {
    assert.ok(worker.includes(marker), 'Missing offline worker feature: ' + marker);
  }
  assert.ok(!backend.includes('LIBRETRANSLATE_URL'));
  assert.ok(!backend.includes('LIBRETRANSLATE_API_KEY'));
  assert.ok(docker.includes('backend/install_models.py'));
  assert.ok(pkg.dependencies.express);
  assert.ok(pkg.scripts.start);
});


test('release Docker build downloads verified model packages from the official Argos model host', () => {
  assert.ok(installer.includes('BASE = "https://argos-net.com/v1/"'));
  for (const model of [
    'translate-en_vi-1_9.argosmodel',
    'translate-ja_en-1_1.argosmodel',
    'translate-ko_en-1_1.argosmodel',
    'translate-zh_en-1_9.argosmodel',
    'translate-fr_en-1_9.argosmodel',
    'translate-de_en-1_3.argosmodel',
    'translate-id_en-1_9.argosmodel',
    'translate-it_en-1_0.argosmodel',
    'translate-fi_en-1_9.argosmodel',
    'translate-hi_en-1_1.argosmodel'
  ]) assert.ok(installer.includes(model), 'Missing bundled model: ' + model);
  assert.ok(installer.includes('zipfile.is_zipfile'));
  assert.ok(installer.includes('model.bin'));
  assert.ok(worker.includes('SUPPORTED = {"en", "ja", "ko", "zh", "fr", "de", "id", "it", "fi", "hi"}'));
});
