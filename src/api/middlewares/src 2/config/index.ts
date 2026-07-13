import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const CONFIG = {
  PORT: process.env.PORT || 3000,
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000', // Ajout dynamique de l'URL
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/discord_platform',
  JWT_SECRET: process.env.JWT_SECRET || 'fallback_secret_key_change_me',
  DISCORD: {
    CLIENT_ID: process.env.DISCORD_CLIENT_ID || '',
    CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET || '',
    BOT_TOKEN: process.env.DISCORD_BOT_TOKEN || '',
    REDIRECT_URI: process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/api/auth/callback',
    OWNER_IDS: process.env.DISCORD_OWNER_IDS ? process.env.DISCORD_OWNER_IDS.split(',') : [],
  },
  PAYMENTS: {
    STRIPE_KEY: process.env.STRIPE_SECRET_KEY || '',
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  }
};