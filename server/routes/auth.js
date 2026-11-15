import { Router } from 'express';
import bcrypt from 'bcrypt';
import { rateLimit } from 'express-rate-limit';
import { ApiError, validationError } from '../errors.js';

let dummyHash;
const hashForUnknownUser = () => (dummyHash ??= bcrypt.hash('This is not a user password.', 12));

function credentials(body, registering = false) {
  const fields = {};
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = body?.password;
  if (registering && (!name || name.length > 100)) fields.name = 'Please enter a name between 1 and 100 characters.';
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = 'Please enter a valid email address.';
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    fields.password = 'Password must be at least 8 characters and no more than 72 UTF-8 bytes.';
  }
  if (Object.keys(fields).length) throw validationError(fields);
  return { name, email, password };
}

async function signIn(req, user) {
  await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
  req.session.userId = user.id;
  await new Promise((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
}

export function authRouter({ pool, today, config, requireUser, authRateLimit = 30 }) {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: authRateLimit, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many sign-in attempts. Please try again in 15 minutes.' } }),
  });
  const payload = (user) => ({ user, today: today(), timeZone: config.timeZone });

  router.get('/me', requireUser, (req, res) => res.json(payload(req.user)));

  router.post('/register', limiter, async (req, res) => {
    const { name, email, password } = credentials(req.body, true);
    const passwordHash = await bcrypt.hash(password, 12);
    let user;
    try {
      ({ rows: [user] } = await pool.query('INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email', [name, email, passwordHash]));
    } catch (error) {
      if (error.code === '23505') throw new ApiError(409, 'EMAIL_EXISTS', 'An account already exists with this email.', { email: 'An account already exists with this email.' });
      throw error;
    }
    await signIn(req, user);
    res.status(201).json(payload(user));
  });

  router.post('/login', limiter, async (req, res) => {
    const { email, password } = credentials(req.body);
    const { rows: [stored] } = await pool.query('SELECT id, name, email, password_hash FROM users WHERE email = $1', [email]);
    const valid = await bcrypt.compare(password, stored?.password_hash || await hashForUnknownUser());
    if (!stored || !valid) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    const user = { id: stored.id, name: stored.name, email: stored.email };
    await signIn(req, user);
    res.json(payload(user));
  });

  router.post('/logout', async (req, res) => {
    await new Promise((resolve, reject) => req.session.destroy((error) => error ? reject(error) : resolve()));
    res.clearCookie('sweety.sid', { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, path: '/' });
    res.sendStatus(204);
  });
  return router;
}
