import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from 'express';

import path from 'node:path';
import fs from 'node:fs';
import mongoose from 'mongoose';

import cookieParser from 'cookie-parser';
import { setupSecurity } from './middlewares/security';

import authRouter, {
  getRequestToken,
  verifyJwt,
  isOwner,
} from './routes/auth.routes';

import guildRoutes from './routes/guild.routes';
import statsRouter from './routes/stats.routes';
import adminRouter from './routes/admin.routes';
import pricingRoutes from './routes/pricing.routes';
import aiDevRoutes from './routes/ai-dev.routes';
import referralRoutes from './routes/referral.routes';
import backupRoutes from './routes/backup.routes';
import guildConfigRoutes from './routes/guildConfig.routes';
import paymentRoutes from './routes/payment.routes';
import licenseRoutes from './routes/license.routes';
import emailRoutes from './routes/email.routes';
import partnerRoutes from './routes/partner.routes';
import supportRoutes from './routes/support.routes';
import auditRoutes from './routes/audit.routes';

import { isAuthenticated } from './middlewares/auth';
import { User } from '../models/User';
import License from '../models/License';
import PlatformEvent from '../models/PlatformEvent';
import { detectWebLocale } from '../services/geoLocale';

/*
 * =========================================================
 * OMNIX — EXPRESS APPLICATION
 * =========================================================
 *
 * AUTHENTIFICATION :
 *
 *     jwt_token
 *
 * Le JWT est stocké uniquement dans le cookie httpOnly.
 *
 * Les pages WEB utilisent :
 *
 *     requireAuthentication()
 *
 * Les API utilisent :
 *
 *     isAuthenticated()
 *
 * Les deux utilisent exactement le même système de session.
 * =========================================================
 */

const app: Express = express();

/*
 * =========================================================
 * PROJECT ROOT
 * =========================================================
 */

const PROJECT_ROOT =
  process.cwd();

/*
 * =========================================================
 * POSSIBLE VIEWS DIRECTORIES
 * =========================================================
 */

const POSSIBLE_VIEWS = [
  path.join(
    PROJECT_ROOT,
    'views',
  ),

  path.join(
    PROJECT_ROOT,
    'src',
    'dashboard',
    'views',
  ),

  path.join(
    PROJECT_ROOT,
    'dist',
    'dashboard',
    'views',
  ),

  path.join(PROJECT_ROOT, 'dist', 'src', 'dashboard', 'views'),

  path.join(
    PROJECT_ROOT,
    'src',
    'views',
  ),

  path.join(
    PROJECT_ROOT,
    'dist',
    'views',
  ),
];

/*
 * =========================================================
 * POSSIBLE PUBLIC DIRECTORIES
 * =========================================================
 */

const POSSIBLE_PUBLIC = [
  path.join(
    PROJECT_ROOT,
    'public',
  ),

  path.join(
    PROJECT_ROOT,
    'src',
    'dashboard',
    'public',
  ),

  path.join(
    PROJECT_ROOT,
    'dist',
    'dashboard',
    'public',
  ),

  path.join(PROJECT_ROOT, 'dist', 'src', 'dashboard', 'public'),

  path.join(
    PROJECT_ROOT,
    'src',
    'public',
  ),

  path.join(
    PROJECT_ROOT,
    'dist',
    'public',
  ),
];

/*
 * =========================================================
 * FIND EXISTING DIRECTORY
 * =========================================================
 */

function findExistingDirectory(
  directories: string[],
): string {
  for (
    const directory of directories
  ) {
    try {
      if (
        fs.existsSync(
          directory,
        ) &&
        fs.statSync(
          directory,
        ).isDirectory()
      ) {
        return directory;
      }
    } catch {
      // Ignore inaccessible directories.
    }
  }

  return directories[0];
}

/*
 * =========================================================
 * FIND VIEW
 * =========================================================
 */

function findView(
  viewName: string,
): string | null {
  const normalized =
    viewName.endsWith('.ejs')
      ? viewName
      : `${viewName}.ejs`;

  const possiblePaths = [
    ...POSSIBLE_VIEWS.map(
      (directory) =>
        path.join(
          directory,
          normalized,
        ),
    ),
  ];

  for (
    const viewPath of possiblePaths
  ) {
    try {
      if (
        fs.existsSync(
          viewPath,
        ) &&
        fs.statSync(
          viewPath,
        ).isFile()
      ) {
        return viewPath;
      }
    } catch {
      // Ignore invalid paths.
    }
  }

  return null;
}

/*
 * =========================================================
 * FIND PUBLIC FILE
 * =========================================================
 */

function findPublicFile(
  fileName: string,
): string | null {
  const cleanName =
    fileName
      .replace(/^\/+/, '')
      .replace(/\.\./g, '');

  for (
    const directory of POSSIBLE_PUBLIC
  ) {
    const filePath =
      path.join(
        directory,
        cleanName,
      );

    try {
      if (
        fs.existsSync(
          filePath,
        ) &&
        fs.statSync(
          filePath,
        ).isFile()
      ) {
        return filePath;
      }
    } catch {
      // Ignore.
    }
  }

  return null;
}

