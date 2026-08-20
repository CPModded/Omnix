import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import path from 'node:path';
import fs from 'node:fs';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import authRouter, {
  getRequestToken,
  verifyJwt,
  isOwner,
} from './routes/auth.routes.ts';
import guildRoutes from './routes/guild.routes.ts';
import statsRouter from './routes/stats.routes.ts';
import adminRouter from './routes/admin.routes.ts';
/* =========================================================
   OMNIX — EXPRESS APPLICATION
========================================================= */
/* =========================================================
   PROJECT PATH
========================================================= */
const PROJECT_ROOT =
  process.cwd();
/* =========================================================
   POSSIBLE VIEWS DIRECTORIES
========================================================= */
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
/* =========================================================
   POSSIBLE PUBLIC DIRECTORIES
========================================================= */
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
/* =========================================================
   FIND EXISTING DIRECTORY
========================================================= */
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
/* =========================================================
   FIND VIEW
========================================================= */
function findView(
  viewName: string,
): string | null {
  const normalized =
    viewName.endsWith('.ejs')
      ? viewName
      : `${viewName}.ejs`;
  const viewsDirectory =
    findExistingDirectory(
      POSSIBLE_VIEWS,
    );
  const possiblePaths = [
    path.join(
      viewsDirectory,
      normalized,
    ),
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
/* =========================================================
   FIND PUBLIC FILE
========================================================= */
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
/* =========================================================
   EXPRESS
========================================================= */
const app: Express =
  express();
/* =========================================================
   BASIC CONFIGURATION
========================================================= */
app.set(
  'trust proxy',
  1,
);
app.disable(
  'x-powered-by',
);
/* =========================================================
   SECURITY
========================================================= */
app.use(
  helmet({
    contentSecurityPolicy:
      false,
    crossOriginEmbedderPolicy:
      false,
    crossOriginResourcePolicy:
      false,
  }),
);
/* =========================================================
   BODY PARSERS
========================================================= */
app.use(
  express.json({
    limit:
      '10mb',
  }),
);
app.use(
  express.urlencoded({
    extended:
      true,
    limit:
      '10mb',
  }),
);
/* =========================================================
   COOKIES
========================================================= */
app.use(
  cookieParser(),
);
/* =========================================================
   EJS
========================================================= */
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
/* =========================================================
   STATIC FILES
========================================================= */
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
    // Ignore invalid public directories.
  }
}
/* =========================================================
   LOGO FALLBACK
========================================================= */
/*
 * Permet à /logo.png de fonctionner même si
 * le fichier est situé dans un des différents
 * dossiers utilisés par OMNIX.
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
/* =========================================================
   API CACHE CONTROL
========================================================= */
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
/* =========================================================
   AUTH MIDDLEWARE
========================================================= */
/**
 * Vérifie uniquement que l'utilisateur possède
 * une session OMNIX valide.
 */
