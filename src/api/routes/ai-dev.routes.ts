import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

import { askOpenRouter } from '../../ai/openrouter.ts';

/* =========================================================
   ROUTER
========================================================= */

const router = express.Router();

/* =========================================================
   CONFIGURATION
========================================================= */

const PROJECT_ROOT = process.cwd();

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 Mo
const MAX_SEARCH_RESULTS = 500;

const AI_MODEL =
  'nvidia/nemotron-3-ultra-550b-a55b:free';

/*
 * OWNER_IDS doit être configuré dans PteroEternodes :
 *
 * OWNER_IDS=TON_DISCORD_ID
 *
 * Plusieurs propriétaires :
 *
 * OWNER_IDS=ID1,ID2
 */

const OWNER_IDS = (
  process.env.OWNER_IDS ||
  process.env.OWNER_ID ||
  ''
)
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

/* =========================================================
   TYPES
========================================================= */

interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  duration: number;
  model: string;
}

/* =========================================================
   OUTILS
========================================================= */

/**
 * Estimation simple du nombre de tokens.
 *
 * Ce n'est pas le tokenizer exact du modèle.
 * Cela sert uniquement à afficher une estimation
 * dans le Dashboard.
 */
function estimateTokens(text: string): number {
  if (!text) {
    return 0;
  }

  return Math.ceil(text.length / 4);
}

/**
 * Vérifie si un fichier est protégé.
 */
function isForbiddenFile(filePath: string): boolean {
  const basename = path.basename(filePath);
  const lowerName = basename.toLowerCase();

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

  if (forbiddenNames.includes(lowerName)) {
    return true;
  }

  const extension = path.extname(lowerName);

  const forbiddenExtensions = [
    '.pem',
    '.key',
    '.p12',
    '.pfx',
  ];

  return forbiddenExtensions.includes(extension);
}

/**
 * Vérifie qu'un chemin reste dans le projet.
 */
function resolveSafePath(requestedPath: string): string {
  if (!requestedPath) {
    throw new Error('Chemin de fichier manquant.');
  }

  const normalized = requestedPath
    .replace(/\\/g, '/')
    .replace(/^\/+/g, '');

  const absolutePath = path.resolve(
    PROJECT_ROOT,
    normalized
  );

  const relativePath = path.relative(
    PROJECT_ROOT,
    absolutePath
  );

  /*
   * Empêche :
   *
   * ../../etc/passwd
   * /etc/passwd
   */
  if (
    relativePath.startsWith('..') ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error('Accès au chemin interdit.');
  }

  if (isForbiddenFile(absolutePath)) {
    throw new Error('Ce fichier est protégé.');
  }

  return absolutePath;
}

/**
 * Vérifie si le contenu ressemble à un secret.
 *
 * On ne transmet pas les secrets à l'IA.
 */
function sanitizeContent(content: string): string {
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
  ];

  let result = content;

  for (const pattern of secretPatterns) {
    result = result.replace(
      pattern,
      '[SECRET REDACTED]'
    );
  }

  return result;
}

/* =========================================================
   SCAN DU PROJET
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
    entries = fs.readdirSync(
      directory,
      {
        withFileTypes: true,
      }
    );
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (
      ignoredDirectories.includes(
        entry.name
      )
    ) {
      continue;
    }

    const fullPath = path.join(
      directory,
      entry.name
    );

    if (isForbiddenFile(fullPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      scanDirectory(
        fullPath,
        results
      );
    } else {
      const relativePath = path.relative(
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
   PROPRIÉTAIRE UNIQUEMENT
========================================================= */

function getAuthenticatedUserId(
  req: Request
): string | null {
  /*
   * Cette partie s'adapte à ton système
   * d'authentification existant.
   */

  const user = (req as any).user;

  if (user?.id) {
    return String(user.id);
  }

  if (user?.discordId) {
    return String(user.discordId);
  }

  /*
   * Compatibilité temporaire avec
   * un éventuel cookie Discord.
   */
  const cookieId =
    req.cookies?.discord_user_id;

  if (cookieId) {
    return String(cookieId);
  }

  return null;
}

function isOwner(
  req: Request
): boolean {
  const userId =
    getAuthenticatedUserId(req);

  if (!userId) {
    return false;
  }

  return OWNER_IDS.includes(userId);
}

function ownerOnly(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (OWNER_IDS.length === 0) {
    console.error(
      '[AI DEV] OWNER_IDS n\'est pas configuré.'
    );

    res.status(500).json({
      success: false,
      error:
        'La protection propriétaire n\'est pas configurée.',
    });

    return;
  }

  if (!isOwner(req)) {
    res.status(403).json({
      success: false,
      error:
        'Accès refusé. Cette console est réservée au propriétaire d\'OMNIX.',
    });

    return;
  }

  next();
}

/* =========================================================
   PAGE D'INFORMATIONS
========================================================= */

