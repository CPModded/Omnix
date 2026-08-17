import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { OpenAI } from 'openai';
import { GuildConfig } from '../../models/GuildConfig.ts'; // Named import avec accolades
import AiSession from '../../models/AiSession.ts';

interface MessagePayload {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Calcule le nombre de mots d'un texte ou d'une liste de messages
function getWordCount(textOrMessages: string | MessagePayload[]): number {
  if (typeof textOrMessages === 'string') {
    return textOrMessages.split(/\s+/).filter(Boolean).length;
  }
  return textOrMessages.reduce((acc, msg) => acc + msg.content.split(/\s+/).filter(Boolean).length, 0);
}

// Élague l'historique pour ne garder que les 500 mots les plus récents
function pruneMessagesToLimit(messages: MessagePayload[], maxWords = 500): MessagePayload[] {
  let currentWords = 0;
  const result: MessagePayload[] = [];
  
  for (let i = messages.length - 1; i >= 0; i--) {
    const words = getWordCount(messages[i].content);
    if (currentWords + words > maxWords) {
      break;
    }
    currentWords += words;
    result.unshift(messages[i]);
  }
  return result;
}

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

    // Vérification de sécurité de la clé API au moment de l'exécution
    if (!process.env.OPENAI_API_KEY) {
      return interaction.editReply("❌ L'API Key de l'IA (OPENAI_API_KEY) n'est pas configurée dans les variables d'environnement du serveur.");
    }

    // 🟢 INITIALISATION DYNAMIQUE (Évite le plantage au chargement global sur Render)
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Récupérer la session isolée (Utilisateur + Serveur)
    let session = await AiSession.findOne({ userId: user.id, guildId });
    let history: MessagePayload[] = session ? (session.messages as MessagePayload[]) : [];

    history.push({ role: 'user', content: question });

    // Élaguer l'historique sous la barre des 500 mots
    let prunedHistory = pruneMessagesToLimit(history, 500);

    // Appel à l'IA
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'system', content: systemPrompt }, ...prunedHistory],
      max_tokens: 400,
    });

    const aiAnswer = response.choices[0]?.message?.content || "Désolé, je n'ai pas pu formuler de réponse.";
    
    history.push({ role: 'assistant', content: aiAnswer });

    await AiSession.findOneAndUpdate(
      { userId: user.id, guildId },
      { messages: history, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    const currentMemoryWords = getWordCount(prunedHistory) + getWordCount(aiAnswer);

    const embed = new EmbedBuilder()
      .setColor('#8B5CF6')
      .setAuthor({ name: 'OMNIX Intelligence Artificielle', iconURL: interaction.client.user.displayAvatarURL() })
      .setDescription(`**Question :** *${question}*\n\n${aiAnswer}`)
      .setFooter({ text: `Mémoire active : ${currentMemoryWords}/500 mots • Session isolée` });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error("Erreur commande /ai :", error);
    await interaction.editReply("❌ Une erreur est survenue lors du traitement de l'IA.");
  }
}