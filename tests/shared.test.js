import { describe, expect, it } from 'vitest';
import { isValidDate, reportRanges, todayInZone, validateReading } from '../shared/domain.js';

describe('calendar semantics', () => {
  it.each(['2026-02-30', '2025-02-29', '2026-00-10', '2026-13-01', '2026-1-01', '', null, '0000-01-01'])('rejects invalid date %s', (value) => expect(isValidDate(value)).toBe(false));
  it.each(['2024-02-29', '2000-02-29', '2026-11-15', '0096-02-29'])('accepts real date %s', (value) => expect(isValidDate(value)).toBe(true));
  it('handles January rollover and inclusive month-to-date', () => {
    expect(reportRanges('2026-01-15')).toEqual({ daily: { startDate: '2026-01-15', endDate: '2026-01-15' }, monthToDate: { startDate: '2026-01-01', endDate: '2026-01-15' }, previousMonth: { startDate: '2025-12-01', endDate: '2025-12-31' } });
  });
  it.each([['2024-03-05', '2024-02-29'], ['2025-03-01', '2025-02-28'], ['1900-03-01', '1900-02-28'], ['0096-03-01', '0096-02-29']])('handles previous month for %s', (date, end) => expect(reportRanges(date).previousMonth.endDate).toBe(end));
  it('uses IST at the UTC day boundary', () => expect(todayInZone('Asia/Kolkata', new Date('2026-11-14T18:31:00Z'))).toBe('2026-11-15'));
});

describe('shared reading validation', () => {
  const base = { date: '2026-11-15', slot: 'morning_fasting', value: 100 };
  it.each([40, 600])('accepts inclusive boundary %s', (value) => expect(validateReading({ ...base, value }, '2026-11-15')).toEqual({}));
  it.each([39, 601, 100.1, '100', 'oops', NaN])('rejects value %s', (value) => expect(validateReading({ ...base, value }, '2026-11-15')).toHaveProperty('value'));
  it.each(['', null, undefined])('requires a value', (value) => expect(validateReading({ ...base, value }, '2026-11-15').value).toBe('Please enter a glucose value.'));
  it('rejects future dates and unknown slots', () => expect(validateReading({ ...base, date: '2026-11-16', slot: 'midnight' }, '2026-11-15')).toEqual({ date: 'Date cannot be in the future.', slot: 'Please choose a time slot.' }));
});
