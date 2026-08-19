import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express';

import jwt from 'jsonwebtoken';

import { CONFIG } from '../../config/index.ts';

import AiSession from '../../models/AiSession.ts';

const router = express.Router();

const COOKIE_NAME = 'jwt_token';


/* =========================================================
   TYPES
========================================================= */

interface AuthenticatedRequest
  extends Request {

  user?: {
    discordId: string;

    username?: string;

    isOwner?: boolean;

    isAdmin?: boolean;
  };
}


/* =========================================================
   TOKEN
========================================================= */

function getToken(
  req: Request
): string | null {

  /*
   * Authorization: Bearer TOKEN
   */

  const authorization =
    req.headers.authorization;

  if (
    authorization &&
    authorization.startsWith('Bearer ')
  ) {

    const token =
      authorization
        .substring(7)
        .trim();

    if (token) {
      return token;
    }
  }


  /*
   * Cookie principal
   */

  const cookie =
    req.cookies?.[COOKIE_NAME];

  if (cookie) {
    return cookie;
  }


  /*
   * Ancien cookie pour compatibilité
   */

  const oldCookie =
    req.cookies?.omnix_token;

  if (oldCookie) {
    return oldCookie;
  }


  return null;
}


/* =========================================================
   AUTHENTIFICATION
========================================================= */

function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {

  const token =
    getToken(req);


  if (!token) {

    return res
      .status(401)
      .json({
        success: false,

        error:
          'Non connecté.',
      });
  }


  try {

    const decoded =
      jwt.verify(
        token,
        CONFIG.JWT_SECRET
      ) as {
        discordId: string;

        username?: string;

        isOwner?: boolean;

        isAdmin?: boolean;
      };


    if (!decoded.discordId) {

      return res
        .status(401)
        .json({
          success: false,

          error:
            'JWT invalide.',
        });
    }


    req.user =
      decoded;


    return next();

  } catch (error) {

    console.error(
      '[Admin Auth] JWT invalide :',
      error
    );


    res.clearCookie(
      COOKIE_NAME,
      {
        path: '/',
      }
    );


    return res
      .status(401)
      .json({
        success: false,

        error:
          'Session expirée.',
      });
  }
}


/* =========================================================
   OWNER
========================================================= */

function requireOwner(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {

  const discordId =
    req.user?.discordId;


  if (!discordId) {

    return res
      .status(401)
      .json({
        success: false,

        error:
          'Non authentifié.',
      });
  }


  const ownerIds = [
  ...(Array.isArray(CONFIG.OWNER_IDS)
    ? CONFIG.OWNER_IDS
    : []),

  ...(process.env.OWNER_IDS || '')
    .split(',')
]
  .map(String)
  .map(id => id.trim())
  .filter(Boolean);


  const isOwner =
    ownerIds.includes(
      String(discordId)
    );


  if (!isOwner) {

    console.warn(
      `[Admin] Tentative d'accès refusée : ${discordId}`
    );


    return res
      .status(403)
      .json({
        success: false,

        error:
          'Accès réservé au propriétaire d’OMNIX.',
      });
  }


  return next();
}


/* =========================================================
   TEST AUTH
========================================================= */

router.get(
  '/api/admin/auth',
  requireAuth,
  requireOwner,
  (
    req: AuthenticatedRequest,
    res: Response
  ) => {

    return res.json({

      success: true,

      owner: true,

      discordId:
        req.user?.discordId,

      username:
        req.user?.username,

      model:
        CONFIG.OPENROUTER.MODEL,
    });
  }
);


/* =========================================================
   STATS GLOBALES
========================================================= */

router.get(
  '/api/stats',
  requireAuth,
  requireOwner,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {

    try {

      const sessions =
        await AiSession.find({});


      const stats =
        sessions.reduce(
          (
            total,
            session
          ) => {

            total.requests +=
              session.totalRequests || 0;

            total.promptTokens +=
              session.totalPromptTokens || 0;

            total.completionTokens +=
              session.totalCompletionTokens || 0;

            total.tokens +=
              session.totalTokens || 0;

            return total;
          },

          {
            requests: 0,

            promptTokens: 0,

            completionTokens: 0,

            tokens: 0,
          }
        );


      return res.json({

        success: true,

        stats,

      });

    } catch (error) {

      console.error(
        '[Stats]',
        error
      );


      return res
        .status(500)
        .json({

          success: false,

          error:
            'Impossible de récupérer les statistiques.',
        });
    }
  }
);


/* =========================================================
   AI DEV ACCESS
========================================================= */

router.get(
  '/api/admin/ai-dev/access',
  requireAuth,
  requireOwner,
  (
    req: AuthenticatedRequest,
    res: Response
  ) => {

    return res.json({

      success: true,

      owner: true,

      discordId:
        req.user?.discordId,

      model:
        CONFIG.OPENROUTER.MODEL,

    });
  }
);


/* =========================================================
   AI DEV STATS
========================================================= */

router.get(
  '/api/admin/ai-dev/stats',
  requireAuth,
  requireOwner,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {

    try {

      const sessions =
        await AiSession.find({});


      let requests = 0;

      let promptTokens = 0;

      let completionTokens = 0;

      let totalTokens = 0;


      for (
        const session of sessions
      ) {

        requests +=
          session.totalRequests || 0;

        promptTokens +=
          session.totalPromptTokens || 0;

        completionTokens +=
          session.totalCompletionTokens || 0;

        totalTokens +=
          session.totalTokens || 0;
      }


      return res.json({

        success: true,

        stats: {

          requests,

          promptTokens,

          completionTokens,

          totalTokens,

          sessions:
            sessions.length,

        },

      });

    } catch (error) {

      console.error(
        '[AI Stats]',
        error
      );


      return res
        .status(500)
        .json({

          success: false,

          error:
            'Erreur statistiques IA.',
        });
    }
  }
);


/* =========================================================
   OWNER PANEL
========================================================= */

router.get(
  '/api/admin/owner',
  requireAuth,
  requireOwner,
  (
    req: AuthenticatedRequest,
    res: Response
  ) => {

    return res.json({

      success: true,

      owner: true,

      message:
        'Bienvenue dans la console propriétaire OMNIX.',

      discordId:
        req.user?.discordId,

    });
  }
);


/* =========================================================
   EXPORT
========================================================= */

export default router;