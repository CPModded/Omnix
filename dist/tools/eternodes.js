"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serverStatus = serverStatus;
exports.sendPower = sendPower;
exports.deployRestart = deployRestart;
const env_js_1 = require("../config/env.js");
function headers() { if (!env_js_1.env.ptero.url || !env_js_1.env.ptero.token || !env_js_1.env.ptero.server)
    throw new Error('Eternodes/Pterodactyl configuration incomplete'); return { Authorization: `Bearer ${env_js_1.env.ptero.token}`, Accept: 'Application/vnd.pterodactyl.v1+json', 'Content-Type': 'application/json' }; }
async function request(path, init = {}) {
    const r = await fetch(`${env_js_1.env.ptero.url.replace(/\/$/, '')}${path}`, { ...init, headers: { ...headers(), ...(init.headers ?? {}) } });
    const text = await r.text();
    if (!r.ok)
        throw new Error(`Pterodactyl ${r.status}: ${text.slice(0, 500)}`);
    return text ? JSON.parse(text) : {};
}
async function serverStatus() { return request(`/api/client/servers/${env_js_1.env.ptero.server}/resources`); }
async function sendPower(signal) { return request(`/api/client/servers/${env_js_1.env.ptero.server}/power`, { method: 'POST', body: JSON.stringify({ signal }) }); }
async function deployRestart() { return env_js_1.env.ptero.start ? sendPower('restart') : sendPower('stop'); }
