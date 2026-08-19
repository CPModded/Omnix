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

/*
 * =========================================================
 * OMNIX — EXPRESS APPLICATION
 * =========================================================
 *
 * Ce fichier est responsable uniquement de :
 *
 * - configurer Express
 * - configurer la sécurité
 * - configurer les cookies
 * - configurer JSON / URL encoded
 * - configurer les views
 * - configurer les fichiers publics
 * - monter les routes API
 * - monter les pages principales
 *
 * L'authentification réelle se trouve dans :
 *
 * src/api/routes/auth.routes.ts
 *
 * L'administration se trouve dans :
 *
 * src/api/routes/admin.routes.ts
 *
 * Les statistiques publiques se trouvent dans :
 *
 * src/api/routes/stats.routes.ts
 *
 * =========================================================
 */

export function createApp(): Express {
  const app = express();

  /*
   * =======================================================
   * CONFIGURATION EXPRESS
   * =======================================================
   */

  /*
   * Render fonctionne derrière un reverse proxy.
   *
   * Cela permet notamment à Express de correctement
   * gérer les cookies "secure".
   */
  app.set('trust proxy', 1);

  /*
   * Ne pas exposer Express dans les headers.
   */
  app.disable('x-powered-by');

  /*
   * =======================================================
   * SÉCURITÉ
   * =======================================================
   */

  app.use(
    helmet({
      /*
       * Désactivé ici afin d'éviter de casser les
       * ressources/scripts existants de ton dashboard.
       *
       * On pourra mettre en place une CSP stricte
       * plus tard lorsque le frontend sera stabilisé.
       */
      contentSecurityPolicy: false,
    }),
  );

  /*
   * =======================================================
   * PARSING JSON
   * =======================================================
   */

  app.use(
    express.json({
      limit: '10mb',
    }),
  );

  /*
   * =======================================================
   * PARSING FORMULAIRES
   * =======================================================
   */

  app.use(
    express.urlencoded({
      extended: true,
      limit: '10mb',
    }),
  );

  /*
   * =======================================================
   * COOKIES
   * =======================================================
   *
   * Nécessaire pour :
   *
   * req.cookies.jwt_token
   *
   */

  app.use(cookieParser());

  /*
   * =======================================================
   * CACHE API
   * =======================================================
   *
   * Les routes API ne doivent pas être mises en cache.
   *
   * Cela évite notamment qu'un navigateur ou un proxy
   * conserve une ancienne réponse de session/statistiques.
   */

  app.use(
    (
      req: Request,
      res: Response,
      next: NextFunction,
    ) => {
      if (req.path.startsWith('/api/')) {
        res.setHeader(
          'Cache-Control',
          'no-store, no-cache, must-revalidate, proxy-revalidate',
        );

        res.setHeader(
          'Pragma',
          'no-cache',
        );

        res.setHeader(
          'Expires',
          '0',
        );
      }

      next();
    },
  );

  /*
   * =======================================================
   * VIEWS EJS
   * =======================================================
   */

  const root = process.cwd();

  const possibleViewsPaths = [
    /*
     * Projet compilé / production
     */
    path.join(
      root,
      'views',
    ),

    /*
     * Architecture source
     */
    path.join(
      root,
      'src',
      'dashboard',
      'views',
    ),

    /*
     * Architecture compilée alternative
     */
    path.join(
      root,
      'dist',
      'dashboard',
      'views',
    ),
  ];

  const viewsPath =
    possibleViewsPaths.find(
      (directory) =>
        fs.existsSync(directory),
    ) ||
    possibleViewsPaths[0];

  app.set(
    'view engine',
    'ejs',
  );

  app.set(
    'views',
    viewsPath,
  );

  /*
   * =======================================================
   * FICHIERS PUBLICS
   * =======================================================
   */

  const possiblePublicPaths = [
    path.join(
      root,
      'public',
    ),

    path.join(
      root,
      'src',
      'dashboard',
      'public',
    ),

    path.join(
      root,
      'dist',
      'dashboard',
      'public',
    ),
  ];

  const publicPath =
    possiblePublicPaths.find(
      (directory) =>
        fs.existsSync(directory),
    ) ||
    possiblePublicPaths[0];

  app.use(
    express.static(
      publicPath,
      {
        /*
         * Pas de cache agressif en développement.
         *
         * En production :
         * 1 heure.
         */
        maxAge:
          process.env.NODE_ENV ===
          'production'
            ? '1h'
            : 0,
      },
    ),
  );

  /*
   * =======================================================
   * AUTHENTIFICATION
   * =======================================================
   *
   * Routes :
   *
   * GET /api/auth/login
   * GET /api/auth/callback
   * GET /api/auth/me
   * GET /api/auth/guilds
   * GET /api/auth/logout
   *
   */

  app.use(
    '/api/auth',
    authRouter,
  );

  /*
   * =======================================================
   * STATISTIQUES PUBLIQUES
   * =======================================================
   *
   * IMPORTANT :
   *
   * /api/stats reste PUBLIC.
   *
   * La page d'accueil doit pouvoir récupérer :
   *
   * - nombre de serveurs
   * - nombre de membres
   * - nombre de commandes
   * - uptime
   * - latence
   *
   * sans obliger l'utilisateur à se connecter.
   *
   */

  app.use(
    statsRouter,
  );

  /*
   * =======================================================
   * ADMIN
   * =======================================================
   *
   * Les routes admin possèdent leur propre middleware
   * d'authentification et de vérification OWNER.
   *
   */

  app.use(
    adminRouter,
  );

  /*
   * =======================================================
   * PAGE D'ACCUEIL
   * =======================================================
   */

  app.get(
    '/',
    (
      req: Request,
      res: Response,
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
        },
      );
    },
  );

  /*
   * =======================================================
   * DASHBOARD
   * =======================================================
   */

  app.get(
    '/dashboard',
    (
      req: Request,
      res: Response,
    ) => {
      return res.render(
        'dashboard',
        {
          clientId:
            process.env.DISCORD_CLIENT_ID ||
            '',
        },
      );
    },
  );

  /*
   * =======================================================
   * GESTION D'UN SERVEUR
   * =======================================================
   */

  app.get(
    '/dashboard/:guildId',
    (
      req: Request,
      res: Response,
    ) => {
      return res.render(
        'manage',
        {
          guildId:
            req.params.guildId,

          clientId:
            process.env.DISCORD_CLIENT_ID ||
            '',
        },
      );
    },
  );

  /*
   * =======================================================
   * FOUNDER
   * =======================================================
   */

  app.get(
    '/founder',
    (
      req: Request,
      res: Response,
    ) => {
      return res.render(
        'founder',
        {
          founder: {
            name: 'Weritale',

            description:
              'Créateur et développeur principal de la plateforme OMNIX.',

            officialServer:
              'https://discord.gg/omnix',
          },
        },
      );
    },
  );

  /*
   * =======================================================
   * TARIFS
   * =======================================================
   */

  app.get(
    '/pricing',
    (
      req: Request,
      res: Response,
    ) => {
      return res.render(
        'pricing',
      );
    },
  );

  /*
   * =======================================================
   * EN SAVOIR PLUS
   * =======================================================
   */

  app.get(
    '/learn-more',
    (
      req: Request,
      res: Response,
    ) => {
      return res.render(
        'learn-more',
      );
    },
  );

  /*
   * =======================================================
   * CONSOLE AI / OWNER
   * =======================================================
   *
   * IMPORTANT :
   *
   * Cette route affiche simplement la page.
   *
   * Les API de cette console sont protégées dans
   * admin.routes.ts.
   *
   */

  app.get(
    '/ai-dev',
    (
      req: Request,
      res: Response,
    ) => {
      return res.render(
        'ai-dev',
      );
    },
  );

  /*
   * =======================================================
   * 404
   * =======================================================
   */

  app.use(
    (
      req: Request,
      res: Response,
    ) => {
      /*
       * Pour les API :
       *
       * on renvoie un JSON propre.
       */

      if (
        req.path.startsWith('/api/')
      ) {
        return res
          .status(404)
          .json({
            success: false,
            error:
              'Route API introuvable.',
          });
      }

      /*
       * Pour les pages inexistantes :
       *
       * retour vers la page d'accueil.
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
          },
        );
    },
  );

  /*
   * =======================================================
   * GESTIONNAIRE D'ERREURS GLOBAL
   * =======================================================
   */

  app.use(
    (
      error: any,
      req: Request,
      res: Response,
      next: NextFunction,
    ) => {
      console.error(
        '[Express]',
        error,
      );

      /*
       * Si Express a déjà commencé à envoyer
       * la réponse, on laisse Express gérer.
       */

      if (res.headersSent) {
        return next(error);
      }

      /*
       * En production :
       *
       * ne pas exposer le détail interne de l'erreur.
       */

      const message =
        process.env.NODE_ENV ===
        'production'
          ? 'Une erreur interne est survenue.'
          : (
              error?.message ||
              'Erreur interne.'
            );

      /*
       * API
       */

      if (
        req.path.startsWith('/api/')
      ) {
        return res
          .status(500)
          .json({
            success: false,
            error: message,
          });
      }

      /*
       * Pages web
       */

      return res
        .status(500)
        .send(
          message,
        );
    },
  );

  return app;
}

export default createApp;