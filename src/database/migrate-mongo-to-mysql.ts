import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { pool, mysqlEnabled, withTransaction } from './mysql';

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
const migrationFile = path.join(process.cwd(), 'src/database/migrations/001_omnix_core.sql');

async function ensureSchema(): Promise<void> {
  if (!pool) throw new Error('DATABASE_URL/MYSQL_URL est absent.');
  const sql = await fs.readFile(migrationFile, 'utf8');
  // The migration file contains standalone CREATE statements, so execute each
  // statement separately instead of relying on multiStatements being enabled.
  for (const statement of sql.split(/;\s*(?:\r?\n|$)/).map((item) => item.trim()).filter(Boolean)) {
    await pool.query(statement);
  }
}

function normalize(value: any): any {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object' && value._bsontype === 'ObjectId') return value.toString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    const out: any = {};
    for (const [key, item] of Object.entries(value)) out[key] = normalize(item);
    return out;
  }
  return value;
}

async function main(): Promise<void> {
  if (!mysqlEnabled || !pool) throw new Error('DATABASE_URL/MYSQL_URL est absent.');
  if (!mongoUri) throw new Error('MONGODB_URI/MONGO_URI est absent.');

  await ensureSchema();
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10_000, connectTimeoutMS: 10_000 });

  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB database indisponible.');
  const sourceName = mongoose.connection.name || 'unknown';
  const collections = (await db.listCollections().toArray())
    .map((c) => c.name)
    .filter((name) => !name.startsWith('system.'));

  const run = await pool.query<any>(
    `INSERT INTO omnix_migration_runs (source_database, target_database, collections)
     VALUES (?, DATABASE(), ?)`,
    [sourceName, JSON.stringify({})],
  );
  const runId = Number((run[0] as any).insertId);
  const report: Record<string, any> = {};

  try {
    for (const collectionName of collections) {
      const documents = await db.collection(collectionName).find({}).toArray();
      let migrated = 0;
      await withTransaction(async (connection) => {
        for (const raw of documents) {
          const normalized = normalize(raw);
          const documentId = String(normalized._id);
          await connection.query(
            `INSERT INTO omnix_documents (collection, document_id, data)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE
               data = VALUES(data),
               updated_at = CURRENT_TIMESTAMP`,
            [collectionName, documentId, JSON.stringify(normalized)],
          );
          migrated++;
        }
      });
      report[collectionName] = { source: documents.length, migrated };
      console.log(`[Migration] ${collectionName}: ${migrated}/${documents.length}`);
    }

    await pool.query(
      `UPDATE omnix_migration_runs
       SET finished_at = CURRENT_TIMESTAMP, status = 'completed', collections = ?
       WHERE id = ?`,
      [JSON.stringify(report), runId],
    );
    console.log('\nMigration MongoDB → MySQL terminée. MongoDB n\'a pas été supprimée.');
  } catch (error: any) {
    await pool.query(
      `UPDATE omnix_migration_runs
       SET finished_at = CURRENT_TIMESTAMP, status = 'failed', collections = ?, error = ?
       WHERE id = ?`,
      [JSON.stringify(report), error?.message || String(error), runId],
    );
    throw error;
  } finally {
    await mongoose.disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[Migration] Échec :', error?.message || error);
  process.exitCode = 1;
});
