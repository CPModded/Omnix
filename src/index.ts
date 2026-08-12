async function connectDatabase() {
  // Détection intelligente : cherche sous les 3 noms les plus courants du développement
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;
  
  if (!mongoUri) {
    console.error("[Database] ❌ ERREUR : Aucune adresse de connexion MongoDB trouvée.");
    console.error("[Database] Veuillez vérifier que votre fichier .env contient bien la variable MONGODB_URI ou MONGO_URI avec votre lien Atlas.");
    process.exit(1);
  }

  // Adapte le log selon qu'il s'agit d'Atlas ou d'une base locale
  if (mongoUri.includes('mongodb+srv')) {
    console.log("[Database] Connexion à MongoDB Atlas...");
  } else {
    console.log("[Database] Connexion à MongoDB local...");
  }

  try {
    await mongoose.connect(mongoUri);
    console.log("[Database] Connexion MongoDB établie.");
  } catch (error) {
    console.error("[Database] Échec de la connexion à la base de données :", error);
    process.exit(1);
  }
}