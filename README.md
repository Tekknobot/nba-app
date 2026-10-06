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
