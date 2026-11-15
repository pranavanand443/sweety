import pg from 'pg';

// A reading is a calendar date, never a timestamp. Preserve that distinction.
pg.types.setTypeParser(1082, (value) => value);

export function createPool(connectionString) {
  return new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
}

export async function transaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
