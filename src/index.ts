import 'dotenv/config';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { verifyJwt } from './api/routes/auth.routes';
import { client } from './bot/client';
import mongoose from 'mongoose';
import { loadCommands } from './bot/handlers/commandHandler';
import { loadBotEvents } from './loaders/eventLoader';
import app from './api/app';
import { CONFIG, validateProductionConfig } from './config/index';
import { User } from './models/User';
// ============================================================
// CONFIGURATION
// ============================================================
validateProductionConfig();
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
// Expose the SINGLE live Discord client to the HTTP/API layer.
(globalThis as any).omnixDiscordClient = client;
// ============================================================
// SERVEUR HTTP
// ============================================================
let httpServer: http.Server | null = null;
let socketServer: SocketIOServer | null = null;
let statsInterval: NodeJS.Timeout | null = null;

async function emitStats(io: SocketIOServer, socket?: any): Promise<void> {
  const guilds = client.guilds.cache.size;
  const members = [...client.guilds.cache.values()].reduce((n, g) => n + Number(g.memberCount || 0), 0);
  const ping = Number.isFinite(client.ws.ping) && client.ws.ping >= 0 ? Math.round(client.ws.ping) : null;
  const payload = { success: true, servers: guilds, guilds, members, commands: client.commands.size, ping, bot: { guildsCount: guilds, membersCount: members, commandsCount: client.commands.size, ping } };
  if (socket) socket.emit('stats:update', payload); else io.emit('stats:update', payload);
}
function startHttpServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      httpServer = http.createServer(app);
      socketServer = new SocketIOServer(httpServer, { cors: { origin: [CONFIG.CLIENT_URL, CONFIG.DOMAIN].filter(Boolean), credentials: true } });
      socketServer.use((socket, next) => {
        try {
          const raw = socket.handshake.headers.cookie || '';
          const match = raw.match(/(?:^|;\s*)jwt_token=([^;]+)/);
          const token = match ? decodeURIComponent(match[1]) : '';
          const user = token ? verifyJwt(token) : null;
          if (!user) return next(new Error('AUTH_REQUIRED'));
          (socket.data as any).user = user;
          return next();
        } catch { return next(new Error('AUTH_INVALID')); }
      });
      socketServer.on('connection', (socket) => { console.log(`[Socket.IO] ✓ Client connecté : ${socket.id}`); void emitStats(socketServer!, socket); });
      statsInterval = setInterval(() => { void emitStats(socketServer!); }, 15000);
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
    console.log('[MongoDB] ✓ Connexion réussie.');
    try {
      const cleanup = await User.updateMany({}, { $unset: { accessToken: '', refreshToken: '', tokenExpiresAt: '', licenses: '' } });
      if (cleanup.modifiedCount > 0) console.log(`[MongoDB] ✓ ${cleanup.modifiedCount} ancien(s) secret(s) OAuth supprimé(s).`);
    } catch (cleanupError) { console.warn('[MongoDB] Nettoyage OAuth legacy impossible :', cleanupError); }
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
  // SOCKET.IO
  // ----------------------------------------------------------
  try {
    if (statsInterval) { clearInterval(statsInterval); statsInterval = null; }
    if (socketServer) { await new Promise<void>((resolve) => socketServer!.close(() => resolve())); socketServer = null; }
  } catch (error) { console.error('[Socket.IO] Erreur fermeture :', error); }
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