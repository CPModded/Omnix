/**
 * ====================================================================
 * OMNIX — ADMIN / OWNER CHECK
 * ====================================================================
 *
 * Autorisation :
 *
 * 1. Owner OMNIX
 * 2. Administrateur OMNIX
 *
 * Le statut Owner est toujours recalculé depuis
 * CONFIG.OWNER_IDS et ne dépend pas uniquement du JWT.
 */

import type {
  Response,
  NextFunction,
} from 'express';

import type {
  AuthenticatedRequest,
} from './auth';

import { User } from '../../models/User';

import {
  isOwner,
} from '../routes/auth.routes';

/* =========================================================
   ADMIN CHECK
========================================================= */

export async function adminCheck(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const discordId =
    req.user?.discordId;

  const isApiRequest =
    req.path.startsWith('/api') || req.originalUrl.startsWith('/api/');

  /* ---------------------------------------------------------
     AUTHENTIFICATION
  --------------------------------------------------------- */

  if (!discordId) {
    console.warn(
      '[OMNIX Security] 🚨 Accès refusé : discordId absent.',
    );

    if (isApiRequest) {
      res.status(401).json({
        success: false,
        error:
          'Authentification requise.',
        code:
          'AUTH_REQUIRED',
      });
    } else {
      res.redirect(
        '/?error=unauthorized',
      );
    }

    return;
  }

  try {
    console.log(
      '======================================================',
    );

    console.log(
      `[OMNIX Security] 🛡️ Vérification admin : @${req.user?.username} (${discordId})`,
    );

    /* ---------------------------------------------------------
       OWNER OMNIX
       
       IMPORTANT :
       On recalcule le statut depuis OWNER_IDS.
       On ne fait pas confiance uniquement au JWT.
    --------------------------------------------------------- */

    const owner =
      isOwner(
        discordId,
      );

    console.log(
      `[OMNIX Security] 👑 Owner OMNIX : ${
        owner
          ? '✅ Oui'
          : '❌ Non'
      }`,
    );

    if (owner) {
      console.log(
        '[OMNIX Security] ✅ Accès accordé : Owner.',
      );

      console.log(
        '======================================================',
      );

      next();

      return;
    }

    /* ---------------------------------------------------------
       USER DATABASE
    --------------------------------------------------------- */

    const user =
      await User.findOne({
        discordId,
      }).lean();

    console.log(
      `[OMNIX Security] 🔍 Utilisateur DB : ${
        user
          ? '✅ Trouvé'
          : '❌ Introuvable'
      }`,
    );

    if (!user) {
      console.warn(
        `[OMNIX Security] 🚨 Utilisateur introuvable : ${discordId}`,
      );

      if (isApiRequest) {
        res.status(403).json({
          success: false,
          error:
            'Utilisateur OMNIX introuvable.',
          code:
            'USER_NOT_FOUND',
        });
      } else {
        res.redirect(
          '/?error=forbidden',
        );
      }

      return;
    }

    /* ---------------------------------------------------------
       OMNIX ADMIN
    --------------------------------------------------------- */

    const admin =
      Boolean(
        user.isAdmin,
      );

    console.log(
      `[OMNIX Security] 🛡️ Admin OMNIX : ${
        admin
          ? '✅ Oui'
          : '❌ Non'
      }`,
    );

    if (admin) {
      console.log(
        '[OMNIX Security] ✅ Accès accordé : Administrateur.',
      );

      console.log(
        '======================================================',
      );

      next();

      return;
    }

    /* ---------------------------------------------------------
       ACCESS DENIED
    --------------------------------------------------------- */

    console.warn(
      `[OMNIX Security] 🚨 Accès refusé : @${req.user?.username} (${discordId})`,
    );

    console.log(
      '======================================================',
    );

    if (isApiRequest) {
      res.status(403).json({
        success: false,
        error:
          'Accès restreint. Cette console est réservée au personnel autorisé.',
        code:
          'ADMIN_ACCESS_DENIED',
      });
    } else {
      res.redirect(
        '/?error=forbidden',
      );
    }

  } catch (error) {
    console.error(
      '[OMNIX AdminCheck] Erreur :',
      error,
    );

    if (isApiRequest) {
      res.status(500).json({
        success: false,
        error:
          'Erreur interne lors de la vérification des autorisations.',
        code:
          'ADMIN_CHECK_ERROR',
      });
    } else {
      res.redirect(
        '/?error=server_error',
      );
    }
  }
}

export default adminCheck;