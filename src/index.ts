import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Partials,
} from 'discord.js';
import mongoose from 'mongoose';
import http from 'http';
import { loadCommands } from './bot/handlers/commandHandler.ts';
import { loadBotEvents } from './loaders/eventLoader.ts';
import { CONFIG } from './config/index.ts';
import app from './api/app.ts';
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
  3000
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
const httpServer = http.createServer(app);
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
// SERVEUR WEB
// ============================================================
async function startHttpServer(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(
      PORT,
      HOST,
      () => {
        httpServer.removeListener('error', reject);
        console.log('');
        console.log('════════════════════════════════════');
        console.log('           OMNIX WEB SERVER');
        console.log('════════════════════════════════════');
        console.log(`[Web] ✓ Serveur HTTP démarré.`);
        console.log(`[Web] ✓ Host : ${HOST}`);
        console.log(`[Web] ✓ Port : ${PORT}`);
        console.log('════════════════════════════════════');
        console.log('');
        resolve();
      }
    );
  });
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
    `[Bot] ✓ ${client.commands?.size ?? 0} commandes chargées en mémoire.`
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
// DISCORD LOGIN
// ============================================================
async function connectDiscord(): Promise<void> {
  console.log('');
  console.log(
    '[Discord] Connexion...'
  );
  await client.login(TOKEN);
}
// ============================================================
// INFORMATIONS BOT
// ============================================================
function printStartupInfo(): void {
  console.log('');
  console.log('════════════════════════════════════');
  console.log('              OMNIX');
  console.log('════════════════════════════════════');
  console.log(
    `[Bot] Environnement : ${
      process.env.NODE_ENV ?? 'development'
    }`
  );
  console.log(
    `[Bot] Port HTTP : ${PORT}`
  );
  console.log('════════════════════════════════════');
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
  try {
    await new Promise<void>((resolve) => {
      if (!httpServer.listening) {
        resolve();
        return;
      }
      httpServer.close(() => {
        console.log(
          '[Web] ✓ Serveur HTTP fermé.'
        );
        resolve();
      });
    });
  } catch (error) {
    console.error(
      '[Web] Erreur pendant la fermeture :',
      error
    );
  }
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
// ERREURS PROCESS
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
    printStartupInfo();
    /*
     * 1. Base de données
     */
    await connectDatabase();
    /*
     * 2. Serveur HTTP
     *
     * Render exige qu'un port soit ouvert.
     */
    await startHttpServer();
    /*
     * 3. Commandes Discord
     */
    await loadBotCommands();
    /*
     * 4. Événements Discord
     */
    await loadEvents();
    /*
     * 5. Connexion Discord
     */
    await connectDiscord();
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