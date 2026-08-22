import type { Express } from 'express';

import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { CONFIG } from '../../config/index.ts';

/* =========================================================
   OMNIX — SECURITY SETUP
========================================================= */

export function setupSecurity(
  app: Express,
): void {
  /* ---------------------------------------------------------
     TRUST PROXY
     
     Render / reverse proxy.
  --------------------------------------------------------- */

  app.set(
    'trust proxy',
    CONFIG.SECURITY.TRUST_PROXY
      ? 1
      : 0,
  );

  /* ---------------------------------------------------------
     HELMET
     
     CSP reste désactivée car le Dashboard EJS
     utilise actuellement des ressources/scripts
     qui ne sont pas compatibles avec une CSP stricte.
  --------------------------------------------------------- */

  app.use(
    helmet({
      contentSecurityPolicy:
        false,

      crossOriginEmbedderPolicy:
        false,

      crossOriginResourcePolicy:
        false,

      hsts:
        false,
    }),
  );

  /* ---------------------------------------------------------
     HSTS
     
     Désactivé volontairement pour éviter les problèmes
     avec les environnements HTTP de développement.
  --------------------------------------------------------- */

  app.use(
    (
      req,
      res,
      next,
    ) => {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=0',
      );

      next();
    },
  );

  /* ---------------------------------------------------------
     ALLOWED ORIGINS
  --------------------------------------------------------- */

  const allowedOrigins =
    new Set(
      [
        CONFIG.CLIENT_URL,

        process.env.CLIENT_URL,

        'http://localhost:3000',

        'http://127.0.0.1:3000',

        'http://node01.eternodes.fr:40044',

        'http://omnix.opik.net',

        'https://omnix.opik.net',
      ]
        .map(
          (origin) =>
            String(
              origin || '',
            ).trim(),
        )
        .filter(Boolean),
    );

  /* ---------------------------------------------------------
     CORS
  --------------------------------------------------------- */

  app.use(
    cors({
      origin: (
        origin,
        callback,
      ) => {
        /*
         * Les requêtes sans Origin sont autorisées.
         *
         * Exemple :
         * curl
         * serveur → serveur
         */

        if (!origin) {
          callback(
            null,
            true,
          );

          return;
        }

        if (
          allowedOrigins.has(
            origin,
          )
        ) {
          callback(
            null,
            true,
          );

          return;
        }

        console.warn(
          `[CORS] 🚫 Origine refusée : ${origin}`,
        );

        callback(
          new Error(
            'Origine CORS non autorisée.',
          ),
          false,
        );
      },

      credentials:
        true,

      methods: [
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS',
      ],

      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Accept',
        'X-Requested-With',
      ],

      exposedHeaders: [
        'Content-Length',
        'Content-Type',
      ],

      optionsSuccessStatus:
        204,
    }),
  );

  /* ---------------------------------------------------------
     GENERAL API RATE LIMIT
  --------------------------------------------------------- */

  const generalLimiter =
    rateLimit({
      windowMs:
        15 * 60 * 1000,

      max:
        200,

      standardHeaders:
        'draft-7',

      legacyHeaders:
        false,

      message: {
        success:
          false,

        error:
          'Trop de requêtes. Veuillez réessayer plus tard.',

        code:
          'RATE_LIMITED',
      },

      skip: (
        req,
      ) => {
        /*
         * Health check utilisé par les hébergeurs.
         */

        return (
          req.path ===
          '/health'
        );
      },
    });

  app.use(
    '/api',
    generalLimiter,
  );
}