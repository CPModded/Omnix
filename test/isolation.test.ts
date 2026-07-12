import mongoose from 'mongoose';
import { GuildConfig } from '../src/models/GuildConfig';
import { CONFIG } from '../src/config';

describe('Suite de tests - Isolation Multi-Tenant', () => {

  // Connexion à la base de données de test avant le lancement
  beforeAll(async () => {
    // Utilisation d'une base de test temporaire pour ne pas écraser vos données de production
    const testDbUri = CONFIG.MONGO_URI || 'mongodb://127.0.0.1:27017/discord_platform_test';
    await mongoose.connect(testDbUri);
  });

  // Nettoyage de la base de test après l'exécution
  afterAll(async () => {
    if (mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
    }
    await mongoose.connection.close();
  });

  // Nettoyer les collections entre chaque scénario de test
  beforeEach(async () => {
    await GuildConfig.deleteMany({});
  });

  test('Vérification du cloisonnement strict de la configuration d\'un serveur', async () => {
    const guildAId = '999999999999999991';
    const guildBId = '999999999999999992';

    // 1. Enregistrement d'un serveur A avec des options personnalisées (Premium actif, devise €, IA configurée)
    const guildA = new GuildConfig({
      guildId: guildAId,
      premium: { isPremium: true, tier: 'premium', expiresAt: null },
      modules: {
        economy: { enabled: true, currencySymbol: '€' },
        ai: { enabled: true, systemPrompt: "Tu es un chat de taverne.", contextLimit: 5 }
      }
    });
    await guildA.save();

    // 2. Enregistrement d'un serveur B (Standard, gratuit, devise $, IA standard)
    const guildB = new GuildConfig({
      guildId: guildBId,
      premium: { isPremium: false, tier: 'free', expiresAt: null },
      modules: {
        economy: { enabled: true, currencySymbol: '$' },
        ai: { enabled: false, systemPrompt: "Assistant par défaut.", contextLimit: 10 }
      }
    });
    await guildB.save();

    // 3. Récupération individuelle
    const queryA = await GuildConfig.findOne({ guildId: guildAId });
    const queryB = await GuildConfig.findOne({ guildId: guildBId });

    // Assertions : On vérifie que chaque objet correspond strictement à sa configuration
    expect(queryA).toBeDefined();
    expect(queryB).toBeDefined();

    // Vérification de la devise (pas de fuite entre A et B)
    expect(queryA?.modules.economy.currencySymbol).toBe('€');
    expect(queryB?.modules.economy.currencySymbol).toBe('$');

    // Vérification de l'activation de l'IA et de son prompt personnalisé
    expect(queryA?.modules.ai.enabled).toBe(true);
    expect(queryB?.modules.ai.enabled).toBe(false);
    
    expect(queryA?.modules.ai.systemPrompt).toBe("Tu es un chat de taverne.");
    expect(queryB?.modules.ai.systemPrompt).toBe("Assistant par défaut.");

    // Vérification du statut premium
    expect(queryA?.premium.isPremium).toBe(true);
    expect(queryB?.premium.isPremium).toBe(false);
  });
});