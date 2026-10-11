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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const mongoose_1 = __importDefault(require("mongoose"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const security_1 = require("./middlewares/security");
const auth_routes_1 = __importStar(require("./routes/auth.routes"));
const guild_routes_1 = __importDefault(require("./routes/guild.routes"));
const stats_routes_1 = __importDefault(require("./routes/stats.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const pricing_routes_1 = __importDefault(require("./routes/pricing.routes"));
const ai_dev_routes_1 = __importDefault(require("./routes/ai-dev.routes"));
const referral_routes_1 = __importDefault(require("./routes/referral.routes"));
const backup_routes_1 = __importDefault(require("./routes/backup.routes"));
const guildConfig_routes_1 = __importDefault(require("./routes/guildConfig.routes"));
const payment_routes_1 = __importDefault(require("./routes/payment.routes"));
const license_routes_1 = __importDefault(require("./routes/license.routes"));
const email_routes_1 = __importDefault(require("./routes/email.routes"));
const partner_routes_1 = __importDefault(require("./routes/partner.routes"));
const support_routes_1 = __importDefault(require("./routes/support.routes"));
const audit_routes_1 = __importDefault(require("./routes/audit.routes"));
const auth_1 = require("./middlewares/auth");
const User_1 = require("../models/User");
const License_1 = __importDefault(require("../models/License"));
const PlatformEvent_1 = __importDefault(require("../models/PlatformEvent"));
const geoLocale_1 = require("../services/geoLocale");
/*
 * =========================================================
 * OMNIX — EXPRESS APPLICATION
 * =========================================================
 *
 * AUTHENTIFICATION :
 *
 *     jwt_token
 *
 * Le JWT est stocké uniquement dans le cookie httpOnly.
 *
 * Les pages WEB utilisent :
 *
 *     requireAuthentication()
 *
 * Les API utilisent :
 *
 *     isAuthenticated()
 *
 * Les deux utilisent exactement le même système de session.
 * =========================================================
 */
const app = (0, express_1.default)();
/*
 * =========================================================
 * PROJECT ROOT
 * =========================================================
 */
const PROJECT_ROOT = process.cwd();
/*
 * =========================================================
 * POSSIBLE VIEWS DIRECTORIES
 * =========================================================
 */
const POSSIBLE_VIEWS = [
    node_path_1.default.join(PROJECT_ROOT, 'views'),
    node_path_1.default.join(PROJECT_ROOT, 'src', 'dashboard', 'views'),
    node_path_1.default.join(PROJECT_ROOT, 'dist', 'dashboard', 'views'),
    node_path_1.default.join(PROJECT_ROOT, 'dist', 'src', 'dashboard', 'views'),
    node_path_1.default.join(PROJECT_ROOT, 'src', 'views'),
    node_path_1.default.join(PROJECT_ROOT, 'dist', 'views'),
];
/*
 * =========================================================
 * POSSIBLE PUBLIC DIRECTORIES
 * =========================================================
 */
const POSSIBLE_PUBLIC = [
    node_path_1.default.join(PROJECT_ROOT, 'public'),
    node_path_1.default.join(PROJECT_ROOT, 'src', 'dashboard', 'public'),
    node_path_1.default.join(PROJECT_ROOT, 'dist', 'dashboard', 'public'),
    node_path_1.default.join(PROJECT_ROOT, 'dist', 'src', 'dashboard', 'public'),
    node_path_1.default.join(PROJECT_ROOT, 'src', 'public'),
    node_path_1.default.join(PROJECT_ROOT, 'dist', 'public'),
];
/*
 * =========================================================
 * FIND EXISTING DIRECTORY
 * =========================================================
 */
function findExistingDirectory(directories) {
    for (const directory of directories) {
        try {
            if (node_fs_1.default.existsSync(directory) &&
                node_fs_1.default.statSync(directory).isDirectory()) {
                return directory;
            }
        }
        catch {
            // Ignore inaccessible directories.
        }
    }
    return directories[0];
}
/*
 * =========================================================
 * FIND VIEW
 * =========================================================
 */
function findView(viewName) {
    const normalized = viewName.endsWith('.ejs')
        ? viewName
        : `${viewName}.ejs`;
    const possiblePaths = [
        ...POSSIBLE_VIEWS.map((directory) => node_path_1.default.join(directory, normalized)),
    ];
    for (const viewPath of possiblePaths) {
        try {
            if (node_fs_1.default.existsSync(viewPath) &&
                node_fs_1.default.statSync(viewPath).isFile()) {
                return viewPath;
            }
        }
        catch {
            // Ignore invalid paths.
        }
    }
    return null;
}
/*
 * =========================================================
 * FIND PUBLIC FILE
 * =========================================================
 */
function findPublicFile(fileName) {
    const cleanName = fileName
        .replace(/^\/+/, '')
        .replace(/\.\./g, '');
    for (const directory of POSSIBLE_PUBLIC) {
        const filePath = node_path_1.default.join(directory, cleanName);
        try {
            if (node_fs_1.default.existsSync(filePath) &&
                node_fs_1.default.statSync(filePath).isFile()) {
                return filePath;
            }
        }
        catch {
            // Ignore.
        }
    }
    return null;
}
/*
 * =========================================================
 * BASIC CONFIGURATION
 * =========================================================
 */
app.disable('x-powered-by');
/*
 * =========================================================
 * SECURITY
 * =========================================================
 */
(0, security_1.setupSecurity)(app);
/*
 * =========================================================
 * BODY PARSERS
 * =========================================================
 */
app.use(express_1.default.json({
    limit: '5mb',
    verify: (req, _res, buf) => {
        // Stripe signe le corps HTTP brut. Utiliser req.path évite de perdre
        // la signature si le webhook reçoit exceptionnellement une query string.
        if (req.path === '/api/payments/webhook') {
            req.rawBody = Buffer.from(buf);
        }
    },
}));
app.use(express_1.default.urlencoded({ extended: true, limit: '100kb' }));
/*
 * =========================================================
 * COOKIES
 * =========================================================
 *
 * IMPORTANT :
 *
 * cookieParser() doit être chargé AVANT
 * toutes les routes qui utilisent req.cookies.
 *
 * Cela est indispensable pour :
 *
 *     /api/auth/me
 *     /api/auth/guilds
 *     /api/ai-dev
 *     /dashboard
 *     /admin
 *
 * =========================================================
 */
app.use((0, cookie_parser_1.default)());
// Localisation du site : pays/IP en priorité lorsque disponible, puis langue
// du navigateur. Le résultat est mis en cache côté service pour éviter une
// requête de géolocalisation à chaque navigation. Aucun emplacement précis
// n'est exposé au frontend : seulement une locale et, si disponible, un pays.
app.use(async (req, res, next) => {
    const acceptsHtml = String(req.headers.accept || '').includes('text/html');
    if (!acceptsHtml || req.path.startsWith('/api/') || req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path.startsWith('/assets/'))
        return next();
    try {
        const detected = await (0, geoLocale_1.detectWebLocale)(req);
        res.locals.omnixLocale = detected.locale;
        res.locals.omnixCountry = detected.country;
        res.locals.omnixVpnDetected = detected.vpn;
    }
    catch {
        res.locals.omnixLocale = String(req.headers['accept-language'] || 'fr').split(',')[0].split(';')[0] || 'fr';
    }
    return next();
});
/*
 * =========================================================
 * EJS
 * =========================================================
 */
const viewsDirectory = findExistingDirectory(POSSIBLE_VIEWS);
app.set('view engine', 'ejs');
app.set('views', viewsDirectory);
/*
 * =========================================================
 * STATIC FILES
 * =========================================================
 */
// Explicit mounts for the canonical public assets. This keeps /css/* and /js/*
// stable even when Render starts the app through src/index.ts or a compiled build.
const canonicalPublic = node_path_1.default.join(PROJECT_ROOT, 'public');
const sourceRelativePublic = node_path_1.default.resolve(__dirname, '../../public');
const staticPublicCandidates = Array.from(new Set([
    ...POSSIBLE_PUBLIC,
    canonicalPublic,
    sourceRelativePublic,
]));
// /css et /assets sont montés explicitement sur le premier dossier réellement
// présent. Render peut démarrer OMNIX depuis la racine du dépôt, src/ ou une
// version compilée : le chemin relatif ne doit pas décider si le CSS existe.
const existingPublicDirectories = staticPublicCandidates.filter((directory) => {
    try {
        return node_fs_1.default.existsSync(directory) && node_fs_1.default.statSync(directory).isDirectory();
    }
    catch {
        return false;
    }
});
const cssDirectories = existingPublicDirectories
    .map((directory) => node_path_1.default.join(directory, 'css'))
    .filter((directory) => {
    try {
        return node_fs_1.default.existsSync(directory) && node_fs_1.default.statSync(directory).isDirectory();
    }
    catch {
        return false;
    }
});
for (const cssDirectory of cssDirectories) {
    app.use('/css', express_1.default.static(cssDirectory, {
        fallthrough: true,
        maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
    }));
}
// Fallback déterministe pour le stylesheet principal. Cela couvre les
// démarrages depuis src/index.ts, dist/ ou un cwd différent de la racine.
const omnixWebCssCandidates = Array.from(new Set([
    ...cssDirectories.map((directory) => node_path_1.default.join(directory, 'omnix-web.css')),
    node_path_1.default.resolve(__dirname, '../../public/css/omnix-web.css'),
    node_path_1.default.join(PROJECT_ROOT, 'public/css/omnix-web.css'),
]));
app.get('/css/omnix-web.css', (req, res, next) => {
    const cssFile = omnixWebCssCandidates.find((file) => {
        try {
            return node_fs_1.default.existsSync(file) && node_fs_1.default.statSync(file).isFile();
        }
        catch {
            return false;
        }
    });
    if (!cssFile)
        return next();
    return res.sendFile(cssFile);
});
for (const publicDirectory of existingPublicDirectories) {
    app.use('/assets', express_1.default.static(publicDirectory, {
        fallthrough: true,
        maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
    }));
}
for (const publicDirectory of POSSIBLE_PUBLIC) {
    try {
        if (node_fs_1.default.existsSync(publicDirectory) &&
            node_fs_1.default.statSync(publicDirectory).isDirectory()) {
            app.use(express_1.default.static(publicDirectory, {
                maxAge: process.env.NODE_ENV ===
                    'production'
                    ? '1h'
                    : 0,
                fallthrough: true,
            }));
        }
    }
    catch {
        // Ignore invalid directories.
    }
}
/*
 * =========================================================
 * LOGO FALLBACK
 * =========================================================
 */
app.get('/logo.png', (req, res, next) => {
    const logo = findPublicFile('logo.png');
    if (!logo) {
        return next();
    }
    return res.sendFile(logo);
});
/*
 * =========================================================
 * API CACHE CONTROL
 * =========================================================
 */
app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});
/*
 * =========================================================
 * WEB AUTHENTICATION
 * =========================================================
 *
 * IMPORTANT FIX
 *
 * L'ancien système redirigeait systématiquement
 * vers "/" lorsqu'une page protégée ne trouvait
 * pas le JWT.
 *
 * Maintenant :
 *
 *     /dashboard
 *     /admin
 *     /mon-espace
 *
 * redirigent vers :
 *
 *     /api/auth/login
 *
 * et non vers la page d'accueil.
 *
 * =========================================================
 */
async function requireAuthentication(req, res, next) {
    const token = (0, auth_routes_1.getRequestToken)(req);
    /*
     * Pas de session.
     */
    if (!token) {
        console.warn(`[Auth] Session absente : ${req.method} ${req.originalUrl}`);
        /*
         * API → JSON
         */
        if (req.path.startsWith('/api')) {
            return res
                .status(401)
                .json({
                success: false,
                error: 'Authentification requise.',
                code: 'AUTH_REQUIRED',
            });
        }
        /*
         * Page web → connexion Discord
         */
        return res.redirect('/api/auth/login');
    }
    /*
     * Vérification JWT.
     */
    const payload = (0, auth_routes_1.verifyJwt)(token);
    if (!payload) {
        console.warn(`[Auth] JWT invalide : ${req.method} ${req.originalUrl}`);
        /*
         * API → JSON
         */
        if (req.path.startsWith('/api')) {
            return res
                .status(401)
                .json({
                success: false,
                error: 'Session invalide ou expirée.',
                code: 'AUTH_INVALID',
            });
        }
        /*
         * Session invalide :
         * on supprime le cookie.
         */
        res.clearCookie('jwt_token', {
            httpOnly: true,
            secure: process.env.NODE_ENV ===
                'production',
            sameSite: 'lax',
            path: '/',
        });
        /*
         * Puis nouvelle connexion Discord.
         */
        return res.redirect('/api/auth/login');
    }
    /*
     * Vérification serveur du statut de compte.
     *
     * Le JWT ne contient pas le statut de blacklist afin qu'une suspension
     * puisse prendre effet sans attendre l'expiration de la session.
     */
    try {
        const dbUser = await User_1.User.findOne({
            discordId: String(payload.discordId),
        })
            .select('isBlacklisted')
            .lean()
            .maxTimeMS(3000);
        if (dbUser?.isBlacklisted === true) {
            res.clearCookie('jwt_token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production' ||
                    process.env.RENDER === 'true',
                sameSite: 'lax',
                path: '/',
            });
            if (req.path.startsWith('/api')) {
                return res.status(403).json({
                    success: false,
                    error: 'Compte OMNIX suspendu.',
                    code: 'ACCOUNT_BLACKLISTED',
                });
            }
            return res.redirect('/suspended');
        }
    }
    catch (error) {
        console.error('[Auth] Impossible de vérifier le statut du compte :', error);
        if (req.path.startsWith('/api')) {
            return res.status(503).json({
                success: false,
                error: 'Service d’authentification temporairement indisponible.',
                code: 'AUTH_SERVICE_UNAVAILABLE',
            });
        }
        return res.status(503).send('Le service d’authentification est temporairement indisponible.');
    }
    /*
     * Expose le JWT décodé à la requête.
     */
    req.user =
        payload;
    return next();
}
/*
 * =========================================================
 * GUILD ACCESS
 * =========================================================
 */
async function requireGuildAccess(req, res, next) {
    try {
        const user = req.user;
        if (!user?.discordId) {
            return res.redirect('/api/auth/login');
        }
        const guildId = String(req.params.guildId ||
            '').trim();
        if (!guildId) {
            return res.redirect('/dashboard');
        }
        /*
         * Import dynamique pour éviter
         * les dépendances circulaires.
         */
        const { User } = await Promise.resolve().then(() => __importStar(require('../models/User')));
        const dbUser = await User.findOne({
            discordId: user.discordId,
        }).lean();
        if (!dbUser) {
            return res.redirect('/api/auth/login');
        }
        const guilds = Array.isArray(dbUser.guilds)
            ? dbUser.guilds
            : [];
        const guild = guilds.find((item) => String(item?.id) ===
            guildId);
        if (!guild) {
            return res
                .status(403)
                .send('Vous n’avez pas accès à ce serveur.');
        }
        /*
         * Discord Administrator.
         */
        const permissions = String(guild.permissions ||
            '0');
        let administrator = false;
        try {
            administrator =
                ((BigInt(permissions) &
                    0x8n) ===
                    0x8n);
        }
        catch {
            administrator =
                false;
        }
        /*
         * Owner du serveur
         * OU owner OMNIX.
         */
        const owner = Boolean(guild.owner) || Boolean(dbUser.isAdmin) || (0, auth_routes_1.isOwner)(user.discordId);
        if (!administrator &&
            !owner) {
            return res
                .status(403)
                .send('Vous devez être propriétaire ou administrateur de ce serveur.');
        }
        req.guild =
            guild;
        return next();
    }
    catch (error) {
        console.error('[Web] Erreur accès guild :', error);
        return res
            .status(500)
            .send('Impossible de vérifier l’accès au serveur.');
    }
}
/*
 * =========================================================
 * HEALTH
 * =========================================================
 */
app.get('/api/system/routes', requireAuthentication, (req, res) => {
    const stack = app._router?.stack || [];
    const routes = [];
    for (const layer of stack) {
        if (layer?.route?.path) {
            const methods = Object.keys(layer.route.methods || {}).filter(Boolean).map((m) => m.toUpperCase());
            for (const method of methods)
                routes.push(`${method} ${layer.route.path}`);
        }
        if (layer?.name === 'router' && layer?.regexp)
            routes.push('MOUNTED ROUTER');
    }
    return res.json({ success: true, count: routes.length, routes: routes.slice(0, 500), timestamp: new Date().toISOString() });
});
app.get('/health', (req, res) => {
    return res.json({
        success: true,
        service: 'OMNIX',
        status: (() => { const c = globalThis.omnixDiscordClient; const commandStatus = c?.omnixCommandLoadStatus; const eventStatus = c?.omnixEventLoadStatus; return commandStatus?.degraded || eventStatus?.degraded ? 'degraded' : (c?.isReady?.() ? 'online' : 'starting'); })(),
        discord: Boolean(globalThis.omnixDiscordClient?.isReady?.()),
        commands: globalThis.omnixDiscordClient?.commands?.size ?? 0,
        events: globalThis.omnixLoadedEvents?.length ?? 0,
        mongodb: mongoose_1.default.connection.readyState === 1,
        timestamp: new Date().toISOString(),
    });
});
/*
 * =========================================================
 * AUTH ROUTES
 * =========================================================
 *
 * /api/auth/login
 * /api/auth/callback
 * /api/auth/me
 * /api/auth/guilds
 * /api/auth/logout
 *
 * IMPORTANT :
 *
 * authRouter est monté AVANT les routes
 * qui nécessitent une authentification.
 *
 * =========================================================
 */
app.use('/api/auth', auth_routes_1.default);
/*
 * =========================================================
 * DASHBOARD — PREFERENCES PAR UTILISATEUR
 * =========================================================
 */
app.get('/api/dashboard/preferences', requireAuthentication, async (req, res) => {
    try {
        const user = req.user;
        if (!user?.discordId)
            return res.status(401).json({ success: false, error: 'Authentification requise.' });
        const dbUser = await User_1.User.findOne({ discordId: user.discordId }).select('dashboardPreferences').lean();
        return res.json({ success: true, preferences: dbUser?.dashboardPreferences || {} });
    }
    catch (error) {
        console.error('[Dashboard Preferences] GET:', error);
        return res.status(500).json({ success: false, error: 'Impossible de charger les préférences.' });
    }
});
app.patch('/api/dashboard/preferences', requireAuthentication, async (req, res) => {
    try {
        const user = req.user;
        if (!user?.discordId)
            return res.status(401).json({ success: false, error: 'Authentification requise.' });
        const body = req.body || {};
        const preferences = {
            compactMode: Boolean(body.compactMode),
            sidebarCollapsed: Boolean(body.sidebarCollapsed),
            animations: body.animations !== false,
            showStats: body.showStats !== false,
            showServers: body.showServers !== false,
            showActivity: body.showActivity !== false,
            showStatistics: body.showStatistics !== false,
            density: body.density === 'compact' ? 'compact' : 'comfortable',
        };
        const updated = await User_1.User.findOneAndUpdate({ discordId: user.discordId }, { $set: { dashboardPreferences: preferences } }, { new: true, runValidators: true, upsert: false }).select('dashboardPreferences').lean();
        if (!updated)
            return res.status(404).json({ success: false, error: 'Utilisateur introuvable.' });
        return res.json({ success: true, preferences: updated.dashboardPreferences || preferences });
    }
    catch (error) {
        console.error('[Dashboard Preferences] PATCH:', error);
        return res.status(500).json({ success: false, error: 'Impossible d’enregistrer les préférences.' });
    }
});
/*
 * =========================================================
 * MEMBER / ACCOUNT API
 * =========================================================
 */
const getSessionUser = (req) => {
    const token = (0, auth_routes_1.getRequestToken)(req);
    return token ? (0, auth_routes_1.verifyJwt)(token) : null;
};
app.get('/api/me/overview', auth_1.isAuthenticated, async (req, res) => {
    try {
        const session = getSessionUser(req);
        if (!session?.discordId)
            return res.status(401).json({ success: false, error: 'Authentification requise.' });
        const [user, licenses] = await Promise.all([
            User_1.User.findOne({ discordId: session.discordId }).select('discordId username globalName email createdAt lastLogin isPremium premiumExpiresAt guilds').lean(),
            License_1.default.find({ buyerId: session.discordId }).sort({ createdAt: -1 }).lean(),
        ]);
        if (!user)
            return res.status(404).json({ success: false, error: 'Utilisateur introuvable.' });
        const now = Date.now();
        const activeLicenses = licenses.filter((license) => ['active', 'used'].includes(String(license.status)) &&
            (!license.expiresAt || new Date(license.expiresAt).getTime() > now));
        const latest = activeLicenses[0] || null;
        const activatedIds = new Set();
        for (const license of activeLicenses) {
            if (license.activatedGuildId)
                activatedIds.add(String(license.activatedGuildId));
            for (const id of Array.isArray(license.activatedGuildIds) ? license.activatedGuildIds : [])
                activatedIds.add(String(id));
        }
        const premiumSince = activeLicenses
            .map((license) => license.activatedAt || license.createdAt)
            .filter(Boolean)
            .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] || null;
        return res.json({
            success: true,
            user: {
                discordId: user.discordId,
                username: user.username,
                globalName: user.globalName || null,
                email: user.email || null,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin || null,
            },
            premium: {
                active: Boolean(user.isPremium || activeLicenses.length),
                since: premiumSince,
                expiresAt: user.premiumExpiresAt || latest?.expiresAt || null,
                usedServers: activatedIds.size,
                serverLimit: Math.max(10, ...activeLicenses.map((l) => Number(l.maxGuilds || 10))),
            },
            servers: (user.guilds || []).map((guild) => ({
                id: guild.id,
                name: guild.name,
                owner: Boolean(guild.owner),
                permissions: guild.permissions || '0',
            })),
        });
    }
    catch (error) {
        console.error('[Account API] overview', error);
        return res.status(500).json({ success: false, error: 'Impossible de charger votre espace.' });
    }
});
app.get('/api/me/activity', auth_1.isAuthenticated, async (req, res) => {
    try {
        const session = getSessionUser(req);
        if (!session?.discordId)
            return res.status(401).json({ success: false, error: 'Authentification requise.' });
        const user = await User_1.User.findOne({ discordId: session.discordId }).select('guilds').lean();
        const guildIds = (user?.guilds || []).map((g) => String(g.id)).filter(Boolean);
        const data = await PlatformEvent_1.default.find({
            $or: [{ userId: session.discordId }, ...(guildIds.length ? [{ guildId: { $in: guildIds } }] : [])],
        }).sort({ createdAt: -1 }).limit(100).lean();
        return res.json({ success: true, data });
    }
    catch (error) {
        console.error('[Account API] activity', error);
        return res.status(500).json({ success: false, error: 'Impossible de charger votre activité.' });
    }
});
app.get('/api/me/statistics', auth_1.isAuthenticated, async (req, res) => {
    try {
        const session = getSessionUser(req);
        if (!session?.discordId)
            return res.status(401).json({ success: false, error: 'Authentification requise.' });
        const user = await User_1.User.findOne({ discordId: session.discordId }).select('guilds createdAt').lean();
        const guildIds = (user?.guilds || []).map((g) => String(g.id)).filter(Boolean);
        const [events, tickets, aiRequests] = await Promise.all([
            PlatformEvent_1.default.countDocuments({ userId: session.discordId }),
            PlatformEvent_1.default.countDocuments({ userId: session.discordId, type: 'ticket_created' }),
            PlatformEvent_1.default.countDocuments({ userId: session.discordId, type: 'ai_request' }),
        ]);
        return res.json({ success: true, statistics: {
                servers: guildIds.length,
                events,
                tickets,
                aiRequests,
                memberSince: user?.createdAt || null,
            } });
    }
    catch (error) {
        console.error('[Account API] statistics', error);
        return res.status(500).json({ success: false, error: 'Impossible de charger vos statistiques.' });
    }
});
/*
 * =========================================================
 * GUILD API
 * =========================================================
 */
