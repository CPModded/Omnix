import { SlashCommandBuilder } from 'discord.js';
import axios from 'axios';
import { Command, CommandContext } from '../types';
import { AIMemory } from '../../models/AIMemory';
import { checkPremium } from '../utils/premiumGuard'; // Import du gardien Premium

const aiCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ai')
    .setDescription('Posez une question à l\'IA (Premium Only)')
    .addStringOption(option => 
      option.setName('prompt')
        .setDescription('Votre question')
        .setRequired(true)
    ) as any,

  async execute({ interaction, guildConfig }: CommandContext) {
    // 1. BLOCAGE PREMIUM : Si le serveur n'est pas Premium, on arrête l'exécution ici
    if (!checkPremium(interaction, guildConfig)) return;

    const prompt = interaction.options.getString('prompt', true);

    // Vérification de l'activation du module
    if (!guildConfig.modules.ai.enabled) {
      return interaction.reply({
        content: "Le module IA n'est pas activé sur ce serveur.",
        ephemeral: true
      });
    }

    await interaction.deferReply();

    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const channelId = interaction.channelId;

    try {
      let chatSession = await AIMemory.findOne({ guildId, channelId, userId });
      if (!chatSession) {
        chatSession = new AIMemory({ guildId, channelId, userId, messages: [] });
      }

      const limit = guildConfig.modules.ai.contextLimit || 10;
      if (chatSession.messages.length > limit) {
        chatSession.messages = chatSession.messages.slice(-limit);
      }

      const systemMessage = {
        role: 'system' as const,
        content: guildConfig.modules.ai.systemPrompt || "Tu es un assistant utile."
      };

      const formattedHistory = chatSession.messages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content
      }));

      const apiMessages = [
        systemMessage,
        ...formattedHistory,
        { role: 'user' as const, content: prompt }
      ];

      const openAiResponse = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: apiMessages,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const aiReply = openAiResponse.data.choices[0].message.content;

      chatSession.messages.push({ role: 'user', content: prompt, timestamp: new Date() });
      chatSession.messages.push({ role: 'assistant', content: aiReply, timestamp: new Date() });
      await chatSession.save();

      await interaction.editReply({ content: aiReply });

    } catch (error: any) {
      console.error('[AI Module Error]:', error?.response?.data || error.message);
      await interaction.editReply({
        content: "Impossible d'obtenir une réponse de l'IA pour le moment."
      });
    }
  }
};

export default aiCommand;