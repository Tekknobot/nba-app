// src/setupProxy.js
const { createProxyMiddleware } = require('http-proxy-middleware');

/**
 * After creating/updating this file:
 * 1) npm i -D http-proxy-middleware
 * 2) STOP and RESTART your CRA dev server (npm start / yarn start)
 */

module.exports = function (app) {
  // A) Primary: NBA CDN full-season schedule (rich + TV broadcasters)
  app.use(
    '/api/nba-schedule',
    createProxyMiddleware({
      target: 'https://cdn.nba.com',
      changeOrigin: true,
      secure: true,
      pathRewrite: {
        '^/api/nba-schedule': '/static/json/staticData/scheduleLeagueV2.json',
      },
      onProxyReq: (proxyReq) => {
        proxyReq.setHeader('User-Agent', 'nba-app/1.0');
        proxyReq.setHeader('Accept', 'application/json');
        proxyReq.setHeader('Referer', 'https://www.nba.com/');
      },
      onProxyRes: (proxyRes) => {
        // Ensure no caching during dev
        proxyRes.headers['cache-control'] = 'no-store';
      },
    })
  );

  // B) Secondary: data.nba.net season schedule (broad support, different shape)
  // Client will call /api/nba-schedule2/<seasonYear>, e.g. /api/nba-schedule2/2025
  app.use(
    /^\/api\/nba-schedule2\/\d{4}$/,
    createProxyMiddleware({
      target: 'https://data.nba.net',
      changeOrigin: true,
      secure: true,
      pathRewrite: (path) => {
        // /api/nba-schedule2/2025 -> /prod/v2/2025/schedule.json
        const year = path.split('/').pop();
        return `/prod/v2/${year}/schedule.json`;
      },
      onProxyReq: (proxyReq) => {
        proxyReq.setHeader('User-Agent', 'nba-app/1.0');
        proxyReq.setHeader('Accept', 'application/json');
        proxyReq.setHeader('Origin', 'https://www.nba.com');
        proxyReq.setHeader('Referer', 'https://www.nba.com/');
      },
      onProxyRes: (proxyRes) => {
        proxyRes.headers['cache-control'] = 'no-store';
      },
    })
  );

  // C) Local backend: forward /api/* to your Express server on :5001
  // Hardened: adds timeouts and JSON fallback on proxy errors (prevents 504 HTML)
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5001',
      changeOrigin: true,
      logLevel: 'silent', // 'debug' to inspect
      timeout: 15000,       // client -> proxy timeout
      proxyTimeout: 15000,  // proxy -> target timeout
      onProxyReq(proxyReq) {
        proxyReq.setHeader('Accept', 'application/json');
        proxyReq.setHeader('Connection', 'keep-alive');
      },
      onProxyRes(proxyRes) {
        // ensure JSON-ish headers when possible and disable caching in dev
        proxyRes.headers['cache-control'] = 'no-store';
        if (!('content-type' in proxyRes.headers)) {
          proxyRes.headers['content-type'] = 'application/json; charset=utf-8';
        }
      },
      onError(err, req, res) {
        // Return JSON instead of a 504/HTML error page
        try {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ items: [], error: 'proxy_error', detail: String(err && err.message || err) }));
        } catch { /* ignore */ }
      },
    })
  );
};
