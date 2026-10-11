import { Client, Collection, GatewayIntentBits, Partials, Options } from 'discord.js';
import type { Command } from './types';
export class ExtendedClient extends Client {
  public commands: Collection<string, Command>;
  constructor() {
    super({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildModeration, GatewayIntentBits.GuildPresences],
      makeCache: Options.cacheWithLimits({
        MessageManager: 100,
        PresenceManager: 50,
        GuildMemberManager: 250,
        UserManager: 1500,
        ReactionManager: 25,
        ThreadManager: 50,
      }),
      sweepers: {
        messages: { interval: 300, lifetime: 900 },
      },
      partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User, Partials.GuildMember],
    });
    this.commands = new Collection<string, Command>();
  }
}
export const client = new ExtendedClient();
