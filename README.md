# PIVT — NBA Calendar & Matchup Helper

A responsive desktop-and-mobile NBA schedule, scores, recent-form, and league-news dashboard.

Browse games by date, compare each team’s last 10 completed regular-season games, review the current season series, and see compact player stat snapshots.


## 2026 redesign

- Desktop two-column dashboard with a larger game workspace and league-news sidebar
- Mobile-first date rail and full-width matchup drawer
- Explicit offseason status; as of August 2026 the site notes that the league is between regular seasons
- ESPN-provided team logos with code fallbacks
- Player headshots and RSS story images when public source data supplies them
- About, Privacy, and Contact pages/routes removed

## Data

PIVT no longer requires Balldontlie or any API key. The browser talks to the project’s own `/api/nba-data` route, which normalizes keyless public NBA data into the shapes used by the existing UI.

Supported data actions:

- Monthly schedule, status, and scores
- Single-game detail
- Team last-10 results
- Head-to-head season series
- Recent player box-score averages with a season-stat fallback

For local development, `npm run dev` starts the Express API on port 5001 and the CRA frontend. In production, the top-level `api/nba-data.js` file runs as the serverless route.
