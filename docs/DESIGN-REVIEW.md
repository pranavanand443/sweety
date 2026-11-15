# Sweety design review

Reviewed on 15 November 2026 using Hallmark 2.0.0 and separate browser checks.

## Interface decisions

The dashboard centers on four daily slots, with a reading log below them. Reports use the same date selector and show the exact period being summarized. The review kept that structure, the teal palette, and the existing routes, forms, validation, and API calls.

The appearance control sits at the top right of sign-in and application screens. Light is the default; `sweety.theme` saves the choice locally. A small external script applies it before React renders and works with the server's security policy. If browser storage is unavailable, switching still works for the current page.

## Changes made

- Replaced promotional headings and encouragement with labels tied to the task: Daily readings, Daily time slots and specific empty states.
- Removed small decorative headings, widely spaced capital labels, navigation dots, and unnecessary arrows.
- Put colors and fonts in shared tokens, with matching roles for light and dark palettes.
- Improved text and input-border contrast, made keyboard focus visible, enlarged small icon controls, and retained reduced-motion support.
- Cleared passwords when switching between sign-in and sign-up, and returned expired save/delete sessions to sign-in with an explicit notice.
- Used equal-width numerals for measurements and statistics, and added arrow/Home/End navigation to report tabs.
- Replaced the decorative sign-in chart with the four reading slots, avoiding an implied patient trend.
- Removed hover movement, backdrop blur, and extra shadows while keeping the layout.

## Checks

| Check | Recorded result |
| --- | --- |
| Initial static Hallmark sweep | 268 Floor findings, 204 Reflex findings, 33 warnings |
| Final static Hallmark sweep | See `.hallmark/after-static.json`; no open static Floor or Reflex findings at this review |
| Links and event handlers | The extractor retained 4/4 links and 40/41 exact handler strings. The changed auth-switch handler clears the password. |
| Frontend component tests | 10 reading-form, 3 theme-preference, and 10 chart tests passed |
| Frontend lint and production build | Passed |
| Hallmark render tier | Not run |
| Separate browser checks | Chrome workflows and eight responsive widths passed; see the [QA report](QA-REPORT.md#browser-and-responsive-checks) |

Hallmark ran at `polish` depth and `app` scope. Its extractor did not count React fields, and its static findings do not establish rendered contrast or working interactions. Form tests and the browser checks below cover those separately.

Rendered checks were performed separately; see the [QA report](QA-REPORT.md#browser-and-responsive-checks). Hallmark's render tier was not run.

The static sweep still has 220 notes, mostly about existing spacing values, including the chart. Those values were left in place. Source comments explain the subdued secondary controls and outline icons in empty states. The brief save/delete confirmation also stays: it announces the server result after the dialog closes, despite Hallmark's general preference against success toasts.

## Possible follow-ups

- A smaller navigation bar could give readings more space; there are only two destinations.
- Inline editing could shorten the reading workflow. The current native dialog already handles focus trapping and returning focus when closed.
- Spacing and font sizes could be made more consistent across breakpoints in a separate layout revision.
- A real application screenshot could replace the slot diagram on sign-in if a preview would be more useful there.

## Completed browser review

- Chrome: registration into an empty account, wrong-password feedback, sign-out, all four reading slots, every row's Edit/Delete controls, unchanged/conflicting edits, and delete/keep behavior.
- Validation: missing, out-of-range, decimal, duplicate, full-day and future-date feedback. Impossible-date coverage remains in the API/shared tests.
- Reports: all three periods, date navigation, a known average, deletion to an empty state, keyboard tab navigation, exact chart-point values, and the complete 34-reading previous-month table.
- Sessions and focus: dark preference after reload, expired-session feedback during an edit, and focus returning to the originating Edit control after Escape.
- Recovery: successful retry after server restart and reload after an interrupted readings request.
- Responsive: dashboard and dark reports at 320, 375, 390, 768, 1024, 1280, 1440 and 1920 px without horizontal document overflow; mobile edit and delete cancellation also passed.

See the [screenshot gallery](../README.md#screenshots-and-demonstration) for the captured states. These checks cover the listed workflows and browser widths; physical devices were not tested.
