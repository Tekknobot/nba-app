# PIVT player-data readiness v4

- Current-season only: ESPN 2026-27 preseason/regular-season completed box scores; never load prior-season player performances into win predictions.
- ESPN current-season team roster membership is checked when available. A rostered player with no current-season minutes has no statistical impact assigned, rather than an invented star rating. Injury/availability verification remains unavailable.
- Predictions are deliberately withheld more than 3 calendar days before the matchup, or when fewer than 3 measured players per team are available and the minimum current-stage five-game sample is absent.
- Only eligible games can appear in PIVT 3; ineligible fixtures show a plain explanation and no numerical percent.
- Regular-season team metrics gain weight after five games per team. Neon history and prediction capture are retained.
- Existing frozen predictions are not modified. Model tag: player-first-v4.

Caution: no current-season statistics can reliably measure an inactive star's value; this patch does not pretend that roster membership equals quantified availability or impact.
