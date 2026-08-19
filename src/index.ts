import 'dotenv/config';

import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { pathToFileURL } from 'url';

import {
  Client,
  Collection,
  GatewayIntentBits,
  REST,
  Routes,
} from 'discord.js';

import { createApp } from './api/app.ts';
import {
  CONFIG,
  validateProductionConfig,
} from './config/index.ts';


/* =========================================================
   CONFIGURATION
========================================================= */

const PORT =
  CONFIG.PORT;

const PROJECT_ROOT =
  process.cwd();


/* =========================================================
   TYPES
========================================================= */

interface OmnixCommand {

  data: {

    name: string;

    toJSON():
      unknown;

  };

  execute(
    args: {
      client: Client;
      interaction: any;
    }
  ):
    Promise<void> | void;

}


/* =========================================================
   CONNEXION MONGODB
========================================================= */

async function connectDatabase():
  Promise<void> {

  const mongoUri =
    CONFIG.MONGO_URI;


  if (!mongoUri) {

    throw new Error(
      '[Database] MONGO_URI est manquante.'
    );

  }


  console.log(
    '[Database] Connexion à MongoDB...'
  );


  try {

    await mongoose.connect(
      mongoUri
    );


    console.log(
      '[Database] ✅ Connexion MongoDB établie.'
    );


  } catch (error) {

    console.error(
      '[Database] ❌ Échec de connexion :',
      error
    );

    throw error;

  }

}


/* =========================================================
   CHARGEMENT DES COMMANDES
========================================================= */

async function loadCommands(
  client: Client
): Promise<void> {

  const commandsPath =
    path.join(
      PROJECT_ROOT,
      'src',
      'bot',
      'commands'
    );


  console.log(
    `[Bot] Recherche des commandes : ${commandsPath}`
  );


  if (
    !fs.existsSync(
      commandsPath
    )
  ) {

    console.warn(
      '[Bot] ⚠️ Le dossier src/bot/commands est introuvable.'
    );

    return;

  }


  const files =
    fs
      .readdirSync(
        commandsPath
      )
      .filter(
        file =>
          file.endsWith('.ts') ||
          file.endsWith('.js')
      );


  let loaded = 0;


  for (
    const file
    of files
  ) {

    try {

      const filePath =
        path.join(
          commandsPath,
          file
        );


      const fileUrl =
        pathToFileURL(
          filePath
        ).href;


      const module =
        await import(
          fileUrl
        );


      const command =
        module.default ||
        module;


      if (
        command &&
        command.data &&
        typeof command.execute ===
          'function'
      ) {

        client.commands.set(
          command.data.name,
          command
        );


        loaded++;


        console.log(
          `[Bot] ✅ Commande chargée : /${command.data.name}`
        );


      } else {

        console.warn(
          `[Bot] ⚠️ Commande invalide : ${file}`
        );

      }


    } catch (error) {

      console.error(
        `[Bot] ❌ Impossible de charger ${file} :`,
        error
      );

    }

  }


  console.log(
    `[Bot] ${loaded}/${files.length} commandes chargées.`
  );

}


/* =========================================================
   CHARGEMENT DES EVENTS
========================================================= */

async function loadEvents(
  client: Client
): Promise<void> {

  const eventsPath =
    path.join(
      PROJECT_ROOT,
      'src',
      'bot',
      'events'
    );


  console.log(
    `[Bot] Recherche des événements : ${eventsPath}`
  );


  if (
    !fs.existsSync(
      eventsPath
    )
  ) {

    console.warn(
      '[Bot] ⚠️ Le dossier src/bot/events est introuvable.'
    );

    return;

  }


  const files =
    fs
      .readdirSync(
        eventsPath
      )
      .filter(
        file =>
          file.endsWith('.ts') ||
          file.endsWith('.js')
      );


  let loaded = 0;


  for (
    const file
    of files
  ) {

    try {

      const filePath =
        path.join(
          eventsPath,
          file
        );


      const fileUrl =
        pathToFileURL(
          filePath
        ).href;


      const module =
        await import(
          fileUrl
        );


      const event =
        module.default ||
        module;


      if (
        !event ||
        !event.name ||
        typeof event.execute !==
          'function'
      ) {

        console.warn(
          `[Bot] ⚠️ Événement invalide : ${file}`
        );

        continue;

      }


      if (
        event.once
      ) {

        client.once(
          event.name,
          (...args: any[]) =>
            event.execute(
              ...args
            )
        );


      } else {

        client.on(
          event.name,
          (...args: any[]) =>
            event.execute(
              ...args
            )
        );

      }


      loaded++;


      console.log(
        `[Bot] ✅ Event chargé : ${event.name}`
      );


    } catch (error) {

      console.error(
        `[Bot] ❌ Impossible de charger ${file} :`,
        error
      );

    }

  }


  console.log(
    `[Bot] ${loaded}/${files.length} événements chargés.`
  );

}


