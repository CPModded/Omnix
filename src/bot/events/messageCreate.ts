import {
  Events,
  type Message,
} from 'discord.js';

import GuildConfig from '../../models/GuildConfig.ts';
import { askOpenRouter } from '../../ai/openrouter.ts';

const AI_COOLDOWN_MS = 3000;

const cooldowns =
  new Map<string, number>();

function isBotMessage(
  message: Message
): boolean {
  return message.author.bot;
}

function getMessageContent(
  message: Message
): string {
  return message.content.trim();
}

function shouldAnswer(
  message: Message
): boolean {
  if (!message.guild) {
    return false;
  }

  if (isBotMessage(message)) {
    return false;
  }

  /*
   * L'IA intervient si :
   *
   * 1. Le bot est mentionné
   * 2. Le message commence par "omnix"
   *
   * Cela évite que l'IA réponde à absolument
   * tous les messages du serveur.
   */

  const mentioned =
    message.mentions.has(
      message.client.user
    );

  const startsWithOmnix =
    /^omnix\b/i.test(
      message.content.trim()
    );

  return mentioned || startsWithOmnix;
}

function cleanPrompt(
  message: Message
): string {
  let content =
    getMessageContent(message);

  /*
   * Retire la mention du bot.
   */
  if (message.client.user) {
    content =
      content.replace(
        new RegExp(
          `<@!?${message.client.user.id}>`,
          'g'
        ),
        ''
      );
  }

  /*
   * Retire "omnix" au début.
   */
  content =
    content.replace(
      /^omnix\b[:,]?\s*/i,
      ''
    );

  return content.trim();
}

async function getGuildConfig(
  guildId: string
) {
  try {
    return await GuildConfig.findOne({
      guildId,
    }).lean();
  } catch (error) {
    console.error(
      '[AI] Erreur GuildConfig :',
      error
    );

    return null;
  }
}

async function execute(
  message: Message
): Promise<void> {
  if (!shouldAnswer(message)) {
    return;
  }

  const prompt =
    cleanPrompt(message);

  if (!prompt) {
    await message.reply(
      '👋 Oui ? Pose-moi ta question.'
    );

    return;
  }

  /*
   * Cooldown anti-spam.
   */
  const key =
    `${message.guild?.id}:${message.author.id}`;

  const now = Date.now();

  const lastUse =
    cooldowns.get(key) ?? 0;

  if (
    now - lastUse <
    AI_COOLDOWN_MS
  ) {
    return;
  }

  cooldowns.set(
    key,
    now
  );

  /*
   * Nettoyage du cooldown.
   */
  setTimeout(
    () => {
      cooldowns.delete(key);
    },
    AI_COOLDOWN_MS
  );

  try {
    const config =
      message.guild
        ? await getGuildConfig(
            message.guild.id
          )
        : null;

    const aiModule =
      config?.modules?.ai;

    /*
     * Si le module IA est explicitement
     * désactivé, on ne répond pas.
     */
    if (
      aiModule &&
      aiModule.enabled === false
    ) {
      return;
    }

    const systemPrompt =
      aiModule?.systemPrompt ??
      [
        'Tu es OMNIX, un assistant intelligent pour Discord.',
        'Réponds clairement et naturellement en français.',
        'Sois utile, concis et respectueux.',
        'Ne prétends jamais être humain.',
        'N’invente pas des informations lorsque tu ne les connais pas.',
      ].join(' ');

    await message.channel.sendTyping();

    console.log(
      `[AI] Message reçu de ${message.author.tag}: ${prompt}`
    );

    const response =
      await askOpenRouter(
        prompt,
        {
          systemPrompt,
          temperature: 0.7,
          maxTokens: 1000,
        }
      );

    /*
     * Discord limite le contenu d'un message
     * à 2000 caractères.
     */
    if (response.length <= 2000) {
      await message.reply(response);

      return;
    }

    /*
     * Découpage propre pour les réponses longues.
     */
    const chunks: string[] = [];

    for (
      let i = 0;
      i < response.length;
      i += 1900
    ) {
      chunks.push(
        response.slice(
          i,
          i + 1900
        )
      );
    }

    await message.reply(
      chunks.shift() ?? 'Réponse vide.'
    );

    for (const chunk of chunks) {
      await message.channel.send(
        chunk
      );
    }

  } catch (error: any) {
    console.error(
      '[AI] Erreur dans l’intercepteur de réponses de l’IA :',
      error
    );

    let errorMessage =
      '❌ Impossible de contacter le service IA actuellement.';

    if (
      typeof error?.message === 'string' &&
      error.message.includes('OPENROUTER_API_KEY')
    ) {
      errorMessage =
        '❌ La clé API OpenRouter n’est pas configurée.';
    }

    if (
      typeof error?.message === 'string' &&
      error.message.includes('429')
    ) {
      errorMessage =
        '⏳ Le service IA a atteint sa limite temporaire. Réessaie dans quelques instants.';
    }

    try {
      await message.reply(
        errorMessage
      );
    } catch (replyError) {
      console.error(
        '[AI] Impossible d’envoyer le message d’erreur :',
        replyError
      );
    }
  }
}

export const name =
  Events.MessageCreate;

export const once = false;

export { execute };

export default {
  name,
  once,
  execute,
};