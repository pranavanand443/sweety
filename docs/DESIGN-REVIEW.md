# Sweety design review

Reviewed on 15 November 2026 with Hallmark 2.0.0, at **polish** depth and **app** scope, followed by separate browser checks.

## Intent and preserved behavior

The app serves a person recording glucose readings and an evaluator checking the assessment. The primary action is to record a reading for a date and time slot. The existing calm teal direction, sidebar, daily slots, report panels, routes, forms, validation and API calls remain.

The added theme control appears at the top right of authentication and application screens. It defaults to light, saves `sweety.theme` locally and supports dark mode. A small external script applies the saved theme before the app renders, without requiring an inline-script exception to the server's security policy. Storage failures leave the control usable for the current page.

## Findings addressed

- Replaced promotional headings and encouragement with labels tied to the task: Daily readings, Daily time slots and specific empty states.
- Removed decorative eyebrow copy, tracked capital labels, ornamental navigation dots and arrow suffixes.
- Consolidated colors and font stacks into role-named tokens. Light and dark palettes share the same roles.
- Improved text and input-edge contrast, added immediate keyboard focus and active states, expanded small icon hit targets and retained reduced-motion support.
- Cleared passwords when switching between sign-in and sign-up, and returned expired save/delete sessions to sign-in with an explicit notice.
- Added tabular numerals to measurements and report statistics, and arrow/Home/End keyboard navigation to report tabs.
- Replaced the decorative auth trend with the four actual reading slots. It makes no claim about a patient's trend or outcome.
- Preserved the layout while removing decorative hover movement, backdrop blur and redundant shadow treatments.

## Verification and limits

| Check | Recorded result |
| --- | --- |
| Initial static Hallmark sweep | 268 Floor findings, 204 Reflex findings, 33 warnings |
| Final static Hallmark sweep | See `.hallmark/after-static.json`; no open static Floor or Reflex findings at this review |
| Preserved source wiring | Extractor retained 4/4 links and 40/41 exact handler strings; the auth-switch handler was deliberately replaced to clear the password and is recorded in the stamp |
| Frontend component tests | 10 reading-form, 3 theme-preference, and 10 chart tests passed |
| Frontend lint and production build | Passed |
| Hallmark render tier | Not run |
| Separate browser checks | Chrome workflows and eight responsive widths passed; see the [QA report](QA-REPORT.md#browser-and-responsive-checks) |

The static extractor did not count React fields; its link/handler numbers do not prove full functional coverage. The existing form tests and browser checks provide that evidence. Likewise, no open static findings does not establish rendered contrast, responsive behavior or keyboard usability.

Rendered checks were performed separately; see the [QA report](QA-REPORT.md#browser-and-responsive-checks). Hallmark's render tier was not run, and no Hallmark rendered comparison is claimed.

The sweep retains 220 notes under polish scope, predominantly existing spacing values, including the separately added chart source. These were preserved rather than reported as fixed. Finish comments explain the quiet secondary controls and unfilled empty-state icons. The brief save/delete status is retained as a live server-confirmation announcement after the dialog closes; this is a documented exception to Hallmark's preference against visible-success toasts.

## Improvements requiring a deeper redesign

- Reconsider whether a permanent sidebar is needed for two destinations. A compact navigation bar could return more space to readings, but would change the existing shell.
- Consider inline editing in the reading log instead of a dialog. The current native dialog preserves focus trapping and existing workflows.
- Rationalize spacing and the type scale across all breakpoints in a dedicated system pass. This polish keeps the page composition.
- If the auth visual needs more product evidence, replace the factual slot diagram with a real application capture after final UI review. No invented measurements should be introduced.

## Completed browser review

- Chrome: registration into an empty account, wrong-password feedback, sign-out, all four reading slots, every row's Edit/Delete controls, unchanged/conflicting edits, and delete/keep behavior.
- Validation: missing, out-of-range, decimal, duplicate, full-day and future-date feedback. Impossible-date coverage remains in the API/shared tests.
- Reports: all three periods, date navigation, a known average, deletion to an empty state, keyboard tab navigation, exact chart-point values, and the complete 34-reading previous-month table.
- Sessions and focus: dark preference after reload, expired-session feedback during an edit, and focus returning to the originating Edit control after Escape.
- Recovery: successful retry after server restart and reload after an interrupted readings request.
- Responsive: dashboard and dark reports at 320, 375, 390, 768, 1024, 1280, 1440 and 1920 px without horizontal document overflow; mobile edit and delete cancellation also passed.

See the [screenshot gallery](../README.md#screenshots-and-demonstration) for the captured states. These recorded checks establish the tested interactions and layouts rather than exhaustive browser or device coverage.
