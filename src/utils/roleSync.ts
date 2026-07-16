import { client as botClient } from '../bot/client';
import { CONFIG } from '../config';

/**
 * Attribue ou retire automatiquement le rôle Premium à un membre sur le serveur officiel
 * @param discordId Identifiant Discord de l'utilisateur
 * @param action 'add' pour attribuer le rôle, 'remove' pour le lui retirer
 */
export async function syncPremiumRole(discordId: string, action: 'add' | 'remove'): Promise<boolean> {
  const guildId = CONFIG.DISCORD.OWNER_IDS[0]; // ID de votre serveur officiel OMNIX configuré dans .env
  const premiumRoleId = "VOTRE_ROLE_ID_PREMIUM"; // ID du rôle "Premium" sur votre serveur officiel

  if (!guildId || !premiumRoleId) {
    console.error('[Role Sync] ⚠️ GuildID ou PremiumRoleId non configuré.');
    return false;
  }

  try {
    const guild = await botClient.guilds.fetch(guildId);
    const member = await guild.members.fetch(discordId).catch(() => null);

    if (!member) {
      console.log(`[Role Sync] 👤 L'utilisateur ${discordId} n'est pas présent sur le serveur Discord officiel.`);
      return false;
    }

    if (action === 'add') {
      if (!member.roles.cache.has(premiumRoleId)) {
        await member.roles.add(premiumRoleId);
        console.log(`[Role Sync] ✅ Rôle Premium ajouté avec succès à ${member.user.tag}`);
      }
    } else {
      if (member.roles.cache.has(premiumRoleId)) {
        await member.roles.remove(premiumRoleId);
        console.log(`[Role Sync] ❌ Rôle Premium retiré avec succès à ${member.user.tag}`);
      }
    }
    return true;
  } catch (error: any) {
    console.error(`[Role Sync] ❌ Erreur lors de la synchronisation du rôle pour ${discordId} :`, error.message);
    return false;
  }
}