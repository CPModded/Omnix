'use strict';

/**
 * OMNIX production bootstrap for Eternodes.
 * The project is ESM at source level but the production compiler emits CommonJS
 * so the existing __dirname/require-based loaders remain compatible.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = __dirname;
const SRC_ENTRY = path.join(ROOT, 'src', 'index.ts');
const DIST_ENTRY = path.join(ROOT, 'dist', 'index.js');
const TSX_BIN = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

try {
  if (fs.existsSync(path.join(ROOT, 'dist', 'utils', 'fileLogger.js'))) {
    require(path.join(ROOT, 'dist', 'utils', 'fileLogger.js')).installFileLogger();
  }
  console.log('[System] Initialisation du point d’entrée OMNIX');
  if (fs.existsSync(DIST_ENTRY)) {
    console.log('[System] Build production détecté : lancement de dist/index.js');
    require(DIST_ENTRY);
  } else {
    if (!fs.existsSync(SRC_ENTRY)) throw new Error('src/index.ts introuvable. Archive Omnix incomplète.');
    if (!fs.existsSync(TSX_BIN)) throw new Error('tsx introuvable. Lance npm install avant le démarrage.');
    console.log('[System] Build absent : lancement de src/index.ts via tsx');
    run(process.execPath, [TSX_BIN, SRC_ENTRY]);
  }
} catch (error) {
  console.error('[System] ✗ Impossible de démarrer OMNIX :', error);
  process.exit(1);
}
