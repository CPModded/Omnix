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
import guildRoutes from './routes/guild.routes.ts';
import statsRouter from './routes/stats.routes.ts';

// Si ton router admin existe toujours :
import adminRouter from './routes/admin.routes.ts';


/* =========================================================
   PATHS
========================================================= */

const PROJECT_ROOT =
  process.cwd();

const POSSIBLE_VIEWS = [
  path.join(
    PROJECT_ROOT,
    'views'
  ),

  path.join(
    PROJECT_ROOT,
    'src',
    'dashboard',
    'views'
  ),

  path.join(
    PROJECT_ROOT,
    'dist',
    'dashboard',
    'views'
  ),
];

const POSSIBLE_PUBLIC = [
  path.join(
    PROJECT_ROOT,
    'public'
  ),

  path.join(
    PROJECT_ROOT,
    'src',
    'dashboard',
    'public'
  ),

  path.join(
    PROJECT_ROOT,
    'dist',
    'dashboard',
    'public'
  ),
];


/* =========================================================
   FIND EXISTING DIRECTORY
========================================================= */

function findExistingDirectory(
  directories: string[]
): string {

  for (
    const directory of directories
  ) {

    try {

      if (
        fs.existsSync(
          directory
        ) &&
        fs.statSync(
          directory
        ).isDirectory()
      ) {

        return directory;

      }

    } catch {}

  }

  return directories[0];

}


/* =========================================================
   EXPRESS APP
========================================================= */

const app: Express =
  express();


/* =========================================================
   BASIC CONFIGURATION
========================================================= */

app.set(
  'trust proxy',
  1
);

app.disable(
  'x-powered-by'
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
  })
);


/* =========================================================
   BODY PARSERS
========================================================= */

app.use(
  express.json({
    limit: '10mb',
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb',
  })
);


/* =========================================================
   COOKIES
========================================================= */

app.use(
  cookieParser()
);


/* =========================================================
   EJS
========================================================= */

const viewsDirectory =
  findExistingDirectory(
    POSSIBLE_VIEWS
  );

app.set(
  'view engine',
  'ejs'
);

app.set(
  'views',
  viewsDirectory
);


/* =========================================================
   STATIC FILES
========================================================= */

const publicDirectory =
  findExistingDirectory(
    POSSIBLE_PUBLIC
  );

if (
  fs.existsSync(
    publicDirectory
  )
) {

  app.use(
    express.static(
      publicDirectory,
      {
        maxAge:
          process.env.NODE_ENV ===
          'production'
            ? '1h'
            : 0,
      }
    )
  );

}


/* =========================================================
   API CACHE CONTROL
========================================================= */

app.use(
  '/api',
  (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {

    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate'
    );

    res.setHeader(
      'Pragma',
      'no-cache'
    );

    res.setHeader(
      'Expires',
      '0'
    );

    next();

  }
);


/* =========================================================
   HEALTH
========================================================= */

app.get(
  '/health',
  (
    req: Request,
    res: Response
  ) => {

    return res.json({
      success: true,
      service: 'OMNIX',
      status: 'online',
      timestamp:
        new Date().toISOString(),
    });

  }
);


/* =========================================================
   API ROUTES
========================================================= */

/*
 * AUTH
 *
 * /api/auth/...
 */
app.use(
  '/api/auth',
  authRouter
);


/*
 * GUILDS
 *
 * guild.routes.ts contient :
 *
 * GET /
 * GET /:guildId/channels
 * GET /:guildId/roles
 *
 * Donc :
 *
 * /api/guilds
 * /api/guilds/:guildId/channels
 * /api/guilds/:guildId/roles
 */
app.use(
  '/api/guilds',
  guildRoutes
);


/*
 * STATS
 *
 * stats.routes.ts contient déjà :
 *
 * /api/stats
 * /api/stats/health
 *
 * Il doit donc être monté sur "/".
 */
app.use(
  '/',
  statsRouter
);


/*
 * ADMIN
 *
 * /api/admin/...
 */
app.use(
  '/api/admin',
  adminRouter
);


/* =========================================================
   PAGE ROUTES
   IMPORTANT :
   CES ROUTES SONT AVANT LE 404.
========================================================= */


/*
 * HOME
 *
 * GET /
 */
app.get(
  '/',
  (
    req: Request,
    res: Response
  ) => {

    try {

      return res.render(
        'index'
      );

    } catch (error) {

      console.error(
        '[Web] Erreur rendu / :',
        error
      );

      return res.status(
        500
      ).send(
        'Erreur lors du chargement de la page.'
      );

    }

  }
);


/*
 * DASHBOARD PRINCIPAL
 *
 * GET /dashboard
 *
 * C'est CETTE route qui manquait.
 */
