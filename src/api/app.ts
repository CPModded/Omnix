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


export function createApp(): Express {
  const app = express();

  /*
   * ==========================================
   * CONFIGURATION
   * ==========================================
   */

  app.set('trust proxy', 1);

  app.disable('x-powered-by');

  /*
   * ==========================================
   * SÉCURITÉ
   * ==========================================
   */

  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );

  /*
   * ==========================================
   * PARSING
   * ==========================================
   */

  app.use(express.json({ limit: '10mb' }));

  app.use(
    express.urlencoded({
      extended: true,
      limit: '10mb',
    })
  );

  app.use(cookieParser());

  /*
   * ==========================================
   * CACHE
   * ==========================================
   */

  app.use(
    (
      req: Request,
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

  /*
   * ==========================================
   * VIEWS
   * ==========================================
   */

  const root = process.cwd();

  const possibleViews = [
    path.join(root, 'views'),

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
    possibleViews.find(directory =>
      fs.existsSync(directory)
    ) ||
    possibleViews[0];

  app.set(
    'view engine',
    'ejs'
  );

  app.set(
    'views',
    viewsPath
  );

  /*
   * ==========================================
   * FICHIERS PUBLICS
   * ==========================================
   */

  const publicPath =
    fs.existsSync(
      path.join(root, 'public')
    )
      ? path.join(root, 'public')
      : path.join(
          root,
          'src',
          'dashboard',
          'public'
        );

  app.use(
    express.static(publicPath)
  );

  /*
   * ==========================================
   * API ROUTES
   * ==========================================
   */

  app.use(
    '/api/auth',
    authRouter
  );

  app.use(
    adminRouter
  );

  /*
   * ==========================================
   * PAGE PRINCIPALE
   * ==========================================
   */

  app.get(
    '/',
    (req: Request, res: Response) => {
      res.render('index', {
        clientId:
          process.env.DISCORD_CLIENT_ID || '',

        redirectUri:
          process.env.DISCORD_REDIRECT_URI || '',
      });
    }
  );

  /*
   * ==========================================
   * DASHBOARD
   * ==========================================
   */

  app.get(
    '/dashboard',
    (req: Request, res: Response) => {
      res.render('dashboard', {
        clientId:
          process.env.DISCORD_CLIENT_ID || '',
      });
    }
  );

  /*
   * ==========================================
   * GESTION SERVEUR
   * ==========================================
   */

  app.get(
    '/dashboard/:guildId',
    (
      req: Request,
      res: Response
    ) => {
      res.render('manage', {
        guildId:
          req.params.guildId,

        clientId:
          process.env.DISCORD_CLIENT_ID || '',
      });
    }
  );

  /*
   * ==========================================
   * FOUNDER
   * ==========================================
   */

  app.get(
    '/founder',
    (
      req: Request,
      res: Response
    ) => {
      res.render('founder', {
        founder: {
          name: 'Weritale',

          description:
            'Créateur et développeur principal de la plateforme OMNIX.',

          officialServer:
            'https://discord.gg/omnix',
        },
      });
    }
  );

  /*
   * ==========================================
   * TARIFS
   * ==========================================
   */

  app.get(
    '/pricing',
    (
      req: Request,
      res: Response
    ) => {
      res.render('pricing');
    }
  );

  /*
   * ==========================================
   * EN SAVOIR PLUS
   * ==========================================
   */

  app.get(
    '/learn-more',
    (
      req: Request,
      res: Response
    ) => {
      res.render('learn-more');
    }
  );

  /*
   * ==========================================
   * CONSOLE OMNIX AI
   * ==========================================
   *
   * La page est protégée côté serveur
   * dans admin.routes.ts.
   *
   * On ne met JAMAIS OPENROUTER_API_KEY
   * dans EJS ou JavaScript client.
   */

  app.get(
    '/ai-dev',
    (
      req: Request,
      res: Response
    ) => {
      res.render('ai-dev');
    }
  );

  /*
   * ==========================================
   * 404
   * ==========================================
   */

  app.use(
    (
      req: Request,
      res: Response
    ) => {
      res.status(404);

      if (
        req.path.startsWith('/api/')
      ) {
        return res.json({
          success: false,

          error:
            'Route API introuvable.',
        });
      }

      return res.render(
        'index'
      );
    }
  );

  /*
   * ==========================================
   * ERREUR GLOBALE
   * ==========================================
   */

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

      if (res.headersSent) {
        return next(error);
      }

      const message =
        process.env.NODE_ENV ===
        'production'
          ? 'Une erreur interne est survenue.'
          : error?.message ||
            'Erreur interne.';

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

      return res
        .status(500)
        .send(message);
    }
  );

  return app;
}


export default createApp;