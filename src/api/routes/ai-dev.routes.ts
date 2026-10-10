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

import { askMammouthWithMcp } from '../../ai/mammouth-mcp';
import * as projectFiles from '../../tools/filesystem';
import AiSession from '../../models/AiSession';
import AiLog from '../../models/AiLog';
import { recordPlatformEvent } from '../../services/platformEvents';
import { buildOmnixSystemPrompt } from '../../ai/prompts';
import type { OpenRouterMessage } from '../../ai/openrouter';
import { consumeAIMemoryAllowance } from '../../services/AiService';

/* =========================================================
   ROUTER
========================================================= */

const router = express.Router();

/* =========================================================
   CONFIGURATION
========================================================= */

const MAX_CHAT_MESSAGE_LENGTH = 30_000;
const MAX_CONTEXT_LENGTH = 50_000;

const AI_MODEL = process.env.MAMMOUTH_MODEL || 'gpt-4.1';

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
  body: any;
  params: Record<string, string | undefined>;
  query: Record<string, any>;

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
          filesHidden: false,
        },

        ai: {
          provider:
            'MammouthAI',

          model:
            AI_MODEL,

          status:
            process.env.MAMMOUTH_API_KEY ? 'ready' : 'missing_key',
          configured: Boolean(process.env.MAMMOUTH_API_KEY),
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
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const relativePath = String(req.query.path ?? '.');
      const depth = Math.max(0, Math.min(4, Number(req.query.depth ?? 2)));
      const files = await projectFiles.listFiles(relativePath, depth);
      return res.json({ success: true, count: files.length, files, hidden: false, root: 'OMNIX_ROOT' });
    } catch (error) {
      return res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Lecture de l’arborescence impossible.' });
    }
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
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const filePath = String(req.query.path ?? '').trim();
      if (!filePath) return res.status(400).json({ success: false, error: 'Le paramètre path est obligatoire.' });
      const content = await projectFiles.readFile(filePath, 500_000);
      return res.json({ success: true, path: filePath, content });
    } catch (error) {
      return res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Lecture du fichier impossible.' });
    }
  },
);

router.put('/file', ownerOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filePath = String(req.body?.path ?? '').trim();
    const content = req.body?.content;
    if (!filePath || typeof content !== 'string') return res.status(400).json({ success:false, error:'path et content sont obligatoires.' });
    await projectFiles.writeFile(filePath, content);
    return res.json({ success:true, path:filePath, bytes:Buffer.byteLength(content, 'utf8'), savedAt:new Date().toISOString() });
  } catch (error) {
    return res.status(400).json({ success:false, error:error instanceof Error ? error.message : 'Écriture du fichier impossible.' });
  }
});

/* =========================================================
   SEARCH
========================================================= */

router.get('/search', ownerOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Utilisateur non authentifié.' });
    const q = String(req.query.q ?? '').trim().slice(0, 120);
    if (!q) return res.json({ success: true, results: [] });
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matcher = new RegExp(escaped, 'i');
    const sessions = await AiSession.find({ userId, $or: [{ title: matcher }, { 'messages.content': matcher }] })
      .select('title totalTokens totalRequests createdAt updatedAt messages')
      .sort({ updatedAt: -1 }).limit(50).lean();
    const results = sessions.map((s: any) => {
      const hit = (s.messages || []).find((m: any) => matcher.test(String(m.content || '')));
      return { id: String(s._id), title: s.title || 'Nouvelle discussion', updatedAt: s.updatedAt,
        totalTokens: s.totalTokens || 0, totalRequests: s.totalRequests || 0,
        excerpt: String(hit?.content || s.title || '').slice(0, 240) };
    });
    return res.json({ success: true, query: q, results });
  } catch (error) {
    console.error('[AI DEV] Recherche conversations:', error);
    return res.status(500).json({ success: false, error: 'Recherche des conversations impossible.' });
  }
});

