# PIVT

A minimal NBA schedule, scores, matchup context, prediction, player snapshot, live NBA Pulse, and league-news app.

## Data sources

PIVT requires no API key and no paid sports-data subscription.

- Live schedule, preseason/regular/postseason scores, game summaries, recent team form, head-to-head context, player box-score data and headshots: ESPN public site JSON endpoints.
- Optional build-time schedule snapshot: NBA public CDN, with ESPN as a fallback.
- League headlines and story thumbnails: ESPN public news JSON plus ESPN and CBS Sports RSS feeds.
- Team marks: source-provided ESPN team assets with text fallbacks.

All live sports data is fetched server-side through `/api/nba-data` and `/api/news`, so the React client has one normalized interface.

## PIVT prediction

Upcoming matchup drawers include a conservative PIVT lean. The model uses:

- each team's last five completed games
- recent win rate
- recent average scoring margin
- available top-player PTS / REB / AST production
- a small home-court adjustment

Sparse samples, especially early in preseason, are constrained and shown as low confidence. The percentage is a heuristic estimate, not a sportsbook line or betting odds.

## NBA Pulse

`/pulse` is live and no longer depends on a generated Markdown post. It shows today's slate, recent finals, the next NBA game day, and season-stage labels including preseason. `/blog` redirects to `/pulse` for old links.

## Local development

The archive intentionally omits `node_modules`.

```bash
npm install
npm run dev
```

The Express API runs on port 5001 and Create React App runs on its normal development port. In Vercel production, the files in `/api` provide the serverless routes.

## Design

The UI is intentionally restrained: text-only PIVT branding, neutral dark palette, square geometry, compact schedule cards, image-led news rows, and a focused matchup drawer. The favicon is a black square with a white geometric `P`.
