import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from 'express';

import path from 'path';
import fs from 'fs';

import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import authRouter from './routes/auth.routes.ts';
import adminRouter from './routes/admin.routes.ts';
import statsRouter from './routes/stats.routes.ts';

/* =========================================================
   CREATE APP
========================================================= */

export function createApp(): Express {
  const app = express();

  /* =======================================================
     CONFIGURATION EXPRESS
  ======================================================= */

  /**
   * Render utilise un reverse proxy.
   *
   * Cela permet notamment à Express de comprendre
   * correctement que la connexion originale est HTTPS.
   */
  app.set('trust proxy', 1);

  /**
   * Ne pas révéler Express dans les headers.
   */
  app.disable('x-powered-by');

  /* =======================================================
     SECURITY
  ======================================================= */

  app.use(
    helmet({
      /**
       * La CSP est volontairement désactivée ici
       * car ton frontend actuel peut utiliser :
       *
       * - scripts inline
       * - ressources externes
       * - SVG
       * - éventuels scripts CDN
       *
       * On pourra mettre en place une CSP stricte
       * plus tard lorsque le frontend sera stabilisé.
       */
      contentSecurityPolicy: false,
    })
  );

  /* =======================================================
     BODY PARSER
  ======================================================= */

  app.use(
    express.json({
      /**
       * Limite raisonnable pour les API OMNIX.
       */
      limit: '10mb',
    })
  );

  app.use(
    express.urlencoded({
      extended: true,
      limit: '10mb',
    })
  );

  /* =======================================================
     COOKIES
  ======================================================= */

  /**
   * Obligatoire pour :
   *
   * req.cookies.jwt_token
   *
   * utilisé par auth.routes.ts et admin.routes.ts.
   */
  app.use(cookieParser());

  /* =======================================================
     CACHE
  ======================================================= */

  app.use(
    (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      /**
       * Les API d'OMNIX ne doivent pas être mises
       * en cache par le navigateur ou un proxy.
       *
       * Cela évite notamment d'afficher d'anciennes
       * statistiques ou une ancienne session.
       */
      if (req.path.startsWith('/api/')) {
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

        res.setHeader(
          'Surrogate-Control',
          'no-store'
        );
      }

      next();
    }
  );

  /* =======================================================
     ROOT PATH
  ======================================================= */

  const root =
    process.cwd();

  /* =======================================================
     VIEWS
  ======================================================= */

  /**
   * Plusieurs chemins sont supportés afin que le projet
   * fonctionne aussi bien en développement qu'après
   * compilation.
   */
  const possibleViewsPaths = [
    path.join(
      root,
      'views'
    ),

    path.join(
      root,
      'src',
      'dashboard',
      'views'
    ),

    path.join(
      root,
      'dist',
      'dashboard',
      'views'
    ),
  ];

  const viewsPath =
    possibleViewsPaths.find(
      (directory) =>
        fs.existsSync(directory)
    ) ||
    possibleViewsPaths[0];

  app.set(
    'view engine',
    'ejs'
  );

  app.set(
    'views',
    viewsPath
  );

  /* =======================================================
     PUBLIC FILES
  ======================================================= */

  const possiblePublicPaths = [
    path.join(
      root,
      'public'
    ),

    path.join(
      root,
      'src',
      'dashboard',
      'public'
    ),

    path.join(
      root,
      'dist',
      'dashboard',
      'public'
    ),
  ];

  const publicPath =
    possiblePublicPaths.find(
      (directory) =>
        fs.existsSync(directory)
    ) ||
    possiblePublicPaths[0];

  /**
   * Fichiers statiques :
   *
   * CSS
   * JS
   * images
   * favicon
   * etc.
   */
  app.use(
    express.static(
      publicPath,
      {
        maxAge:
          process.env.NODE_ENV ===
          'production'
            ? '1h'
            : 0,
      }
    )
  );

  /* =======================================================
     API AUTHENTIFICATION
  ======================================================= */

  /**
   * Toutes les routes :
   *
   * /api/auth/*
   *
   * sont maintenant gérées par auth.routes.ts.
   */
  app.use(
    '/api/auth',
    authRouter
  );

  /* =======================================================
     API STATISTIQUES
  ======================================================= */

  /**
   * IMPORTANT :
   *
   * statsRouter est PUBLIC.
   *
   * Il ne faut surtout pas placer un middleware
   * d'authentification global avant cette route.
   *
   * Sinon :
   *
   * GET /api/stats
   *
   * retournerait 401 pour les visiteurs.
   */
  app.use(
    statsRouter
  );

  /* =======================================================
     API ADMIN
  ======================================================= */

  /**
   * Les routes admin possèdent leur propre protection :
   *
   * requireAuth
   * requireOwner
   */
  app.use(
    adminRouter
  );

  /* =======================================================
     PAGE D'ACCUEIL
  ======================================================= */

  app.get(
    '/',
    (
      req: Request,
      res: Response
    ) => {
      return res.render(
        'index',
        {
          clientId:
            process.env.DISCORD_CLIENT_ID ||
            '',

          redirectUri:
            process.env.DISCORD_REDIRECT_URI ||
            '',
        }
      );
    }
  );

  /* =======================================================
     DASHBOARD
  ======================================================= */

  app.get(
    '/dashboard',
    (
      req: Request,
      res: Response
    ) => {
      return res.render(
        'dashboard',
        {
          clientId:
            process.env.DISCORD_CLIENT_ID ||
            '',
        }
      );
    }
  );

  /* =======================================================
     GESTION D'UN SERVEUR
  ======================================================= */

  app.get(
    '/dashboard/:guildId',
    (
      req: Request,
      res: Response
    ) => {
      return res.render(
        'manage',
        {
          guildId:
            req.params.guildId,

          clientId:
            process.env.DISCORD_CLIENT_ID ||
            '',
        }
      );
    }
  );

  /* =======================================================
     FOUNDER
  ======================================================= */

  app.get(
    '/founder',
    (
      req: Request,
      res: Response
    ) => {
      return res.render(
        'founder',
        {
          founder: {
            name:
              'Weritale',

            description:
              'Créateur et développeur principal de la plateforme OMNIX.',

            officialServer:
              'https://discord.gg/omnix',
          },
        }
      );
    }
  );

  /* =======================================================
     PRICING
  ======================================================= */

  app.get(
    '/pricing',
    (
      req: Request,
      res: Response
    ) => {
      return res.render(
        'pricing'
      );
    }
  );

  /* =======================================================
     LEARN MORE
  ======================================================= */

  app.get(
    '/learn-more',
    (
      req: Request,
      res: Response
    ) => {
      return res.render(
        'learn-more'
      );
    }
  );

  /* =======================================================
     AI DEV
  ======================================================= */

  /**
   * La page elle-même est rendue ici.
   *
   * Les API privées de la console sont protégées
   * dans admin.routes.ts.
   *
   * Le frontend de la page doit appeler :
   *
   * /api/admin/ai-dev/access
   *
   * pour vérifier l'accès.
   */
  app.get(
    '/ai-dev',
    (
      req: Request,
      res: Response
    ) => {
      return res.render(
        'ai-dev'
      );
    }
  );

  /* =======================================================
     API 404
  ======================================================= */

  app.use(
    (
      req: Request,
      res: Response
    ) => {
      /**
       * Si c'est une route API inexistante,
       * on retourne du JSON.
       */
      if (
        req.path.startsWith('/api/')
      ) {
        return res.status(404).json({
          success: false,

          error:
            'Route API introuvable.',
        });
      }

      /**
       * Pour les pages inexistantes,
       * on renvoie vers la page d'accueil.
       */
      return res
        .status(404)
        .render(
          'index',
          {
            clientId:
              process.env.DISCORD_CLIENT_ID ||
              '',

            redirectUri:
              process.env.DISCORD_REDIRECT_URI ||
              '',
          }
        );
    }
  );

  /* =======================================================
     GLOBAL ERROR HANDLER
  ======================================================= */

  app.use(
    (
      error: any,
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      console.error(
        '[Express]',
        error
      );

      /**
       * Si Express a déjà commencé à envoyer
       * la réponse, on laisse Express continuer
       * son traitement d'erreur.
       */
      if (res.headersSent) {
        return next(error);
      }

      const message =
        process.env.NODE_ENV ===
        'production'
          ? 'Une erreur interne est survenue.'
          : (
              error?.message ||
              'Erreur interne.'
            );

      /* ---------------------------------------------------
         ERREUR API
      --------------------------------------------------- */

      if (
        req.path.startsWith('/api/')
      ) {
        return res.status(500).json({
          success: false,

          error: message,
        });
      }

      /* ---------------------------------------------------
         ERREUR PAGE
      --------------------------------------------------- */

      return res
        .status(500)
        .send(message);
    }
  );

  /* =======================================================
     RETURN
  ======================================================= */

  return app;
}

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default createApp;