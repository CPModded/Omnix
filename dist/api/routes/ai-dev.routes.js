"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_routes_1 = require("./auth.routes");
const openrouter_1 = require("../../ai/openrouter");
const AiSession_1 = __importDefault(require("../../models/AiSession"));
const AiLog_1 = __importDefault(require("../../models/AiLog"));
const platformEvents_1 = require("../../services/platformEvents");
const prompts_1 = require("../../ai/prompts");
const AiService_1 = require("../../services/AiService");
/* =========================================================
   ROUTER
========================================================= */
const router = express_1.default.Router();
/* =========================================================
   CONFIGURATION
========================================================= */
const MAX_CHAT_MESSAGE_LENGTH = 30_000;
const MAX_CONTEXT_LENGTH = 50_000;
const AI_MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';
function sanitizeContent(value) {
    return String(value ?? '')
        .replace(/\u0000/g, '')
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
        .trim();
}
/* =========================================================
   OWNER IDS
========================================================= */
function loadOwnerIds() {
    return (process.env.OWNER_IDS ??
        process.env.OWNER_ID ??
        '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
}
/* =========================================================
   TOKEN ESTIMATION
========================================================= */
function estimateTokens(text) {
    if (!text) {
        return 0;
    }
    return Math.ceil(text.length / 4);
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
function authenticateRequest(req) {
    const token = (0, auth_routes_1.getRequestToken)(req);
    if (!token) {
        return false;
    }
    const payload = (0, auth_routes_1.verifyJwt)(token);
    if (!payload) {
        return false;
    }
    req.user =
        payload;
    return true;
}
/* =========================================================
   USER ID
========================================================= */
function optionalAuthentication(req) {
    return authenticateRequest(req);
}
function getAuthenticatedUserId(req) {
    const user = req.user;
    if (!user) {
        return null;
    }
    const id = user.id ??
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
function isOwner(req) {
    const ownerIds = loadOwnerIds();
    if (ownerIds.length === 0) {
        return false;
    }
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
        return false;
    }
    return ownerIds.includes(userId);
}
/* =========================================================
   OWNER MIDDLEWARE
========================================================= */
function authenticatedOnly(req, res, next) {
    if (!authenticateRequest(req)) {
        res.status(401).json({ success: false, error: 'Authentification requise.', code: 'AUTH_REQUIRED' });
        return;
    }
    next();
}
function ownerOnly(req, res, next) {
    /*
     * Auth OMNIX obligatoire.
     */
    if (!authenticateRequest(req)) {
        res.status(401).json({
            success: false,
            error: 'Authentification requise.',
            code: 'AUTH_REQUIRED',
        });
        return;
    }
    const ownerIds = loadOwnerIds();
    /*
     * Mauvaise configuration serveur.
     */
    if (ownerIds.length === 0) {
        console.error('[AI DEV] OWNER_IDS / OWNER_ID n\'est pas configuré.');
        res.status(500).json({
            success: false,
            error: 'La protection propriétaire n\'est pas configurée.',
            code: 'OWNER_CONFIG_MISSING',
        });
        return;
    }
    /*
     * Utilisateur connecté mais pas propriétaire.
     */
    if (!isOwner(req)) {
        res.status(403).json({
            success: false,
            error: 'Accès refusé. Cette console est réservée au propriétaire d\'OMNIX.',
            code: 'OWNER_ONLY',
        });
        return;
    }
    next();
}
/* =========================================================
   STATUS
========================================================= */
router.get('/status', ownerOnly, async (_req, res) => {
    try {
        return res.json({
            success: true,
            project: {
                filesHidden: true,
            },
            ai: {
                provider: 'OpenRouter',
                model: AI_MODEL,
                status: process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY ? 'ready' : 'missing_key',
                configured: Boolean(process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY),
            },
            security: {
                ownerOnly: true,
                secretsProtected: true,
                pathProtection: true,
            },
        });
    }
    catch (error) {
        console.error('[AI DEV] Status:', error);
        return res.status(500).json({
            success: false,
            error: 'Impossible de récupérer le statut.',
        });
    }
});
/* =========================================================
   FILES
========================================================= */
router.get('/files', ownerOnly, async (_req, res) => {
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
});
/* =========================================================
   SAVED CONVERSATIONS
========================================================= */
router.get('/sessions', ownerOnly, async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId)
            return res.status(401).json({ success: false, error: 'Utilisateur non authentifié.' });
        const sessions = await AiSession_1.default.find({ userId })
            .select('title totalTokens totalRequests createdAt updatedAt messages')
            .sort({ updatedAt: -1 })
            .limit(50)
            .lean();
        return res.json({
            success: true,
            sessions: sessions.map((x) => ({
                id: String(x._id),
                title: x.title || x.messages?.find((m) => m.role === 'user')?.content?.slice(0, 60) || 'Nouvelle discussion',
                totalTokens: x.totalTokens || 0,
                totalRequests: x.totalRequests || 0,
                createdAt: x.createdAt,
                updatedAt: x.updatedAt,
                messageCount: Array.isArray(x.messages) ? x.messages.length : 0
            }))
        });
    }
    catch (error) {
        console.error('[AI DEV] Sessions:', error);
        return res.status(500).json({ success: false, error: 'Impossible de charger les discussions.' });
    }
});
router.get('/sessions/:sessionId', ownerOnly, async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        const session = await AiSession_1.default.findOne({ _id: req.params.sessionId, userId }).lean();
        if (!session)
            return res.status(404).json({ success: false, error: 'Discussion introuvable.' });
        return res.json({ success: true, session });
    }
    catch {
        return res.status(400).json({ success: false, error: 'Identifiant de discussion invalide.' });
    }
});
router.delete('/sessions/:sessionId', ownerOnly, async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        const result = await AiSession_1.default.deleteOne({ _id: req.params.sessionId, userId });
        if (!result.deletedCount)
            return res.status(404).json({ success: false, error: 'Discussion introuvable.' });
        return res.json({ success: true });
    }
    catch {
        return res.status(400).json({ success: false, error: 'Impossible de supprimer la discussion.' });
    }
});
/* =========================================================
   READ FILE
========================================================= */
router.get('/file', ownerOnly, async (_req, res) => {
    return res.status(410).json({
        success: false,
        code: 'PROJECT_FILES_HIDDEN',
        error: 'Les fichiers du projet ne sont plus accessibles depuis AI DEV.',
    });
});
/* =========================================================
   SEARCH
========================================================= */
router.get('/search', ownerOnly, async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId)
            return res.status(401).json({ success: false, error: 'Utilisateur non authentifié.' });
        const q = String(req.query.q ?? '').trim().slice(0, 120);
        if (!q)
            return res.json({ success: true, results: [] });
        const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const matcher = new RegExp(escaped, 'i');
        const sessions = await AiSession_1.default.find({ userId, $or: [{ title: matcher }, { 'messages.content': matcher }] })
            .select('title totalTokens totalRequests createdAt updatedAt messages')
            .sort({ updatedAt: -1 }).limit(50).lean();
        const results = sessions.map((s) => {
            const hit = (s.messages || []).find((m) => matcher.test(String(m.content || '')));
            return { id: String(s._id), title: s.title || 'Nouvelle discussion', updatedAt: s.updatedAt,
                totalTokens: s.totalTokens || 0, totalRequests: s.totalRequests || 0,
                excerpt: String(hit?.content || s.title || '').slice(0, 240) };
        });
        return res.json({ success: true, query: q, results });
    }
    catch (error) {
        console.error('[AI DEV] Recherche conversations:', error);
        return res.status(500).json({ success: false, error: 'Recherche des conversations impossible.' });
    }
});
/* Statistiques et historique des requêtes de l’assistant propriétaire. */
router.get('/usage', ownerOnly, async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId)
            return res.status(401).json({ success: false, error: 'Utilisateur non authentifié.' });
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const [all, day, week, latest] = await Promise.all([
            AiLog_1.default.aggregate([{ $match: { userId } }, { $group: { _id: null, requests: { $sum: 1 }, tokens: { $sum: '$totalTokens' }, promptTokens: { $sum: '$promptTokens' }, completionTokens: { $sum: '$completionTokens' } } }]),
            AiLog_1.default.aggregate([{ $match: { userId, createdAt: { $gte: since24h } } }, { $group: { _id: null, requests: { $sum: 1 }, tokens: { $sum: '$totalTokens' } } }]),
            AiLog_1.default.aggregate([{ $match: { userId, createdAt: { $gte: since7d } } }, { $group: { _id: null, requests: { $sum: 1 }, tokens: { $sum: '$totalTokens' } } }]),
            AiLog_1.default.find({ userId }).select('sessionId userMessage provider model promptTokens completionTokens totalTokens durationMs status error createdAt').sort({ createdAt: -1 }).limit(40).lean()
        ]);
        return res.json({ success: true, totals: { all: all[0] || { requests: 0, tokens: 0, promptTokens: 0, completionTokens: 0 }, last24h: day[0] || { requests: 0, tokens: 0 }, last7d: week[0] || { requests: 0, tokens: 0 } }, activity: latest.map((x) => ({ id: String(x._id), sessionId: x.sessionId, query: x.userMessage || '', provider: x.provider || 'openrouter', model: x.model || AI_MODEL, promptTokens: x.promptTokens || 0, completionTokens: x.completionTokens || 0, totalTokens: x.totalTokens || 0, durationMs: x.durationMs || 0, status: x.status || 'success', error: x.error || '', createdAt: x.createdAt })) });
    }
    catch (error) {
        console.error('[AI DEV] Usage:', error);
        return res.status(500).json({ success: false, error: 'Impossible de charger les statistiques IA.' });
    }
});
/* =========================================================
   CHAT
========================================================= */
router.post('/chat', ownerOnly, async (req, res) => {
    try {
        const { message, context, files, } = req.body ?? {};
        /* -----------------------------------------------
           MESSAGE
        ------------------------------------------------ */
        if (typeof message !==
            'string' ||
            !message.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Message manquant.',
            });
        }
        if (message.length >
            MAX_CHAT_MESSAGE_LENGTH) {
            return res.status(413).json({
                success: false,
                error: 'Message trop long.',
            });
        }
        /* -----------------------------------------------
           CONTEXT
        ------------------------------------------------ */
        let safeContext = typeof context ===
            'string'
            ? context
            : '';
        safeContext =
            sanitizeContent(safeContext);
        if (safeContext.length >
            MAX_CONTEXT_LENGTH) {
            safeContext =
                safeContext.slice(0, MAX_CONTEXT_LENGTH) +
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
        if (userForLimit && !(await (0, AiService_1.consumeAIMemoryAllowance)(userForLimit, 1)))
            return res.status(429).json({ success: false, error: 'Limite IA atteinte : 150 messages par heure.' });
        const systemPrompt = (0, prompts_1.buildOmnixSystemPrompt)();
        const prompt = `${systemPrompt}\n\nQuestion utilisateur :\n${message.trim()}`;
        /* -----------------------------------------------
           AI CALL
        ------------------------------------------------ */
        const startTime = Date.now();
        const promptTokens = estimateTokens(prompt);
        const authenticatedUserId = getAuthenticatedUserId(req);
        const requestedSessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : '';
        let session = null;
        if (authenticatedUserId) {
            session = requestedSessionId
                ? await AiSession_1.default.findOne({ _id: requestedSessionId, userId: authenticatedUserId })
                : null;
            if (!session) {
                session = await AiSession_1.default.create({ userId: authenticatedUserId, title: message.trim().slice(0, 80), messages: [] });
            }
        }
        const history = session?.messages?.length
            ? session.messages
                .slice(-75)
                .map((item) => ({
                role: item.role,
                content: String(item.content ?? ''),
            }))
                .filter((item) => typeof item.content === 'string' && item.content.trim().length > 0)
            : [];
        const answer = await (0, openrouter_1.askOpenRouter)([
            ...history,
            { role: 'user', content: message.trim() },
        ], {
            systemPrompt,
            temperature: 0.7,
            maxTokens: 1200,
        });
        const duration = Date.now() -
            startTime;
        const safeAnswer = typeof answer ===
            'string'
            ? sanitizeContent(answer)
            : String(answer);
        const completionTokens = estimateTokens(safeAnswer);
        const totalTokens = promptTokens +
            completionTokens;
        if (authenticatedUserId) {
            await AiLog_1.default.create({
                sessionId: session ? String(session._id) : `web:${authenticatedUserId}`,
                source: 'web', userId: authenticatedUserId,
                username: req.user?.discordId || authenticatedUserId,
                userMessage: message.trim(), assistantMessage: safeAnswer,
                provider: 'openrouter', model: AI_MODEL, promptTokens, completionTokens, totalTokens, durationMs: duration, status: 'success'
            });
            await (0, platformEvents_1.recordPlatformEvent)('ai_request', { userId: authenticatedUserId, metadata: { source: 'web', durationMs: duration } });
        }
        if (session && authenticatedUserId) {
            await AiSession_1.default.updateOne({ _id: session._id, userId: authenticatedUserId }, {
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
            });
        }
        const usage = {
            promptTokens,
            completionTokens,
            totalTokens,
            estimatedCost: 0,
            duration,
            model: AI_MODEL,
        };
        return res.json({
            success: true,
            answer: safeAnswer,
            usage,
            sessionId: session ? String(session._id) : null,
        });
    }
    catch (error) {
        console.error('[OMNIX AI DEV]', error);
        const rawMessage = error instanceof Error ? error.message : 'Erreur IA.';
        const providerAuth = /\[OpenRouter\]\s*401/i.test(rawMessage) || /user not found/i.test(rawMessage) || /invalid.*key/i.test(rawMessage);
        const missingKey = /OPENROUTER_API_KEY.*introuvable/i.test(rawMessage);
        const status = /\[OpenRouter\]\s*402/i.test(rawMessage) ? 402 : (providerAuth ? 502 : (missingKey ? 503 : 500));
        const friendly = status === 402
            ? 'Le service IA a refusé la requête (402). Vérifie le crédit/plan OpenRouter et OPENROUTER_MODEL.'
            : providerAuth
                ? 'La clé OpenRouter configurée sur le serveur a été refusée (401). Remplace OPENROUTER_API_KEY dans les variables d’environnement Render par une clé OpenRouter valide, puis redémarre le service.'
                : missingKey
                    ? 'OPENROUTER_API_KEY n’est pas configurée sur le serveur Render. Ajoute-la dans les variables d’environnement puis redémarre le service.'
                    : rawMessage;
        return res.status(status).json({
            success: false,
            code: status === 402 ? 'AI_PROVIDER_PAYMENT_REQUIRED' : (providerAuth ? 'AI_PROVIDER_AUTH_ERROR' : 'AI_ERROR'),
            error: friendly,
        });
    }
});
/* =========================================================
   ARCHITECTURE
========================================================= */
router.get('/architecture', ownerOnly, async (_req, res) => {
    return res.json({
        success: true,
        hidden: true,
        message: 'L’architecture interne du projet est masquée dans AI DEV.',
    });
});
/* =========================================================
   EXPORT
========================================================= */
exports.default = router;
