import { env } from '../config/env.js';

function headers() {
  if (!env.ptero.url || !env.ptero.token || !env.ptero.server) {
    throw new Error('Eternodes/Pterodactyl configuration incomplete: PTERO_URL, PTERO_API_TOKEN ou PTERO_SERVER_IDENTIFIER absent.');
  }
  return {
    Authorization: `Bearer ${env.ptero.token}`,
    Accept: 'Application/vnd.pterodactyl.v1+json',
    'Content-Type': 'application/json',
  };
}

async function request(endpoint: string, init: RequestInit = {}) {
  const response = await fetch(`${env.ptero.url.replace(/\/$/, '')}${endpoint}`, {
    ...init,
    headers: { ...headers(), ...(init.headers ?? {}) },
    signal: init.signal ?? AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Pterodactyl ${response.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

function redactLogLine(line: string): string {
  return line
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s"']+/ig, '$1[MASQUÉ]')
    .replace(/((?:MAMMOUTH_API_KEY|DISCORD_TOKEN|BOT_TOKEN|PTERO_API_TOKEN|MCP_API_KEY|MYSQL_PASSWORD|MONGODB_URI)\s*[:=]\s*)[^\s,;"']+/ig, '$1[MASQUÉ]')
    .replace(/(sk-[A-Za-z0-9_-]{12,})/g, '[CLÉ API MASQUÉE]');
}

export async function serverStatus() {
  const data: any = await request(`/api/client/servers/${encodeURIComponent(env.ptero.server)}/resources`);
  const attributes = data?.attributes ?? data?.data?.attributes ?? {};
  return {
    retrievedAt: new Date().toISOString(),
    identifier: env.ptero.server,
    currentState: attributes.current_state ?? 'unknown',
    isSuspended: Boolean(attributes.is_suspended),
    resources: attributes.resources ?? null,
  };
}

/** Retrieve recent console output using the official Pterodactyl client WebSocket API. */
export async function consoleLogs(maxLines = 150): Promise<{ source: string; retrievedAt: string; lines: string[]; text: string }> {
  const limit = Math.max(20, Math.min(300, Math.floor(Number(maxLines) || 150)));
  const data: any = await request(`/api/client/servers/${encodeURIComponent(env.ptero.server)}/websocket`);
  const attributes = data?.data?.attributes ?? data?.attributes ?? data;
  const socketUrl = String(attributes?.socket ?? '');
  const token = String(attributes?.token ?? '');
  if (!socketUrl || !token) throw new Error('Pterodactyl n’a pas retourné les informations WebSocket de la console. Vérifie les permissions d’accès console du token API.');

  const WebSocketCtor = (globalThis as any).WebSocket;
  if (!WebSocketCtor) throw new Error('WebSocket natif indisponible. Utilise Node.js 22 ou plus récent pour lire la console Eternodes.');

  return new Promise((resolve, reject) => {
    const lines: string[] = [];
    let settled = false;
    let authenticated = false;
    let authSent = false;
    const socket = new WebSocketCtor(socketUrl);
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { socket.close(); } catch { /* noop */ }
      if (error) reject(error);
      else {
        const finalLines = lines.slice(-limit).map(redactLogLine);
        resolve({ source: 'Eternodes/Pterodactyl console WebSocket', retrievedAt: new Date().toISOString(), lines: finalLines, text: finalLines.join('\n') });
      }
    };
    const timer = setTimeout(() => finish(), 3_500);
    socket.addEventListener('open', () => {
      if (authSent) return;
      authSent = true;
      socket.send(JSON.stringify({ event: 'auth', args: [token] }));
    });
    socket.addEventListener('message', (event: any) => {
      let payload: any;
      try { payload = JSON.parse(String(event.data)); } catch { return; }
      if (payload.event === 'auth success') {
        authenticated = true;
        socket.send(JSON.stringify({ event: 'send logs', args: [null] }));
      } else if (payload.event === 'console output') {
        const value = payload.args?.[0];
        const received = Array.isArray(value) ? value : [value];
        for (const item of received) if (item != null && String(item)) lines.push(String(item));
        if (lines.length > limit * 3) lines.splice(0, lines.length - limit * 2);
      } else if (payload.event === 'token expiring' || payload.event === 'token expired') {
        if (!authenticated) finish(new Error('Le jeton WebSocket Pterodactyl a expiré avant l’authentification.'));
      } else if (payload.event === 'jwt error' || payload.event === 'auth error') {
        finish(new Error('Pterodactyl a refusé l’accès à la console. Vérifie les permissions du token API.'));
      }
    });
    socket.addEventListener('error', () => finish(new Error('Connexion WebSocket à la console Eternodes impossible. Vérifie l’URL PTERO_URL, le réseau et les permissions API.')));
    socket.addEventListener('close', () => { if (!settled && authenticated) finish(); });
  });
}

export async function sendPower(signal: 'start' | 'restart' | 'stop') {
  return request(`/api/client/servers/${encodeURIComponent(env.ptero.server)}/power`, {
    method: 'POST', body: JSON.stringify({ signal }),
  });
}

export async function deployRestart() {
  return env.ptero.start ? sendPower('restart') : sendPower('stop');
}
