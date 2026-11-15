# Sweety

A small, considered glucose tracker: four daily time slots, clear validation, and reports that make recorded measurements easy to review. Built for the Kenpath full-stack assessment with JavaScript, React, Express, and PostgreSQL.

**[Repository](https://github.com/pranavanand443/sweety)** · **[Interview walkthrough](docs/INTERVIEW-NOTES.md)** · **[API contract](docs/API-CONTRACT.md)**

<!-- Insert the verified dashboard capture here: docs/screenshots/dashboard.jpg -->

## What it does

- Register and sign in with a persistent session; passwords are hashed with bcrypt.
- Add, edit, and delete readings in Morning (fasting), After breakfast, After lunch, and After dinner slots.
- Record whole numbers from **40–600 mg/dl**, with one reading per slot per day and no future dates.
- View daily, month-to-date, and previous-month reports with minimum, maximum, one-decimal average, and count.
- Use responsive layouts, keyboard-accessible forms, inline errors, and friendly empty states.
- Keep each user's readings private across list, edit, delete, and report queries.

## Quick start with Docker

Prerequisites: **Node.js 22.13 or later in the Node 22 series**, Git, and Docker with Compose. Start Docker before running these commands. The first build downloads images and dependencies.

```sh
git clone https://github.com/pranavanand443/sweety.git
cd sweety
node scripts/setup-env.js
docker compose up --build -d
docker compose exec app node server/seed.js
```

Open **http://localhost:4310**. The app waits for PostgreSQL and applies migrations before starting. If the seed command runs before the app has started, check `docker compose ps` and run the seed command again when it is running.

| Demo account | Value |
|---|---|
| Email | `demo@sweety.example` |
| Password | `SweetyDemo123!` |

The sign-in page can fill these credentials for you. All demo measurements are fictional. Create another account to start with an empty dashboard and check user isolation.

`docker compose down` stops the app and database while retaining readings in the named database volume. Avoid adding `--volumes` unless you intend to erase that local data.

If Docker is installed on macOS but its command or credential helper is missing from your shell, use this temporary shell setting before the Docker commands:

```sh
export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
```

## Local development

Run the client and server locally, with PostgreSQL in Docker:

```sh
npm ci
node scripts/setup-env.js
docker compose up -d db
npm run db:migrate
npm run db:seed
npm run dev
```

Open **http://localhost:5173**. Vite forwards `/api` to Express on port 4310. To run each process separately, use `npm run dev:server` and `npm run dev:client` in two terminals. If switching from the complete Docker setup, run `docker compose stop app` first to free port 4310.

PostgreSQL is exposed only on `127.0.0.1:54329`; the local databases are `sweety` and `sweety_test`. The Docker initialization script creates both on its first start. SQL migrations are versioned, transactional, and recorded in `schema_migrations`; rerunning `npm run db:migrate` applies only new migrations.

### Environment

[`.env.example`](.env.example) lists all settings. `node scripts/setup-env.js` copies it to `.env` and generates a random session secret, preserving an existing `.env`. Real `.env` files are ignored by Git and excluded from Docker builds.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Application PostgreSQL connection. |
| `TEST_DATABASE_URL` | Separate disposable test database; its name must end in `_test`. |
| `SESSION_SECRET` | Secret used to sign session IDs; at least 32 characters. |
| `PORT` | Express port; defaults to `4310`. |
| `APP_ORIGIN` | Comma-separated allowed browser origins; the example allows localhost and 127.0.0.1 on port 5173. |
| `APP_TIMEZONE` | Timezone defining today; defaults to `Asia/Kolkata`. |
| `COOKIE_SECURE` | `false` for the documented local HTTP setup; use `true` for HTTPS deployment. |
| `NODE_ENV` | Runtime environment; local development uses `development`. |
| `SEED_DATE` | Optional `YYYY-MM-DD` reference date for reproducible demo data; defaults to today. |

Compose supplies its own internal database URL, port-4310 origins, and local HTTP cookie setting. The sample database credentials are intended only for this localhost demonstration.

### Seed behavior

The seed creates the fictional Alex Morgan account, a partial current day, current-month readings, and previous-month readings. Running it again with the **same reference date** updates the same fixtures without creating duplicates. It resets the reserved demo account's password and fixture values; it does not clear other accounts or readings. Running with a different date adds that date's fixtures while retaining earlier ones.

For a repeatable reference date in development:

```sh
SEED_DATE=2026-11-15 npm run db:seed
```

## Verification

With dependencies installed and the Docker database running:

```sh
npm run verify
```

This runs linting, all tests, and the production frontend build. The API suite applies the real migrations to `TEST_DATABASE_URL` and clears only its disposable test fixtures between cases. It refuses an absent test URL, a database without the `_test` suffix, or a target identified as the application database. API tests are not silently skipped when PostgreSQL is unavailable.

| Command | Checks |
|---|---|
| `npm run test:unit` | Date/validation logic and reading-form behavior. |
| `npm run test:api` | Authentication, ownership, constraints, concurrency, reports, and seed behavior against PostgreSQL. |
| `npm run lint` | JavaScript and React rules. |
| `npm run build` | Production frontend compilation. |

If an older Docker volume lacks the test database, create it without deleting application data:

```sh
docker compose exec db createdb -U sweety sweety_test
```

GitHub Actions runs the same verification command with a dedicated PostgreSQL 17 service on pushes and pull requests.

### Assessment coverage

| Requirement | Automated evidence |
|---|---|
| Signup, bcrypt, sessions, logout | `tests/api.test.js` — Authentication and request boundaries. |
| User isolation, including guessed IDs | API case “keeps every operation and report isolated by authenticated user.” |
| Required value, integer range, date and slot validation | `tests/shared.test.js`, API validation cases, and `tests/ReadingForm.test.jsx`. |
| One slot per day; maximum four readings | API duplicate/full-day, concurrent duplicate, final-slot, and direct database-constraint cases. |
| Edit and delete behavior | API no-op edit, collision, date movement, deletion, and aggregate checks. |
| Exact report periods and arithmetic | API inclusive-range, year-rollover, leap-year, and empty-aggregate cases. |
| Repeatable demo seed | API case “re-seeds the same reference date without duplicates or changes to other users.” |
| Form errors and saving behavior | `tests/ReadingForm.test.jsx`. |

## How it is organized

```text
client/             React interface, forms, routing, and styles
server/             Express app, authentication, SQL queries, migrations, and seed
shared/domain.js    Slot definitions, date rules, and reading validation
tests/              Shared-logic, frontend, and real-database API tests
scripts/            Local environment and test database setup
docs/               API contract, walkthrough notes, and demonstration assets
```

React talks to the API through the same origin. Express identifies the user from a server-side session and applies that user's ID to each database operation. PostgreSQL stores users, readings, and sessions. In Docker, Express serves the built React app; development uses Vite's proxy.

The unique `(user_id, reading_date, slot)` constraint and four allowed slot values make a fifth reading impossible. A short transaction locks the user's row before checking conflicts, so simultaneous requests receive consistent duplicate/full-day errors. Parameterized queries protect query values. Reports use one read-only snapshot so their statistics and daily list agree during concurrent changes.

### API overview

All bodies and responses use JSON. Authenticated endpoints use the session cookie; they never accept a caller-supplied user ID as authorization.

| Method and path | Purpose |
|---|---|
| `GET /api/config` | Server-derived today and timezone. |
| `POST /api/auth/register`, `/api/auth/login` | Create or authenticate an account and establish a session. |
| `GET /api/auth/me`, `POST /api/auth/logout` | Restore or end a session. |
| `GET /api/readings?date=YYYY-MM-DD` | Read the signed-in user's daily readings. |
| `POST /api/readings` | Create a reading. |
| `PATCH /api/readings/:id`, `DELETE /api/readings/:id` | Change or delete an owned reading. |
| `GET /api/reports?date=YYYY-MM-DD` | Daily, month-to-date, and previous-month summaries. |
| `GET /api/health` | Check API/database connectivity. |

Create and edit payloads contain `{ "date": "2026-11-15", "slot": "morning_fasting", "value": 104 }`. Editing submits all three editable fields. Errors use `{ "error": { "code": "…", "message": "…", "fields": { "value": "…" } } }`, with `fields` supplied when relevant. See the [API contract](docs/API-CONTRACT.md) for response shapes and status codes.

## Notes and tradeoffs

- **Stack interpretation:** the brief says “MERN + PostgreSQL” and explicitly requests PostgreSQL, so this implementation uses React, Express, Node, and PostgreSQL.
- **Dates:** a reading is a calendar date, stored as SQL `DATE` and returned as `YYYY-MM-DD`, never converted through the machine's timezone. Today is determined in `Asia/Kolkata` for all users.
- **Reports:** for a selected date of 15 November, daily means 15 November, month-to-date means 1–15 November, and monthly means **1–31 October**. Both ends are inclusive. The UI calls the last report “Previous month.”
- **Empty statistics:** no readings means count zero and null minimum, maximum, and average. The UI displays an empty state rather than implying a glucose value of zero.
- **Averages:** every reading has equal weight; the average is rounded to one decimal, without averaging daily averages.
- **Validation precedence:** a create on a full day returns the daily-limit error; otherwise a duplicate slot returns a slot conflict. Edits exclude the row being edited, so an unchanged save on a full day works.
- **Authentication:** bcrypt uses cost 12; passwords must be at least eight characters and at most 72 UTF-8 bytes. Sessions use HttpOnly, SameSite=Lax cookies with login-time regeneration and server-side logout. JSON writes check browser origin; authentication attempts are rate-limited.
- **Scope:** Docker Compose and frontend form tests are included. Hosting, doctor access, Redis caching, reminders, and clinical interpretation are outside this submission. The app is a measurement record, with fictional data for its demonstration.
- **With more time:** add per-user timezones, account recovery, report export, broader browser automation, and a carefully labelled trend chart. Deployment would also need HTTPS/proxy configuration, operational monitoring, and a separate non-superuser database role.
- **AI assistance:** OpenAI Codex assisted with implementation, tests, documentation, and independent code review. This repository records that assistance openly; the accompanying walkthrough explains the decisions and tradeoffs for candidate review.
