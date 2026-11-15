# Verification record

## Final source rehearsal — 15 November 2026, 16:14 IST

Commit **`55d0c0d0d593d13493a2a329a344b630bb1a1395`** passed an independent clean-source rehearsal, including the integrated monthly chart, light/dark themes, expanded seed, and session-expiry handling.

The source was exported from that exact commit into a separate directory. Dependencies were installed from the lockfile with an empty npm cache; no existing `node_modules`, build output, or `.env` was copied. After verification, all **49 committed files** still matched the source commit byte for byte.

The rehearsal used Node **22.14.0**, npm **10.9.2**, and PostgreSQL **17**. Two new empty databases, `sweety_final_rehearsal` and `sweety_final_rehearsal_test`, isolated both the application fixtures and test cleanup from normal application data. The built server used temporary port **4321**, leaving the main app on 4310 untouched.

| Check | Observed result |
|---|---|
| `npm ci` with an empty cache | Passed; 352 packages installed. npm reported zero known vulnerabilities at installation time. |
| `node scripts/setup-env.js`, twice | Created a local environment file with a random secret, then preserved it on the second invocation. |
| `npm run db:migrate`, twice | Passed; one migration record remained. |
| `npm run db:seed`, twice for 15 November | Passed; one demo user and 56 readings remained, with zero duplicate date/slot combinations. |
| `npm run lint` | Passed. |
| `npm test` | **80 tests passed across five test files** against the separate PostgreSQL test database. |
| `npm run build` | Passed; production frontend generated successfully. |
| Cleanup safety checks | The API test harness refused a missing test URL, a target without the `_test` suffix, and the same database named through different host/protocol aliases. |
| Source integrity | All committed files unchanged by installation, migration, seed, tests, or build. |

The complete `npm run verify` command passed. Coverage includes authentication and bcrypt, session renewal/invalidation, ownership, input boundaries, concurrent writes, four-reading limits, edits/deletes, report arithmetic and boundaries, seed idempotence, reading-form errors, theme persistence/storage failures, and chart geometry/accessibility.

## Running-build HTTP checks

The freshly built app was started using `npm start`, exercised through real HTTP requests, and stopped after the checks. Only fictional rehearsal accounts were used.

- Database health, the built SPA page, and the saved-theme script returned 200. The page's security policy permits the same-origin theme script.
- Unknown API endpoints returned JSON 404 responses. An untrusted browser origin was rejected with 403.
- The demo account logged in and received an HttpOnly, SameSite=Lax session cookie.
- A new account started with no readings. Invalid input produced field errors; create, edit, and delete succeeded, with report totals updating after each mutation.
- Attempting to edit the new account's reading from the demo account returned 404.
- Logout returned 204; reusing the old session returned 401.
- Every report included exactly as many individual readings as its count.

Fresh demo fixtures produced these reports:

| Report | Inclusive period | Count | Average (mg/dl) |
|---|---|---:|---:|
| Daily | 15 November 2026 | 2 | 120.0 |
| Month to date | 1–15 November 2026 | 22 | 131.2 |
| Previous month | 1–31 October 2026 | 34 | 134.1 |

These HTTP checks validate startup and API integration. The separate browser walkthrough is recorded below.

## Browser and responsive checks

A recorded manual walkthrough in Chrome passed registration into an independent empty account, sign-in errors, sign-out, and the complete reading workflow. All four slot controls and every reading-row Edit/Delete control were exercised. Checks included unchanged and conflicting edits, keeping or deleting a reading, previous/next dates, all report tabs, a known **216.8 mg/dl** average, and deletion updating a report to its empty state.

- **Validation:** required values, range limits, decimals, duplicate slots, a full day, and future dates entered with the native date control produced the expected feedback. Impossible calendar dates and additional request-level boundaries are covered by the automated API/shared tests.
- **Sessions and appearance:** dark mode survived reload. Signing out in another tab and then saving an open edit returned to sign-in with an expired-session explanation.
- **Keyboard:** report-tab navigation worked; Escape closed a dialog and restored focus to its originating Edit control. A chart point exposed its exact reading, and the previous-month table exposed all 34 readings.
- **Recovery:** the connection-failure **Try again** control restored the app after a server restart; **Reload readings** recovered an interrupted data request.
- **Mobile interactions:** edit and delete-cancellation flows worked in the dark mobile layout.

The dashboard and dark reports page were each checked in a responsive browser viewport at **320, 375, 390, 768, 1024, 1280, 1440, and 1920 px**. All 16 page/width checks recorded no horizontal document overflow. These are viewport checks, not claims of physical-device testing.

