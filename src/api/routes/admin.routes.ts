import express from 'express';
import type { Request, Response, NextFunction } from 'express';

import User from '../../models/User.ts';
import { CONFIG } from '../../config/index.ts';

const router = express.Router();

/* =========================================================
   AUTH ADMIN
========================================================= */

function getOwnerIds(): string[] {
  const raw = CONFIG.OWNER_IDS;

  if (Array.isArray(raw)) {
    return raw.map(String).filter(Boolean);
  }

  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map(id => id.trim())
      .filter(Boolean);
  }

  return [];
}

function getSessionUser(req: Request): any {
  return (req as any).user ?? (req as any).auth ?? null;
}

function isAdmin(req: Request): boolean {
  const sessionUser = getSessionUser(req);

  if (!sessionUser) {
    return false;
  }

  const userId = String(
    sessionUser.id ??
    sessionUser.discordId ??
    sessionUser.userId ??
    ''
  );

  const ownerIds = getOwnerIds();

  if (userId && ownerIds.includes(userId)) {
    return true;
  }

  return Boolean(
    sessionUser.isAdmin ||
    sessionUser.admin === true ||
    sessionUser.role === 'admin' ||
    sessionUser.role === 'owner'
  );
}

/* =========================================================
   ADMIN GUARD
========================================================= */

function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const sessionUser = getSessionUser(req);

  if (!sessionUser) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED'
    });
  }

  if (!isAdmin(req)) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN'
    });
  }

  next();
}

/* =========================================================
   GET /api/admin/users
========================================================= */

router.get(
  '/users',
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const users = await User.find({})
        .select('-password -__v')
        .lean();

      const normalizedUsers = users.map((user: any) => ({
        discordId:
          user.discordId ??
          user.discord_id ??
          user.id ??
          null,

        username:
          user.username ??
          user.globalName ??
          'Utilisateur inconnu',

        globalName:
          user.globalName ??
          user.username ??
          null,

        avatar:
          user.avatar ??
          null,

        isAdmin:
          Boolean(
            user.isAdmin ??
            user.admin ??
            user.role === 'admin' ??
            false
          ),

        licenses:
          Array.isArray(user.licenses)
            ? user.licenses
            : [],

        rewards:
          user.rewards ?? {
            points: 0
          }
      }));

      return res.json({
        success: true,
        users: normalizedUsers
      });
    } catch (error) {
      console.error(
        '[ADMIN] GET /users:',
        error
      );

      return res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR'
      });
    }
  }
);

/* =========================================================
   GET /api/admin/audit-logs

   Si ton projet possède déjà un modèle AuditLog,
   il peut être branché ici sans modifier admin.ejs.
========================================================= */

router.get(
  '/audit-logs',
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      /*
       * Compatible avec une éventuelle collection
       * AuditLog sans rendre la route dépendante
       * d'un modèle qui n'existerait pas encore.
       *
       * À remplacer par le modèle AuditLog existant
       * si celui-ci est déjà présent dans OMNIX.
       */

      return res.json({
        success: true,
        logs: []
      });
    } catch (error) {
      console.error(
        '[ADMIN] GET /audit-logs:',
        error
      );

      return res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR'
      });
    }
  }
);

/* =========================================================
   POST /api/admin/users/:userId/toggle-admin
========================================================= */

router.post(
  '/users/:userId/toggle-admin',
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const userId = String(
        req.params.userId
      );

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_USER_ID'
        });
      }

      const user = await User.findOne({
        $or: [
          { discordId: userId },
          { id: userId }
        ]
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'USER_NOT_FOUND'
        });
      }

      const currentValue = Boolean(
        (user as any).isAdmin
      );

      (user as any).isAdmin =
        !currentValue;

      await user.save();

      return res.json({
        success: true,
        discordId: userId,
        isAdmin: !currentValue
      });
    } catch (error) {
      console.error(
        '[ADMIN] toggle-admin:',
        error
      );

      return res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR'
      });
    }
  }
);

/* =========================================================
   POST /api/admin/users/:userId/grant-premium
========================================================= */

router.post(
  '/users/:userId/grant-premium',
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const userId = String(
        req.params.userId
      );

      const duration = String(
        req.body?.duration ?? ''
      );

      const allowedDurations = [
        '1m',
        '3m',
        '6m',
        '1y',
        'lifetime'
      ];

      if (
        !allowedDurations.includes(
          duration
        )
      ) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_DURATION'
        });
      }

      const user = await User.findOne({
        $or: [
          { discordId: userId },
          { id: userId }
        ]
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'USER_NOT_FOUND'
        });
      }

      const now = new Date();

      let expiresAt:
        | Date
        | null = null;

      switch (duration) {
        case '1m':
          expiresAt = new Date(now);
          expiresAt.setMonth(
            expiresAt.getMonth() + 1
          );
          break;

        case '3m':
          expiresAt = new Date(now);
          expiresAt.setMonth(
            expiresAt.getMonth() + 3
          );
          break;

        case '6m':
          expiresAt = new Date(now);
          expiresAt.setMonth(
            expiresAt.getMonth() + 6
          );
          break;

        case '1y':
          expiresAt = new Date(now);
          expiresAt.setFullYear(
            expiresAt.getFullYear() + 1
          );
          break;

        case 'lifetime':
          expiresAt = null;
          break;
      }

      const license = {
        tier: 'premium',
        status: 'active',
        licenseKey:
          `OMNIX-ADMIN-${userId}-${Date.now()}`,
        grantedAt: now,
        expiresAt
      };

      const currentLicenses =
        Array.isArray(
          (user as any).licenses
        )
          ? (user as any).licenses
          : [];

      currentLicenses.push(license);

      (user as any).licenses =
        currentLicenses;

      await user.save();

      return res.json({
        success: true,
        discordId: userId,
        duration,
        license
      });
    } catch (error) {
      console.error(
        '[ADMIN] grant-premium:',
        error
      );

      return res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR'
      });
    }
  }
);

export default router;