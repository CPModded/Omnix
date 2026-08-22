/**
 * ====================================================================
 * OMNIX — ADMIN / OWNER CHECK
 * ====================================================================
 */

import type {
  Response,
  NextFunction,
} from 'express';

import type {
  AuthenticatedRequest,
} from './auth.ts';

import { User } from '../../models/User.ts';

import { CONFIG } from '../../config/index.ts';

export async function adminCheck(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const discordId =
    req.user?.discordId;

  const isApiRequest =
    req.path.startsWith('/api');

  /*
   * =========================================================
   * AUTHENTIFICATION
   * =========================================================
   */

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

      return;
    }

    res.redirect(
      '/?error=unauthorized',
    );

    return;
  }

  try {
    console.log(
      '======================================================',
    );

    console.log(
      `[OMNIX Security] 🛡️ Vérification Admin/Owner : @${req.user?.username} (${discordId})`,
    );

    /*
     * =========================================================
     * 1. OWNER OMNIX
     * =========================================================
     *
     * SOURCE DE VÉRITÉ :
     *
     * CONFIG.OWNER_IDS
     *
     * On ne dépend PAS de MongoDB pour le Owner.
     */

    const isOwner =
      CONFIG.OWNER_IDS.includes(
        discordId,
      );

    console.log(
      `[OMNIX Security] 👑 Owner : ${
        isOwner ? '✅ Oui' : '❌ Non'
      }`,
    );

    if (isOwner) {
      console.log(
        '[OMNIX Security] ✅ Accès accordé : Owner OMNIX.',
      );

      console.log(
        '======================================================',
      );

      next();

      return;
    }

    /*
     * =========================================================
     * 2. ADMIN OMNIX
     * =========================================================
     */

    const userDb =
      await User.findOne({
        discordId,
      }).lean();

    console.log(
      `[OMNIX Security] 👤 Utilisateur MongoDB : ${
        userDb ? '✅ Trouvé' : '❌ Introuvable'
      }`,
    );

    if (
      userDb?.isAdmin === true
    ) {
      console.log(
        '[OMNIX Security] ✅ Accès accordé : Admin OMNIX.',
      );

      console.log(
        '======================================================',
      );

      next();

      return;
    }

    /*
     * =========================================================
     * 3. REFUS
     * =========================================================
     */

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

      return;
    }

    res.redirect(
      '/?error=forbidden',
    );

  } catch (error: any) {
    console.error(
      '[OMNIX Security] ❌ Erreur :',
      error?.message || error,
    );

    if (isApiRequest) {
      res.status(500).json({
        success: false,
        error:
          "Erreur interne lors de la vérification des autorisations.",
        code:
          'ADMIN_CHECK_ERROR',
      });

      return;
    }

    res.redirect(
      '/?error=server_error',
    );
  }
}

export default adminCheck;