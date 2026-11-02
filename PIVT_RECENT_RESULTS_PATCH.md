# PIVT Matchup Recent Results Reliability Patch — November 2, 2026

## Replace these two files

- `api/nba-data.js`
- `src/components/GameComparePanel.jsx`

## Improvements

1. Correctly distinguishes ESPN's game/competition type from NBA season stage. The schedule previously could interpret `competition.type.id = 1` (standard game) as preseason and filter real regular-season results out.
2. Recovers recent team results from ESPN's monthly scoreboard when schedules are empty, partial, or inaccessible; merges by game ID without duplicates and excludes future, unfinished, mismatched-stage, and unscored games.
3. Refreshes recent matchup results from the scoreboard instead of depending on the longer-lived team-schedule cache.
4. Lets a team's recent results appear even when player stats, head-to-head, prediction, or the other team's request fails; displays an actual unavailable message if the results source is down.
5. Uses NBA Eastern game date rather than the UTC calendar date for matchup history and supports preseason/regular/postseason history when selected.
6. Deduplicates simultaneous upstream ESPN calls, retries brief transient HTTP failures once, and caches finished months longer to reduce load.
7. Includes eight offline regression tests (`tests/nba-data.test.js` in the complete archive).

## Validation

- Node syntax check: passed.
- JSX transpile syntax check: passed.
- Eight mock ESPN data tests: passed.
- No live deployment test: public ESPN JSON could not be fetched from the local code-execution environment.

For development, run `node --test tests/nba-data.test.js`. Deploy the replaced files with your normal Vercel build/deploy process. External ESPN outages can still affect live data; this patch avoids converting those outages into misleading zero-game records.