app.use('/api/guilds', guild_routes_1.default);
/*
 * =========================================================
 * STATS API
 * =========================================================
 */
app.use('/api', stats_routes_1.default);
/*
 * =========================================================
 * ADMIN API
 * =========================================================
 */
app.use('/api/admin', auth_1.isAuthenticated, admin_routes_1.default);
app.use('/api/admin', audit_routes_1.default);
app.use('/api/email', email_routes_1.default);
app.use('/api/partners', partner_routes_1.default);
app.use('/api/support', support_routes_1.default);
/*
 * =========================================================
 * PRICING API
 * =========================================================
 */
app.use('/api/pricing', pricing_routes_1.default);
/*
 * =========================================================
 * AI DEV API
 * =========================================================
 *
 * IMPORTANT FIX
 *
 * L'API AI-DEV utilise le même middleware
 * d'authentification que le reste d'OMNIX.
 *
 * Cookie :
 *
 *     jwt_token
 *
 * =========================================================
 */
app.use('/api/ai-dev', ai_dev_routes_1.default);
app.use('/api/referrals', referral_routes_1.default);
app.use('/referral', referral_routes_1.default);
/*
 * =========================================================
 * ADDITIONAL API ROUTES
 * =========================================================
 */
app.use('/api/guilds', backup_routes_1.default);
app.use('/api/guilds', guildConfig_routes_1.default);
app.use('/api/payments', payment_routes_1.default);
app.use('/api/licenses', license_routes_1.default);
/*
 * =========================================================
 * HOME
 * =========================================================
 */