/*
 * =========================================================
 * BASIC CONFIGURATION
 * =========================================================
 */

app.disable(
  'x-powered-by',
);

/*
 * =========================================================
 * SECURITY
 * =========================================================
 */
setupSecurity(app);

/*
 * =========================================================
 * BODY PARSERS
 * =========================================================
 */

app.use(express.json({
  limit: '5mb',
  verify: (
    req: Request & { rawBody?: Buffer },
    _res: Response,
    buf: Buffer,
  ) => {
    // Stripe signe le corps HTTP brut. Utiliser req.path évite de perdre
    // la signature si le webhook reçoit exceptionnellement une query string.
    if (req.path === '/api/payments/webhook') {
      req.rawBody = Buffer.from(buf);
    }
  },
}));

app.use(express.urlencoded({ extended: true, limit: '100kb' }));

/*
 * =========================================================
 * COOKIES
 * =========================================================
 *
 * IMPORTANT :
 *
 * cookieParser() doit être chargé AVANT
 * toutes les routes qui utilisent req.cookies.
 *
 * Cela est indispensable pour :
 *
 *     /api/auth/me
 *     /api/auth/guilds
 *     /api/ai-dev
 *     /dashboard
 *     /admin
 *
 * =========================================================
 */

app.use(
  cookieParser(),
);

// Localisation du site : pays/IP en priorité lorsque disponible, puis langue
// du navigateur. Le résultat est mis en cache côté service pour éviter une
// requête de géolocalisation à chaque navigation. Aucun emplacement précis
// n'est exposé au frontend : seulement une locale et, si disponible, un pays.
app.use(async (req: Request, res: Response, next: NextFunction) => {
  const acceptsHtml = String(req.headers.accept || '').includes('text/html');
  if (!acceptsHtml || req.path.startsWith('/api/') || req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path.startsWith('/assets/')) return next();
  try {
    const detected = await detectWebLocale(req);
    res.locals.omnixLocale = detected.locale;
    res.locals.omnixCountry = detected.country;
    res.locals.omnixVpnDetected = detected.vpn;
  } catch {
    res.locals.omnixLocale = String(req.headers['accept-language'] || 'fr').split(',')[0].split(';')[0] || 'fr';
  }
  return next();
});

/*
 * =========================================================
 * EJS
 * =========================================================
 */

const viewsDirectory =
  findExistingDirectory(
    POSSIBLE_VIEWS,
  );

app.set(
  'view engine',
  'ejs',
);

app.set(
  'views',
  viewsDirectory,
);

/*
 * =========================================================
 * STATIC FILES
 * =========================================================
 */

// Explicit mounts for the canonical public assets. This keeps /css/* and /js/*
// stable even when Render starts the app through src/index.ts or a compiled build.
const canonicalPublic = path.join(PROJECT_ROOT, 'public');
const sourceRelativePublic = path.resolve(__dirname, '../../public');
const staticPublicCandidates = Array.from(new Set([
  ...POSSIBLE_PUBLIC,
  canonicalPublic,
  sourceRelativePublic,
]));

// /css et /assets sont montés explicitement sur le premier dossier réellement
// présent. Render peut démarrer OMNIX depuis la racine du dépôt, src/ ou une
// version compilée : le chemin relatif ne doit pas décider si le CSS existe.
const existingPublicDirectories = staticPublicCandidates.filter((directory) => {
  try { return fs.existsSync(directory) && fs.statSync(directory).isDirectory(); }
  catch { return false; }
});
const cssDirectories = existingPublicDirectories
  .map((directory) => path.join(directory, 'css'))
  .filter((directory) => {
    try { return fs.existsSync(directory) && fs.statSync(directory).isDirectory(); }
    catch { return false; }
  });

for (const cssDirectory of cssDirectories) {
  app.use('/css', express.static(cssDirectory, {
    fallthrough: true,
    maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  }));
}

// Fallback déterministe pour le stylesheet principal. Cela couvre les
// démarrages depuis src/index.ts, dist/ ou un cwd différent de la racine.
const omnixWebCssCandidates = Array.from(new Set([
  ...cssDirectories.map((directory) => path.join(directory, 'omnix-web.css')),
  path.resolve(__dirname, '../../public/css/omnix-web.css'),
  path.join(PROJECT_ROOT, 'public/css/omnix-web.css'),
]));

app.get('/css/omnix-web.css', (req, res, next) => {
  const cssFile = omnixWebCssCandidates.find((file) => {
    try { return fs.existsSync(file) && fs.statSync(file).isFile(); }
    catch { return false; }
  });
  if (!cssFile) return next();
  return res.sendFile(cssFile);
});
for (const publicDirectory of existingPublicDirectories) {
  app.use('/assets', express.static(publicDirectory, {
    fallthrough: true,
    maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  }));
}

for (
  const publicDirectory of POSSIBLE_PUBLIC
) {
  try {
    if (
      fs.existsSync(
        publicDirectory,
      ) &&
      fs.statSync(
        publicDirectory,
      ).isDirectory()
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

            fallthrough:
              true,
          },
        ),
      );
    }
  } catch {
    // Ignore invalid directories.
  }
}

