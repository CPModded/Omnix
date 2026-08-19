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


/* =========================================================
   TEMPS DE DÉMARRAGE
========================================================= */

const START_TIME = Date.now();


/* =========================================================
   CRÉATION DE L'APPLICATION
========================================================= */

export function createApp(): Express {

  const app = express();


  /* =======================================================
     CONFIGURATION
  ======================================================= */

  app.set('trust proxy', 1);

  app.disable('x-powered-by');


  /* =======================================================
     SÉCURITÉ
  ======================================================= */

  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );


  /* =======================================================
     PARSING
  ======================================================= */

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

      res.setHeader(
        'Cache-Control',
        'no-store'
      );

      next();
    }
  );


  /* =======================================================
     VIEWS
  ======================================================= */

  const root = process.cwd();

  const possibleViews = [

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
    possibleViews.find(
      directory =>
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


  /* =======================================================
     FICHIERS PUBLICS
  ======================================================= */

  const publicPath =
    fs.existsSync(
      path.join(
        root,
        'public'
      )
    )

      ? path.join(
          root,
          'public'
        )

      : path.join(
          root,
          'src',
          'dashboard',
          'public'
        );


  app.use(
    express.static(
      publicPath
    )
  );


  /* =======================================================
     API AUTH
  ======================================================= */

  app.use(
    '/api/auth',
    authRouter
  );


  /* =======================================================
     API ADMIN
  ======================================================= */

  app.use(
    adminRouter
  );


  /* =======================================================
     API STATUS
     
     IMPORTANT :
     Cette route sert aux systèmes qui vérifient
     si OMNIX fonctionne correctement.
  ======================================================= */

  app.get(
    '/api/status',
    (
      req: Request,
      res: Response
    ) => {

      const uptime =
        Math.floor(
          (Date.now() - START_TIME) / 1000
        );


      return res.status(200).json({

        success: true,

        status: 'online',

        service: 'OMNIX',

        version:
          process.env.npm_package_version ||
          'unknown',

        environment:
          process.env.NODE_ENV ||
          'development',

        uptime,

        uptimeFormatted:
          formatUptime(uptime),

        api: {
          status: 'online',
        },

        database: {
          configured:
            Boolean(
              process.env.MONGO_URI ||
              process.env.MONGODB_URI ||
              process.env.DATABASE_URL
            ),

          status:
            'managed-by-application',
        },

        discord: {
          configured:
            Boolean(
              process.env.DISCORD_TOKEN ||
              process.env.DISCORD_BOT_TOKEN
            ),

          status:
            'managed-by-bot',
        },

        ai: {
          provider:
            'OpenRouter',

          configured:
            Boolean(
              process.env.OPENROUTER_API_KEY
            ),

          model:
            process.env.OPENROUTER_MODEL ||
            'openrouter/free',

          status:
            process.env.OPENROUTER_API_KEY
              ? 'configured'
              : 'not_configured',
        },

        timestamp:
          new Date().toISOString(),

      });
    }
  );


  /* =======================================================
     API HEALTH
     
     Route simplifiée pour Render / monitoring.
  ======================================================= */

  app.get(
    '/api/health',
    (
      req: Request,
      res: Response
    ) => {

      return res.status(200).json({

        status: 'ok',

        service: 'OMNIX',

        uptime:
          Math.floor(
            (Date.now() - START_TIME) / 1000
          ),

        timestamp:
          new Date().toISOString(),

      });
    }
  );


  /* =======================================================
     PAGE PRINCIPALE
  ======================================================= */

  app.get(
    '/',
    (
      req: Request,
      res: Response
    ) => {

      res.render(
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

      res.render(
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
     GESTION SERVEUR
  ======================================================= */

  app.get(
    '/dashboard/:guildId',
    (
      req: Request,
      res: Response
    ) => {

      res.render(
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

      res.render(
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
     TARIFS
  ======================================================= */

  app.get(
    '/pricing',
    (
      req: Request,
      res: Response
    ) => {

      res.render(
        'pricing'
      );
    }
  );


  /* =======================================================
     EN SAVOIR PLUS
  ======================================================= */

  app.get(
    '/learn-more',
    (
      req: Request,
      res: Response
    ) => {

      res.render(
        'learn-more'
      );
    }
  );


  /* =======================================================
     CONSOLE OMNIX AI
     
     La protection doit être faite dans admin.routes.ts.
     
     JAMAIS exposer OPENROUTER_API_KEY au navigateur.
  ======================================================= */

  app.get(
    '/ai-dev',
    (
      req: Request,
      res: Response
    ) => {

      res.render(
        'ai-dev'
      );
    }
  );


  /* =======================================================
     404
  ======================================================= */

  app.use(
    (
      req: Request,
      res: Response
    ) => {

      res.status(404);


      if (
        req.path.startsWith(
          '/api/'
        )
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


  /* =======================================================
     ERREUR GLOBALE
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


      if (
        res.headersSent
      ) {

        return next(
          error
        );
      }


      const message =
        process.env.NODE_ENV ===
        'production'

          ? 'Une erreur interne est survenue.'

          : error?.message ||
            'Erreur interne.';


      if (
        req.path.startsWith(
          '/api/'
        )
      ) {

        return res
          .status(500)
          .json({

            success: false,

            error:
              message,

          });
      }


      return res
        .status(500)
        .send(
          message
        );
    }
  );


  return app;
}


/* =========================================================
   FORMATAGE UPTIME
========================================================= */

function formatUptime(
  seconds: number
): string {

  const days =
    Math.floor(
      seconds / 86400
    );

  seconds %= 86400;


  const hours =
    Math.floor(
      seconds / 3600
    );

  seconds %= 3600;


  const minutes =
    Math.floor(
      seconds / 60
    );

  seconds %= 60;


  const parts: string[] = [];


  if (days > 0) {
    parts.push(
      `${days}j`
    );
  }

  if (
    hours > 0 ||
    days > 0
  ) {

    parts.push(
      `${hours}h`
    );
  }

  if (
    minutes > 0 ||
    hours > 0 ||
    days > 0
  ) {

    parts.push(
      `${minutes}m`
    );
  }


  parts.push(
    `${seconds}s`
  );


  return parts.join(' ');
}


export default createApp;