app.get('/', (req, res) => {
    const view = findView('index');
    if (!view) {
        return res
            .status(500)
            .send('La page d’accueil OMNIX est introuvable.');
    }
    try {
        return res.render('index');
    }
    catch (error) {
        console.error('[Web] Erreur rendu / :', error);
        return res
            .status(500)
            .send('Erreur lors du chargement de la page.');
    }
});
/*
 * =========================================================
 * DASHBOARD
 * =========================================================
 */
app.get('/dashboard', requireAuthentication, async (req, res) => {
    try {
        const view = findView('dashboard');
        if (!view) {
            return res
                .status(500)
                .send('La page Dashboard OMNIX est introuvable.');
        }
        const user = req.user;
        console.log(`[Web] GET /dashboard | user=${user?.discordId ?? 'unknown'}`);
        return res.render('dashboard', {
            user,
        });
    }
    catch (error) {
        console.error('[Web] Erreur rendu /dashboard :', error);
        return res
            .status(500)
            .send('Erreur lors du chargement du Dashboard OMNIX.');
    }
});
/*
 * =========================================================
 * DASHBOARD — GUILD
 * =========================================================
 */
app.get('/dashboard/:guildId', requireAuthentication, requireGuildAccess, (req, res) => {
    try {
        const view = findView('manage');
        if (!view) {
            return res
                .status(500)
                .send('La page de gestion OMNIX est introuvable.');
        }
        const user = req.user;
        const guildId = String(req.params.guildId);
        const guild = req.guild;
        console.log(`[Web] GET /dashboard/${guildId} | user=${user?.discordId ?? 'unknown'}`);
        return res.render('manage', {
            user,
            guildId,
            guild,
        });
    }
    catch (error) {
        console.error('[Web] Erreur dashboard guild :', error);
        return res
            .status(500)
            .send('Erreur lors du chargement de la configuration serveur.');
    }
});
/*
 * =========================================================
 * MON ESPACE
 * =========================================================
 *
 * OMNIX peut utiliser plusieurs noms de route
 * côté frontend.
 *
 * Toutes ces routes utilisent maintenant
 * le même système de session.
 *
 * =========================================================
 */