/*
 * =========================================================
 * LOGO FALLBACK
 * =========================================================
 */

app.get(
  '/logo.png',
  (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const logo =
      findPublicFile(
        'logo.png',
      );

    if (!logo) {
      return next();
    }

    return res.sendFile(
      logo,
    );
  },
);

/*
 * =========================================================
 * API CACHE CONTROL
 * =========================================================
 */

app.use(
  '/api',
  (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
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

    next();
  },
);

/*
 * =========================================================
 * WEB AUTHENTICATION
 * =========================================================
 *
 * IMPORTANT FIX
 *
 * L'ancien système redirigeait systématiquement
 * vers "/" lorsqu'une page protégée ne trouvait
 * pas le JWT.
 *
 * Maintenant :
 *
 *     /dashboard
 *     /admin
 *     /mon-espace
 *
 * redirigent vers :
 *
 *     /api/auth/login
 *
 * et non vers la page d'accueil.
 *
 * =========================================================
 */

async function requireAuthentication(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token =
    getRequestToken(req);

  /*
   * Pas de session.
   */

  if (!token) {
    console.warn(
      `[Auth] Session absente : ${req.method} ${req.originalUrl}`,
    );

    /*
     * API → JSON
     */

    if (
      req.path.startsWith('/api')
    ) {
      return res
        .status(401)
        .json({
          success:
            false,

          error:
            'Authentification requise.',

          code:
            'AUTH_REQUIRED',
        });
    }

    /*
     * Page web → connexion Discord
     */

    return res.redirect(
      '/api/auth/login',
    );
  }

  /*
   * Vérification JWT.
   */

  const payload =
    verifyJwt(token);

  if (!payload) {
    console.warn(
      `[Auth] JWT invalide : ${req.method} ${req.originalUrl}`,
    );

    /*
     * API → JSON
     */

    if (
      req.path.startsWith('/api')
    ) {
      return res
        .status(401)
        .json({
          success:
            false,

          error:
            'Session invalide ou expirée.',

          code:
            'AUTH_INVALID',
        });
    }

    /*
     * Session invalide :
     * on supprime le cookie.
     */

    res.clearCookie(
      'jwt_token',
      {
        httpOnly:
          true,

        secure:
          process.env.NODE_ENV ===
          'production',

        sameSite:
          'lax',

        path:
          '/',
      },
    );

    /*
     * Puis nouvelle connexion Discord.
     */

    return res.redirect(
      '/api/auth/login',
    );
  }

  /*
   * Vérification serveur du statut de compte.
   *
   * Le JWT ne contient pas le statut de blacklist afin qu'une suspension
   * puisse prendre effet sans attendre l'expiration de la session.
   */
  try {
    const dbUser = await User.findOne({
      discordId: String(payload.discordId),
    })
      .select('isBlacklisted')
      .lean()
      .maxTimeMS(3000);

    if (dbUser?.isBlacklisted === true) {
      res.clearCookie('jwt_token', {
        httpOnly: true,
        secure:
          process.env.NODE_ENV === 'production' ||
          process.env.RENDER === 'true',
        sameSite: 'lax',
        path: '/',
      });

      if (req.path.startsWith('/api')) {
        return res.status(403).json({
          success: false,
          error: 'Compte OMNIX suspendu.',
          code: 'ACCOUNT_BLACKLISTED',
        });
      }

      return res.redirect('/suspended');
    }
  } catch (error) {
    console.error('[Auth] Impossible de vérifier le statut du compte :', error);

    if (req.path.startsWith('/api')) {
      return res.status(503).json({
        success: false,
        error: 'Service d’authentification temporairement indisponible.',
        code: 'AUTH_SERVICE_UNAVAILABLE',
      });
    }

    return res.status(503).send(
      'Le service d’authentification est temporairement indisponible.',
    );
  }

  /*
   * Expose le JWT décodé à la requête.
   */

  (
    req as Request & {
      user?: typeof payload;
    }
  ).user =
    payload;

  return next();
}

/*
 * =========================================================
 * GUILD ACCESS
 * =========================================================
 */