app.get(
  '/dashboard',
  (
    req: Request,
    res: Response
  ) => {

    try {

      console.log(
        '[Web] GET /dashboard'
      );

      return res.render(
        'dashboard'
      );

    } catch (error) {

      console.error(
        '[Web] Erreur rendu /dashboard :',
        error
      );

      return res.status(
        500
      ).send(
        'Erreur lors du chargement du Dashboard OMNIX.'
      );

    }

  }
);


/*
 * DASHBOARD SERVEUR
 *
 * GET /dashboard/:guildId
 */
app.get(
  '/dashboard/:guildId',
  (
    req: Request,
    res: Response
  ) => {

    try {

      const guildId =
        String(
          req.params.guildId ||
          ''
        ).trim();

      if (
        !guildId
      ) {

        return res.redirect(
          '/dashboard'
        );

      }

      console.log(
        `[Web] GET /dashboard/${guildId}`
      );

      return res.render(
        'dashboard',
        {
          guildId,
        }
      );

    } catch (error) {

      console.error(
        '[Web] Erreur rendu /dashboard/:guildId :',
        error
      );

      return res.status(
        500
      ).send(
        'Erreur lors du chargement du Dashboard serveur.'
      );

    }

  }
);


/* =========================================================
   OTHER PUBLIC PAGES
========================================================= */


/*
 * PREMIUM / PRICING
 */
app.get(
  '/premium',
  (
    req: Request,
    res: Response
  ) => {

    try {

      return res.render(
        'premium'
      );

    } catch (error) {

      console.error(
        '[Web] Erreur /premium :',
        error
      );

      return res.status(
        500
      ).send(
        'Page Premium indisponible.'
      );

    }

  }
);


/*
 * PRICING
 */
app.get(
  '/pricing',
  (
    req: Request,
    res: Response
  ) => {

    try {

      return res.render(
        'pricing'
      );

    } catch (error) {

      console.error(
        '[Web] Erreur /pricing :',
        error
      );

      return res.status(
        500
      ).send(
        'Page Pricing indisponible.'
      );

    }

  }
);


/*
 * SUPPORT
 */
app.get(
  '/support',
  (
    req: Request,
    res: Response
  ) => {

    try {

      return res.render(
        'support'
      );

    } catch (error) {

      console.error(
        '[Web] Erreur /support :',
        error
      );

      return res.status(
        500
      ).send(
        'Page Support indisponible.'
      );

    }

  }
);


/*
 * FOUNDER
 */
app.get(
  '/founder',
  (
    req: Request,
    res: Response
  ) => {

    try {

      return res.render(
        'founder'
      );

    } catch (error) {

      console.error(
        '[Web] Erreur /founder :',
        error
      );

      return res.status(
        500
      ).send(
        'Page Founder indisponible.'
      );

    }

  }
);


/*
 * LEARN MORE
 */
app.get(
  '/learn-more',
  (
    req: Request,
    res: Response
  ) => {

    try {

      return res.render(
        'learn-more'
      );

    } catch (error) {

      console.error(
        '[Web] Erreur /learn-more :',
        error
      );

      return res.status(
        500
      ).send(
        'Page indisponible.'
      );

    }

  }
);


/*
 * AI DEV
 */
app.get(
  '/ai-dev',
  (
    req: Request,
    res: Response
  ) => {

    try {

      return res.render(
        'ai-dev'
      );

    } catch (error) {

      console.error(
        '[Web] Erreur /ai-dev :',
        error
      );

      return res.status(
        500
      ).send(
        'Page indisponible.'
      );

    }

  }
);


/* =========================================================
   API 404
========================================================= */

app.use(
  '/api',
  (
    req: Request,
    res: Response
  ) => {

    console.warn(
      `[API] 404 : ${req.method} ${req.originalUrl}`
    );

    return res.status(
      404
    ).json({
      success: false,
      error: 'Route API introuvable.',
      path: req.originalUrl,
    });

  }
);


/* =========================================================
   WEB 404
========================================================= */

app.use(
  (
    req: Request,
    res: Response
  ) => {

    console.warn(
      `[Web] 404 : ${req.method} ${req.originalUrl}`
    );

    /*
     * Pour les navigateurs, on peut essayer
     * de rendre une vraie page 404 si elle existe.
     */

    try {

      return res.status(
        404
      ).render(
        '404'
      );

    } catch {

      return res.status(
        404
      ).send(
        'Page introuvable.'
      );

    }

  }
);


/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
  (
    error: any,
    req: Request,
    res: Response,
    next: NextFunction
  ) => {

    console.error(
      '[Web] Erreur globale :',
      error
    );

    if (
      res.headersSent
    ) {

      return next(
        error
      );

    }

    return res.status(
      500
    ).json({
      success: false,
      error:
        'Erreur interne du serveur.',
    });

  }
);


/* =========================================================
   EXPORT
========================================================= */

export default app;


/* =========================================================
   FACTORY
========================================================= */

export function createApp(): Express {
  return app;
}