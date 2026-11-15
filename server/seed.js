import 'dotenv/config';
import bcrypt from 'bcrypt';
import { pathToFileURL } from 'node:url';
import { createPool, transaction } from './db.js';
import { isValidDate, reportRanges, todayInZone, SLOTS } from '../shared/domain.js';

export const DEMO_EMAIL = 'demo@sweety.example';
export const DEMO_PASSWORD = 'SweetyDemo123!';

export async function seed(pool, referenceDate = todayInZone(process.env.APP_TIMEZONE || 'Asia/Kolkata')) {
  if (!isValidDate(referenceDate)) throw new Error('SEED_DATE must be a valid YYYY-MM-DD date.');
  const ranges = reportRanges(referenceDate);
  const fixtures = new Map();
  const add = (date, slotIndex, value) => fixtures.set(`${date}:${slotIndex}`, { date, slot: SLOTS[slotIndex].value, value });
  // A partial day invites a reviewer to add a reading; previous-month samples exercise reports.
  add(referenceDate, 0, 104);
  add(referenceDate, 1, 136);
  add(ranges.monthToDate.startDate, 0, 98);
  add(ranges.monthToDate.startDate, 2, 145);
  add(ranges.previousMonth.startDate, 0, 112);
  add(ranges.previousMonth.startDate, 1, 142);
  add(ranges.previousMonth.endDate, 2, 158);
  add(ranges.previousMonth.endDate, 3, 128);
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const result = await transaction(pool, async (db) => {
    // Reserved fictional account only; other accounts and their readings are never touched.
    const { rows: [user] } = await db.query('INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash RETURNING id', ['Alex Morgan', DEMO_EMAIL, passwordHash]);
    for (const fixture of fixtures.values()) {
      await db.query('INSERT INTO readings (user_id, reading_date, slot, value) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, reading_date, slot) DO UPDATE SET value = EXCLUDED.value, updated_at = now()', [user.id, fixture.date, fixture.slot, fixture.value]);
    }
    return { userId: user.id, referenceDate, readings: fixtures.size };
  });
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const pool = createPool(process.env.DATABASE_URL);
  try {
    const result = await seed(pool, process.env.SEED_DATE || undefined);
    console.log(`Fictional demo data ready for ${result.referenceDate}: ${result.readings} sample readings. Re-running the same reference date updates the same fixtures.`);
  } finally { await pool.end(); }
}
