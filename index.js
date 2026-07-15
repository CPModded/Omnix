/**
 * ====================================================================
 * BOOTSTRAP AUTO-HEALING (ETERNODES / PTERODACTYL FORCE START)
 * Ce fichier agit comme un gestionnaire de processus parent (mini-PM2).
 * Si l'application crashe, il la relance automatiquement en 5s.
 * ====================================================================
 */

const { spawn } = require('child_process');

console.log('[System] Initialisation du gestionnaire de processus parent OMNIX...');

function startApplication() {
  console.log('[System] Démarrage de l\'application (npx tsx src/index.ts)...');

  // Lance le processus enfant (le bot)
  const child = spawn('npx', ['tsx', 'src/index.ts'], {
    stdio: 'inherit',
    shell: true
  });

  // Capture de l'événement d'arrêt ou de crash du processus enfant
  child.on('exit', (code) => {
    console.error(`[System Warning] 🚨 L'application OMNIX s'est arrêtée (Code de sortie : ${code})`);
    
    // Délai de sécurité de 5 secondes avant relancement pour éviter les boucles infinies ultra-rapides
    console.log('[System] Relancement automatique de la plateforme dans 5 secondes...');
    
    setTimeout(() => {
      startApplication(); // Relance dynamique du bot
    }, 5000);
  });
}

// Lancement initial de la plateforme
startApplication();