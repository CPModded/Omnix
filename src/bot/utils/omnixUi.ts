import { EmbedBuilder } from 'discord.js';

export const OMNIX_COLORS = {
  primary: 0x7c5cff,
  success: 0x10b981,
  warning: 0xf59e0b,
  danger: 0xef4444,
  info: 0x38bdf8,
} as const;

export function omnixEmbed(title: string, description?: string, color: number = OMNIX_COLORS.primary) {
  const embed = new EmbedBuilder().setColor(color).setTitle(`OMNIX · ${title}`).setTimestamp();
  if (description) embed.setDescription(description);
  return embed;
}

export function omnixLoading(title = 'Traitement en cours', description = 'OMNIX prépare votre demande…') {
  return omnixEmbed(title, `⏳ ${description}`, OMNIX_COLORS.info);
}

export function omnixSuccess(title: string, description: string) {
  return omnixEmbed(title, `✓ ${description}`, OMNIX_COLORS.success);
}

export function omnixError(title: string, description: string) {
  return omnixEmbed(title, `✕ ${description}`, OMNIX_COLORS.danger);
}
