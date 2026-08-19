import 'dotenv/config';

import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { pathToFileURL } from 'url';
import express from 'express';
import jwt from 'jsonwebtoken';

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

import { User } from './models/User.ts';


/* =========================================================
   CONFIGURATION
========================================================= */

const PORT = CONFIG.PORT;
const PROJECT_ROOT = process.cwd();


/* =========================================================
   TYPES
========================================================= */

interface OmnixCommand {

  data: {
    name: string;
    toJSON(): unknown;
  };

  execute(args: {
    client: Client;
    interaction: any;
  }): Promise<void> | void;
}


interface OmnixClient extends Client {

  commands: Collection<
    string,
    OmnixCommand
  >;

}


/* =========================================================
   CONNEXION MONGODB
========================================================= */

async function connectDatabase(): Promise<void> {

  const mongoUri = CONFIG.MONGO_URI;

  if (!mongoUri) {

    throw new Error(
      '[Database] MONGODB_URI / MONGO_URI est manquante.'
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
   SERVEUR EXPRESS
========================================================= */

async function setupWebServer() {

  console.log(
    '[API] Démarrage du serveur Web...'
  );

  const app = createApp();


  /*
   * =======================================================
   * ROUTE /api/guilds
   *
   * Le Dashboard utilise :
   *
   * GET /api/guilds
   *
   * avec :
   *
   * Authorization: Bearer JWT
   * =======================================================
   */

  app.get(
    '/api/guilds',
    async (req, res) => {

      try {

        const authorization =
          req.headers.authorization;


        /*
         * Vérification du header
         */

        if (
          !authorization ||
          !authorization.startsWith('Bearer ')
        ) {

          return res.status(401).json({
            error:
              'Token d’authentification manquant.',
          });

        }


        const token =
          authorization
            .substring(7)
            .trim();


        if (!token) {

          return res.status(401).json({
            error:
              'Token d’authentification vide.',
          });

        }


        /*
         * Vérification JWT
         */

        const jwtSecret =
          CONFIG.JWT_SECRET;


        if (!jwtSecret) {

          console.error(
            '[API /guilds] JWT_SECRET manquant.'
          );

          return res.status(500).json({
            error:
              'Configuration JWT manquante.',
          });

        }


        let payload: any;


        try {

          payload =
            jwt.verify(
              token,
              jwtSecret
            );

        } catch (error) {

          return res.status(401).json({
            error:
              'Session invalide ou expirée.',
          });

        }


        /*
         * Vérification de l'identité Discord
         */

        if (!payload?.discordId) {

          return res.status(401).json({
            error:
              'Identifiant Discord absent du token.',
          });

        }


        /*
         * Recherche de l'utilisateur
         */

        const user =
          await User
            .findOne({
              discordId:
                payload.discordId,
            })
            .lean();


        if (!user) {

          return res.status(404).json({
            error:
              'Utilisateur OMNIX introuvable.',
          });

        }


        /*
         * Récupération des serveurs
         */

        const guilds =
          Array.isArray(
            (user as any).guilds
          )
            ? (user as any).guilds
            : [];


        /*
         * Sécurité :
         *
         * On ne retourne que les données
         * appartenant à cet utilisateur.
         */

        return res.json(
          guilds
        );

      } catch (error) {

        console.error(
          '[API /guilds] ❌ Erreur :',
          error
        );

        return res.status(500).json({
          error:
            'Erreur interne lors du chargement des serveurs.',
        });

      }

    }
  );


  /*
   * =======================================================
   * DÉMARRAGE EXPRESS
   * =======================================================
   */

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
          '             OMNIX WEB SERVER'
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
          '=========================================='
        );

        console.log('');

      }
    );


  return server;
}


/* =========================================================
   CHARGEMENT DES COMMANDES
========================================================= */

