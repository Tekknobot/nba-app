# PIVT

A minimal NBA schedule, scores, matchup context, prediction, player snapshot, live NBA Pulse, and league-news app.

## Data sources

PIVT requires no API key and no paid sports-data subscription.

- Live schedule, preseason/regular/postseason scores, game summaries, recent team form, head-to-head context, player box-score data and headshots: ESPN public site JSON endpoints.
- Optional build-time schedule snapshot: NBA public CDN, with ESPN as a fallback.
- League headlines and story thumbnails: ESPN public news JSON plus CBS Sports, Yahoo Sports, RotoWire, and SB Nation RSS feeds. The visible news rail is source-balanced so a high-volume publisher cannot occupy every slot.
- Team marks: source-provided ESPN team assets with text fallbacks.

All live sports data is fetched server-side through `/api/nba-data` and `/api/news`, so the React client has one normalized interface.

## PIVT prediction

Upcoming matchup drawers include a conservative PIVT lean. The model uses:

- each team's last five completed games
- recent win rate
- recent average scoring margin
- recent margin consistency / volatility
- available top-player PTS / REB / AST production
- rest and back-to-back fatigue
- a small home-court adjustment

Sparse samples, especially early in preseason, are constrained and shown as low confidence. The percentage is a heuristic estimate, not a sportsbook line or betting odds.

## PIVT 3

For upcoming slates, PIVT 3 ranks the three strongest model leans. It uses the same broad factors as the matchup predictor and keeps the confidence grade visible. A low-confidence slate therefore stays visibly low confidence rather than being presented as three guaranteed picks.

## NBA Pulse

`/pulse` is live and no longer depends on a generated Markdown post. It shows today's slate, recent finals, the next NBA game day, and season-stage labels including preseason. `/blog` redirects to `/pulse` for old links.

## Favicon / browser icons

The black-square `P` is supplied as SVG, ICO, 16/32/48/64 PNG favicons, a 180px Apple touch icon, 192/512 web-app icons, a web manifest, Windows browser config, and a Safari pinned-tab mask. The favicon links include a version query to help bust older desktop-browser caches after deployment.

## Local development

The archive intentionally omits `node_modules`.

```bash
npm install
npm run dev
```

The Express API runs on port 5001 and Create React App runs on its normal development port. In Vercel production, the files in `/api` provide the serverless routes.

## Design

The UI is intentionally restrained: text-only PIVT branding, neutral dark palette, square geometry, compact schedule cards, image-led news rows, and a focused matchup drawer. The favicon is a black square with a white geometric `P`.

## PIVT 3 prediction record

PIVT now keeps an immutable local history of PIVT 3 slates. When a current or future slate is first shown, the original three picks, model percentages, confidence labels, and model notes are frozen in browser storage. The `/record` screen later checks NBA results and marks each pick WIN, MISS, or OPEN, with overall pick accuracy, W-L record, and completed 3/3 sweeps.

Historical prediction data is intentionally not back-filled after a selected game has started. This keeps the track record pre-game and prevents later model changes from rewriting earlier picks. The record is stored in the browser-native PIVT IndexedDB database and existing localStorage records are migrated automatically.


### PIVT 3 record database
PIVT 3 history uses the browser's native IndexedDB database (`pivt`, store `pivt3_slates`). No Vercel storage resource, environment variable, API key, or external database account is required. Existing `pivt3-history-v1` localStorage history is migrated automatically on first load. The database is browser/device-local by design.

## Bookmark / browser icon handling

PIVT uses uniquely named bookmark-facing favicon assets so desktop and mobile browsers do not reuse older cached artwork. Conventional fallback paths (`/favicon.ico`, `/apple-touch-icon.png`, Android/Windows aliases) mirror the same black-square P icon. `vercel.json` asks Vercel to revalidate the fallback icon and manifest metadata.


## 2026 prediction update and optional Neon sync

- Stage-aware model: preseason and regular-season samples are isolated. Early regular-season forecasts blend a progressively decreasing historical regular-season prior. Uncertainty shrinks extremes; injury availability remains **unverified** rather than guessed.
- PIVT 3 ranks picks by sample-adjusted strength and quality; a 70% estimate remains a guarded ceiling, **not** a validated real-world 70% probability.
- Record page has rolling 25/50/100-pick accuracy, stage and confidence breakdown, Brier scores, JSON export/import and optional authenticated cloud sync. Historical picks stay frozen.

### Set up cloud sync in Vercel (optional)

1. Vercel project > Storage > Marketplace > **Neon**; create and attach a database to this project. Neon automatically supplies `DATABASE_URL` in Vercel environment variables. Review the Vercel/Neon plan and limits.
2. Vercel project > Settings > Environment Variables: add **`PIVT_SYNC_SECRET`** with a strong unique random string (at least 32 characters). Set it for Production, and optionally Preview, then redeploy. Do not prefix it `REACT_APP_` and never publish it in source control.
3. On the existing browser/device where your recorded predictions live, open **Prediction record > Export JSON backup** and save that file first.
4. Paste your exact `PIVT_SYNC_SECRET` into the private cloud sync key field and click **Sync with Vercel database**. The API creates its table automatically on first authorized request. No SQL editor setup required.
5. On a second browser, enter the same key and sync to restore records there. Sync is manually initiated to avoid exposing a persistent administrative credential in a public website.

Cloud sync is **not automatically enabled** without database credentials. This project's serverless route has a shared-secret administrative model suitable for a private maintainer, not public multiuser accounts. Never expose the sync key to visitors. Original snapshots are first-write-wins on the server; subsequent results can be verified without rewriting predicted outcomes. Backups/imports preserve the existing prediction on matching slate dates. If Neon fails or remains unconfigured, IndexedDB continues working.

### Calibration caveat

Brier score and group accuracy now reveal calibration quality but the service does **not** retrain on its own; automatic probability recalibration should only be switched on after a meaningful collection of timestamped, pregame out-of-sample predictions. Historical records without season metadata are labeled `Legacy / unknown`, not retroactively guessed.

**Build note:** The old npm lockfile was removed because the Neon driver was newly added and the npm registry was unreachable in the patch environment. Vercel's default `npm install` recreates a correct lock during dependency installation. If your Vercel project specifies `npm ci` as its install command, switch that setting to `npm install` for the first patched deployment and commit the newly generated package-lock.json afterward.

Cloud-enabled probability calibration: after at least 60 settled predictions from `stage-aware-v2` within the same NBA season stage, the API compares predictions with earlier actual results (never same-day or future results). A bin must contain at least 25 observations before it is allowed to adjust the projected probability, with Beta smoothing and a 50% correction strength. Historical model predictions are never changed; the active adjustment affects only new output. Calibration is unavailable without Neon and defaults to the conservative base heuristic.
