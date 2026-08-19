import fs from 'node:fs';
import path from 'node:path';

import type { ClientEvents } from 'discord.js';

import { ExtendedClient } from '../client';

interface BotEvent<K extends keyof ClientEvents = keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute: (...args: any[]) => Promise<void> | void;
}

export async function loadEvents(
  client: ExtendedClient
): Promise<void> {
  console.log(
    '[Bot] Initialisation du chargeur d\'événements...'
  );

  const eventsPath = path.join(
    __dirname,
    '../events'
  );

  if (!fs.existsSync(eventsPath)) {
    console.warn(
      `[Bot] Dossier events introuvable : ${eventsPath}`
    );

    return;
  }

  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter(
      (file) =>
        file.endsWith('.ts') ||
        file.endsWith('.js')
    );

  if (eventFiles.length === 0) {
    console.warn(
      '[Bot] Aucun fichier d\'événement trouvé.'
    );

    return;
  }

  let count = 0;

  for (const file of eventFiles) {
    const filePath = path.join(
      eventsPath,
      file
    );

    try {
      console.log(
        `[Bot] Chargement de l'événement : ${file}`
      );

      const eventModule = await import(
        filePath
      );

      const event =
        eventModule.default as
          | BotEvent
          | undefined;

      if (
        !event ||
        !event.name ||
        typeof event.execute !== 'function'
      ) {
        console.warn(
          `[Bot] Événement ignoré : ${file} — structure invalide.`
        );

        continue;
      }

      if (event.once) {
        client.once(
          event.name,
          (...args) => {
            void event.execute(
              ...args,
              client
            );
          }
        );
      } else {
        client.on(
          event.name,
          (...args) => {
            void event.execute(
              ...args,
              client
            );
          }
        );
      }

      count++;

      console.log(
        `[Bot] ✓ Événement chargé : ${String(event.name)}`
      );
    } catch (error) {
      console.error(
        `[Bot] ✗ Impossible de charger ${file}`
      );

      console.error(error);

      /*
       * On continue le chargement des autres événements
       * afin qu'un seul fichier défectueux ne bloque
       * pas complètement OMNIX.
       */
    }
  }

  console.log(
    `[Bot] ${count}/${eventFiles.length} gestionnaires d'événements chargés.`
  );
}