async function loadCommands(
  client: OmnixClient
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


  if (!fs.existsSync(commandsPath)) {

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


  for (const file of files) {

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
        typeof command.execute === 'function'
      ) {

        client.commands.set(
          command.data.name,
          command as OmnixCommand
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
  client: OmnixClient
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


  if (!fs.existsSync(eventsPath)) {

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


  for (const file of files) {

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
        typeof event.execute !== 'function'
      ) {

        console.warn(
          `[Bot] ⚠️ Événement invalide : ${file}`
        );

        continue;
      }


      /*
       * IMPORTANT
       *
       * On ignore volontairement les événements
       * "ready" qui tentent d'enregistrer les
       * commandes eux-mêmes.
       *
       * La synchronisation est gérée ici,
       * dans index.ts.
       */

      if (
        event.name === 'ready' ||
        event.name === 'clientReady'
      ) {

        console.log(
          `[Bot] ℹ️ Event ${event.name} ignoré par le chargeur central.`
        );

        continue;
      }


      if (event.once) {

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
   SYNCHRONISATION DES COMMANDES DISCORD
========================================================= */

async function registerSlashCommands(
  client: OmnixClient,
  token: string
): Promise<void> {

  /*
   * Vérification ABSOLUE du token
   */

  if (
    !token ||
    typeof token !== 'string' ||
    token.trim().length === 0
  ) {

    console.error(
      '[Bot] ❌ Impossible de synchroniser les commandes : token Discord absent.'
    );

    return;
  }


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
   * REST Discord avec token explicitement défini
   */

  const rest =
    new REST({
      version: '10',
    });


  rest.setToken(
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
      `[Bot] ✅ ${commands.length} commandes slash synchronisées.`
    );

  } catch (error) {

    console.error(
      '[Bot] ❌ Erreur synchronisation slash commands :',
      error
    );

  }
}


/* =========================================================
   CONFIGURATION DU BOT DISCORD
========================================================= */

async function setupDiscordBot(): Promise<OmnixClient | null> {

  /*
   * START_BOT=false
   */

  if (
    process.env.START_BOT === 'false'
  ) {

    console.log(
      '[Bot] ℹ️ START_BOT=false → Bot désactivé.'
    );

    return null;
  }


  /*
   * Token Discord
   */

  const token =
    CONFIG.DISCORD.TOKEN;


  if (
    !token ||
    token.trim().length === 0
  ) {

    console.error(
      '[Bot] ❌ Aucun token Discord configuré.'
    );

    console.error(
      '[Bot] Configure DISCORD_TOKEN / DISCORD_BOT_TOKEN dans les variables d’environnement.'
    );

    return null;
  }


  console.log(
    '[Bot] Initialisation du client Discord...'
  );


  /*
   * Client Discord
   */

  const client =
    new Client({

      intents: [

        GatewayIntentBits.Guilds,

        GatewayIntentBits.GuildMessages,

        GatewayIntentBits.MessageContent,

        GatewayIntentBits.GuildMembers,

      ],

    }) as OmnixClient;


  /*
   * Collection des commandes
   */

  client.commands =
    new Collection<
      string,
      OmnixCommand
    >();


  /*
   * Chargement commandes
   */

  await loadCommands(
    client
  );


  /*
   * Chargement events
   */

  await loadEvents(
    client
  );


  /*
   * READY CENTRAL
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
        '=========================================='
      );

      console.log('');


      /*
       * Synchronisation UNIQUEMENT après
       * connexion réussie à Discord.
       */

      await registerSlashCommands(
        client,
        token
      );

    }
  );


  /*
   * =======================================================
   * INTERACTIONS SLASH
   * =======================================================
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

              ephemeral: true,

            });

          }

        } catch {

          /*
           * Interaction déjà fermée par Discord.
           */

        }

      }

    }
  );


  /*
   * =======================================================
   * LOGIN DISCORD
   * =======================================================
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
      mongoose.connection.readyState !== 0
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
    shutdown('SIGTERM')
);

process.on(
  'SIGINT',
  () =>
    shutdown('SIGINT')
);


/* =========================================================
   GESTION DES ERREURS NON CAPTURÉES
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

async function main(): Promise<void> {

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
   * =======================================================
   * VALIDATION CONFIGURATION
   * =======================================================
   */

  validateProductionConfig();


  /*
   * =======================================================
   * MONGODB
   * =======================================================
   */

  await connectDatabase();


  /*
   * =======================================================
   * EXPRESS
   * =======================================================
   */

  await setupWebServer();


  /*
   * =======================================================
   * DISCORD
   * =======================================================
   */

  await setupDiscordBot();


  /*
   * =======================================================
   * FIN
   * =======================================================
   */

  console.log('');

  console.log(
    '[OMNIX] ✅ Plateforme OMNIX opérationnelle.'
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