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
      entry.name.endsWith('.d') ||
      entry.name.endsWith('.test') ||
      entry.name.endsWith('.spec')
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

async function loadModule(file: string): Promise<any> {
  if (file.endsWith('.js') || file.endsWith('.cjs')) return require(file);
  try { return require(file); } catch (error) { const url = pathToFileURL(file).href; return import(url).catch(() => { throw error; }); }
}

/* =========================================================
   CHARGEMENT DES ÉVÉNEMENTS
========================================================= */

export async function loadEvents(
  client: Client,
  eventsPath?: string
): Promise<void> {
  // Idempotence : un même Client ne doit jamais enregistrer deux fois ses
  // listeners, même si le bootstrap est relancé par un script de reload.
  const clientState = client as any;

  const directory = eventsPath ?? (() => {
    const dist = path.join(process.cwd(), 'dist', 'bot', 'events');
    return fs.existsSync(dist) ? dist : path.join(process.cwd(), 'src', 'bot', 'events');
  })();

  const currentPath = path.resolve(directory);
  if (clientState.__omnixEventsLoaded && clientState.__omnixEventsLoadedPath === currentPath) {
    console.warn('[Bot] Événements déjà chargés sur ce client — second chargement ignoré.');
    return;
  }

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
      const normalizedEventName = eventName.toLowerCase();

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
        Array.from(loadedEvents).some((loadedName) => loadedName.toLowerCase() === normalizedEventName)
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

      // Les EventEmitter Node/Discord ne récupèrent pas automatiquement les
      // rejets des fonctions async. Sans ce wrapper, une exception dans un
      // événement Discord peut remonter jusqu'à un Unhandled Rejection.
      const runEvent = (...args: any[]) => {
        try {
          Promise.resolve(event.execute!(...args)).catch((error) => {
            console.error(`[Bot Event] Erreur non gérée dans ${eventName} (${path.basename(file)}) :`, error);
          });
        } catch (error) {
          console.error(`[Bot Event] Exception synchrone dans ${eventName} (${path.basename(file)}) :`, error);
        }
      };

      if (event.once) {
        client.once(eventName, runEvent);
      } else {
        client.on(eventName, runEvent);
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

  console.log(`[Bot] ${loadedEvents.size}/${files.length} gestionnaire(s) d'événements chargé(s).`);
  (client as any).omnixLoadedEvents = [...loadedEvents];
  (client as any).omnixEventLoadStatus = { loaded: loadedEvents.size, discovered: files.length, degraded: loadedEvents.size < files.length };
  clientState.__omnixEventsLoaded = true;
  clientState.__omnixEventsLoadedPath = currentPath;
}

/* =========================================================
   ALIAS
========================================================= */

export const loadBotEvents =
  loadEvents;

export default loadEvents;