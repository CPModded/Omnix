import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import type { Command } from './types';
export class ExtendedClient extends Client {
  public commands: Collection<string, Command>;
  constructor() {
    super({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildModeration, GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildVoiceStates],
      partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User, Partials.GuildMember],
    });
    this.commands = new Collection<string, Command>();
  }
}
export const client = new ExtendedClient();
