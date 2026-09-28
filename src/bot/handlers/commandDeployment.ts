import {
  REST,
  Routes,
  type Client,
} from 'discord.js';

import type { Command } from './commandHandler';

interface DeployOptions {
  client: Client;
  commands: Map<string, Command>;
  token: string;
  clientId: string;
  guildId?: string;
}

/* =========================================================
   OMNIX — SLASH COMMAND DEPLOYER
========================================================= */

export async function deployCommands(
  options: DeployOptions
): Promise<void> {
  const {
    client,
    commands,
    token,
    clientId,
    guildId,
  } = options;

  if (!token) {
    throw new Error(
      '[Deploy] DISCORD_TOKEN manquant.'
    );
  }

  if (!clientId) {
    throw new Error(
      '[Deploy] DISCORD_CLIENT_ID manquant.'
    );
  }

  /*
   * On récupère UNIQUEMENT les commandes réellement
   * présentes dans la Collection du commandHandler.
   */

  const body: object[] = [];

  for (const [name, command] of commands) {
    try {
      if (!command?.data) {
        console.warn(
          `[Deploy] /${name} ignorée : data absente.`
        );

        continue;
      }

      if (
        typeof command.data.toJSON !==
        'function'
      ) {
        console.warn(
          `[Deploy] /${name} ignorée : data.toJSON() absent.`
        );

        continue;
      }

      const json =
        command.data.toJSON();

      if (
        !json ||
        typeof json !== 'object'
      ) {
        console.warn(
          `[Deploy] /${name} ignorée : data invalide.`
        );

        continue;
      }

      body.push(json);

      /*
       * Debug très utile pour ton problème actuel.
       */

      if (name === 'ai') {
        console.log(
          '[Deploy] Définition réelle de /ai :',
          JSON.stringify(
            json,
            null,
            2
          )
        );
      }
    } catch (error) {
      console.error(
        `[Deploy] Impossible de préparer /${name}:`,
        error
      );
    }
  }

  console.log(
    `[Deploy] ${body.length} commande(s) prêtes.`
  );

  const rest =
    new REST({
      version: '10',
    }).setToken(token);

  /*
   * =======================================================
   * GUILD
   * =======================================================
   */

  if (guildId) {
    console.log(
      `[Deploy] Synchronisation GUILD : ${guildId}`
    );

    const result =
      await rest.put(
        Routes.applicationGuildCommands(
          clientId,
          guildId
        ),
        {
          body,
        }
      );

    console.log(
      `[Deploy] ✓ ${
        Array.isArray(result)
          ? result.length
          : 0
      } commande(s) synchronisée(s).`
    );

    return;
  }

  /*
   * =======================================================
   * GLOBAL
   * =======================================================
   */

  console.log(
    '[Deploy] Synchronisation globale...'
  );

  const result =
    await rest.put(
      Routes.applicationCommands(
        clientId
      ),
      {
        body,
      }
    );

  console.log(
    `[Deploy] ✓ ${
      Array.isArray(result)
        ? result.length
        : 0
    } commande(s) globales synchronisée(s).`
  );
}