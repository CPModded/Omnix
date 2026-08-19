import type { Client } from 'discord.js';

export const name = 'ready';
export const once = true;

export async function execute(
  client: Client
): Promise<void> {

  console.log('');
  console.log('==========================================');
  console.log('           OMNIX BOT READY');
  console.log('==========================================');

  console.log(
    `[Bot] 🟢 Connecté en tant que ${client.user?.tag}`
  );

  console.log(
    `[Bot] 🆔 ID : ${client.user?.id}`
  );

  console.log(
    `[Bot] 🏠 Serveurs : ${client.guilds.cache.size}`
  );

  console.log(
    `[Bot] ⚡ Commandes chargées : ${
      (client as any).commands?.size || 0
    }`
  );

  console.log('==========================================');
  console.log('');

  /*
   * IMPORTANT :
   *
   * La synchronisation des commandes slash
   * est maintenant effectuée dans src/index.ts.
   *
   * NE PAS créer ici de REST().
   * NE PAS appeler rest.put() ici.
   *
   * Cela évite d'avoir deux systèmes de
   * synchronisation simultanés.
   */
}