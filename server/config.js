import 'dotenv/config';

export function loadConfig(env = process.env) {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required. Copy .env.example and configure PostgreSQL.');
  let database;
  try { database = new URL(databaseUrl); } catch { throw new Error('DATABASE_URL must be a valid PostgreSQL URL.'); }
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || !database.hostname || database.pathname.length < 2) {
    throw new Error('DATABASE_URL must identify a PostgreSQL host and database.');
  }
  const sessionSecret = env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters.');
  const port = Number(env.PORT || 4310);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
  const cookieSetting = env.COOKIE_SECURE ?? 'false';
  if (!['true', 'false'].includes(cookieSetting)) throw new Error('COOKIE_SECURE must be true or false.');
  const timeZone = env.APP_TIMEZONE || 'Asia/Kolkata';
  try { new Intl.DateTimeFormat('en', { timeZone }).format(new Date()); } catch { throw new Error('APP_TIMEZONE must be a valid IANA timezone.'); }
  const allowedOrigins = (env.APP_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4310,http://127.0.0.1:4310').split(',').map((value) => value.trim());
  if (!allowedOrigins.length || allowedOrigins.some((value) => {
    try { const url = new URL(value); return !['http:', 'https:'].includes(url.protocol) || url.origin !== value; } catch { return true; }
  })) throw new Error('APP_ORIGIN must contain comma-separated http(s) origins without trailing slashes.');
  return { databaseUrl, sessionSecret, port, cookieSecure: cookieSetting === 'true', timeZone, allowedOrigins, nodeEnv: env.NODE_ENV || 'development' };
}
