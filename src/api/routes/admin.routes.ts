import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express';

import jwt from 'jsonwebtoken';

import { CONFIG } from '../../config/index.ts';
import { User } from '../../models/User.ts';
import AiSession from '../../models/AiSession.ts';

const router = express.Router();

/* =========================================================
   TYPES
========================================================= */

interface AuthenticatedRequest extends Request {
  user?: {
    discordId: string;
    username?: string;
    isOwner?: boolean;
    isAdmin?: boolean;
  };
}

/* =========================================================
   OWNER IDS
========================================================= */

/**
 * Récupère les IDs propriétaires depuis la configuration.
 *
 * Priorité :
 * 1. CONFIG.OWNER_IDS
 * 2. process.env.OWNER_IDS
 */
function getOwnerIds(): string[] {
  const configured = (CONFIG as any).OWNER_IDS;

  if (Array.isArray(configured)) {
    return configured
      .map((id) => String(id).trim())
      .filter(Boolean);
  }

  return (process.env.OWNER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

/* =========================================================
   OWNER CHECK
========================================================= */

export function isOwner(discordId: string): boolean {
  const ownerIds = getOwnerIds();

  return ownerIds.includes(String(discordId).trim());
}

/* =========================================================
   TOKEN
========================================================= */

/**
 * Récupère le JWT depuis :
 *
 * 1. Authorization: Bearer <token>
 * 2. Cookie httpOnly: jwt_token
 *
 * IMPORTANT :
 * On ne cherche plus "omnix_token".
 */
function getToken(req: Request): string | null {
  /* -------------------------------------------------------
     BEARER TOKEN
  ------------------------------------------------------- */

  const authorization = req.headers.authorization;

  if (
    authorization &&
    authorization.toLowerCase().startsWith('bearer ')
  ) {
    const bearer = authorization
      .substring(7)
      .trim();

    if (bearer) {
      return bearer;
    }
  }

  /* -------------------------------------------------------
     COOKIE
  ------------------------------------------------------- */

  const cookieToken = req.cookies?.jwt_token;

  if (
    typeof cookieToken === 'string' &&
    cookieToken.trim()
  ) {
    return cookieToken.trim();
  }

  return null;
}

/* =========================================================
   JWT VERIFY
========================================================= */

function verifyToken(token: string): any | null {
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
   REQUIRE AUTH
========================================================= */

function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const token = getToken(req);

  /* -------------------------------------------------------
     AUCUNE SESSION
  ------------------------------------------------------- */

  if (!token) {
    console.warn(
      `[Admin] Session absente : ${req.method} ${req.originalUrl}`
    );

    if (req.path.startsWith('/api/')) {
      return res.status(401).json({
        success: false,
        error: 'Session inexistante.',
      });
    }

    return res.redirect('/');
  }

  /* -------------------------------------------------------
     VALIDATION JWT
  ------------------------------------------------------- */

  const decoded = verifyToken(token);

  if (!decoded || !decoded.discordId) {
    console.warn(
      `[Admin] JWT invalide ou expiré : ${req.method} ${req.originalUrl}`
    );

    res.clearCookie(
      'jwt_token',
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      }
    );

    if (req.path.startsWith('/api/')) {
      return res.status(401).json({
        success: false,
        error: 'Session invalide ou expirée.',
      });
    }

    return res.redirect('/');
  }

  /* -------------------------------------------------------
     UTILISATEUR AUTHENTIFIÉ
  ------------------------------------------------------- */

  req.user = {
    discordId: String(decoded.discordId),
    username: decoded.username,
    isOwner: Boolean(decoded.isOwner),
    isAdmin: Boolean(decoded.isAdmin),
  };

  next();
}

/* =========================================================
   REQUIRE OWNER
========================================================= */

async function requireOwner(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const discordId = req.user?.discordId;

  if (!discordId) {
    return res.status(401).json({
      success: false,
      error: 'Non authentifié.',
    });
  }

  const ownerIds = getOwnerIds();

  const owner = ownerIds.includes(
    String(discordId).trim()
  );

  /* -------------------------------------------------------
     REFUS
  ------------------------------------------------------- */

  if (!owner) {
    console.warn(
      `[Admin] Tentative d'accès refusée : ${discordId}`
    );

    console.warn(
      `[Admin] OWNER_IDS configurés : ${
        ownerIds.join(', ') || 'AUCUN'
      }`
    );

    return res.status(403).json({
      success: false,
      error:
        'Accès réservé au propriétaire d’OMNIX.',
    });
  }

  /* -------------------------------------------------------
     SYNCHRONISATION MONGO
  ------------------------------------------------------- */

  try {
    await User.updateOne(
      {
        discordId,
      },
      {
        $set: {
          isAdmin: true,
        },
      }
    );
  } catch (error) {
    console.warn(
      '[Admin] Impossible de synchroniser isAdmin.',
      error
    );
  }

  next();
}

/* =========================================================
   ADMIN DEBUG
========================================================= */

/**
 * Route de diagnostic.
 *
 * URL :
 * /api/admin/debug
 *
 * Cette route permet de vérifier :
 *
 * - le compte Discord connecté
 * - les OWNER_IDS
 * - si le compte est propriétaire
 * - l'environnement
 */
router.get(
  '/api/admin/debug',
  requireAuth,
  (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    const ownerIds = getOwnerIds();

    const discordId =
      req.user?.discordId || null;

    const owner =
      discordId !== null &&
      ownerIds.includes(
        String(discordId).trim()
      );

    return res.json({
      success: true,

      discordId,

      ownerIds,

      isOwner: owner,

      environment:
        process.env.NODE_ENV || 'undefined',
    });
  }
);

/* =========================================================
   ADMIN OWNER
========================================================= */

/**
 * Vérifie que l'utilisateur connecté
 * est bien le propriétaire OMNIX.
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

      discordId:
        req.user?.discordId || null,

      message:
        'Bienvenue dans la console propriétaire OMNIX.',
    });
  }
);

/* =========================================================
   STATISTIQUES IA
========================================================= */

/**
 * Statistiques privées de l'IA.
 *
 * IMPORTANT :
 *
 * Cette route n'est PAS la route publique
 * /api/stats.
 *
 * Elle est réservée au propriétaire.
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

      /* -----------------------------------------------------
         CALCUL
      ----------------------------------------------------- */

      for (const session of sessions) {
        requests +=
          Number(
            session.totalRequests || 0
          );

        promptTokens +=
          Number(
            session.totalPromptTokens || 0
          );

        completionTokens +=
          Number(
            session.totalCompletionTokens || 0
          );

        totalTokens +=
          Number(
            session.totalTokens || 0
          );
      }

      /* -----------------------------------------------------
         RÉPONSE
      ----------------------------------------------------- */

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
        '[Admin AI Stats]',
        error
      );

      return res.status(500).json({
        success: false,

        error:
          'Erreur lors du chargement des statistiques IA.',
      });
    }
  }
);

/* =========================================================
   AI DEV ACCESS
========================================================= */

/**
 * Vérifie l'accès à la console AI Developer.
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
        req.user?.discordId || null,

      model:
        (CONFIG as any).OPENROUTER?.MODEL ||
        'non-configuré',
    });
  }
);

/* =========================================================
   EXPORT
========================================================= */

export default router;