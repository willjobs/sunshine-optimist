# Optimistic copy implementation plan

Implement on `feat/optimistic-daylight-messages`. The user subsequently authorized
opening a pull request with context and merging it into `main` after all work and
checks are complete. Do not deploy separately.
The user's annotations override the earlier proposal. Unannotated suggestions
(daylight twin, generic fallback, wholesale lede removal) are outside this change.

## Accepted requirements

| Annotation | Requirement                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| 1          | Sunset X later than winter's earliest; >=10m, after the seasonal turnaround.                                 |
| 2          | Start-of-year comparison >=30m; retain existing wording/reference.                                           |
| 3          | Month sunset comparison >=15m and after winter solstice, during lengthening season; retain supporting claim. |
| 4          | Month-end >=30m above shortest day, >=10m above today, not month-end today.                                  |
| 5          | Gained >=15m since shortest day, only during lengthening season.                                             |
| 6          | Actual daylight after 5pm >=30m, including late sunrises and midnight crossings.                             |
| 7          | Monthly daylight gain >=15m.                                                                                 |
| 8          | Today has X more daylight than shortest day, >=90m; remove still.                                            |
| 9          | Retire remaining daylight to lose.                                                                           |
| 10         | Quantify fraction of annual daylight decrease completed, >=75%, only shortening.                             |
| 11         | Replace minimum-daily-week message with You've gained X of daylight over the past week!                      |
| 12         | Two-week forecast >=15m.                                                                                     |
| 13         | Retain accelerating; after winter, before local spring equinox, positive increasing measured gain rate.      |
| 14         | Today has X more daylight than yesterday, >=1m.                                                              |
| 15         | Weekly gain >=10m; remove over; consolidate duplicate weekly messages.                                       |
| 16         | Daylight loss is X% slower than a month ago; >=25% reduction over equal-duration windows.                    |
| 17         | The largest increase in daylight is X away; <=42 days.                                                       |
| 18         | You have around X weeks of sunset after 7pm; >=2 full weeks.                                                 |
| 19         | Only X until days start getting longer again; <=35 days, actual first improving day.                         |
| 20         | Only X until sunsets start getting later again; <=35 days, actual first improving day.                       |
| 21         | Regained X% lost since summer; >=25%, lengthening; seasonal range >=60m.                                     |
| 22         | Retire percent of time toward shortest day.                                                                  |
| 23         | Today has more daylight than X% of days this year; >=60%.                                                    |
| 24         | Today is just X shy of year's longest day; gap <=30m, before summer solstice.                                |
| 25         | You're in the 10 weeks with the most daylight of the year; actual top-70 ranking.                            |
| 26         | Sunsets are getting later again! is a prominent milestone celebration with confetti.                         |
| 27         | The shortest day is in your rear-view mirror (X days ago); first 14 days of improvement.                     |
| 28         | Above average winter day >=90m raw; remove still and I'll take it.                                           |
| 29         | Retire weekly daylight loss.                                                                                 |
| 30         | Generic countdown <=35d, positive milestones only, almost there only <=7d.                                   |
| 31         | Card Later sunsets begin; quantified 14d sunset outlook, actual turnaround.                                  |
| 32         | Card Longer days begin; celebration and quantified 14d daylight outlook.                                     |
| 33         | Card Earlier sunrises begin; celebration and quantified 14d sunrise outlook.                                 |
| 34         | Card Longest day of the year.                                                                                |
| 35         | Longest-day headline Enjoy X of daylight today!; no maximum/decline language.                                |
| 36         | Card Biggest daylight gain; quantified daily gain celebration.                                               |
| 37         | Compact sunset-after-time titles, seasonal upward crossings, no first of year claim.                         |
| 38         | Dynamic half-hour sunset uses same crossing logic and no duplicates.                                         |
| 39         | Sunrise stays before time; preserve sustained/DST protection.                                                |
| 40         | Compact daylight-gain titles; all four thresholds; shortest-day reference in expanded copy.                  |
| 41         | Compact 10+/11+/12+ hour titles; at least celebrations, upward crossings.                                    |
| 42         | Spring begins; measured daylight celebration, correct hemisphere.                                            |
| 43         | Keep Daylight saving time starts.                                                                            |
| 44         | Keep DST celebration approach, do not introduce clocks move forward X.                                       |
| 45         | 10 darkest weeks behind you; rank actual 70 least-daylight days around that winter.                          |
| 46         | Sunrise returns; quantified daylight celebration, numeric prior countdown.                                   |
| 47         | First sunset after polar day informational only, no optimistic countdown/headline/confetti.                  |
| 48         | Keep This isn't forever.                                                                                     |
| 49         | Keep existing polar-night fallback when date unavailable.                                                    |
| 50         | Apply thresholds before rounding; preserve inequalities and exact whole-week countdowns.                     |

