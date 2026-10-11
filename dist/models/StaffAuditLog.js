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
   SCHEMA
========================================================= */
const StaffAuditLogSchema = new mongoose_1.Schema({
    /* -----------------------------------------------------
       STAFF
    ----------------------------------------------------- */
    staffId: {
        type: String,
        required: true,
        index: true,
        trim: true,
        maxlength: 100
    },
    staffUsername: {
        type: String,
        trim: true,
        maxlength: 200
    },
    staffTag: {
        type: String,
        trim: true,
        maxlength: 200
    },
    /* -----------------------------------------------------
       ACTION
    ----------------------------------------------------- */
    action: {
        type: String,
        enum: [
            "create",
            "update",
            "delete",
            "enable",
            "disable",
            "login",
            "logout",
            "grant",
            "revoke",
            "refund",
            "cancel",
            "restore",
            "backup",
            "manual",
            "system"
        ],
        required: true,
        index: true
    },
    category: {
        type: String,
        enum: [
            "pricing",
            "payment",
            "subscription",
            "user",
            "guild",
            "ai",
            "system",
            "authentication",
            "configuration",
            "staff"
        ],
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: [
            "success",
            "failed",
            "warning"
        ],
        default: "success",
        index: true
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    },
    /* -----------------------------------------------------
       CIBLE
    ----------------------------------------------------- */
    targetType: {
        type: String,
        trim: true,
        maxlength: 100,
        index: true
    },
    targetId: {
        type: String,
        trim: true,
        maxlength: 255,
        index: true
    },
    targetName: {
        type: String,
        trim: true,
        maxlength: 500
    },
    /* -----------------------------------------------------
       GUILD
    ----------------------------------------------------- */
    guildId: {
        type: String,
        trim: true,
        maxlength: 100,
        index: true
    },
    guildName: {
        type: String,
        trim: true,
        maxlength: 200
    },
    ownerId: {
        type: String,
        trim: true,
        maxlength: 100,
        index: true
    },
    /* -----------------------------------------------------
       AVANT / APRÈS
    ----------------------------------------------------- */
    previousValue: {
        type: mongoose_1.Schema.Types.Mixed,
        default: undefined
    },
    newValue: {
        type: mongoose_1.Schema.Types.Mixed,
        default: undefined
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
    method: {
        type: String,
        trim: true,
        uppercase: true,
        maxlength: 20
    },
    route: {
        type: String,
        trim: true,
        maxlength: 500
    },
    /* -----------------------------------------------------
       ERREUR
    ----------------------------------------------------- */
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
   INDEX
========================================================= */
/**
 * Journal Staff chronologique.
 */
StaffAuditLogSchema.index({
    createdAt: -1
});
/**
 * Historique d'un membre du Staff.
 */
StaffAuditLogSchema.index({
    staffId: 1,
    createdAt: -1
});
/**
 * Historique d'une cible.
 */
StaffAuditLogSchema.index({
    targetType: 1,
    targetId: 1,
    createdAt: -1
});
/**
 * Historique d'un serveur.
 */
StaffAuditLogSchema.index({
    guildId: 1,
    createdAt: -1
});
/**
 * Historique d'un owner.
 */
StaffAuditLogSchema.index({
    ownerId: 1,
    createdAt: -1
});
/**
 * Statistiques par catégorie.
 */
StaffAuditLogSchema.index({
    category: 1,
    status: 1,
    createdAt: -1
});
/* =========================================================
   MODEL
========================================================= */
const StaffAuditLog = mongoose_1.default.models.StaffAuditLog ||
    mongoose_1.default.model("StaffAuditLog", StaffAuditLogSchema);
exports.default = StaffAuditLog;
