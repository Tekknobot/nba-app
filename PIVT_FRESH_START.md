# PIVT 3: Fresh Start / Neon Primary

- Neon is the primary and only live record store. No database credentials or sync controls appear on the Record page.
- Opening Prediction Record or loading a PIVT 3 calendar slate saves eligible pre-tipoff picks server-side. Later Record page requests check completed scores server-side. Picks are immutable after capture.
- Old snapshots recorded before **2026-10-09 03:30 UTC** are excluded from all displayed results and do not affect accuracy. If a new pick is recorded for the same slate date, a previous excluded snapshot can be replaced. Old rows have NOT been physically deleted from Neon.
- To permanently erase all old PIVT 3 data and begin completely empty, open Neon SQL Editor, confirm you are in the correct database, and execute:

  `TRUNCATE TABLE pivt3_slates;`

  WARNING: This permanently removes *all* PIVT 3 records and cannot be undone. Run it once, before making new predictions. If the table doesn't exist yet, there is nothing to clear.
- `DATABASE_URL` must exist in Vercel Production environment. `PIVT_SYNC_SECRET` is no longer used by the application (you may remove it after deploying).
- The app records when the relevant website/API endpoint is visited, not on an independent always-on schedule. To capture without visits, configure a scheduled server job separately.
- Vercel has to have `@neondatabase/serverless` installed. Deploy and verify `/api/pivt-history` returns `{"slates":[]}` on a fresh database.