/* Statistiques et historique des requêtes de l’assistant propriétaire. */
router.get('/usage', ownerOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Utilisateur non authentifié.' });
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [all, day, week, latest] = await Promise.all([
      AiLog.aggregate([{ $match: { userId } }, { $group: { _id: null, requests: { $sum: 1 }, tokens: { $sum: '$totalTokens' }, promptTokens: { $sum: '$promptTokens' }, completionTokens: { $sum: '$completionTokens' } } }]),
      AiLog.aggregate([{ $match: { userId, createdAt: { $gte: since24h } } }, { $group: { _id: null, requests: { $sum: 1 }, tokens: { $sum: '$totalTokens' } } }]),
      AiLog.aggregate([{ $match: { userId, createdAt: { $gte: since7d } } }, { $group: { _id: null, requests: { $sum: 1 }, tokens: { $sum: '$totalTokens' } } }]),
      AiLog.find({ userId }).select('sessionId userMessage provider model promptTokens completionTokens totalTokens durationMs status error createdAt').sort({ createdAt: -1 }).limit(40).lean()
    ]);
    return res.json({ success: true, totals: { all: all[0] || { requests: 0, tokens: 0, promptTokens: 0, completionTokens: 0 }, last24h: day[0] || { requests: 0, tokens: 0 }, last7d: week[0] || { requests: 0, tokens: 0 } }, activity: latest.map((x: any) => ({ id: String(x._id), sessionId: x.sessionId, query: x.userMessage || '', provider: x.provider || 'mammouth', model: x.model || AI_MODEL, promptTokens: x.promptTokens || 0, completionTokens: x.completionTokens || 0, totalTokens: x.totalTokens || 0, durationMs: x.durationMs || 0, status: x.status || 'success', error: x.error || '', createdAt: x.createdAt })) });
  } catch (error) {
    console.error('[AI DEV] Usage:', error);
    return res.status(500).json({ success: false, error: 'Impossible de charger les statistiques IA.' });
  }
});

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

      const userForLimit = getAuthenticatedUserId(req);
      if (userForLimit && !(await consumeAIMemoryAllowance(userForLimit, 1))) return res.status(429).json({ success:false, error:'Limite IA atteinte : 150 messages par heure.' });
      const systemPrompt = buildOmnixSystemPrompt();

      const prompt = `${systemPrompt}\n\nQuestion utilisateur :\n${message.trim()}`;

      /* -----------------------------------------------
         AI CALL
      ------------------------------------------------ */

      const startTime =
        Date.now();

      const estimatedPromptTokens = estimateTokens(prompt);
      let promptTokens = estimatedPromptTokens;

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

      const mammouthResult = await askMammouthWithMcp(
        [...history, { role: 'user', content: message.trim() }],
        { systemPrompt, maxTokens: 1800 },
      );
      const answer = mammouthResult.answer;

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

      const completionTokens = mammouthResult.completionTokens || estimateTokens(safeAnswer);
      promptTokens = mammouthResult.promptTokens || promptTokens;
      const totalTokens = mammouthResult.totalTokens || (promptTokens + completionTokens);

      if (authenticatedUserId) {
        await AiLog.create({
          sessionId: session ? String(session._id) : `web:${authenticatedUserId}`,
          source: 'web', userId: authenticatedUserId,
          username: req.user?.discordId || authenticatedUserId,
          userMessage: message.trim(), assistantMessage: safeAnswer,
          provider: 'mammouth', model: mammouthResult.model, promptTokens: mammouthResult.promptTokens || promptTokens, completionTokens: mammouthResult.completionTokens || completionTokens, totalTokens: mammouthResult.totalTokens || totalTokens, durationMs: duration, status:'success'
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
      const providerAuth = /\[MammouthAI\] HTTP 401/i.test(rawMessage) || /user not found/i.test(rawMessage) || /invalid.*key/i.test(rawMessage);
      const missingKey = /MAMMOUTH_API_KEY est absente/i.test(rawMessage);
      const status = /\[MammouthAI\] HTTP 402/i.test(rawMessage) ? 402 : (providerAuth ? 502 : (missingKey ? 503 : 500));
      const friendly = status === 402
        ? 'Le service MammouthAI a refusé la requête (402). Vérifie les crédits API MammouthAI et MAMMOUTH_MODEL.'
        : providerAuth
          ? 'La clé API MammouthAI a été refusée (401). Vérifie MAMMOUTH_API_KEY dans les variables d’environnement puis redémarre le service.'
          : missingKey
            ? 'MAMMOUTH_API_KEY n’est pas configurée. Ajoute-la dans les variables d’environnement puis redémarre le service.'
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