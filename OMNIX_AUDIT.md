# OMNIX — Audit & correctifs V1.2

## Correctifs appliqués

### Critiques
- Client Discord unifié: `src/index.ts` et toute l'API utilisent maintenant l'instance de `src/bot/client.ts`.
- OAuth Discord protégé par `state` cryptographique.
- JWT navigateur uniquement dans cookie `httpOnly`; plus de `localStorage.jwt_token` ni de JWT dans l'URL.
- JWT secret par défaut supprimé; un vrai `JWT_SECRET` est requis pour signer les sessions.
- Staff/Admin recalculé côté serveur; les claims JWT périmés ne suffisent plus pour conserver les droits Staff.
- Comptes blacklistés refusés par l'API et au login.
- Premium recalculé depuis MongoDB/licences plutôt que depuis un claim JWT.
- Configuration serveur: l'utilisateur ne peut plus modifier `premium.*`, `guildId`, timestamps ou champs internes via l'API de configuration.
- Licences atomiques: une licence ne peut pas être activée simultanément sur plusieurs serveurs.
- Le `GuildCreate` ne donne plus de Premium illimité: une licence disponible est consommée une seule fois.
- Webhook Stripe signé à partir du corps brut et rendu idempotent via `stripeSessionId` / `stripeEventId`.
- Routes Pricing d'administration protégées.
- Ancien contrôleur OAuth qui utilisait un autre système de session neutralisé.
- Anciennes clés OAuth stockées en MongoDB nettoyées au démarrage.

### Importants
- `dashboard.js` contenant du HTML/EJS renommé en `dashboard.ejs`.
- `ai-dev.js` contenant du HTML/EJS renommé en `ai-dev.ejs`.
- Route `/api/stats/health` ajoutée.
- Socket.IO réellement attaché au serveur HTTP, authentifié par cookie et alimentant `stats:update`.
- Script Socket.IO ajouté au Dashboard.
- Rate limiting, CORS, Helmet et protection d'origine activés.
- Corps JSON limités à 2 Mo et URL-encoded à 100 Ko.
- Routes `/premium` et `/support` ne finissent plus en 404 si les vues dédiées n'existent pas.
- Index User en double supprimés.
- Dossier route parasite imbriqué et faux `types.json` supprimés.
- Import local cassé de l'ancien `audit.routes.ts` supprimé; la route d'audit fonctionnelle est déjà dans `admin.routes.ts`.
- `tsconfig.json` adapté au CommonJS et les imports `.ts` normalisés.
- Logo de secours ajouté dans `public/` pour les références `/logo.png` de la backup.

## Vérifications locales

- Analyse syntaxique de tous les fichiers TypeScript: **OK**.
- Délimiteurs EJS: **OK**.
- Imports locaux relatifs manquants: **0**.
- Instances `new Client()` dans le source: **0** en dehors du singleton `src/bot/client.ts`.
- `import.meta`: **0**.
- JWT `localStorage`: **0** code actif.
- JWT dans URL: **0**.
- Vues EJS principales présentes: **OK**.

## Tests d'intégration non exécutables depuis la backup seule

La backup ne contient pas les secrets et services réels. Il faut donc encore valider après déploiement avec les variables d'environnement réelles:

1. OAuth Discord (login/callback).
2. MongoDB réel.
3. Connexion du bot Discord.
4. Synchronisation des slash commands.
5. Stripe Checkout + signature webhook.
6. Permissions Discord réelles sur plusieurs serveurs.
7. Socket.IO depuis le navigateur.
8. Build/installation avec `npm install` sur Render.

Aucun secret n'a été ajouté dans cette archive.
