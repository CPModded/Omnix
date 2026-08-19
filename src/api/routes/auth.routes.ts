import express, {
  type Request,
  type Response,
} from 'express';

import axios from 'axios';
import jwt from 'jsonwebtoken';

import { User } from '../../models/User.ts';
import { CONFIG } from '../../config/index.ts';

const router = express.Router();

/* =========================================================
   CONFIGURATION DISCORD
========================================================= */

const DISCORD_API =
  'https://discord.com/api/v10';

const DISCORD_OAUTH_API =
  'https://discord.com/api/oauth2/token';


/* =========================================================
   TYPES
========================================================= */

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
  discriminator?: string;
}

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner?: boolean;
  permissions?: string;
  features?: string[];
}


/* =========================================================
   OUTILS
========================================================= */

/**
 * Retourne la liste des propriétaires OMNIX.
 *
 * Compatible avec :
 *
 * OWNER_IDS=123456789,987654321
 *
 * ou avec une configuration CONFIG.OWNER_IDS.
 */
function getOwnerIds(): string[] {

  const configured =
    (CONFIG as any).OWNER_IDS;

  if (Array.isArray(configured)) {
    return configured
      .map(String)
      .map(id => id.trim())
      .filter(Boolean);
  }

  const envValue =
    process.env.OWNER_IDS || '';

  return envValue
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);
}


/**
 * Vérifie si un utilisateur est propriétaire
 * d'OMNIX.
 */
function isOwner(
  discordId: string
): boolean {

  return getOwnerIds()
    .includes(discordId);
}


/**
 * Crée un JWT OMNIX.
 */
function createJwt(
  user: DiscordUser,
  premium = false
): string {

  const owner =
    isOwner(user.id);

  return jwt.sign(
    {
      discordId: user.id,

      username:
        user.global_name ||
        user.username,

      avatar:
        user.avatar || null,

      isAdmin: owner,

      isOwner: owner,

      isPremium: premium,
    },

    CONFIG.JWT_SECRET,

    {
      expiresIn: '7d',
    }
  );
}


/**
 * Vérifie un JWT envoyé dans Authorization.
 */
function extractBearerToken(
  req: Request
): string | null {

  const header =
    req.headers.authorization;

  if (!header) {
    return null;
  }

  if (!header.startsWith('Bearer ')) {
    return null;
  }

  return header.substring(7).trim();
}


/**
 * Vérifie un JWT et retourne son contenu.
 */
function verifyJwt(
  token: string
): any | null {

  try {

    return jwt.verify(
      token,
      CONFIG.JWT_SECRET
    );

  } catch {

    return null;
  }
}


/* =========================================================
   1. CONNEXION DISCORD
========================================================= */

