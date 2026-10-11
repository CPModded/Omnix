"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SESSION_COOKIE = void 0;
exports.refreshDiscordAccessToken = refreshDiscordAccessToken;
exports.getOwnerIds = getOwnerIds;
exports.isOwner = isOwner;
exports.createJwt = createJwt;
exports.verifyJwt = verifyJwt;
exports.getSessionCookieOptions = getSessionCookieOptions;
exports.getOAuthStateCookieOptions = getOAuthStateCookieOptions;
exports.extractBearerToken = extractBearerToken;
exports.getRequestToken = getRequestToken;
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = require("../../models/User");
const License_1 = require("../../models/License");
const index_1 = require("../../config/index");
const platformEvents_1 = require("../../services/platformEvents");
/*
 * =========================================================
 * OMNIX — AUTH ROUTES
 * =========================================================
 *
 * AUTHENTICATION FLOW
 *
 * Discord
 *   ↓
 * /api/auth/login
 *   ↓
 * Discord OAuth
 *   ↓
 * /api/auth/callback
 *   ↓
 * Discord user
 *   ↓
 * MongoDB
 *   ↓
 * JWT
 *   ↓
 * httpOnly cookie : jwt_token
 *   ↓
 * /dashboard
 *   ↓
 * /api/auth/me
 *
 * IMPORTANT :
 *
 * - Aucun JWT dans l'URL.
 * - Aucun localStorage JWT.
 * - Une seule session officielle :
 *
 *      jwt_token
 *
 * =========================================================
 */
const router = express_1.default.Router();
function databaseReady() {
    // Mongoose readyState 1 = connected. OAuth account creation requires
    // persistence, so do not pretend login succeeded while MongoDB is down.
    return mongoose_1.default.connection.readyState === 1;
}
function authServiceUnavailable(res, message = 'Le service de connexion est temporairement indisponible.') {
    return res.status(503).send(`<!doctype html><html lang=\"fr\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>OMNIX — Service temporairement indisponible</title><link rel=\"stylesheet\" href=\"/css/omnix-web.css\"></head><body class=\"omnix-public\"><main class=\"omnix-state-card\"><span class=\"omnix-kicker\">OMNIX · CONNEXION</span><h1>Connexion temporairement indisponible</h1><p>${message}</p><div class=\"omnix-state-actions\"><a class=\"omnix-btn primary\" href=\"/connexion\">Retour à la connexion</a><a class=\"omnix-btn\" href=\"/health\">État du service</a></div></main></body></html>`);
}
/*
 * =========================================================
 * CONSTANTES
 * =========================================================
 */
const DISCORD_API = 'https://discord.com/api/v10';
const DISCORD_OAUTH_AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const DISCORD_OAUTH_TOKEN_URL = 'https://discord.com/api/oauth2/token';
const GOOGLE_OAUTH_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const GOOGLE_STATE_COOKIE = 'omnix_google_oauth_state';
exports.SESSION_COOKIE = 'jwt_token';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const OAUTH_STATE_COOKIE = 'omnix_oauth_state';
const OAUTH_STATE_MAX_AGE = 10 * 60 * 1000;
// Déploiement public officiel d'OMNIX. En production Render, les callbacks
// OAuth doivent rester strictement sur ce domaine sauf si un domaine public
// personnalisé est explicitement configuré via CLIENT_URL.
const OMNIX_PUBLIC_URL = 'https://omnix-1.onrender.com';
function getPublicBaseUrl() {
    const configured = String(process.env.CLIENT_URL || index_1.CONFIG?.CLIENT_URL || '').trim().replace(/\/$/, '');
    if (!configured || /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured)) {
        return OMNIX_PUBLIC_URL;
    }
    return configured;
}
function getGoogleRedirectUri() {
    // On privilégie l'URL canonique Render si aucune URL explicite n'est fournie.
    const configured = String(process.env.GOOGLE_REDIRECT_URI || '').trim();
    if (configured && !configured.includes('your-domain.example'))
        return configured;
    return `${getPublicBaseUrl()}/api/auth/google/callback`;
}
function getDiscordPublicRedirectUri() {
    const configured = String(process.env.DISCORD_REDIRECT_URI || '').trim();
    if (configured && !configured.includes('your-domain.example'))
        return configured;
    return `${getPublicBaseUrl()}/api/auth/callback`;
}
/**
 * Rafraîchit un access token Discord OAuth expiré.
 * Le refresh token reste strictement côté serveur.
 */
