import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// ============================================================
// PATHS
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(
  __dirname,
  '../..'
);

// ============================================================
// EXPRESS
// ============================================================

const app = express();

// ============================================================
// CONFIGURATION
// ============================================================

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.set('view engine', 'ejs');

app.set(
  'views',
  path.join(
    PROJECT_ROOT,
    'src',
    'dashboard',
    'views'
  )
);

// ============================================================
// SECURITY
// ============================================================

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// ============================================================
// BODY
// ============================================================

app.use(
  express.json({
    limit: '2mb',
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '2mb',
  })
);

// ============================================================
// CACHE
// ============================================================

app.use(
  (
    _req: Request,
    res: Response,
    next: NextFunction
  ) => {
    res.setHeader(
      'Cache-Control',
      'no-store'
    );

    next();
  }
);

// ============================================================
// RATE LIMIT
// ============================================================

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    error:
      'Trop de requêtes. Veuillez patienter.',
  },
});

app.use(
  '/api',
  apiLimiter
);

// ============================================================
// STATIC
// ============================================================

const publicPath = path.join(
  PROJECT_ROOT,
  'src',
  'dashboard',
  'public'
);

app.use(
  express.static(
    publicPath,
    {
      maxAge:
        process.env.NODE_ENV === 'production'
          ? '1h'
          : 0,
    }
  )
);

// ============================================================
// HEALTH CHECK
// ============================================================

app.get(
  '/health',
  (
    _req: Request,
    res: Response
  ) => {
    return res.status(200).json({
      status: 'ok',
      service: 'OMNIX',
      timestamp:
        new Date().toISOString(),
    });
  }
);

// ============================================================
// HOME
// ============================================================
//
// IMPORTANT
//
// Cette route est indispensable.
//
// Elle permet à :
//
// https://omnix-1.onrender.com/
//
// d'afficher :
//
// src/dashboard/views/index.ejs
//
// ============================================================

app.get(
  '/',
  (
    _req: Request,
    res: Response
  ) => {
    return res.status(200).render(
      'index',
      {
        title:
          'OMNIX - Plateforme Officielle',
      }
    );
  }
);

// ============================================================
// AUTH ROUTES
// ============================================================

import authRoutes
  from './routes/auth.routes.ts';

app.use(
  '/api/auth',
  authRoutes
);

// ============================================================
// GUILD ROUTES
// ============================================================

import guildsRoutes
  from './routes/guilds.routes.ts';

app.use(
  '/api/guilds',
  guildsRoutes
);

// ============================================================
// API STATS
// ============================================================
//
// Ton index.ejs appelle :
//
// GET /api/stats
//
// Cette route doit donc exister.
//
// Si tu as déjà un fichier stats.routes.ts,
// remplace simplement cette partie par ton import.
//
// ============================================================

app.get(
  '/api/stats',
  async (
    _req: Request,
    res: Response
  ) => {

    try {

      /*
       * Valeurs de secours.
       *
       * Cette route permet au frontend
       * de ne plus recevoir un 404.
       *
       * Elle devra ensuite être reliée
       * à tes vraies statistiques OMNIX.
       */

      const bot =
        (
          globalThis as any
        ).omnixBot;

      const guildsCount =
        bot?.guilds?.cache?.size ?? 0;

      const ping =
        bot?.ws?.ping ?? 0;

      const uptimeMs =
        bot?.uptime ?? 0;

      /*
       * Uptime en pourcentage.
       *
       * Ici on indique simplement que
       * le bot est opérationnel lorsque
       * le processus est actif.
       */

      const uptime =
        uptimeMs > 0
          ? 100
          : 0;

      const commands =
        bot?.commands?.size ??
        82;

      return res.status(200).json({

        success: true,

        bot: {
          guildsCount,
          ping,
          uptime,
        },

        database: {
          totalUsers: 0,
        },

        commands,
      });

    } catch (error) {

      console.error(
        '[API Stats]',
        error
      );

      return res.status(500).json({
        success: false,
        error:
          'Impossible de récupérer les statistiques.',
      });
    }
  }
);

// ============================================================
// API 404
// ============================================================

app.use(
  '/api',
  (
    req: Request,
    res: Response
  ) => {

    return res.status(404).json({
      error:
        'Route API introuvable.',

      path:
        req.path,
    });
  }
);

// ============================================================
// WEB 404
// ============================================================

app.use(
  (
    req: Request,
    res: Response
  ) => {

    console.warn(
      `[Web] 404 : ${req.method} ${req.originalUrl}`
    );

    return res.status(404).send(
      'Page introuvable.'
    );
  }
);

// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
  (
    error: any,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {

    console.error(
      '[Web] Erreur Express :',
      error
    );

    if (
      res.headersSent
    ) {
      return;
    }

    return res.status(500).json({
      error:
        'Une erreur interne est survenue.',
    });
  }
);

// ============================================================
// EXPORT
// ============================================================

export default app;