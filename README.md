# PIVT — NBA Calendar & Matchup Helper

A clean, mobile-friendly NBA schedule and matchup helper.

Browse games by date, compare each team’s last 10 completed regular-season games, review the current season series, and see compact player stat snapshots.

## Data

PIVT no longer requires Balldontlie or any API key. The browser talks to the project’s own `/api/nba-data` route, which normalizes keyless public NBA data into the shapes used by the existing UI.

Supported data actions:

- Monthly schedule, status, and scores
- Single-game detail
- Team last-10 results
- Head-to-head season series
- Recent player box-score averages with a season-stat fallback

For local development, `npm run dev` starts the Express API on port 5001 and the CRA frontend. In production, the top-level `api/nba-data.js` file runs as the serverless route.
