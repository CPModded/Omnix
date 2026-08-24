import express from 'express';
import type {
  Request,
  Response,
  NextFunction,
} from 'express';
import fs from 'fs';
import path from 'path';

import {
  getRequestToken,
  verifyJwt,
} from './auth.routes';

import { askOpenRouter } from '../../ai/openrouter';

/* =========================================================
   ROUTER
========================================================= */

const router = express.Router();

/* =========================================================
   CONFIGURATION
========================================================= */

const PROJECT_ROOT = path.resolve(process.cwd());

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 Mo
const MAX_SEARCH_RESULTS = 500;

const MAX_CHAT_MESSAGE_LENGTH = 30_000;
const MAX_CONTEXT_LENGTH = 50_000;

const MAX_SELECTED_FILES = 10;
const MAX_TOTAL_FILE_CONTEXT = 120_000;

const AI_MODEL =
  'nvidia/nemotron-3-ultra-550b-a55b:free';

/* =========================================================
   OWNER IDS
========================================================= */

function loadOwnerIds(): string[] {
  return (
    process.env.OWNER_IDS ??
    process.env.OWNER_ID ??
    ''
  )
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

/* =========================================================
   TYPES
========================================================= */

interface OmnixAuthenticatedUser {
  id?: string;
  discordId?: string;
  sub?: string;
  userId?: string;
}

interface AuthenticatedRequest
  extends Request {
  user?: OmnixAuthenticatedUser;
}

interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  duration: number;
  model: string;
}

/* =========================================================
   TOKEN ESTIMATION
========================================================= */

function estimateTokens(
  text: string
): number {
  if (!text) {
    return 0;
  }

  return Math.ceil(
    text.length / 4
  );
}

/* =========================================================
   SECRET PROTECTION
========================================================= */

function isForbiddenFile(
  filePath: string
): boolean {
  const basename =
    path.basename(filePath).toLowerCase();

  const forbiddenNames = [
    '.env',
    '.env.local',
    '.env.production',
    '.env.development',

    'credentials.json',
    'service-account.json',

    'id_rsa',
    'id_ed25519',

    'authorized_keys',
  ];

  if (
    forbiddenNames.includes(
      basename
    )
  ) {
    return true;
  }

  const extension =
    path.extname(
      basename
    );

  const forbiddenExtensions = [
    '.pem',
    '.key',
    '.p12',
    '.pfx',
  ];

  return forbiddenExtensions.includes(
    extension
  );
}

/* =========================================================
   SAFE PATH
========================================================= */

function resolveSafePath(
  requestedPath: string
): string {
  if (
    typeof requestedPath !==
      'string' ||
    !requestedPath.trim()
  ) {
    throw new Error(
      'Chemin de fichier manquant.'
    );
  }

  const normalized =
    requestedPath
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .trim();

  const absolutePath =
    path.resolve(
      PROJECT_ROOT,
      normalized
    );

  const relativePath =
    path.relative(
      PROJECT_ROOT,
      absolutePath
    );

  /*
   * Protection contre :
   *
   * ../../etc/passwd
   * /etc/passwd
   * chemins sortant du projet
   */
  if (
    relativePath === '..' ||
    relativePath.startsWith(
      `..${path.sep}`
    ) ||
    path.isAbsolute(
      relativePath
    )
  ) {
    throw new Error(
      'Accès au chemin interdit.'
    );
  }

  if (
    isForbiddenFile(
      absolutePath
    )
  ) {
    throw new Error(
      'Ce fichier est protégé.'
    );
  }

  return absolutePath;
}

/* =========================================================
   SANITIZE SECRETS
========================================================= */