[Captured screenshots](screenshots/) cover the light and dark dashboard, month-to-date report, validation, empty state, and mobile dashboard/reports. All seven were independently inspected at full size for readable content and unrelated private information; no issue was found. The [README gallery](../README.md#screenshots-and-demonstration) makes them easy to inspect.

## Docker image and Compose runtime

The same source export completed the full multi-stage Docker build, including a fresh container dependency installation, frontend compilation, production dependency pruning, and the final non-root runtime image.

- Local image tag: `sweety:verified-55d0c0d`.
- Image configuration digest: `sha256:31fada746f24b484d7f1de8f2d96985c6dc023ede9bb9a3969edde7b48938efb`.
- The generated frontend asset names and sizes matched the local production build.
- `.env`, dependencies, Git metadata, and demonstration media were excluded from the Docker build context by `.dockerignore`.

The verified image was then tagged `sweety-app:latest` and started with `docker compose up --no-build`. Both the app and PostgreSQL reported healthy. The browser walkthrough, screenshots, and recording source use this built application on port 4310.

For a recovery check, the application container was deliberately stopped. Reloading produced the expected connection error; restarting the container and selecting **Reload readings** restored the application. The production Compose services were left running after the check.

## Source and presentation review

Selected credential-pattern checks found no private-key headers, GitHub tokens, AWS access keys, OpenAI keys, Google API keys, or personal absolute paths in the frozen public source. Repository history was also checked for selected key/token patterns and sensitive environment/key filenames. The real `.env`, dependencies, build output, and working capture directory are ignored by Git.

Color calculations checked the actual light/dark role tokens. The corrected secondary text is at least **4.60:1** on its used pale backgrounds; chart series are **4.75–4.99:1** against the light surface and **7.17–8.43:1** against the dark surface. Text, button, error, and focus colors were also reviewed. These calculations do not replace rendered layout and keyboard checks.

## GitHub Actions

The final source commit passed [Verify Sweety — run 43705626464](https://github.com/pranavanand443/sweety/actions/runs/43705626464). All job steps completed successfully, including locked dependency installation, lint, PostgreSQL tests, and the production build. The downloaded job log confirms **80 passing tests across five files** for commit `55d0c0d0d593d13493a2a329a344b630bb1a1395`.

The earlier baseline commit `2a3f37ce18064e32336cb89cf93735363e3a1dfe` passed [workflow run 43703321210](https://github.com/pranavanand443/sweety/actions/runs/43703321210), with 61 tests. That result applies only to the baseline; the latest independent local result above is 80 tests.

## Demonstration video

[The two-minute walkthrough with music](demo.mp4) and [its silent version](demo-silent.mp4) were rendered from the real application recording. All 18 application clips retain their original 1× interaction speed; the edit removes idle portions and adds explanatory captions. It uses fictional demo data.

| Property | Observed result |
|---|---|
| Duration | Both files are exactly **120.000 seconds (2:00)**. |
| Video | H.264, 1920×1080, yuv420p, 30 fps, 3,600 frames. |
| Music version | AAC stereo audio at 48 kHz; original procedural music only, with no microphone or system audio. |
| Final audio level | **−24.9 LUFS** integrated, 5.5 LU loudness range, **−11.0 dBFS** true peak. |
| Silent version | No audio stream; its video-stream SHA-256 matches the music version exactly. |
| Structural verification | Complete decode passed in the assembly checks; independent metadata and stream-hash checks agreed. |
| Visual spot-check | Seventeen final frames at 3, 13, 28, 34, 39, 48, 54, 60, 66, 72, 77, 83, 88, 99, 105, 112 and 118 seconds matched the captions and scenes. |
| Black-frame check | No full-frame black segment of 0.1 seconds or longer was detected across the complete video. |
| Full browser playback | Chrome recorded a played range of **0–120 seconds**, at 1× speed, with sound enabled and no media error. The player was subsequently restarted and paused. |

The sampled frames show readable captions and application content without accidental blank frames, overlay collisions, browser chrome, or unrelated private information. Intro and closing cards are intentional. The closing card reads “Four daily slots. Three report views.” Both appearances are visible, while the captions stay focused on the reading workflow.

The complete played range establishes full playback even though the player was later restarted; this result does not rely on its final paused position or `ended` flag. Archive integrity is checked separately when the delivery package is assembled.

## Verification boundaries

- This record identifies the exact source tested. Later source changes need appropriate checks before inheriting these results.
- The fresh-source rehearsal validates installation, environment setup, migrations, seeding, tests, production build, HTTP integration, and Docker image construction. The subsequent Compose startup and recovery check are recorded above.
- Browser coverage above records the observed workflows and viewport checks; it does not claim exhaustive UI input testing.
- Video metadata, decoding, sampled visual checks, and full playback coverage are recorded above. Media-package integrity is a separate check for the assembled delivery archive.
