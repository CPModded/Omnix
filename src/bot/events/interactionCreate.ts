// À insérer dans votre gestionnaire d'interactions d'événements (ButtonInteraction)
if (interaction.isButton() && interaction.customId === 'rules_accept_button') {
  await interaction.deferReply({ ephemeral: true });

  const verifiedRoleId = "VOTRE_ROLE_ID_VERIFIED"; // Rôle "Verified" de votre serveur officiel
  const member = interaction.member as any;

  try {
    if (member.roles.cache.has(verifiedRoleId)) {
      return interaction.editReply({ content: "ℹ️ Vous êtes déjà vérifié sur le serveur d'OMNIX." });
    }

    await member.roles.add(verifiedRoleId);
    return interaction.editReply({ content: "✅ **Règlement accepté !** Vous avez reçu le rôle **Verified** et débloqué l'accès complet au serveur." });
  } catch (err: any) {
    console.error('[Rules Verification Error] :', err.message);
    return interaction.editReply({ content: "❌ Impossible de mettre à jour vos rôles de vérification." });
  }
}