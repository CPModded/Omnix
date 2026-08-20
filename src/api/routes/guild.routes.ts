import {
  Router,
  type Request,
  type Response,
} from 'express';

import axios from 'axios';
import jwt from 'jsonwebtoken';

import {
  isAuthenticated,
  type AuthenticatedRequest,
} from '../middlewares/auth.ts';

import { User } from '../../models/User.ts';


/* =========================================================
   ROUTER
========================================================= */

const router =
  Router();


/* =========================================================
   CONFIGURATION
========================================================= */

const CLIENT_ID =
  process.env.DISCORD_CLIENT_ID ||
  process.env.DISCORD_CLIENTID ||
  '';

const CLIENT_SECRET =
  process.env.DISCORD_CLIENT_SECRET ||
  process.env.DISCORD_CLIENTSECRET ||
  '';

const REDIRECT_URI =
  process.env.DISCORD_REDIRECT_URI ||
  process.env.DISCORD_CALLBACK_URL ||
  process.env.DISCORD_REDIRECT_URL ||
  '';


const CLIENT_URL =
  process.env.CLIENT_URL ||
  process.env.FRONTEND_URL ||
  '';


const JWT_SECRET =
  process.env.JWT_SECRET ||
  '';


/* =========================================================
   VALIDATION CONFIG
========================================================= */

function validateConfig(): string | null {

  if (!CLIENT_ID) {
    return 'DISCORD_CLIENT_ID manquant.';
  }

  if (!CLIENT_SECRET) {
    return 'DISCORD_CLIENT_SECRET manquant.';
  }

  if (!REDIRECT_URI) {
    return 'DISCORD_REDIRECT_URI manquant.';
  }

  if (
    !JWT_SECRET ||
    JWT_SECRET.length < 16
  ) {

    return 'JWT_SECRET manquant ou trop court.';

  }

  return null;

}


/* =========================================================
   COOKIE OPTIONS
========================================================= */

const cookieOptions = {
  httpOnly: true,

  secure:
    process.env.NODE_ENV ===
    'production',

  sameSite:
    'lax' as const,

  maxAge:
    7 *
    24 *
    60 *
    60 *
    1000,

  path: '/',
};


/* =========================================================
   LOGIN
========================================================= */

/**
 * GET /api/auth/login
 */

router.get(
  '/login',
  (
    req: Request,
    res: Response
  ) => {

    const configError =
      validateConfig();

    if (configError) {

      console.error(
        `[OAuth] ${configError}`
      );

      return res.status(
        500
      ).send(
        configError
      );

    }


    const params =
      new URLSearchParams({
        client_id:
          CLIENT_ID,

        redirect_uri:
          REDIRECT_URI,

        response_type:
          'code',

        scope:
          'identify guilds',
      });


    const discordUrl =
      `https://discord.com/oauth2/authorize?${params.toString()}`;


    return res.redirect(
      discordUrl
    );

  }
);


/* =========================================================
   CALLBACK
========================================================= */

/**
 * GET /api/auth/callback
 */