async function requireGuildAccess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user =
      (
        req as Request & {
          user?: {
            discordId: string;
          };
        }
      ).user;

    if (
      !user?.discordId
    ) {
      return res.redirect(
        '/api/auth/login',
      );
    }

    const guildId =
      String(
        req.params.guildId ||
        '',
      ).trim();

    if (!guildId) {
      return res.redirect(
        '/dashboard',
      );
    }

    /*
     * Import dynamique pour éviter
     * les dépendances circulaires.
     */

    const { User } =
      await import(
        '../models/User'
      );

    const dbUser =
      await User.findOne({
        discordId:
          user.discordId,
      }).lean();

    if (!dbUser) {
      return res.redirect(
        '/api/auth/login',
      );
    }

    const guilds =
      Array.isArray(
        (dbUser as any).guilds,
      )
        ? (dbUser as any).guilds
        : [];

    const guild =
      guilds.find(
        (item: any) =>
          String(item?.id) ===
          guildId,
      );

    if (!guild) {
      return res
        .status(403)
        .send(
          'Vous n’avez pas accès à ce serveur.',
        );
    }

    /*
     * Discord Administrator.
     */

    const permissions =
      String(
        guild.permissions ||
        '0',
      );

    let administrator =
      false;

    try {
      administrator =
        (
          (
            BigInt(
              permissions,
            ) &
            0x8n
          ) ===
          0x8n
        );
    } catch {
      administrator =
        false;
    }

    /*
     * Owner du serveur
     * OU owner OMNIX.
     */

    const owner =
      Boolean(guild.owner) || Boolean((dbUser as any).isAdmin) || isOwner(user.discordId);

    if (
      !administrator &&
      !owner
    ) {
      return res
        .status(403)
        .send(
          'Vous devez être propriétaire ou administrateur de ce serveur.',
        );
    }

    (
      req as Request & {
        guild?: any;
      }
    ).guild =
      guild;

    return next();
  } catch (error) {
    console.error(
      '[Web] Erreur accès guild :',
      error,
    );

    return res
      .status(500)
      .send(
        'Impossible de vérifier l’accès au serveur.',
      );
  }
}

/*
 * =========================================================
 * HEALTH
 * =========================================================
 */

app.get('/api/system/routes', requireAuthentication, (req: Request, res: Response) => {
  const stack: any[] = (app as any)._router?.stack || [];
  const routes: string[] = [];
  for (const layer of stack) {
    if (layer?.route?.path) {
      const methods = Object.keys(layer.route.methods || {}).filter(Boolean).map((m) => m.toUpperCase());
      for (const method of methods) routes.push(`${method} ${layer.route.path}`);
    }
    if (layer?.name === 'router' && layer?.regexp) routes.push('MOUNTED ROUTER');
  }
  return res.json({ success: true, count: routes.length, routes: routes.slice(0, 500), timestamp: new Date().toISOString() });
});

app.get(
  '/health',
  (
    req: Request,
    res: Response,
  ) => {
    return res.json({
      success:
        true,

      service:
        'OMNIX',

      status: (() => { const c: any = (globalThis as any).omnixDiscordClient; const commandStatus = c?.omnixCommandLoadStatus; const eventStatus = c?.omnixEventLoadStatus; return commandStatus?.degraded || eventStatus?.degraded ? 'degraded' : (c?.isReady?.() ? 'online' : 'starting'); })(),
      discord: Boolean((globalThis as any).omnixDiscordClient?.isReady?.()),
      commands: (globalThis as any).omnixDiscordClient?.commands?.size ?? 0,
      events: (globalThis as any).omnixLoadedEvents?.length ?? 0,
      mongodb: mongoose.connection.readyState === 1,

      timestamp:
        new Date().toISOString(),
    });
  },
);

/*
 * =========================================================
 * AUTH ROUTES
 * =========================================================
 *
 * /api/auth/login
 * /api/auth/callback
 * /api/auth/me
 * /api/auth/guilds
 * /api/auth/logout
 *
 * IMPORTANT :
 *
 * authRouter est monté AVANT les routes
 * qui nécessitent une authentification.
 *
 * =========================================================
 */

app.use(
  '/api/auth',
  authRouter,
);

/*
 * =========================================================
 * DASHBOARD — PREFERENCES PAR UTILISATEUR
 * =========================================================
 */

app.get('/api/dashboard/preferences', requireAuthentication, async (req: Request, res: Response) => {
  try {
    const user = (req as Request & { user?: { discordId?: string } }).user;
    if (!user?.discordId) return res.status(401).json({ success: false, error: 'Authentification requise.' });
    const dbUser = await User.findOne({ discordId: user.discordId }).select('dashboardPreferences').lean();
    return res.json({ success: true, preferences: (dbUser as any)?.dashboardPreferences || {} });
  } catch (error) {
    console.error('[Dashboard Preferences] GET:', error);
    return res.status(500).json({ success: false, error: 'Impossible de charger les préférences.' });
  }
});

app.patch('/api/dashboard/preferences', requireAuthentication, async (req: Request, res: Response) => {
  try {
    const user = (req as Request & { user?: { discordId?: string } }).user;
    if (!user?.discordId) return res.status(401).json({ success: false, error: 'Authentification requise.' });
    const body = req.body || {};
    const preferences = {
      compactMode: Boolean(body.compactMode),
      sidebarCollapsed: Boolean(body.sidebarCollapsed),
      animations: body.animations !== false,
      showStats: body.showStats !== false,
      showServers: body.showServers !== false,
      showActivity: body.showActivity !== false,
      showStatistics: body.showStatistics !== false,
      density: body.density === 'compact' ? 'compact' : 'comfortable',
    };
    const updated = await User.findOneAndUpdate(
      { discordId: user.discordId },
      { $set: { dashboardPreferences: preferences } },
      { new: true, runValidators: true, upsert: false },
    ).select('dashboardPreferences').lean();
    if (!updated) return res.status(404).json({ success: false, error: 'Utilisateur introuvable.' });
    return res.json({ success: true, preferences: (updated as any).dashboardPreferences || preferences });
  } catch (error) {
    console.error('[Dashboard Preferences] PATCH:', error);
    return res.status(500).json({ success: false, error: 'Impossible d’enregistrer les préférences.' });
  }
});

