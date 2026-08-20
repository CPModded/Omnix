import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from 'express';

import path from 'node:path';
import fs from 'node:fs';

import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import authRouter from './routes/auth.routes.ts';
import guildRouter from './routes/guild.routes.ts';
import statsRouter from './routes/stats.routes.ts';
import adminRouter from './routes/admin.routes.ts';

import {
  requireWebAuthentication,
  type AuthenticatedRequest,
} from './middlewares/auth.ts';

import {
  canManageGuild,
} from './middlewares/guildAuth.ts';

/* =========================================================
   PATHS
========================================================= */

const ROOT =
  process.cwd();

const VIEWS = [
  path.join(
    ROOT,
    'src',
    'dashboard',
    'views',
  ),

  path.join(
    ROOT,
    'views',
  ),

  path.join(
    ROOT,
    'dist',
    'dashboard',
    'views',
  ),
];

const PUBLIC = [
  path.join(
    ROOT,
    'src',
    'dashboard',
    'public',
  ),

  path.join(
    ROOT,
    'public',
  ),

  path.join(
    ROOT,
    'dist',
    'dashboard',
    'public',
  ),
];

function findDirectory(
  directories: string[],
): string {
  for (
    const directory of directories
  ) {
    try {
      if (
        fs.existsSync(directory) &&
        fs.statSync(directory)
          .isDirectory()
      ) {
        return directory;
      }
    } catch {}
  }

  return directories[0];
}

const viewsDirectory =
  findDirectory(VIEWS);

const publicDirectory =
  findDirectory(PUBLIC);

/* =========================================================
   APP
========================================================= */

const app: Express =
  express();

app.set(
  'trust proxy',
  1,
);

app.disable(
  'x-powered-by',
);

/* =========================================================
   SECURITY
========================================================= */

app.use(
  helmet({
    contentSecurityPolicy:
      false,

    crossOriginEmbedderPolicy:
      false,
  }),
);

/* =========================================================
   BODY
========================================================= */

app.use(
  express.json({
    limit: '10mb',
  }),
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb',
  }),
);

app.use(
  cookieParser(),
);

/* =========================================================
   EJS
========================================================= */

app.set(
  'view engine',
  'ejs',
);

app.set(
  'views',
  viewsDirectory,
);

/* =========================================================
   STATIC
========================================================= */

if (
  fs.existsSync(
    publicDirectory,
  )
) {
  app.use(
    express.static(
      publicDirectory,
    ),
  );
}

/* =========================================================
   API CACHE
========================================================= */

app.use(
  '/api',
  (
    req,
    res,
    next,
  ) => {
    res.setHeader(
      'Cache-Control',
      'no-store',
    );

    next();
  },
);

/* =========================================================
   HEALTH
========================================================= */

app.get(
  '/health',
  (
    req: Request,
    res: Response,
  ) => {
    return res.json({
      success: true,
      service: 'OMNIX',
      status: 'online',
      timestamp:
        new Date().toISOString(),
    });
  },
);

/* =========================================================
   API
========================================================= */

app.use(
  '/api/auth',
  authRouter,
);

/*
 * IMPORTANT :
 *
 * stats.routes.ts contient :
 *
 * /stats
 * /stats/health
 *
 * Donc on le monte sur /api.
 *
 * Résultat :
 *
 * /api/stats
 * /api/stats/health
 */
app.use(
  '/api',
  statsRouter,
);

app.use(
  '/api/guilds',
  guildRouter,
);

app.use(
  '/api/admin',
  adminRouter,
);

/* =========================================================
   HOME
========================================================= */

app.get(
  '/',
  (
    req: Request,
    res: Response,
  ) => {
    try {
      return res.render(
        'index',
      );
    } catch {
      return res.redirect(
        '/api/auth/login',
      );
    }
  },
);

/* =========================================================
   DASHBOARD
========================================================= */

/*
 * /dashboard
 *
 * Authentication WEB.
 */
app.get(
  '/dashboard',
  requireWebAuthentication,
  (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    console.log(
      '[Web] GET /dashboard',
    );

    return res.render(
      'dashboard',
      {
        user:
          req.user,
        guildId:
          null,
      },
    );
  },
);

/*
 * /dashboard/:guildId
 */
app.get(
  '/dashboard/:guildId',
  requireWebAuthentication,
  canManageGuild,
  (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const guildId =
      String(
        req.params.guildId,
      ).trim();

    console.log(
      `[Web] GET /dashboard/${guildId}`,
    );

    return res.render(
      'dashboard',
      {
        user:
          req.user,

        guildId,
      },
    );
  },
);

/* =========================================================
   OTHER PAGES
========================================================= */

function renderPage(
  route: string,
  view: string,
) {
  app.get(
    route,
    (
      req: Request,
      res: Response,
    ) => {
      try {
        const file =
          path.join(
            viewsDirectory,
            `${view}.ejs`,
          );

        if (
          !fs.existsSync(file)
        ) {
          return res.status(404).send(
            `La page "${view}" est indisponible.`,
          );
        }

        return res.render(view);
      } catch (error) {
        console.error(
          `[Web] Erreur ${route}:`,
          error,
        );

        return res.status(500).send(
          'Erreur lors du chargement de la page.',
        );
      }
    },
  );
}

renderPage(
  '/premium',
  'premium',
);

renderPage(
  '/pricing',
  'pricing',
);

renderPage(
  '/support',
  'support',
);

renderPage(
  '/founder',
  'founder',
);

renderPage(
  '/learn-more',
  'learn-more',
);

renderPage(
  '/ai-dev',
  'ai-dev',
);

/*
 * /admin
 *
 * Si admin.ejs existe,
 * elle s'affiche.
 *
 * Sinon on évite une erreur Express
 * et on retourne au dashboard.
 */
app.get(
  '/admin',
  requireWebAuthentication,
  (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const file =
      path.join(
        viewsDirectory,
        'admin.ejs',
      );

    if (
      !fs.existsSync(file)
    ) {
      return res.redirect(
        '/dashboard',
      );
    }

    if (
      !req.user?.isOwner &&
      !req.user?.isAdmin
    ) {
      return res.status(403).send(
        'Accès administrateur requis.',
      );
    }

    return res.render(
      'admin',
      {
        user:
          req.user,
      },
    );
  },
);

/* =========================================================
   API 404
========================================================= */

app.use(
  '/api',
  (
    req: Request,
    res: Response,
  ) => {
    console.warn(
      `[API] 404 : ${req.method} ${req.originalUrl}`,
    );

    return res.status(404).json({
      success: false,
      error:
        'Route API introuvable.',
      path:
        req.originalUrl,
    });
  },
);

/* =========================================================
   WEB 404
========================================================= */

app.use(
  (
    req: Request,
    res: Response,
  ) => {
    console.warn(
      `[Web] 404 : ${req.method} ${req.originalUrl}`,
    );

    const file =
      path.join(
        viewsDirectory,
        '404.ejs',
      );

    if (
      fs.existsSync(file)
    ) {
      return res.status(404).render(
        '404',
        {
          path:
            req.originalUrl,
        },
      );
    }

    return res.status(404).send(
      'Page introuvable.',
    );
  },
);

/* =========================================================
   GLOBAL ERROR
========================================================= */

app.use(
  (
    error: any,
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    console.error(
      '[Web] Erreur globale:',
      error,
    );

    if (
      res.headersSent
    ) {
      return next(error);
    }

    return res.status(500).json({
      success: false,
      error:
        'Erreur interne du serveur.',
    });
  },
);

export default app;

export function createApp(): Express {
  return app;
}