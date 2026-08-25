import {
  REST,
  Routes,
  type Client,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';

import { CONFIG } from '../../config/index';
import type { Command } from './commandHandler';

function getToken(): string | undefined {
  return (
    process.env.DISCORD_TOKEN ??
    CONFIG.DISCORD?.TOKEN
  );
}

function getClientId(
  client: Client
): string | undefined {
  return (
    process.env.DISCORD_CLIENT_ID ??
    CONFIG.DISCORD?.CLIENT_ID ??
    client.user?.id
  );
}

function getCommandJSON(
  command: Command
): RESTPostAPIChatInputApplicationCommandsJSONBody | null {
  try {
    /*
     * Format principal OMNIX :
     *
     * data: SlashCommandBuilder
     */
    if (
      command.data &&
      typeof command.data.toJSON === 'function'
    ) {
      return command.data.toJSON() as RESTPostAPIChatInputApplicationCommandsJSONBody;
    }

    /*
     * Ancien format :
     *
     * command: {
     *   data: SlashCommandBuilder
     * }
     */
    if (
      command.command &&
      typeof command.command.toJSON === 'function'
    ) {
      return command.command.toJSON() as RESTPostAPIChatInputApplicationCommandsJSONBody;
    }

    return null;
  } catch (error) {
    console.error(
      '[CommandSync] Erreur conversion commande :',
      error
    );

    return null;
  }
}

export async function syncCommands(
  client: Client
): Promise<void> {
  const token = getToken();
  const clientId = getClientId(client);

  if (!token) {
    throw new Error(
      '[CommandSync] Aucun token Discord trouvé dans CONFIG.DISCORD.TOKEN ou DISCORD_TOKEN.'
    );
  }

  if (!clientId) {
    throw new Error(
      '[CommandSync] Aucun Client ID Discord trouvé.'
    );
  }

  const commands =
    client.commands as Map<string, Command>;

  if (!commands || commands.size === 0) {
    console.warn(
      '[CommandSync] Aucune commande en mémoire.'
    );

    return;
  }

  const commandData: RESTPostAPIChatInputApplicationCommandsJSONBody[] =
    [];

  for (const [name, command] of commands) {
    const json = getCommandJSON(command);

    if (!json) {
      console.warn(
        `[CommandSync] /${name} ignorée : data.toJSON() introuvable.`
      );

      continue;
    }

    commandData.push(json);
  }

  console.log('');
  console.log(
    '════════════════════════════════════'
  );
  console.log(
    '       OMNIX COMMAND SYNCHRONIZER'
  );
  console.log(
    '════════════════════════════════════'
  );

  console.log(
    `[CommandSync] Client ID : ${clientId}`
  );

  console.log(
    `[CommandSync] Commandes en mémoire : ${commands.size}`
  );

  console.log(
    `[CommandSync] Commandes valides : ${commandData.length}`
  );

  const rest = new REST({
    version: '10',
  }).setToken(token);

  try {
    console.log(
      '[CommandSync] Envoi des commandes à Discord...'
    );

    /*
     * PUT = remplacement complet.
     *
     * Les anciennes commandes globales qui
     * ne sont plus présentes sont supprimées.
     */
    const result = await rest.put(
      Routes.applicationCommands(clientId),
      {
        body: commandData,
      }
    );

    const count =
      Array.isArray(result)
        ? result.length
        : commandData.length;

    console.log(
      `[CommandSync] ✓ ${count} commande(s) synchronisée(s) sur Discord.`
    );

    console.log(
      '[CommandSync] ✓ Anciennes commandes remplacées.'
    );

    console.log(
      '════════════════════════════════════'
    );
    console.log('');
  } catch (error) {
    console.error(
      '[CommandSync] ✗ Erreur Discord pendant la synchronisation :',
      error
    );

    throw error;
  }
}

/*
 * Compatibilité avec d'éventuels anciens imports.
 */
export async function autoCommandSync(
  client: Client
): Promise<void> {
  await syncCommands(client);
}

export default syncCommands;