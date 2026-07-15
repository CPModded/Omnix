import { Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { CONFIG } from '../../config';
import { User } from '../../models/User';

export class AuthController {
  // Génère l'URL d'autorisation Discord
  static getLoginUrl(req: Request, res: Response) {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CONFIG.DISCORD.CLIENT_ID}&redirect_uri=${encodeURIComponent(CONFIG.DISCORD.REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
    console.log(`[OAuth2] 🔄 URL de connexion générée.`);
    return res.json({ url });
  }

  // Échange du code d'autorisation contre les tokens de session
  static async handleCallback(req: Request, res: Response) {
    const { code } = req.query;

    console.log(`[OAuth2] 🔄 Callback d'authentification reçu.`);

    if (!code) {
      console.warn(`[OAuth2] ⚠️ Échec du callback : Code d'autorisation manquant.`);
      return res.redirect('/?error=code_manquant');
    }

    try {
      // 1. Échange du code contre l'Access Token de Discord
      const tokenResponse = await axios.post(
        'https://discord.com/api/oauth2/token',
        new URLSearchParams({
          client_id: CONFIG.DISCORD.CLIENT_ID,
          client_secret: CONFIG.DISCORD.CLIENT_SECRET,
          grant_type: 'authorization_code',
          code: code.toString(),
          redirect_uri: CONFIG.DISCORD.REDIRECT_URI,
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      const { access_token } = tokenResponse.data;
      console.log(`[OAuth2] ✅ Access Token de Discord récupéré.`);

      // 2. Récupération du profil Discord de l'utilisateur
      console.log(`[OAuth2] 📥 Récupération du profil Discord utilisateur (@me)...`);
      const userResponse = await axios.get('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      const discordUser = userResponse.data;
      const isAdmin = CONFIG.DISCORD.OWNER_IDS.includes(discordUser.id);
      console.log(`[OAuth2] ✅ Profil Discord récupéré : ${discordUser.username} (${discordUser.id})`);

      // 3. Enregistrement ou mise à jour de l'utilisateur en base de données
      console.log(`[Database] 💾 Recherche ou création de la fiche utilisateur de ${discordUser.username}...`);
      let user = await User.findOne({ discordId: discordUser.id });

      if (!user) {
        user = new User({
          discordId: discordUser.id,
          username: discordUser.username,
          avatar: discordUser.avatar,
          isAdmin,
        });
      } else {
        // Blocage de sécurité si l'utilisateur est banni (Blacklist)
        if (user.isBlacklisted) {
          console.warn(`[OAuth2] 🚫 Connexion refusée pour l'utilisateur banni : ${user.username}`);
          return res.redirect('/?error=blacklist_actif');
        }
        user.username = discordUser.username;
        user.avatar = discordUser.avatar;
        user.isAdmin = isAdmin;
      }
      await user.save();
      console.log(`[Database] 💾 Données de l'utilisateur enregistrées.`);

      // Vérification du statut Premium de l'utilisateur
      const isPremium = user.licenses.some(
        lic => lic.status === 'active' && lic.activatedGuildId === null
      );
      console.log(`[Database] 💎 Statut Premium de l'utilisateur ${discordUser.username} : ${isPremium}`);

      // Génération de notre jeton JWT local (session)
      const token = jwt.sign(
        {
          discordId: user.discordId,
          username: user.username,
          avatar: user.avatar,
          isAdmin: user.isAdmin,
          isPremium: isPremium,
          discordAccessToken: access_token,
        },
        CONFIG.JWT_SECRET,
        { expiresIn: '7d' }
      );
      console.log(`[OAuth2] 🔑 Jeton JWT généré. Envoi du redirigeur HTML de sécurité...`);

      // Adresse de redirection forcée en HTTP absolu (Bypass le forçage HTTPS de Safari)
      const targetUrl = `${CONFIG.CLIENT_URL}/dashboard`;

      // Rendu de la mini-page HTML de contournement d'HSTS Safari
      return res.send(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Connexion OMNIX...</title>
          <style>
            body {
              background-color: #030712;
              color: #f1f5f9;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              text-align: center;
            }
            .loader-box {
              background: rgba(15, 23, 42, 0.45);
              border: 1px solid rgba(255, 255, 255, 0.04);
              padding: 40px;
              border-radius: 24px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.3);
              backdrop-filter: blur(12px);
              -webkit-backdrop-filter: blur(12px);
              max-width: 350px;
              width: 100%;
              margin: 0 20px;
            }
            .spinner {
              width: 44px;
              height: 44px;
              border: 4px solid rgba(255,255,255,0.1);
              border-top-color: #06b6d4;
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin: 0 auto 24px auto;
            }
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
            .btn-enter {
              margin-top: 24px;
              display: inline-block;
              width: 100%;
              padding: 14px 20px;
              background: linear-gradient(135deg, #06b6d4, #4f46e5);
              color: white;
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 1px;
              text-decoration: none;
              border-radius: 12px;
              box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
            }
          </style>
        </head>
        <body>
          <div class="loader-box">
            <div class="spinner"></div>
            <p style="font-weight: 800; font-size: 16px; color: white;">Connexion réussie !</p>
            <p style="font-size: 12px; color: #64748b; margin-top: 8px; line-height: 1.5;">Cliquez sur le bouton ci-dessous pour entrer dans votre espace d'administration.</p>
            <a href="${targetUrl}" class="btn-enter">Entrer dans le Dashboard</a>
          </div>

          <script>
            // Sauvegarde de secours double-canal (LocalStorage + Cookie)
            try {
              localStorage.setItem('jwt_token', '${token}');
            } catch(e) {
              document.cookie = "jwt_token=${token}; path=/; max-age=604800; SameSite=Lax";
            }
            setTimeout(() => {
              window.location.replace('${targetUrl}');
            }, 600);
          </script>
        </body>
        </html>
      `);

    } catch (error: any) {
      console.error('[OAuth2 Error] ❌ Échec de la phase d\'authentification :', error?.response?.data || error.message);
      return res.redirect('/?error=authentification_echouee');
    }
  }
}