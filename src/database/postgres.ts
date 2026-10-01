import { Pool, PoolClient } from 'pg';

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export const postgresEnabled = Boolean(connectionString);

export const pool = connectionString
  ? new Pool({
      connectionString,
      max: Number(process.env.POSTGRES_POOL_MAX || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
      ssl: /sslmode=require/i.test(connectionString) || process.env.POSTGRES_SSL === 'true'
        ? { rejectUnauthorized: process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED !== 'false' }
        : undefined,
    })
  : null;

export async function query<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  if (!pool) throw new Error('DATABASE_URL/POSTGRES_URL is not configured.');
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  if (!pool) throw new Error('DATABASE_URL/POSTGRES_URL is not configured.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const value = await fn(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function checkPostgres(): Promise<{ connected: boolean; version?: string; error?: string }> {
  if (!pool) return { connected: false, error: 'DATABASE_URL/POSTGRES_URL absent' };
  try {
    const rows = await query<{ version: string }>('SELECT version()');
    return { connected: true, version: rows[0]?.version };
  } catch (error: any) {
    return { connected: false, error: error?.message || String(error) };
  }
}

if (process.argv.includes('--status')) {
  checkPostgres().then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.connected ? 0 : 1;
  });
}
