import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  Collection,
  MessageFlags,
} from 'discord.js';

interface LoadedCommand {
  data?: {
    name?: string;
    description?: string;
  };

  name?: string;
  description?: string;

  execute?: (
    interaction: ChatInputCommandInteraction
  ) => Promise<unknown> | unknown;
}

function getCommandName(command: LoadedCommand): string {
  return (
    command.data?.name ??
    command.name ??
    'commande-inconnue'
  );
}

function getCommandDescription(
  command: LoadedCommand
): string {
  return (
    command.data?.description ??
    command.description ??
    'Aucune description'
  );
}

function getCategory(commandName: string): string {
  /*
   * Les commandes situées dans les dossiers ne sont pas
   * forcément accessibles ici selon la manière dont le loader
   * les enregistre.
   *
   * On utilise donc le nom de la commande pour les catégories
   * principales.
   */

  const categories: Record<string, string> = {
    ai: '🤖 IA',
    admin: '👑 Administration',
    ban: '🛡️ Modération',
    kick: '🛡️ Modération',
    warn: '🛡️ Modération',
    warnings: '🛡️ Modération',
    warning: '🛡️ Modération',
    unwarn: '🛡️ Modération',
    'clear-warnings': '🛡️ Modération',
    history: '🛡️ Modération',
    case: '🛡️ Modération',
    cases: '🛡️ Modération',
    modstats: '🛡️ Modération',
    ticket: '🎫 Tickets',
    giveaway: '🎁 Giveaways',
    shop: '🛒 Économie',
    balance: '🪙 Économie',
    daily: '🪙 Économie',
    weekly: '🪙 Économie',
    gamble: '🪙 Économie',
    level: '📈 Levels',
    stats: '📊 Statistiques',
  };

  return (
    categories[commandName] ??
    '⚙️ Autres commandes'
  );
}

function splitCommands(
  commands: string[],
  maxLength = 950
): string[] {
  const chunks: string[] = [];
  let current = '';

  for (const command of commands) {
    const next =
      current.length === 0
        ? command
        : `${current}\n${command}`;

    if (next.length > maxLength) {
      if (current.length > 0) {
        chunks.push(current);
      }

      current = command;
    } else {
      current = next;
    }
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription(
      'Affiche toutes les commandes disponibles d’OMNIX'
    ),

  async execute(
    interaction: ChatInputCommandInteraction
  ) {
    try {
      const client = interaction.client;

      /*
       * =========================================================
       * RÉCUPÉRATION DES COMMANDES
       * =========================================================
       */

      const commandCollection =
        client.commands as Collection<
          string,
          LoadedCommand
        >;

      if (
        !commandCollection ||
        commandCollection.size === 0
      ) {
        return interaction.reply({
          content:
            '❌ Aucune commande n’est actuellement chargée.',
          flags: MessageFlags.Ephemeral,
        });
      }

      /*
       * =========================================================
       * ORGANISATION PAR CATÉGORIE
       * =========================================================
       */

      const categories =
        new Map<string, string[]>();

      for (const [
        collectionName,
        command,
      ] of commandCollection) {
        const name =
          getCommandName(command) ||
          collectionName;

        const description =
          getCommandDescription(command);

        const category =
          getCategory(name);

        if (!categories.has(category)) {
          categories.set(category, []);
        }

        categories
          .get(category)!
          .push(
            `• \`/${name}\` — ${description}`
          );
      }

      /*
       * =========================================================
       * TRI
       * =========================================================
       */

      for (const commands of categories.values()) {
        commands.sort((a, b) =>
          a.localeCompare(b)
        );
      }

      /*
       * =========================================================
       * EMBED
       * =========================================================
       *
       * Discord :
       * - max 1024 caractères par field
       * - max 25 fields par embed
       *
       * On découpe donc automatiquement.
       */

      const fields: {
        name: string;
        value: string;
        inline: boolean;
      }[] = [];

      for (const [
        category,
        commands,
      ] of categories) {
        const chunks = splitCommands(
          commands
        );

        chunks.forEach(
          (chunk, index) => {
            fields.push({
              name:
                chunks.length === 1
                  ? category
                  : `${category} — ${index + 1}`,
              value: chunk,
              inline: false,
            });
          }
        );
      }

      /*
       * =========================================================
       * LIMITE EMBED
       * =========================================================
       */

      const MAX_FIELDS = 25;

      const embeds: EmbedBuilder[] = [];

      for (
        let i = 0;
        i < fields.length;
        i += MAX_FIELDS
      ) {
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(
            i === 0
              ? '🤖 OMNIX — Centre d’aide'
              : '🤖 OMNIX — Commandes'
          )
          .setDescription(
            i === 0
              ? [
                  'Bienvenue dans le centre d’aide **OMNIX**.',
                  '',
                  `📚 **${commandCollection.size}** commande(s) chargée(s).`,
                  '',
                  'Les commandes affichées sont générées automatiquement à partir des commandes réellement chargées par OMNIX.',
                ].join('\n')
              : 'Suite des commandes disponibles.'
          )
          .addFields(
            fields.slice(
              i,
              i + MAX_FIELDS
            )
          )
          .setFooter({
            text: `${interaction.guild?.name ?? 'OMNIX'} • OMNIX`,
          })
          .setTimestamp();

        embeds.push(embed);
      }

      /*
       * =========================================================
       * ENVOI
       * =========================================================
       */

      await interaction.reply({
        embeds: [embeds[0]],
      });

      for (
        let i = 1;
        i < embeds.length;
        i++
      ) {
        await interaction.followUp({
          embeds: [embeds[i]],
        });
      }
    } catch (error) {
      console.error(
        '[Help] Exception sur la commande help :',
        error
      );

      const message =
        '❌ Une erreur est survenue lors de l’affichage des commandes.';

      if (
        interaction.replied ||
        interaction.deferred
      ) {
        return interaction.followUp({
          content: message,
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        content: message,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};