import 'dotenv/config';
import http from 'http';
import {
  Client,
  GatewayIntentBits,
  Partials,
} from 'discord.js';
import mongoose from 'mongoose';
import { loadCommands } from './bot/handlers/commandHandler.ts';
import { loadBotEvents } from './loaders/eventLoader.ts';
import app from './api/app.ts';
import { CONFIG } from './config/index.ts';
// ============================================================
// CONFIGURATION
// ============================================================
const TOKEN =
  process.env.DISCORD_TOKEN ??
  CONFIG.DISCORD?.TOKEN;
if (!TOKEN) {
  throw new Error(
    '[Discord] DISCORD_TOKEN est manquant.'
  );
}
const PORT = Number(
  process.env.PORT ??
  CONFIG.PORT ??
  10000
);
const HOST = '0.0.0.0';
// ============================================================
// CLIENT DISCORD
// ============================================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.Reaction,
    Partials.User,
    Partials.GuildMember,
  ],
});
// ============================================================
// SERVEUR HTTP
// ============================================================
let httpServer: http.Server | null = null;
function startHttpServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      httpServer = http.createServer(app);
      httpServer.once('error', (error) => {
        console.error(
          '[Web] ✗ Erreur serveur HTTP :',
          error
        );
        reject(error);
      });
      httpServer.listen(
        PORT,
        HOST,
        () => {
          console.log('');
          console.log(
            '════════════════════════════════════'
          );
          console.log(
            '             OMNIX WEB'
          );
          console.log(
            '════════════════════════════════════'
          );
          console.log(
            `[Web] ✓ Serveur HTTP démarré.`
          );
          console.log(
            `[Web] ✓ Host : ${HOST}`
          );
          console.log(
            `[Web] ✓ Port : ${PORT}`
          );
          console.log(
            `[Web] ✓ Health : http://${HOST}:${PORT}/health`
          );
          console.log(
            '════════════════════════════════════'
          );
          console.log('');
          resolve();
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}
// ============================================================
// MONGODB
// ============================================================
async function connectDatabase(): Promise<void> {
  const mongoUri =
    process.env.MONGO_URI ??
    CONFIG.MONGO_URI;
  if (!mongoUri) {
    console.warn(
      '[MongoDB] MONGO_URI absent. MongoDB désactivé.'
    );
    return;
  }
  try {
    await mongoose.connect(mongoUri);
    console.log(
      '[MongoDB] ✓ Connexion réussie.'
    );
  } catch (error) {
    console.error(
      '[MongoDB] ✗ Erreur de connexion :',
      error
    );
    throw error;
  }
}
// ============================================================
// COMMANDES
// ============================================================
async function loadBotCommands(): Promise<void> {
  console.log('');
  console.log(
    '[Bot] Chargement des commandes...'
  );
  await loadCommands(client);
  console.log(
    `[Bot] ✓ ${
      client.commands?.size ?? 0
    } commandes chargées en mémoire.`
  );
}
// ============================================================
// ÉVÉNEMENTS
// ============================================================
async function loadEvents(): Promise<void> {
  console.log('');
  console.log(
    '[Bot] Initialisation du chargeur des événements...'
  );
  await loadBotEvents(client);
  console.log(
    '[Bot] ✓ Événements Discord chargés.'
  );
}
// ============================================================
// DISCORD
// ============================================================
async function connectDiscord(): Promise<void> {
  console.log('');
  console.log(
    '[Discord] Connexion...'
  );
  await client.login(TOKEN);
}
// ============================================================
// INFORMATIONS
// ============================================================
function printStartupInfo(): void {
  console.log('');
  console.log(
    '════════════════════════════════════'
  );
  console.log(
    '              OMNIX'
  );
  console.log(
    '════════════════════════════════════'
  );
  console.log(
    `[Bot] Environnement : ${
      process.env.NODE_ENV ?? 'development'
    }`
  );
  console.log(
    `[Bot] Port HTTP : ${PORT}`
  );
  console.log(
    `[Bot] Host HTTP : ${HOST}`
  );
  console.log(
    '════════════════════════════════════'
  );
  console.log('');
}
// ============================================================
// ARRÊT PROPRE
// ============================================================
let shuttingDown = false;
async function shutdown(
  signal: string
): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log('');
  console.log(
    `[Process] Signal ${signal} reçu. Arrêt d'OMNIX...`
  );
  // ----------------------------------------------------------
  // HTTP
  // ----------------------------------------------------------
  try {
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer?.close(() => {
          console.log(
            '[Web] ✓ Serveur HTTP fermé.'
          );
          resolve();
        });
      });
    }
  } catch (error) {
    console.error(
      '[Web] Erreur pendant la fermeture :',
      error
    );
  }
  // ----------------------------------------------------------
  // DISCORD
  // ----------------------------------------------------------
  try {
    if (client.isReady()) {
      client.destroy();
      console.log(
        '[Discord] ✓ Client Discord fermé.'
      );
    }
  } catch (error) {
    console.error(
      '[Discord] Erreur pendant la fermeture :',
      error
    );
  }
  // ----------------------------------------------------------
  // MONGODB
  // ----------------------------------------------------------
  try {
    if (
      mongoose.connection.readyState !== 0
    ) {
      await mongoose.connection.close();
      console.log(
        '[MongoDB] ✓ Connexion fermée.'
      );
    }
  } catch (error) {
    console.error(
      '[MongoDB] Erreur pendant la fermeture :',
      error
    );
  }
  console.log(
    '[Process] ✓ OMNIX arrêté proprement.'
  );
  process.exit(0);
}
// ============================================================
// SIGNAUX
// ============================================================
process.on(
  'SIGINT',
  () => {
    void shutdown('SIGINT');
  }
);
process.on(
  'SIGTERM',
  () => {
    void shutdown('SIGTERM');
  }
);
// ============================================================
// ERREURS PROCESS
// ============================================================
process.on(
  'uncaughtException',
  (error) => {
    console.error(
      '[Process] Uncaught Exception :',
      error
    );
  }
);
process.on(
  'unhandledRejection',
  (reason) => {
    console.error(
      '[Process] Unhandled Rejection :',
      reason
    );
  }
);
// ============================================================
// DÉMARRAGE
// ============================================================
async function start(): Promise<void> {
  try {
    // --------------------------------------------------------
    // 1. INFORMATIONS
    // --------------------------------------------------------
    printStartupInfo();
    // --------------------------------------------------------
    // 2. SERVEUR WEB
    // --------------------------------------------------------
    //
    // On démarre Express AVANT Discord.
    //
    // Render pourra donc détecter immédiatement :
    //
    // 0.0.0.0:PORT
    //
    await startHttpServer();
    // --------------------------------------------------------
    // 3. MONGODB
    // --------------------------------------------------------
    await connectDatabase();
    // --------------------------------------------------------
    // 4. COMMANDES
    // --------------------------------------------------------
    await loadBotCommands();
    // --------------------------------------------------------
    // 5. ÉVÉNEMENTS
    // --------------------------------------------------------
    await loadEvents();
    // --------------------------------------------------------
    // 6. DISCORD
    // --------------------------------------------------------
    await connectDiscord();
    // --------------------------------------------------------
    // 7. ONLINE
    // --------------------------------------------------------
    console.log('');
    console.log(
      '════════════════════════════════════'
    );
    console.log(
      '             OMNIX ONLINE'
    );
    console.log(
      '════════════════════════════════════'
    );
    console.log(
      `[Web] ✓ http://0.0.0.0:${PORT}`
    );
    console.log(
      `[Discord] ✓ Bot connecté`
    );
    console.log(
      `[Discord] ✓ Serveurs : ${
        client.guilds.cache.size
      }`
    );
    console.log(
      `[Discord] ✓ Commandes : ${
        client.commands?.size ?? 0
      }`
    );
    console.log(
      '════════════════════════════════════'
    );
    console.log('');
  } catch (error) {
    console.error('');
    console.error(
      '════════════════════════════════════'
    );
    console.error(
      '[FATAL] Impossible de démarrer OMNIX.'
    );
    console.error(error);
    console.error(
      '════════════════════════════════════'
    );
    process.exit(1);
  }
}
// ============================================================
// START
// ============================================================
void start();