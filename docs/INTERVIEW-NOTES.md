# Sweety: walkthrough and interview notes

## A short introduction

Sweety records up to four glucose readings per day and summarizes them over three precise date ranges. The main engineering choices are database-enforced limits, explicit user ownership, and consistent calendar dates. React handles interaction; Express owns authentication and validation; PostgreSQL is the source of truth.

Use these notes to understand and explain the implementation in your own words. Codex assisted with the implementation and review; do not claim that tooling was not used.

## The important decisions

**Dates are calendar values.** A reading belongs to a date and a named slot, not a measurement timestamp. SQL `DATE` and unchanged `YYYY-MM-DD` strings avoid moving readings to another day during timezone conversion. The server determines today in Asia/Kolkata.

**The database enforces the limits.** A reading has one of four allowed slots. A unique constraint covers user, date, and slot. Together, these prevent both duplicate slots and a fifth daily reading. API validation supplies useful messages; it is not the only protection.

**Ownership comes from the session.** Each query includes the authenticated user's ID. An ID from the browser does not establish ownership. Attempts to edit or delete another user's reading return 404, and report queries filter by the same user ID.

**Sessions stay on the server.** The cookie contains a signed session identifier; PostgreSQL stores the session data. Bcrypt hashes passwords. Login creates a fresh session identifier, and logout removes the server-side session. Same-origin requests keep the browser configuration simple.

**A report has a precise range.** Daily is the selected day. Month-to-date starts on the first of that month and ends on the selected day. Monthly means the complete previous month. The average uses all readings directly, with one-decimal rounding.

**The project favors a small complete system.** A single Express application, one PostgreSQL database, and a React client are sufficient here. Redis and background jobs would add setup and failure modes without improving the required workflow.

## Eight likely questions

1. **Why PostgreSQL when the brief says MERN?**  
   Its explicit requirements call for PostgreSQL. Relational constraints also suit the one-user, one-date, one-slot rule directly.

2. **What happens if two requests add the same slot at once?**  
   Both mutations acquire a lock on the user's row inside a transaction. They are checked in order, so the later request sees the earlier insert. The unique constraint remains a final backstop if another code path bypasses the check.

3. **Why lock the user rather than only the reading?**  
   A new reading does not yet have a row to lock. Locking the existing user row gives creates, edits, and deletes a shared lock. This deliberately simple strategy is appropriate for at most four daily readings; higher-volume systems could use a narrower per-day lock.

4. **How do you prevent one user seeing another user's data?**  
   The API loads the user from the session and adds their ID to every list, update, delete, and aggregate query. Tests use two accounts, deliberately spoof a user ID, and attempt cross-user mutations.

5. **Why store sessions in PostgreSQL instead of browser local storage?**  
   It uses the database already required by the app and allows immediate server-side logout. HttpOnly cookies keep the session identifier unavailable to application JavaScript. It avoids adding token refresh logic or another service for this assessment.

6. **How did you handle dates and report boundaries?**  
   Strict calendar validation rejects impossible dates, while the server's configured timezone defines today. Date-only strings stay date-only in the database driver. Tests cover January rollover, February, leap years, both inclusive boundaries, and readings outside the selected range.

7. **Which tests matter most?**  
   The real PostgreSQL API tests cover bcrypt/session behavior, cross-user access, concurrent duplicates, full days, edit collisions, and exact report calculations. Shared tests cover date arithmetic and validation. Form tests cover how users see errors and saving behavior. Linting and the production build run in the same verification command.

8. **What would you improve for a deployed product?**  
   Add account recovery, per-user timezones, exports, and more end-to-end browser coverage. For deployment, configure HTTPS and trusted proxy behavior, use a dedicated database role, and add monitoring and backups. Clinical interpretation would need separate requirements; this app only records and summarizes values.

## Silent demo flow: approximately 2 minutes 40 seconds

Use only the seeded fictional account. Keep the pointer deliberate and pause briefly after each result.

| Time | Show |
|---|---|
| 0:00–0:20 | Sign-in page, fill demo credentials, sign in, and show the partial daily dashboard. |
| 0:20–0:45 | Open an empty slot; submit without a value and then with an out-of-range value to show inline validation. |
| 0:45–1:15 | Save a valid reading, edit its value, and show the updated reading log. |
| 1:15–1:35 | Delete that reading using the confirmation dialog; show that its slot becomes available. |
| 1:35–2:15 | Open daily, month-to-date, and previous-month reports. Pause on their date ranges and statistics. |
| 2:15–2:40 | Choose an empty day, show the helpful empty state, and finish on the responsive dashboard. |

During review, also create a second account and confirm that its dashboard starts empty. Screenshots should make the dashboard, reports, validation, empty state, and mobile layout readable independently of the recording.

## Before discussing the submission

- Run `npm run verify` and understand what each test group covers.
- Follow a reading from `ReadingForm` to the API route, transaction, and PostgreSQL constraint.
- Read the report query and calculate one sample average manually.
- Be ready to explain the previous-month interpretation and the single-timezone assumption.
- Describe the role of AI assistance accurately and identify the decisions you reviewed.
