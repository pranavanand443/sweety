import { Router } from 'express';
import { reportRanges } from '../../shared/domain.js';
import { dailyReadings, selectedDate } from './readings.js';

// PostgreSQL names astronomical year zero "1 BC"; ordinary app dates stay ISO strings.
const sqlDate = (date) => date.startsWith('0000-') ? `${date.replace(/^0000/, '0001')} BC` : date;

export function reportsRouter({ pool, today, config, requireUser }) {
  const router = Router();
  router.use(requireUser);
  router.get('/', async (req, res) => {
    const currentDate = today();
    const date = selectedDate(req.query.date, currentDate);
    const ranges = reportRanges(date);
    const reports = {};
    // One read-only snapshot keeps statistics and daily rows consistent during a concurrent edit.
    const db = await pool.connect();
    try {
      await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      for (const [name, range] of Object.entries(ranges)) {
        const { rows: [summary] } = await db.query('SELECT count(*)::int AS count, min(value) AS min, max(value) AS max, round(avg(value), 1)::float8 AS average FROM readings WHERE user_id = $1 AND reading_date BETWEEN $2::date AND $3::date', [req.user.id, sqlDate(range.startDate), sqlDate(range.endDate)]);
        reports[name] = { ...range, ...summary };
      }
      reports.daily.readings = await dailyReadings(db, req.user.id, date);
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally { db.release(); }
    res.json({ date, today: currentDate, timeZone: config.timeZone, ...reports });
  });
  return router;
}
