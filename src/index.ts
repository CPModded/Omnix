import 'dotenv/config';

import http from 'http';
import mongoose from 'mongoose';

import { Server as SocketIOServer } from 'socket.io';

import { CONFIG } from './config/index.ts';

import createApp from './api/app.ts';

import {
  client as discordClient,
} from './src/bot/client.ts';

import {
  loadCommands,
} from './bot/handlers/commandHandler.ts';

/*
 * Si ton loader d'événements existe sous un autre nom,
 * nous l'ajusterons ensuite.
 */
import {
  loadEvents,
} from './loaders/eventLoader.ts';

import {
  registerDiscordClient,
} from './api/routes/stats.routes.ts';

/* =========================================================
   CONFIGURATION
========================================================= */

const PORT = Number(
  process.env.PORT ||
  CONFIG.PORT ||
  3000
);

/* =========================================================
   EXPRESS
========================================================= */

const app =
  createApp();

/* =========================================================
   HTTP SERVER
========================================================= */

const httpServer =
  http.createServer(
    app
  );

/* =========================================================
   SOCKET.IO
========================================================= */

const io =
  new SocketIOServer(
    httpServer,
    {
      cors: {
        origin:
          process.env.CLIENT_URL ||
          true,

        credentials:
          true,
      },
    }
  );

/* =========================================================
   SOCKET.IO
========================================================= */

io.on(
  'connection',
  (socket) => {
    console.log(
      `[Socket.IO] Client connecté : ${socket.id}`
    );

    socket.on(
      'disconnect',
      (reason) => {
        console.log(
          `[Socket.IO] Client déconnecté : ${socket.id} | ${reason}`
        );
      }
    );
  }
);

/* =========================================================
   DISCORD CLIENT → STATS API
========================================================= */

/**
 * On transmet l'instance Discord UNIQUE
 * à l'API statistiques.
 *
 * Cette instance est exactement la même
 * que celle utilisée par le bot.
 */
registerDiscordClient(
  discordClient
);

/* =========================================================
   DISCORD READY
========================================================= */

discordClient.once(
  'ready',
  (readyClient) => {
    console.log(
      '================================================='
    );

    console.log(
      '                 OMNIX ONLINE'
    );

    console.log(
      '================================================='
    );

    console.log(
      `[Discord] Connecté en tant que ${readyClient.user.tag}`
    );

    console.log(
      `[Discord] ID : ${readyClient.user.id}`
    );

    console.log(
      `[Discord] Serveurs : ${readyClient.guilds.cache.size}`
    );

    /* -----------------------------------------------------
       MEMBRES
    ----------------------------------------------------- */

    let totalMembers = 0;

    for (
      const guild of
      readyClient.guilds.cache.values()
    ) {
      totalMembers +=
        guild.memberCount || 0;
    }

    console.log(
      `[Discord] Membres : ${totalMembers}`
    );

    /* -----------------------------------------------------
       PING
    ----------------------------------------------------- */

    console.log(
      `[Discord] Ping : ${readyClient.ws.ping} ms`
    );

    /* -----------------------------------------------------
       COMMANDES
    ----------------------------------------------------- */

    console.log(
      `[Discord] Commandes chargées : ${readyClient.commands.size}`
    );

    console.log(
      '================================================='
    );
  }
);

/* =========================================================
   DISCORD ERROR
========================================================= */

discordClient.on(
  'error',
  (error) => {
    console.error(
      '[Discord] Client error:',
      error
    );
  }
);

/* =========================================================
   DISCORD WARN
========================================================= */

discordClient.on(
  'warn',
  (message) => {
    console.warn(
      '[Discord] Warning:',
      message
    );
  }
);

/* =========================================================
   DISCORD INVALIDATED
========================================================= */

discordClient.on(
  'invalidated',
  () => {
    console.error(
      '[Discord] Session Discord invalidée.'
    );
  }
);

/* =========================================================
   MONGODB
========================================================= */

async function connectDatabase(): Promise<void> {
  const mongoUri =
    process.env.MONGO_URI ||
    (CONFIG as any).MONGO_URI;

  if (!mongoUri) {
    throw new Error(
      'MONGO_URI est manquant.'
    );
  }

  console.log(
    '[MongoDB] Connexion...'
  );

  await mongoose.connect(
    mongoUri,
    {
      serverSelectionTimeoutMS:
        10000,

      connectTimeoutMS:
        10000,
    }
  );

  console.log(
    '[MongoDB] Connecté.'
  );
}

/* =========================================================
   LOAD COMMANDS
========================================================= */

async function loadBotCommands(): Promise<void> {
  console.log(
    '[Bot] Initialisation du chargeur de commandes...'
  );

  const count =
    await loadCommands(
      discordClient
    );

  console.log(
    `[Bot] ${count} commandes slash chargées en mémoire.`
  );
}

