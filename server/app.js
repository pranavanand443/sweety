import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { todayInZone } from '../shared/domain.js';
import { ApiError } from './errors.js';
import { authRouter } from './routes/auth.js';
import { readingsRouter } from './routes/readings.js';
import { reportsRouter } from './routes/reports.js';

export function createApp({ pool, config, now = () => new Date(), authRateLimit = 30, logger = console, staticDirectory = fileURLToPath(new URL('../dist/', import.meta.url)) }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } }));
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use('/api', (req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('Origin');
    if ((origin && !config.allowedOrigins.includes(origin)) || req.get('Sec-Fetch-Site') === 'cross-site') {
      return next(new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'This request came from an untrusted origin.'));
    }
    if ((Number(req.headers['content-length']) > 0 || req.headers['transfer-encoding']) && !req.is('application/json')) {
      return next(new ApiError(400, 'JSON_REQUIRED', 'Please send a JSON request.'));
    }
    next();
  });
  app.use(express.json({ limit: '16kb' }));
  const Store = connectPgSimple(session);
  const sessionStore = new Store({ pool, tableName: 'sessions', createTableIfMissing: false, pruneSessionInterval: config.nodeEnv === 'test' ? false : 15 * 60 });
  app.use('/api', session({
    store: sessionStore, name: 'sweety.sid', secret: config.sessionSecret,
    resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' },
  }));
  const today = () => todayInZone(config.timeZone, now());
  const requireUser = async (req, _res, next) => {
    if (!req.session.userId) throw new ApiError(401, 'UNAUTHORIZED', 'Please sign in to continue.');
    const { rows: [user] } = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [req.session.userId]);
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Please sign in to continue.');
    req.user = user;
    next();
  };
  const dependencies = { pool, config, today, requireUser, authRateLimit };
  app.get('/api/config', (_req, res) => res.json({ today: today(), timeZone: config.timeZone }));
  app.get('/api/health', async (_req, res) => { await pool.query('SELECT 1'); res.json({ status: 'ok' }); });
  app.use('/api/auth', authRouter(dependencies));
  app.use('/api/readings', readingsRouter(dependencies));
  app.use('/api/reports', reportsRouter(dependencies));
  app.use('/api', (_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'This API endpoint does not exist.')));
  if (existsSync(join(staticDirectory, 'index.html'))) {
    app.use(express.static(staticDirectory));
    app.get('/{*path}', (_req, res) => res.sendFile(join(staticDirectory, 'index.html')));
  }
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') error = new ApiError(400, 'INVALID_JSON', 'Please send valid JSON.');
    if (error.type === 'entity.too.large') error = new ApiError(413, 'REQUEST_TOO_LARGE', 'This request is too large.');
    if (error.code === '23505') error = new ApiError(409, 'DUPLICATE_SLOT', 'A reading already exists for this date and time slot.');
    if (!(error instanceof ApiError)) {
      logger.error('Request failed:', error.message);
      error = new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
    }
    res.status(error.status).json({ error: { code: error.code, message: error.message, ...(error.fields && { fields: error.fields }) } });
  });
  return app;
}
