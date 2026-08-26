import express, {
  Request,
  Response
} from 'express';

import fs from 'fs';
import path from 'path';

import { askOpenRouter } from '../../ai/openrouter.ts';

const router = express.Router();

/*
====================================================
 CONFIGURATION
====================================================
*/

const PROJECT_ROOT = process.cwd();

const OWNER_IDS = (
  process.env.OWNER_IDS ||
  process.env.OWNER_ID ||
  ''
)
  .split(',')
  .map(id => id.trim())
  .filter(Boolean);


/*
====================================================
 SÉCURITÉ PROPRIÉTAIRE
====================================================
*/

function isOwner(req: Request): boolean {

  /*
   * Adapte cette partie à ton système d'authentification
   * si ton middleware ajoute déjà req.user.
   */

  const userId =
    (req as any).user?.id ||
    (req as any).user?.discordId ||
    req.cookies?.discord_user_id;

  if (!userId) {
    return false;
  }

  return OWNER_IDS.includes(userId);
}


/*
====================================================
 PROTECTION
====================================================
*/

function ownerOnly(
  req: Request,
  res: Response,
  next: express.NextFunction
) {

  if (!isOwner(req)) {
    return res.status(403).json({
      success: false,
      error: 'Accès réservé au propriétaire d’OMNIX.'
    });
  }

  next();
}


/*
====================================================
 FICHIERS INTERDITS
====================================================
*/

const FORBIDDEN_FILES = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',

  'id_rsa',
  'id_ed25519',

  'credentials.json',
  'service-account.json'
];

const FORBIDDEN_EXTENSIONS = [
  '.pem',
  '.key',
  '.crt',
  '.p12',
  '.pfx'
];


/*
====================================================
 VÉRIFICATION CHEMIN
====================================================
*/

function resolveSafePath(
  requestedPath: string
): string {

  const normalized =
    requestedPath
      .replace(/\\/g, '/')
      .replace(/^\/+/, '');

  const absolutePath =
    path.resolve(
      PROJECT_ROOT,
      normalized
    );

  const relative =
    path.relative(
      PROJECT_ROOT,
      absolutePath
    );

  if (
    relative.startsWith('..') ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      'Accès au chemin interdit.'
    );
  }

  const basename =
    path.basename(absolutePath);

  if (
    FORBIDDEN_FILES.includes(
      basename
    )
  ) {
    throw new Error(
      'Ce fichier est protégé.'
    );
  }

  const extension =
    path.extname(absolutePath)
      .toLowerCase();

  if (
    FORBIDDEN_EXTENSIONS.includes(
      extension
    )
  ) {
    throw new Error(
      'Ce type de fichier est protégé.'
    );
  }

  return absolutePath;
}


/*
====================================================
 LISTER LE PROJET
====================================================
*/

