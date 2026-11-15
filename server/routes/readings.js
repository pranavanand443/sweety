import { Router } from 'express';
import { SLOTS, isValidDate, validateReading } from '../../shared/domain.js';
import { transaction } from '../db.js';
import { ApiError, validationError } from '../errors.js';

const slotValues = SLOTS.map((slot) => slot.value);
const columns = 'id, reading_date AS date, slot, value';

export function selectedDate(value, today) {
  if (!isValidDate(value)) throw validationError({ date: 'Please choose a valid date.' });
  if (value > today) throw validationError({ date: 'Date cannot be in the future.' });
  return value;
}

function readingId(value) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new ApiError(400, 'INVALID_ID', 'Please provide a valid reading ID.');
  }
  return value;
}

function notFound() { return new ApiError(404, 'READING_NOT_FOUND', 'This reading could not be found.'); }

function validateBody(body, today) {
  const fields = validateReading(body, today);
  if (Object.keys(fields).length) throw validationError(fields);
  return { date: body.date, slot: body.slot, value: body.value };
}

export async function dailyReadings(db, userId, date) {
  return rangeReadings(db, userId, date, date);
}

export async function rangeReadings(db, userId, startDate, endDate) {
  return (await db.query(`SELECT ${columns} FROM readings WHERE user_id = $1 AND reading_date BETWEEN $2::date AND $3::date ORDER BY reading_date, array_position($4::text[], slot)`, [userId, startDate, endDate, slotValues])).rows;
}

async function saveReading(pool, userId, input, id) {
  return transaction(pool, async (db) => {
    // All mutations for this user share a lock, so count checks also hold under concurrency.
    await db.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (id) {
      const existing = await db.query('SELECT id FROM readings WHERE id = $1 AND user_id = $2', [id, userId]);
      if (!existing.rowCount) throw notFound();
    }
    const { rows } = await db.query('SELECT slot FROM readings WHERE user_id = $1 AND reading_date = $2 AND ($3::uuid IS NULL OR id <> $3)', [userId, input.date, id || null]);
    if (rows.length >= 4) throw new ApiError(409, 'DAY_FULL', 'You can add only 4 readings per day.', { date: 'You can add only 4 readings per day.' });
    if (rows.some((row) => row.slot === input.slot)) {
      const label = SLOTS.find((slot) => slot.value === input.slot).label;
      throw new ApiError(409, 'DUPLICATE_SLOT', `You already have a reading for ${label} on this date.`, { slot: `You already have a reading for ${label} on this date.` });
    }
    const result = id
      ? await db.query(`UPDATE readings SET reading_date = $1, slot = $2, value = $3, updated_at = now() WHERE id = $4 AND user_id = $5 RETURNING ${columns}`, [input.date, input.slot, input.value, id, userId])
      : await db.query(`INSERT INTO readings (user_id, reading_date, slot, value) VALUES ($1, $2, $3, $4) RETURNING ${columns}`, [userId, input.date, input.slot, input.value]);
    return result.rows[0];
  });
}

export function readingsRouter({ pool, today, requireUser }) {
  const router = Router();
  router.use(requireUser);
  router.get('/', async (req, res) => {
    const date = selectedDate(req.query.date, today());
    res.json({ date, readings: await dailyReadings(pool, req.user.id, date) });
  });
  router.post('/', async (req, res) => {
    const input = validateBody(req.body, today());
    res.status(201).json({ reading: await saveReading(pool, req.user.id, input) });
  });
  router.patch('/:id', async (req, res) => {
    const id = readingId(req.params.id);
    const input = validateBody(req.body, today());
    res.json({ reading: await saveReading(pool, req.user.id, input, id) });
  });
  router.delete('/:id', async (req, res) => {
    const id = readingId(req.params.id);
    await transaction(pool, async (db) => {
      await db.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
      const result = await db.query('DELETE FROM readings WHERE id = $1 AND user_id = $2', [id, req.user.id]);
      if (!result.rowCount) throw notFound();
    });
    res.sendStatus(204);
  });
  return router;
}