/*
 * =========================================================
 * MEMBER / ACCOUNT API
 * =========================================================
 */

const getSessionUser = (req: Request) => {
  const token = getRequestToken(req);
  return token ? verifyJwt(token) : null;
};

app.get('/api/me/overview', isAuthenticated as any, async (req: Request, res: Response) => {
  try {
    const session = getSessionUser(req);
    if (!session?.discordId) return res.status(401).json({ success: false, error: 'Authentification requise.' });
    const [user, licenses] = await Promise.all([
      User.findOne({ discordId: session.discordId }).select('discordId username globalName email createdAt lastLogin isPremium premiumExpiresAt guilds').lean(),
      License.find({ buyerId: session.discordId }).sort({ createdAt: -1 }).lean(),
    ]);
    if (!user) return res.status(404).json({ success: false, error: 'Utilisateur introuvable.' });

    const now = Date.now();
    const activeLicenses = licenses.filter((license: any) =>
      ['active', 'used'].includes(String(license.status)) &&
      (!license.expiresAt || new Date(license.expiresAt).getTime() > now),
    );
    const latest = activeLicenses[0] || null;
    const activatedIds = new Set<string>();
    for (const license of activeLicenses as any[]) {
      if (license.activatedGuildId) activatedIds.add(String(license.activatedGuildId));
      for (const id of Array.isArray(license.activatedGuildIds) ? license.activatedGuildIds : []) activatedIds.add(String(id));
    }
    const premiumSince = activeLicenses
      .map((license: any) => license.activatedAt || license.createdAt)
      .filter(Boolean)
      .sort((a: any, b: any) => new Date(a).getTime() - new Date(b).getTime())[0] || null;

    return res.json({
      success: true,
      user: {
        discordId: user.discordId,
        username: user.username,
        globalName: user.globalName || null,
        email: user.email || null,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin || null,
      },
      premium: {
        active: Boolean(user.isPremium || activeLicenses.length),
        since: premiumSince,
        expiresAt: user.premiumExpiresAt || latest?.expiresAt || null,
        usedServers: activatedIds.size,
        serverLimit: Math.max(10, ...activeLicenses.map((l: any) => Number(l.maxGuilds || 10))),
      },
      servers: (user.guilds || []).map((guild: any) => ({
        id: guild.id,
        name: guild.name,
        owner: Boolean(guild.owner),
        permissions: guild.permissions || '0',
      })),
    });
  } catch (error) {
    console.error('[Account API] overview', error);
    return res.status(500).json({ success: false, error: 'Impossible de charger votre espace.' });
  }
});

app.get('/api/me/activity', isAuthenticated as any, async (req: Request, res: Response) => {
  try {
    const session = getSessionUser(req);
    if (!session?.discordId) return res.status(401).json({ success: false, error: 'Authentification requise.' });
    const user = await User.findOne({ discordId: session.discordId }).select('guilds').lean();
    const guildIds = (user?.guilds || []).map((g: any) => String(g.id)).filter(Boolean);
    const data = await PlatformEvent.find({
      $or: [{ userId: session.discordId }, ...(guildIds.length ? [{ guildId: { $in: guildIds } }] : [])],
    }).sort({ createdAt: -1 }).limit(100).lean();
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[Account API] activity', error);
    return res.status(500).json({ success: false, error: 'Impossible de charger votre activité.' });
  }
});

app.get('/api/me/statistics', isAuthenticated as any, async (req: Request, res: Response) => {
  try {
    const session = getSessionUser(req);
    if (!session?.discordId) return res.status(401).json({ success: false, error: 'Authentification requise.' });
    const user = await User.findOne({ discordId: session.discordId }).select('guilds createdAt').lean();
    const guildIds = (user?.guilds || []).map((g: any) => String(g.id)).filter(Boolean);
    const [events, tickets, aiRequests] = await Promise.all([
      PlatformEvent.countDocuments({ userId: session.discordId }),
      PlatformEvent.countDocuments({ userId: session.discordId, type: 'ticket_created' }),
      PlatformEvent.countDocuments({ userId: session.discordId, type: 'ai_request' }),
    ]);
    return res.json({ success: true, statistics: {
      servers: guildIds.length,
      events,
      tickets,
      aiRequests,
      memberSince: user?.createdAt || null,
    }});
  } catch (error) {
    console.error('[Account API] statistics', error);
    return res.status(500).json({ success: false, error: 'Impossible de charger vos statistiques.' });
  }
});

/*
 * =========================================================
 * GUILD API
 * =========================================================
 */

app.use(
  '/api/guilds',
  guildRoutes,
);

/*
 * =========================================================
 * STATS API
 * =========================================================
 */

app.use(
  '/api',
  statsRouter,
);

/*
 * =========================================================
 * ADMIN API
 * =========================================================
 */

