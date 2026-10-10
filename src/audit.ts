export function audit(action: string, result: 'ok'|'error', meta: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts:new Date().toISOString(), service:'omnix-dev-bridge', action, result, ...meta }));
}
