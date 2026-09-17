import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';

import type {
  IGuildConfig,
} from '../models/GuildConfig';

/* =========================================================
   COMMAND CONTEXT
========================================================= */

/**
 * Contexte transmis à chaque commande OMNIX.
 *
 * IMPORTANT :
 *
 * guildConfig correspond uniquement au serveur
 * depuis lequel la commande est exécutée.
 *
 * Cela évite qu'une configuration Discord
 * puisse fuiter d'un serveur vers un autre.
 */
export interface CommandContext {
  /**
   * Interaction Discord ayant déclenché
   * la commande.
   */
  interaction:
    ChatInputCommandInteraction;

  /**
   * Configuration MongoDB du serveur
   * actuellement concerné.
   */
  guildConfig:
    IGuildConfig;
}

/* =========================================================
   COMMAND
========================================================= */

/**
 * Structure standard d'une commande OMNIX.
 *
 * Exemple :
 *
 * {
 *   data: new SlashCommandBuilder()
 *     .setName('ping')
 *     .setDescription('Affiche la latence'),
 *
 *   async execute({
 *     interaction,
 *     guildConfig,
 *   }) {
 *     ...
 *   }
 * }
 */
export interface Command {
  /**
   * Définition Slash Command Discord.
   *
   * On interdit ici les méthodes permettant
   * d'ajouter directement des sous-commandes
   * afin de conserver la structure actuelle
   * de ton système.
   */
  data:
    Omit<
      SlashCommandBuilder,
      | 'addSubcommand'
      | 'addSubcommandGroup'
    >;

  /**
   * Fonction exécutée lorsqu'une commande
   * est appelée.
   */
  execute:
    (
      ctx: CommandContext
    ) => Promise<void>;
}