async function refreshDiscordAccessToken(userId) {
    const user = await User_1.User.findOne({ discordId: String(userId) }).select('+accessToken +refreshToken');
    if (!user)
        return null;
    const current = String(user.accessToken || '').trim();
    const expiresAt = user.tokenExpiresAt ? new Date(user.tokenExpiresAt).getTime() : 0;
    if (current && expiresAt > Date.now() + 60_000)
        return current;
    const refreshToken = String(user.refreshToken || '').trim();
    const clientId = getDiscordClientId();
    const clientSecret = getDiscordClientSecret();
    if (!refreshToken || !clientId || !clientSecret)
        return current || null;
    try {
        const response = await axios_1.default.post(DISCORD_OAUTH_TOKEN_URL, new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 });
        const nextAccess = String(response.data?.access_token || '').trim();
        if (!nextAccess)
            return null;
        user.accessToken = nextAccess;
        if (response.data?.refresh_token)
            user.refreshToken = response.data.refresh_token;
        if (response.data?.expires_in)
            user.tokenExpiresAt = new Date(Date.now() + Number(response.data.expires_in) * 1000);
        await user.save();
        return nextAccess;
    }
    catch (error) {
        console.warn('[OAuth] Impossible de rafraîchir le token Discord.', error?.response?.data || error?.message || error);
        return null;
    }
}
function hasDiscordAdminPermission(guild) {
    if (guild?.owner === true || guild?.owner === 'true')
        return true;
    const raw = guild?.permissions ?? guild?.permission ?? '0';
    try {
        return (BigInt(String(raw)) & 0x8n) === 0x8n;
    }
    catch {
        return false;
    }
}
/*
 * =========================================================
 * CONFIGURATION DISCORD
 * =========================================================
 */
function getDiscordClientId() {
    const value = process.env.DISCORD_CLIENT_ID ||
        index_1.CONFIG?.DISCORD?.CLIENT_ID;
    if (!value) {
        return null;
    }
    return String(value).trim() || null;
}
function getDiscordClientSecret() {
    const value = process.env.DISCORD_CLIENT_SECRET ||
        index_1.CONFIG?.DISCORD?.CLIENT_SECRET;
    if (!value) {
        return null;
    }
    return String(value).trim() || null;
}
function getDiscordRedirectUri(req) {
    const configured = String(process.env.DISCORD_REDIRECT_URI || index_1.CONFIG?.DISCORD?.REDIRECT_URI || '').trim();
    if (configured && !configured.includes('your-domain.example'))
        return configured;
    if (req) {
        const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
        const host = String(req.get('host') || '').trim();
        // Render peut fournir l'hôte public. Pour omnix-1.onrender.com on garde
        // une URL déterministe afin que Discord reçoive exactement le callback enregistré.
        if (host === 'omnix-1.onrender.com')
            return `${OMNIX_PUBLIC_URL}/api/auth/callback`;
        const protocol = forwardedProto || req.protocol || 'https';
        if (host)
            return `${protocol}://${host}/api/auth/callback`;
    }
    return getDiscordPublicRedirectUri();
}
/*
 * =========================================================
 * OWNER IDS
 * =========================================================
 */
function getOwnerIds() {
    const configOwnerIds = index_1.CONFIG?.OWNER_IDS;
    if (Array.isArray(configOwnerIds)) {
        return configOwnerIds
            .map((id) => String(id).trim())
            .filter(Boolean);
    }
    const environmentOwnerIds = process.env.OWNER_IDS ||
        process.env.OWNER_ID ||
        '';
    return environmentOwnerIds
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
}
/*
 * =========================================================
 * OWNER CHECK
 * =========================================================
 */
function isOwner(discordId) {
    const normalizedId = String(discordId).trim();
    if (!normalizedId) {
        return false;
    }
    return getOwnerIds().includes(normalizedId);
}
/*
 * =========================================================
 * DISCORD IMAGE HELPERS
 * =========================================================
 */
function discordAvatarUrl(discordId, avatar) {
    if (!avatar) {
        return null;
    }
    const value = String(avatar).trim();
    if (!value) {
        return null;
    }
    if (/^https?:\/\//i.test(value)) {
        return value;
    }
    return (`https://cdn.discordapp.com/avatars/` +
        `${discordId}/${value}.png?size=128`);
}
function discordGuildIconUrl(guildId, icon) {
    if (!icon) {
        return null;
    }
    const value = String(icon).trim();
    if (!value) {
        return null;
    }
    if (/^https?:\/\//i.test(value)) {
        return value;
    }
    return (`https://cdn.discordapp.com/icons/` +
        `${guildId}/${value}.png?size=128`);
}
/*
 * =========================================================
 * JWT SECRET
 * =========================================================
 */
function getJwtSecret() {
    const secret = index_1.CONFIG.JWT_SECRET ||
        process.env.JWT_SECRET;
    if (!secret ||
        String(secret).trim().length < 16) {
        throw new Error('JWT_SECRET est manquant ou trop court.');
    }
    return String(secret).trim();
}
/*
 * =========================================================
 * CREATE JWT
 * =========================================================
 */
