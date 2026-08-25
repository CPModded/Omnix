import express from 'express';
import type {
  Request,
  Response,
  NextFunction,
} from 'express';

import {
  getRequestToken,
  verifyJwt,
} from './auth.routes';

import { askOpenRouter } from '../../ai/openrouter';
import AiSession from '../../models/AiSession';

/* =========================================================
   ROUTER
========================================================= */

const router = express.Router();

/* =========================================================
   CONFIGURATION
========================================================= */

const MAX_CHAT_MESSAGE_LENGTH = 30_000;
const MAX_CONTEXT_LENGTH = 50_000;

const AI_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

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
      return res.json({
        success: true,

        project: {
          filesHidden: true,
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
  async (_req: AuthenticatedRequest, res: Response) => {
    /*
     * Compatibilité de route uniquement.
     * OMNIX n'expose plus l'arborescence ni les fichiers du bot.
     */
    return res.json({
      success: true,
      count: 0,
      files: [],
      hidden: true,
      message: 'Les fichiers du projet sont masqués dans AI DEV.',
    });
  },
);

/* =========================================================
   SAVED CONVERSATIONS
========================================================= */

router.get('/sessions', ownerOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ success:false, error:'Utilisateur non authentifié.' });
    const sessions = await AiSession.find({ userId })
      .select('title totalTokens totalRequests createdAt updatedAt messages')
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();
    return res.json({
      success: true,
      sessions: sessions.map((x:any) => ({
        id: String(x._id),
        title: x.title || x.messages?.find((m:any)=>m.role==='user')?.content?.slice(0,60) || 'Nouvelle discussion',
        totalTokens: x.totalTokens || 0,
        totalRequests: x.totalRequests || 0,
        createdAt: x.createdAt,
        updatedAt: x.updatedAt,
        messageCount: Array.isArray(x.messages) ? x.messages.length : 0
      }))
    });
  } catch (error) {
    console.error('[AI DEV] Sessions:', error);
    return res.status(500).json({ success:false, error:'Impossible de charger les discussions.' });
  }
});

router.get('/sessions/:sessionId', ownerOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const session = await AiSession.findOne({ _id: req.params.sessionId, userId }).lean();
    if (!session) return res.status(404).json({ success:false, error:'Discussion introuvable.' });
    return res.json({ success:true, session });
  } catch {
    return res.status(400).json({ success:false, error:'Identifiant de discussion invalide.' });
  }
});

router.delete('/sessions/:sessionId', ownerOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const result = await AiSession.deleteOne({ _id: req.params.sessionId, userId });
    if (!result.deletedCount) return res.status(404).json({ success:false, error:'Discussion introuvable.' });
    return res.json({ success:true });
  } catch {
    return res.status(400).json({ success:false, error:'Impossible de supprimer la discussion.' });
  }
});

/* =========================================================
   READ FILE
========================================================= */

router.get(
  '/file',
  ownerOnly,
  async (_req: AuthenticatedRequest, res: Response) => {
    return res.status(410).json({
      success: false,
      code: 'PROJECT_FILES_HIDDEN',
      error: 'Les fichiers du projet ne sont plus accessibles depuis AI DEV.',
    });
  },
);

/* =========================================================
   SEARCH
========================================================= */

router.get(
  '/search',
  ownerOnly,
  async (_req: AuthenticatedRequest, res: Response) => {
    return res.status(410).json({
      success: false,
      code: 'PROJECT_FILES_HIDDEN',
      error: 'La recherche dans les fichiers du projet est désactivée.',
    });
  },
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

      /*
       * Les fichiers internes ne sont volontairement plus
       * lus ni transmis à l'IA depuis l'interface web.
       */
      const filesContext = '';

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

      const authenticatedUserId = getAuthenticatedUserId(req);
      if (!authenticatedUserId) {
        return res.status(401).json({ success:false, error:'Utilisateur non authentifié.', code:'AUTH_REQUIRED' });
      }

      const requestedSessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : '';
      let session: any = requestedSessionId
        ? await AiSession.findOne({ _id: requestedSessionId, userId: authenticatedUserId })
        : null;
      if (!session) {
        session = await AiSession.create({
          userId: authenticatedUserId,
          title: message.trim().slice(0, 80),
          messages: [],
        });
      }

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

      await AiSession.updateOne(
        { _id: session._id, userId: authenticatedUserId },
        {
          $push: {
            messages: {
              $each: [
                { role: 'user', content: message.trim(), createdAt: new Date() },
                { role: 'assistant', content: safeAnswer, createdAt: new Date() }
              ]
            }
          },
          $inc: {
            totalPromptTokens: promptTokens,
            totalCompletionTokens: completionTokens,
            totalTokens,
            totalRequests: 1
          },
          $set: { updatedAt: new Date() }
        }
      );

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
        sessionId: String(session._id),
      });
    } catch (error) {
      console.error(
        '[OMNIX AI DEV]',
        error
      );

      const rawMessage = error instanceof Error ? error.message : 'Erreur IA.';
      const providerAuth = /\[OpenRouter\]\s*401/i.test(rawMessage) || /user not found/i.test(rawMessage) || /invalid.*key/i.test(rawMessage);
      const status = /\[OpenRouter\]\s*402/i.test(rawMessage) ? 402 : (providerAuth ? 502 : 500);
      const friendly = status === 402
        ? 'Le service IA a refusé la requête (402). Vérifie le crédit/plan et OPENROUTER_MODEL.'
        : providerAuth
          ? 'Le fournisseur IA a refusé la clé API (401). Vérifie OPENROUTER_API_KEY côté serveur : elle ne doit jamais être affichée dans le navigateur.'
          : rawMessage;
      return res.status(status).json({
        success: false,
        code: status === 402 ? 'AI_PROVIDER_PAYMENT_REQUIRED' : (providerAuth ? 'AI_PROVIDER_AUTH_ERROR' : 'AI_ERROR'),
        error: friendly,
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
  async (_req: AuthenticatedRequest, res: Response) => {
    return res.json({
      success: true,
      hidden: true,
      message: 'L’architecture interne du projet est masquée dans AI DEV.',
    });
  },
);

/* =========================================================
   EXPORT
========================================================= */

export default router;