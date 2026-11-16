const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const version = JSON.parse(readFileSync(resolve(root, 'version.json'), 'utf8')).version;
const files = ['index.html', 'app.js', 'engines.js', 'manifest.webmanifest', 'version.json', 'sw.js'];
const assets = Object.fromEntries(files.map(file => [
  './' + file,
  createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex')
]));
const metadata = JSON.stringify({ format: 1, version, assets }, null, 2) + '\n';
const target = resolve(root, 'integrity-manifest.json');
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== metadata) {
    throw new Error('Manifesto de integridade desatualizado. Execute node qa/integrity-manifest.cjs.');
  }
} else {
  writeFileSync(target, metadata);
}
