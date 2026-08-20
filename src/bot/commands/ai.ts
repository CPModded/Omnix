import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';

import { askOpenRouter } from '../../ai/openrouter.ts';

/* =========================================================
   OMNIX AI
   /ai message:<texte>

   Compatible avec ancienne option :
   /ai question:<texte>
========================================================= */

const command = {
  data: new SlashCommandBuilder()
    .setName('ai')
    .setDescription(
      'Discute avec l’intelligence artificielle OMNIX.'
    )
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription(
          'Le message à envoyer à OMNIX.'
        )
        .setRequired(true)
        .setMaxLength(4000)
    ),

  async execute(
    interaction: ChatInputCommandInteraction
  ): Promise<void> {

    /* =====================================================
       RÉCUPÉRATION BRUTE DES OPTIONS
       
       IMPORTANT :
       On NE fait PAS :
       getString('message', true)

       car Discord peut encore envoyer l'ancienne
       définition "question".
    ===================================================== */

    const options =
      interaction.options.data;

    console.log(
      '[AI] Options reçues :',
      JSON.stringify(
        options,
        null,
        2
      )
    );

    /* =====================================================
       RECHERCHE DE L'OPTION
    ===================================================== */

    let message: string | undefined;

    for (const option of options) {
      if (
        option.name === 'message' &&
        typeof option.value === 'string'
      ) {
        message =
          option.value;

        break;
      }

      /*
       * Compatibilité avec l'ancienne commande.
       */

      if (
        option.name === 'question' &&
        typeof option.value === 'string'
      ) {
        message =
          option.value;
      }
    }

    /* =====================================================
       AUCUN MESSAGE
    ===================================================== */

    if (
      !message ||
      !message.trim()
    ) {
      console.error(
        '[AI] Impossible de trouver une option message/question.'
      );

      console.error(
        '[AI] Options Discord reçues :',
        options
      );

      if (
        interaction.replied ||
        interaction.deferred
      ) {
        await interaction.editReply({
          content:
            '❌ Aucun message n’a été fourni à OMNIX.',
          embeds: [],
          components: [],
        });
      } else {
        await interaction.reply({
          content:
            '❌ Aucun message n’a été fourni à OMNIX.',
          flags: 64,
        });
      }

      return;
    }

    message =
      message.trim();

    /* =====================================================
       LIMITE
    ===================================================== */

    if (
      message.length > 4000
    ) {
      await interaction.reply({
        content:
          '❌ Ton message est trop long. Maximum : 4000 caractères.',
        flags: 64,
      });

      return;
    }

    /* =====================================================
       DEFER
    ===================================================== */

    await interaction.deferReply();

    try {

      /* ===================================================
         OPENROUTER
      =================================================== */

      const result =
        await askOpenRouter(
          message
        );

      /* ===================================================
         NORMALISATION
      =================================================== */

      let answer = '';

      if (
        typeof result === 'string'
      ) {
        answer = result;
      } else if (
        result &&
        typeof result === 'object'
      ) {
        const response =
          result as any;

        answer =
          response.answer ??
          response.content ??
          response.message ??
          response.text ??
          response.response ??
          '';
      }

      answer =
        String(answer ?? '').trim();

      /* ===================================================
         RÉPONSE VIDE
      =================================================== */

      if (!answer) {
        console.error(
          '[AI] Réponse IA vide :',
          result
        );

        await interaction.editReply({
          content:
            '❌ OMNIX AI n’a reçu aucune réponse.',
          embeds: [],
          components: [],
        });

        return;
      }

      /* ===================================================
         RÉPONSE NORMALE
      =================================================== */

      if (
        answer.length <= 4096
      ) {
        const embed =
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setAuthor({
              name:
                'OMNIX AI',
            })
            .setDescription(
              answer
            )
            .setFooter({
              text:
                `Demandé par ${interaction.user.tag}`,
            })
            .setTimestamp();

        await interaction.editReply({
          embeds: [embed],
        });

        return;
      }

      /* ===================================================
         RÉPONSE LONGUE
      =================================================== */

      const chunks: string[] = [];

      for (
        let i = 0;
        i < answer.length;
        i += 3900
      ) {
        chunks.push(
          answer.slice(
            i,
            i + 3900
          )
        );
      }

      /* ===================================================
         PREMIER EMBED
      =================================================== */

      const firstEmbed =
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setAuthor({
            name:
              'OMNIX AI',
          })
          .setDescription(
            chunks[0]
          )
          .setFooter({
            text:
              `Demandé par ${interaction.user.tag}`,
          })
          .setTimestamp();

      await interaction.editReply({
        embeds: [firstEmbed],
      });

      /* ===================================================
         EMBEDS SUIVANTS
      =================================================== */

      for (
        let i = 1;
        i < chunks.length;
        i++
      ) {
        await interaction.followUp({
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865f2)
              .setDescription(
                chunks[i]
              ),
          ],
        });
      }

    } catch (error) {

      /* ===================================================
         ERREUR
      =================================================== */

      console.error(
        '[AI] Erreur :',
        error
      );

      const errorMessage =
        '❌ Une erreur est survenue pendant la communication avec OMNIX AI.';

      try {

        if (
          interaction.deferred ||
          interaction.replied
        ) {
          await interaction.editReply({
            content:
              errorMessage,
            embeds: [],
            components: [],
          });
        } else {
          await interaction.reply({
            content:
              errorMessage,
            flags: 64,
          });
        }

      } catch (replyError) {

        console.error(
          '[AI] Impossible de répondre à l’erreur :',
          replyError
        );
      }
    }
  },
};

export default command;