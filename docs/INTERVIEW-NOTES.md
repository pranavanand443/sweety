# Sweety: walkthrough and interview notes

## Overview

Sweety records up to four glucose readings per day, then summarizes them for the selected day, month to date, and previous month. React handles the forms and reports, Express checks requests and sessions, and PostgreSQL stores the data and enforces reading limits.

Codex assisted with implementation and review. These notes cover the decisions to understand and explain when discussing the code.

## Implementation choices

**Dates are calendar values.** A reading belongs to a date and a named slot, not a measurement timestamp. SQL `DATE` and unchanged `YYYY-MM-DD` strings avoid moving readings to another day during timezone conversion. The server determines today in Asia/Kolkata.

**The database enforces the limits.** A reading has one of four allowed slots. A unique constraint covers user, date, and slot. Together, these prevent both duplicate slots and a fifth daily reading. API validation adds readable error messages.

**Ownership comes from the session.** Each query includes the authenticated user's ID. An ID from the browser does not establish ownership. Attempts to edit or delete another user's reading return 404, and report queries filter by the same user ID.

**Sessions stay on the server.** The cookie contains a signed session identifier; PostgreSQL stores the session data. Bcrypt hashes passwords. Login creates a fresh session identifier, and logout removes the server-side session. Same-origin requests keep the browser configuration simple.

**A report has a precise range.** Daily is the selected day. Month-to-date starts on the first of that month and ends on the selected day. Monthly means the complete previous month. The average uses all readings directly, with one-decimal rounding.

**PostgreSQL also stores sessions.** This keeps the app to one database and one server. The required reading and report operations run directly in a request, so there is no queue or background worker.

## Questions to prepare for

1. **Why PostgreSQL when the brief says MERN?**  
   The brief explicitly requires PostgreSQL. Its constraints also fit the rule that each user can have only one reading per date and slot.

2. **What happens if two requests add the same slot at once?**  
   Each request locks the user's row inside a transaction. The second waits for the first, then sees the inserted reading and returns a conflict. The unique constraint also prevents duplicates if another code path bypasses this check.

3. **Why lock the user rather than only the reading?**  
   A new reading does not yet have a row to lock. Creates, edits, and deletes can all lock the existing user row. That also serializes changes to different dates for the same user, which is acceptable at this scale. A busier system could use a lock for each user and date.

4. **How do you prevent one user seeing another user's data?**  
   The API loads the user from the session and adds their ID to every list, update, delete, and aggregate query. Tests use two accounts, deliberately spoof a user ID, and attempt cross-user mutations.

5. **Why store sessions in PostgreSQL instead of browser local storage?**  
   PostgreSQL is already part of the app, and deleting a stored session takes effect immediately on logout. The browser receives an HttpOnly cookie, so application JavaScript cannot read the session identifier. There is no token-refresh flow to maintain.

6. **How did you handle dates and report boundaries?**  
   Strict calendar validation rejects impossible dates, while the server's configured timezone defines today. Date-only strings stay date-only in the database driver. Tests cover January rollover, February, leap years, both inclusive boundaries, and readings outside the selected range.

7. **Which tests matter most?**  
   The PostgreSQL API tests exercise the failures most likely to break the data: cross-user access, concurrent duplicate requests, full days, conflicting edits, and incorrect report totals. They also check password hashing and sessions. Shared tests cover dates and validation; form tests check errors and saving behavior. `npm run verify` runs the tests, lint, and production build together.

8. **What would you improve for a deployed product?**  
   Add account recovery, per-user timezones, exports, and more end-to-end browser coverage. For deployment, configure HTTPS and trusted proxy behavior, use a dedicated database role, and add monitoring and backups. Clinical interpretation would need separate requirements; this app only records and summarizes values.

## Two-minute demo flow

The demonstration is exactly 2:00, with application clips at their original speed and five-second opening and closing cards. See the [verification record](QA-REPORT.md#demonstration-video) for rendering and playback checks.

The recording uses the fictional demo account. The music and silent versions share the same visual sequence.

| Time | Show |
|---|---|
| 0:00–0:05 | Introduce Sweety and the stack. |
| 0:05–0:21 | Fill the fictional demo credentials and sign in. |
| 0:21–0:25 | Show the four daily slots and reading log. |
| 0:25–0:31 | Show inline feedback for a value below 40 mg/dl. |
| 0:31–0:37 | Save a valid reading and show the updated daily record. |
| 0:37–0:41 | Open an existing reading with its details filled in. |
| 0:41–0:46 | Save the correction and open the updated report. |
| 0:46–0:51 | Show daily average, highest, lowest, count, and readings. |
| 0:51–0:57 | Show the inclusive month-to-date period. |
| 0:57–1:03 | Inspect separate slot trends and missing-date gaps. |
| 1:03–1:09 | Show the complete previous calendar month and explicit dates. |
| 1:09–1:15 | Review the same records in the alternate appearance. |
| 1:15–1:20 | Open the chart's table of recorded values. |
| 1:20–1:25 | Return to the daily record. |
| 1:25–1:31 | Inspect the exact reading identified by the delete confirmation. |
| 1:31–1:36 | Confirm deletion and free its slot. |
| 1:36–1:42 | Show the report recalculated from the remaining readings. |
| 1:42–1:48 | Show an empty date and its next action. |
| 1:48–1:55 | Finish on the daily overview. |
| 1:55–2:00 | Close with the repository and verification information. |

Account isolation and the mobile layout are covered in the separate browser checks and screenshots. The automated tests cover the input and concurrency cases beyond this walkthrough.

## Before discussing the submission

- Run `npm run verify` and understand what each test group covers.
- Follow a reading from `ReadingForm` to the API route, transaction, and PostgreSQL constraint.
- Read the report query and calculate one sample average manually.
- Be ready to explain the previous-month interpretation and the single-timezone assumption.
- Describe the role of AI assistance accurately and identify the decisions you reviewed.
