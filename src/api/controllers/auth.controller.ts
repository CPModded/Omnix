console.log(`[Database] 💾 Recherche ou mise à jour du compte de ${discordUser.username}...`);
      let user = await User.findOne({ discordId: discordUser.id });

      if (!user) {
        user = new User({
          discordId: discordUser.id,
          username: discordUser.username,
          avatar: discordUser.avatar,
          isAdmin,
        });
      } else {
        // VÉRIFICATION BLACKLIST : Si l'utilisateur est banni, on bloque la connexion immédiatement
        if (user.isBlacklisted) {
          console.warn(`[OAuth2] 🚫 Connexion refusée pour l'utilisateur banni : ${user.username}`);
          return res.redirect('/?error=blacklist_actif');
        }
        user.username = discordUser.username;
        user.avatar = discordUser.avatar;
        user.isAdmin = isAdmin;
      }
      await user.save();