const renderAccountPage = (req, res) => {
    const viewCandidates = [
        'account',
        'mon-espace',
        'my-space',
        'profile',
    ];
    let viewName = null;
    for (const candidate of viewCandidates) {
        if (findView(candidate)) {
            viewName =
                candidate;
            break;
        }
    }
    /*
     * Si aucune vue spécifique n'existe,
     * on utilise le dashboard.
     *
     * Cela évite le retour silencieux vers "/".
     */
    if (!viewName) {
        viewName =
            'dashboard';
    }
    try {
        const user = req.user;
        const routePath = String(req.path || '').replace(/\/+$/, '') || '/';
        const page = routePath === '/servers'
            ? 'servers'
            : routePath === '/activity'
                ? 'activity'
                : routePath === '/statistics'
                    ? 'statistics'
                    : 'profile';
        return res.render(viewName, {
            user,
            page,
        });
    }
    catch (error) {
        console.error('[Web] Erreur Mon Espace :', error);
        return res
            .status(500)
            .send('Erreur lors du chargement de votre espace OMNIX.');
    }
};
/*
 * Plusieurs aliases sont volontairement
 * supportés pour ne pas casser le frontend.
 */
app.get('/mon-espace', requireAuthentication, renderAccountPage);
app.get('/my-space', requireAuthentication, renderAccountPage);
app.get('/account', requireAuthentication, renderAccountPage);
app.get('/profile', requireAuthentication, renderAccountPage);
app.get('/servers', requireAuthentication, renderAccountPage);
app.get('/activity', requireAuthentication, renderAccountPage);
app.get('/statistics', requireAuthentication, renderAccountPage);
/*
 * =========================================================
 * PREMIUM
 * =========================================================
 */