/* =========================================================
  /* =========================================================
   LOAD EVENTS
========================================================= */

async function loadBotEvents(): Promise<void> {
  console.log(
    '[Bot] Initialisation du chargeur des événements...'
  );

  await loadEvents(discordClient);

  console.log(
    '[Bot] Événements Discord chargés.'
  );
}

/* =========================================================
   DISCORD LOGIN
========================================================= */

async function loginDiscord(): Promise<void> {
  const token =
    process.env.DISCORD_TOKEN ||
    (CONFIG as any).DISCORD?.TOKEN;

  if (!token) {
    throw new Error(
      'DISCORD_TOKEN est manquant.'
    );
  }

  console.log(
    '[Discord] Connexion...'
  );

  await discordClient.login(
    token
  );
}

/* =========================================================
   HTTP START
========================================================= */

function startHttpServer(): Promise<void> {
  return new Promise(
    (resolve, reject) => {
      httpServer.once(
        'error',
        reject
      );

      httpServer.listen(
        PORT,
        () => {
          console.log(
            `[HTTP] OMNIX écoute sur le port ${PORT}`
          );

          console.log(
            `[HTTP] Environment : ${
              process.env.NODE_ENV ||
              'development'
            }`
          );

          resolve();
        }
      );
    }
  );
}

/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

let shuttingDown =
  false;

async function shutdown(
  signal: string
): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown =
    true;

  console.log(
    `[SYSTEM] Arrêt demandé (${signal})...`
  );

  try {
    /* -----------------------------------------------------
       SOCKET.IO
    ----------------------------------------------------- */

    io.close();

    /* -----------------------------------------------------
       HTTP
    ----------------------------------------------------- */

    await new Promise<void>(
      (resolve) => {
        httpServer.close(
          () => resolve()
        );
      }
    );

    /* -----------------------------------------------------
       DISCORD
    ----------------------------------------------------- */

    if (
      discordClient.isReady()
    ) {
      discordClient.destroy();
    }

    /* -----------------------------------------------------
       MONGODB
    ----------------------------------------------------- */

    if (
      mongoose.connection
        .readyState !== 0
    ) {
      await mongoose.connection.close();
    }

    console.log(
      '[SYSTEM] OMNIX arrêté proprement.'
    );

    process.exit(0);
  } catch (error) {
    console.error(
      '[SYSTEM] Erreur pendant l’arrêt :',
      error
    );

    process.exit(1);
  }
}

/* =========================================================
   SIGNALS
========================================================= */

process.on(
  'SIGTERM',
  () => {
    void shutdown(
      'SIGTERM'
    );
  }
);

process.on(
  'SIGINT',
  () => {
    void shutdown(
      'SIGINT'
    );
  }
);

/* =========================================================
   UNHANDLED REJECTION
========================================================= */

process.on(
  'unhandledRejection',
  (reason) => {
    console.error(
      '[SYSTEM] Unhandled Rejection:',
      reason
    );
  }
);

/* =========================================================
   UNCAUGHT EXCEPTION
========================================================= */

process.on(
  'uncaughtException',
  (error) => {
    console.error(
      '[SYSTEM] Uncaught Exception:',
      error
    );

    void shutdown(
      'uncaughtException'
    );
  }
);

/* =========================================================
   START OMNIX
========================================================= */

async function start(): Promise<void> {
  try {
    console.log(
      '================================================='
    );

    console.log(
      '              STARTING OMNIX'
    );

    console.log(
      '================================================='
    );

    /* -----------------------------------------------------
       DATABASE
    ----------------------------------------------------- */

    await connectDatabase();

    /* -----------------------------------------------------
       COMMANDS
    ----------------------------------------------------- */

    await loadBotCommands();

    /* -----------------------------------------------------
       EVENTS
    ----------------------------------------------------- */

    await loadBotEvents();

    /* -----------------------------------------------------
       HTTP
    ----------------------------------------------------- */

    await startHttpServer();

    /* -----------------------------------------------------
       DISCORD
    ----------------------------------------------------- */

    await loginDiscord();

    console.log(
      '================================================='
    );

    console.log(
      '                 OMNIX READY'
    );

    console.log(
      '================================================='
    );
  } catch (error) {
    console.error(
      '================================================='
    );

    console.error(
      '[SYSTEM] Impossible de démarrer OMNIX.'
    );

    console.error(
      error
    );

    console.error(
      '================================================='
    );

    try {
      if (
        discordClient.isReady()
      ) {
        discordClient.destroy();
      }

      if (
        mongoose.connection
          .readyState !== 0
      ) {
        await mongoose.connection.close();
      }

      io.close();

      if (
        httpServer.listening
      ) {
        httpServer.close();
      }
    } catch {
      // Rien à faire.
    }

    process.exit(1);
  }
}

/* =========================================================
   BOOT
========================================================= */

void start();