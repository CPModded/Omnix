# OMNIX — MySQL / Eternodes

Cette version adapte la migration SQL d'Omnix au moteur MySQL fourni par le panel Eternodes. MongoDB reste intact pendant la transition.

## Sur Eternodes

La base visible dans le panel avec un endpoint en `:3306` et une chaîne `jdbc:mysql://...` est une base MySQL.

Pour Omnix, utilise les informations affichées par l'icône 👁️ :

- Endpoint, par exemple `HOTE:3306`
- Username
- Password
- Nom de la base

Le mot de passe ne doit jamais être placé dans GitHub ni dans les logs.

## Variable Render

Utiliser une seule variable principale :

`DATABASE_URL=mysql://USERNAME:PASSWORD@HOST:3306/DATABASE`

`MYSQL_URL` est aussi accepté comme alternative.

Si le mot de passe contient des caractères réservés dans une URL (`@`, `#`, `/`, `:`, `%`, etc.), il doit être URL-encodé.

Exemple fictif :

`mysql://omnix:mot%40passe@51.91.240.60:3306/s1139_Omnix`

Ne remplace pas cet exemple par une valeur copiée telle quelle : utilise les valeurs réellement fournies par Eternodes.

## Variables facultatives

- `MYSQL_POOL_MAX` = `10`
- `MONGO_URI` ou `MONGODB_URI` = MongoDB existante, conservée pendant la migration

## Vérification

```bash
npm install
npm run db:status
```

## Migration contrôlée MongoDB → MySQL

```bash
npm run db:migrate
```

La migration :

- lit les collections MongoDB ;
- conserve les documents en JSON dans MySQL ;
- préserve les `_id` Mongo sous `document_id` ;
- crée `omnix_guild_configs` pour la configuration durable des modules ;
- peut être rejouée grâce aux clés primaires ;
- n'efface aucune donnée MongoDB ;
- enregistre un rapport dans `omnix_migration_runs`.

## Modules du dashboard

Les états `modules.*` sont écrits dans `omnix_guild_configs.modules`.

Pendant la transition :

`Dashboard → API → MySQL Eternodes`

MySQL est prioritaire pour l'état des modules et MongoDB reste une copie de compatibilité.

Cette migration ne bascule pas encore tous les modèles Mongoose vers MySQL. Elle sécurise d'abord la persistance SQL des modules et prépare la migration globale.
