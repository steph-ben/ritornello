import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

// La liste des fichiers gardés hors ligne (sw.js) doit suivre le dépôt :
// un fichier absent bloquerait toute mise à jour de l'app.
const swSource = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const listText = swSource.match(/const APP_FILES = \[([\s\S]*?)\];/)[1];
const appFiles = [...listText.matchAll(/'([^']+)'/g)].map(m => m[1]);
const root = new URL('../', import.meta.url);

test('every file listed in sw.js exists', () => {
  for (const file of appFiles.filter(f => f !== './')) {
    assert.ok(existsSync(new URL(file, root)), `${file} manque`);
  }
});

test('every module of the app is listed in sw.js', () => {
  const modules = readdirSync(root).filter(f => f.endsWith('.js') && f !== 'sw.js');
  for (const module of modules) assert.ok(appFiles.includes(module), `${module} absent de sw.js`);
});
