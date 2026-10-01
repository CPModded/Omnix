# OMNIX — PostgreSQL / Eternodes

Cette version prépare PostgreSQL comme nouvelle base de données Omnix sans supprimer MongoDB.

## Sur Eternodes

Créer une base PostgreSQL dédiée à Omnix avec un utilisateur dédié. La connexion finale doit être fournie à Omnix via `DATABASE_URL`.

Exemple de structure à adapter aux informations réellement fournies par Eternodes :

`postgresql://omnix:MOT_DE_PASSE@HOST:5432/omnix`

Ne jamais mettre cette valeur dans GitHub ni l'afficher dans les logs.

## Variables d'environnement

- `DATABASE_URL` = URL PostgreSQL
- `POSTGRES_POOL_MAX` = `10` (facultatif)
- `POSTGRES_SSL` = `true` si TLS est requis
- `POSTGRES_SSL_REJECT_UNAUTHORIZED` = `true` par défaut

Conserver temporairement `MONGO_URI` ou `MONGODB_URI` pour la migration. Ne supprimer MongoDB qu'après validation complète.

## Vérification

```bash
npm install
npm run db:status
```

## Migration contrôlée

```bash
npm run db:migrate
```

La migration lit les collections MongoDB, conserve les documents en JSONB dans PostgreSQL, préserve les `_id` Mongo sous `document_id`, est rejouable et ne supprime aucune donnée MongoDB. Un rapport est enregistré dans `omnix_migration_runs`.

## Important

Cette étape prépare et sécurise le transfert des données. Elle ne bascule pas encore les modèles applicatifs Mongoose vers PostgreSQL. La bascule applicative doit être faite après comparaison du rapport de migration et validation des modèles/références.
