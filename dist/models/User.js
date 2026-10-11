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
exports.User = void 0;
const mongoose_1 = __importStar(require("mongoose"));
/* =========================================================
   GUILD SUB-SCHEMA
========================================================= */
const UserGuildSchema = new mongoose_1.Schema({
    id: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    icon: {
        type: String,
        default: null,
    },
    owner: {
        type: Boolean,
        default: false,
    },
    permissions: {
        type: String,
        default: '0',
    },
}, {
    _id: false,
});
/* =========================================================
   USER SCHEMA
========================================================= */
const UserSchema = new mongoose_1.Schema({
    /* ---------------------------------------------------
       DISCORD ID
    --------------------------------------------------- */
    discordId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    googleId: { type: String },
    authProvider: { type: String, enum: ['discord', 'google', 'both'], default: 'discord' },
    /* ---------------------------------------------------
       USERNAME
    --------------------------------------------------- */
    username: {
        type: String,
        required: true,
        trim: true,
    },
    /* ---------------------------------------------------
       GLOBAL NAME
    --------------------------------------------------- */
    globalName: {
        type: String,
        trim: true,
    },
    /* ---------------------------------------------------
       AVATAR
    --------------------------------------------------- */
    avatar: {
        type: String,
        default: null,
    },
    email: {
        type: String,
        default: null,
        trim: true,
        lowercase: true,
        index: true,
    },
    emailVerified: {
        type: Boolean,
        default: false,
    },
    /* ---------------------------------------------------
       DISCORD ACCESS TOKEN
       
       IMPORTANT:
       select: false
       → Ne sera pas retourné avec User.find()
--------------------------------------------------- */
    accessToken: {
        type: String,
        select: false,
    },
    /* ---------------------------------------------------
       DISCORD REFRESH TOKEN
    --------------------------------------------------- */
    refreshToken: {
        type: String,
        select: false,
    },
    /* ---------------------------------------------------
       TOKEN EXPIRATION
    --------------------------------------------------- */
    tokenExpiresAt: {
        type: Date,
    },
    /* ---------------------------------------------------
       DISCORD GUILDS
    --------------------------------------------------- */
    guilds: {
        type: [UserGuildSchema],
        default: [],
    },
    /* ---------------------------------------------------
       OMNIX ADMIN
       
       IMPORTANT:
       Le statut Owner n'est PAS stocké ici.
       
       Owner est déterminé dynamiquement avec
       CONFIG.OWNER_IDS.
    --------------------------------------------------- */
    isAdmin: {
        type: Boolean,
        default: false,
    },
    role: {
        type: String,
        enum: ['user', 'support', 'moderator', 'admin', 'super_admin', 'owner'],
        default: 'user',
        index: true,
    },
    permissions: {
        type: [String],
        default: [],
    },
    /* ---------------------------------------------------
       OMNIX PREMIUM
    --------------------------------------------------- */
    isPremium: { type: Boolean, default: false },
    premiumExpiresAt: { type: Date, default: null },
    isBlacklisted: { type: Boolean, default: false, index: true },
    /* ---------------------------------------------------
       DASHBOARD PREFERENCES — PER USER
    --------------------------------------------------- */
    dashboardPreferences: {
        compactMode: { type: Boolean, default: false },
        sidebarCollapsed: { type: Boolean, default: false },
        animations: { type: Boolean, default: true },
        showStats: { type: Boolean, default: true },
        showServers: { type: Boolean, default: true },
        showActivity: { type: Boolean, default: true },
        showStatistics: { type: Boolean, default: true },
        density: { type: String, enum: ['comfortable', 'compact'], default: 'comfortable' },
    },
    /* ---------------------------------------------------
       LAST LOGIN
    --------------------------------------------------- */
    lastLogin: {
        type: Date,
    },
}, {
    timestamps: true,
    strict: true,
});
/* Google OAuth: un index unique partiel ignore les comptes sans Google ID. */
UserSchema.index({ googleId: 1 }, {
    unique: true,
    name: 'googleId_1',
    partialFilterExpression: { googleId: { $type: 'string' } },
});
/* =========================================================
   INDEXES
========================================================= */
UserSchema.index({
    isAdmin: 1,
});
UserSchema.index({
    isPremium: 1,
});
/* =========================================================
   MODEL
========================================================= */
exports.User = mongoose_1.default.models.User ||
    mongoose_1.default.model('User', UserSchema);
exports.default = exports.User;
