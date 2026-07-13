import fs from 'fs';
import path from 'path';
import { ExtendedClient } from '../client';

export async function loadEvents(client: ExtendedClient) {
  const eventsPath = path.join(__dirname, '../events');
  if (!fs.existsSync(eventsPath)) return;

  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

  let count = 0;
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const eventModule = await import(filePath);
    const event = eventModule.default;

    if (event && 'name' in event && 'execute' in event) {
      count++;
      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }
    }
  }
  console.log(`[Bot] ${count} gestionnaires d'événements chargés.`);
}