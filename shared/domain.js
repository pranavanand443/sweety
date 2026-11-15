export const SLOTS = Object.freeze([
  { value: 'morning_fasting', label: 'Morning (fasting)', shortLabel: 'Morning', description: 'Before your first meal' },
  { value: 'after_breakfast', label: 'After breakfast', shortLabel: 'Breakfast', description: 'After your morning meal' },
  { value: 'after_lunch', label: 'After lunch', shortLabel: 'Lunch', description: 'After your midday meal' },
  { value: 'after_dinner', label: 'After dinner', shortLabel: 'Dinner', description: 'After your evening meal' },
]);

export function todayInZone(timeZone = 'Asia/Kolkata', now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

export function reportRanges(date) {
  if (!isValidDate(date)) throw new Error('Invalid report date.');
  const [year, month] = date.split('-').map(Number);
  const previousYear = month === 1 ? year - 1 : year;
  const previousMonth = month === 1 ? 12 : month - 1;
  const prefix = `${String(previousYear).padStart(4, '0')}-${String(previousMonth).padStart(2, '0')}`;
  const leap = previousYear % 4 === 0 && (previousYear % 100 !== 0 || previousYear % 400 === 0);
  const lastDay = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][previousMonth - 1];
  return {
    daily: { startDate: date, endDate: date },
    monthToDate: { startDate: `${date.slice(0, 7)}-01`, endDate: date },
    previousMonth: { startDate: `${prefix}-01`, endDate: `${prefix}-${lastDay}` },
  };
}

export function validateReading(input, today = todayInZone()) {
  const fields = {};
  if (!input || !isValidDate(input.date)) fields.date = 'Please choose a valid date.';
  else if (input.date > today) fields.date = 'Date cannot be in the future.';
  if (!SLOTS.some((slot) => slot.value === input?.slot)) fields.slot = 'Please choose a time slot.';
  if (input?.value === '' || input?.value == null) fields.value = 'Please enter a glucose value.';
  else if (typeof input.value !== 'number' || !Number.isInteger(input.value) || input.value < 40 || input.value > 600) fields.value = 'Value must be a whole number between 40 and 600 mg/dl.';
  return fields;
}
