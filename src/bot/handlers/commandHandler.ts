import fs from 'fs';
import path from 'path';

import { ExtendedClient } from '../client';

/* =========================================================
   TYPES
========================================================= */

interface OmnixCommand {
  data?: {
    name?: string;
  };

  execute?: (...args: any[]) => any;
}

/* =========================================================
   COMMAND COUNT GLOBAL
========================================================= */

/**
 * Rend le nombre réel de commandes accessible
 * à stats.routes.ts.
 *
 * stats.routes.ts lit :
 *
 * globalThis.__OMNIX_COMMAND_COUNT
 */
function setGlobalCommandCount(
  count: number
): void {
  (
    globalThis as typeof globalThis & {
      __OMNIX_COMMAND_COUNT?: number;
    }
  ).__OMNIX_COMMAND_COUNT = count;
}

/* =========================================================
   COMMAND DIRECTORY
========================================================= */

function getCommandsPath(): string {
  /**
   * __dirname fonctionne avec le projet compilé.
   *
   * Exemple :
   *
   * dist/commands
   *
   * ou :
   *
   * src/commands
   */
  const possiblePaths = [
    path.join(
      __dirname,
      '../commands'
    ),

    path.join(
      process.cwd(),
      'src',
      'commands'
    ),

    path.join(
      process.cwd(),
      'dist',
      'commands'
    ),
  ];

  const existingPath =
    possiblePaths.find(
      directory =>
        fs.existsSync(
          directory
        )
    );

  return (
    existingPath ||
    possiblePaths[0]
  );
}

/* =========================================================
   COMMAND FILE CHECK
========================================================= */

function isCommandFile(
  file: string
): boolean {
  return (
    file.endsWith('.ts') ||
    file.endsWith('.js') ||
    file.endsWith('.mjs')
  );
}

/* =========================================================
   COMMAND LOADER
========================================================= */

export async function loadCommands(
  client: ExtendedClient
): Promise<number> {
  console.log(
    '[Bot] Chargement des commandes OMNIX...'
  );

  const commandsPath =
    getCommandsPath();

  /* =======================================================
     DIRECTORY CHECK
  ======================================================= */

  if (
    !fs.existsSync(
      commandsPath
    )
  ) {
    console.warn(
      `[Bot] Dossier commandes introuvable : ${commandsPath}`
    );

    setGlobalCommandCount(
      0
    );

    return 0;
  }

  /* =======================================================
     FILES
  ======================================================= */

  const commandFiles =
    fs
      .readdirSync(
        commandsPath
      )
      .filter(
        isCommandFile
      )
      .filter(
        file =>
          !file.startsWith('_')
      );

  /* =======================================================
     NO COMMANDS
  ======================================================= */

  if (
    commandFiles.length ===
    0
  ) {
    console.warn(
      `[Bot] Aucune commande trouvée dans ${commandsPath}`
    );

    setGlobalCommandCount(
      0
    );

    return 0;
  }

  /* =======================================================
     LOAD
  ======================================================= */

  let loadedCount =
    0;

  let failedCount =
    0;

  for (
    const file of commandFiles
  ) {
    const filePath =
      path.join(
        commandsPath,
        file
      );

    try {
      /* ===================================================
         IMPORT
      =================================================== */

      const commandModule =
        await import(
          filePath
        );

      /**
       * On accepte le default export.
       */
      const command =
        commandModule.default as
          | OmnixCommand
          | undefined;

      /* ===================================================
         VALIDATION
      =================================================== */

      if (
        !command
      ) {
        console.warn(
          `[Bot] Commande ignorée : ${file} ne possède pas de default export.`
        );

        continue;
      }

      if (
        !command.data
      ) {
        console.warn(
          `[Bot] Commande ignorée : ${file} ne possède pas de propriété "data".`
        );

        continue;
      }

      if (
        typeof command.execute !==
        'function'
      ) {
        console.warn(
          `[Bot] Commande ignorée : ${file} ne possède pas de fonction "execute".`
        );

        continue;
      }

      const commandName =
        command.data.name;

      /* ===================================================
         NAME VALIDATION
      =================================================== */

      if (
        !commandName ||
        typeof commandName !==
          'string'
      ) {
        console.warn(
          `[Bot] Commande ignorée : ${file} possède un nom invalide.`
        );

        continue;
      }

      const normalizedName =
        commandName
          .trim()
          .toLowerCase();

      if (
        !normalizedName
      ) {
        console.warn(
          `[Bot] Commande ignorée : ${file} possède un nom vide.`
        );

        continue;
      }

      /* ===================================================
         DUPLICATE CHECK
      =================================================== */

      if (
        client.commands.has(
          normalizedName
        )
      ) {
        console.warn(
          `[Bot] Doublon détecté : /${normalizedName}`
        );

        continue;
      }

      /* ===================================================
         REGISTER
      =================================================== */

      client.commands.set(
        normalizedName,
        command
      );

      loadedCount++;

      console.log(
        `[Bot] Commande chargée : /${normalizedName}`
      );
    } catch (error) {
      failedCount++;

      console.error(
        `[Bot] Impossible de charger ${file}:`,
        error
      );
    }
  }

  /* =======================================================
     GLOBAL STATISTICS
  ======================================================= */

  setGlobalCommandCount(
    client.commands.size
  );

  /* =======================================================
     SUMMARY
  ======================================================= */

  console.log(
    '================================================='
  );

  console.log(
    `[Bot] Commandes trouvées : ${commandFiles.length}`
  );

  console.log(
    `[Bot] Commandes chargées : ${loadedCount}`
  );

  console.log(
    `[Bot] Commandes échouées : ${failedCount}`
  );

  console.log(
    `[Bot] Commandes disponibles : ${client.commands.size}`
  );

  console.log(
    '================================================='
  );

  /* =======================================================
     RETURN
  ======================================================= */

  return client.commands.size;
}