function sanitizeContent(
  content: string
): string {
  const secretPatterns = [
    /sk-[A-Za-z0-9_-]+/g,

    /sk-or-v1-[A-Za-z0-9_-]+/g,

    /Bearer\s+[A-Za-z0-9._-]+/gi,

    /DISCORD_TOKEN\s*=\s*[^\n]+/gi,

    /DISCORD_BOT_TOKEN\s*=\s*[^\n]+/gi,

    /OPENROUTER_API_KEY\s*=\s*[^\n]+/gi,

    /OPENAI_API_KEY\s*=\s*[^\n]+/gi,

    /MONGODB_URI\s*=\s*[^\n]+/gi,

    /MONGO_URI\s*=\s*[^\n]+/gi,

    /JWT_SECRET\s*=\s*[^\n]+/gi,

    /STRIPE_SECRET_KEY\s*=\s*[^\n]+/gi,

    /CLIENT_SECRET\s*=\s*[^\n]+/gi,

    /DISCORD_CLIENT_SECRET\s*=\s*[^\n]+/gi,
  ];

  let result = content;

  for (
    const pattern of secretPatterns
  ) {
    result = result.replace(
      pattern,
      '[SECRET REDACTED]'
    );
  }

  return result;
}

/* =========================================================
   PROJECT SCANNER
========================================================= */

function scanDirectory(
  directory: string,
  results: string[] = []
): string[] {
  const ignoredDirectories = [
    'node_modules',
    '.git',
    '.cache',
    'dist',
    'build',
    '.next',
    'coverage',
    '.turbo',
  ];

  let entries: fs.Dirent[];

  try {
    entries =
      fs.readdirSync(
        directory,
        {
          withFileTypes: true,
        }
      );
  } catch {
    return results;
  }

  for (
    const entry of entries
  ) {
    if (
      ignoredDirectories.includes(
        entry.name
      )
    ) {
      continue;
    }

    const fullPath =
      path.join(
        directory,
        entry.name
      );

    if (
      isForbiddenFile(
        fullPath
      )
    ) {
      continue;
    }

    if (
      entry.isDirectory()
    ) {
      scanDirectory(
        fullPath,
        results
      );

      continue;
    }

    if (
      entry.isFile()
    ) {
      const relativePath =
        path.relative(
          PROJECT_ROOT,
          fullPath
        );

      results.push(
        relativePath.replace(
          /\\/g,
          '/'
        )
      );
    }
  }

  return results;
}

/* =========================================================
   AUTHENTICATION
========================================================= */

/**
 * Récupère l'utilisateur depuis la session OMNIX.
 *
 * Source unique :
 *
 * Authorization Bearer
 *        OU
 * cookie jwt_token
 *
 * Le parsing JWT reste centralisé dans auth.routes.ts.
 */
function authenticateRequest(
  req: AuthenticatedRequest
): boolean {
  const token =
    getRequestToken(req);

  if (!token) {
    return false;
  }

  const payload =
    verifyJwt(token);

  if (!payload) {
    return false;
  }

  req.user =
    payload as OmnixAuthenticatedUser;

  return true;
}

/* =========================================================
   USER ID
========================================================= */

function getAuthenticatedUserId(
  req: AuthenticatedRequest
): string | null {
  const user =
    req.user;

  if (!user) {
    return null;
  }

  const id =
    user.id ??
    user.discordId ??
    user.userId ??
    user.sub;

  if (!id) {
    return null;
  }

  return String(id);
}

/* =========================================================
   OWNER CHECK
========================================================= */

function isOwner(
  req: AuthenticatedRequest
): boolean {
  const ownerIds =
    loadOwnerIds();

  if (
    ownerIds.length === 0
  ) {
    return false;
  }

  const userId =
    getAuthenticatedUserId(
      req
    );

  if (!userId) {
    return false;
  }

  return ownerIds.includes(
    userId
  );
}

/* =========================================================
   OWNER MIDDLEWARE
========================================================= */

function ownerOnly(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  /*
   * Auth OMNIX obligatoire.
   */
  if (
    !authenticateRequest(req)
  ) {
    res.status(401).json({
      success: false,
      error:
        'Authentification requise.',
      code:
        'AUTH_REQUIRED',
    });

    return;
  }

  const ownerIds =
    loadOwnerIds();

  /*
   * Mauvaise configuration serveur.
   */
  if (
    ownerIds.length === 0
  ) {
    console.error(
      '[AI DEV] OWNER_IDS / OWNER_ID n\'est pas configuré.'
    );

    res.status(500).json({
      success: false,
      error:
        'La protection propriétaire n\'est pas configurée.',
      code:
        'OWNER_CONFIG_MISSING',
    });

    return;
  }

  /*
   * Utilisateur connecté mais pas propriétaire.
   */
  if (
    !isOwner(req)
  ) {
    res.status(403).json({
      success: false,
      error:
        'Accès refusé. Cette console est réservée au propriétaire d\'OMNIX.',
      code:
        'OWNER_ONLY',
    });

    return;
  }

  next();
}

