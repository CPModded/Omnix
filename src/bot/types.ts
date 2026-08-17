import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import type { IGuildConfig } from '../models/GuildConfig.ts';

export interface CommandContext {
  interaction: ChatInputCommandInteraction;
  guildConfig: IGuildConfig; // Configuration MongoDB unique au serveur émetteur
}

export interface Command {
  data: Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
  execute: (ctx: CommandContext) => Promise<void>;
}