/* =========================================================
   SYNCHRONISATION COMMANDES
========================================================= */

async function registerSlashCommands(
  client: Client,
  token: string
): Promise<void> {

  const clientId =
    CONFIG.DISCORD.CLIENT_ID;


  if (!clientId) {

    console.error(
      '[Bot] ❌ DISCORD_CLIENT_ID manquant.'
    );

    return;

  }


  const commands =
    Array
      .from(
        client.commands.values()
      )
      .map(
        command =>
          command.data.toJSON()
      );


  console.log(
    `[Bot] Synchronisation de ${commands.length} commandes...`
  );


  /*
   * IMPORTANT :
   * Le token est explicitement fourni ici.
   */

  const rest =
    new REST({
      version: '10',
    }).setToken(
      token
    );


  try {

    await rest.put(
      Routes.applicationCommands(
        clientId
      ),
      {
        body:
          commands,
      }
    );


    console.log(
      '[Bot] ✅ Commandes slash synchronisées.'
    );


  } catch (error) {

    console.error(
      '[Bot] ❌ Erreur synchronisation slash commands :',
      error
    );

  }

}


/* =========================================================
   BOT DISCORD
========================================================= */

async function setupDiscordBot():
  Promise<Client | null> {

  if (
    process.env.START_BOT ===
    'false'
  ) {

    console.log(
      '[Bot] ℹ️ START_BOT=false → Bot désactivé.'
    );

    return null;

  }


  const token =
    CONFIG.DISCORD.TOKEN;


  if (!token) {

    console.error(
      '[Bot] ❌ Aucun token Discord configuré.'
    );

    return null;

  }


  console.log(
    '[Bot] Initialisation du client Discord...'
  );


  const client =
    new Client({

      intents: [

        GatewayIntentBits.Guilds,

        GatewayIntentBits.GuildMessages,

        GatewayIntentBits.MessageContent,

        GatewayIntentBits.GuildMembers,

      ],

    });


  /*
   * Collection des commandes
   */

  (
    client as Client & {
      commands:
        Collection<
          string,
          OmnixCommand
        >;
    }
  ).commands =
    new Collection();


  /*
   * Chargement
   */

  await loadCommands(
    client
  );

  await loadEvents(
    client
  );


  /*
   * READY
   */

  client.once(
    'ready',
    async () => {

      console.log('');
      console.log(
        '=========================================='
      );

      console.log(
        `[Bot] 🟢 Connecté : ${client.user?.tag}`
      );

      console.log(
        `[Bot] 🆔 ID : ${client.user?.id}`
      );

      console.log(
        `[Bot] 🏠 Serveurs : ${client.guilds.cache.size}`
      );

      console.log(
        `[Bot] ⚡ Commandes : ${client.commands.size}`
      );

      console.log(
        `[Bot] 📡 Ping : ${client.ws.ping} ms`
      );

      console.log(
        '=========================================='
      );

      console.log('');


      /*
       * Synchronisation des commandes
       *
       * Le token est bien transmis.
       */

      await registerSlashCommands(
        client,
        token
      );

    }
  );


  /*
   * INTERACTIONS
   */

  client.on(
    'interactionCreate',
    async interaction => {

      if (
        !interaction.isChatInputCommand()
      ) {

        return;

      }


      const command =
        client.commands.get(
          interaction.commandName
        );


      if (!command) {

        console.warn(
          `[Bot] Commande inconnue : /${interaction.commandName}`
        );

        return;

      }


      try {

        await command.execute({

          client,

          interaction,

        });


      } catch (error) {

        console.error(
          `[Bot] ❌ Erreur /${interaction.commandName} :`,
          error
        );


        try {

          if (
            interaction.replied ||
            interaction.deferred
          ) {

            await interaction.editReply({

              content:
                '❌ Une erreur est survenue lors de l’exécution de cette commande.',

            });


          } else {

            await interaction.reply({

              content:
                '❌ Une erreur est survenue lors de l’exécution de cette commande.',

              ephemeral:
                true,

            });

          }

        } catch {

          // Interaction déjà fermée.

        }

      }

    }
  );


  /*
   * LOGIN
   */

  try {

    console.log(
      '[Bot] 🔐 Connexion à Discord...'
    );


    await client.login(
      token
    );


    return client;


  } catch (error) {

    console.error(
      '[Bot] ❌ Échec de connexion Discord :',
      error
    );


    return null;

  }

}


