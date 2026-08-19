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

import type { Client } from 'discord.js';


/* =========================================================
   TYPES
========================================================= */

interface OmnixRuntime {
  discordClient?: Client | null;
  startedAt: number;
}


/* =========================================================
   APPLICATION
========================================================= */

export function createApp(): Express {

  const app = express();


  /* =======================================================
     RUNTIME OMNIX
  ======================================================= */

  const runtime: OmnixRuntime = {
    discordClient: null,
    startedAt: Date.now(),
  };

  app.locals.omnix = runtime;


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
     API AUTHENTIFICATION
  ======================================================= */

  app.use(
    '/api/auth',
    authRouter
  );


  /* =======================================================
     ADMIN
  ======================================================= */

  app.use(
    adminRouter
  );


  /* =======================================================
     API ÉTAT OMNIX
  ======================================================= */

  app.get(
    '/api/status',
    (
      req: Request,
      res: Response
    ) => {

      try {

        const currentRuntime =
          app.locals.omnix as OmnixRuntime;


        const client =
          currentRuntime.discordClient;


        /*
         * ---------------------------------------------------
         * BOT NON CONNECTÉ
         * ---------------------------------------------------
         */

        if (
          !client ||
          !client.isReady()
        ) {

          return res.json({

            success: true,

            status: 'offline',

            online: false,

            servers: 0,

            members: 0,

            commands: 0,

            latency: 0,

            uptime: Math.floor(
              process.uptime()
            ),

            uptimeSeconds: Math.floor(
              process.uptime()
            ),

            timestamp: Date.now(),

          });

        }


        /* ---------------------------------------------------
           SERVEURS
        --------------------------------------------------- */

        const servers =
          client.guilds.cache.size;


        /* ---------------------------------------------------
           MEMBRES
        --------------------------------------------------- */

        let members = 0;


        for (
          const guild
          of client.guilds.cache.values()
        ) {

          members +=
            guild.memberCount || 0;

        }


        /* ---------------------------------------------------
           COMMANDES
        --------------------------------------------------- */

        const commands =
          (
            client as Client & {
              commands?: {
                size: number;
              };
            }
          ).commands?.size || 0;


        /* ---------------------------------------------------
           LATENCE
        --------------------------------------------------- */

        const latency =
          client.ws.ping >= 0
            ? Math.round(
                client.ws.ping
              )
            : 0;


        /* ---------------------------------------------------
           UPTIME
        --------------------------------------------------- */

        const uptimeSeconds =
          Math.floor(
            process.uptime()
          );


        /* ---------------------------------------------------
           RÉPONSE
        --------------------------------------------------- */

        return res.json({

          success: true,

          status: 'online',

          online: true,

          servers,

          members,

          commands,

          latency,

          uptime:
            uptimeSeconds,

          uptimeSeconds,

          timestamp:
            Date.now(),

        });


      } catch (error) {

        console.error(
          '[API Status] Erreur :',
          error
        );


        return res.status(500).json({

          success: false,

          status: 'error',

          online: false,

          servers: 0,

          members: 0,

          commands: 0,

          latency: 0,

          uptime:
            Math.floor(
              process.uptime()
            ),

          uptimeSeconds:
            Math.floor(
              process.uptime()
            ),

          error:
            'Impossible de récupérer l’état d’OMNIX.',

        });

      }

    }
  );


  /* =======================================================
     HEALTH CHECK RENDER
  ======================================================= */

  app.get(
    '/health',
    (
      req: Request,
      res: Response
    ) => {

      return res.status(200).json({

        success: true,

        service:
          'OMNIX',

        status:
          'healthy',

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
     GESTION SERVEUR
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
     TARIFS
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
     EN SAVOIR PLUS
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
     CONSOLE IA
  ======================================================= */

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
     404 API
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


export default createApp;