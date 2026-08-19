import express, {
  type Request,
  type Response,
} from 'express';

import axios from 'axios';

import jwt from 'jsonwebtoken';

import { CONFIG } from '../../config/index.ts';

import { User } from '../../models/User.ts';


const router =
  express.Router();


/*
 * ==========================================
 * UTILITAIRE JWT
 * ==========================================
 */

function createToken(
  discordId: string
): string {

  return jwt.sign(
    {
      discordId,
    },

    CONFIG.JWT_SECRET,

    {
      expiresIn: '7d',
    }
  );
}


/*
 * ==========================================
 * CONNEXION DISCORD
 * ==========================================
 */

router.get(
  '/login',
  (
    req: Request,
    res: Response
  ) => {

    if (
      !CONFIG.DISCORD.CLIENT_ID
    ) {
      return res
        .status(500)
        .send(
          'DISCORD_CLIENT_ID non configuré.'
        );
    }

    const params =
      new URLSearchParams({
        client_id:
          CONFIG.DISCORD.CLIENT_ID,

        redirect_uri:
          CONFIG.DISCORD.REDIRECT_URI,

        response_type:
          'code',

        scope:
          'identify guilds',
      });


    const url =
      `https://discord.com/oauth2/authorize?${params.toString()}`;


    return res.redirect(url);
  }
);


/*
 * ==========================================
 * CALLBACK DISCORD
 * ==========================================
 */

router.get(
  '/callback',
  async (
    req: Request,
    res: Response
  ) => {

    const code =
      req.query.code;

    if (
      typeof code !== 'string'
    ) {
      return res
        .status(400)
        .send(
          'Code Discord manquant.'
        );
    }


    try {

      /*
       * ÉCHANGE DU CODE
       */

      const tokenResponse =
        await axios.post(
          'https://discord.com/api/oauth2/token',

          new URLSearchParams({
            client_id:
              CONFIG.DISCORD.CLIENT_ID,

            client_secret:
              CONFIG.DISCORD.CLIENT_SECRET,

            grant_type:
              'authorization_code',

            code,

            redirect_uri:
              CONFIG.DISCORD.REDIRECT_URI,
          }).toString(),

          {
            headers: {
              'Content-Type':
                'application/x-www-form-urlencoded',
            },
          }
        );


      const {
        access_token,
        refresh_token,
        expires_in,
      } =
        tokenResponse.data;


      /*
       * RÉCUPÉRATION UTILISATEUR
       */

      const userResponse =
        await axios.get(
          'https://discord.com/api/users/@me',

          {
            headers: {
              Authorization:
                `Bearer ${access_token}`,
            },
          }
        );


      const discordUser =
        userResponse.data;


      /*
       * RÉCUPÉRATION SERVEURS
       */

      const guildResponse =
        await axios.get(
          'https://discord.com/api/users/@me/guilds',

          {
            headers: {
              Authorization:
                `Bearer ${access_token}`,
            },
          }
        );


      const guilds =
        Array.isArray(
          guildResponse.data
        )
          ? guildResponse.data.map(
              (guild: any) => ({
                id: guild.id,

                name: guild.name,

                icon:
                  guild.icon || null,

                owner:
                  Boolean(
                    guild.owner
                  ),

                permissions:
                  guild.permissions,
              })
            )
          : [];


      /*
       * SAUVEGARDE UTILISATEUR
       */

      await User.findOneAndUpdate(

        {
          discordId:
            discordUser.id,
        },

        {
          discordId:
            discordUser.id,

          username:
            discordUser.username,

          globalName:
            discordUser.global_name,

          avatar:
            discordUser.avatar,

          accessToken:
            access_token,

          refreshToken:
            refresh_token,

          tokenExpiresAt:
            new Date(
              Date.now() +
                Number(
                  expires_in || 604800
                ) *
                  1000
            ),

          guilds,
        },

        {
          upsert: true,

          new: true,
        }
      );


      /*
       * JWT
       */

      const token =
        createToken(
          discordUser.id
        );


      /*
       * COOKIE HTTP ONLY
       */

      res.cookie(
        'omnix_token',
        token,

        {
          httpOnly: true,

          secure:
            process.env.NODE_ENV ===
            'production',

          sameSite: 'lax',

          maxAge:
            7 * 24 * 60 * 60 * 1000,
        }
      );


      /*
       * REDIRECTION
       */

      return res.redirect(
        '/dashboard'
      );

    } catch (error: any) {

      console.error(
        '[Discord OAuth]',
        error?.response?.data ||
          error
      );

      return res
        .status(500)
        .send(
          'Impossible de se connecter avec Discord.'
        );
    }
  }
);


/*
 * ==========================================
 * LOGOUT
 * ==========================================
 */

router.get(
  '/logout',
  (
    req: Request,
    res: Response
  ) => {

    res.clearCookie(
      'omnix_token'
    );

    return res.redirect('/');
  }
);


export default router;