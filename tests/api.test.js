import 'dotenv/config';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { createApp } from '../server/app.js';
import { createPool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { SLOTS } from '../shared/domain.js';

const origin = 'http://localhost:5173';
const password = 'TestPassword123!';
const today = '2026-11-15';
const config = { sessionSecret: 'test-only-session-secret-at-least-32-characters', cookieSecure: false, timeZone: 'Asia/Kolkata', allowedOrigins: [origin], nodeEnv: 'test' };
let pool;
let app;
let serial = 0;

async function account() {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/register').set('Origin', origin).send({ name: 'Test Person', email: `person${++serial}@example.test`, password }).expect(201);
  return { agent, user: response.body.user, response };
}

const reading = (value = 120, slot = 'morning_fasting', date = today) => ({ date, slot, value });

async function insert(userId, date, slot, value) {
  return (await pool.query('INSERT INTO readings (user_id, reading_date, slot, value) VALUES ($1, $2, $3, $4) RETURNING id', [userId, date, slot, value])).rows[0].id;
}

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('API tests require TEST_DATABASE_URL pointing to a dedicated database ending in _test. See README.');
  const database = decodeURIComponent(new URL(url).pathname.slice(1));
  const applicationDatabase = process.env.DATABASE_URL ? decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.slice(1)) : null;
  // Reject matching database names even when URLs use different hosts, schemes or credentials.
  if (!database.endsWith('_test') || database === applicationDatabase) throw new Error('Refusing test cleanup: TEST_DATABASE_URL must point to a separate database ending in _test.');
  pool = createPool(url);
  await migrate(pool);
  app = createApp({ pool, config, now: () => new Date('2026-11-14T19:00:00Z'), authRateLimit: 1000 });
});

beforeEach(async () => { await pool.query('TRUNCATE sessions, readings, users CASCADE'); });
afterAll(async () => { if (pool) await pool.end(); });

