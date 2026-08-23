import type { Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { User } from '../../models/User.ts'; // Import ESM du modèle Utilisateur (.ts)

/**
 * Contrôleur de gestion de l'authentification OAuth2 Discord d'OMNIX
 * Exporté de manière nommée pour correspondre parfaitement au routeur d'Express
 */
export async function discordCallback(req: Request, res: Response) {
  const { code } = req.query;

  if (!code) {
    return res.redirect('/?error=missing_code');
  }

  try {
    const client_id = process.env.DISCORD_CLIENT_ID;
    const client_secret = process.env.DISCORD_CLIENT_SECRET;
    const redirect_uri = process.env.DISCORD_REDIRECT_URI;

    if (!client_id || !client_secret || !redirect_uri) {
      console.error("[Auth] ❌ ERREUR : Identifiants OAuth2 Discord manquants dans le fichier .env.");
      return res.redirect('/?error=env_missing');
    }

    // 1. Échange du code d'autorisation contre un Jeton d'accès (Access Token) auprès de Discord
    const tokenResponse = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id,
        client_secret,
        grant_type: 'authorization_code',
        code: code.toString(),
        redirect_uri,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const { access_token } = tokenResponse.data;

    // 2. Récupération du profil de l'utilisateur Discord (@me)
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const discordUser = userResponse.data;

    // 3. Recherche ou enregistrement de l'utilisateur dans MongoDB Atlas (avec sauvegarde de l'access token Discord)
    let user = await User.findOne({ discordId: discordUser.id });

    if (!user) {
      // Nouvel utilisateur
      user = await User.create({
        discordId: discordUser.id,
        username: discordUser.username,
        avatar: discordUser.avatar,
        isAdmin: false,
        accessToken: access_token // 🟢 Sauvegarde cruciale pour les requêtes /api/guilds
      });
    } else {
      // Utilisateur existant
      user.username = discordUser.username;
      user.avatar = discordUser.avatar;
      user.accessToken = access_token; // 🟢 Mise à jour cruciale pour les requêtes /api/guilds
      await user.save();
    }

    // 4. Génération de votre Jeton JWT d'OMNIX
    const jwtSecret = process.env.JWT_SECRET || 'omnix_secret_key_2026';
    const token = jwt.sign(
      { 
        discordId: user.discordId, 
        username: user.username, 
        avatar: user.avatar, 
        isAdmin: user.isAdmin 
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // 5. Enregistrement automatique du cookie de session (indispensable pour les requêtes de navigation)
    res.cookie('jwt_token', token, {
      httpOnly: false, // Permet l'accès de secours côté client
      secure: true,    // Requis sur Render (HTTPS)
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours
    });

    // 6. Redirection finale vers le Dashboard avec le jeton d'authentification
    return res.redirect(`/dashboard?token=${token}`);

  } catch (error: any) {
    console.error("[Auth Error] Échec de l'authentification OAuth2 :", error.response?.data || error.message);
    return res.redirect('/?error=auth_failed');
  }
}