app.use('/api/admin', isAuthenticated as any, adminRouter);
app.use('/api/admin', auditRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/support', supportRoutes);

/*
 * =========================================================
 * PRICING API
 * =========================================================
 */

app.use(
  '/api/pricing',
  pricingRoutes,
);

/*
 * =========================================================
 * AI DEV API
 * =========================================================
 *
 * IMPORTANT FIX
 *
 * L'API AI-DEV utilise le même middleware
 * d'authentification que le reste d'OMNIX.
 *
 * Cookie :
 *
 *     jwt_token
 *
 * =========================================================
 */

app.use(
  '/api/ai-dev',
  aiDevRoutes,
);

app.use('/api/referrals', referralRoutes);
app.use('/referral', referralRoutes);

/*
 * =========================================================
 * ADDITIONAL API ROUTES
 * =========================================================
 */

app.use(
  '/api/guilds',
  backupRoutes,
);

app.use(
  '/api/guilds',
  guildConfigRoutes,
);

app.use(
  '/api/payments',
  paymentRoutes,
);

app.use(
  '/api/licenses',
  licenseRoutes,
);

/*
 * =========================================================
 * HOME
 * =========================================================
 */

app.get(
  '/',
  (
    req: Request,
    res: Response,
  ) => {
    const view =
      findView(
        'index',
      );

    if (!view) {
      return res
        .status(500)
        .send(
          'La page d’accueil OMNIX est introuvable.',
        );
    }

    try {
      return res.render(
        'index',
      );
    } catch (error) {
      console.error(
        '[Web] Erreur rendu / :',
        error,
      );

      return res
        .status(500)
        .send(
          'Erreur lors du chargement de la page.',
        );
    }
  },
);

/*
 * =========================================================
 * DASHBOARD
 * =========================================================
 */

app.get(
  '/dashboard',
  requireAuthentication,
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const view =
        findView(
          'dashboard',
        );

      if (!view) {
        return res
          .status(500)
          .send(
            'La page Dashboard OMNIX est introuvable.',
          );
      }

      const user =
        (
          req as Request & {
            user?: any;
          }
        ).user;

      console.log(
        `[Web] GET /dashboard | user=${user?.discordId ?? 'unknown'}`,
      );

      return res.render(
        'dashboard',
        {
          user,
        },
      );
    } catch (error) {
      console.error(
        '[Web] Erreur rendu /dashboard :',
        error,
      );

      return res
        .status(500)
        .send(
          'Erreur lors du chargement du Dashboard OMNIX.',
        );
    }
  },
);

/*
 * =========================================================
 * DASHBOARD — GUILD
 * =========================================================
 */

app.get(
  '/dashboard/:guildId',
  requireAuthentication,
  requireGuildAccess,
  (
    req: Request,
    res: Response,
  ) => {
    try {
      const view =
        findView(
          'manage',
        );

      if (!view) {
        return res
          .status(500)
          .send(
            'La page de gestion OMNIX est introuvable.',
          );
      }

      const user =
        (
          req as Request & {
            user?: any;
          }
        ).user;

      const guildId =
        String(
          req.params.guildId,
        );

      const guild =
        (
          req as Request & {
            guild?: any;
          }
        ).guild;

      console.log(
        `[Web] GET /dashboard/${guildId} | user=${user?.discordId ?? 'unknown'}`,
      );

      return res.render(
        'manage',
        {
          user,
          guildId,
          guild,
        },
      );
    } catch (error) {
      console.error(
        '[Web] Erreur dashboard guild :',
        error,
      );

      return res
        .status(500)
        .send(
          'Erreur lors du chargement de la configuration serveur.',
        );
    }
  },
);

/*
 * =========================================================
 * MON ESPACE
 * =========================================================
 *
 * OMNIX peut utiliser plusieurs noms de route
 * côté frontend.
 *
 * Toutes ces routes utilisent maintenant
 * le même système de session.
 *
 * =========================================================
 */

const renderAccountPage = (
  req: Request,
  res: Response,
) => {
  const viewCandidates = [
    'account',
    'mon-espace',
    'my-space',
    'profile',
  ];

  let viewName:
    string | null = null;

  for (
    const candidate of viewCandidates
  ) {
    if (
      findView(candidate)
    ) {
      viewName =
        candidate;
      break;
    }
  }

  /*
   * Si aucune vue spécifique n'existe,
   * on utilise le dashboard.
   *
   * Cela évite le retour silencieux vers "/".
   */

  if (!viewName) {
    viewName =
      'dashboard';
  }

  try {
    const user =
      (
        req as Request & {
          user?: any;
        }
      ).user;

    const routePath = String(req.path || '').replace(/\/+$/, '') || '/';
    const page = routePath === '/servers'
      ? 'servers'
      : routePath === '/activity'
        ? 'activity'
        : routePath === '/statistics'
          ? 'statistics'
          : 'profile';

    return res.render(
      viewName,
      {
        user,
        page,
      },
    );
  } catch (error) {
    console.error(
      '[Web] Erreur Mon Espace :',
      error,
    );

    return res
      .status(500)
      .send(
        'Erreur lors du chargement de votre espace OMNIX.',
      );
  }
};

