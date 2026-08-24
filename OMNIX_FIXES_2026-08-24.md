# OMNIX — correctifs 2026-08-24

- AI DEV ne liste/lit/recherche plus les fichiers internes du projet depuis le dashboard. Les anciennes routes sont conservées mais renvoient une réponse masquée/410 pour compatibilité.
- AI DEV utilise maintenant des discussions sauvegardées via AiSession : création, chargement et suppression, avec messages et compteurs persistés par propriétaire.
- /api/guilds rafraîchit la liste depuis Discord OAuth si nécessaire et persiste la liste dans User.guilds. Le token Discord reste backend-only.
- /api/stats utilise aussi les compteurs AiSession et les guilds réellement visibles par l’utilisateur.
- Admin : le total des serveurs utilise le cache Discord en plus de GuildConfig. Chart.js est chargé explicitement pour les graphiques.
- OpenRouter : le modèle est configurable par OPENROUTER_MODEL et une erreur 402 reçoit maintenant un message explicite sur la clé/crédit/modèle.
- Les routes existantes ne sont pas supprimées.

Validation locale : le TypeScript ne présente plus d'erreur de syntaxe sur les fichiers modifiés ; la compilation complète de cette archive nécessite l'installation des dépendances npm du projet.
