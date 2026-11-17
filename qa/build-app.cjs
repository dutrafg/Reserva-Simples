// As partes compartilham o mesmo escopo fechado; a ordem explícita é o contrato do build.
const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const root = resolve(__dirname, '..');
const parts = [
  'src/core/bootstrap.js',
  'src/modules/calendar.js',
  'src/modules/budget.js',
  'src/modules/home-workspace.js',
  'src/modules/home.js',
  'src/modules/transactions.js',
  'src/modules/investments-goals-shared.js',
  'src/modules/goals.js',
  'src/modules/reports.js',
  'src/modules/insights.js',
  'src/modules/pdf.js',
  'src/modules/settings.js',
  'src/core/runtime.js'
];
const bundle = parts.map(path => readFileSync(resolve(root, path), 'utf8')).join('');
const target = resolve(root, 'app.js');
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== bundle) throw new Error('app.js desatualizado. Execute node qa/build-app.cjs antes do manifesto.');
} else writeFileSync(target, bundle);