/* =========================================================
   STATUS
========================================================= */

router.get(
  '/status',
  ownerOnly,
  async (
    _req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const files =
        scanDirectory(
          PROJECT_ROOT
        );

      return res.json({
        success: true,

        project: {
          root:
            PROJECT_ROOT,

          files:
            files.length,
        },

        ai: {
          provider:
            'OpenRouter',

          model:
            AI_MODEL,

          status:
            'online',
        },

        security: {
          ownerOnly:
            true,

          secretsProtected:
            true,

          pathProtection:
            true,
        },
      });
    } catch (error) {
      console.error(
        '[AI DEV] Status:',
        error
      );

      return res.status(500).json({
        success: false,
        error:
          'Impossible de récupérer le statut.',
      });
    }
  }
);

/* =========================================================
   FILES
========================================================= */

router.get(
  '/files',
  ownerOnly,
  async (
    _req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const files =
        scanDirectory(
          PROJECT_ROOT
        );

      files.sort(
        (a, b) =>
          a.localeCompare(
            b
          )
      );

      return res.json({
        success: true,

        count:
          files.length,

        files,
      });
    } catch (error) {
      console.error(
        '[AI DEV] Files:',
        error
      );

      return res.status(500).json({
        success: false,
        error:
          'Impossible de lire le projet.',
      });
    }
  }
);

/* =========================================================
   READ FILE
========================================================= */

router.get(
  '/file',
  ownerOnly,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const requestedPath =
        String(
          req.query.path ?? ''
        );

      const filePath =
        resolveSafePath(
          requestedPath
        );

      if (
        !fs.existsSync(
          filePath
        )
      ) {
        return res.status(404).json({
          success: false,
          error:
            'Fichier introuvable.',
          code:
            'FILE_NOT_FOUND',
        });
      }

      const stat =
        fs.statSync(
          filePath
        );

      if (
        !stat.isFile()
      ) {
        return res.status(400).json({
          success: false,
          error:
            'Ce chemin n\'est pas un fichier.',
          code:
            'NOT_A_FILE',
        });
      }

      if (
        stat.size >
        MAX_FILE_SIZE
      ) {
        return res.status(413).json({
          success: false,
          error:
            'Fichier trop volumineux. Limite : 2 Mo.',
          code:
            'FILE_TOO_LARGE',
        });
      }

      const rawContent =
        fs.readFileSync(
          filePath,
          'utf8'
        );

      const content =
        sanitizeContent(
          rawContent
        );

      return res.json({
        success: true,

        path:
          requestedPath,

        size:
          stat.size,

        estimatedTokens:
          estimateTokens(
            content
          ),

        content,
      });
    } catch (error) {
      console.error(
        '[AI DEV] Read file:',
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : 'Erreur lors de la lecture.';

      const status =
        message.includes(
          'interdit'
        ) ||
        message.includes(
          'protégé'
        )
          ? 403
          : 400;

      return res.status(
        status
      ).json({
        success: false,
        error: message,
      });
    }
  }
);

/* =========================================================
   SEARCH
========================================================= */

