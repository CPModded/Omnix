/**
 * OMNIX — Production bootstrap
 *
 * IMPORTANT:
 * Do not use `npx tsx ...` here.
 * On Render/Eternodes with production installs, npm may omit
 * devDependencies. npx then tries to download tsx interactively,
 * which makes the service appear stuck at:
 *   "Need to install the following packages: tsx@..."
 *
 * tsx is therefore a production dependency and is launched directly
 * through the local Node installation, with shell=false.
 */

const { spawn } = require('child_process');

console.log('[System] Initialisation du gestionnaire de processus parent OMNIX...');

let restarting = false;

function startApplication() {
  console.log('[System] Démarrage de l\'application (local tsx src/index.ts)...');

  let tsxCli;

  try {
    tsxCli = require.resolve('tsx/cli');
  } catch (error) {
    console.error('[System] ✗ Le package tsx est introuvable dans node_modules.');
    console.error('[System] Vérifiez que tsx est bien dans "dependencies" et non uniquement dans "devDependencies".');
    console.error(error);
    process.exit(1);
  }

  const child = spawn(process.execPath, [tsxCli, 'src/index.ts'], {
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });

  child.on('error', (error) => {
    console.error('[System] ✗ Impossible de démarrer OMNIX :', error);
  });

  child.on('exit', (code, signal) => {
    if (restarting) return;
    restarting = true;

    console.error(
      `[System Warning] 🚨 L'application OMNIX s'est arrêtée (code=${code}, signal=${signal ?? 'none'}).`
    );

    if (code === 0) {
      console.log('[System] Arrêt normal détecté. Redémarrage dans 5 secondes...');
    } else {
      console.log('[System] Crash détecté. Redémarrage automatique dans 5 secondes...');
    }

    setTimeout(() => {
      restarting = false;
      startApplication();
    }, 5000);
  });
}

startApplication();