/*
 * Plusieurs aliases sont volontairement
 * supportés pour ne pas casser le frontend.
 */

app.get(
  '/mon-espace',
  requireAuthentication,
  renderAccountPage,
);

app.get(
  '/my-space',
  requireAuthentication,
  renderAccountPage,
);

app.get(
  '/account',
  requireAuthentication,
  renderAccountPage,
);

app.get(
  '/profile',
  requireAuthentication,
  renderAccountPage,
);

app.get('/servers', requireAuthentication, renderAccountPage);
app.get('/activity', requireAuthentication, renderAccountPage);
app.get('/statistics', requireAuthentication, renderAccountPage);

/*
 * =========================================================
 * PREMIUM
 * =========================================================
 */

app.get(
  '/premium',
  (
    req: Request,
    res: Response,
  ) => {
    const view =
      findView(
        'premium',
      );

    if (!view) return res.redirect('/pricing');
    return res.render('premium');
  },
);

/*
 * =========================================================
 * PRICING
 * =========================================================
 */

app.get(
  '/pricing',
  (
    req: Request,
    res: Response,
  ) => {
    const view =
      findView(
        'pricing',
      );

    if (!view) {
      return res
        .status(404)
        .send(
          'Page Pricing indisponible.',
        );
    }

    return res.render(
      'pricing',
    );
  },
);

/*
 * =========================================================
 * SUPPORT
 * =========================================================
 */

app.get(
  '/support',
  (
    req: Request,
    res: Response,
  ) => {
    const view =
      findView(
        'support',
      );

    if (!view) return res.redirect('/learn-more');
    return res.render('support');
  },
);

/*
 * =========================================================
 * FOUNDER
 * =========================================================
 */

app.get(
  '/founder',
  (
    req: Request,
    res: Response,
  ) => {
    const view =
      findView(
        'founder',
      );

    if (!view) {
      return res
        .status(404)
        .send(
          'Page Founder indisponible.',
        );
    }

    return res.render(
      'founder',
      {
        founder: {
          name:
            'OMNIX',

          description:
            'Créateur et développeur de la plateforme OMNIX.',

          officialServer:
            'https://discord.gg/naBuatEBJ5',
        },
      },
    );
  },
);

/*
 * =========================================================
 * LEARN MORE
 * =========================================================
 */

app.get(
  '/learn-more',
  (
    req: Request,
    res: Response,
  ) => {
    const view =
      findView(
        'learn-more',
      );

    if (!view) {
      return res
        .status(404)
        .send(
          'Page indisponible.',
        );
    }

    return res.render(
      'learn-more',
    );
  },
);

/*
 * =========================================================
 * REFERRAL PAGE
 * =========================================================
 */
app.get('/referral', requireAuthentication, async (req: Request, res: Response) => {
  const view = findView('referral');
  if (!view) return res.status(404).send('Programme de parrainage indisponible.');
  return res.render('referral', { user: (req as any).user });
});

/*
 * =========================================================
 * AI DEV PAGE
 * =========================================================
 *
 * La page elle-même reste accessible.
 *
 * Les appels à :
 *
 *     /api/ai-dev/*
 *
 * sont protégés séparément.
 *
 * =========================================================
 */

app.get(
  '/ai-dev',
  requireAuthentication,
  (
    req: Request,
    res: Response,
  ) => {
    const view =
      findView(
        'ai-dev',
      );

    if (!view) {
      return res
        .status(404)
        .send(
          'La page AI Dev n’est pas disponible sur cette version d’OMNIX.',
        );
    }

    try {
      const user =
        (
          req as Request & {
            user?: any;
          }
        ).user;

      return res.render(
        'ai-dev',
        {
          user,
        },
      );
    } catch (error) {
      console.error(
        '[Web] Erreur /ai-dev :',
        error,
      );

      return res
        .status(500)
        .send(
          'Erreur lors du chargement de AI Dev.',
        );
    }
  },
);

/*
 * =========================================================
 * PARTNERS PAGE
 * =========================================================
 */
app.get(['/partners', '/partenaires'], (_req: Request, res: Response) => {
  const view = findView('partenaires');
  if (!view) return res.status(404).send('Page Partenaires indisponible.');
  return res.render('partenaires');
});

app.get('/partenaires/:partnerId/pub', async (req: Request, res: Response) => {
  try {
    const { default: Partner } = await import('../models/Partner');
    const partner = await Partner.findById(String(req.params.partnerId)).lean();
    if (!partner || !partner.adEnabled || (partner.adExpiresAt && new Date(partner.adExpiresAt).getTime() <= Date.now())) {
      return res.status(404).send('Publicité partenaire indisponible.');
    }
    const view = findView('partner-ad');
    if (!view) return res.status(404).send('Page de publicité indisponible.');
    return res.render('partner-ad', { partner });
  } catch (error) {
    console.error('[Web] Erreur publicité partenaire:', error);
    return res.status(500).send('Impossible de charger cette publicité.');
  }
});

/*
 * =========================================================
 * SUSPENDED / BLACKLIST
 * =========================================================
 */