router.get(
  '/callback',
  async (
    req: Request,
    res: Response
  ) => {

    try {

      const code =
        typeof req.query.code ===
        'string'
          ? req.query.code
          : null;


      if (!code) {

        console.error(
          '[OAuth] Aucun code OAuth reçu.'
        );

        return res.redirect(
          '/login?error=oauth_code_missing'
        );

      }


      const configError =
        validateConfig();

      if (configError) {

        console.error(
          `[OAuth] ${configError}`
        );

        return res.redirect(
          '/login?error=oauth_config'
        );

      }


      /* ===================================================
         TOKEN DISCORD
      =================================================== */

      const tokenResponse =
        await axios.post(
          'https://discord.com/api/oauth2/token',

          new URLSearchParams({
            client_id:
              CLIENT_ID,

            client_secret:
              CLIENT_SECRET,

            grant_type:
              'authorization_code',

            code,

            redirect_uri:
              REDIRECT_URI,
          }).toString(),

          {
            headers: {
              'Content-Type':
                'application/x-www-form-urlencoded',
            },
          }
        );


      const discordAccessToken =
        tokenResponse.data
          ?.access_token;


      if (!discordAccessToken) {

        throw new Error(
          'Discord access_token manquant.'
        );

      }


      /* ===================================================
         DISCORD USER
      =================================================== */

      const userResponse =
        await axios.get(
          'https://discord.com/api/users/@me',
          {
            headers: {
              Authorization:
                `Bearer ${discordAccessToken}`,
            },
          }
        );


      const discordUser =
        userResponse.data;


      if (
        !discordUser?.id
      ) {

        throw new Error(
          'Utilisateur Discord invalide.'
        );

      }


      /* ===================================================
         DISCORD GUILDS
      =================================================== */

      let discordGuilds: unknown[] =
        [];

      try {

        const guildResponse =
          await axios.get(
            'https://discord.com/api/users/@me/guilds',
            {
              headers: {
                Authorization:
                  `Bearer ${discordAccessToken}`,
              },
            }
          );

        if (
          Array.isArray(
            guildResponse.data
          )
        ) {

          discordGuilds =
            guildResponse.data;

        }

      } catch (guildError) {

        console.warn(
          '[OAuth] Impossible de récupérer les guilds :',
          guildError
        );

      }


      /* ===================================================
         OWNER
      =================================================== */

      const ownerIds =
        String(
          process.env.OWNER_IDS ||
          ''
        )
        .split(',')
        .map(
          id =>
            id.trim()
        )
        .filter(
          Boolean
        );


      const isOwner =
        ownerIds.includes(
          String(
            discordUser.id
          )
        );


      /* ===================================================
         USER DATABASE
      =================================================== */

      let databaseUser:
        any = null;


      try {

        databaseUser =
          await User.findOneAndUpdate(

            {
              discordId:
                String(
                  discordUser.id
                ),
            },

            {
              $set: {

                discordId:
                  String(
                    discordUser.id
                  ),

                username:
                  discordUser.username,

                global_name:
                  discordUser.global_name ||
                  null,

                avatar:
                  discordUser.avatar ||
                  null,

                email:
                  discordUser.email ||
                  null,

                lastLogin:
                  new Date(),

              },

            },

            {
              new: true,

              upsert: true,

              setDefaultsOnInsert:
                true,
            }

          ).lean();

      } catch (databaseError) {

        console.warn(
          '[OAuth] MongoDB utilisateur indisponible :',
          databaseError
        );

      }


      /* ===================================================
         PLAN
      =================================================== */

      const plan =
        databaseUser?.plan ||
        databaseUser?.subscription ||
        (
          databaseUser?.premium
            ? 'Premium'
            : 'Free'
        );


      /* ===================================================
         JWT PAYLOAD
      =================================================== */

      const payload = {

        id:
          String(
            discordUser.id
          ),

        discordId:
          String(
            discordUser.id
          ),

        username:
          discordUser.username,

        global_name:
          discordUser.global_name ||
          null,

        avatar:
          discordUser.avatar ||
          null,

        owner:
          isOwner,

        premium:
          Boolean(
            databaseUser?.premium
          ),

        plan,

        guildsCount:
          discordGuilds.length,

        iat:
          Math.floor(
            Date.now() / 1000
          ),

      };


      /* ===================================================
         JWT
      =================================================== */

      const token =
        jwt.sign(
          payload,
          JWT_SECRET,
          {
            expiresIn:
              '7d',
          }
        );


      /* ===================================================
         COOKIE
      =================================================== */

      res.cookie(
        'omnix_token',
        token,
        cookieOptions
      );


      /*
       * On conserve également le token dans la redirection
       * afin que ton Dashboard actuel puisse l'enregistrer
       * dans localStorage.
       *
       * Le cookie reste la vraie session backend.
       */

      console.log(
        `[OAuth] Connexion réussie : ${discordUser.id} | owner=${isOwner} | guilds=${discordGuilds.length}`
      );


      /* ===================================================
         REDIRECT DASHBOARD
      =================================================== */

      return res.redirect(
        '/dashboard'
      );

    } catch (error: any) {

      console.error(
        '[OAuth] Erreur callback :',
        error?.response?.data ||
        error
      );

      return res.redirect(
        '/login?error=oauth_failed'
      );

    }

  }
);


/* =========================================================
   CURRENT USER
========================================================= */

/**
 * GET /api/auth/me
 */

router.get(
  '/me',
  isAuthenticated,
  async (
    req: Request,
    res: Response
  ) => {

    try {

      const authenticatedRequest =
        req as AuthenticatedRequest;


      const jwtUser =
        authenticatedRequest.user;


      if (!jwtUser) {

        return res.status(
          401
        ).json({
          success: false,
          error:
            'Utilisateur non authentifié.',
        });

      }


      /*
       * On recharge l'utilisateur depuis MongoDB
       * lorsque possible.
       */

      let databaseUser:
        any = null;


      try {

        databaseUser =
          await User.findOne({
            discordId:
              String(
                jwtUser.discordId ||
                jwtUser.id
              ),
          }).lean();

      } catch (databaseError) {

        console.warn(
          '[Auth] MongoDB indisponible pour /me :',
          databaseError
        );

      }


      const user = {

        ...jwtUser,

        ...(databaseUser || {}),

        id:
          String(
            jwtUser.id
          ),

        discordId:
          String(
            jwtUser.discordId ||
            jwtUser.id
          ),

        username:
          databaseUser?.username ||
          jwtUser.username,

        global_name:
          databaseUser?.global_name ||
          jwtUser.global_name,

        avatar:
          databaseUser?.avatar ||
          jwtUser.avatar,

        owner:
          Boolean(
            jwtUser.owner
          ),

        premium:
          Boolean(
            databaseUser?.premium ??
            jwtUser.premium
          ),

        plan:
          databaseUser?.plan ||
          databaseUser?.subscription ||
          jwtUser.plan ||
          'Free',

      };


      return res.json({
        success: true,
        authenticated: true,
        user,
      });

    } catch (error) {

      console.error(
        '[Auth] /me :',
        error
      );

      return res.status(
        500
      ).json({
        success: false,
        error:
          'Impossible de récupérer votre profil.',
      });

    }

  }
);


/* =========================================================
   LOGOUT
========================================================= */

/**
 * GET /api/auth/logout
 */

router.get(
  '/logout',
  (
    req: Request,
    res: Response
  ) => {

    res.clearCookie(
      'omnix_token',
      {
        ...cookieOptions,
        maxAge: undefined,
      }
    );


    try {

      res.clearCookie(
        'token',
        {
          ...cookieOptions,
          maxAge: undefined,
        }
      );

    } catch {}


    return res.redirect(
      '/login'
    );

  }
);


/* =========================================================
   EXPORT
========================================================= */

export default router;