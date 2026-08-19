import {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
} from 'discord.js';

import type { Command } from './types.ts';

/* =========================================================
   EXTENDED CLIENT
========================================================= */

export class ExtendedClient
  extends Client
{
  /**
   * Collection globale des commandes OMNIX.
   *
   * Exemple :
   *
   * /help
   * /ping
   * /setup
   *
   * deviennent accessibles via :
   *
   * client.commands.get('help')
   */
  public commands:
    Collection<string, Command>;

  constructor() {
    super({
      intents: [
        /* ---------------------------------------------------
           GUILDS
        --------------------------------------------------- */

        GatewayIntentBits.Guilds,

        /* ---------------------------------------------------
           MESSAGES
        --------------------------------------------------- */

        GatewayIntentBits.GuildMessages,

        GatewayIntentBits.MessageContent,

        /* ---------------------------------------------------
           MEMBERS
        --------------------------------------------------- */

        GatewayIntentBits.GuildMembers,
      ],

      /* -----------------------------------------------------
         PARTIALS
      ----------------------------------------------------- */

      partials: [
        Partials.Channel,
        Partials.GuildMember,
        Partials.Message,
        Partials.User,
      ],
    });

    /* =====================================================
       COMMAND COLLECTION
    ===================================================== */

    this.commands =
      new Collection<
        string,
        Command
      >();
  }
}

/* =========================================================
   SINGLE OMNIX CLIENT
========================================================= */

/**
 * Instance UNIQUE du client Discord OMNIX.
 *
 * IMPORTANT :
 *
 * Tous les fichiers doivent utiliser cette instance.
 *
 * Il ne faut pas créer un deuxième :
 *
 * new Client()
 *
 * ailleurs dans le projet.
 */
export const client =
  new ExtendedClient();