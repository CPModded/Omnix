import { Router } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isAuthenticated } from '../middlewares/auth.ts';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/*
 * Adapte automatiquement le chemin vers les vues.
 *
 * Structure attendue :
 *
 * src/
 * ├── api/
 * │   └── routes/
 * │       └── dashboard.routes.ts
 * │
 * └── views/
 *     └── dashboard.ejs
 */

const viewsPath = path.resolve(
  __dirname,
  '../../views'
);

/* =========================================================
   DASHBOARD PRINCIPAL
========================================================= */

router.get(
  '/dashboard',
  isAuthenticated as any,
  (req, res) => {
    return res.render(
      'dashboard',
      {
        user: (req as any).user ?? null,
        title: 'OMNIX — Dashboard',
      }
    );
  }
);

/* =========================================================
   DASHBOARD SERVEUR
========================================================= */

router.get(
  '/dashboard/:guildId',
  isAuthenticated as any,
  (req, res) => {
    const guildId =
      String(
        req.params.guildId || ''
      );

    if (!guildId) {
      return res.redirect(
        '/dashboard'
      );
    }

    return res.render(
      'dashboard',
      {
        user: (req as any).user ?? null,
        guildId,
        title: 'OMNIX — Dashboard',
      }
    );
  }
);

export default router;