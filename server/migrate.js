import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { createPool } from './db.js';

const directory = fileURLToPath(new URL('./migrations/', import.meta.url));

export async function migrate(pool) {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(816331920)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    const files = (await readdir(directory)).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
    const completed = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((row) => row.name));
    for (const name of files) {
      if (completed.has(name)) continue;
      const sql = await readFile(join(directory, name), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    try { await client.query('SELECT pg_advisory_unlock(816331920)'); }
    finally { client.release(); }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const pool = createPool(process.env.DATABASE_URL);
  try { await migrate(pool); console.log('Database migrations are up to date.'); }
  finally { await pool.end(); }
}
