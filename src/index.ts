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
      statsInterval = setInterval(() => { void emitStats(socketServer!); }, 60000);
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
let mongoRetryTimer: NodeJS.Timeout | null = null;
let mongoConnecting = false;

function getMongoUri(): string | undefined {
  return process.env.MONGODB_URI ?? process.env.MONGO_URI ?? CONFIG.MONGO_URI;
}

function describeMongoUri(uri: string): { host: string; database: string; authSource: string; source: string } {
  try {
    const parsed = new URL(uri);
    return {
      host: parsed.hostname || 'inconnu',
      database: parsed.pathname && parsed.pathname !== '/' ? decodeURIComponent(parsed.pathname.slice(1)) : 'non définie',
      authSource: parsed.searchParams.get('authSource') || 'non défini',
      source: process.env.MONGODB_URI ? 'MONGODB_URI' : process.env.MONGO_URI ? 'MONGO_URI' : 'CONFIG.MONGO_URI',
    };
  } catch {
    return { host: 'URI invalide', database: 'inconnue', authSource: 'inconnu', source: process.env.MONGODB_URI ? 'MONGODB_URI' : process.env.MONGO_URI ? 'MONGO_URI' : 'CONFIG.MONGO_URI' };
  }
}

function logMongoState(prefix = '[MongoDB]'): void {
  const states: Record<number, string> = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  console.log(`${prefix} État Mongoose : ${states[mongoose.connection.readyState] ?? 'unknown'}`);
}

// Mongoose peut sinon conserver des requêtes en mémoire pendant plusieurs secondes
// alors que la base est déjà connue comme indisponible. Les appels restent gérés par
// leurs propres try/catch et échouent rapidement au lieu de produire des timeouts opaques.
mongoose.set('bufferCommands', false);

mongoose.connection.on('connected', () => logMongoState());
mongoose.connection.on('disconnected', () => console.warn('[MongoDB] ⚠ Connexion perdue. Les fonctionnalités dépendantes de MongoDB sont temporairement indisponibles.'));
mongoose.connection.on('error', (error) => console.error('[MongoDB] ✗ Erreur de connexion :', error?.message || error));

async function connectDatabase(): Promise<void> {
  const mongoUri = getMongoUri();

  if (!mongoUri) {
    console.warn('[MongoDB] ✗ MONGODB_URI/MONGO_URI absent. MongoDB désactivé.');
    return;
  }

  if (mongoose.connection.readyState === 1 || mongoConnecting) return;

  const description = describeMongoUri(mongoUri);
  console.log(`[MongoDB] Cible : ${description.host}`);
  console.log(`[MongoDB] Base : ${description.database}`);
  console.log(`[MongoDB] authSource : ${description.authSource}`);
  console.log(`[MongoDB] Variable : ${description.source}`);

  mongoConnecting = true;

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      socketTimeoutMS: 20000,
      family: 4,
    });

    console.log('[MongoDB] ✓ Connexion réussie.');
    console.log('[MongoDB] ✓ Session OAuth serveur disponible pour le rafraîchissement du Dashboard.');

    if (mongoRetryTimer) {
      clearInterval(mongoRetryTimer);
      mongoRetryTimer = null;
    }
  } catch (error: any) {
    const message = String(error?.message || error);
    const isAuthError = /bad auth|authentication failed|authenticationfailure/i.test(message);
    console.error(`[MongoDB] ✗ Connexion impossible${isAuthError ? ' — authentification Atlas refusée' : ''} : ${message}`);
    if (isAuthError) {
      console.error('[MongoDB] Vérifie le Database User Atlas, son mot de passe, le cluster ciblé et l’URI réellement chargée par Render. Ne mets jamais le secret dans les logs.');
    } else {
      console.warn('[MongoDB] Vérifie également le DNS/SRV, l’IP Access List Atlas et l’état du cluster.');
    }
    console.warn('[MongoDB] OMNIX continue en mode dégradé. Nouvelle tentative dans 30 secondes.');

    if (!mongoRetryTimer) {
      mongoRetryTimer = setInterval(() => {
        if (mongoose.connection.readyState === 1) {
          clearInterval(mongoRetryTimer!);
          mongoRetryTimer = null;
          return;
        }
        void connectDatabase();
      }, 30000);
      mongoRetryTimer.unref?.();
    }
  } finally {
    mongoConnecting = false;
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
    if (mongoRetryTimer) { clearInterval(mongoRetryTimer); mongoRetryTimer = null; }
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
    console.error('[Process] ✗ Uncaught Exception :', error);
    // L'état du processus peut être incohérent après une exception non rattrapée.
    // On évite de laisser Render servir une instance potentiellement corrompue :
    // arrêt propre puis redémarrage par la plateforme.
    void shutdown('UNCAUGHT_EXCEPTION');
  }
);
process.on(
  'unhandledRejection',
  (reason) => {
    console.error('[Process] ✗ Unhandled Rejection :', reason);
    // Les événements Discord sont protégés par eventLoader. Si une Promise
    // échappe malgré tout à cette barrière, on traite le rejet comme fatal
    // plutôt que de continuer silencieusement dans un état inconnu.
    void shutdown('UNHANDLED_REJECTION');
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
    console.log(`[Bot] Événements : ${(client as any).omnixEventLoadStatus?.loaded ?? 0}/${(client as any).omnixEventLoadStatus?.discovered ?? 0}`);
    console.log(`[MongoDB] ${mongoose.connection.readyState === 1 ? '✓ Connectée' : '⚠ Indisponible — vérifie MONGODB_URI / identifiants'}`);
    console.log(
      '════════════════════════════════════'
    );
    const commandStatus: any = (client as any).omnixCommandLoadStatus || { loaded: client.commands?.size ?? 0, discovered: client.commands?.size ?? 0, degraded: false };
    const eventStatus: any = (client as any).omnixEventLoadStatus || { loaded: 0, discovered: 0, degraded: false };
    const overall = commandStatus.degraded || eventStatus.degraded || mongoose.connection.readyState !== 1 ? 'OMNIX DEGRADED' : 'OMNIX ONLINE';
    console.log(`             ${overall}`);
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
        (client as any).omnixCommandLoadStatus?.loaded ?? client.commands?.size ?? 0
      }/${(client as any).omnixCommandLoadStatus?.discovered ?? client.commands?.size ?? 0}`
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