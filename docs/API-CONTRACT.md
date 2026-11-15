# API contract

All endpoints use JSON and same-origin session cookies. Reading dates are `YYYY-MM-DD` strings, values are integers in mg/dl, and IDs are UUID strings. Time-slot values and labels are defined in `shared/domain.js`.

## Authentication and configuration

| Endpoint | Request | Response |
|---|---|---|
| `GET /api/config` | Public | `{today, timeZone}` |
| `GET /api/health` | Public | `{status: "ok"}` after checking PostgreSQL |
| `GET /api/auth/me` | Authenticated | `{user: {id, name, email}, today, timeZone}` |
| `POST /api/auth/register` | `{name, email, password}` | Same user payload, `201`; establishes a session |
| `POST /api/auth/login` | `{email, password}` | Same user payload, `200`; establishes a fresh session |
| `POST /api/auth/logout` | No body required | `204`; destroys the session and clears its cookie |

Authenticated requests return `401` when no valid session exists. The authenticated user ID always comes from the session, never from caller-supplied fields. The fictional seeded account is `demo@sweety.example` / `SweetyDemo123!`.

## Reading operations

| Endpoint | Request | Response |
|---|---|---|
| `GET /api/readings?date=YYYY-MM-DD` | Selected date | `{date, readings: [{id, date, slot, value}]}` |
| `POST /api/readings` | `{date, slot, value}` | `{reading: {id, date, slot, value}}`, `201` |
| `PATCH /api/readings/:id` | Full editable payload `{date, slot, value}` | `{reading: {id, date, slot, value}}`, `200` |
| `DELETE /api/readings/:id` | Owned reading ID | `204` |

The body accepts numeric values only. The browser converts a nonblank form input to a number; the server independently validates it. No-op edits are allowed. For creates, the full-day error precedes the duplicate-slot error. Edits exclude the edited reading when checking the destination date's capacity and slot conflicts.

## Reports and chart data

`GET /api/reports?date=YYYY-MM-DD` returns:

```text
{date, today, timeZone, daily, monthToDate, previousMonth}
```

Every report object has the same shape:

```text
{
  startDate, endDate,
  count, min, max, average,
  readings: [{id, date, slot, value}]
}
```

- `daily` covers the selected date.
- `monthToDate` covers the first of the selected month through the selected date.
- `previousMonth` covers the entire calendar month before the selected date.
- Both ends of every date range are inclusive. `average` is numeric and rounded to one decimal; the interface displays one decimal place.
- Readings are ordered by date ascending, then Morning (fasting), After breakfast, After lunch, After dinner. On the daily report, this is simply slot order.
- All three arrays contain only the authenticated user's actual readings. Missing dates or slots have no placeholder or estimated rows. The chart preserves calendar spacing and breaks a slot's line when a date has no reading for that slot.
- Every summary and reading array is read inside one database snapshot, so the counts, values, and lists agree during concurrent edits.
- Empty reports return `count: 0`, `min: null`, `max: null`, `average: null`, and `readings: []`.

## Errors

Errors use `{error: {code, message, fields?}}`. `fields` maps relevant form field names to readable messages.

| Status | Meaning |
|---|---|
| `400` | Invalid value, date, slot, ID, credentials format, or JSON body |
| `401` | Missing/expired session or incorrect login credentials |
| `403` | Untrusted browser origin |
| `404` | Missing or unowned reading; unknown API endpoint |
| `409` | Duplicate email, occupied date/slot, or full day |
| `413` | Request body exceeds the allowed size |
| `429` | Authentication rate limit reached |
| `500` | Unexpected server failure with a generic public message |
