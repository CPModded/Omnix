"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuildConfig = exports.defaultModules = void 0;
const mongoose_1 = __importStar(require("mongoose"));
/* =========================================================
   DEFAULT MODULE CONFIGURATION
========================================================= */
exports.defaultModules = {
    shop: { enabled: false, items: [], currencyName: 'coins' },
    moderation: {
        enabled: true,
        logChannelId: null,
        muteRoleId: null,
        defaultReason: 'Aucune raison fournie',
        autoModeration: false,
        deleteCommandMessages: false,
    },
    tickets: {
        enabled: false,
        categoryId: null,
        panelChannelId: null,
        panelMessageId: null,
        supportRoleId: null,
        transcriptChannelId: null,
        logChannelId: null,
        maxOpenPerUser: 1,
    },
    giveaways: {
        enabled: false,
        logChannelId: null,
        defaultDuration: 86400000,
    },
    suggestions: {
        enabled: false,
        channelId: null,
        staffChannelId: null,
        allowAnonymous: false,
    },
    logs: {
        enabled: false,
        joins: true,
        leaves: true,
        moderation: true,
        tickets: true,
        premium: true,
        payments: true,
        security: true,
        errors: true,
        bot: true,
        voice: true,
        roles: true,
        channelIds: {
            joins: null,
            leaves: null,
            moderation: null,
            tickets: null,
            premium: null,
            payments: null,
            security: null,
            errors: null,
            bot: null,
            voice: null,
            roles: null,
        },
    },
    welcome: {
        enabled: false,
        channelId: null,
        message: 'Bienvenue {user} sur {server} !',
        embed: true,
    },
    goodbye: {
        enabled: false,
        channelId: null,
        message: '{user} a quitté le serveur.',
        embed: true,
    },
    autoRole: {
        enabled: false,
        roleId: null,
        botRoleId: null,
        humanOnly: false,
    },
    security: {
        level: 'normal',
        lockdown: false,
        antiNuke: { enabled: false, threshold: 5, windowMs: 10000, action: 'alert' },
    },
    reactionRoles: {
        enabled: false,
        entries: [],
    },
    antiRaid: {
        enabled: false,
        threshold: 10,
        timeWindow: 10000,
        action: 'kick',
    },
    antiSpam: {
        enabled: false,
        maxMessages: 5,
        timeWindow: 5000,
        muteDuration: 60000,
    },
    antiLink: {
        enabled: false,
        whitelist: [],
        action: 'delete',
    },
    autoMod: {
        enabled: false,
        badWords: [],
        maxMentions: 5,
        maxCapsPercentage: 80,
        deleteMessages: true,
        antiInvites: true,
        antiMedia: false,
        antiGif: false,
        antiRepeat: false,
        antiFiles: false,
    },
    levels: {
        enabled: false,
        xpPerMessage: 5,
        cooldown: 60000,
        levelUpChannelId: null,
        levelUpMessage: '🎉 {user} vient de passer niveau {level} !',
    },
    economy: {
        enabled: false,
        currencyName: 'Coins',
        currencySymbol: '🪙',
        startingBalance: 100,
        dailyReward: 200,
        weeklyReward: 1000,
        workMin: 50,
        workMax: 250,
        messageReward: 5,
        messageCooldown: 60000,
    },
    ai: {
        enabled: false,
        channelId: null,
        model: 'openrouter',
        systemPrompt: 'Tu es l’assistant IA du serveur Discord.',
        maxTokens: 2000,
        maxHistoryMessages: 20,
    },
    counting: {
        enabled: false,
        channelId: null,
        currentCount: 0,
        lastUserId: null,
    },
    autoReactions: {
        enabled: false,
        reactions: [],
    },
    scheduledMessages: {
        enabled: false,
        messages: [],
    },
    polls: {
        enabled: false,
        channelId: null,
    },
    verification: {
        enabled: false,
        channelId: null,
        verifiedRoleId: null,
        logChannelId: null,
    },
    backups: {
        enabled: false,
        automatic: false,
        interval: 86400000,
        retention: 10,
    },
    customCommands: {
        enabled: false,
        commands: [],
    },
    honeypot: {
        enabled: false,
        channelId: null,
    },
    statistics: {
        enabled: false,
        channelId: null,
        updateInterval: 300000,
    },
    ping: {
        enabled: true,
        channelId: null,
    },
};
/* =========================================================
   TICKETS SUB-SCHEMA
========================================================= */
const TicketsSchema = new mongoose_1.Schema({
    enabled: {
        type: Boolean,
        default: false,
    },
    categoryId: {
        type: String,
        default: null,
    },
    panelChannelId: {
        type: String,
        default: null,
    },
    panelMessageId: {
        type: String,
        default: null,
    },
    supportRoleId: {
        type: String,
        default: null,
    },
    transcriptChannelId: {
        type: String,
        default: null,
    },
    logChannelId: {
        type: String,
        default: null,
    },
    maxOpenPerUser: {
        type: Number,
        default: 1,
        min: 1,
    },
    counter: {
        type: Number,
        default: 0,
        min: 0,
    },
    categoriesList: { type: mongoose_1.Schema.Types.Mixed, default: [] },
    moderatorRoles: { type: mongoose_1.Schema.Types.Mixed, default: [] },
    uiMode: { type: String, enum: ['buttons', 'select'], default: 'buttons' },
    panelText: { type: String, default: 'Choisissez le type de demande qui correspond à votre besoin.' },
    openingText: { type: String, default: 'Votre ticket est en cours de création.' },
    entryText: { type: String, default: 'Bonjour {user}, un membre de l’équipe va prendre en charge votre demande.' },
}, {
    _id: false,
});
const SecuritySchema = new mongoose_1.Schema({
    level: { type: String, enum: ['low', 'normal', 'high', 'maximum'], default: 'normal' },
    lockdown: { type: Boolean, default: false },
    antiNuke: {
        enabled: { type: Boolean, default: false },
        threshold: { type: Number, default: 5, min: 1 },
        windowMs: { type: Number, default: 10000, min: 1000 },
        action: { type: String, enum: ['alert', 'lockdown'], default: 'alert' },
    },
}, { _id: false });
const ReactionRolesSchema = new mongoose_1.Schema({
    enabled: { type: Boolean, default: false },
    entries: {
        type: [{ messageId: String, channelId: String, roleId: String, emoji: String, mode: { type: String, enum: ['toggle', 'exclusive'], default: 'toggle' } }],
        default: [],
    },
}, { _id: false });
/* =========================================================
   MAIN SCHEMA
========================================================= */
const GuildConfigSchema = new mongoose_1.Schema({
    /* ---------------------------------------------------
       GUILD
    --------------------------------------------------- */
    guildId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    name: {
        type: String,
        default: null,
    },
    icon: {
        type: String,
        default: null,
    },
    /* ---------------------------------------------------
       PLAN
    --------------------------------------------------- */
    plan: {
        type: String,
        enum: [
            'free',
            'premium',
            'lifetime',
            'enterprise',
        ],
        default: 'free',
        index: true,
    },
    premium: {
        isPremium: {
            type: Boolean,
            default: false,
        },
        tier: {
            type: String,
            enum: [
                'free',
                'premium',
                'lifetime',
                'enterprise',
            ],
            default: 'free',
        },
        expiresAt: {
            type: Date,
            default: null,
        },
    },
    premiumExpiresAt: {
        type: Date,
        default: null,
    },
    blacklisted: { type: Boolean, default: false, index: true },
    blacklistReason: { type: String, default: null },
    blacklistedAt: { type: Date, default: null },
    ownerId: {
        type: String,
        default: null,
    },
    /* ===================================================
       MODULES
    =================================================== */
    modules: {
        /* -------------------------------------------------
           MODERATION
        ------------------------------------------------- */
        moderation: {
            enabled: {
                type: Boolean,
                default: true,
            },
            logChannelId: {
                type: String,
                default: null,
            },
            muteRoleId: {
                type: String,
                default: null,
            },
            defaultReason: {
                type: String,
                default: 'Aucune raison fournie',
            },
            autoModeration: {
                type: Boolean,
                default: false,
            },
            deleteCommandMessages: {
                type: Boolean,
                default: false,
            },
        },
        /* -------------------------------------------------
           TICKETS
        ------------------------------------------------- */
        tickets: {
            type: TicketsSchema,
            default: () => ({}),
        },
        /* -------------------------------------------------
           GIVEAWAYS
        ------------------------------------------------- */
        giveaways: {
            enabled: {
                type: Boolean,
                default: false,
            },
            logChannelId: {
                type: String,
                default: null,
            },
            defaultDuration: {
                type: Number,
                default: 86400000,
            },
        },
        /* -------------------------------------------------
           SUGGESTIONS
        ------------------------------------------------- */
        suggestions: {
            enabled: {
                type: Boolean,
                default: false,
            },
            channelId: {
                type: String,
                default: null,
            },
            staffChannelId: {
                type: String,
                default: null,
            },
            allowAnonymous: {
                type: Boolean,
                default: false,
            },
        },
        /* -------------------------------------------------
           LOGS
        ------------------------------------------------- */
        logs: {
            enabled: {
                type: Boolean,
                default: false,
            },
            joins: {
                type: Boolean,
                default: true,
            },
            leaves: {
                type: Boolean,
                default: true,
            },
            moderation: {
                type: Boolean,
                default: true,
            },
            tickets: {
                type: Boolean,
                default: true,
            },
            premium: {
                type: Boolean,
                default: true,
            },
            payments: {
                type: Boolean,
                default: true,
            },
            security: {
                type: Boolean,
                default: true,
            },
            errors: {
                type: Boolean,
                default: true,
            },
            bot: {
                type: Boolean,
                default: true,
            },
            voice: {
                type: Boolean,
                default: true,
            },
            roles: {
                type: Boolean,
                default: true,
            },
            channelIds: {
                joins: {
                    type: String,
                    default: null,
                },
                leaves: {
                    type: String,
                    default: null,
                },
                moderation: {
                    type: String,
                    default: null,
                },
                tickets: {
                    type: String,
                    default: null,
                },
                premium: {
                    type: String,
                    default: null,
                },
                payments: {
                    type: String,
                    default: null,
                },
                security: {
                    type: String,
                    default: null,
                },
                errors: {
                    type: String,
                    default: null,
                },
                bot: {
                    type: String,
                    default: null,
                },
                voice: {
                    type: String,
                    default: null,
                },
                roles: {
                    type: String,
                    default: null,
                },
            },
        },
        /* -------------------------------------------------
           WELCOME
        ------------------------------------------------- */
        welcome: {
            enabled: {
                type: Boolean,
                default: false,
            },
            channelId: {
                type: String,
                default: null,
            },
            message: {
                type: String,
                default: 'Bienvenue {user} sur {server} !',
            },
            embed: { type: Boolean, default: true },
            title: { type: String, default: 'Bienvenue sur {server} !' },
            color: { type: String, default: '#7c5cff' },
            thumbnail: { type: Boolean, default: true },
            imageUrl: { type: String, default: null },
            footer: { type: String, default: '' },
            mentionUser: { type: Boolean, default: true },
        },
        /* -------------------------------------------------
           GOODBYE
        ------------------------------------------------- */
        goodbye: {
            enabled: {
                type: Boolean,
                default: false,
            },
            channelId: {
                type: String,
                default: null,
            },
            message: {
                type: String,
                default: '{user} a quitté le serveur.',
            },
            embed: { type: Boolean, default: true },
            title: { type: String, default: 'À bientôt !' },
            color: { type: String, default: '#7c5cff' },
            thumbnail: { type: Boolean, default: true },
            imageUrl: { type: String, default: null },
            footer: { type: String, default: '' },
            mentionUser: { type: Boolean, default: true },
        },
        /* -------------------------------------------------
           AUTO ROLE
        ------------------------------------------------- */
        autoRole: {
            enabled: {
                type: Boolean,
                default: false,
            },
            roleId: {
                type: String,
                default: null,
            },
        },
        /* -------------------------------------------------
           ANTI RAID
        ------------------------------------------------- */
        antiRaid: {
            enabled: {
                type: Boolean,
                default: false,
            },
            threshold: {
                type: Number,
                default: 10,
            },
            timeWindow: {
                type: Number,
                default: 10000,
            },
            action: {
                type: String,
                default: 'kick',
            },
        },
        /* -------------------------------------------------
           ANTI SPAM
        ------------------------------------------------- */
        antiSpam: {
            enabled: {
                type: Boolean,
                default: false,
            },
            maxMessages: {
                type: Number,
                default: 5,
            },
            timeWindow: {
                type: Number,
                default: 5000,
            },
            muteDuration: {
                type: Number,
                default: 60000,
            },
        },
        /* -------------------------------------------------
           ANTI LINK
        ------------------------------------------------- */
        antiLink: {
            enabled: {
                type: Boolean,
                default: false,
            },
            whitelist: {
                type: [String],
                default: [],
            },
            action: {
                type: String,
                default: 'delete',
            },
        },
        /* -------------------------------------------------
           AUTOMOD
        ------------------------------------------------- */
        autoMod: {
            enabled: {
                type: Boolean,
                default: false,
            },
            badWords: {
                type: [String],
                default: [],
            },
            maxMentions: {
                type: Number,
                default: 5,
            },
            maxCapsPercentage: {
                type: Number,
                default: 80,
            },
            deleteMessages: {
                type: Boolean,
                default: true,
            },
            antiInvites: { type: Boolean, default: true },
            antiMedia: { type: Boolean, default: false },
            antiGif: { type: Boolean, default: false },
            antiRepeat: { type: Boolean, default: false },
            antiFiles: { type: Boolean, default: false },
        },
        /* -------------------------------------------------
           LEVELS
        ------------------------------------------------- */
        levels: {
            enabled: {
                type: Boolean,
                default: false,
            },
            xpPerMessage: {
                type: Number,
                default: 5,
            },
            cooldown: {
                type: Number,
                default: 60000,
            },
            levelUpChannelId: {
                type: String,
                default: null,
            },
            levelUpMessage: {
                type: String,
                default: '🎉 {user} vient de passer niveau {level} !',
            },
        },
        /* -------------------------------------------------
           ECONOMY
        ------------------------------------------------- */
        shop: { enabled: { type: Boolean, default: false }, items: { type: [mongoose_1.Schema.Types.Mixed], default: [] }, currencyName: { type: String, default: 'coins' } },
        economy: {
            enabled: {
                type: Boolean,
                default: false,
            },
            currencyName: {
                type: String,
                default: 'Coins',
            },
            currencySymbol: {
                type: String,
                default: '🪙',
            },
            startingBalance: {
                type: Number,
                default: 100,
            },
            dailyReward: {
                type: Number,
                default: 200,
            },
            weeklyReward: {
                type: Number,
                default: 1000,
            },
            workMin: {
                type: Number,
                default: 50,
            },
            workMax: {
                type: Number,
                default: 250,
            },
            messageReward: {
                type: Number,
                default: 5,
            },
            messageCooldown: {
                type: Number,
                default: 60000,
            },
        },
        /* -------------------------------------------------
           AI
        ------------------------------------------------- */
        ai: {
            enabled: {
                type: Boolean,
                default: false,
            },
            channelId: {
                type: String,
                default: null,
            },
            model: {
                type: String,
                default: 'openrouter',
            },
            systemPrompt: {
                type: String,
                default: 'Tu es l’assistant IA du serveur Discord.',
            },
            maxTokens: {
                type: Number,
                default: 2000,
            },
            maxHistoryMessages: {
                type: Number,
                default: 20,
            },
        },
        /* -------------------------------------------------
           COUNTING
        ------------------------------------------------- */
        counting: {
            enabled: {
                type: Boolean,
                default: false,
            },
            channelId: {
                type: String,
                default: null,
            },
            currentCount: {
                type: Number,
                default: 0,
            },
            lastUserId: {
                type: String,
                default: null,
            },
        },
        /* -------------------------------------------------
           AUTO REACTIONS
        ------------------------------------------------- */
        autoReactions: {
            enabled: {
                type: Boolean,
                default: false,
            },
            reactions: {
                type: [
                    {
                        trigger: {
                            type: String,
                            required: true,
                        },
                        emoji: {
                            type: String,
                            required: true,
                        },
                    },
                ],
                default: [],
            },
        },
        /* -------------------------------------------------
           SCHEDULED MESSAGES
        ------------------------------------------------- */
        scheduledMessages: {
            enabled: {
                type: Boolean,
                default: false,
            },
            messages: {
                type: [
                    {
                        id: {
                            type: String,
                            required: true,
                        },
                        channelId: {
                            type: String,
                            required: true,
                        },
                        content: {
                            type: String,
                            required: true,
                        },
                        cron: {
                            type: String,
                            required: true,
                        },
                        enabled: {
                            type: Boolean,
                            default: true,
                        },
                    },
                ],
                default: [],
            },
        },
        /* -------------------------------------------------
           POLLS
        ------------------------------------------------- */
        polls: {
            enabled: {
                type: Boolean,
                default: false,
            },
            channelId: {
                type: String,
                default: null,
            },
        },
        /* -------------------------------------------------
           VERIFICATION
        ------------------------------------------------- */
        verification: {
            enabled: {
                type: Boolean,
                default: false,
            },
            channelId: {
                type: String,
                default: null,
            },
            verifiedRoleId: {
                type: String,
                default: null,
            },
            logChannelId: {
                type: String,
                default: null,
            },
        },
        /* -------------------------------------------------
           BACKUPS
        ------------------------------------------------- */
        backups: {
            enabled: {
                type: Boolean,
                default: false,
            },
            automatic: {
                type: Boolean,
                default: false,
            },
            interval: {
                type: Number,
                default: 86400000,
            },
            retention: {
                type: Number,
                default: 10,
            },
        },
        /* -------------------------------------------------
           CUSTOM COMMANDS
        ------------------------------------------------- */
        customCommands: {
            enabled: {
                type: Boolean,
                default: false,
            },
            commands: {
                type: [
                    {
                        name: {
                            type: String,
                            required: true,
                        },
                        response: {
                            type: String,
                            required: true,
                        },
                        enabled: {
                            type: Boolean,
                            default: true,
                        },
                    },
                ],
                default: [],
            },
        },
        /* -------------------------------------------------
           HONEYPOT
        ------------------------------------------------- */
        honeypot: {
            enabled: {
                type: Boolean,
                default: false,
            },
            channelId: {
                type: String,
                default: null,
            },
        },
        /* -------------------------------------------------
           STATISTICS
        ------------------------------------------------- */
        statistics: {
            enabled: {
                type: Boolean,
                default: false,
            },
            channelId: {
                type: String,
                default: null,
            },
            updateInterval: {
                type: Number,
                default: 300000,
            },
        },
        /* -------------------------------------------------
           PING
        ------------------------------------------------- */
        ping: {
            enabled: {
                type: Boolean,
                default: true,
            },
            channelId: {
                type: String,
                default: null,
            },
        },
        security: { type: SecuritySchema, default: () => ({}) },
        reactionRoles: { type: ReactionRolesSchema, default: () => ({}) },
    },
    /* ===================================================
       GLOBAL GUILD SETTINGS
       
       IMPORTANT :
       Ces propriétés sont volontairement HORS
       de `modules`.
    =================================================== */
    locale: {
        type: String,
        default: 'fr',
        trim: true,
    },
    autoLocale: { type: Boolean, default: true },
    languageRoles: { type: mongoose_1.Schema.Types.Mixed, default: () => ({}) },
    prefix: {
        type: String,
        default: '/',
        trim: true,
        maxlength: 10,
    },
    maintenance: {
        type: Boolean,
        default: false,
    },
    publicVisibility: { type: Boolean, default: true },
}, 
/* =====================================================
   SCHEMA OPTIONS
===================================================== */
{
    timestamps: true,
    versionKey: false,
    minimize: false,
});
/* =========================================================
   INDEXES
========================================================= */
/*
 * `guildId` possède déjà `unique: true`.
 *
 * MongoDB/Mongoose crée donc déjà l'index unique.
 *
 * On NE rajoute volontairement PAS :
 *
 * GuildConfigSchema.index({ guildId: 1 });
 *
 * afin d'éviter les Duplicate schema index warnings.
 */
/* =========================================================
   MODEL
========================================================= */
exports.GuildConfig = mongoose_1.default.models.GuildConfig ||
    mongoose_1.default.model('GuildConfig', GuildConfigSchema);
/* =========================================================
   DEFAULT EXPORT
========================================================= */
exports.default = exports.GuildConfig;
/* =========================================================
   DEFAULT MODULE CONFIG EXPORT
========================================================= */