app.get('/suspended', (req: Request, res: Response) => {
  const view = findView('suspended');
  if (!view) return res.status(404).send('Compte suspendu.');
  return res.render('suspended');
});

/*
 * =========================================================
 * ADMIN PAGE
 * =========================================================
 */

app.get(
  '/admin',
  requireAuthentication,
  async (
    req: Request,
    res: Response,
  ) => {
    const user =
      (
        req as Request & {
          user?: any;
        }
      ).user;

    const dbUser = user?.discordId ? await User.findOne({ discordId: String(user.discordId) }).select('isAdmin role isBlacklisted').lean().catch(() => null) : null;
    const owner = Boolean(user?.discordId && isOwner(String(user.discordId)));
    const admin = owner || Boolean(dbUser?.isAdmin) || ['support','moderator','admin','super_admin','owner'].includes(String(dbUser?.role || ''));
    if (!user || !admin || dbUser?.isBlacklisted) {
      return res.status(dbUser?.isBlacklisted ? 403 : 403).send(dbUser?.isBlacklisted ? 'Compte OMNIX suspendu.' : 'Accès administrateur refusé.');
    }

    const view =
      findView(
        'admin',
      );

    if (!view) {
      return res
        .status(404)
        .send(
          'Page Admin indisponible.',
        );
    }

    try {
      return res.render(
        'admin',
        {
          user,
          staffRole: owner ? 'owner' : String(dbUser?.role || (dbUser?.isAdmin ? 'admin' : 'user')),
        },
      );
    } catch (error) {
      console.error(
        '[Web] Erreur /admin :',
        error,
      );

      return res
        .status(500)
        .send(
          'Erreur lors du chargement du panneau Admin.',
        );
    }
  },
);

/* =========================================================
   CONNEXION
========================================================= */
app.get('/connexion', (req: Request, res: Response) => {
  // Résolution explicite du fichier afin de fonctionner aussi lorsque
  // le dossier de vues configuré par l'hébergeur pointe ailleurs.
  const viewPath = findView('connexion');

  if (!viewPath) {
    console.error('[Web] Vue connexion.ejs introuvable.');
    return res.status(404).render('404');
  }

  return res.render(viewPath, { error: typeof req.query.error === 'string' ? req.query.error : '' });
});

// Alias pratique : /login ouvre toujours la page publique de connexion.
app.get('/login', (_req: Request, res: Response) => {
  return res.redirect(302, '/connexion');
});

/* =========================================================
   LEGAL / PUBLIC PAGES
========================================================= */
for (const [route, view] of [['/cgv','cgv'],['/confidentialite','confidentialite'],['/cookies','cookies'],['/contact','contact'],['/mentions-legales','mentions-legales']] as const) {
  app.get(route, (_req: Request, res: Response) => {
    if (!findView(view)) return res.status(404).render('404');
    return res.render(view);
  });
}

/*
 * =========================================================
 * API 404
 * =========================================================
 */

app.use(
  '/api',
  (
    req: Request,
    res: Response,
  ) => {
    console.warn(
      `[API] 404 : ${req.method} ${req.originalUrl}`,
    );

    return res
      .status(404)
      .json({
        success:
          false,

        error:
          'Route API introuvable.',

        path:
          req.originalUrl,
      });
  },
);

/*
 * =========================================================
 * WEB 404
 * =========================================================
 */

app.use(
  (
    req: Request,
    res: Response,
  ) => {
    /*
     * Assets inconnus.
     */

    if (
      req.path.startsWith(
        '/assets/',
      ) ||
      req.path.endsWith(
        '.png',
      ) ||
      req.path.endsWith(
        '.jpg',
      ) ||
      req.path.endsWith(
        '.jpeg',
      ) ||
      req.path.endsWith(
        '.webp',
      ) ||
      req.path.endsWith(
        '.svg',
      ) ||
      req.path.endsWith(
        '.ico',
      )
    ) {
      return res
        .status(404)
        .send();
    }

    console.warn(
      `[Web] 404 : ${req.method} ${req.originalUrl}`,
    );

    const errorView =
      findView(
        '404',
      );

    if (!errorView) {
      return res
        .status(404)
        .send(
          'Page introuvable.',
        );
    }

    try {
      return res
        .status(404)
        .render(
          '404',
        );
    } catch {
      return res
        .status(404)
        .send(
          'Page introuvable.',
        );
    }
  },
);

/*
 * =========================================================
 * GLOBAL ERROR HANDLER
 * =========================================================
 */

app.use(
  (
    error: any,
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    console.error(
      '[Web] Erreur globale :',
      error,
    );

    if (
      res.headersSent
    ) {
      return next(
        error,
      );
    }

    if (
      req.path.startsWith(
        '/api',
      )
    ) {
      return res
        .status(500)
        .json({
          success:
            false,

          error:
            'Erreur interne du serveur.',
        });
    }

    return res
      .status(500)
      .send(
        'Erreur interne du serveur.',
      );
  },
);

/*
 * =========================================================
 * EXPORT
 * =========================================================
 */

export default app;

export function createApp(): Express {
  return app;
}