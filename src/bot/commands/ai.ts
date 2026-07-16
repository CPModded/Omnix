import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../types';

export default {
  data: new SlashCommandBuilder()
    .setName('ai')
    .setDescription('Posez une question à l\'intelligence artificielle d\'OMNIX.')
    .addStringOption(option => 
      option.setName('question')
        .setDescription('Votre question à l\'IA')
        .setRequired(true)
    ),

  async execute({ interaction, guildConfig }) {
    await interaction.deferReply();

    const question = interaction.options.getString('question', true);
    
    // Le contrôle d'état ON/OFF et de Premium est déjà géré par interactionCreate.ts !
    try {
      const systemPrompt = guildConfig.modules.ai.systemPrompt || "Tu es un assistant utile.";
      
      // Ici s'exécute votre logique d'appel (OpenAI, Anthropic ou autre service tiers)
      const aiResponse = `🤖 **OMNIX IA**\n\n*Question : ${question}*\n\n*(Logique d'API intégrée : Réponse générée à partir du prompt system "${systemPrompt}")*`;
      
      await interaction.editReply({ content: aiResponse });
    } catch (error: any) {
      console.error('[AI Command Error] :', error);
      await interaction.editReply({ content: "❌ Impossible de joindre le service d'intelligence artificielle." });
    }
  }
} as Command;