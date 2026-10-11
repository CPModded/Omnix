const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const missing = Object.keys(pkg.dependencies || {}).filter((name) => {
  try { require.resolve(name, { paths: [root] }); return false; }
  catch { return true; }
});
if (!missing.length) {
  console.log('[Deps] Dépendances de production présentes.');
  process.exit(0);
}
console.log(`[Deps] Dépendances manquantes (${missing.join(', ')}). Installation des dépendances de production…`);
const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: root, stdio: 'inherit' });
if (result.error) { console.error('[Deps] Impossible de lancer npm install:', result.error.message); process.exit(1); }
if (result.status !== 0) process.exit(result.status || 1);
const stillMissing = Object.keys(pkg.dependencies || {}).filter((name) => {
  try { require.resolve(name, { paths: [root] }); return false; }
  catch { return true; }
});
if (stillMissing.length) { console.error(`[Deps] Installation incomplète : ${stillMissing.join(', ')}`); process.exit(1); }
console.log('[Deps] Dépendances de production installées.');