app.get('/premium', (req, res) => {
    const view = findView('premium');
    if (!view)
        return res.redirect('/pricing');
    return res.render('premium');
});
/*
 * =========================================================
 * PRICING
 * =========================================================
 */
app.get('/pricing', (req, res) => {
    const view = findView('pricing');
    if (!view) {
        return res
            .status(404)
            .send('Page Pricing indisponible.');
    }
    return res.render('pricing');
});
/*
 * =========================================================
 * SUPPORT
 * =========================================================
 */
app.get('/support', (req, res) => {
    const view = findView('support');
    if (!view)
        return res.redirect('/learn-more');
    return res.render('support');
});
/*
 * =========================================================
 * FOUNDER
 * =========================================================
 */
app.get('/founder', (req, res) => {
    const view = findView('founder');
    if (!view) {
        return res
            .status(404)
            .send('Page Founder indisponible.');
    }
    return res.render('founder', {
        founder: {
            name: 'OMNIX',
            description: 'Créateur et développeur de la plateforme OMNIX.',
            officialServer: 'https://discord.gg/naBuatEBJ5',
        },
    });
});
/*
 * =========================================================
 * LEARN MORE
 * =========================================================
 */
app.get('/learn-more', (req, res) => {
    const view = findView('learn-more');
    if (!view) {
        return res
            .status(404)
            .send('Page indisponible.');
    }
    return res.render('learn-more');
});
/*
 * =========================================================
 * REFERRAL PAGE
 * =========================================================
 */
