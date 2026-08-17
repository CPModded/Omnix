import { Events, Message, EmbedBuilder } from 'discord.js';
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
    if (message.author.bot || !message.guildId) return;

    // Vérifier si le message est une réponse à un autre message
    if (!message.reference || !message.reference.messageId) return;

    try {
      const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
      
      // Si l'auteur du message d'origine n'est pas votre bot OMNIX, on ignore
      if (referencedMessage.author.id !== message.client.user.id) return;

      // S'il n'y a pas de clé API configurée localement, on ignore silencieusement
      if (!process.env.OPENAI_API_KEY) return;

      await message.channel.sendTyping();

      // Charger la configuration et vérifier si l'IA est active
      const config = await GuildConfig.findOne({ guildId: message.guildId });
      if (!config?.modules?.ai?.enabled) return;

      const systemPrompt = config.modules.ai.systemPrompt || "Tu es un assistant utile sur ce serveur Discord.";
      const userQuestion = message.content;

      // 🟢 INITIALISATION DYNAMIQUE (Évite le plantage au chargement global sur Render)
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // Récupérer la session isolée
      let session = await AiSession.findOne({ userId: message.author.id, guildId: message.guildId });
      let history: MessagePayload[] = session ? (session.messages as MessagePayload[]) : [];

      history.push({ role: 'user', content: userQuestion });

      // Élaguer pour ne pas dépasser 500 mots
      let prunedHistory = pruneMessagesToLimit(history, 500);

      // Appel de l'IA
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'system', content: systemPrompt }, ...prunedHistory],
        max_tokens: 400,
      });

      const aiAnswer = response.choices[0]?.message?.content || "Je n'ai pas pu formuler de réponse.";

      history.push({ role: 'assistant', content: aiAnswer });

      await AiSession.findOneAndUpdate(
        { userId: message.author.id, guildId: message.guildId },
        { messages: history, updatedAt: new Date() },
        { upsert: true, new: true }
      );

      const currentMemoryWords = getWordCount(prunedHistory) + getWordCount(aiAnswer);

      const embed = new EmbedBuilder()
        .setColor('#8B5CF6')
        .setAuthor({ name: 'OMNIX Intelligence Artificielle', iconURL: message.client.user.displayAvatarURL() })
        .setDescription(aiAnswer)
        .setFooter({ text: `Mémoire active : ${currentMemoryWords}/500 mots • Session isolée` });

      await message.reply({ embeds: [embed] });

    } catch (error) {
      console.error("Erreur dans l'intercepteur de réponses de l'IA :", error);
    }
  }
};