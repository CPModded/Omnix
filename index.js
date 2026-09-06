/**
 * OMNIX — Production entrypoint
 *
 * Exécute directement src/index.ts via tsx dans le même processus.
 * L'ancien bootstrap lançait un processus enfant puis le redémarrait
 * même lorsqu'il se terminait avec le code 0, ce qui provoquait une
 * boucle de démarrage sur Render/Eternodes.
 *
 * Le redémarrage doit être géré par l'hébergeur (Render/Pterodactyl),
 * pas par un second superviseur Node à l'intérieur du service.
 */

console.log('[System] Initialisation du point d\'entrée OMNIX...');

try {
  // tsx est une dépendance de production du projet.
  // Le hook CommonJS permet d'exécuter directement le fichier TypeScript
  // sans créer de processus enfant.
  require('tsx/cjs');
  console.log('[System] ✓ Runtime TypeScript tsx chargé.');
  require('./src/index.ts');
} catch (error) {
  console.error('[System] ✗ Impossible de démarrer OMNIX :', error);
  process.exitCode = 1;
}
