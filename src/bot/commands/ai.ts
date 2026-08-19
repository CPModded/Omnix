import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder
} from 'discord.js';

import { GuildConfig } from '../../models/GuildConfig.ts';
import AiSession from '../../models/AiSession.ts';

import { askOpenRouter } from '../../ai/openrouter.ts';

interface MessagePayload {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Calcule le nombre de mots d'un texte ou d'une liste de messages
function getWordCount(
  textOrMessages: string | MessagePayload[]
): number {

  if (typeof textOrMessages === 'string') {
    return textOrMessages
      .split(/\s+/)
      .filter(Boolean)
      .length;
  }

  return textOrMessages.reduce(
    (acc, msg) =>
      acc +
      msg.content
        .split(/\s+/)
        .filter(Boolean)
        .length,
    0
  );
}

// Élague l'historique pour ne garder que les 500 mots les plus récents
function pruneMessagesToLimit(
  messages: MessagePayload[],
  maxWords = 500
): MessagePayload[] {

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
  .setDescription(
    'Démarre une conversation intelligente avec l\'IA d\'OMNIX'
  )
  .addStringOption(option =>
    option
      .setName('question')
      .setDescription('Votre question pour l\'IA')
      .setRequired(true)
  );

export async function execute({
  interaction
}: {
  interaction: ChatInputCommandInteraction
}) {

  const { guildId, user } = interaction;

  if (!guildId) {
    return interaction.reply({
      content:
        'Cette commande s\'exécute uniquement sur serveur.',
      ephemeral: true
    });
  }

  await interaction.deferReply();

  try {

    // ==========================================
    // 1. CONFIGURATION DU SERVEUR
    // ==========================================

    const config = await GuildConfig.findOne({
      guildId
    });

    if (!config?.modules?.ai?.enabled) {
      return interaction.editReply(
        '❌ Le module IA est désactivé sur ce serveur.'
      );
    }

    // ==========================================
    // 2. QUESTION UTILISATEUR
    // ==========================================

    const question =
      interaction.options.getString(
        'question',
        true
      );

    // ==========================================
    // 3. SYSTEM PROMPT
    // ==========================================

    const systemPrompt =
      config.modules.ai.systemPrompt ||
      'Tu es un assistant utile sur ce serveur Discord.';

    // ==========================================
    // 4. SESSION ISOLÉE
    // ==========================================

    let session = await AiSession.findOne({
      userId: user.id,
      guildId
    });

    let history: MessagePayload[] =
      session
        ? (session.messages as MessagePayload[])
        : [];

    // ==========================================
    // 5. AJOUT DE LA QUESTION
    // ==========================================

    history.push({
      role: 'user',
      content: question
    });

    // ==========================================
    // 6. LIMITATION DE L'HISTORIQUE
    // ==========================================

    const prunedHistory =
      pruneMessagesToLimit(
        history,
        500
      );

    // ==========================================
    // 7. CONSTRUCTION DU PROMPT
    // ==========================================

    const messagesForAI = [
      {
        role: 'system' as const,
        content: systemPrompt
      },
      ...prunedHistory
    ];

    const aiPrompt = messagesForAI
      .map(message => {
        return `${message.role.toUpperCase()}: ${message.content}`;
      })
      .join('\n\n');

    // ==========================================
    // 8. APPEL OPENROUTER
    // ==========================================

    const aiAnswer =
      await askOpenRouter(aiPrompt);

    // ==========================================
    // 9. SAUVEGARDE DE LA RÉPONSE
    // ==========================================

    history.push({
      role: 'assistant',
      content: aiAnswer
    });

    await AiSession.findOneAndUpdate(
      {
        userId: user.id,
        guildId
      },
      {
        messages: history,
        updatedAt: new Date()
      },
      {
        upsert: true,
        new: true
      }
    );

    // ==========================================
    // 10. MÉMOIRE
    // ==========================================

    const currentMemoryWords =
      getWordCount(prunedHistory) +
      getWordCount(aiAnswer);

    // ==========================================
    // 11. RÉPONSE DISCORD
    // ==========================================

    const embed = new EmbedBuilder()
      .setColor('#8B5CF6')
      .setAuthor({
        name: 'OMNIX Intelligence Artificielle',
        iconURL:
          interaction.client.user.displayAvatarURL()
      })
      .setDescription(
        `**Question :** *${question}*\n\n${aiAnswer}`
      )
      .setFooter({
        text:
          `Mémoire active : ${currentMemoryWords}/500 mots • Session isolée`
      });

    await interaction.editReply({
      embeds: [embed]
    });

  } catch (error) {

    console.error(
      'Erreur commande /ai :',
      error
    );

    await interaction.editReply(
      '❌ Une erreur est survenue lors du traitement de l\'IA.'
    );
  }
}