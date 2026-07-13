import fs from 'fs';
import path from 'path';
import { ExtendedClient } from '../client';

export async function loadCommands(client: ExtendedClient) {
  const commandsPath = path.join(__dirname, '../commands');
  if (!fs.existsSync(commandsPath)) return;

  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const commandModule = await import(filePath);
    const command = commandModule.default;

    if (command && 'data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
    }
  }
  console.log(`[Bot] ${client.commands.size} commandes slash chargées en mémoire.`);
}