describe('Authentication and request boundaries', { concurrent: false }, () => {
  it('exposes only public date configuration and requires authentication elsewhere', async () => {
    const { body } = await request(app).get('/api/config').expect(200);
    expect(body).toEqual({ today, timeZone: 'Asia/Kolkata' });
    await request(app).get('/api/auth/me').expect(401);
    await request(app).get(`/api/readings?date=${today}`).expect(401);
    await request(app).get(`/api/reports?date=${today}`).expect(401);
  });

  it('registers with bcrypt, normalizes email, and sets a protected local HTTP cookie', async () => {
    const agent = request.agent(app);
    const { body, headers } = await agent.post('/api/auth/register').set('Origin', origin).send({ name: ' Alex ', email: ' ALEX@Example.test ', password }).expect(201);
    expect(body.user).toMatchObject({ name: 'Alex', email: 'alex@example.test' });
    expect(Object.keys(body.user).sort()).toEqual(['email', 'id', 'name']);
    const stored = (await pool.query('SELECT password_hash FROM users WHERE id = $1', [body.user.id])).rows[0].password_hash;
    expect(stored).not.toBe(password);
    expect(bcrypt.getRounds(stored)).toBe(12);
    expect(await bcrypt.compare(password, stored)).toBe(true);
    expect(headers['set-cookie'][0]).toContain('HttpOnly');
    expect(headers['set-cookie'][0]).toContain('SameSite=Lax');
    expect(headers['set-cookie'][0]).not.toContain('Secure;');
    expect((await agent.get('/api/auth/me').expect(200)).body.user.id).toBe(body.user.id);
    await request(app).post('/api/auth/register').send({ name: 'Duplicate', email: 'alex@example.test', password }).expect(409);
  });

  it('logs out, rejects the old session, and signs in using a fresh session', async () => {
    const { agent, user, response } = await account();
    const oldCookie = response.headers['set-cookie'][0].split(';')[0];
    await agent.post('/api/auth/logout').set('Origin', origin).expect(204);
    expect((await pool.query('SELECT count(*)::int AS count FROM sessions')).rows[0].count).toBe(0);
    await request(app).get('/api/auth/me').set('Cookie', oldCookie).expect(401);
    await agent.get('/api/auth/me').expect(401);
    const signedIn = await agent.post('/api/auth/login').set('Origin', origin).send({ email: user.email, password }).expect(200);
    expect(signedIn.body.user.id).toBe(user.id);
    expect(signedIn.headers['set-cookie'][0].split(';')[0]).not.toBe(oldCookie);
  });

  it('rejects expired server sessions and invalidates a previous session when signing in again', async () => {
    const { agent, user, response } = await account();
    const originalCookie = response.headers['set-cookie'][0].split(';')[0];
    await agent.post('/api/auth/login').send({ email: user.email, password }).expect(200);
    await request(app).get('/api/auth/me').set('Cookie', originalCookie).expect(401);
    await agent.get('/api/auth/me').expect(200);
    await pool.query("UPDATE sessions SET expire = now() - interval '1 second' WHERE sess->>'userId' = $1", [user.id]);
    await agent.get('/api/auth/me').expect(401);
    await agent.post('/api/readings').send(reading()).expect(401);
  });

  it('uses the same incorrect-credentials response for an unknown account and wrong password', async () => {
    const { user } = await account();
    const wrong = await request(app).post('/api/auth/login').send({ email: user.email, password: 'WrongPassword123!' }).expect(401);
    const missing = await request(app).post('/api/auth/login').send({ email: 'unknown@example.test', password }).expect(401);
    expect(wrong.body).toEqual(missing.body);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('checks names, emails and bcrypt UTF-8 password length before registration', async () => {
    for (const payload of [
      { name: ' ', email: 'a@example.test', password },
      { name: 'Alex', email: 'invalid', password },
      { name: 'Alex', email: 'a@example.test', password: 'short' },
      { name: 'Alex', email: 'a@example.test', password: '🙂'.repeat(19) },
    ]) {
      const { body } = await request(app).post('/api/auth/register').send(payload).expect(400);
      expect(body.error.fields).toBeDefined();
    }
    expect((await pool.query('SELECT count(*)::int AS count FROM users')).rows[0].count).toBe(0);
  });

  it('rejects cross-origin writes, invalid JSON and non-JSON bodies', async () => {
    await request(app).post('/api/auth/register').set('Origin', 'https://untrusted.example').send({ name: 'Alex', email: 'a@example.test', password }).expect(403);
    await request(app).post('/api/auth/login').set('Sec-Fetch-Site', 'cross-site').send({ email: 'a@example.test', password }).expect(403);
    const invalidJson = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{broken').expect(400);
    expect(invalidJson.body).toEqual({ error: { code: 'INVALID_JSON', message: 'Please send valid JSON.' } });
    await request(app).post('/api/auth/login').type('form').send({ email: 'a@example.test', password }).expect(400);
    const unknown = await request(app).get('/api/not-an-endpoint').expect(404);
    expect(unknown.headers['content-type']).toContain('application/json');
  });

  it('rate-limits repeated authentication attempts', async () => {
    const limitedApp = createApp({ pool, config, authRateLimit: 2 });
    await request(limitedApp).post('/api/auth/login').send({}).expect(400);
    await request(limitedApp).post('/api/auth/login').send({}).expect(400);
    const { body } = await request(limitedApp).post('/api/auth/login').send({}).expect(429);
    expect(body.error.code).toBe('RATE_LIMITED');
  });

  it('treats SQL-like user text as data and rejects injected identifiers and dates', async () => {
    const agent = request.agent(app);
    const name = "Robert'); DROP TABLE users; --";
    const response = await agent.post('/api/auth/register').send({ name, email: 'text@example.test', password }).expect(201);
    expect(response.body.user.name).toBe(name);
    await agent.post('/api/readings').send(reading()).expect(201);
    await agent.get('/api/reports').query({ date: "2026-11-15' OR '1'='1" }).expect(400);
    await agent.delete("/api/readings/1%27%20OR%201%3D1").expect(400);
    await request(app).post('/api/auth/login').send({ email: "x'OR'1'='1@example.test", password }).expect(401);
    expect((await pool.query('SELECT count(*)::int AS count FROM users')).rows[0].count).toBe(1);
    expect((await agent.get(`/api/readings?date=${today}`).expect(200)).body.readings).toHaveLength(1);
  });
});

describe('Reading validation, ownership and concurrent changes', { concurrent: false }, () => {
  it('accepts inclusive 40 and 600 boundaries and retains date-only strings', async () => {
    const { agent } = await account();
    const low = await agent.post('/api/readings').send(reading(40)).expect(201);
    const high = await agent.post('/api/readings').send(reading(600, 'after_dinner')).expect(201);
    expect(low.body.reading).toMatchObject(reading(40));
    expect(high.body.reading).toMatchObject(reading(600, 'after_dinner'));
    const { body } = await agent.get(`/api/readings?date=${today}`).expect(200);
    expect(body.readings.map((row) => row.slot)).toEqual(['morning_fasting', 'after_dinner']);
  });

  it('rejects missing, nonnumeric, fractional and out-of-range readings without inserting', async () => {
    const { agent } = await account();
    for (const value of [undefined, null, '', '120', 39, 601, 120.5, true, [], {}]) {
      const { body } = await agent.post('/api/readings').send({ ...reading(), value }).expect(400);
      expect(body.error.fields.value).toBeTruthy();
    }
    expect((await pool.query('SELECT count(*)::int AS count FROM readings')).rows[0].count).toBe(0);
  });

  it('rejects invalid slots, impossible dates, timestamp strings and future dates', async () => {
    const { agent } = await account();
    for (const date of ['2026-02-29', '2026-11-31', '2026-1-01', '2026-11-15T00:00:00Z', '2026-11-16']) {
      const { body } = await agent.post('/api/readings').send(reading(120, 'morning_fasting', date)).expect(400);
      expect(body.error.fields.date).toBeTruthy();
    }
    await agent.post('/api/readings').send(reading(120, 'invalid_slot')).expect(400);
    await agent.get('/api/readings?date=invalid').expect(400);
    await agent.get('/api/reports?date=2026-11-16').expect(400);
    await agent.patch('/api/readings/not-a-uuid').send(reading()).expect(400);
    await agent.delete('/api/readings/not-a-uuid').expect(400);
  });

  it('enforces duplicate-slot and four-per-day errors in the documented order', async () => {
    const { agent } = await account();
    await agent.post('/api/readings').send(reading()).expect(201);
    const duplicate = await agent.post('/api/readings').send(reading()).expect(409);
    expect(duplicate.body.error.code).toBe('DUPLICATE_SLOT');
    for (const slot of SLOTS.slice(1)) await agent.post('/api/readings').send(reading(120, slot.value)).expect(201);
    const full = await agent.post('/api/readings').send(reading()).expect(409);
    expect(full.body.error.code).toBe('DAY_FULL');
    expect((await pool.query('SELECT count(*)::int AS count FROM readings')).rows[0].count).toBe(4);
  });

  it('keeps every operation and report isolated by authenticated user', async () => {
    const first = await account();
    const second = await account();
    const { body } = await first.agent.post('/api/readings').send({ ...reading(110), userId: second.user.id, user_id: second.user.id, id: second.user.id }).expect(201);
    await second.agent.post('/api/readings').send(reading(250)).expect(201);
    const secondList = await second.agent.get(`/api/readings?date=${today}`).expect(200);
    expect(secondList.body.readings.map((row) => row.value)).toEqual([250]);
    await second.agent.patch(`/api/readings/${body.reading.id}`).send(reading(300)).expect(404);
    await second.agent.delete(`/api/readings/${body.reading.id}`).expect(404);
    const report = await second.agent.get(`/api/reports?date=${today}`).expect(200);
    expect(report.body.daily).toMatchObject({ count: 1, average: 250 });
    expect((await first.agent.get(`/api/readings?date=${today}`)).body.readings[0].value).toBe(110);
  });

  it('allows no-op edits on a full day, prevents edit collisions and frees deleted slots', async () => {
    const { agent } = await account();
    const ids = [];
    for (const slot of SLOTS) ids.push((await agent.post('/api/readings').send(reading(120, slot.value)).expect(201)).body.reading.id);
    await agent.patch(`/api/readings/${ids[0]}`).send(reading()).expect(200);
    const collision = await agent.patch(`/api/readings/${ids[0]}`).send(reading(121, 'after_lunch')).expect(409);
    expect(collision.body.error.code).toBe('DUPLICATE_SLOT');
    await agent.delete(`/api/readings/${ids[0]}`).expect(204);
    await agent.delete(`/api/readings/${ids[0]}`).expect(404);
    await agent.post('/api/readings').send(reading(130)).expect(201);
    const { body } = await agent.get(`/api/reports?date=${today}`).expect(200);
    expect(body.daily).toMatchObject({ count: 4, min: 120, max: 130, average: 122.5 });
  });

  it('moves dates and slots while rejecting movement into a full destination day', async () => {
    const { agent, user } = await account();
    for (const slot of SLOTS) await insert(user.id, today, slot.value, 120);
    const created = await agent.post('/api/readings').send(reading(140, 'morning_fasting', '2026-11-14')).expect(201);
    const id = created.body.reading.id;
    const full = await agent.patch(`/api/readings/${id}`).send(reading(150)).expect(409);
    expect(full.body.error.code).toBe('DAY_FULL');
    await agent.patch(`/api/readings/${id}`).send(reading(150, 'after_dinner', '2026-11-13')).expect(200);
    expect((await agent.get('/api/readings?date=2026-11-14')).body.readings).toEqual([]);
    expect((await agent.get('/api/readings?date=2026-11-13')).body.readings[0].value).toBe(150);
  });

  it('serializes concurrent duplicate requests and persists exactly one reading', async () => {
    const { agent } = await account();
    const responses = await Promise.all([agent.post('/api/readings').send(reading(110)), agent.post('/api/readings').send(reading(120))]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(responses.find((response) => response.status === 409).body.error.code).toBe('DUPLICATE_SLOT');
    expect((await pool.query('SELECT count(*)::int AS count FROM readings')).rows[0].count).toBe(1);
  });

  it('allows only one concurrent request to fill the final daily slot', async () => {
    const { agent, user } = await account();
    for (const slot of SLOTS.slice(0, 3)) await insert(user.id, today, slot.value, 120);
    const responses = await Promise.all([agent.post('/api/readings').send(reading(130, 'after_dinner')), agent.post('/api/readings').send(reading(140, 'after_dinner'))]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(responses.find((response) => response.status === 409).body.error.code).toBe('DAY_FULL');
    expect((await pool.query('SELECT count(*)::int AS count FROM readings')).rows[0].count).toBe(4);
  });

  it('preserves both readings when concurrent edits compete for one destination slot', async () => {
    const { agent, user } = await account();
    const first = await insert(user.id, today, 'morning_fasting', 110);
    const second = await insert(user.id, today, 'after_breakfast', 120);
    const responses = await Promise.all([
      agent.patch(`/api/readings/${first}`).send(reading(130, 'after_lunch')),
      agent.patch(`/api/readings/${second}`).send(reading(140, 'after_lunch')),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(responses.find((response) => response.status === 409).body.error.code).toBe('DUPLICATE_SLOT');
    const { body } = await agent.get(`/api/readings?date=${today}`).expect(200);
    expect(body.readings).toHaveLength(2);
    expect(body.readings.filter((item) => item.slot === 'after_lunch')).toHaveLength(1);
    expect(body.readings.map((item) => item.id).sort()).toEqual([first, second].sort());
  });

  it('keeps database constraints as a backstop independent of the API', async () => {
    const { user } = await account();
    await insert(user.id, today, 'morning_fasting', 120);
    await expect(insert(user.id, today, 'morning_fasting', 140)).rejects.toMatchObject({ code: '23505' });
    await expect(insert(user.id, today, 'invalid', 120)).rejects.toMatchObject({ code: '23514' });
    await expect(insert(user.id, today, 'after_lunch', 601)).rejects.toMatchObject({ code: '23514' });
  });
});

describe('Report ranges, aggregates and reproducible demo data', { concurrent: false }, () => {
  it('returns empty aggregates with null statistics and no daily readings', async () => {
    const { agent } = await account();
    const { body } = await agent.get(`/api/reports?date=${today}`).expect(200);
    for (const key of ['daily', 'monthToDate', 'previousMonth']) expect(body[key]).toMatchObject({ count: 0, min: null, max: null, average: null, readings: [] });
  });

  it('calculates inclusive daily, month-to-date and previous-month ranges without leaking other rows', async () => {
    const { agent, user } = await account();
    const other = await account();
    await insert(user.id, '2026-11-14', 'after_dinner', 103);
    await insert(user.id, '2026-11-14', 'morning_fasting', 100);
    await insert(user.id, '2026-11-14', 'after_breakfast', 101);
    await insert(user.id, '2026-11-01', 'morning_fasting', 200);
    await insert(user.id, '2026-11-15', 'morning_fasting', 599);
    await insert(user.id, '2026-10-01', 'morning_fasting', 90);
    await insert(user.id, '2026-10-31', 'after_dinner', 150);
    await insert(user.id, '2026-09-30', 'after_dinner', 599);
    await insert(other.user.id, '2026-11-14', 'morning_fasting', 600);
    await insert(other.user.id, '2026-10-31', 'morning_fasting', 600);
    const { body } = await agent.get('/api/reports?date=2026-11-14').expect(200);
    expect(body.daily).toMatchObject({ startDate: '2026-11-14', endDate: '2026-11-14', count: 3, min: 100, max: 103, average: 101.3 });
    expect(body.daily.readings.map((row) => row.slot)).toEqual(['morning_fasting', 'after_breakfast', 'after_dinner']);
    expect(body.monthToDate).toMatchObject({ startDate: '2026-11-01', endDate: '2026-11-14', count: 4, min: 100, max: 200, average: 126 });
    expect(body.previousMonth).toMatchObject({ startDate: '2026-10-01', endDate: '2026-10-31', count: 2, min: 90, max: 150, average: 120 });
    expect(body.monthToDate.readings.map(({ date, slot, value }) => ({ date, slot, value }))).toEqual([
      { date: '2026-11-01', slot: 'morning_fasting', value: 200 },
      { date: '2026-11-14', slot: 'morning_fasting', value: 100 },
      { date: '2026-11-14', slot: 'after_breakfast', value: 101 },
      { date: '2026-11-14', slot: 'after_dinner', value: 103 },
    ]);
    expect(body.previousMonth.readings.map(({ date, slot, value }) => ({ date, slot, value }))).toEqual([
      { date: '2026-10-01', slot: 'morning_fasting', value: 90 },
      { date: '2026-10-31', slot: 'after_dinner', value: 150 },
    ]);
    for (const key of ['daily', 'monthToDate', 'previousMonth']) {
      expect(body[key].readings).toHaveLength(body[key].count);
      for (const item of body[key].readings) expect(Object.keys(item).sort()).toEqual(['date', 'id', 'slot', 'value']);
    }
  });

  it('handles year rollover and leap-year February in real PostgreSQL queries', async () => {
    const { agent, user } = await account();
    await insert(user.id, '2025-12-31', 'after_dinner', 123);
    await insert(user.id, '2024-02-29', 'after_dinner', 111);
    const january = await agent.get('/api/reports?date=2026-01-01').expect(200);
    expect(january.body.previousMonth).toMatchObject({ startDate: '2025-12-01', endDate: '2025-12-31', count: 1, average: 123 });
    const leap = await agent.get('/api/reports?date=2024-03-01').expect(200);
    expect(leap.body.previousMonth).toMatchObject({ startDate: '2024-02-01', endDate: '2024-02-29', count: 1, average: 111 });
    const ordinary = await agent.get('/api/reports?date=2025-03-01').expect(200);
    expect(ordinary.body.previousMonth.endDate).toBe('2025-02-28');
  });

  it('re-seeds the same reference date without duplicates or changes to other users', async () => {
    const { user } = await account();
    await insert(user.id, today, 'morning_fasting', 99);
    const first = await seed(pool, '2026-11-01');
    const second = await seed(pool, '2026-11-01');
    expect(second).toEqual(first);
    expect((await pool.query('SELECT count(*)::int AS count FROM readings WHERE user_id = $1', [first.userId])).rows[0].count).toBe(first.readings);
    expect((await pool.query('SELECT value FROM readings WHERE user_id = $1', [user.id])).rows).toEqual([{ value: 99 }]);
    await request(app).post('/api/auth/login').send({ email: 'demo@sweety.example', password: 'SweetyDemo123!' }).expect(200);
  });

  it.each(['2026-01-01', '2024-03-01', '2026-11-15'])('seeds spaced chart data safely at the month/year boundary for %s', async (referenceDate) => {
    const result = await seed(pool, referenceDate);
    const { rows } = await pool.query('SELECT reading_date AS date, slot, value FROM readings WHERE user_id = $1 ORDER BY reading_date, slot', [result.userId]);
    const current = rows.filter((item) => item.date.slice(0, 7) === referenceDate.slice(0, 7));
    const previous = rows.filter((item) => item.date.slice(0, 7) !== referenceDate.slice(0, 7));
    expect(rows).toHaveLength(result.readings);
    expect(new Set(current.map((item) => item.date)).size).toBe(Math.min(Number(referenceDate.slice(8)), 7));
    expect(new Set(previous.map((item) => item.date)).size).toBe(10);
    expect(current.filter((item) => item.date === referenceDate)).toEqual([
      { date: referenceDate, slot: 'after_breakfast', value: 136 },
      { date: referenceDate, slot: 'morning_fasting', value: 104 },
    ]);
    expect(previous.length).toBeLessThan(40);
    expect(rows.every((item) => item.date <= referenceDate && Number.isInteger(item.value) && item.value >= 40 && item.value <= 600)).toBe(true);
    if (referenceDate === '2026-01-01') expect(previous.at(-1).date).toBe('2025-12-31');
    if (referenceDate === '2024-03-01') expect(previous.at(-1).date).toBe('2024-02-29');
  });
});