router.get(
  '/status',
  ownerOnly,
  async (_req: Request, res: Response) => {
    try {
      const files =
        scanDirectory(
          PROJECT_ROOT
        );

      return res.json({
        success: true,

        project: {
          root: PROJECT_ROOT,
          files: files.length,
        },

        ai: {
          provider: 'OpenRouter',
          model: AI_MODEL,
          status: 'online',
        },

        security: {
          ownerOnly: true,
          secretsProtected: true,
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
   LISTE DES FICHIERS
========================================================= */

router.get(
  '/files',
  ownerOnly,
  async (_req: Request, res: Response) => {
    try {
      const files =
        scanDirectory(
          PROJECT_ROOT
        );

      return res.json({
        success: true,
        count: files.length,
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
   LIRE UN FICHIER
========================================================= */

router.get(
  '/file',
  ownerOnly,
  async (req: Request, res: Response) => {
    try {
      const requestedPath =
        String(
          req.query.path || ''
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
        });
      }

      const stat =
        fs.statSync(
          filePath
        );

      if (!stat.isFile()) {
        return res.status(400).json({
          success: false,
          error:
            'Ce chemin n\'est pas un fichier.',
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

      return res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Erreur lors de la lecture.',
      });
    }
  }
);

/* =========================================================
   RECHERCHE DANS LE PROJET
========================================================= */

router.get(
  '/search',
  ownerOnly,
  async (req: Request, res: Response) => {
    try {
      const query =
        String(
          req.query.q || ''
        ).trim();

      if (!query) {
        return res.status(400).json({
          success: false,
          error:
            'Texte de recherche manquant.',
        });
      }

      if (query.length > 200) {
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

      for (
        const relativeFile of files
      ) {
        if (
          results.length >=
          MAX_SEARCH_RESULTS
        ) {
          break;
        }

        /*
         * On recherche surtout dans
         * les fichiers texte/code.
         */
        if (
          !/\.(ts|tsx|js|jsx|json|ejs|html|css|scss|md|txt|yml|yaml)$/i
            .test(relativeFile)
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
                query.toLowerCase()
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
   CHAT IA
========================================================= */

router.post(
  '/chat',
  ownerOnly,
  async (req: Request, res: Response) => {
    try {
      const {
        message,
        context,
        files,
      } = req.body;

      if (
        !message ||
        typeof message !== 'string'
      ) {
        return res.status(400).json({
          success: false,
          error:
            'Message manquant.',
        });
      }

      if (
        message.length >
        30000
      ) {
        return res.status(413).json({
          success: false,
          error:
            'Message trop long.',
        });
      }

      /*
       * Contexte fourni par le Dashboard.
       */
      let safeContext =
        typeof context === 'string'
          ? context
          : '';

      /*
       * On protège également le contexte
       * envoyé par le frontend.
       */
      safeContext =
        sanitizeContent(
          safeContext
        );

      /*
       * Si des fichiers sont sélectionnés,
       * on les lit côté serveur.
       */
      let filesContext = '';

      if (
        Array.isArray(files)
      ) {
        const selectedFiles =
          files.slice(
            0,
            10
          );

        for (
          const requestedFile
          of selectedFiles
        ) {
          if (
            typeof requestedFile !==
            'string'
          ) {
            continue;
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

            const content =
              sanitizeContent(
                raw
              );

            filesContext +=
              `\n\n===== ${requestedFile} =====\n\n` +
              content;
          } catch {
            continue;
          }
        }
      }

      const systemPrompt = `
Tu es OMNIX AI DEV.

Tu es l'assistant privé de développement
du propriétaire de la plateforme OMNIX.

Tu aides à développer, analyser,
corriger, tester et améliorer OMNIX.

=============================
RÈGLES DE SÉCURITÉ
=============================

- Tu ne dois jamais révéler de secrets.
- Tu ne dois jamais afficher une clé API.
- Tu ne dois jamais afficher un token Discord.
- Tu ne dois jamais afficher un mot de passe.
- Les secrets éventuellement présents
  dans les fichiers sont masqués.
- Tu ne dois jamais prétendre avoir modifié
  un fichier si aucune modification réelle
  n'a été effectuée.
- Tu dois signaler clairement ce que tu sais
  et ce que tu ne sais pas.
- Analyse toujours le code fourni avant
  de proposer une modification.

=============================
RÈGLES DE DÉVELOPPEMENT
=============================

Lorsque tu proposes une modification,
indique :

1. Le fichier concerné.
2. Le problème actuel.
3. La modification proposée.
4. Le code à modifier.
5. Les éventuelles conséquences.
6. Les tests à effectuer.

Ne détruis jamais une fonctionnalité existante
sans expliquer pourquoi.

=============================
CONTEXTE
=============================

${safeContext || 'Aucun contexte supplémentaire.'}

=============================
FICHIERS FOURNIS
=============================

${filesContext || 'Aucun fichier sélectionné.'}
`;

      const prompt = `
${systemPrompt}

=============================
DEMANDE DU PROPRIÉTAIRE
=============================

${message}
`;

      const startTime =
        Date.now();

      /*
       * Estimation avant appel.
       */
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

      /*
       * Estimation de sortie.
       */
      const completionTokens =
        estimateTokens(
          answer
        );

      const totalTokens =
        promptTokens +
        completionTokens;

      /*
       * Le modèle FREE est normalement
       * sans coût API, mais on garde le champ
       * pour le Dashboard.
       */
      const estimatedCost =
        0;

      const usage: AIUsage = {
        promptTokens,

        completionTokens,

        totalTokens,

        estimatedCost,

        duration,

        model:
          AI_MODEL,
      };

      return res.json({
        success: true,

        answer,

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
   ANALYSE DE L'ARCHITECTURE
========================================================= */

router.get(
  '/architecture',
  ownerOnly,
  async (_req: Request, res: Response) => {
    try {
      const files =
        scanDirectory(
          PROJECT_ROOT
        );

      const categories = {
        typescript:
          files.filter(
            (file) =>
              /\.(ts|tsx)$/.test(
                file
              )
          ).length,

        javascript:
          files.filter(
            (file) =>
              /\.(js|jsx)$/.test(
                file
              )
          ).length,

        views:
          files.filter(
            (file) =>
              /\.(ejs|html)$/.test(
                file
              )
          ).length,

        styles:
          files.filter(
            (file) =>
              /\.(css|scss)$/.test(
                file
              )
          ).length,

        json:
          files.filter(
            (file) =>
              /\.json$/.test(
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