## Implementation

1. Extend astronomy context with cached, yielding winter-season scans. Use the
   summer-to-summer season containing a winter, correctly spanning year boundaries
   in either hemisphere. Find actual first daily increases following winter's
   sunset and daylight minima. Rank 70 darkest dates and finish on the day after
   their last date. Resolve ties deterministically; account for polar 0/24h days.
   Reuse annual summary to expose actual top-70 daylight dates.
2. Build shared seasonal facts before message and milestone construction. Select
   past/upcoming winter data by actual dates (December sunset turnaround precedes
   the solstice). Derive previous shortest-day baseline, upcoming turnaround
   countdowns, season flags, 14d outlooks, seven-day gains, and a reduction in
   seven-day loss versus a seven-day window ending 28 days earlier. Only claim
   acceleration when weekly gains also exceed the prior week's gains.
3. Replace message templates and raw-value constraints. Allow predicate functions
   for multi-condition requirements and multiple named values. Replace single-comparison strings with multi-condition predicates and retain
   finite-value/data validation. Consolidate weekly copy;
   preserve the daylight twin and explicitly retained polar/DST copy.
4. Add dedicated milestone countdown text separate from short card titles.
   Share the same formatter between headlines, fallback ledes, and text sharing.
   Filter informational milestones before selecting a countdown; never self-repeat
   a countdown as its own lede. Give turnaround celebrations priority if multiple
   events share a date. Preserve confetti and pause rotation for celebrations.
5. Update static and computed milestones together, plus city explorer definitions.
   Correct at-least thresholds, seasonal crossings, and dynamic sunset duplicates.
   Keep first sunset informational; add no unrelated product features.
6. Add boundary unit tests (below/exact/above each threshold, invalid data,
   hemispheres, year/DST boundaries, rank ties/polar dates, true turnarounds).
   Add real-astronomy integration and Playwright desktop/mobile exercises for
   changed headlines, countdowns, celebrations, milestone cycling, sharing,
   informational polar sunset, and compact title fit. Avoid replacing meaningful
   assertions with looser regexes just to pass.
7. Register new runtime modules in import map/service-worker precache, bump cache
   versions using repository convention, update behavior docs, run lint/format,
   all unit tests, all five Playwright projects, and offline tests. Save a screenshot
   artifact. Commit the reviewed implementation with clean git status, open a pull request
   describing the problem and validation, then merge into main as authorized.

## Review

Independent subagent review completed before implementation. Incorporated:

- Start sunset crossings at actual seasonal earliest sunset, not the solstice;
  start daylight gain crossings at the actual shortest day.
- Prefer acceleration over the generic weekly message when their values tie.
- Break darkest-day ties toward later dates, so polar-night celebrations cannot
  precede equally dark days. Brightest ties use chronological order.
- Rank polar 0/24h days without changing the existing incomplete-event null model.
- Intersect after-5pm daylight with the selected local calendar day, using actual
  instants to handle DST and midnight-crossing sunsets correctly.
- Carry informational metadata through milestone construction; exclude it from
  today's celebration, optimistic countdowns, fallback ledes, and text sharing.
- Check generation guards after new awaits; emit 14d outlooks only if positive.
- Test exact 21/28/35/42-day wording, raw 89.6m rejection, and acceleration selection.

## Implementation review and validation

The reviewing subagent compared the implementation to all 50 requirements.
Its final findings were fixed and covered by regressions:

- Preserve a dynamic half-hour sunset's celebration on its actual crossing day.
- Gate sunrise return on preceding polar night and first sunset on preceding
  polar day; use the summer solstice for a polar daylight plateau rather than
  falsely celebrating the first normal day as the year's longest.
- Floor shared annual-loss completion so an unfinished 99.99% cannot become 100%.

Validation includes raw boundary cases in both hemispheres, real astronomy for
Boston/Sydney/Longyearbyen, December crossings before the solstice, local-day and
DST daylight intervals, exact whole-week countdowns, ranked 70-day sets, and
UI navigation, celebrations, compact card fit, text sharing, and rapid date edits.
Calculation chunks yield with a zero-delay task instead of waiting for an idle
window, keeping rendering responsive without accumulating idle deadlines.
Browser startup waits now check completed copy; transient feedback checks use the
Playwright clock after startup; offline checks survive the initial service-worker
reload and audit versioned cache keys consistently with the runtime.

- Unit tests: 233 passing across 27 files.
- Full Playwright run: 217 passing, 3 intentional platform-specific skips
  (220 defined cases across five projects), no failures.
- Offline cache test: passing, including the new seasonal service.
- ESLint: passing; one pre-existing console warning in the CSV generator.
- Prettier and git whitespace checks: passing.
- Desktop/mobile screenshots inspected, with no page errors or title overflow.
