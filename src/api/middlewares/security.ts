/**
 * ====================================================================
 * CONFIGURATION DE LA SÉCURITÉ DE L'API (OMNIX CORE - DÉBOGAGE CORS)
 * Gère Helmet, CORS dynamique, Rate Limiting, et trust proxy.
 * ====================================================================
 */

import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Express } from 'express';
import { CONFIG } from '../../config'; // Import requis pour récupérer CLIENT_URL dynamiquement

export function setupSecurity(app: Express) {
  // CORRECTIF CLOUD : Fait confiance au proxy de Render pour éviter le crash de démarrage
  app.set('trust proxy', 1);

  // Désactivation de la directive HSTS et de la politique CSP de Helmet pour le Dashboard EJS
  app.use(helmet({
    contentSecurityPolicy: false,
    hsts: false
  }));

  // Annulation du cache HTTPS des navigateurs mobiles (HSTS Clear)
  app.use((req, res, next) => {
    res.setHeader('Strict-Transport-Security', 'max-age=0');
    next();
  });

  // Liste des domaines autorisés de base
  const allowedOrigins = [
    'http://node01.eternodes.fr:40044',
    'http://omnix.opik.net',
    'http://localhost:3000',
    CONFIG.CLIENT_URL // Autorise dynamiquement l'adresse configurée sur Render !
  ];

  // Configuration CORS dynamique sécurisée
  app.use(cors({
    origin: (origin, callback) => {
      // Requêtes sans origine autorisées (ex: outils de test, requêtes internes)
      if (!origin) return callback(null, true);
      
      // CORRECTIF CORS : Autorise les domaines de la liste blanche OU tout sous-domaine de Render
      const isAllowed = allowedOrigins.includes(origin) || 
                        origin.endsWith('eternodes.fr:40044') || 
                        origin.endsWith('opik.net') ||
                        origin.endsWith('onrender.com'); // Autorise l'adresse https de Render !
      
      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`[CORS] 🚫 Requête bloquée pour l'origine non autorisée : ${origin}`);
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