app.get('/referral', requireAuthentication, async (req, res) => {
    const view = findView('referral');
    if (!view)
        return res.status(404).send('Programme de parrainage indisponible.');
    return res.render('referral', { user: req.user });
});
/*
 * =========================================================
 * AI DEV PAGE
 * =========================================================
 *
 * La page elle-même reste accessible.
 *
 * Les appels à :
 *
 *     /api/ai-dev/*
 *
 * sont protégés séparément.
 *
 * =========================================================
 */
app.get('/ai-dev', requireAuthentication, (req, res, next) => {
    const user = req.user;
    if (!user?.discordId || !(0, auth_routes_1.isOwner)(String(user.discordId))) {
        return res.status(403).send('Cette console est réservée au propriétaire d’OMNIX.');
    }
    return next();
}, (req, res) => {
    const view = findView('ai-dev');
    if (!view) {
        return res
            .status(404)
            .send('La page AI Dev n’est pas disponible sur cette version d’OMNIX.');
    }
    try {
        const user = req.user;
        return res.render('ai-dev', {
            user,
        });
    }
    catch (error) {
        console.error('[Web] Erreur /ai-dev :', error);
        return res
            .status(500)
            .send('Erreur lors du chargement de AI Dev.');
    }
});
/*
 * =========================================================
 * PARTNERS PAGE
 * =========================================================
 */