router.get(
  '/login',
  (
    req: Request,
    res: Response
  ) => {

    const clientId =
      process.env.DISCORD_CLIENT_ID ||
      (CONFIG as any).DISCORD?.CLIENT_ID;

    const redirectUri =
      process.env.DISCORD_REDIRECT_URI ||
      (CONFIG as any).DISCORD?.REDIRECT_URI;

    if (!clientId) {

      return res.status(500).send(
        '❌ DISCORD_CLIENT_ID est manquant.'
      );
    }

    if (!redirectUri) {

      return res.status(500).send(
        '❌ DISCORD_REDIRECT_URI est manquant.'
      );
    }


    const params =
      new URLSearchParams({

        client_id:
          clientId,

        redirect_uri:
          redirectUri,

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


/* =========================================================
   2. CALLBACK DISCORD
========================================================= */

router.get(
  '/callback',
  async (
    req: Request,
    res: Response
  ) => {

    try {

      const code =
        typeof req.query.code === 'string'
          ? req.query.code
          : null;


      if (!code) {

        return res.status(400).send(
          '❌ Code OAuth Discord manquant.'
        );
      }


      const clientId =
        process.env.DISCORD_CLIENT_ID ||
        (CONFIG as any).DISCORD?.CLIENT_ID;

      const clientSecret =
        process.env.DISCORD_CLIENT_SECRET ||
        (CONFIG as any).DISCORD?.CLIENT_SECRET;

      const redirectUri =
        process.env.DISCORD_REDIRECT_URI ||
        (CONFIG as any).DISCORD?.REDIRECT_URI;


      if (
        !clientId ||
        !clientSecret ||
        !redirectUri
      ) {

        console.error(
          '[OAuth] Configuration Discord incomplète.'
        );

        return res.status(500).send(
          '❌ Configuration OAuth Discord incomplète.'
        );
      }


      /* -----------------------------------------------------
         ÉCHANGE DU CODE CONTRE UN ACCESS TOKEN
      ----------------------------------------------------- */

      const tokenResponse =
        await axios.post<DiscordTokenResponse>(
          DISCORD_OAUTH_API,
          new URLSearchParams({

            client_id:
              clientId,

            client_secret:
              clientSecret,

            grant_type:
              'authorization_code',

            code,

            redirect_uri:
              redirectUri,

          }).toString(),
          {
            headers: {
              'Content-Type':
                'application/x-www-form-urlencoded',
            },
          }
        );


      const accessToken =
        tokenResponse.data.access_token;


      if (!accessToken) {

        throw new Error(
          'Discord n\'a pas retourné d\'access_token.'
        );
      }


      /* -----------------------------------------------------
         RÉCUPÉRATION DU PROFIL DISCORD
      ----------------------------------------------------- */

      const userResponse =
        await axios.get<DiscordUser>(
          `${DISCORD_API}/users/@me`,
          {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          }
        );


      const discordUser =
        userResponse.data;


      /* -----------------------------------------------------
         RÉCUPÉRATION DES SERVEURS
      ----------------------------------------------------- */

      const guildResponse =
        await axios.get<DiscordGuild[]>(
          `${DISCORD_API}/users/@me/guilds`,
          {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          }
        );


      const guilds =
        guildResponse.data || [];


      /* -----------------------------------------------------
         SERVEURS ADMINISTRABLES
      ----------------------------------------------------- */

      const manageableGuilds =
        guilds.filter(
          guild => {

            /*
             * Propriétaire du serveur
             */
            if (guild.owner) {
              return true;
            }


            /*
             * Permission Administrator
             *
             * 0x8 = ADMINISTRATOR
             */
            if (guild.permissions) {

              try {

                const permissions =
                  BigInt(
                    guild.permissions
                  );

                return (
                  permissions &
                  0x8n
                ) === 0x8n;

              } catch {

                return false;
              }
            }


            return false;
          }
        );


      /* -----------------------------------------------------
         DONNÉES SERVEURS POUR MONGO
      ----------------------------------------------------- */

      const guildData =
        manageableGuilds.map(
          guild => ({
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            owner:
              Boolean(guild.owner),
            permissions:
              guild.permissions || '0',
          })
        );


      /* -----------------------------------------------------
         UTILISATEUR OMNIX
      ----------------------------------------------------- */

      const owner =
        isOwner(discordUser.id);


      /*
       * On tente de conserver le statut Premium
       * existant.
       */
      const existingUser =
        await User.findOne({
          discordId:
            discordUser.id,
        });


      const isPremium =
        Boolean(
          existingUser &&
          (
            (existingUser as any).isPremium ||
            (existingUser as any).premium
          )
        );


      /* -----------------------------------------------------
         CRÉATION / MISE À JOUR USER
      ----------------------------------------------------- */

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
            discordUser.global_name ||
            discordUser.username,

          avatar:
            discordUser.avatar ||
            null,

          guilds:
            guildData,

          isPremium,

          isAdmin:
            owner,

          lastLogin:
            new Date(),

        },

        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );


      /* -----------------------------------------------------
         JWT OMNIX
      ----------------------------------------------------- */

      const token =
        createJwt(
          discordUser,
          isPremium
        );


      /* -----------------------------------------------------
         COOKIE
      ----------------------------------------------------- */

      res.cookie(
        'jwt_token',
        token,
        {
          httpOnly: true,

          secure:
            process.env.NODE_ENV ===
            'production',

          sameSite:
            'lax',

          maxAge:
            7 * 24 * 60 * 60 * 1000,

          path:
            '/',
        }
      );


      /* -----------------------------------------------------
         REDIRECTION DASHBOARD
      ----------------------------------------------------- */

      const dashboardUrl =
        process.env.CLIENT_URL ||
        process.env.DOMAIN ||
        '/dashboard';


      /*
       * Le Dashboard actuel récupère le JWT
       * depuis ?token=...
       *
       * Il le place ensuite dans localStorage.
       */
      const separator =
        dashboardUrl.includes('?')
          ? '&'
          : '?';


      return res.redirect(
        `${dashboardUrl}${separator}token=${encodeURIComponent(token)}`
      );


    } catch (error: any) {

      console.error(
        '[OAuth Discord] Erreur :',
        error?.response?.data ||
        error?.message ||
        error
      );


      return res.status(500).send(`
        <!DOCTYPE html>

        <html lang="fr">

        <head>
          <meta charset="UTF-8">
          <title>Erreur OAuth — OMNIX</title>

          <style>
            body {
              background: #030712;
              color: white;
              font-family: Arial, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              text-align: center;
            }

            .box {
              max-width: 500px;
              padding: 40px;
              background: #0f172a;
              border: 1px solid #1e293b;
              border-radius: 18px;
            }

            h1 {
              color: #f87171;
            }

            a {
              display: inline-block;
              margin-top: 20px;
              color: #38bdf8;
              text-decoration: none;
            }
          </style>
        </head>

        <body>

          <div class="box">

            <h1>
              Connexion impossible
            </h1>

            <p>
              Une erreur est survenue
              pendant la connexion Discord.
            </p>

            <a href="/">
              ← Retour à OMNIX
            </a>

          </div>

        </body>

        </html>
      `);
    }
  }
);


/* =========================================================
   3. SERVEURS DU DASHBOARD
========================================================= */

router.get(
  '/guilds',
  async (
    req: Request,
    res: Response
  ) => {

    try {

      const token =
        extractBearerToken(req);


      if (!token) {

        return res.status(401).json({
          error:
            'Token d\'authentification manquant.',
        });
      }


      const payload =
        verifyJwt(token);


      if (!payload) {

        return res.status(401).json({
          error:
            'Session invalide ou expirée.',
        });
      }


      const user =
        await User.findOne({
          discordId:
            payload.discordId,
        }).lean();


      if (!user) {

        return res.status(404).json({
          error:
            'Utilisateur OMNIX introuvable.',
        });
      }


      const guilds =
        Array.isArray(
          (user as any).guilds
        )
          ? (user as any).guilds
          : [];


      return res.json(
        guilds
      );


    } catch (error) {

      console.error(
        '[Auth /guilds]',
        error
      );


      return res.status(500).json({
        error:
          'Impossible de récupérer les serveurs.',
      });
    }
  }
);


/* =========================================================
   4. SESSION COURANTE
========================================================= */

router.get(
  '/me',
  async (
    req: Request,
    res: Response
  ) => {

    try {

      /*
       * Ton Dashboard actuel utilise
       * principalement localStorage.
       *
       * On accepte donc :
       *
       * 1. Authorization Bearer
       * 2. cookie jwt_token
       */

      const bearer =
        extractBearerToken(req);

      const cookieToken =
        req.cookies?.jwt_token;

      const token =
        bearer ||
        cookieToken;


      if (!token) {

        return res.status(401).json({
          success: false,
          error:
            'Utilisateur non connecté.',
        });
      }


      const payload =
        verifyJwt(token);


      if (!payload) {

        return res.status(401).json({
          success: false,
          error:
            'Session expirée.',
        });
      }


      const user =
        await User.findOne({
          discordId:
            payload.discordId,
        }).lean();


      if (!user) {

        return res.status(404).json({
          success: false,
          error:
            'Utilisateur introuvable.',
        });
      }


      return res.json({

        success: true,

        user: {

          discordId:
            (user as any).discordId,

          username:
            (user as any).username,

          globalName:
            (user as any).globalName,

          avatar:
            (user as any).avatar,

          isAdmin:
            Boolean(
              (user as any).isAdmin
            ),

          isPremium:
            Boolean(
              (user as any).isPremium
            ),

          guilds:
            (user as any).guilds || [],

        },

      });


    } catch (error) {

      console.error(
        '[Auth /me]',
        error
      );


      return res.status(401).json({
        success: false,
        error:
          'Session invalide.',
      });
    }
  }
);


/* =========================================================
   5. DÉCONNEXION
========================================================= */

router.get(
  '/logout',
  (
    req: Request,
    res: Response
  ) => {

    res.clearCookie(
      'jwt_token',
      {
        path: '/',
      }
    );


    return res.redirect('/');
  }
);


/* =========================================================
   EXPORT
========================================================= */

export default router;