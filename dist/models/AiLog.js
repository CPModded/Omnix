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
const mongoose_1 = __importStar(require("mongoose"));
/* =========================================================
   MESSAGE SCHEMA
========================================================= */
const AiMessageSchema = new mongoose_1.Schema({
    role: {
        type: String,
        enum: [
            "system",
            "user",
            "assistant",
            "tool"
        ],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {}
    }
}, {
    _id: false
});
/* =========================================================
   AI LOG SCHEMA
========================================================= */
const AiLogSchema = new mongoose_1.Schema({
    /* -----------------------------------------------------
       IDENTIFICATION
    ----------------------------------------------------- */
    sessionId: {
        type: String,
        required: true,
        index: true,
        trim: true,
        maxlength: 255
    },
    source: {
        type: String,
        enum: [
            "web",
            "discord",
            "api",
            "system"
        ],
        required: true,
        index: true
    },
    /* -----------------------------------------------------
       UTILISATEUR
    ----------------------------------------------------- */
    userId: {
        type: String,
        index: true,
        trim: true,
        maxlength: 100
    },
    username: {
        type: String,
        trim: true,
        maxlength: 200
    },
    userTag: {
        type: String,
        trim: true,
        maxlength: 200
    },
    /* -----------------------------------------------------
       SERVEUR
    ----------------------------------------------------- */
    guildId: {
        type: String,
        index: true,
        trim: true,
        maxlength: 100
    },
    guildName: {
        type: String,
        trim: true,
        maxlength: 200
    },
    /* -----------------------------------------------------
       OWNER
    ----------------------------------------------------- */
    ownerId: {
        type: String,
        index: true,
        trim: true,
        maxlength: 100
    },
    ownerUsername: {
        type: String,
        trim: true,
        maxlength: 200
    },
    /* -----------------------------------------------------
       CONVERSATION
    ----------------------------------------------------- */
    messages: {
        type: [AiMessageSchema],
        default: []
    },
    userMessage: {
        type: String,
        maxlength: 100000
    },
    assistantMessage: {
        type: String,
        maxlength: 100000
    },
    /* -----------------------------------------------------
       MODÈLE
    ----------------------------------------------------- */
    provider: {
        type: String,
        trim: true,
        maxlength: 100
    },
    model: {
        type: String,
        trim: true,
        maxlength: 200,
        index: true
    },
    /* -----------------------------------------------------
       TOKENS
    ----------------------------------------------------- */
    promptTokens: {
        type: Number,
        default: 0,
        min: 0
    },
    completionTokens: {
        type: Number,
        default: 0,
        min: 0
    },
    totalTokens: {
        type: Number,
        default: 0,
        min: 0
    },
    /* -----------------------------------------------------
       PERFORMANCE
    ----------------------------------------------------- */
    durationMs: {
        type: Number,
        min: 0
    },
    /* -----------------------------------------------------
       STATUT
    ----------------------------------------------------- */
    status: {
        type: String,
        enum: [
            "success",
            "error",
            "cancelled",
            "blocked"
        ],
        default: "success",
        index: true
    },
    error: {
        type: String,
        maxlength: 10000
    },
    errorCode: {
        type: String,
        maxlength: 255,
        index: true
    },
    /* -----------------------------------------------------
       CLIENT
    ----------------------------------------------------- */
    ipHash: {
        type: String,
        trim: true,
        maxlength: 255
    },
    userAgent: {
        type: String,
        maxlength: 1000
    },
    /* -----------------------------------------------------
       METADATA
    ----------------------------------------------------- */
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true,
    versionKey: false
});
/* =========================================================
   INDEX COMPOSITES
========================================================= */
/**
 * Recherche des conversations d'un serveur.
 */
AiLogSchema.index({
    guildId: 1,
    createdAt: -1
});
/**
 * Recherche de l'activité IA d'un owner.
 */
AiLogSchema.index({
    ownerId: 1,
    createdAt: -1
});
/**
 * Recherche de l'activité IA d'un utilisateur.
 */
AiLogSchema.index({
    userId: 1,
    createdAt: -1
});
/**
 * Recherche par session.
 */
AiLogSchema.index({
    sessionId: 1,
    createdAt: 1
});
/**
 * Statistiques IA par source.
 */
AiLogSchema.index({
    source: 1,
    status: 1,
    createdAt: -1
});
/**
 * Statistiques par modèle.
 */
AiLogSchema.index({
    model: 1,
    createdAt: -1
});
/* =========================================================
   MODEL
========================================================= */
const AiLog = mongoose_1.default.models.AiLog ||
    mongoose_1.default.model("AiLog", AiLogSchema);
exports.default = AiLog;
