/**
 * ====================================================================
 * CONFIGURATION DE LA SÉCURITÉ DE L'API (OMNIX CORE)
 * Gère Helmet, CORS dynamique, Rate Limiting, et force l'annulation HSTS.
 * ====================================================================
 */

import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Express } from 'express';

export function setupSecurity(app: Express) {
  // CORRECTION : On désactive CSP pour autoriser les scripts EJS, et HSTS pour éviter le forçage HTTPS
  app.use(helmet({
    contentSecurityPolicy: false, // Permet le bon lancement des scripts du Dashboard
    hsts: false
  }));

  // Force l'annulation active du cache HTTPS des navigateurs mobiles (HSTS Clear)
  app.use((req, res, next) => {
    res.setHeader('Strict-Transport-Security', 'max-age=0');
    next();
  });

  const allowedOrigins = [
    'http://node01.eternodes.fr:40044',
    'http://omnix.opik.net',
    'http://localhost:3000'
  ];

  // Configuration CORS dynamique pour autoriser la communication multi-domaines
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      
      const isAllowed = allowedOrigins.includes(origin) || 
                        origin.endsWith('eternodes.fr:40044') || 
                        origin.endsWith('opik.net');
      
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Requête bloquée par la politique CORS d\'OMNIX'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Trop de requêtes effectuées. Veuillez réessayer plus tard.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api/', generalLimiter);
}