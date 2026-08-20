import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
// ============================================================
// PATHS
// ============================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(
  __dirname,
  '../..'
);
// ============================================================
// EXPRESS
// ============================================================
const app = express();
// ============================================================
// CONFIGURATION
// ============================================================
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.set(
  'view engine',
  'ejs'
);
app.set(
  'views',
  path.join(
    PROJECT_ROOT,
    'src',
    'dashboard',
    'views'
  )
);
// ============================================================
// SECURITY
// ============================================================
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
// ============================================================
// BODY
// ============================================================
app.use(
  express.json({
    limit: '2mb',
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: '2mb',
  })
);
// ============================================================
// CACHE
// ============================================================
app.use(
  (
    _req: Request,
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
// ============================================================
// RATE LIMIT
// ============================================================
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Trop de requêtes. Veuillez patienter.',
  },
});
app.use(
  '/api',
  apiLimiter
);
// ============================================================
// STATIC
// ============================================================
const publicPath = path.join(
  PROJECT_ROOT,
  'src',
  'dashboard',
  'public'
);
app.use(
  express.static(publicPath, {
    maxAge:
      process.env.NODE_ENV === 'production'
        ? '1h'
        : 0,
  })
);
// ============================================================
// HEALTH CHECK
// ============================================================
app.get(
  '/health',
  (_req: Request, res: Response) => {
    return res.status(200).json({
      status: 'ok',
      service: 'OMNIX',
      timestamp: new Date().toISOString(),
    });
  }
);
// ============================================================
// ROUTES
// ============================================================
//
// IMPORTANT
//
// Le dossier réel est :
//
// src/api/routes/
//
// Et le fichier réel est :
//
// guilds.routes.ts
//
// PAS guild.routes.ts
// ============================================================
import authRoutes from './routes/auth.routes.ts';
import guildsRoutes from './routes/guilds.routes.ts';
app.use(
  '/api/auth',
  authRoutes
);
app.use(
  '/api/guilds',
  guildsRoutes
);
// ============================================================
// API 404
// ============================================================
app.use(
  '/api',
  (
    req: Request,
    res: Response
  ) => {
    return res.status(404).json({
      error: 'Route API introuvable.',
      path: req.path,
    });
  }
);
// ============================================================
// WEB 404
// ============================================================
app.use(
  (
    _req: Request,
    res: Response
  ) => {
    return res.status(404).send(
      'Page introuvable.'
    );
  }
);
// ============================================================
// ERROR HANDLER
// ============================================================
app.use(
  (
    error: any,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    console.error(
      '[Web] Erreur Express :',
      error
    );
    if (res.headersSent) {
      return;
    }
    return res.status(500).json({
      error:
        'Une erreur interne est survenue.',
    });
  }
);
// ============================================================
// EXPORT
// ============================================================
//
// IMPORTANT :
// Aucun app.listen() ici.
//
// Le serveur HTTP doit être démarré depuis index.ts.
// ============================================================
export default app;