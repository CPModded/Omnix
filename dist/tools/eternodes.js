"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePteroBaseUrl = normalizePteroBaseUrl;
exports.classifyPteroResponse = classifyPteroResponse;
exports.redactSensitiveText = redactSensitiveText;
exports.serverStatus = serverStatus;
exports.consoleLogs = consoleLogs;
exports.sendPower = sendPower;
exports.deployRestart = deployRestart;
const env_js_1 = require("../config/env.js");
function normalizePteroBaseUrl(raw) {
    const input = String(raw ?? '').trim();
    if (!input)
        throw new Error('PTERO_URL est absent.');
    let url;
    try {
        url = new URL(input);
    }
    catch {
        throw new Error('PTERO_URL invalide : utilise une URL http(s) de base du panel.');
    }
    if (!['http:', 'https:'].includes(url.protocol))
        throw new Error('PTERO_URL doit utiliser HTTP ou HTTPS.');
    if (url.username || url.password)
        throw new Error('PTERO_URL ne doit pas contenir d’identifiants.');
    if (url.search || url.hash)
        throw new Error('PTERO_URL ne doit pas contenir de query string ni de fragment.');
    if (/\/server(?:\/|$)/i.test(url.pathname))
        throw new Error('PTERO_URL doit être la base du panel, pas une page /server/…');
    url.pathname = url.pathname.replace(/\/(?:api(?:\/client)?)\/?$/i, '').replace(/\/$/, '');
    return url.toString().replace(/\/$/, '');
}
function classifyPteroResponse(status, contentType, body) {
    const html = /text\/html/i.test(contentType) || /<!doctype\s+html|<html\b/i.test(body);
    if (html && /cloudflare|just a moment|checking your browser|attention required|cf-ray/i.test(body))
        return 'PTERO_EDGE_CHALLENGE';
    if (status === 401)
        return 'PTERO_AUTH_REJECTED';
    if (status === 403)
        return 'PTERO_PERMISSION_DENIED';
    if (status === 404)
        return 'PTERO_NOT_FOUND';
    if (status === 408 || status === 504)
        return 'PTERO_TIMEOUT';
    if (status >= 500)
        return 'PTERO_UPSTREAM_ERROR';
    return `PTERO_HTTP_${status}`;
}
function redactSensitiveText(value) {
    return String(value ?? '')
        .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s"']+/ig, '$1[MASQUÉ]')
        .replace(/((?:MAMMOUTH_API_KEY|OPENROUTER_API_KEY|DISCORD_TOKEN|DISCORD_BOT_TOKEN|BOT_TOKEN|DISCORD_CLIENT_SECRET|PTERO_API_TOKEN|MCP_API_KEY|GITHUB_TOKEN|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|JWT_SECRET|SMTP_PASSWORD|MYSQL_PASSWORD|MONGODB_URI|MONGO_URI|DATABASE_URL|MYSQL_URL)\s*[:=]\s*)[^\s,;"']+/ig, '$1[MASQUÉ]')
        .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, '[JETON GITHUB MASQUÉ]')
        .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}\b/g, '[JWT MASQUÉ]')
        .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[CLÉ API MASQUÉE]');
}
function headers() {
    if (!env_js_1.env.ptero.url || !env_js_1.env.ptero.token || !env_js_1.env.ptero.server) {
        throw new Error('Configuration Eternodes/Pterodactyl incomplète : PTERO_URL, PTERO_API_TOKEN ou PTERO_SERVER_IDENTIFIER absent.');
    }
    return {
        Authorization: `Bearer ${env_js_1.env.ptero.token}`,
        Accept: 'Application/vnd.pterodactyl.v1+json',
        'Content-Type': 'application/json',
    };
}
async function request(endpoint, init = {}) {
    const base = normalizePteroBaseUrl(env_js_1.env.ptero.url);
    let response;
    try {
        response = await fetch(`${base}${endpoint}`, {
            ...init,
            headers: { ...headers(), ...(init.headers ?? {}) },
            signal: init.signal ?? AbortSignal.timeout(15_000),
        });
    }
    catch (error) {
        if (error?.name === 'TimeoutError' || error?.name === 'AbortError')
            throw new Error('PTERO_TIMEOUT : délai dépassé pendant la requête au panel.');
        throw new Error(`PTERO_NETWORK_ERROR : impossible de joindre le panel (${redactSensitiveText(error?.message || 'erreur réseau')}).`);
    }
    const text = await response.text();
    if (!response.ok) {
        const kind = classifyPteroResponse(response.status, response.headers.get('content-type') || '', text);
        if (kind === 'PTERO_EDGE_CHALLENGE')
            throw new Error(`${kind} : le panel a renvoyé une page HTML de protection Cloudflare au lieu de l’API JSON. Cela ne prouve pas que le jeton est invalide. Demande à Eternodes l’URL officielle d’API/une route autorisée ; ne désactive pas la protection.`);
        if (kind === 'PTERO_AUTH_REJECTED')
            throw new Error(`${kind} : le panel a rejeté l’authentification (HTTP 401). Vérifie le jeton API côté Eternodes sans le partager.`);
        if (kind === 'PTERO_PERMISSION_DENIED')
            throw new Error(`${kind} : l’API a refusé cette action (HTTP 403). Vérifie les permissions du jeton et l’accès à ce serveur.`);
        if (kind === 'PTERO_NOT_FOUND')
            throw new Error(`${kind} : endpoint ou identifiant de serveur introuvable (HTTP 404). Vérifie l’URL de base et PTERO_SERVER_IDENTIFIER.`);
        throw new Error(`${kind} : HTTP ${response.status}; réponse masquée : ${redactSensitiveText(text).slice(0, 300)}`);
    }
    try {
        return text ? JSON.parse(text) : {};
    }
    catch {
        throw new Error('PTERO_INVALID_RESPONSE : réponse non JSON reçue de l’API. Vérifie que PTERO_URL pointe vers l’API officielle du panel et non vers une page web.');
    }
}
function redactLogLine(line) { return redactSensitiveText(line); }
async function serverStatus() {
    const data = await request(`/api/client/servers/${encodeURIComponent(env_js_1.env.ptero.server)}/resources`);
    const attributes = data?.attributes ?? data?.data?.attributes ?? {};
    return {
        retrievedAt: new Date().toISOString(),
        identifier: env_js_1.env.ptero.server,
        currentState: attributes.current_state ?? 'unknown',
        isSuspended: Boolean(attributes.is_suspended),
        resources: attributes.resources ?? null,
    };
}
/** Retrieve recent console output using the official Pterodactyl client WebSocket API. */
async function consoleLogs(maxLines = 150) {
    const limit = Math.max(20, Math.min(300, Math.floor(Number(maxLines) || 150)));
    const data = await request(`/api/client/servers/${encodeURIComponent(env_js_1.env.ptero.server)}/websocket`);
    const attributes = data?.data?.attributes ?? data?.attributes ?? data;
    const socketUrl = String(attributes?.socket ?? '');
    const token = String(attributes?.token ?? '');
    if (!socketUrl || !token)
        throw new Error('PTERO_CONSOLE_DATA_MISSING : l’API n’a pas fourni d’URL/jeton WebSocket. Vérifie l’URL de base et les permissions console du jeton API.');
    try {
        const parsedSocket = new URL(socketUrl);
        if (!['ws:', 'wss:'].includes(parsedSocket.protocol))
            throw new Error();
    }
    catch {
        throw new Error('PTERO_CONSOLE_SOCKET_INVALID : l’API a retourné une URL WebSocket invalide.');
    }
    const WebSocketCtor = globalThis.WebSocket;
    if (!WebSocketCtor)
        throw new Error('WebSocket natif indisponible. Utilise Node.js 22 ou plus récent pour lire la console Eternodes.');
    return new Promise((resolve, reject) => {
        const lines = [];
        let settled = false;
        let authenticated = false;
        let authSent = false;
        const socket = new WebSocketCtor(socketUrl);
        const finish = (error) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            try {
                socket.close();
            }
            catch { /* noop */ }
            if (error)
                reject(error);
            else {
                const finalLines = lines.slice(-limit).map(redactLogLine);
                resolve({ source: 'Eternodes/Pterodactyl console WebSocket', retrievedAt: new Date().toISOString(), lines: finalLines, text: finalLines.join('\n'), ...(authenticated && finalLines.length === 0 ? { warning: 'Authentification réussie, mais aucune ligne console reçue pendant la fenêtre d’écoute.' } : {}) });
            }
        };
        const timer = setTimeout(() => finish(authenticated ? undefined : new Error('PTERO_CONSOLE_TIMEOUT : la console n’a pas confirmé l’authentification dans les 10 secondes. Vérifie les permissions API et la connectivité WebSocket.')), 10_000);
        socket.addEventListener('open', () => {
            if (authSent)
                return;
            authSent = true;
            socket.send(JSON.stringify({ event: 'auth', args: [token] }));
        });
        socket.addEventListener('message', (event) => {
            let payload;
            try {
                payload = JSON.parse(String(event.data));
            }
            catch {
                return;
            }
            if (payload.event === 'auth success') {
                authenticated = true;
                socket.send(JSON.stringify({ event: 'send logs', args: [null] }));
            }
            else if (payload.event === 'console output') {
                const value = payload.args?.[0];
                const received = Array.isArray(value) ? value : [value];
                for (const item of received)
                    if (item != null && String(item))
                        lines.push(String(item));
                if (lines.length > limit * 3)
                    lines.splice(0, lines.length - limit * 2);
            }
            else if (payload.event === 'token expiring' || payload.event === 'token expired') {
                if (!authenticated)
                    finish(new Error('Le jeton WebSocket Pterodactyl a expiré avant l’authentification.'));
            }
            else if (payload.event === 'jwt error' || payload.event === 'auth error') {
                finish(new Error('PTERO_CONSOLE_AUTH_REJECTED : le WebSocket a refusé le jeton de console temporaire. Relance la requête et vérifie les permissions console côté panel.'));
            }
        });
        socket.addEventListener('error', () => finish(new Error('Connexion WebSocket à la console Eternodes impossible. Vérifie l’URL PTERO_URL, le réseau et les permissions API.')));
        socket.addEventListener('close', () => { if (!settled && authenticated)
            finish(); });
    });
}
async function sendPower(signal) {
    return request(`/api/client/servers/${encodeURIComponent(env_js_1.env.ptero.server)}/power`, {
        method: 'POST', body: JSON.stringify({ signal }),
    });
}
async function deployRestart() {
    if (!env_js_1.env.ptero.start)
        return { ok: true, action: 'none', message: 'PTERO_TARGET_START=false : aucune action de mise sous tension/redémarrage n’a été envoyée.' };
    return sendPower('restart');
}
