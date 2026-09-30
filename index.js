'use strict';

/**
 * OMNIX production bootstrap
 * Designed for Eternodes: no console commands required.
 * On first boot it installs production dependencies automatically,
 * then launches the TypeScript entrypoint through the local tsx binary.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = __dirname;
const SRC_ENTRY = path.join(ROOT, 'src', 'index.ts');
const NODE_MODULES = path.join(ROOT, 'node_modules');
const TSX_BIN = path.join(NODE_MODULES, '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const DIST_ENTRY = path.join(ROOT, 'dist', 'index.js');

function log(message) {
  console.log(`[System] ${message}`);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

function dependenciesReady() {
  try {
    require.resolve('discord.js', { paths: [ROOT] });
    return fs.existsSync(TSX_BIN);
  } catch {
    return false;
  }
}

try {
  log('Initialisation du point d’entrée OMNIX');
  log('Profil Eternodes : 2 GiB RAM / 1 cœur CPU disponible');

  if (!dependenciesReady()) {
    log('Dépendances absentes ou incomplètes : installation automatique en cours...');
    run(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
      'install', '--omit=dev', '--no-audit', '--no-fund', '--prefer-offline'
    ]);
  }

  // Prefer a compiled build when present; otherwise launch TS directly.
  if (fs.existsSync(DIST_ENTRY)) {
    log('Build production détecté : lancement de dist/index.js');
    require(DIST_ENTRY);
  } else {
    if (!fs.existsSync(SRC_ENTRY)) {
      throw new Error('src/index.ts introuvable. Archive Omnix incomplète.');
    }
    if (!fs.existsSync(TSX_BIN)) {
      throw new Error('tsx introuvable après installation automatique.');
    }
    log('Build absent : lancement direct de src/index.ts via tsx');
    run(process.execPath, [TSX_BIN, SRC_ENTRY]);
  }
} catch (error) {
  console.error('[System] ✗ Impossible de démarrer OMNIX :', error);
  process.exit(1);
}
