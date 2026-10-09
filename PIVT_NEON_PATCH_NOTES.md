# PIVT 3 — Neon-primary history and compact dashboard

## Deployment
Deploy this project to the existing Vercel `nba-app` project. Ensure the Neon integration provides `DATABASE_URL` and Vercel Production environment has `PIVT_SYNC_SECRET`. Redeploy after adding environment variables.

## Migrating the five preexisting browser slates
Open **PIVT 3 → Prediction record** in the same browser/profile that holds the five original slates. Enter your existing `PIVT_SYNC_SECRET` in **Database write key**, then choose **Connect & migrate local records**. Confirm the Neon slate count shows five (or more). Do not clear that browser's data until verified. Original predictions are first-write-wins; later result checks only fill completed results.

## Behavior
- Neon is the authoritative, public-readable source for the prediction history and statistics. IndexedDB is read only when explicitly migrating old records.
- Database writes require the secret in the current browser tab. No secret is included in deployed frontend code or saved to persistent browser storage. Re-enter it after reloading to allow that tab to record new picks and verify finals. Without an authenticated active tab, the app displays existing Neon records read-only; it **does not automatically record future slates or update results in the background**.
- Export JSON creates an optional portable safety copy from Neon, not the primary data store.
- To make background recording/verification fully unattended, add a secured server-side scheduled job with platform-supported scheduling and an independent authorization mechanism. This is not in this patch.

## Notes
No changes to your existing model engine in this patch. Cloud POST merges verified game results but never rewrites original picks. The data table and performance matrix replace floating history entries and metrics.
