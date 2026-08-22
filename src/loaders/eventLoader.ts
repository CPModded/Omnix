import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { Client } from 'discord.js';

interface BotEvent {
  name?: string;
  once?: boolean;

  execute?: (
    ...args: any[]
  ) => Promise<unknown> | unknown;
}

/* =========================================================
   RÉCUPÉRATION RÉCURSIVE DES FICHIERS
========================================================= */

function getEventFiles(
  directory: string
): string[] {
  const files: string[] = [];

  if (!fs.existsSync(directory)) {
    return files;
  }

  const entries = fs.readdirSync(
    directory,
    { withFileTypes: true }
  );

  for (const entry of entries) {
    const fullPath = path.join(
      directory,
      entry.name
    );

    if (entry.isDirectory()) {
      files.push(
        ...getEventFiles(fullPath)
      );

      continue;
    }

    if (
      !entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.js') &&
      !entry.name.endsWith('.mjs')
    ) {
      continue;
    }

    /*
     * Fichiers à ignorer
     */

    if (
      entry.name.endsWith('.d.ts') ||
      entry.name.endsWith('.test.ts') ||
      entry.name.endsWith('.spec.ts')
    ) {
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

/* =========================================================
   NORMALISATION DE L'ÉVÉNEMENT
========================================================= */

function normalizeEvent(
  module: any
): BotEvent | null {
  const event =
    module?.default ??
    module?.event ??
    module;

  if (!event) {
    return null;
  }

  if (
    typeof event.name !== 'string'
  ) {
    return null;
  }

  if (
    typeof event.execute !== 'function'
  ) {
    return null;
  }

  return event;
}

/* =========================================================
   CHARGEMENT DES ÉVÉNEMENTS
========================================================= */

export async function loadEvents(
  client: Client,
  eventsPath?: string
): Promise<void> {
  const directory =
    eventsPath ??
    path.join(
      process.cwd(),
      'src',
      'bot',
      'events'
    );

  console.log(
    `[Bot] Recherche des événements dans : ${directory}`
  );

  if (!fs.existsSync(directory)) {
    console.warn(
      `[Bot] Dossier événements introuvable : ${directory}`
    );

    return;
  }

  const files =
    getEventFiles(directory);

  console.log(
    `[Bot] ${files.length} fichier(s) d'événements trouvé(s).`
  );

  /*
   * =========================================================
   * PROTECTION CONTRE LES DOUBLONS
   * =========================================================
   */

  const loadedEvents =
    new Set<string>();

  /*
   * =========================================================
   * CHARGEMENT
   * =========================================================
   */

  for (const file of files) {
    try {
      const moduleUrl =
        pathToFileURL(file).href;

      const module =
        await import(moduleUrl);

      const event =
        normalizeEvent(module);

      if (!event) {
        console.warn(
          `[Bot] ${path.basename(file)} ignoré : événement invalide.`
        );

        continue;
      }

      /*
       * =======================================================
       * DÉTECTION DU NOM
       * =======================================================
       */

      const eventName =
        event.name.trim();

      if (!eventName) {
        console.warn(
          `[Bot] ${path.basename(file)} ignoré : nom vide.`
        );

        continue;
      }

      /*
       * =======================================================
       * DOUBLON
       * =======================================================
       */

      if (
        loadedEvents.has(eventName)
      ) {
        console.warn(
          `[Bot] ⚠️ Événement "${eventName}" déjà chargé.`
        );

        console.warn(
          `[Bot] Fichier ignoré : ${file}`
        );

        continue;
      }

      /*
       * =======================================================
       * ENREGISTREMENT
       * =======================================================
       */

      if (event.once) {
        client.once(
          eventName,
          (...args) =>
            event.execute!(
              ...args
            )
        );
      } else {
        client.on(
          eventName,
          (...args) =>
            event.execute!(
              ...args
            )
        );
      }

      loadedEvents.add(
        eventName
      );

      console.log(
        `[Bot] ✓ Événement chargé : ${path.basename(file)}`
      );
    } catch (error) {
      console.error(
        `[Bot] Erreur lors du chargement de ${file}:`,
        error
      );
    }
  }

  console.log(
    `[Bot] ${loadedEvents.size} gestionnaire(s) d'événements chargé(s).`
  );
}

/* =========================================================
   ALIAS
========================================================= */

export const loadBotEvents =
  loadEvents;

export default loadEvents;