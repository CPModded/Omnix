"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_MAX_MESSAGE_LENGTH = exports.AI_MEMORY_WINDOW_MS = exports.AI_MEMORY_MESSAGES_PER_HOUR = exports.AI_MAX_MEMORY_MESSAGES = exports.AI_MAX_CONTEXT_WORDS = void 0;
exports.consumeAIMemoryAllowance = consumeAIMemoryAllowance;
exports.getAIMemoryUsage = getAIMemoryUsage;
exports.getWordCount = getWordCount;
exports.getMessagesWordCount = getMessagesWordCount;
exports.getWordCountFromInput = getWordCountFromInput;
exports.normalizeMessage = normalizeMessage;
exports.pruneMessagesToLimit = pruneMessagesToLimit;
exports.getAIMemory = getAIMemory;
exports.saveAIMemoryMessage = saveAIMemoryMessage;
exports.saveAIMemoryMessages = saveAIMemoryMessages;
exports.trimAIMemory = trimAIMemory;
exports.clearAIMemory = clearAIMemory;
exports.buildAIContext = buildAIContext;
const AiMemory_1 = __importDefault(require("../models/AiMemory"));
const AiRateLimit_1 = __importDefault(require("../models/AiRateLimit"));
const mongoLogger_1 = require("../utils/mongoLogger");
/* =========================================================
   LIMITS
========================================================= */
exports.AI_MAX_CONTEXT_WORDS = 6000;
exports.AI_MAX_MEMORY_MESSAGES = 150;
/** Nombre maximal de messages ajoutés à la mémoire IA par utilisateur et par heure. */
exports.AI_MEMORY_MESSAGES_PER_HOUR = 150;
exports.AI_MEMORY_WINDOW_MS = 60 * 60 * 1000;
/** Persistent, atomic allowance shared by bot workers and HTTP API. */
async function consumeAIMemoryAllowance(userId, messageCount = 1) {
    if (!userId || messageCount <= 0)
        return true;
    // 1 interaction utilisateur = 1 message consommé.
    const requested = Math.max(1, Math.floor(messageCount));
    if (requested > exports.AI_MEMORY_MESSAGES_PER_HOUR)
        return false;
    const key = `ai:${userId}`;
    const now = new Date();
    const cutoff = new Date(now.getTime() - exports.AI_MEMORY_WINDOW_MS);
    try {
        let row = await AiRateLimit_1.default.findOne({ key }).lean();
        // Première utilisation : création simple, sans pipeline MongoDB.
        if (!row) {
            try {
                await AiRateLimit_1.default.create({
                    key,
                    windowStartedAt: now,
                    count: requested,
                });
                return true;
            }
            catch (error) {
                // Une autre requête peut avoir créé la ligne entre-temps.
                if (error?.code !== 11000)
                    throw error;
                row = await AiRateLimit_1.default.findOne({ key }).lean();
            }
        }
        if (!row)
            return false;
        const startedAt = new Date(row.windowStartedAt).getTime();
        // Fenêtre expirée : remise à zéro avec un $set classique.
        if (!Number.isFinite(startedAt) || startedAt <= cutoff.getTime()) {
            const reset = await AiRateLimit_1.default.updateOne({
                key,
                windowStartedAt: row.windowStartedAt,
            }, {
                $set: {
                    windowStartedAt: now,
                    count: requested,
                },
            });
            if (reset.matchedCount > 0)
                return true;
            // Une autre requête a gagné la course : on retente avec son compteur.
            row = await AiRateLimit_1.default.findOne({ key }).lean();
            if (!row)
                return false;
        }
        const currentCount = Math.max(0, Number(row.count) || 0);
        if (currentCount + requested > exports.AI_MEMORY_MESSAGES_PER_HOUR)
            return false;
        // Incrément atomique : deux requêtes simultanées ne peuvent pas dépasser la limite.
        const updated = await AiRateLimit_1.default.updateOne({
            key,
            windowStartedAt: row.windowStartedAt,
            count: { $lte: exports.AI_MEMORY_MESSAGES_PER_HOUR - requested },
        }, { $inc: { count: requested } });
        return updated.modifiedCount > 0;
    }
    catch (error) {
        (0, mongoLogger_1.logMongoError)(error, { operation: 'ai-rate-limit', userId });
        return false;
    }
}
async function getAIMemoryUsage(userId) {
    const limit = exports.AI_MEMORY_MESSAGES_PER_HOUR;
    if (!userId)
        return { used: 0, limit, remaining: limit, resetAt: null };
    try {
        const row = await AiRateLimit_1.default.findOne({ key: `ai:${userId}` }).lean();
        if (!row || Date.now() - new Date(row.windowStartedAt).getTime() >= exports.AI_MEMORY_WINDOW_MS) {
            return { used: 0, limit, remaining: limit, resetAt: null };
        }
        const used = Math.min(limit, Math.max(0, Number(row.count) || 0));
        return { used, limit, remaining: Math.max(0, limit - used), resetAt: new Date(new Date(row.windowStartedAt).getTime() + exports.AI_MEMORY_WINDOW_MS) };
    }
    catch (error) {
        (0, mongoLogger_1.logMongoError)(error, { operation: 'ai-rate-limit-usage', userId });
        return { used: 0, limit, remaining: limit, resetAt: null };
    }
}
exports.AI_MAX_MESSAGE_LENGTH = 4000;
/* =========================================================
   WORD COUNT
========================================================= */
function getWordCount(text) {
    if (typeof text !== 'string' ||
        !text.trim()) {
        return 0;
    }
    return text
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .length;
}
function getMessagesWordCount(messages) {
    return messages.reduce((total, message) => total +
        getWordCount(message.content), 0);
}
/*
 * Ancienne API conservée pour éviter
 * de casser les commandes existantes.
 */
