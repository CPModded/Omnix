import 'dotenv/config';

export const CONFIG = {
  NODE_ENV: process.env.NODE_ENV || 'development',

  PORT: Number(process.env.PORT || 3000),

  DOMAIN: process.env.DOMAIN || '',
  CLIENT_URL: process.env.CLIENT_URL || process.env.DOMAIN || '',

  MONGO_URI:
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.DATABASE_URL ||
    '',

  JWT_SECRET:
    process.env.JWT_SECRET ||
    'CHANGE_ME_IN_PRODUCTION',

  DISCORD: {
    TOKEN:
      process.env.DISCORD_TOKEN ||
      process.env.DISCORD_BOT_TOKEN ||
      process.env.TOKEN ||
      '',

    CLIENT_ID:
      process.env.DISCORD_CLIENT_ID || '',

    CLIENT_SECRET:
      process.env.DISCORD_CLIENT_SECRET || '',

    REDIRECT_URI:
      process.env.DISCORD_REDIRECT_URI || '',
  },

  OWNER_IDS: (
    process.env.OWNER_IDS ||
    process.env.OWNER_ID ||
    ''
  )
    .split(',')
    .map(id => id.trim())
    .filter(Boolean),

  OPENROUTER: {
    API_KEY:
      process.env.OPENROUTER_API_KEY || '',

    MODEL:
      process.env.OPENROUTER_MODEL ||
      'nvidia/nemotron-3-ultra-550b-a55b:free',
  },

  PAYMENTS: {
    STRIPE_SECRET_KEY:
      process.env.STRIPE_SECRET_KEY || '',

    STRIPE_WEBHOOK_SECRET:
      process.env.STRIPE_WEBHOOK_SECRET || '',
  },
} as const;


/**
 * Vérifie la configuration indispensable
 * lorsque OMNIX tourne en production.
 */
export function validateProductionConfig(): void {
  if (CONFIG.NODE_ENV !== 'production') {
    return;
  }

  const missing: string[] = [];

  if (!CONFIG.MONGO_URI) {
    missing.push('MONGODB_URI');
  }

  if (!CONFIG.DISCORD.CLIENT_ID) {
    missing.push('DISCORD_CLIENT_ID');
  }

  if (!CONFIG.DISCORD.CLIENT_SECRET) {
    missing.push('DISCORD_CLIENT_SECRET');
  }

  if (!CONFIG.DISCORD.REDIRECT_URI) {
    missing.push('DISCORD_REDIRECT_URI');
  }

  if (
    !CONFIG.JWT_SECRET ||
    CONFIG.JWT_SECRET === 'CHANGE_ME_IN_PRODUCTION'
  ) {
    missing.push('JWT_SECRET');
  }

  if (missing.length > 0) {
    throw new Error(
      `[CONFIG] Variables manquantes en production : ${missing.join(', ')}`
    );
  }
}