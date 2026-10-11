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
exports.isAuthenticated = isAuthenticated;
exports.requireWebAuthentication = requireWebAuthentication;
exports.optionalAuthentication = optionalAuthentication;
const auth_routes_1 = require("../routes/auth.routes");
/*
 * =========================================================
 * API AUTHENTICATION
 * =========================================================
 *
 * Utilisé pour :
 *
 *     /api/ai-dev/*
 *     autres API protégées
 *
 * Réponse :
 *
 *     401 JSON
 *
 * et NON une redirection HTML.
 *
 * =========================================================
 */
async function isAuthenticated(req, res, next) {
    try {
        /*
         * -------------------------------------------------------
         * Récupération de la session
         * -------------------------------------------------------
         */
        const token = (0, auth_routes_1.getRequestToken)(req);
        if (!token) {
            console.warn(`[Auth API] Session absente : ${req.method} ${req.originalUrl}`);
            res
                .status(401)
                .json({
                success: false,
                error: 'Authentification requise.',
                code: 'AUTH_REQUIRED',
            });
            return;
        }
        /*
         * -------------------------------------------------------
         * Vérification JWT
         * -------------------------------------------------------
         */
        const payload = (0, auth_routes_1.verifyJwt)(token);
        if (!payload) {
            console.warn(`[Auth API] Session invalide : ${req.method} ${req.originalUrl}`);
            /*
             * Le JWT est invalide ou expiré.
             *
             * On supprime le cookie afin d'éviter
             * que le navigateur continue à envoyer
             * une ancienne session.
             */
            res.clearCookie('jwt_token', {
                httpOnly: true,
                secure: process.env.NODE_ENV ===
                    'production',
                sameSite: 'lax',
                path: '/',
            });
            res
                .status(401)
                .json({
                success: false,
                error: 'Session invalide ou expirée.',
                code: 'AUTH_INVALID',
            });
            return;
        }
        /*
         * -------------------------------------------------------
         * Utilisateur authentifié
         * -------------------------------------------------------
         */
        const { User } = await Promise.resolve().then(() => __importStar(require('../../models/User')));
        const dbUser = await User.findOne({ discordId: payload.discordId }).select('isBlacklisted').lean();
        if (dbUser?.isBlacklisted) {
            res.clearCookie('jwt_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production' || process.env.RENDER === 'true', sameSite: 'lax', path: '/' });
            return res.status(403).json({ success: false, error: 'Compte OMNIX suspendu.', code: 'ACCOUNT_BLACKLISTED' });
        }
        req.user = payload;
        /*
         * -------------------------------------------------------
         * Log léger
         * -------------------------------------------------------
         */
        console.log(`[Auth API] ✓ ${payload.discordId} → ${req.method} ${req.originalUrl}`);
        next();
    }
    catch (error) {
        console.error('[Auth API] Erreur middleware :', error);
        res
            .status(401)
            .json({
            success: false,
            error: 'Impossible de vérifier la session.',
            code: 'AUTH_ERROR',
        });
    }
}
/*
 * =========================================================
 * WEB AUTHENTICATION
 * =========================================================
 *
 * Utilisé uniquement pour les pages HTML.
 *
 * Exemple :
 *
 *     /dashboard
 *     /dashboard/:guildId
 *     /ai-dev
 *     /admin
 *     /mon-espace
 *
 * Si l'utilisateur n'est pas connecté :
 *
 *     → Discord OAuth
 *
 * Si le JWT est invalide :
 *
 *     → suppression du cookie
 *     → Discord OAuth
 *
 * IMPORTANT :
 *
 * On ne retourne JAMAIS du JSON pour une page HTML.
 *
 * =========================================================
 */
function requireWebAuthentication(req, res, next) {
    try {
        /*
         * -------------------------------------------------------
         * Récupération session
         * -------------------------------------------------------
         */
        const token = (0, auth_routes_1.getRequestToken)(req);
        if (!token) {
            console.warn(`[Auth WEB] Session absente : ${req.method} ${req.originalUrl}`);
            res.redirect('/api/auth/login');
            return;
        }
        /*
         * -------------------------------------------------------
         * Vérification JWT
         * -------------------------------------------------------
         */
        const payload = (0, auth_routes_1.verifyJwt)(token);
        if (!payload) {
            console.warn(`[Auth WEB] Session invalide : ${req.method} ${req.originalUrl}`);
            res.clearCookie('jwt_token', {
                httpOnly: true,
                secure: process.env.NODE_ENV ===
                    'production',
                sameSite: 'lax',
                path: '/',
            });
            res.redirect('/api/auth/login');
            return;
        }
        /*
         * -------------------------------------------------------
         * Utilisateur authentifié
         * -------------------------------------------------------
         */
        req.user =
            payload;
        console.log(`[Auth WEB] ✓ ${payload.discordId} → ${req.method} ${req.originalUrl}`);
        next();
    }
    catch (error) {
        console.error('[Auth WEB] Erreur middleware :', error);
        res.clearCookie('jwt_token', {
            httpOnly: true,
            secure: process.env.NODE_ENV ===
                'production',
            sameSite: 'lax',
            path: '/',
        });
        res.redirect('/api/auth/login');
    }
}
/*
 * =========================================================
 * OPTIONAL AUTHENTICATION
 * =========================================================
 *
 * Utile pour les pages qui peuvent fonctionner
 * connectées OU non connectées.
 *
 * Exemple :
 *
 *     /
 *     /pricing
 *     /premium
 *
 * Si une session existe :
 *
 *     req.user = payload
 *
 * Sinon :
 *
 *     req.user reste undefined
 *
 * Aucune redirection.
 *
 * =========================================================
 */
function optionalAuthentication(req, res, next) {
    try {
        const token = (0, auth_routes_1.getRequestToken)(req);
        if (!token) {
            next();
            return;
        }
        const payload = (0, auth_routes_1.verifyJwt)(token);
        if (!payload) {
            /*
             * Session invalide :
             * on la nettoie mais on ne bloque pas
             * la page publique.
             */
            res.clearCookie('jwt_token', {
                httpOnly: true,
                secure: process.env.NODE_ENV ===
                    'production',
                sameSite: 'lax',
                path: '/',
            });
            next();
            return;
        }
        req.user =
            payload;
        next();
    }
    catch (error) {
        console.error('[Auth OPTIONAL] Erreur :', error);
        next();
    }
}
/*
 * =========================================================
 * DEFAULT EXPORT
 * =========================================================
 *
 * Compatibilité avec :
 *
 * import isAuthenticated from ...
 *
 * =========================================================
 */
exports.default = isAuthenticated;
