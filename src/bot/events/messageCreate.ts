import { Events, Message, EmbedBuilder } from 'discord.js';
import { OpenAI } from 'openai';
import GuildConfig from '../../models/GuildConfig'; //  CORRIGÉ (../../ et sans .ts)
import AiSession from '../../models/AiSession';     //  CORRIGÉ (../../ et sans .ts)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

// Élague l'historique de fin vers le début pour ne garder que les 500 mots les plus récents
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

export default {
  name: Events.MessageCreate,
  async execute(message: Message) {
    // Ne pas répondre aux robots ou aux messages privés
    if (message.author.bot || !message.guildId) return;

    // Vérifier si le message est une réponse à un autre message
    if (!message.reference || !message.reference.messageId) return;

    try {
      // Récupérer le message référencé (celui auquel l'utilisateur a répondu)
      const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
      
      // Si l'auteur du message d'origine n'est pas votre bot OMNIX, on ignore
      if (referencedMessage.author.id !== message.client.user.id) return;

      // Déclencher l'indicateur d'écriture pour montrer que l'IA réfléchit
      await message.channel.sendTyping();

      // 1. Charger la configuration et vérifier si l'IA est active
      const config = await GuildConfig.findOne({ guildId: message.guildId });
      if (!config?.modules?.ai?.enabled) return;

      const systemPrompt = config.modules.ai.systemPrompt || "Tu es un assistant utile sur ce serveur Discord.";
      const userQuestion = message.content;

      // 2. Récupérer la session isolée
      let session = await AiSession.findOne({ userId: message.author.id, guildId: message.guildId });
      let history: MessagePayload[] = session ? (session.messages as MessagePayload[]) : [];

      // Ajouter le nouveau message de l'utilisateur
      history.push({ role: 'user', content: userQuestion });

      // 3. Élaguer pour ne pas dépasser 500 mots
      let prunedHistory = pruneMessagesToLimit(history, 500);

      // 4. Appel de l'IA
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'system', content: systemPrompt }, ...prunedHistory],
        max_tokens: 400,
      });

      const aiAnswer = response.choices[0]?.message?.content || "Je n'ai pas pu formuler de réponse.";

      // Ajouter la réponse de l'assistant à l'historique
      history.push({ role: 'assistant', content: aiAnswer });

      // Sauvegarder dans MongoDB
      await AiSession.findOneAndUpdate(
        { userId: message.author.id, guildId: message.guildId },
        { messages: history, updatedAt: new Date() },
        { upsert: true, new: true }
      );

      // 5. Envoi de la réponse sous forme d'un magnifique Embed
      const currentMemoryWords = getWordCount(prunedHistory) + getWordCount(aiAnswer);

      const embed = new EmbedBuilder()
        .setColor('#8B5CF6')
        .setAuthor({ name: 'OMNIX Intelligence Artificielle', iconURL: message.client.user.displayAvatarURL() })
        .setDescription(aiAnswer)
        .setFooter({ text: `Mémoire active : ${currentMemoryWords}/500 mots • Session isolée` });

      // Répondre directement au message de l'utilisateur
      await message.reply({ embeds: [embed] });

    } catch (error) {
      console.error("Erreur dans l'intercepteur de réponses de l'IA :", error);
    }
  }
};