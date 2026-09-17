import SiteSettings from '../../models/SiteSettings';

import {
  Events,
  type Client,
} from 'discord.js';

import { syncCommands } from '../handlers/commandSync';

export const name = Events.ClientReady;

export const once = true;

export async function execute(
  client: Client
): Promise<void> {
  console.log('');
  console.log('════════════════════════════════════');
  console.log('           OMNIX BOT READY');
  console.log('════════════════════════════════════');

  console.log(
    `[Discord] Connecté en tant que ${client.user?.tag ?? 'Inconnu'}`
  );

  console.log(
    `[Discord] ID : ${client.user?.id ?? 'Inconnu'}`
  );

  console.log(
    `[Discord] Serveurs : ${client.guilds.cache.size}`
  );

  console.log(
    `[Discord] Commandes chargées : ${client.commands?.size ?? 0}`
  );

  try {
    console.log(
      '[CommandSync] Synchronisation Discord...'
    );

    await syncCommands(client);

    console.log(
      '[CommandSync] ✓ Commandes synchronisées avec succès.'
    );
  } catch (error) {
    console.error(
      '[CommandSync] ✗ Échec de la synchronisation :',
      error
    );
  }

  try {
    const settings = await SiteSettings.findOne({ key:'global' }).lean();
    if (settings && client.user) {
      const types:any = { Playing:0, Listening:2, Watching:3, Competing:5 };
      client.user.setPresence({
        status: settings.botStatus || 'online',
        activities: settings.activityEnabled && settings.activityMessage ? [{ name: settings.activityMessage, type: types[settings.activityType] ?? 0 }] : [],
      });
      console.log(`[Presence] ${settings.activityEnabled ? settings.activityType + ' ' + settings.activityMessage : 'activité désactivée'}`);
    }
  } catch (error) {
    console.error('[Presence] Impossible de charger la présence persistée :', error);
  }

  console.log('════════════════════════════════════');
  console.log('             OMNIX ONLINE');
  console.log('════════════════════════════════════');
  console.log('');
}

export default {
  name,
  once,
  execute,
};