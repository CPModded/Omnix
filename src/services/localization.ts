import { User } from '../models/User';
import GuildConfig from '../models/GuildConfig';

export const SUPPORTED_LOCALES = ['fr','en','de','es','it','pt-BR','pt-PT','tr','ar','so'] as const;
export type OmnixLocale = typeof SUPPORTED_LOCALES[number];

const COUNTRY_TO_LOCALE: Record<string, OmnixLocale> = {
  FR:'fr', BE:'fr', CH:'fr', CA:'fr', LU:'fr', US:'en', GB:'en', IE:'en', AU:'en', NZ:'en',
  DE:'de', AT:'de', ES:'es', MX:'es', AR:'es', CL:'es', CO:'es', IT:'it', BR:'pt-BR', PT:'pt-PT',
  TR:'tr', SA:'ar', AE:'ar', EG:'ar', MA:'ar', DZ:'ar', TN:'ar', SO:'so',
};

const DICT: Record<OmnixLocale, Record<string,string>> = {
  fr: { creating:'Création du ticket…', loading:'Chargement du ticket…', created:'Ticket créé ! Un membre du staff vous prendra en charge.', error:'Une erreur est survenue.', support:'Support', close:'Fermer', claim:'Prendre en charge', disabled:'Le système de tickets est actuellement désactivé.', maxOpen:'Tu as atteint le nombre maximal de tickets ouverts.', destinationMissing:'La destination du ticket est introuvable. Vérifie sa configuration dans le Dashboard.', notTicket:'Ce salon n’est pas un ticket OMNIX actif.', supportOnly:'Accès réservé au support autorisé pour cette catégorie.', closed:'Ticket fermé.' },
  en: { creating:'Creating ticket…', loading:'Loading ticket…', created:'Ticket created! A staff member will take care of your request.', error:'Something went wrong.', support:'Support', close:'Close', claim:'Claim' },
  de: { creating:'Ticket wird erstellt…', loading:'Ticket wird geladen…', created:'Ticket erstellt! Ein Mitglied des Teams wird sich um Ihre Anfrage kümmern.', error:'Ein Fehler ist aufgetreten.', support:'Support', close:'Schließen', claim:'Übernehmen' },
  es: { creating:'Creando ticket…', loading:'Cargando ticket…', created:'¡Ticket creado! Un miembro del equipo se ocupará de tu solicitud.', error:'Ha ocurrido un error.', support:'Soporte', close:'Cerrar', claim:'Übernehmen' },
  it: { creating:'Creazione del ticket…', loading:'Caricamento del ticket…', created:'Ticket creato! Un membro dello staff prenderà in carico la richiesta.', error:'Si è verificato un errore.', support:'Supporto', close:'Chiudi', claim:'Prendi in carico' },
  'pt-BR': { creating:'Criando ticket…', loading:'Carregando ticket…', created:'Ticket criado! Um membro da equipe cuidará da sua solicitação.', error:'Ocorreu um erro.', support:'Suporte', close:'Fechar', claim:'Assumir' },
  'pt-PT': { creating:'A criar o ticket…', loading:'A carregar o ticket…', created:'Ticket criado! Um membro da equipa tratará do seu pedido.', error:'Ocorreu um erro.', support:'Suporte', close:'Fechar', claim:'Assumir' },
  tr: { creating:'Talep oluşturuluyor…', loading:'Talep yükleniyor…', created:'Talep oluşturuldu! Bir yetkili sizinle ilgilenecek.', error:'Bir hata oluştu.', support:'Destek', close:'Kapat', claim:'Üstlen' },
  ar: { creating:'جارٍ إنشاء التذكرة…', loading:'جارٍ تحميل التذكرة…', created:'تم إنشاء التذكرة! سيتولى أحد أعضاء الفريق طلبك.', error:'حدث خطأ.', support:'الدعم', close:'إغلاق', claim:'استلام' },
  so: { creating:'Tigidhka waa la abuurayaa…', loading:'Tigidhka waa la soo rarayaa…', created:'Tigidhka waa la sameeyay! Xubin ka tirsan kooxda ayaa kaa caawin doona.', error:'Qalad ayaa dhacay.', support:'Taageero', close:'Xir', claim:'Qabso' },
};

export function normalizeLocale(value?: string | null): OmnixLocale {
  if (!value) return 'fr';
  const exact = SUPPORTED_LOCALES.find(x => x.toLowerCase() === value.toLowerCase());
  if (exact) return exact;
  const base = value.split('-')[0].toLowerCase();
  return (SUPPORTED_LOCALES.find(x => x.toLowerCase() === base) as OmnixLocale) || 'fr';
}

export function localeFromCountry(country?: string | null): OmnixLocale | null {
  return country ? COUNTRY_TO_LOCALE[country.toUpperCase()] || null : null;
}

export function t(locale: string | undefined, key: string): string {
  const l = normalizeLocale(locale);
  return DICT[l]?.[key] || DICT.fr[key] || key;
}

export async function getInteractionLocale(interaction: any, config?: any): Promise<OmnixLocale> {
  const user = await User.findOne({ discordId: String(interaction.user?.id || '') }).select('localePreference detectedLocale').lean().catch(() => null) as any;
  // Ordre de priorité : préférence explicite OMNIX > rôle de langue >
  // langue réellement annoncée par Discord > détection web enregistrée > serveur.
  if (user?.localePreference && user.localePreference !== 'auto') return normalizeLocale(user.localePreference);
  if (config?.languageRoles && interaction.member?.roles?.cache) {
    for (const [roleId, roleLocale] of Object.entries(config.languageRoles)) {
      if (interaction.member.roles.cache.has(String(roleId))) return normalizeLocale(String(roleLocale));
    }
  }
  const discordLocale = interaction?.locale || interaction?.guildLocale || interaction?.member?.locale;
  if (discordLocale) return normalizeLocale(String(discordLocale));
  if (user?.detectedLocale) return normalizeLocale(user.detectedLocale);
  if (config?.autoLocale !== false && config?.locale) return normalizeLocale(config.locale);
  return 'fr';
}

export async function setGuildLanguageRole(guildId: string, roleId: string, locale: string): Promise<void> {
  const config: any = await GuildConfig.findOne({ guildId });
  if (!config) throw new Error('GuildConfig introuvable');
  config.languageRoles = { ...(config.languageRoles || {}), [roleId]: normalizeLocale(locale) };
  await config.save();
}
