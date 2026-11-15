import { loadConfig } from './config.js';
import { createPool } from './db.js';
import { createApp } from './app.js';

const config = loadConfig();
const pool = createPool(config.databaseUrl);
pool.on('error', (error) => console.error('Database connection error:', error.message));
await pool.query('SELECT 1');
const server = createApp({ pool, config }).listen(config.port, '0.0.0.0', () => {
  console.log(`Sweety API listening on port ${config.port} (${config.timeZone}).`);
});

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close(async () => { await pool.end(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
