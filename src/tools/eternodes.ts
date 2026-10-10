import { env } from '../config/env.js';

function headers() { if (!env.ptero.url || !env.ptero.token || !env.ptero.server) throw new Error('Eternodes/Pterodactyl configuration incomplete'); return { Authorization:`Bearer ${env.ptero.token}`, Accept:'Application/vnd.pterodactyl.v1+json', 'Content-Type':'application/json' }; }
async function request(path: string, init: RequestInit = {}) {
  const r = await fetch(`${env.ptero.url.replace(/\/$/,'')}${path}`, { ...init, headers:{...headers(), ...(init.headers ?? {})} });
  const text = await r.text(); if (!r.ok) throw new Error(`Pterodactyl ${r.status}: ${text.slice(0,500)}`); return text ? JSON.parse(text) : {};
}
export async function serverStatus() { return request(`/api/client/servers/${env.ptero.server}/resources`); }
export async function sendPower(signal: 'start'|'restart'|'stop') { return request(`/api/client/servers/${env.ptero.server}/power`, {method:'POST', body:JSON.stringify({signal})}); }
export async function deployRestart() { return env.ptero.start ? sendPower('restart') : sendPower('stop'); }