function getWordCountFromInput(input) {
    if (typeof input === 'string') {
        return getWordCount(input);
    }
    return getMessagesWordCount(input);
}
/* =========================================================
   NORMALIZATION
========================================================= */
function normalizeMessage(message) {
    if (!message) {
        return null;
    }
    if (message.role !== 'user' &&
        message.role !== 'assistant' &&
        message.role !== 'system') {
        return null;
    }
    const content = String(message.content ?? '').trim();
    if (!content) {
        return null;
    }
    return {
        role: message.role,
        content: content.substring(0, exports.AI_MAX_MESSAGE_LENGTH),
        timestamp: message.timestamp ??
            new Date(),
    };
}
/* =========================================================
   PRUNE
========================================================= */
function pruneMessagesToLimit(messages, maxWords = exports.AI_MAX_CONTEXT_WORDS) {
    if (!Array.isArray(messages) ||
        messages.length === 0) {
        return [];
    }
    const result = [];
    let wordCount = 0;
    /*
     * On part de la fin afin de garder
     * le contexte le plus récent.
     */
    for (let index = messages.length - 1; index >= 0; index--) {
        const message = normalizeMessage(messages[index]);
        if (!message) {
            continue;
        }
        const words = getWordCount(message.content);
        /*
         * Un message individuel trop gros
         * n'est pas envoyé.
         */
        if (words > maxWords) {
            continue;
        }
        if (wordCount + words >
            maxWords) {
            break;
        }
        result.unshift(message);
        wordCount += words;
    }
    return result;
}
/* =========================================================
   CONTEXT VALIDATION
========================================================= */
function isValidContext(context) {
    return Boolean(context &&
        context.guildId?.trim() &&
        context.channelId?.trim() &&
        context.userId?.trim());
}
/* =========================================================
   LOAD MEMORY
========================================================= */
async function getAIMemory(context) {
    if (!isValidContext(context)) {
        return [];
    }
    try {
        const memory = await AiMemory_1.default.findOne({
            guildId: context.guildId,
            channelId: context.channelId,
            userId: context.userId,
        }).lean();
        if (!memory) {
            return [];
        }
        const messages = Array.isArray(memory.messages)
            ? memory.messages.map((message) => ({
                role: message.role,
                content: message.content,
                timestamp: message.timestamp,
            }))
            : [];
        return pruneMessagesToLimit(messages, exports.AI_MAX_CONTEXT_WORDS);
    }
    catch (error) {
        console.error('[AI Service] Erreur récupération mémoire:', error);
        return [];
    }
}
/* =========================================================
   SAVE ONE MESSAGE
========================================================= */
async function saveAIMemoryMessage(context, message) {
    if (!isValidContext(context)) {
        throw new Error('Contexte IA invalide.');
    }
    const normalized = normalizeMessage(message);
    if (!normalized) {
        return;
    }
    await AiMemory_1.default.findOneAndUpdate({
        guildId: context.guildId,
        channelId: context.channelId,
        userId: context.userId,
    }, {
        $push: {
            messages: {
                role: normalized.role,
                content: normalized.content,
                timestamp: normalized.timestamp,
            },
        },
    }, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
    });
    await trimAIMemory(context);
}
/* =========================================================
   SAVE MULTIPLE MESSAGES
========================================================= */
async function saveAIMemoryMessages(context, messages) {
    if (!isValidContext(context)) {
        throw new Error('Contexte IA invalide.');
    }
    if (!Array.isArray(messages) ||
        messages.length === 0) {
        return;
    }
    const normalized = messages
        .map(normalizeMessage)
        .filter((message) => message !== null);
    if (!normalized.length) {
        return;
    }
    await AiMemory_1.default.findOneAndUpdate({
        guildId: context.guildId,
        channelId: context.channelId,
        userId: context.userId,
    }, {
        $push: {
            messages: {
                $each: normalized,
            },
        },
    }, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
    });
    await trimAIMemory(context);
}
/* =========================================================
   TRIM DATABASE MEMORY
========================================================= */
async function trimAIMemory(context) {
    if (!isValidContext(context)) {
        return;
    }
    try {
        const memory = await AiMemory_1.default.findOne({
            guildId: context.guildId,
            channelId: context.channelId,
            userId: context.userId,
        });
        if (!memory) {
            return;
        }
        if (memory.messages.length <=
            exports.AI_MAX_MEMORY_MESSAGES) {
            return;
        }
        memory.messages =
            memory.messages.slice(-exports.AI_MAX_MEMORY_MESSAGES);
        await memory.save();
    }
    catch (error) {
        console.error('[AI Service] Erreur nettoyage mémoire:', error);
    }
}
/* =========================================================
   CLEAR MEMORY
========================================================= */
async function clearAIMemory(context) {
    if (!isValidContext(context)) {
        return false;
    }
    try {
        const result = await AiMemory_1.default.deleteOne({
            guildId: context.guildId,
            channelId: context.channelId,
            userId: context.userId,
        });
        return (result.deletedCount > 0);
    }
    catch (error) {
        console.error('[AI Service] Erreur suppression mémoire:', error);
        return false;
    }
}
/* =========================================================
   BUILD CONTEXT
========================================================= */
async function buildAIContext(context, systemPrompt) {
    const memory = await getAIMemory(context);
    const messages = [];
    /*
     * Le system prompt reste toujours
     * en première position.
     */
    if (systemPrompt?.trim()) {
        messages.push({
            role: 'system',
            content: systemPrompt.trim(),
            timestamp: new Date(),
        });
    }
    messages.push(...memory);
    /*
     * Attention :
     * le system prompt compte également
     * dans la limite finale.
     */
    return pruneMessagesToLimit(messages, exports.AI_MAX_CONTEXT_WORDS);
}
/* =========================================================
   EXPORT
========================================================= */
exports.default = {
    getWordCount,
    getMessagesWordCount,
    getWordCountFromInput,
    normalizeMessage,
    pruneMessagesToLimit,
    getAIMemory,
    saveAIMemoryMessage,
    saveAIMemoryMessages,
    trimAIMemory,
    clearAIMemory,
    buildAIContext,
};
