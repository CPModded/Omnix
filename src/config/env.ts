import 'dotenv/config';

function csv(name: string): Set<string> {
  return new Set((process.env[name] ?? '').split(',').map(v => v.trim()).filter(Boolean));
}

export const env = {
  host: process.env.MCP_HOST ?? '127.0.0.1',
  port: Number(process.env.MCP_PORT ?? 8787),
  apiKey: process.env.MCP_API_KEY?.trim() ?? '',
  root: process.env.OMNIX_ROOT?.trim() || process.cwd(),
  developerIds: csv('OMNIX_DEVELOPER_IDS'),
  github: {
    token: process.env.GITHUB_TOKEN ?? '', owner: process.env.GITHUB_OWNER ?? 'CPModded',
    repo: process.env.GITHUB_REPO ?? 'Omnix', defaultBranch: process.env.GITHUB_DEFAULT_BRANCH ?? 'main',
    allowMainWrite: process.env.GITHUB_ALLOW_MAIN_WRITE === 'true'
  },
  ptero: {
    url: process.env.PTERO_URL ?? '', token: process.env.PTERO_API_TOKEN ?? '',
    server: process.env.PTERO_SERVER_IDENTIFIER ?? '', start: process.env.PTERO_TARGET_START !== 'false'
  },
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET ?? ''
} as const;

export const bridgeEnabled = Boolean(env.apiKey);
