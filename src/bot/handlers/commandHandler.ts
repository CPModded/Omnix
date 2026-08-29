import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { Collection } from 'discord.js';
import type {
  Client,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from 'discord.js';

/* =========================================================
   TYPES
========================================================= */

export interface Command {
  data?: {
    name?: string;
    description?: string;
    toJSON?: () => unknown;
  };

  command?: {
    name?: string;
    description?: string;
    toJSON?: () => unknown;
  };

  name?: string;
  description?: string;

  execute?: (
    interactionOrContext: any
  ) => Promise<unknown> | unknown;

  autocomplete?: (
    interaction: AutocompleteInteraction
  ) => Promise<unknown> | unknown;
}

/* =========================================================
   CONTEXT OMNIX
========================================================= */

export interface CommandContext {
  interaction: ChatInputCommandInteraction;

  client: Client;

  guild: any;

  user: any;

  member: any;

  channel: any;

  guildId: string | null;

  userId: string;

  commandName: string;

  options: any;
}

/* =========================================================
   COMMAND COLLECTION
========================================================= */

export function getCommands(
  client: Client
): Collection<string, Command> {
  const existing =
    (client as any).commands;

  if (
    existing instanceof Collection
  ) {
    return existing;
  }

  const collection =
    new Collection<
      string,
      Command
    >();

  (client as any).commands =
    collection;

  return collection;
}

/* =========================================================
   COMMAND NAME
========================================================= */

function getCommandName(
  command: Command
): string | null {
  const name =
    command.data?.name ??
    command.command?.name ??
    command.name;

  if (
    typeof name !== 'string'
  ) {
    return null;
  }

  const clean =
    name.trim();

  return clean.length > 0
    ? clean
    : null;
}

/* =========================================================
   NORMALIZE COMMAND
========================================================= */

function normalizeCommand(
  module: any
): Command | null {
  /*
   * Formats supportés :
   *
   * export default command
   *
   * export const command = ...
   *
   * module directement
   */

  const candidates = [
    module?.default,
    module?.command,
    module,
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (
      typeof candidate.execute ===
      'function'
    ) {
      return candidate;
    }
  }

  return null;
}

/* =========================================================
   FIND COMMAND
========================================================= */

export function getCommand(
  client: Client,
  name: string
): Command | undefined {
  const commands =
    getCommands(client);

  return commands.get(name);
}

/* =========================================================
   COMMAND CONTEXT
========================================================= */

function createCommandContext(
  interaction: ChatInputCommandInteraction
): CommandContext {
  return {
    interaction,

    client:
      interaction.client,

    guild:
      interaction.guild,

    user:
      interaction.user,

    member:
      interaction.member,

    channel:
      interaction.channel,

    guildId:
      interaction.guildId,

    userId:
      interaction.user.id,

    commandName:
      interaction.commandName,

    options:
      interaction.options,
  };
}

/* =========================================================
   DETECT CONTEXT FORMAT
========================================================= */

function expectsContextObject(
  execute: Function
): boolean {
  const source =
    Function.prototype.toString.call(
      execute
    );

  /*
   * On reconnaît uniquement les formes :
   *
   * execute({ interaction })
   * execute({ interaction, ... })
   * async execute({ interaction })
   *
   * On ne considère PAS les fonctions anonymes
   * ou les paramètres génériques comme contexte.
   */

  return /execute\s*\(\s*\{\s*interaction\b/.test(
    source
  );
}

/* =========================================================
   EXECUTE COMMAND
========================================================= */

export async function executeCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (
    !interaction ||
    !interaction.commandName
  ) {
    return;
  }

  const command =
    getCommand(
      interaction.client,
      interaction.commandName
    );

  /* -------------------------------------------------------
     COMMANDE INTROUVABLE
  ------------------------------------------------------- */

  if (!command) {
    console.warn(
      `[CommandHandler] Commande introuvable : /${interaction.commandName}`
    );

    if (
      !interaction.replied &&
      !interaction.deferred
    ) {
      try {
        await interaction.reply({
          content:
            '❌ Cette commande n’est pas disponible actuellement.',
          flags: 64,
        });
      } catch (error) {
        console.error(
          '[CommandHandler] Erreur réponse commande introuvable :',
          error
        );
      }
    }

    return;
  }

  /* -------------------------------------------------------
     EXECUTE MANQUANT
  ------------------------------------------------------- */

  if (
    typeof command.execute !==
    'function'
  ) {
    console.error(
      `[CommandHandler] /${interaction.commandName} ne possède pas execute().`
    );

    if (
      !interaction.replied &&
      !interaction.deferred
    ) {
      try {
        await interaction.reply({
          content:
            '❌ Cette commande est mal configurée.',
          flags: 64,
        });
      } catch {
        // Rien à faire.
      }
    }

    return;
  }

  try {
    const context =
      createCommandContext(
        interaction
      );

    /*
     * =======================================================
     * FORMAT 1
     *
     * execute({ interaction, ... })
     * =======================================================
     */

    if (
      expectsContextObject(
        command.execute
      )
    ) {
      await command.execute(
        context
      );

      return;
    }

    /*
     * =======================================================
     * FORMAT 2
     *
     * execute(interaction)
     * =======================================================
     */

    await command.execute(
      interaction
    );
  } catch (error) {
    console.error(
      `[Bot Error] Exception sur la commande ${interaction.commandName}:`,
      error
    );

    await safelyReplyError(
      interaction
    );
  }
}

/* =========================================================
   SAFE ERROR RESPONSE
========================================================= */

async function safelyReplyError(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const message =
    '❌ Une erreur est survenue lors de l’exécution de cette commande.';

  try {
    if (
      interaction.replied ||
      interaction.deferred
    ) {
      await interaction.editReply({
        content: message,
        embeds: [],
        components: [],
      });

      return;
    }

    await interaction.reply({
      content: message,
      flags: 64,
    });
  } catch (error: any) {
    // Discord peut rejeter une réponse d'erreur si l'interaction
    // est déjà expirée (10062) ou déjà acquittée (40060).
    // Dans ces deux cas, une seconde réponse ne ferait qu'ajouter
    // une erreur en cascade dans les logs.
    const code = Number(error?.code);

    if (code === 10062 || code === 40060) {
      return;
    }

    console.error(
      '[CommandHandler] Impossible de répondre à l’erreur :',
      error
    );
  }
}

/* =========================================================
   AUTOCOMPLETE
========================================================= */

export async function executeAutocomplete(
  interaction: AutocompleteInteraction
): Promise<void> {
  if (
    !interaction ||
    !interaction.commandName
  ) {
    return;
  }

  const command =
    getCommand(
      interaction.client,
      interaction.commandName
    );

  if (!command) {
    try {
      await interaction.respond([]);
    } catch {
      // Interaction déjà terminée.
    }

    return;
  }

  try {
    if (
      typeof command.autocomplete ===
      'function'
    ) {
      await command.autocomplete(
        interaction
      );

      return;
    }

    /*
     * Pas d'autocomplete déclaré :
     * on répond simplement avec une liste vide.
     */

    await interaction.respond([]);
  } catch (error) {
    console.error(
      `[CommandHandler] Erreur autocomplete /${interaction.commandName}:`,
      error
    );

    try {
      if (
        !interaction.responded
      ) {
        await interaction.respond(
          []
        );
      }
    } catch {
      // Interaction déjà terminée.
    }
  }
}

/* =========================================================
   RECURSIVE COMMAND SEARCH
========================================================= */

function getCommandFiles(
  directory: string
): string[] {
  const result: string[] = [];

  if (
    !fs.existsSync(directory)
  ) {
    return result;
  }

  const entries =
    fs.readdirSync(
      directory,
      {
        withFileTypes: true,
      }
    );

  for (const entry of entries) {
    const fullPath =
      path.join(
        directory,
        entry.name
      );

    if (
      entry.isDirectory()
    ) {
      result.push(
        ...getCommandFiles(
          fullPath
        )
      );

      continue;
    }

    if (
      !entry.name.endsWith(
        ''
      ) &&
      !entry.name.endsWith(
        '.js'
      ) &&
      !entry.name.endsWith(
        '.mjs'
      )
    ) {
      continue;
    }

    /*
     * Fichiers à ignorer.
     */

    if (
      entry.name.endsWith(
        '.d'
      ) ||
      entry.name.endsWith(
        '.test'
      ) ||
      entry.name.endsWith(
        '.spec'
      )
    ) {
      continue;
    }

    result.push(
      fullPath
    );
  }

  return result;
}

/* =========================================================
   LOAD COMMANDS
========================================================= */

export async function loadCommands(
  client: Client,
  commandsPath?: string
): Promise<
  Collection<string, Command>
> {
  const commands =
    new Collection<
      string,
      Command
    >();

  const directory =
    commandsPath ??
    path.join(
      process.cwd(),
      'src',
      'bot',
      'commands'
    );

  console.log(
    `[Commands] Recherche des commandes dans : ${directory}`
  );

  /* -------------------------------------------------------
     DOSSIER ABSENT
  ------------------------------------------------------- */

  if (
    !fs.existsSync(directory)
  ) {
    console.error(
      `[Commands] ❌ Dossier introuvable : ${directory}`
    );

    (client as any).commands =
      commands;

    return commands;
  }

  /* -------------------------------------------------------
     FICHIERS
  ------------------------------------------------------- */

  const files =
    getCommandFiles(
      directory
    );

  console.log(
    `[Commands] ${files.length} fichier(s) trouvé(s).`
  );

  /* -------------------------------------------------------
     CHARGEMENT
  ------------------------------------------------------- */

  for (const file of files) {
    try {
      const url =
        pathToFileURL(
          file
        ).href;

      const module =
        await import(url);

      const command =
        normalizeCommand(
          module
        );

      /* ---------------------------------------------------
         EXPORT INVALID
      --------------------------------------------------- */

      if (!command) {
        console.warn(
          `[Commands] ${path.basename(file)} ignorée : export de commande introuvable.`
        );

        continue;
      }

      /* ---------------------------------------------------
         NOM
      --------------------------------------------------- */

      const name =
        getCommandName(
          command
        );

      if (!name) {
        console.warn(
          `[Commands] ${path.basename(file)} ignorée : nom introuvable.`
        );

        continue;
      }

      /* ---------------------------------------------------
         EXECUTE
      --------------------------------------------------- */

      if (
        typeof command.execute !==
        'function'
      ) {
        console.warn(
          `[Commands] /${name} ignorée : execute() introuvable.`
        );

        continue;
      }

      /* ---------------------------------------------------
         DOUBLON
      --------------------------------------------------- */

      if (
        commands.has(name)
      ) {
        console.warn(
          `[Commands] ⚠️ Doublon détecté : /${name}`
        );

        console.warn(
          `[Commands] Fichier ignoré : ${file}`
        );

        continue;
      }

      /* ---------------------------------------------------
         ENREGISTREMENT MÉMOIRE
      --------------------------------------------------- */

      commands.set(
        name,
        command
      );

      console.log(
        `[Commands] ✓ /${name} chargée.`
      );
    } catch (error) {
      console.error(
        `[Commands] ❌ Erreur lors du chargement de ${file}:`,
        error
      );
    }
  }

  /* -------------------------------------------------------
     ATTACH CLIENT
  ------------------------------------------------------- */

  (client as any).commands =
    commands;

  console.log(
    `[Commands] ${commands.size} commande(s) chargée(s).`
  );

  return commands;
}

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default loadCommands;