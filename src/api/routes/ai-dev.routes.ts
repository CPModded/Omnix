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
import AiLog from '../../models/AiLog';
import { recordPlatformEvent } from '../../services/platformEvents';
import { buildOmnixSystemPrompt } from '../../ai/prompts';
import type { OpenRouterMessage } from '../../ai/openrouter';

/* =========================================================
   ROUTER
========================================================= */

const router = express.Router();

/* =========================================================
   CONFIGURATION
========================================================= */

const MAX_CHAT_MESSAGE_LENGTH = 30_000;
const MAX_CONTEXT_LENGTH = 50_000;

const AI_MODEL = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free';

function sanitizeContent(value: unknown): string {
  return String(value ?? '')
    .replace(/\u0000/g, '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .trim();
}


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

function optionalAuthentication(req: AuthenticatedRequest): boolean {
  return authenticateRequest(req);
}

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

function authenticatedOnly(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!authenticateRequest(req)) {
    res.status(401).json({ success:false, error:'Authentification requise.', code:'AUTH_REQUIRED' });
    return;
  }
  next();
}

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

router.get('/sessions', authenticatedOnly, async (req: AuthenticatedRequest, res: Response) => {
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

router.get('/sessions/:sessionId', authenticatedOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const session = await AiSession.findOne({ _id: req.params.sessionId, userId }).lean();
    if (!session) return res.status(404).json({ success:false, error:'Discussion introuvable.' });
    return res.json({ success:true, session });
  } catch {
    return res.status(400).json({ success:false, error:'Identifiant de discussion invalide.' });
  }
});

router.delete('/sessions/:sessionId', authenticatedOnly, async (req: AuthenticatedRequest, res: Response) => {
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
  (req: AuthenticatedRequest, _res: Response, next: NextFunction) => { optionalAuthentication(req); next(); },
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

      const systemPrompt = buildOmnixSystemPrompt();

      const prompt = `${systemPrompt}\n\nQuestion utilisateur :\n${message.trim()}`;

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
      const requestedSessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : '';
      let session: any = null;
      if (authenticatedUserId) {
        session = requestedSessionId
          ? await AiSession.findOne({ _id: requestedSessionId, userId: authenticatedUserId })
          : null;
        if (!session) {
          session = await AiSession.create({ userId: authenticatedUserId, title: message.trim().slice(0, 80), messages: [] });
        }
      }

      const history: OpenRouterMessage[] = session?.messages?.length
        ? session.messages
            .slice(-75)
            .map((item: any) => ({
              role: item.role as OpenRouterMessage['role'],
              content: String(item.content ?? ''),
            }))
            .filter((item: OpenRouterMessage) => typeof item.content === 'string' && item.content.trim().length > 0)
        : [];

      const answer =
        await askOpenRouter(
          [
            ...history,
            { role: 'user', content: message.trim() },
          ],
          {
            systemPrompt,
            temperature: 0.7,
            maxTokens: 1200,
          },
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

      if (authenticatedUserId) {
        await AiLog.create({
          sessionId: session ? String(session._id) : `web:${authenticatedUserId}`,
          source: 'web', userId: authenticatedUserId,
          username: req.user?.discordId || authenticatedUserId,
          userMessage: message.trim(), assistantMessage: safeAnswer,
          provider: 'openrouter', model: AI_MODEL, promptTokens, completionTokens, totalTokens, durationMs: duration, status:'success'
        });
        await recordPlatformEvent('ai_request', { userId: authenticatedUserId, metadata:{ source:'web', durationMs:duration } });
      }

      if (session && authenticatedUserId) {
      await AiSession.updateOne(
        { _id: session._id, userId: authenticatedUserId },
        {
          $push: {
            messages: {
              $each: [
                { role: 'user', content: message.trim(), createdAt: new Date() },
                { role: 'assistant', content: safeAnswer, createdAt: new Date() }
              ],
              $slice: -75
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
      }

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
        sessionId: session ? String(session._id) : null,
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