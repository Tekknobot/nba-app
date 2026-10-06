# PIVT

A minimal NBA schedule, scores, matchup context, player snapshot, and league-news app.

## Data sources

PIVT requires no API key and no paid sports-data subscription.

- Schedule, scores, game summaries, team form, season series, player box-score data and headshots: ESPN public site JSON endpoints.
- League headlines and story thumbnails: ESPN public news JSON plus ESPN and CBS Sports RSS feeds.
- Team marks: source-provided ESPN team assets with text fallbacks.

All third-party data is fetched server-side through `/api/nba-data` and `/api/news`, so the React client has one normalized interface.

## Local development

The archive intentionally omits `node_modules`.

```bash
npm install
npm run dev
```

The Express API runs on port 5001 and Create React App runs on its normal development port. In Vercel production, the files in `/api` provide the serverless routes.

## Design

The current UI is intentionally restrained: text-only PIVT branding, neutral dark palette, square geometry, compact schedule cards, image-led news rows, and a focused matchup drawer.