app.get(['/partners', '/partenaires'], (_req, res) => {
    const view = findView('partenaires');
    if (!view)
        return res.status(404).send('Page Partenaires indisponible.');
    return res.render('partenaires');
});
app.get('/partenaires/:partnerId/pub', async (req, res) => {
    try {
        const { default: Partner } = await Promise.resolve().then(() => __importStar(require('../models/Partner')));
        const partner = await Partner.findById(String(req.params.partnerId)).lean();
        if (!partner || !partner.adEnabled || (partner.adExpiresAt && new Date(partner.adExpiresAt).getTime() <= Date.now())) {
            return res.status(404).send('Publicité partenaire indisponible.');
        }
        const view = findView('partner-ad');
        if (!view)
            return res.status(404).send('Page de publicité indisponible.');
        return res.render('partner-ad', { partner });
    }
    catch (error) {
        console.error('[Web] Erreur publicité partenaire:', error);
        return res.status(500).send('Impossible de charger cette publicité.');
    }
});
/*
 * =========================================================
 * SUSPENDED / BLACKLIST
 * =========================================================
 */
app.get('/suspended', (req, res) => {
    const view = findView('suspended');
    if (!view)
        return res.status(404).send('Compte suspendu.');
    return res.render('suspended');
});
/*
 * =========================================================
 * OMNIX IA — PAGE PRIVÉE DEPUIS L'ESPACE ADMIN
 * =========================================================
 */
