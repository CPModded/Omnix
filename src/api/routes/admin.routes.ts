import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express';

import jwt from 'jsonwebtoken';

import { CONFIG } from '../../config/index.ts';

import AiSession from '../../models/AiSession.ts';


const router =
  express.Router();


/*
 * ==========================================
 * AUTHENTIFICATION
 * ==========================================
 */

interface AuthenticatedRequest
  extends Request {

  user?: {
    discordId: string;
  };
}


/*
 * Vérifie le JWT
 */

function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {

  const token =
    req.cookies?.omnix_token;

  if (!token) {

    if (
      req.path.startsWith('/api/')
    ) {
      return res
        .status(401)
        .json({
          success: false,
          error: 'Non connecté.',
        });
    }

    return res.redirect(
      '/api/auth/login'
    );
  }


  try {

    const decoded =
      jwt.verify(
        token,
        CONFIG.JWT_SECRET
      ) as {
        discordId: string;
      };


    req.user = decoded;

    next();

  } catch {

    res.clearCookie(
      'omnix_token'
    );

    if (
      req.path.startsWith('/api/')
    ) {
      return res
        .status(401)
        .json({
          success: false,
          error:
            'Session expirée.',
        });
    }

    return res.redirect(
      '/api/auth/login'
    );
  }
}


/*
 * ==========================================
 * PROPRIÉTAIRE UNIQUEMENT
 * ==========================================
 */

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
        error: 'Non authentifié.',
      });
  }


  const isOwner =
    CONFIG.OWNER_IDS.includes(
      discordId
    );


  if (!isOwner) {

    return res
      .status(403)
      .json({
        success: false,
        error:
          'Accès réservé au propriétaire d’OMNIX.',
      });
  }


  next();
}


/*
 * ==========================================
 * TEST API
 * ==========================================
 */

router.get(
  '/api/stats',
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {

    try {

      const sessions =
        await AiSession.find({});


      const stats =
        sessions.reduce(
          (total, session) => {

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


/*
 * ==========================================
 * CONSOLE AI — PAGE
 * ==========================================
 */

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


/*
 * ==========================================
 * STATISTIQUES IA DU PROPRIÉTAIRE
 * ==========================================
 */

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


/*
 * ==========================================
 * DASHBOARD PROPRIÉTAIRE
 * ==========================================
 */

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

    });
  }
);


export default router;