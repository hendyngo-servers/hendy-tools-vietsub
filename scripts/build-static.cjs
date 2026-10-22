'use strict';

const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const staticFiles = ['index.html', 'manifest.webmanifest', 'sw.js'];
const staticDirectories = ['assets', 'src'];

function assertFile(relativePath) {
  const target = path.join(dist, relativePath);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    throw new Error('Required publish file is missing: ' + relativePath);
  }
}
function copyEntry(relativePath) {
  fs.cpSync(path.join(root, relativePath), path.join(dist, relativePath), { recursive: true, force: true });
}

for (const relativePath of [...staticFiles, ...staticDirectories]) {
  if (!fs.existsSync(path.join(root, relativePath))) throw new Error('Required publish path is missing: ' + relativePath);
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const reference of ['assets/app.css', 'assets/icon.svg', 'src/subtitles.js', 'src/app.js', 'manifest.webmanifest']) {
  if (!html.includes(reference)) throw new Error('index.html does not reference required asset: ' + reference);
}
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
for (const file of staticFiles) copyEntry(file);
for (const directory of staticDirectories) copyEntry(directory);
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
fs.writeFileSync(path.join(dist, 'version.json'), JSON.stringify({
  name: pkg.name, version: pkg.version, builtAt: new Date().toISOString(),
  staticOnly: true, offlineAiRequiresBackend: true
}, null, 2) + '\n');
for (const forbidden of ['backend', 'tests', 'userscript', 'Dockerfile', 'docker-compose.yml', 'package.json', '.github']) {
  if (fs.existsSync(path.join(dist, forbidden))) throw new Error('Server-only path leaked into static artifact: ' + forbidden);
}
for (const required of ['index.html', 'assets/app.css', 'assets/icon.svg', 'src/app.js', 'src/subtitles.js', 'manifest.webmanifest', 'sw.js', 'version.json']) assertFile(required);
console.log('Static release artifact created at dist/ (server-only files excluded).');