app.get('/admin/omnix-ia', requireAuthentication, (req, res) => {
    const user = req.user;
    if (!user?.discordId || !(0, auth_routes_1.isOwner)(String(user.discordId))) {
        return res.status(403).send('Omnix IA est réservé au propriétaire du projet.');
    }
    const view = findView('admin-omnix-ia');
    if (!view)
        return res.status(404).send('La page Omnix IA est introuvable.');
    return res.render('admin-omnix-ia', { user });
});
/*
 * =========================================================
 * ADMIN PAGE
 * =========================================================
 */
app.get('/admin', requireAuthentication, async (req, res) => {
    const user = req.user;
    const dbUser = user?.discordId ? await User_1.User.findOne({ discordId: String(user.discordId) }).select('isAdmin role isBlacklisted').lean().catch(() => null) : null;
    const owner = Boolean(user?.discordId && (0, auth_routes_1.isOwner)(String(user.discordId)));
    const admin = owner || Boolean(dbUser?.isAdmin) || ['support', 'moderator', 'admin', 'super_admin', 'owner'].includes(String(dbUser?.role || ''));
    if (!user || !admin || dbUser?.isBlacklisted) {
        return res.status(dbUser?.isBlacklisted ? 403 : 403).send(dbUser?.isBlacklisted ? 'Compte OMNIX suspendu.' : 'Accès administrateur refusé.');
    }
    const view = findView('admin');
    if (!view) {
        return res
            .status(404)
            .send('Page Admin indisponible.');
    }
    try {
        return res.render('admin', {
            user,
            staffRole: owner ? 'owner' : String(dbUser?.role || (dbUser?.isAdmin ? 'admin' : 'user')),
        });
    }
    catch (error) {
        console.error('[Web] Erreur /admin :', error);
        return res
            .status(500)
            .send('Erreur lors du chargement du panneau Admin.');
    }
});
/* =========================================================
   CONNEXION
========================================================= */
app.get('/connexion', (req, res) => {
    // Résolution explicite du fichier afin de fonctionner aussi lorsque
    // le dossier de vues configuré par l'hébergeur pointe ailleurs.
    const viewPath = findView('connexion');
    if (!viewPath) {
        console.error('[Web] Vue connexion.ejs introuvable.');
        return res.status(404).render('404');
    }
    return res.render(viewPath, { error: typeof req.query.error === 'string' ? req.query.error : '' });
});
// Alias pratique : /login ouvre toujours la page publique de connexion.
app.get('/login', (_req, res) => {
    return res.redirect(302, '/connexion');
});
/* =========================================================
   LEGAL / PUBLIC PAGES
========================================================= */
for (const [route, view] of [['/cgv', 'cgv'], ['/confidentialite', 'confidentialite'], ['/cookies', 'cookies'], ['/contact', 'contact'], ['/mentions-legales', 'mentions-legales']]) {
    app.get(route, (_req, res) => {
        if (!findView(view))
            return res.status(404).render('404');
        return res.render(view);
    });
}
/*
 * =========================================================
 * API 404
 * =========================================================
 */
app.use('/api', (req, res) => {
    console.warn(`[API] 404 : ${req.method} ${req.originalUrl}`);
    return res
        .status(404)
        .json({
        success: false,
        error: 'Route API introuvable.',
        path: req.originalUrl,
    });
});
/*
 * =========================================================
 * WEB 404
 * =========================================================
 */
app.use((req, res) => {
    /*
     * Assets inconnus.
     */
    if (req.path.startsWith('/assets/') ||
        req.path.endsWith('.png') ||
        req.path.endsWith('.jpg') ||
        req.path.endsWith('.jpeg') ||
        req.path.endsWith('.webp') ||
        req.path.endsWith('.svg') ||
        req.path.endsWith('.ico')) {
        return res
            .status(404)
            .send();
    }
    console.warn(`[Web] 404 : ${req.method} ${req.originalUrl}`);
    const errorView = findView('404');
    if (!errorView) {
        return res
            .status(404)
            .send('Page introuvable.');
    }
    try {
        return res
            .status(404)
            .render('404');
    }
    catch {
        return res
            .status(404)
            .send('Page introuvable.');
    }
});
/*
 * =========================================================
 * GLOBAL ERROR HANDLER
 * =========================================================
 */
app.use((error, req, res, next) => {
    console.error('[Web] Erreur globale :', error);
    if (res.headersSent) {
        return next(error);
    }
    if (req.path.startsWith('/api')) {
        return res
            .status(500)
            .json({
            success: false,
            error: 'Erreur interne du serveur.',
        });
    }
    return res
        .status(500)
        .send('Erreur interne du serveur.');
});
/*
 * =========================================================
 * EXPORT
 * =========================================================
 */
exports.default = app;
function createApp() {
    return app;
}
