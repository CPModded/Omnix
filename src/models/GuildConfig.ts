// À insérer dans l'interface IGuildConfig :
autoRole: {
  enabled: boolean;
  roleId: string | null;
};
reactionRoles: {
  enabled: boolean;
  list: { messageId: string; emoji: string; roleId: string }[];
};

// À insérer dans votre GuildConfigSchema (sous l'objet modules) :
autoRole: {
  enabled: { type: Boolean, default: false },
  roleId: { type: String, default: null }
},
reactionRoles: {
  enabled: { type: Boolean, default: false },
  list: [{
    messageId: { type: String, required: true },
    emoji: { type: String, required: true },
    roleId: { type: String, required: true }
  }]
}