function createJwt(user, premium = false, admin = false) {
    const owner = isOwner(user.id);
    const payload = {
        discordId: String(user.id),
        username: user.global_name ||
            user.username,
        avatar: user.avatar || null,
        isAdmin: owner || Boolean(admin),
        isOwner: owner,
        isPremium: Boolean(premium),
    };
    return jsonwebtoken_1.default.sign(payload, getJwtSecret(), {
        expiresIn: '7d',
        issuer: 'OMNIX',
        subject: String(user.id),
    });
}
/*
 * =========================================================
 * VERIFY JWT
 * =========================================================
 */
function verifyJwt(token) {
    if (!token ||
        typeof token !== 'string') {
        return null;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, getJwtSecret(), {
            issuer: 'OMNIX',
        });
        if (typeof decoded !== 'object' ||
            decoded === null) {
            return null;
        }
        const payload = decoded;
        if (!payload.discordId) {
            return null;
        }
        return {
            discordId: String(payload.discordId),
            username: String(payload.username || ''),
            avatar: payload.avatar
                ? String(payload.avatar)
                : null,
            isAdmin: Boolean(payload.isAdmin),
            isOwner: Boolean(payload.isOwner),
            isPremium: Boolean(payload.isPremium),
            iat: payload.iat,
            exp: payload.exp,
        };
    }
    catch (error) {
        console.warn('[AUTH] JWT invalide ou expiré.', error instanceof Error
            ? error.message
            : error);
        return null;
    }
}
/*
 * =========================================================
 * COOKIE OPTIONS
 * =========================================================
 */
function getSessionCookieOptions() {
    const isProduction = process.env.NODE_ENV === 'production' ||
        process.env.RENDER === 'true';
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: SESSION_MAX_AGE,
        path: '/',
    };
}
function getOAuthStateCookieOptions() {
    const production = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
    return { httpOnly: true, secure: production, sameSite: 'lax', maxAge: OAUTH_STATE_MAX_AGE, path: '/api/auth' };
}
/*
 * =========================================================
 * TOKEN EXTRACTION
 * =========================================================
 *
 * PRIORITY :
 *
 * 1. Authorization Bearer
 * 2. jwt_token cookie
 *
 * Aucun token URL.
 *
 * =========================================================
 */
function extractBearerToken(req) {
    const authorization = req.headers.authorization;
    if (!authorization ||
        typeof authorization !== 'string') {
        return null;
    }
    if (!authorization
        .toLowerCase()
        .startsWith('bearer ')) {
        return null;
    }
    const token = authorization
        .substring(7)
        .trim();
    return token || null;
}
function getRequestToken(req) {
    const bearer = extractBearerToken(req);
    if (bearer) {
        return bearer;
    }
    const cookieToken = req.cookies?.[exports.SESSION_COOKIE];
    if (typeof cookieToken === 'string' &&
        cookieToken.trim()) {
        return cookieToken.trim();
    }
    return null;
}
/*
 * =========================================================
 * AUTHENTICATED PAYLOAD
 * =========================================================
 */
function getAuthenticatedPayload(req) {
    const token = getRequestToken(req);
    if (!token) {
        return null;
    }
    return verifyJwt(token);
}
/*
 * =========================================================
 * AUTH STATUS
 * =========================================================
 */
router.get('/status', (_req, res) => {
    return res.json({
        success: true,
        database: databaseReady(),
        databaseName: databaseReady() ? mongoose_1.default.connection.name : null,
        discordOAuthConfigured: Boolean(getDiscordClientId() && getDiscordClientSecret()),
        redirectUri: getDiscordPublicRedirectUri(),
        timestamp: new Date().toISOString(),
    });
});
/*
 * =========================================================
 * DISCORD LOGIN
 * =========================================================
 *
 * GET /api/auth/login
 *
 * =========================================================
 */
