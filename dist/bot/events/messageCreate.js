"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.once = exports.name = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const GuildConfig_1 = __importDefault(require("../../models/GuildConfig"));
const MemberProfile_1 = __importDefault(require("../../models/MemberProfile"));
const AiLog_1 = __importDefault(require("../../models/AiLog"));
const AiSession_1 = __importDefault(require("../../models/AiSession"));
const platformEvents_1 = require("../../services/platformEvents");
const openrouter_1 = require("../../ai/openrouter");
const prompts_1 = require("../../ai/prompts");
const securityEngine_1 = require("../utils/securityEngine");
const AiService_1 = require("../../services/AiService");
const AI_COOLDOWN_MS = 3000;
const AI_IMAGE_LIMIT_PER_HOUR = 2;
const AI_IMAGE_WINDOW_MS = 60 * 60 * 1000;
const cooldowns = new Map();
const imageUsage = new Map();
function isBotMessage(message) {
    return message.author.bot;
}
function getMessageContent(message) {
    return message.content.trim();
}
function shouldAnswer(message) {
    if (!message.guild || isBotMessage(message)) {
        return false;
    }
    const mentioned = message.mentions.has(message.client.user);
    const startsWithOmnix = /^omnix\b/i.test(message.content.trim());
    return mentioned || startsWithOmnix;
}
function cleanPrompt(message) {
    let content = getMessageContent(message);
    if (message.client.user) {
        content = content.replace(new RegExp(`<@!?${message.client.user.id}>`, 'g'), '');
    }
    content = content.replace(/^omnix\b[:,]?\s*/i, '');
    return content.trim();
}
function getImageAttachments(message) {
    return [...message.attachments.values()].filter((attachment) => {
        const contentType = attachment.contentType?.toLowerCase() ?? '';
        const url = attachment.url.toLowerCase().split('?')[0];
        const looksLikeImage = /\.(png|jpe?g|webp|gif)$/i.test(url);
        return contentType.startsWith('image/') || looksLikeImage;
    });
}
function consumeImageAllowance(userId, requested) {
    const now = Date.now();
    const current = (imageUsage.get(userId) ?? []).filter((timestamp) => now - timestamp < AI_IMAGE_WINDOW_MS);
    const available = Math.max(0, AI_IMAGE_LIMIT_PER_HOUR - current.length);
    const accepted = Math.min(requested, available);
    for (let i = 0; i < accepted; i++) {
        current.push(now);
    }
    if (current.length) {
        imageUsage.set(userId, current);
    }
    else {
        imageUsage.delete(userId);
    }
    return accepted;
}
function buildUserContent(prompt, imageUrls) {
    if (!imageUrls.length) {
        return prompt;
    }
    const parts = [];
    if (prompt) {
        parts.push({
            type: 'text',
            text: prompt,
        });
    }
    else {
        parts.push({
            type: 'text',
            text: 'Analyse cette ou ces images et réponds à ma demande.',
        });
    }
    for (const url of imageUrls) {
        parts.push({
            type: 'image_url',
            image_url: { url },
        });
    }
    return parts;
}
async function getGuildConfig(guildId) {
    try {
        return await GuildConfig_1.default.findOne({ guildId }).lean();
    }
    catch (error) {
        console.error('[AI] Erreur GuildConfig :', error);
        return null;
    }
}
async function execute(message) {
    if (!message.guild || isBotMessage(message))
        return;
    // Persistent leveling: MongoDB is the source of truth, not a volatile Map.
    try {
        const levelConfig = await GuildConfig_1.default.findOne({ guildId: message.guild.id }).select('modules.levels').lean();
        const levels = levelConfig?.modules?.levels;
        if (levels?.enabled) {
            const profile = await MemberProfile_1.default.findOneAndUpdate({ guildId: message.guild.id, userId: message.author.id }, { $setOnInsert: { guildId: message.guild.id, userId: message.author.id, xp: 0, level: 0, messages: 0 }, $inc: { messages: 1 } }, { new: true, upsert: true });
            const cooldown = Math.max(0, Number(levels.cooldown || 60000));
            if (!profile.lastXpAt || Date.now() - new Date(profile.lastXpAt).getTime() >= cooldown) {
                const gained = Math.max(1, Number(levels.xpPerMessage || 5));
                const oldLevel = Number(profile.level || 0);
                const xp = Number(profile.xp || 0) + gained;
                const next = Math.max(100, (oldLevel + 1) * (oldLevel + 1) * 100);
                const newLevel = xp >= next ? oldLevel + 1 : oldLevel;
                await MemberProfile_1.default.updateOne({ _id: profile._id }, { $set: { xp, level: newLevel, lastXpAt: new Date() } });
                if (newLevel > oldLevel && levels.levelUpChannelId) {
                    const ch = message.guild.channels.cache.get(levels.levelUpChannelId);
                    const text = String(levels.levelUpMessage || '🎉 {user} vient de passer niveau {level} !').replaceAll('{user}', `<@${message.author.id}>`).replaceAll('{level}', String(newLevel));
                    if (ch?.isTextBased?.())
                        await ch.send(text).catch(() => null);
                }
            }
        }
    }
    catch (error) {
        console.error('[Levels] Erreur XP:', error);
    }
    const blockedBySecurity = await (0, securityEngine_1.processSecurityMessage)(message);
    if (blockedBySecurity)
        return;
    const guildConfig = await getGuildConfig(message.guild.id);
    const custom = guildConfig?.modules?.customCommands;
    const prefix = String(guildConfig?.prefix || '/');
    const raw = message.content.trim();
    if (custom?.enabled && raw.startsWith(prefix)) {
        const parts = raw.slice(prefix.length).trim().split(/\s+/);
        const commandName = String(parts.shift() || '').toLowerCase();
        const customCommand = Array.isArray(custom.commands) ? custom.commands.find((c) => String(c?.name || '').toLowerCase() === commandName && c?.enabled !== false) : null;
        if (customCommand) {
            const response = String(customCommand.response || '')
                .replaceAll('{user}', `<@${message.author.id}>`)
                .replaceAll('{username}', message.author.username)
                .replaceAll('{server}', message.guild.name)
                .replaceAll('{memberCount}', String(message.guild.memberCount || 0));
            await message.reply(response.slice(0, 2000));
            return;
        }
    }
    if (!shouldAnswer(message)) {
        return;
    }
    const prompt = cleanPrompt(message);
    const imageAttachments = getImageAttachments(message);
    if (!prompt && !imageAttachments.length) {
        await message.reply('👋 Oui ? Pose-moi ta question.');
        return;
    }
    const key = `${message.guild?.id}:${message.author.id}`;
    const now = Date.now();
    const lastUse = cooldowns.get(key) ?? 0;
    if (now - lastUse < AI_COOLDOWN_MS) {
        return;
    }
    cooldowns.set(key, now);
    setTimeout(() => cooldowns.delete(key), AI_COOLDOWN_MS);
    let acceptedImages = 0;
    try {
        const config = guildConfig;
        const aiModule = config?.modules?.ai;
        if (aiModule && aiModule.enabled === false) {
            return;
        }
        const systemPrompt = (0, prompts_1.buildOmnixSystemPrompt)(aiModule?.systemPrompt);
        const imageUrls = [];
        if (imageAttachments.length) {
            acceptedImages = consumeImageAllowance(message.author.id, imageAttachments.length);
            imageAttachments.slice(0, acceptedImages).forEach((attachment) => {
                imageUrls.push(attachment.url);
            });
        }
        const refusedImages = imageAttachments.length - acceptedImages;
        // Chaque requête utilisateur consomme 1 unité de quota.
        // Limite : 150 messages utilisateur par heure.
        if (!(await (0, AiService_1.consumeAIMemoryAllowance)(message.author.id, 1))) {
            await message.reply('❌ Limite de mémoire IA atteinte : 150 messages par heure. Réessaie plus tard.');
            return;
        }
        await message.channel.sendTyping();
        const memory = message.guild
            ? await (0, AiService_1.getAIMemory)({
                guildId: message.guild.id,
                channelId: message.channel.id,
                userId: message.author.id,
            })
            : [];
        const userContent = buildUserContent(prompt, imageUrls);
        const conversation = [
            ...memory.map((item) => ({
                role: item.role === 'system' ? 'system' : item.role,
                content: item.content,
            })),
            {
                role: 'user',
                content: userContent,
            },
        ];
        const response = await (0, openrouter_1.askOpenRouter)(conversation, {
            systemPrompt,
            temperature: 0.7,
            maxTokens: aiModule?.maxTokens || 1200,
            // Le modèle OMNIX principal reste Nemotron 3 Ultra pour le texte.
            // Pour les photos, on utilise uniquement un routeur gratuit capable
            // d'accepter les images, car Nemotron 3 Ultra est text-only.
            model: imageUrls.length
                ? (process.env.OPENROUTER_VISION_MODEL || 'openrouter/free')
                : undefined,
        });
        const durationMs = Date.now() - now;
        const sessionId = `${message.guild?.id}:${message.author.id}`;
        await AiLog_1.default.create({
            sessionId,
            source: 'discord',
            userId: message.author.id,
            username: message.author.username,
            userTag: message.author.tag,
            guildId: message.guild?.id,
            guildName: message.guild?.name,
            ownerId: message.guild?.ownerId,
            messages: [
                { role: 'user', content: prompt || '[Image]' },
                { role: 'assistant', content: response },
            ],
            userMessage: prompt || '[Image]',
            assistantMessage: response,
            provider: 'openrouter',
            model: process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free',
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            durationMs,
            status: 'success',
        });
        if (message.guild) {
            const memoryMessages = [
                {
                    role: 'user',
                    content: prompt || '[Image envoyée à OMNIX]',
                },
                {
                    role: 'assistant',
                    content: response,
                },
            ];
            await (0, AiService_1.saveAIMemoryMessages)({
                guildId: message.guild.id,
                channelId: message.channel.id,
                userId: message.author.id,
            }, memoryMessages);
        }
        await AiSession_1.default.findOneAndUpdate({
            userId: message.author.id,
            guildId: message.guild?.id,
        }, {
            $inc: { totalRequests: 1 },
            $set: { title: prompt.slice(0, 200) || 'Analyse d’image' },
            $push: {
                messages: {
                    $each: [
                        {
                            role: 'user',
                            content: prompt || '[Image]',
                            createdAt: new Date(),
                        },
                        {
                            role: 'assistant',
                            content: response,
                            createdAt: new Date(),
                        },
                    ],
                    $slice: -75,
                },
            },
        }, { upsert: true, new: true, setDefaultsOnInsert: true });
        await (0, platformEvents_1.recordPlatformEvent)('ai_request', {
            userId: message.author.id,
            guildId: message.guild?.id,
            metadata: {
                source: 'discord',
                durationMs,
                images: acceptedImages,
            },
        });
        let finalResponse = response;
        if (refusedImages > 0) {
            finalResponse += `\n\n⚠️ ${refusedImages} image(s) non analysée(s) : limite de ${AI_IMAGE_LIMIT_PER_HOUR} photos par utilisateur et par heure.`;
        }
        if (finalResponse.length <= 2000) {
            await message.reply(finalResponse);
            return;
        }
        const chunks = [];
        for (let i = 0; i < finalResponse.length; i += 1900) {
            chunks.push(finalResponse.slice(i, i + 1900));
        }
        await message.reply(chunks.shift() ?? 'Réponse vide.');
        for (const chunk of chunks) {
            await message.channel.send(chunk);
        }
    }
    catch (error) {
        console.error('[AI] Erreur dans l’intercepteur de réponses de l’IA :', error);
        let errorMessage = '❌ Impossible de contacter le service IA actuellement.';
        const rawError = String(error?.message ?? '');
        if (rawError.includes('OPENROUTER_API_KEY')) {
            errorMessage = '❌ La clé API OpenRouter n’est pas configurée.';
        }
        else if (/\[OpenRouter\]\s*401/i.test(rawError)) {
            errorMessage =
                '❌ OpenRouter a refusé la clé API. Vérifie OPENROUTER_API_KEY côté serveur.';
        }
        else if (/\[OpenRouter\]\s*402/i.test(rawError)) {
            errorMessage =
                '💳 OpenRouter a refusé la requête (402). Vérifie le crédit/plan associé au compte.';
        }
        else if (/\[OpenRouter\]\s*429/i.test(rawError)) {
            errorMessage =
                '⏳ OpenRouter est temporairement limité. Réessaie dans quelques instants.';
        }
        else if (rawError.includes('aucun contenu exploitable')) {
            errorMessage =
                '⚠️ Le modèle OMNIX n’a pas renvoyé de contenu exploitable après plusieurs tentatives. Réessaie dans quelques instants.';
        }
        else if (rawError.includes('Délai d’attente dépassé')) {
            errorMessage =
                '⏱️ Le modèle OMNIX met trop de temps à répondre. Réessaie dans quelques instants.';
        }
        try {
            const sessionId = `${message.guild?.id}:${message.author.id}`;
            await AiLog_1.default.create({
                sessionId,
                source: 'discord',
                userId: message.author.id,
                username: message.author.username,
                userTag: message.author.tag,
                guildId: message.guild?.id,
                guildName: message.guild?.name,
                ownerId: message.guild?.ownerId,
                userMessage: prompt || '[Image]',
                assistantMessage: '',
                provider: 'openrouter',
                model: process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free',
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
                durationMs: Date.now() - now,
                status: 'error',
                error: rawError.slice(0, 10000),
            });
            await (0, platformEvents_1.recordPlatformEvent)('ai_error', {
                userId: message.author.id,
                guildId: message.guild?.id,
                metadata: {
                    source: 'discord',
                    error: rawError.slice(0, 500),
                },
            });
            await message.reply(errorMessage);
        }
        catch (replyError) {
            console.error('[AI] Impossible d’envoyer le message d’erreur :', replyError);
        }
    }
}
exports.name = discord_js_1.Events.MessageCreate;
exports.once = false;
exports.default = {
    name: exports.name,
    once: exports.once,
    execute,
};