router.get(
  '/search',
  ownerOnly,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const query =
        String(
          req.query.q ?? ''
        ).trim();

      if (!query) {
        return res.status(400).json({
          success: false,
          error:
            'Texte de recherche manquant.',
        });
      }

      if (
        query.length > 200
      ) {
        return res.status(400).json({
          success: false,
          error:
            'Recherche trop longue.',
        });
      }

      const files =
        scanDirectory(
          PROJECT_ROOT
        );

      const results: {
        file: string;
        line: number;
        content: string;
      }[] = [];

      const lowerQuery =
        query.toLowerCase();

      for (
        const relativeFile of files
      ) {
        if (
          results.length >=
          MAX_SEARCH_RESULTS
        ) {
          break;
        }

        if (
          !/\.(ts|tsx|js|jsx|json|ejs|html|css|scss|md|txt|yml|yaml)$/i.test(
            relativeFile
          )
        ) {
          continue;
        }

        let absoluteFile: string;

        try {
          absoluteFile =
            resolveSafePath(
              relativeFile
            );
        } catch {
          continue;
        }

        let content: string;

        try {
          const stat =
            fs.statSync(
              absoluteFile
            );

          if (
            !stat.isFile() ||
            stat.size >
              MAX_FILE_SIZE
          ) {
            continue;
          }

          content =
            sanitizeContent(
              fs.readFileSync(
                absoluteFile,
                'utf8'
              )
            );
        } catch {
          continue;
        }

        const lines =
          content.split('\n');

        for (
          let i = 0;
          i < lines.length;
          i++
        ) {
          if (
            lines[i]
              .toLowerCase()
              .includes(
                lowerQuery
              )
          ) {
            results.push({
              file:
                relativeFile,

              line:
                i + 1,

              content:
                lines[i].trim(),
            });

            if (
              results.length >=
              MAX_SEARCH_RESULTS
            ) {
              break;
            }
          }
        }
      }

      return res.json({
        success: true,

        query,

        count:
          results.length,

        results,
      });
    } catch (error) {
      console.error(
        '[AI DEV] Search:',
        error
      );

      return res.status(500).json({
        success: false,
        error:
          'Erreur pendant la recherche.',
      });
    }
  }
);

/* =========================================================
   CHAT
========================================================= */

