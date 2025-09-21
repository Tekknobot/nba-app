# NBA Calendar (Full Project)

## Dev
```bash
npm i
npm run dev
```
- Runs CRA on :3000 and Express on :5000. CRA proxies `/api/nba/schedule` to the server.

## Build-time fallback
We also fetch a copy of the schedule into `public/nba-schedule.json` before `build`:
- It’s used only if the server/CDN are unreachable.

## Prod
```bash
npm run build
NODE_ENV=production npm run server
```
- Serves the build and the API from the same origin.