/* =========================================================
   SERVEUR WEB
========================================================= */

async function setupWebServer() {

  console.log(
    '[API] Démarrage du serveur Web...'
  );


  const app =
    createApp();


  const server =
    app.listen(
      PORT,
      () => {

        const domain =
          CONFIG.DOMAIN ||
          `http://localhost:${PORT}`;


        console.log('');

        console.log(
          '=========================================='
        );

        console.log(
          '           OMNIX WEB SERVER'
        );

        console.log(
          '=========================================='
        );

        console.log(
          `[OMNIX] 🌐 Adresse : ${domain}`
        );

        console.log(
          `[OMNIX] 🏠 Accueil : ${domain}/`
        );

        console.log(
          `[OMNIX] 📊 Dashboard : ${domain}/dashboard`
        );

        console.log(
          `[OMNIX] 👑 Founder : ${domain}/founder`
        );

        console.log(
          `[OMNIX] 🤖 AI Dev : ${domain}/ai-dev`
        );

        console.log(
          `[OMNIX] ❤️ Health : ${domain}/health`
        );

        console.log(
          `[OMNIX] 📡 Status : ${domain}/api/status`
        );

        console.log(
          '=========================================='
        );

        console.log('');

      }
    );


  return {
    app,
    server,
  };

}


/* =========================================================
   ARRÊT PROPRE
========================================================= */

async function shutdown(
  signal: string
): Promise<void> {

  console.log(
    `[OMNIX] Réception de ${signal}. Arrêt...`
  );


  try {

    if (
      mongoose.connection.readyState
    ) {

      await mongoose.connection.close();

      console.log(
        '[Database] Connexion MongoDB fermée.'
      );

    }

  } catch (error) {

    console.error(
      '[Database] Erreur fermeture MongoDB :',
      error
    );

  }


  process.exit(0);

}


process.on(
  'SIGTERM',
  () =>
    shutdown(
      'SIGTERM'
    )
);

process.on(
  'SIGINT',
  () =>
    shutdown(
      'SIGINT'
    )
);


/* =========================================================
   ERREURS PROCESS
========================================================= */

process.on(
  'unhandledRejection',
  error => {

    console.error(
      '[Process] ❌ Unhandled Rejection :',
      error
    );

  }
);


process.on(
  'uncaughtException',
  error => {

    console.error(
      '[Process] ❌ Uncaught Exception :',
      error
    );

  }
);


/* =========================================================
   MAIN
========================================================= */

async function main():
  Promise<void> {

  console.log('');

  console.log(
    '=========================================='
  );

  console.log(
    '                 OMNIX'
  );

  console.log(
    '          LE ROBOT DE DEMAIN'
  );

  console.log(
    '=========================================='
  );

  console.log(
    `[System] Environnement : ${CONFIG.NODE_ENV}`
  );

  console.log(
    `[System] Port : ${PORT}`
  );

  console.log(
    `[System] Modèle IA : ${CONFIG.OPENROUTER.MODEL}`
  );

  console.log(
    `[System] Propriétaires configurés : ${CONFIG.OWNER_IDS.length}`
  );

  console.log(
    '=========================================='
  );

  console.log('');


  /*
   * Validation
   */

  validateProductionConfig();


  /*
   * MongoDB
   */

  await connectDatabase();


  /*
   * Express
   */

  const {
    app,
  } =
    await setupWebServer();


  /*
   * Discord
   */

  const client =
    await setupDiscordBot();


  /*
   * IMPORTANT :
   *
   * On donne maintenant le Client Discord
   * à Express.
   *
   * L'API /api/status peut donc récupérer :
   *
   * - serveurs
   * - membres
   * - commandes
   * - ping
   * - uptime
   */

  app.locals.omnix.discordClient =
    client;


  /*
   * LOG FINAL
   */

  console.log('');

  console.log(
    '=========================================='
  );

  console.log(
    '[OMNIX] ✅ Plateforme OMNIX opérationnelle.'
  );

  console.log(
    `[OMNIX] 🤖 Bot : ${
      client?.isReady()
        ? 'ONLINE'
        : 'OFFLINE'
    }`
  );

  console.log(
    `[OMNIX] 📊 API Status : /api/status`
  );

  console.log(
    '=========================================='
  );

  console.log('');

}


/* =========================================================
   LANCEMENT
========================================================= */

main()
  .catch(
    error => {

      console.error('');

      console.error(
        '[OMNIX] ❌ ERREUR FATALE AU DÉMARRAGE'
      );

      console.error(
        error
      );

      process.exit(1);

    }
  );