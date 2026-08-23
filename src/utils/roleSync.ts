import { client as botClient } from '../bot/client.ts';
import { CONFIG } from '../config/index.ts';
/* =========================================================
   PREMIUM ROLE SYNC
========================================================= */
/**
 * Synchronise le rôle Premium d'un utilisateur
 * sur le serveur officiel OMNIX.
 */
export async function syncPremiumRole(
  discordId: string,
  action: 'add' | 'remove'
): Promise<boolean> {
  const guildId =
    CONFIG.PREMIUM.GUILD_ID;
  const premiumRoleId =
    CONFIG.PREMIUM.ROLE_ID;
  /* =======================================================
     CONFIG CHECK
  ======================================================= */
  if (!guildId) {
    console.error(
      '[Role Sync] OMNIX_PREMIUM_GUILD_ID est manquant.'
    );
    return false;
  }
  if (!premiumRoleId) {
    console.error(
      '[Role Sync] OMNIX_PREMIUM_ROLE_ID est manquant.'
    );
    return false;
  }
  if (!discordId) {
    console.error(
      '[Role Sync] Discord ID invalide.'
    );
    return false;
  }
  /* =======================================================
     BOT CHECK
  ======================================================= */
  if (
    !botClient.isReady()
  ) {
    console.error(
      "[Role Sync] Le bot Discord n'est pas encore prêt."
    );
    return false;
  }
  try {
    /* =====================================================
       GUILD
    ===================================================== */
    const guild =
      await botClient.guilds.fetch(
        guildId
      );
    if (!guild) {
      console.error(
        `[Role Sync] Serveur introuvable : ${guildId}`
      );
      return false;
    }
    /* =====================================================
       MEMBER
    ===================================================== */
    const member =
      await guild.members
        .fetch(discordId)
        .catch(() => null);
    if (!member) {
      console.log(
        `[Role Sync] ${discordId} n'est pas présent sur le serveur officiel.`
      );
      return false;
    }
    /* =====================================================
       ADD
    ===================================================== */
    if (
      action === 'add'
    ) {
      if (
        !member.roles.cache.has(
          premiumRoleId
        )
      ) {
        await member.roles.add(
          premiumRoleId,
          'OMNIX Premium activation'
        );
        console.log(
          `[Role Sync] ✅ Premium ajouté à ${member.user.tag}`
        );
      }
      return true;
    }
    /* =====================================================
       REMOVE
    ===================================================== */
    if (
      member.roles.cache.has(
        premiumRoleId
      )
    ) {
      await member.roles.remove(
        premiumRoleId,
        'OMNIX Premium expiration'
      );
      console.log(
        `[Role Sync] ❌ Premium retiré de ${member.user.tag}`
      );
    }
    return true;
  } catch (error) {
    console.error(
      `[Role Sync] Erreur pour ${discordId} :`,
      error
    );
    return false;
  }
}
export default syncPremiumRole;