router.get('/google', (req, res) => {
    const clientId = String(process.env.GOOGLE_CLIENT_ID || index_1.CONFIG?.GOOGLE?.CLIENT_ID || '').trim();
    const redirectUri = getGoogleRedirectUri();
    if (!clientId || !redirectUri)
        return res.status(500).send('Configuration Google OAuth incomplète.');
    const state = node_crypto_1.default.randomBytes(32).toString('hex');
    res.cookie(GOOGLE_STATE_COOKIE, state, getOAuthStateCookieOptions());
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'openid email profile', state, access_type: 'offline', prompt: 'select_account' });
    return res.redirect(`${GOOGLE_OAUTH_AUTHORIZE_URL}?${params.toString()}`);
});
router.get('/google/callback', async (req, res) => {
    try {
        const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
        const returnedState = typeof req.query.state === 'string' ? req.query.state.trim() : '';
        const expectedState = typeof req.cookies?.[GOOGLE_STATE_COOKIE] === 'string' ? req.cookies[GOOGLE_STATE_COOKIE].trim() : '';
        res.clearCookie(GOOGLE_STATE_COOKIE, { ...getOAuthStateCookieOptions(), maxAge: undefined });
        if (!code || !returnedState || !expectedState || returnedState.length !== expectedState.length || !node_crypto_1.default.timingSafeEqual(Buffer.from(returnedState), Buffer.from(expectedState)))
            return res.status(400).send('Session Google OAuth invalide ou expirée.');
        if (!databaseReady())
            return authServiceUnavailable(res, 'La base de données OMNIX ne répond pas. Aucun compte ne sera créé tant que la connexion n’est pas rétablie.');
        const clientId = String(process.env.GOOGLE_CLIENT_ID || index_1.CONFIG?.GOOGLE?.CLIENT_ID || '').trim();
        const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || index_1.CONFIG?.GOOGLE?.CLIENT_SECRET || '').trim();
        const redirectUri = getGoogleRedirectUri();
        if (!clientId || !clientSecret || !redirectUri)
            return res.status(500).send('Configuration Google OAuth incomplète.');
        const token = await axios_1.default.post(GOOGLE_OAUTH_TOKEN_URL, new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 });
        const accessToken = String(token.data?.access_token || '');
        if (!accessToken)
            return res.status(502).send('Google n’a pas retourné de jeton de connexion.');
        const info = await axios_1.default.get(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 15000 });
        const googleUser = info.data || {};
        if (!googleUser.sub || !googleUser.email)
            return res.status(400).send('Compte Google incomplet.');
        let user = await User_1.User.findOne({ $or: [{ googleId: String(googleUser.sub) }, { email: String(googleUser.email).toLowerCase() }] });
        if (user && user.isBlacklisted)
            return res.status(403).send('Ce compte OMNIX est suspendu.');
        if (!user) {
            user = await User_1.User.create({ discordId: `google:${String(googleUser.sub)}`, googleId: String(googleUser.sub), authProvider: 'google', username: String(googleUser.name || googleUser.email.split('@')[0]), globalName: String(googleUser.name || googleUser.email.split('@')[0]), avatar: googleUser.picture || null, email: String(googleUser.email).toLowerCase(), emailVerified: Boolean(googleUser.email_verified), guilds: [], isAdmin: false, role: 'user', isPremium: false, isBlacklisted: false, lastLogin: new Date() });
        }
        else {
            user.googleId = String(googleUser.sub);
            user.authProvider = user.discordId.startsWith('google:') ? 'google' : 'both';
            user.email = String(googleUser.email).toLowerCase();
            user.emailVerified = Boolean(googleUser.email_verified);
            user.avatar = googleUser.picture || user.avatar;
            user.lastLogin = new Date();
            await user.save();
        }
        const premium = Boolean(user.isPremium) || Boolean(await License_1.License.exists({ buyerId: String(user.discordId), status: 'active', $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }));
        const jwtUser = { id: String(user.discordId), username: user.globalName || user.username, global_name: user.globalName || user.username, avatar: null };
        const jwtToken = createJwt(jwtUser, premium, Boolean(user.isAdmin));
        res.cookie(exports.SESSION_COOKIE, jwtToken, getSessionCookieOptions());
        await (0, platformEvents_1.recordPlatformEvent)('user_login', { userId: String(user.discordId), metadata: { provider: 'google' } });
        return res.redirect('/dashboard');
    }
    catch (error) {
        console.error('[OAuth Google] ÉCHEC:', error?.response?.data || error?.message || error);
        return res.status(502).send('Impossible de terminer la connexion Google.');
    }
});
router.get('/login', (req, res) => {
    try {
        const clientId = getDiscordClientId();
        const redirectUri = getDiscordRedirectUri(req);
        if (!clientId) {
            console.error('[OAuth] DISCORD_CLIENT_ID manquant.');
            return res
                .status(500)
                .send('DISCORD_CLIENT_ID est manquant.');
        }
        if (!redirectUri) {
            console.error('[OAuth] DISCORD_REDIRECT_URI manquant.');
            return res
                .status(500)
                .send('DISCORD_REDIRECT_URI est manquant.');
        }
        const state = node_crypto_1.default.randomBytes(32).toString('hex');
        res.cookie(OAUTH_STATE_COOKIE, state, getOAuthStateCookieOptions());
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'identify email guilds',
            state,
        });
        const discordUrl = `${DISCORD_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
        console.log('[OAuth] Démarrage connexion Discord.');
        console.log('[OAuth] Redirect URI:', redirectUri);
        return res.redirect(discordUrl);
    }
    catch (error) {
        console.error('[OAuth] Erreur /login:', error);
        return res
            .status(500)
            .send('Impossible de démarrer la connexion Discord.');
    }
});
/*
 * =========================================================
 * DISCORD CALLBACK
 * =========================================================
 *
 * GET /api/auth/callback
 *
 * =========================================================
 */
router.get('/callback', async (req, res) => {
    try {
        console.log('[OAuth] Callback Discord reçu.');
        /*
         * -----------------------------------------------------
         * OAUTH CODE
         * -----------------------------------------------------
         */
        const code = typeof req.query.code === 'string'
            ? req.query.code.trim()
            : '';
        const oauthError = typeof req.query.error === 'string'
            ? req.query.error
            : '';
        const returnedState = typeof req.query.state === 'string' ? req.query.state.trim() : '';
        const expectedState = typeof req.cookies?.[OAUTH_STATE_COOKIE] === 'string' ? req.cookies[OAUTH_STATE_COOKIE].trim() : '';
        if (!returnedState || !expectedState || returnedState.length !== expectedState.length || !node_crypto_1.default.timingSafeEqual(Buffer.from(returnedState), Buffer.from(expectedState))) {
            res.clearCookie(OAUTH_STATE_COOKIE, { ...getOAuthStateCookieOptions(), maxAge: undefined });
            return res.status(400).send('Session OAuth invalide ou expirée.');
        }
        res.clearCookie(OAUTH_STATE_COOKIE, { ...getOAuthStateCookieOptions(), maxAge: undefined });
        if (oauthError) {
            console.error('[OAuth] Discord a refusé la connexion:', oauthError);
            return res
                .status(400)
                .send(`Connexion Discord refusée : ${oauthError}`);
        }
        if (!code) {
            console.error('[OAuth] Aucun code OAuth reçu.', {
                queryKeys: Object.keys(req.query),
            });
            return res
                .status(400)
                .send('Code OAuth Discord manquant.');
        }
        /*
         * -----------------------------------------------------
         * CONFIGURATION
         * -----------------------------------------------------
         */
        const clientId = getDiscordClientId();
        const clientSecret = getDiscordClientSecret();
        const redirectUri = getDiscordRedirectUri(req);
        console.log('[OAuth] Callback configuration:', {
            clientId: Boolean(clientId),
            clientSecret: Boolean(clientSecret),
            redirectUri,
            host: req.get('host'),
            forwardedProto: req.headers['x-forwarded-proto'],
        });
        if (!clientId ||
            !clientSecret ||
            !redirectUri) {
            console.error('[OAuth] Configuration Discord incomplète.', {
                clientId: Boolean(clientId),
                clientSecret: Boolean(clientSecret),
                redirectUri: Boolean(redirectUri),
            });
            return res
                .status(500)
                .send('Configuration OAuth Discord incomplète.');
        }
        console.log('[OAuth] Configuration Discord OK.');
        /*
         * -----------------------------------------------------
         * CODE → ACCESS TOKEN
         * -----------------------------------------------------
         */
        let tokenResponse;
        try {
            tokenResponse =
                await axios_1.default.post(DISCORD_OAUTH_TOKEN_URL, new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: redirectUri,
                }).toString(), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    timeout: 15000,
                });
        }
        catch (error) {
            console.error('[OAuth] Échec échange code → token.', {
                status: error?.response?.status,
                data: error?.response?.data,
                message: error?.message,
            });
            throw new Error('Échange du code OAuth Discord impossible.');
        }
        const accessToken = tokenResponse.data?.access_token;
        if (!accessToken) {
            throw new Error('Discord n’a pas retourné d’access_token.');
        }
        console.log('[OAuth] Access token Discord obtenu.');
        /*
         * -----------------------------------------------------
         * DISCORD USER
         * -----------------------------------------------------
         */
        let userResponse;
        try {
            userResponse =
                await axios_1.default.get(`${DISCORD_API}/users/@me`, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                    timeout: 15000,
                });
        }
        catch (error) {
            console.error('[OAuth] Impossible de récupérer /users/@me.', {
                status: error?.response?.status,
                data: error?.response?.data,
                message: error?.message,
            });
            throw new Error('Impossible de récupérer le compte Discord.');
        }
        const discordUser = userResponse.data;
        if (!discordUser?.id) {
            throw new Error('Discord a retourné un utilisateur invalide.');
        }
        console.log('[OAuth] Utilisateur Discord:', {
            id: discordUser.id,
            username: discordUser.username,
        });
        /*
         * -----------------------------------------------------
         * DISCORD GUILDS
         * -----------------------------------------------------
         */
        let guilds = [];
        try {
            const guildResponse = await axios_1.default.get(`${DISCORD_API}/users/@me/guilds`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                timeout: 15000,
            });
            guilds =
                Array.isArray(guildResponse.data)
                    ? guildResponse.data
                    : [];
            console.log(`[OAuth] ${guilds.length} serveur(s) Discord récupéré(s).`);
        }
        catch (error) {
            console.error('[OAuth] Impossible de récupérer les guilds.', {
                status: error?.response?.status,
                data: error?.response?.data,
                message: error?.message,
            });
            /*
             * Ne bloque pas l'authentification.
             */
            guilds = [];
        }
        /*
         * -----------------------------------------------------
         * SERVEURS ADMINISTRABLES
         * -----------------------------------------------------
         */
        const manageableGuilds = guilds.filter(hasDiscordAdminPermission);
        /*
         * -----------------------------------------------------
         * NORMALISATION GUILDS
         * -----------------------------------------------------
         */
        const guildData = manageableGuilds.map((guild) => ({
            id: String(guild.id),
            name: String(guild.name),
            icon: guild.icon || null,
            owner: Boolean(guild.owner),
            permissions: guild.permissions ||
                '0',
            memberCount: Number(globalThis.omnixDiscordClient?.guilds?.cache?.get?.(guild.id)?.memberCount ?? 0),
            features: Array.isArray(guild.features) ? guild.features : [],
        }));
        /*
         * -----------------------------------------------------
         * OWNER
         * -----------------------------------------------------
         */
        const owner = isOwner(discordUser.id);
        console.log('[OAuth] Permissions OMNIX:', {
            discordId: discordUser.id,
            owner,
            manageableGuilds: guildData.length,
            configuredOwners: getOwnerIds().length,
        });
        /*
         * -----------------------------------------------------
         * EXISTING USER
         * -----------------------------------------------------
         */
        if (!databaseReady()) {
            return authServiceUnavailable(res, 'La base de données OMNIX ne répond pas. La connexion Discord a bien été reçue, mais le compte ne peut pas être enregistré pour le moment.');
        }
        const existingUser = await User_1.User.findOne({
            discordId: discordUser.id,
        });
        /*
         * -----------------------------------------------------
         * PREMIUM
         * -----------------------------------------------------
         */
        if (existingUser && existingUser.isBlacklisted === true) {
            return res.status(403).send('Ce compte OMNIX est suspendu.');
        }
        const personalLicense = await License_1.License.findOne({ buyerId: discordUser.id, status: 'active', $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }).lean();
        const isPremium = Boolean(existingUser && existingUser.isPremium === true) || Boolean(personalLicense);
        /*
         * -----------------------------------------------------
         * DATABASE UPSERT
         * -----------------------------------------------------
         */
        const updatedUser = await User_1.User.findOneAndUpdate({
            discordId: discordUser.id,
        }, {
            $set: {
                discordId: discordUser.id,
                username: discordUser.username,
                globalName: discordUser.global_name ||
                    discordUser.username,
                avatar: discordUser.avatar ||
                    null,
                email: discordUser.email || null,
                emailVerified: Boolean(discordUser.verified),
                // Le token OAuth reste côté serveur (select:false) afin de
                // pouvoir rafraîchir la liste des serveurs sans exposer le token.
                accessToken,
                refreshToken: tokenResponse.data?.refresh_token || undefined,
                tokenExpiresAt: tokenResponse.data?.expires_in
                    ? new Date(Date.now() + Number(tokenResponse.data.expires_in) * 1000)
                    : undefined,
                guilds: guildData,
                isPremium,
                isAdmin: owner || Boolean(existingUser && existingUser.isAdmin),
                role: owner ? 'owner' : existingUser?.role || (existingUser?.isAdmin ? 'admin' : 'user'),
                lastLogin: new Date(),
            },
        }, {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
        });
        if (!updatedUser) {
            throw new Error('Impossible d’enregistrer l’utilisateur OMNIX.');
        }
        await (0, platformEvents_1.recordPlatformEvent)(existingUser ? 'user_login' : 'user_registered', { userId: discordUser.id });
        console.log('[OAuth] Utilisateur MongoDB synchronisé.', {
            discordId: discordUser.id,
        });
        /*
         * -----------------------------------------------------
         * JWT
         * -----------------------------------------------------
         */
        const token = createJwt(discordUser, isPremium, Boolean(existingUser && existingUser.isAdmin));
        console.log('[OAuth] JWT OMNIX généré.');
        /*
         * -----------------------------------------------------
         * COOKIE
         * -----------------------------------------------------
         */
        const cookieOptions = getSessionCookieOptions();
        res.cookie(exports.SESSION_COOKIE, token, cookieOptions);
        console.log('[OAuth] Cookie de session créé.', {
            cookie: exports.SESSION_COOKIE,
            httpOnly: cookieOptions.httpOnly,
            secure: cookieOptions.secure,
            sameSite: cookieOptions.sameSite,
            path: cookieOptions.path,
            maxAge: cookieOptions.maxAge,
        });
        /*
         * -----------------------------------------------------
         * REDIRECT
         * -----------------------------------------------------
         *
         * IMPORTANT :
         *
         * Aucun JWT dans l'URL.
         *
         * /dashboard
         *
         * uniquement.
         *
         * -----------------------------------------------------
         */
        console.log('[OAuth] Connexion Discord réussie.', {
            discordId: discordUser.id,
            username: discordUser.username,
            owner,
            premium: isPremium,
            guilds: guildData.length,
        });
        console.log('[OAuth] Redirection vers /dashboard.');
        return res.redirect(302, '/dashboard');
    }
    catch (error) {
        console.error('[OAuth Discord] ÉCHEC COMPLET.', {
            message: error?.message,
            status: error?.response?.status,
            discord: error?.response?.data,
        });
        const isDbError = !databaseReady() || /Mongo|buffering timed out|ECONN|authentication failed/i.test(String(error?.message || ''));
        const message = isDbError
            ? 'La base de données OMNIX est temporairement indisponible. Aucun compte n’a été perdu.'
            : 'La connexion Discord n’a pas pu être terminée. Réessaie dans quelques instants.';
        return res.redirect(`/connexion?error=${encodeURIComponent(message)}`);
    }
});
/*
 * =========================================================
 * CURRENT USER
 * =========================================================
 *
 * GET /api/auth/me
 *
 * C'EST CETTE ROUTE QUE LE DASHBOARD UTILISE
 * POUR SAVOIR SI LA SESSION EXISTE.
 *
 * =========================================================
 */
router.get('/me', async (req, res) => {
    try {
        if (!databaseReady()) {
            return res.status(503).json({ success: false, authenticated: false, error: 'Base de données temporairement indisponible.', code: 'DB_UNAVAILABLE' });
        }
        console.log('[AUTH /me] Vérification session.');
        const token = getRequestToken(req);
        console.log('[AUTH /me] Cookie jwt_token:', token
            ? 'PRÉSENT'
            : 'ABSENT');
        if (!token) {
            console.warn('[AUTH /me] Aucune session.');
            return res
                .status(401)
                .json({
                success: false,
                authenticated: false,
                error: 'Utilisateur non connecté.',
            });
        }
        const payload = verifyJwt(token);
        if (!payload) {
            console.warn('[AUTH /me] JWT invalide ou expiré.');
            /*
             * Nettoyage du cookie invalide.
             */
            res.clearCookie(exports.SESSION_COOKIE, {
                ...getSessionCookieOptions(),
                maxAge: undefined,
            });
            return res
                .status(401)
                .json({
                success: false,
                authenticated: false,
                error: 'Session invalide ou expirée.',
            });
        }
        console.log('[AUTH /me] JWT valide.', {
            discordId: payload.discordId,
            username: payload.username,
            owner: payload.isOwner,
        });
        let user = await User_1.User.findOne({
            discordId: payload.discordId,
        }).lean();
        /*
         * Session JWT valide mais compte MongoDB absent :
         * on répare automatiquement le compte minimal depuis
         * les informations non sensibles déjà présentes dans le JWT.
         * Cela évite le 404/401 en cascade sur Dashboard et AI DEV
         * après une restauration ou un nettoyage de base.
         */
        if (!user) {
            const owner = isOwner(String(payload.discordId));
            const repaired = await User_1.User.findOneAndUpdate({ discordId: String(payload.discordId) }, {
                $setOnInsert: {
                    discordId: String(payload.discordId),
                    username: String(payload.username || 'Utilisateur Discord'),
                    globalName: String(payload.username || 'Utilisateur Discord'),
                    avatar: null,
                    guilds: [],
                    isPremium: false,
                    isAdmin: owner,
                    role: owner ? 'owner' : 'user',
                    permissions: [],
                },
                $set: { lastLogin: new Date() },
            }, { new: true, upsert: true, setDefaultsOnInsert: true }).lean();
            user = repaired;
            console.warn('[AUTH /me] Compte MongoDB réparé automatiquement.', { discordId: payload.discordId });
        }
        if (user.isBlacklisted === true) {
            res.clearCookie(exports.SESSION_COOKIE, { ...getSessionCookieOptions(), maxAge: undefined });
            return res.status(403).json({ success: false, authenticated: false, error: 'Compte OMNIX suspendu.', code: 'ACCOUNT_BLACKLISTED' });
        }
        /*
         * -----------------------------------------------------
         * OWNER RECALCULÉ
         * -----------------------------------------------------
         *
         * On ne fait pas confiance uniquement
         * à la valeur du JWT.
         *
         * OWNER_IDS reste la source actuelle.
         *
         * -----------------------------------------------------
         */
        const owner = isOwner(String(user.discordId));
        const guilds = Array.isArray(user.guilds)
            ? user.guilds.map((guild) => ({
                id: String(guild?.id || ''),
                name: String(guild?.name || ''),
                icon: discordGuildIconUrl(String(guild?.id || ''), guild?.icon),
                owner: Boolean(guild?.owner),
                permissions: String(guild?.permissions ||
                    '0'),
            }))
            : [];
        // Une licence devient `used` dès qu'elle est liée à un serveur.
        // Elle doit néanmoins continuer à compter comme Premium après une
        // déconnexion/reconnexion tant qu'elle possède au moins un serveur
        // activé et qu'elle n'est pas expirée.
        const nowForPremium = new Date();
        const activePersonalLicense = await License_1.License.exists({
            buyerId: String(user.discordId),
            status: { $in: ['active', 'used'] },
            $or: [
                { expiresAt: null },
                { expiresAt: { $gt: nowForPremium } },
            ],
        }).catch(() => null);
        const premiumActive = Boolean(user.isPremium) || Boolean(activePersonalLicense);
        const responseUser = {
            discordId: String(user.discordId),
            username: String(user.username ||
                payload.username ||
                ''),
            email: user.email || null,
            emailVerified: Boolean(user.emailVerified),
            globalName: String(user.globalName ||
                user.username ||
                payload.username ||
                ''),
            avatar: discordAvatarUrl(String(user.discordId), user.avatar),
            isAdmin: owner ||
                Boolean(user.isAdmin),
            isOwner: owner,
            isPremium: premiumActive,
            plan: premiumActive ? 'premium' : 'free',
            role: owner ? 'owner' : String(user.role || (user.isAdmin ? 'admin' : 'user')),
            permissions: Array.isArray(user.permissions) ? user.permissions : [],
            guilds,
        };
        console.log('[AUTH /me] Session active.', {
            discordId: responseUser.discordId,
            username: responseUser.username,
            owner: responseUser.isOwner,
            premium: responseUser.isPremium,
            guilds: responseUser.guilds.length,
        });
        return res.json({
            success: true,
            authenticated: true,
            user: responseUser,
        });
    }
    catch (error) {
        console.error('[AUTH /me] Erreur interne:', error);
        return res
            .status(500)
            .json({
            success: false,
            authenticated: false,
            error: 'Erreur lors de la vérification de la session.',
        });
    }
});
/*
 * =========================================================
 * CURRENT USER GUILDS
 * =========================================================
 *
 * GET /api/auth/guilds
 *
 * =========================================================
 */
router.get('/guilds', async (req, res) => {
    try {
        if (!databaseReady())
            return res.status(503).json({ success: false, error: 'Base de données temporairement indisponible.', code: 'DB_UNAVAILABLE' });
        const payload = getAuthenticatedPayload(req);
        if (!payload) {
            return res
                .status(401)
                .json({
                success: false,
                authenticated: false,
                error: 'Session inexistante ou invalide.',
            });
        }
        const user = await User_1.User.findOne({
            discordId: payload.discordId,
        }).lean();
        if (!user) {
            return res
                .status(404)
                .json({
                success: false,
                error: 'Utilisateur OMNIX introuvable.',
            });
        }
        const guilds = Array.isArray(user.guilds)
            ? user.guilds.map((guild) => ({
                id: String(guild?.id || ''),
                name: String(guild?.name || ''),
                icon: discordGuildIconUrl(String(guild?.id || ''), guild?.icon),
                owner: Boolean(guild?.owner),
                permissions: String(guild?.permissions ||
                    '0'),
            }))
            : [];
        return res.json({
            success: true,
            guilds,
        });
    }
    catch (error) {
        console.error('[AUTH /guilds]', error);
        return res
            .status(500)
            .json({
            success: false,
            error: 'Impossible de récupérer les serveurs.',
        });
    }
});
/*
 * =========================================================
 * SESSION DEBUG
 * =========================================================
 *
 * GET /api/auth/session
 *
 * Route de diagnostic.
 *
 * Elle ne retourne JAMAIS le JWT.
 *
 * Très utile pour Render/Eternodes.
 *
 * =========================================================
 */
router.get('/session', (req, res) => {
    try {
        const token = getRequestToken(req);
        if (!token) {
            console.log('[AUTH /session] Cookie absent.');
            return res.json({
                success: true,
                authenticated: false,
                cookie: false,
            });
        }
        const payload = verifyJwt(token);
        if (!payload) {
            console.warn('[AUTH /session] Cookie présent mais JWT invalide.');
            return res.json({
                success: true,
                authenticated: false,
                cookie: true,
                valid: false,
            });
        }
        return res.json({
            success: true,
            authenticated: true,
            cookie: true,
            valid: true,
            user: {
                discordId: payload.discordId,
                username: payload.username,
                isOwner: payload.isOwner,
                isAdmin: payload.isAdmin,
                isPremium: payload.isPremium,
            },
        });
    }
    catch (error) {
        console.error('[AUTH /session]', error);
        return res
            .status(500)
            .json({
            success: false,
            error: 'Impossible de diagnostiquer la session.',
        });
    }
});
/*
 * =========================================================
 * LOGOUT
 * =========================================================
 *
 * GET /api/auth/logout
 *
 * =========================================================
 */
router.get('/logout', (_req, res) => {
    try {
        const cookieOptions = getSessionCookieOptions();
        res.clearCookie(exports.SESSION_COOKIE, {
            httpOnly: cookieOptions.httpOnly,
            secure: cookieOptions.secure,
            sameSite: cookieOptions.sameSite,
            path: cookieOptions.path,
        });
        console.log('[AUTH] Déconnexion OMNIX.');
        return res.redirect('/');
    }
    catch (error) {
        console.error('[AUTH /logout]', error);
        return res
            .status(500)
            .json({
            success: false,
            error: 'Impossible de fermer la session.',
        });
    }
});
/*
 * =========================================================
 * EXPORT
 * =========================================================
 */
exports.default = router;
