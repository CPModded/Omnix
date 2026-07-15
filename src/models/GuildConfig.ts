export interface IGuildConfig extends Document {
  guildId: string;
  premium: {
    isPremium: boolean;
    tier: 'free' | 'premium' | 'lifetime' | 'enterprise';
    expiresAt: Date | null;
  };
  modules: {
    tickets: {
      enabled: boolean;
      categoryId: string | null; // Catégorie par défaut
      counter: number;           // Compteur de tickets ouverts
      categoriesList: ITicketCategory[]; // Tableau des catégories dynamiques
    };
    antiRaid: {
      enabled: boolean;
      thresholdCount: number;
      thresholdSeconds: number;
    };
    antiSpam: {
      enabled: boolean;
      maxMessages: number;
      windowSeconds: number;
    };
    antiLink: {
      enabled: boolean;
      allowedDomains: string[];
    };
    autoMod: {
      enabled: boolean;
      blacklistedWords: string[];
    };
    levels: {
      enabled: boolean;
      xpPerMessage: number;
      rewardRoles: { level: number; roleId: string }[];
    };
    economy: {
      enabled: boolean;
      currencySymbol: string;
      workCooldownMinutes: number;
    };
    music: {
      enabled: boolean;
    };
    ai: {
      enabled: boolean;
      systemPrompt: string;
      contextLimit: number;
    };
    counting: {
      enabled: boolean;
      channelId: string | null;
      currentNumber: number;
    };
    autoReactions: {
      enabled: boolean;
      rules: { trigger: string; emojis: string[] }[];
    };
    scheduledMessages: {
      enabled: boolean;
      list: { message: string; cronPattern: string; channelId: string }[];
    };
    polls: {
      enabled: boolean;
    };
    verification: {
      enabled: boolean;
      roleId: string | null;
    };
    backups: {
      enabled: boolean;
    };
    customCommands: {
      enabled: boolean;
      list: { trigger: string; response: string }[];
    };
    statistics: {
      enabled: boolean;
    };
    ping: {
      enabled: boolean;
    };
    honeypot: {
      enabled: boolean;
      channelId: string | null;
    };
  };
}