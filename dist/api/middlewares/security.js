"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSecurity = setupSecurity;
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const helmet_1 = __importDefault(require("helmet"));
const index_1 = require("../../config/index");
function setupSecurity(app) {
    const production = index_1.CONFIG.NODE_ENV === 'production' || process.env.RENDER === 'true';
    app.set('trust proxy', index_1.CONFIG.SECURITY.TRUST_PROXY ? 1 : 0);
    app.disable('x-powered-by');
    app.use((0, helmet_1.default)({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginResourcePolicy: false, hsts: production ? { maxAge: 31536000, includeSubDomains: true, preload: false } : false }));
    const origins = new Set([index_1.CONFIG.CLIENT_URL, index_1.CONFIG.DOMAIN, process.env.CLIENT_URL, process.env.DOMAIN, 'http://localhost:3000', 'http://127.0.0.1:3000'].map(v => String(v || '').trim().replace(/\/$/, '')).filter(Boolean));
    app.use((0, cors_1.default)({ origin(origin, cb) { if (!origin || origins.has(origin.replace(/\/$/, '')))
            return cb(null, true); return cb(new Error('Origine CORS non autorisée.')); }, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'X-CSRF-Token'], optionsSuccessStatus: 204 }));
    app.use('/api', (0, express_rate_limit_1.default)({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: 'draft-7', legacyHeaders: false, skip: req => req.path === '/payments/webhook', message: { success: false, error: 'Trop de requêtes. Veuillez réessayer plus tard.', code: 'RATE_LIMITED' } }));
    app.use('/api/auth/login', (0, express_rate_limit_1.default)({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, error: 'Trop de tentatives de connexion. Réessayez plus tard.', code: 'AUTH_RATE_LIMITED' } }));
    app.use('/api', (req, res, next) => {
        if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) || req.path === '/payments/webhook')
            return next();
        const origin = req.get('origin');
        const sameOrigin = `${req.protocol}://${req.get('host')}`.replace(/\/$/, '');
        if (origin && (origins.has(origin.replace(/\/$/, '')) || origin.replace(/\/$/, '') === sameOrigin))
            return next();
        const referer = req.get('referer');
        if (!origin && referer) {
            try {
                if (origins.has(new URL(referer).origin.replace(/\/$/, '')))
                    return next();
            }
            catch { }
        }
        if (req.get('authorization')?.toLowerCase().startsWith('bearer '))
            return next();
        return res.status(403).json({ success: false, error: 'Requête d’origine non autorisée.', code: 'CSRF_ORIGIN_REJECTED' });
    });
}
