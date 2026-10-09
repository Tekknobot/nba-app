# PIVT player-first v3 — October 9, 2026

- Prediction engine uses **no previous-season team results or player statistics**.
- Before five games per team, predictions are driven by player box-score production from the current NBA season's preseason or regular season. Each current-season preseason game is weighted 0.35 against a regular-season game once regular season starts.
- After five games for both teams, current regular-season team form gradually grows to 75% by game 20; player production retains at least a 25% contribution.
- Current-season player sample uses up to seven players per team, not only three.
- A prediction without current-season player information AND without sufficient current regular-season data is marked `insufficientData` and omitted from PIVT 3 rather than masquerading as 51% confidence.
- Injury availability cannot be verified reliably from the current API; the model doesn't claim it is verified.
- Existing frozen predictions and Neon storage paths are unchanged. Model version `player-first-v3` starts a separate calibration history.
- Probabilities are heuristics, not empirically calibrated yet. The existing 30%-70% conservative clamp stays in effect until enough settled picks exist.

## Deployment
Deploy the whole ZIP to the existing Vercel project. Keep your current DATABASE_URL. No schema migration is required. Current CDN/API cache may retain previous predictions briefly after deployment.

## Notes
- Games from older seasons may still appear in non-prediction history/score views, but do not enter prediction calculations.
- Player availability status and projected active lineup are NOT established by simple box-score data, so predictions based on preseason rotation experiments are lower reliability.
