// src/commands/ai.ts
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { OpenAI } from 'openai';
import GuildConfig from '../models/GuildConfig';
import AiSession from '../models/AiSession';
import { getWordCount, pruneMessagesToLimit, MessagePayload } from '../services/aiService';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const data = new SlashCommandBuilder()
  .setName('ai')
  .setDescription('Démarre une conversation intelligente avec l\'IA d\'OMNIX')
  .addStringOption(option =>
    option.setName('question')
      .setDescription('Votre question pour l\'IA')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const { guildId, user } = interaction;
  if (!guildId) return interaction.reply({ content: "Cette commande s'exécute uniquement sur serveur.", ephemeral: true });

  await interaction.deferReply();

  try {
    const config = await GuildConfig.findOne({ guildId });
    if (!config?.modules?.ai?.enabled) {
      return interaction.editReply("❌ Le module IA est désactivé sur ce serveur.");
    }

    const question = interaction.options.getString('question', true);
    const systemPrompt = config.modules.ai.systemPrompt || "Tu es un assistant utile sur ce serveur Discord.";

    // 1. Récupérer ou initialiser la session isolée (Utilisateur + Serveur)
    let session = await AiSession.findOne({ userId: user.id, guildId });
    let history: MessagePayload[] = session ? (session.messages as MessagePayload[]) : [];

    // Ajouter la question de l'utilisateur
    history.push({ role: 'user', content: question });

    // 2. Élaguer l'historique sous la barre des 500 mots
    let prunedHistory = pruneMessagesToLimit(history, 500);

    // 3. Appel à OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'system', content: systemPrompt }, ...prunedHistory],
      max_tokens: 400,
    });

    const aiAnswer = response.choices[0]?.message?.content || "Désolé, je n'ai pas pu formuler de réponse.";
    
    // Sauvegarder la réponse de l'assistant dans l'historique
    history.push({ role: 'assistant', content: aiAnswer });

    // Mettre à jour l'historique dans la base MongoDB
    await AiSession.findOneAndUpdate(
      { userId: user.id, guildId },
      { messages: history, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    // 4. Construction de l'Embed de réponse
    const currentMemoryWords = getWordCount(prunedHistory) + getWordCount(aiAnswer);

    const embed = new EmbedBuilder()
      .setColor('#8B5CF6') // Violet OMNIX
      .setAuthor({ name: 'OMNIX Intelligence Artificielle', iconURL: interaction.client.user.displayAvatarURL() })
      .setDescription(`**Question :** *${question}*\n\n${aiAnswer}`)
      .setFooter({ text: `Mémoire active : ${currentMemoryWords}/500 mots • Session isolée` });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error("Erreur commande /ai :", error);
    await interaction.editReply("❌ Une erreur est survenue lors du traitement de l'IA.");
  }
}