router.post(
  '/chat',
  ownerOnly,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const {
        message,
        context,
        files,
      } = req.body ?? {};

      /* -----------------------------------------------
         MESSAGE
      ------------------------------------------------ */

      if (
        typeof message !==
          'string' ||
        !message.trim()
      ) {
        return res.status(400).json({
          success: false,
          error:
            'Message manquant.',
        });
      }

      if (
        message.length >
        MAX_CHAT_MESSAGE_LENGTH
      ) {
        return res.status(413).json({
          success: false,
          error:
            'Message trop long.',
        });
      }

      /* -----------------------------------------------
         CONTEXT
      ------------------------------------------------ */

      let safeContext =
        typeof context ===
        'string'
          ? context
          : '';

      safeContext =
        sanitizeContent(
          safeContext
        );

      if (
        safeContext.length >
        MAX_CONTEXT_LENGTH
      ) {
        safeContext =
          safeContext.slice(
            0,
            MAX_CONTEXT_LENGTH
          ) +
          '\n\n[CONTEXTE TRONQUÉ]';
      }

      /* -----------------------------------------------
         FILE CONTEXT
      ------------------------------------------------ */

      let filesContext = '';

      let totalFileContext =
        0;

      const selectedFiles =
        Array.isArray(files)
          ? files
              .filter(
                (
                  file
                ): file is string =>
                  typeof file ===
                  'string'
              )
              .slice(
                0,
                MAX_SELECTED_FILES
              )
          : [];

      for (
        const requestedFile of selectedFiles
      ) {
        if (
          totalFileContext >=
          MAX_TOTAL_FILE_CONTEXT
        ) {
          break;
        }

        try {
          const filePath =
            resolveSafePath(
              requestedFile
            );

          if (
            !fs.existsSync(
              filePath
            )
          ) {
            continue;
          }

          const stat =
            fs.statSync(
              filePath
            );

          if (
            !stat.isFile() ||
            stat.size >
              MAX_FILE_SIZE
          ) {
            continue;
          }

          const raw =
            fs.readFileSync(
              filePath,
              'utf8'
            );

          let content =
            sanitizeContent(
              raw
            );

          const remaining =
            MAX_TOTAL_FILE_CONTEXT -
            totalFileContext;

          if (
            content.length >
            remaining
          ) {
            content =
              content.slice(
                0,
                remaining
              ) +
              '\n\n[CONTENU TRONQUÉ]';
          }

          filesContext +=
            `\n\n===== ${requestedFile} =====\n\n` +
            content;

          totalFileContext +=
            content.length;
        } catch {
          continue;
        }
      }

      /* -----------------------------------------------
         SYSTEM PROMPT
      ------------------------------------------------ */

      const systemPrompt = `
Tu es OMNIX AI DEV.

Tu es l'assistant privé de développement
de la plateforme OMNIX.

Tu aides le propriétaire à analyser,
corriger, tester, maintenir et améliorer
le projet OMNIX existant.

=============================
RÈGLES DE SÉCURITÉ
=============================

- Ne révèle jamais de secret.
- Ne révèle jamais de clé API.
- Ne révèle jamais de token Discord.
- Ne révèle jamais de mot de passe.
- Les secrets présents dans les fichiers
  sont masqués avant ton analyse.
- Ne prétends jamais avoir modifié un fichier
  si aucune modification réelle n'a été effectuée.
- Ne prétends jamais avoir exécuté un test
  si aucun test n'a réellement été exécuté.
- N'invente aucune API, route, fonction,
  fichier ou dépendance.
- Analyse le code réellement fourni.
- Préserve les fonctionnalités existantes.
- Ne propose pas une réécriture complète
  lorsque le problème peut être corrigé
  localement.

=============================
RÈGLES OMNIX
=============================

OMNIX est un projet existant.

Tu dois donc :

1. Comprendre l'architecture actuelle.
2. Identifier le fichier réellement concerné.
3. Identifier la cause du problème.
4. Proposer une correction compatible
   avec le code existant.
5. Préserver les systèmes déjà fonctionnels.
6. Signaler les dépendances entre fichiers.

Lorsqu'une modification est nécessaire,
présente :

1. Fichier concerné.
2. Problème.
3. Cause.
4. Correction.
5. Code.
6. Impact.
7. Tests à effectuer.

=============================
CONTEXTE
=============================

${
  safeContext ||
  'Aucun contexte supplémentaire.'
}

=============================
FICHIERS FOURNIS
=============================

${
  filesContext ||
  'Aucun fichier sélectionné.'
}
`;

      const prompt = `
${systemPrompt}

=============================
DEMANDE DU PROPRIÉTAIRE
=============================

${message.trim()}
`;

      /* -----------------------------------------------
         AI CALL
      ------------------------------------------------ */

      const startTime =
        Date.now();

      const promptTokens =
        estimateTokens(
          prompt
        );

      const answer =
        await askOpenRouter(
          prompt
        );

      const duration =
        Date.now() -
        startTime;

      const safeAnswer =
        typeof answer ===
        'string'
          ? sanitizeContent(
              answer
            )
          : String(answer);

      const completionTokens =
        estimateTokens(
          safeAnswer
        );

      const totalTokens =
        promptTokens +
        completionTokens;

      const usage: AIUsage = {
        promptTokens,

        completionTokens,

        totalTokens,

        estimatedCost:
          0,

        duration,

        model:
          AI_MODEL,
      };

      return res.json({
        success: true,

        answer:
          safeAnswer,

        usage,
      });
    } catch (error) {
      console.error(
        '[OMNIX AI DEV]',
        error
      );

      return res.status(500).json({
        success: false,

        error:
          error instanceof Error
            ? error.message
            : 'Erreur IA.',
      });
    }
  }
);

/* =========================================================
   ARCHITECTURE
========================================================= */

router.get(
  '/architecture',
  ownerOnly,
  async (
    _req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const files =
        scanDirectory(
          PROJECT_ROOT
        );

      const categories = {
        typescript:
          files.filter(
            (file) =>
              /\.(ts|tsx)$/i.test(
                file
              )
          ).length,

        javascript:
          files.filter(
            (file) =>
              /\.(js|jsx)$/i.test(
                file
              )
          ).length,

        views:
          files.filter(
            (file) =>
              /\.(ejs|html)$/i.test(
                file
              )
          ).length,

        styles:
          files.filter(
            (file) =>
              /\.(css|scss)$/i.test(
                file
              )
          ).length,

        json:
          files.filter(
            (file) =>
              /\.json$/i.test(
                file
              )
          ).length,
      };

      return res.json({
        success: true,

        projectRoot:
          PROJECT_ROOT,

        totalFiles:
          files.length,

        categories,

        files,
      });
    } catch (error) {
      console.error(
        '[AI DEV] Architecture:',
        error
      );

      return res.status(500).json({
        success: false,

        error:
          'Impossible d\'analyser l\'architecture.',
      });
    }
  }
);

/* =========================================================
   EXPORT
========================================================= */

export default router;