function requireAuthentication(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token =
    getRequestToken(
      req,
    );
  if (!token) {
    /*
     * API → JSON
     */
    if (
      req.path.startsWith(
        '/api',
      )
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
    return res.redirect(
      '/',
    );
  }
  const payload =
    verifyJwt(
      token,
    );
  if (!payload) {
    if (
      req.path.startsWith(
        '/api',
      )
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
    return res.redirect(
      '/',
    );
  }
  /*
   * On expose l'utilisateur
   * au reste de la requête.
   */
  (
    req as Request & {
      user?: typeof payload;
    }
  ).user =
    payload;
  return next();
}
/* =========================================================
   GUILD ACCESS MIDDLEWARE
========================================================= */
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
    if (!user?.discordId) {
      return res.redirect(
        '/',
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
     * Pour les routes de page,
     * on utilise le router guilds / User
     * indirectement via l'API.
     *
     * Ici on vérifie simplement que le JWT
     * appartient bien à un utilisateur OMNIX.
     */
    const { User } =
      await import(
        '../../models/User.ts'
      );
    const dbUser =
      await User.findOne({
        discordId:
          user.discordId,
      }).lean();
    if (!dbUser) {
      return res.redirect(
        '/',
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
          String(item.id) ===
          guildId,
      );
    if (!guild) {
      return res.status(
        403,
      ).send(
        'Vous n’avez pas accès à ce serveur.',
      );
    }
    /*
     * Administrateur ou propriétaire.
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
    const owner =
      Boolean(
        guild.owner,
      ) ||
      isOwner(
        user.discordId,
      );
    if (
      !administrator &&
      !owner
    ) {
      return res.status(
        403,
      ).send(
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
    return res.status(
      500,
    ).send(
      'Impossible de vérifier l’accès au serveur.',
    );
  }
}
/* =========================================================
   HEALTH
========================================================= */
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
      status:
        'online',
      timestamp:
        new Date().toISOString(),
    });
  },
);
/* =========================================================
   API ROUTES
========================================================= */
/*
 * AUTH
 *
 * /api/auth/...
 */
app.use(
  '/api/auth',
  authRouter,
);
/*
 * GUILDS
 *
 * /api/guilds
 * /api/guilds/:guildId
 * /api/guilds/:guildId/channels
 * /api/guilds/:guildId/roles
 * /api/guilds/:guildId/invite
 */
app.use(
  '/api/guilds',
  guildRoutes,
);
/*
 * STATS
 *
 * stats.routes.ts :
 *
 * /stats
 * /stats/health
 *
 * Monté sur /api :
 *
 * /api/stats
 * /api/stats/health
 */
app.use(
  '/api',
  statsRouter,
);
/*
 * ADMIN API
 */
app.use(
  '/api/admin',
  adminRouter,
);
/* =========================================================
   HOME
========================================================= */
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
      return res.status(
        500,
      ).send(
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
      return res.status(
        500,
      ).send(
        'Erreur lors du chargement de la page.',
      );
    }
  },
);
/* =========================================================
   DASHBOARD
========================================================= */
app.get(
  '/dashboard',
  requireAuthentication,
  (
    req: Request,
    res: Response,
  ) => {
    try {
      const view =
        findView(
          'dashboard',
        );
      if (!view) {
        return res.status(
          500,
        ).send(
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
        '[Web] GET /dashboard',
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
      return res.status(
        500,
      ).send(
        'Erreur lors du chargement du Dashboard OMNIX.',
      );
    }
  },
);
/* =========================================================
   DASHBOARD — GUILD
========================================================= */
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
          'dashboard',
        );
      if (!view) {
        return res.status(
          500,
        ).send(
          'La page Dashboard OMNIX est introuvable.',
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
      console.log(
        `[Web] GET /dashboard/${guildId}`,
      );
      return res.render(
        'dashboard',
        {
          user,
          guildId,
          guild:
            (
              req as Request & {
                guild?: any;
              }
            ).guild,
        },
      );
    } catch (error) {
      console.error(
        '[Web] Erreur dashboard guild :',
        error,
      );
      return res.status(
        500,
      ).send(
        'Erreur lors du chargement de la configuration serveur.',
      );
    }
  },
);
/* =========================================================
   PREMIUM
========================================================= */
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
    if (!view) {
      return res
        .status(404)
        .send(
          'Page Premium indisponible.',
        );
    }
    return res.render(
      'premium',
    );
  },
);
/* =========================================================
   PRICING
========================================================= */
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
/* =========================================================
   SUPPORT
========================================================= */
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
    if (!view) {
      return res
        .status(404)
        .send(
          'Page Support indisponible.',
        );
    }
    return res.render(
      'support',
    );
  },
);
/* =========================================================
   FOUNDER
========================================================= */
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
    );
  },
);
/* =========================================================
   LEARN MORE
========================================================= */
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
/* =========================================================
   AI DEV
========================================================= */
/*
 * IMPORTANT :
 *
 * Si ai-dev.ejs n'existe pas,
 * on ne fait PAS un res.render()
 * qui déclenche une erreur globale.
 */
app.get(
  '/ai-dev',
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
      return res.render(
        'ai-dev',
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
/* =========================================================
   ADMIN PAGE
========================================================= */
/*
 * Le panneau Admin est distinct de
 * /api/admin.
 */
app.get(
  '/admin',
  requireAuthentication,
  (
    req: Request,
    res: Response,
  ) => {
    const user =
      (
        req as Request & {
          user?: any;
        }
      ).user;
    if (
      !user ||
      (
        !user.isAdmin &&
        !user.isOwner &&
        !isOwner(
          user.discordId,
        )
      )
    ) {
      return res.status(
        403,
      ).send(
        'Accès administrateur refusé.',
      );
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
   API 404
========================================================= */
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
/* =========================================================
   WEB 404
========================================================= */
app.use(
  (
    req: Request,
    res: Response,
  ) => {
    /*
     * Les assets inconnus ne doivent pas provoquer
     * une page HTML inutile.
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
/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */
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
/* =========================================================
   EXPORT
========================================================= */
export default app;
/* =========================================================
   FACTORY
========================================================= */
export function createApp(): Express {
  return app;
}