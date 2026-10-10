"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serverStatus = serverStatus;
exports.consoleLogs = consoleLogs;
exports.sendPower = sendPower;
exports.deployRestart = deployRestart;
const env_js_1 = require("../config/env.js");
function headers() {
    if (!env_js_1.env.ptero.url || !env_js_1.env.ptero.token || !env_js_1.env.ptero.server) {
        throw new Error('Eternodes/Pterodactyl configuration incomplete: PTERO_URL, PTERO_API_TOKEN ou PTERO_SERVER_IDENTIFIER absent.');
    }
    return {
        Authorization: `Bearer ${env_js_1.env.ptero.token}`,
        Accept: 'Application/vnd.pterodactyl.v1+json',
        'Content-Type': 'application/json',
    };
}
async function request(endpoint, init = {}) {
    const response = await fetch(`${env_js_1.env.ptero.url.replace(/\/$/, '')}${endpoint}`, {
        ...init,
        headers: { ...headers(), ...(init.headers ?? {}) },
        signal: init.signal ?? AbortSignal.timeout(15_000),
    });
    const text = await response.text();
    if (!response.ok)
        throw new Error(`Pterodactyl ${response.status}: ${text.slice(0, 400)}`);
    return text ? JSON.parse(text) : {};
}
function redactLogLine(line) {
    return line
        .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s"']+/ig, '$1[MASQUÉ]')
        .replace(/((?:MAMMOUTH_API_KEY|DISCORD_TOKEN|BOT_TOKEN|PTERO_API_TOKEN|MCP_API_KEY|MYSQL_PASSWORD|MONGODB_URI)\s*[:=]\s*)[^\s,;"']+/ig, '$1[MASQUÉ]')
        .replace(/(sk-[A-Za-z0-9_-]{12,})/g, '[CLÉ API MASQUÉE]');
}
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
        throw new Error('Pterodactyl n’a pas retourné les informations WebSocket de la console. Vérifie les permissions d’accès console du token API.');
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
                resolve({ source: 'Eternodes/Pterodactyl console WebSocket', retrievedAt: new Date().toISOString(), lines: finalLines, text: finalLines.join('\n') });
            }
        };
        const timer = setTimeout(() => finish(), 3_500);
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
                finish(new Error('Pterodactyl a refusé l’accès à la console. Vérifie les permissions du token API.'));
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
    return env_js_1.env.ptero.start ? sendPower('restart') : sendPower('stop');
}