function scanDirectory(
  directory: string,
  results: string[] = []
): string[] {

  const ignored = [
    'node_modules',
    '.git',
    '.cache',
    'dist',
    'build',
    '.next'
  ];

  for (
    const entry of fs.readdirSync(
      directory,
      { withFileTypes: true }
    )
  ) {

    if (
      ignored.includes(entry.name)
    ) {
      continue;
    }

    const fullPath =
      path.join(
        directory,
        entry.name
      );

    const relativePath =
      path.relative(
        PROJECT_ROOT,
        fullPath
      );

    if (entry.isDirectory()) {

      scanDirectory(
        fullPath,
        results
      );

    } else {

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


/*
====================================================
 GET /api/ai-dev/files
====================================================
*/

router.get(
  '/files',
  ownerOnly,
  async (_req, res) => {

    try {

      const files =
        scanDirectory(
          PROJECT_ROOT
        );

      return res.json({
        success: true,
        count: files.length,
        files
      });

    } catch (error) {

      console.error(
        '[AI DEV] Files:',
        error
      );

      return res.status(500).json({
        success: false,
        error: 'Impossible de lire le projet.'
      });
    }
  }
);


/*
====================================================
 GET /api/ai-dev/file
====================================================
*/

router.get(
  '/file',
  ownerOnly,
  async (req, res) => {

    try {

      const requestedPath =
        String(
          req.query.path || ''
        );

      if (!requestedPath) {
        return res.status(400).json({
          success: false,
          error: 'Chemin manquant.'
        });
      }

      const filePath =
        resolveSafePath(
          requestedPath
        );

      if (
        !fs.existsSync(filePath)
      ) {
        return res.status(404).json({
          success: false,
          error: 'Fichier introuvable.'
        });
      }

      const stat =
        fs.statSync(filePath);

      if (!stat.isFile()) {
        return res.status(400).json({
          success: false,
          error: 'Ce chemin n’est pas un fichier.'
        });
      }

      /*
       * Protection contre les fichiers
       * extrêmement volumineux.
       */

      if (
        stat.size >
        2 * 1024 * 1024
      ) {
        return res.status(413).json({
          success: false,
          error: 'Fichier trop volumineux.'
        });
      }

      const content =
        fs.readFileSync(
          filePath,
          'utf8'
        );

      return res.json({
        success: true,
        path: requestedPath,
        size: stat.size,
        content
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
            : 'Erreur.'
      });
    }
  }
);


/*
====================================================
 POST /api/ai-dev/chat
====================================================
*/

router.post(
  '/chat',
  ownerOnly,
  async (req, res) => {

    try {

      const {
        message,
        context
      } = req.body;

      if (
        !message ||
        typeof message !== 'string'
      ) {
        return res.status(400).json({
          success: false,
          error: 'Message manquant.'
        });
      }

      /*
       * Limite de sécurité.
       */

      if (
        message.length >
        30000
      ) {
        return res.status(413).json({
          success: false,
          error: 'Message trop long.'
        });
      }

      const systemPrompt = `
Tu es OMNIX AI DEV.

Tu es l'assistant de développement privé
du propriétaire de la plateforme OMNIX.

Tu aides à développer, analyser,
corriger et améliorer OMNIX.

RÈGLES :

- Tu travailles uniquement sur le projet OMNIX.
- Tu ne dois jamais révéler de secrets.
- Tu ne dois jamais demander ou afficher les clés API.
- Tu ne dois jamais afficher les tokens Discord.
- Tu dois signaler lorsqu'une information manque.
- Tu dois analyser le code avant de proposer une modification.
- Lorsque tu proposes du code, indique toujours le fichier concerné.
- Ne prétends jamais avoir modifié un fichier si aucune modification
  n'a réellement été effectuée.
- Sois extrêmement précis techniquement.

CONTEXTE DU PROJET :

${context || 'Aucun contexte supplémentaire fourni.'}
`;

      const prompt = `
${systemPrompt}

========================================
DEMANDE DU PROPRIÉTAIRE
========================================

${message}
`;

      const startTime =
        Date.now();

      const answer =
        await askOpenRouter(
          prompt
        );

      const duration =
        Date.now() -
        startTime;

      return res.json({
        success: true,
        answer,
        duration
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
            : 'Erreur IA.'
      });
    }
  }
);


/*
====================================================
 POST /api/ai-dev/read-project
====================================================
*/

router.post(
  '/read-project',
  ownerOnly,
  async (_req, res) => {

    try {

      const files =
        scanDirectory(
          PROJECT_ROOT
        );

      const importantFiles =
        files.filter(file =>
          /\.(ts|tsx|js|json|ejs|css|html|md)$/
            .test(file)
        );

      return res.json({
        success: true,
        files: importantFiles
      });

    } catch (error) {

      return res.status(500).json({
        success: false,
        error: 'Analyse impossible.'
      });
    }
  }
);


/*
====================================================
 EXPORT
====================================================
*/

export default router;