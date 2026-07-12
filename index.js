/**
 * ====================================================================
 * BOOTSTRAP DU PROJET (ETERNODES / TSX LAUNCHER)
 * Utilise l'outil "tsx" pour exécuter le TypeScript de manière fluide
 * et sans contrainte d'extension de fichier sur Node 24.
 * ====================================================================
 */

const { spawn } = require('child_process');

console.log('[System] Initialisation du lanceur d\'exécution TSX...');

// Lance la commande "npx tsx src/index.ts" et redirige les entrées/sorties vers la console d'Eternodes
const child = spawn('npx', ['tsx', 'src/index.ts'], {
  stdio: 'inherit',
  shell: true
});

child.on('exit', (code) => {
  if (code !== 0) {
    console.error(`[System Error] L'application s'est arrêtée avec le code d'erreur : ${code}`);
  }
  process.exit(code || 0);
});