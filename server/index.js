// server/index.js
const express = require("express");
const fetch = (...args) => import("node-fetch").then(m => m.default(...args));

const app = express();

// --- DROP-IN (server/index.js): enable CORS for production ---
const cors = require("cors");
app.use(cors({ origin: true })); // or replace 'true' with your exact frontend origin string

const PORT = process.env.PORT || 5001;

const { XMLParser } = require("fast-xml-parser");

/** UI -> BBR codes (note BRK/CHO/PHO) */
const UI_TO_BBR = {
  ATL:"ATL", BOS:"BOS", BKN:"BRK", BRK:"BRK",
  CHA:"CHO", CHO:"CHO",
  CHI:"CHI", CLE:"CLE", DAL:"DAL", DEN:"DEN", DET:"DET",
  GSW:"GSW", HOU:"HOU", IND:"IND", LAC:"LAC", LAL:"LAL",
  MEM:"MEM", MIA:"MIA", MIL:"MIL", MIN:"MIN", NOP:"NOP",
  NYK:"NYK", OKC:"OKC", ORL:"ORL", PHI:"PHI",
  PHX:"PHO", PHO:"PHO",
  POR:"POR", SAC:"SAC", SAS:"SAS", TOR:"TOR", UTA:"UTA", WAS:"WAS"
};

const NAME_TO_CODE = {
  "Atlanta Hawks":"ATL","Boston Celtics":"BOS","Brooklyn Nets":"BRK","Charlotte Hornets":"CHO","Chicago Bulls":"CHI",
  "Cleveland Cavaliers":"CLE","Dallas Mavericks":"DAL","Denver Nuggets":"DEN","Detroit Pistons":"DET","Golden State Warriors":"GSW",
  "Houston Rockets":"HOU","Indiana Pacers":"IND","Los Angeles Clippers":"LAC","Los Angeles Lakers":"LAL","Memphis Grizzlies":"MEM",
  "Miami Heat":"MIA","Milwaukee Bucks":"MIL","Minnesota Timberwolves":"MIN","New Orleans Pelicans":"NOP","New York Knicks":"NYK",
  "Oklahoma City Thunder":"OKC","Orlando Magic":"ORL","Philadelphia 76ers":"PHI","Phoenix Suns":"PHO","Portland Trail Blazers":"POR",
  "Sacramento Kings":"SAC","San Antonio Spurs":"SAS","Toronto Raptors":"TOR","Utah Jazz":"UTA","Washington Wizards":"WAS"
};

/* -------- simple cache -------- */
const cache = new Map();
const TTL_MS = 60 * 60 * 1000;
const getCache = k => {
  const v = cache.get(k); if (!v) return null;
  if (Date.now() - v.t > TTL_MS) { cache.delete(k); return null; }
  return v.v;
};
const setCache = (k, v) => cache.set(k, { v, t: Date.now() });

/* -------- CSV parsing helpers -------- */
function splitCsvLine(line) {
  const m = line.match(/("([^"]|"")*"|[^,]*)/g);
  if (!m) return [];
  return m.filter(s => s !== "")
          .map(s => s.replace(/^"(.*)"$/, "$1").replace(/""/g, '"'));
}

function parseCsvToLast10(bbrCode, csv) {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]).map(h => h.trim());
  const idx = {
    date: header.findIndex(h => /date/i.test(h)),
    opp: header.findIndex(h => /opponent/i.test(h)),
    loc: header.findIndex(h => /(home|location|game_location|@)/i.test(h)),
    res: header.findIndex(h => /^result$/i.test(h)),
    tm:  header.findIndex(h => /(^|[^a-z])tm([^a-z]|$)/i.test(h)),
    oppPts: header.findIndex(h => /(^|[^a-z])opp([^a-z]|$)/i.test(h)),
    type: header.findIndex(h => /type/i.test(h))
  };

  const finished = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (!cols.length) continue;

    const type = (idx.type >= 0 ? cols[idx.type] : "").trim();
    if (type && !/regular/i.test(type)) continue;

    const date = (idx.date >= 0 ? cols[idx.date] : "").trim();
    const oppName = (idx.opp >= 0 ? cols[idx.opp] : "").trim();
    const result = (idx.res >= 0 ? cols[idx.res] : "").trim();   // W/L
    const tmPts  = (idx.tm  >= 0 ? cols[idx.tm ] : "").trim();
    const opPts  = (idx.oppPts >= 0 ? cols[idx.oppPts] : "").trim();
    if (!date || !result || !tmPts || !opPts) continue;          // completed only

    const loc = (idx.loc >= 0 ? cols[idx.loc] : "").trim();
    const homeAway = loc === "@" ? "Away" : "Home";
    const oppCode = NAME_TO_CODE[oppName] || oppName;
    const scoreStr = `${bbrCode} ${tmPts} - ${oppCode} ${opPts}`;

    finished.push({ date, opp: oppCode, homeAway, result, score: scoreStr });
  }

  finished.sort((a,b)=> new Date(b.date) - new Date(a.date));
  return finished.slice(0, 10);
}

/* -------- fetch helpers -------- */
function buildHeaders(refererUrl) {
  return {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Accept": "text/csv,text/plain,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": refererUrl,
    "Connection": "keep-alive",
  };
}

// drop-in: tiny helper
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// drop-in: overall route timeout guard (wraps an async handler)
function withRouteTimeout(handler, ms = 5500) {
  return async (req, res) => {
    const to = new Promise(resolve => {
      setTimeout(() => resolve({ __timeout: true }), ms);
    });

    try {
      const result = await Promise.race([handler(req, res), to]);
      if (result && result.__timeout) {
        // Serve stale cache or empty payload on timeout (prevents 504 from proxies)
        const stale = getNewsCache?.("NEWS", 10 * 60 * 1000); // ok if undefined elsewhere
        res.status(200).type("application/json; charset=utf-8");
        if (stale) return res.json(stale);
        return res.json({ items: [], error: "timeout" });
      }
    } catch (e) {
      // Fallback to JSON error, not a proxy-level 504
      const stale = getNewsCache?.("NEWS", 10 * 60 * 1000);
      res.status(200).type("application/json; charset=utf-8");
      if (stale) return res.json(stale);
      return res.json({ items: [], error: "route_error" });
    }
  };
}

// drop-in: per-request timeout + retryable fetch helper
async function fetchWithTimeout(url, ms, headers) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, { headers, signal: controller.signal });
    return r;
  } finally {
    clearTimeout(id);
  }
}

async function fetchWithRetry(url, { headers = {}, timeoutMs = 3500, retries = 1, backoffMs = 400 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, timeoutMs, headers);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await sleep(backoffMs * Math.pow(2, attempt));
    }
  }
  throw lastErr;
}

// drop-in: hardened single-feed fetcher with retry (use instead of your current fetchFeed)
async function fetchFeed(feed, parser, ua) {
  try {
    const r = await fetchWithRetry(feed.url, {
      headers: { "User-Agent": ua },
      timeoutMs: 3500,   // per-feed timeout
      retries: 2,        // retry twice on timeouts/5xx
      backoffMs: 300
    });

    const xml = await r.text();
    let json;
    try {
      json = parser.parse(xml);
    } catch (e) {
      console.warn(`[news] ${feed.source} parse error: ${e?.message || e}`);
      return [];
    }
    const items = json?.rss?.channel?.item || [];
    const arr = Array.isArray(items) ? items : [items];

    return arr
      .map(it => ({
        title: it?.title || "",
        link: it?.link || it?.guid || "",
        pubDate: it?.pubDate || it?.published || it?.updated || "",
        source: feed.source,
      }))
      .filter(x => x.title && x.link);
  } catch (e) {
    console.warn(`[news] ${feed.source} fetch error: ${e?.name || ""} ${e?.message || e}`);
    return [];
  }
}

async function fetchCsvDirect(bbrCode, season) {
  const csvUrl  = `https://widgets.sports-reference.com/w/bbr_teams_games.cgi?team=${bbrCode}&year=${season}`;
  const referer = `https://www.basketball-reference.com/teams/${bbrCode}/${season}_games.html`;
  const res = await fetch(csvUrl, { headers: buildHeaders(referer), redirect: "follow" });
  const text = await res.text();
  console.log(`[direct] ${bbrCode} ${season} -> ${res.status} len=${text.length} first="${text.slice(0,120).replace(/\n/g,' ')}"`);
  return { status: res.status, text };
}

async function fetchCsvViaProxy(bbrCode, season) {
  const proxyUrl = `https://r.jina.ai/http://widgets.sports-reference.com/w/bbr_teams_games.cgi?team=${bbrCode}&year=${season}`;
  const ua = buildHeaders("")["User-Agent"];
  const res = await fetch(proxyUrl, { headers: { "User-Agent": ua }, redirect: "follow" });
  const text = await res.text();
  console.log(`[proxy ] ${bbrCode} ${season} -> ${res.status} len=${text.length} first="${text.slice(0,120).replace(/\n/g,' ')}"`);
  return { status: res.status, text };
}

/* -------- routes -------- */
app.get("/api/health", (req, res) => res.json({ ok: true, port: String(PORT) }));

// GET /api/last10/:code?season=2025  (defaults to 2025)
app.get("/api/last10/:code", async (req, res) => {
  const uiCode = (req.params.code || "").toUpperCase();
  const season = Number(req.query.season) || 2025;
  const bbrCode = UI_TO_BBR[uiCode];
  if (!bbrCode) return res.status(400).json({ error: `Unknown team code: ${uiCode}` });

  const cacheKey = `${bbrCode}:${season}`;
  const cached = getCache(cacheKey);
  if (cached) {
    res.set("Cache-Control", "public, max-age=3600");
    return res.json(cached);
  }

  let direct = { status: 0, text: "" };

  try {
    direct = await fetchCsvDirect(bbrCode, season);
    if (direct.status === 200 && direct.text && !/^<!DOCTYPE/i.test(direct.text)) {
      const games = parseCsvToLast10(bbrCode, direct.text);
      const payload = { team: uiCode, games, _source: "direct" };
      setCache(cacheKey, payload);
      res.set("Cache-Control", "public, max-age=3600");
      return res.json(payload);
    }
    console.warn(`[BBR] Direct CSV not usable: status=${direct.status}`);
  } catch (e) {
    console.warn(`[BBR] Direct CSV threw: ${e?.message || e}`);
  }

  try {
    const proxy = await fetchCsvViaProxy(bbrCode, season);
    if (proxy.status === 200 && proxy.text) {
      const games = parseCsvToLast10(bbrCode, proxy.text);
      const payload = { team: uiCode, games, _source: "proxy" };
      setCache(cacheKey, payload);
      res.set("Cache-Control", "public, max-age=3600");
      return res.json(payload);
    }
    return res.status(502).json({
      error: `Upstream blocked CSV for ${bbrCode} ${season}`,
      details: { directStatus: direct.status, proxyStatus: proxy.status }
    });
  } catch (e) {
    console.error("[last10] proxy error:", e);
    res.status(500).json({ error: e?.message || String(e) });
  }
});

// --- NBA News feed proxy (no auth) with timeouts + cache ---
const NBA_FEEDS = [
  { source: "ESPN",  url: "https://www.espn.com/espn/rss/nba/news" },
  { source: "Yahoo", url: "https://sports.yahoo.com/nba/rss.xml" },
  { source: "CBS",   url: "https://www.cbssports.com/rss/headlines/nba/" },
];

const newsCacheKey = "NEWS";
const NEWS_TTL_MS = 10 * 60 * 1000; // 10 min

// --- NEWS cache helpers ---
function getNewsCache(k, ttlMs = 10 * 60 * 1000) {
  const v = cache.get(k);
  if (!v) return null;
  if (Date.now() - v.t > ttlMs) {
    cache.delete(k);
    return null;
  }
  return v.v;
}

function setNewsCache(k, v) {
  cache.set(k, { v, t: Date.now() });
}

// --- fetch helper with timeout ---
async function fetchWithTimeout(url, ms, headers) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, { headers, signal: controller.signal });
    return r;
  } finally {
    clearTimeout(id);
  }
}

// --- fetch a single RSS feed ---
async function fetchFeed(feed, parser, ua) {
  try {
    const r = await fetchWithTimeout(feed.url, 4000, { "User-Agent": ua });
    if (!r.ok) {
      console.warn(`[news] ${feed.source} http ${r.status}`);
      return [];
    }
    const xml = await r.text();
    let json;
    try {
      json = parser.parse(xml);
    } catch (e) {
      console.warn(`[news] ${feed.source} parse error: ${e?.message || e}`);
      return [];
    }
    const items = json?.rss?.channel?.item || [];
    const arr = Array.isArray(items) ? items : [items];

    return arr
      .map(it => ({
        title: it?.title || "",
        link: it?.link || it?.guid || "",
        pubDate: it?.pubDate || it?.published || it?.updated || "",
        source: feed.source,
      }))
      .filter(x => x.title && x.link);
  } catch (e) {
    console.warn(`[news] ${feed.source} fetch error: ${e?.name || ""} ${e?.message || e}`);
    return [];
  }
}

// --- optional: strict JSON guards for /api/* ---
function registerJsonApiGuards(app) {
  app.use('/api', (req, res, next) => {
    res.type('application/json; charset=utf-8');
    next();
  });

  app.use('/api/news', (req, res, next) => {
    if (req.method !== 'GET') {
      return res.status(405).json({ items: [], error: 'method_not_allowed' });
    }
    next();
  });

  app.use('/api', (req, res, _next) => {
    return res.status(404).json({ error: 'not_found' });
  });

  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    if (res.headersSent) return next(err);
    res.status(500).json({ items: [], error: 'internal_error' });
  });
}

// drop-in: registerNewsRoute with overall timeout wrapper (replace your current registerNewsRoute)
function registerNewsRoute(app) {
  const NBA_FEEDS = [
    { source: "ESPN",  url: "https://www.espn.com/espn/rss/nba/news" },
    { source: "Yahoo", url: "https://sports.yahoo.com/nba/rss.xml" },
    { source: "CBS",   url: "https://www.cbssports.com/rss/headlines/nba/" },
  ];
  const newsCacheKey = "NEWS";
  const NEWS_TTL_MS = 10 * 60 * 1000;
  const UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });

  app.get(
    "/api/news",
    withRouteTimeout(async (req, res) => {
      res.type("application/json; charset=utf-8");

      const cached = getNewsCache(newsCacheKey, NEWS_TTL_MS);
      if (cached) {
        res.set("Cache-Control", "public, max-age=60");
        return res.status(200).json(cached);
      }

      const results = await Promise.all(NBA_FEEDS.map(f => fetchFeed(f, parser, UA)));
      const flat = results.flat();

      if (!flat.length) {
        const stale = getNewsCache(newsCacheKey, NEWS_TTL_MS);
        if (stale) {
          res.set("Cache-Control", "public, max-age=30");
          return res.status(200).json(stale);
        }
        return res.status(200).json({ items: [] });
      }

      flat.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
      const payload = { items: flat.slice(0, 25) };

      setNewsCache(newsCacheKey, payload);
      res.set("Cache-Control", "public, max-age=60");
      return res.status(200).json(payload);
    }, 5500) // overall route budget; ensures we return before proxies 504
  );
}

// register routes/guards
registerNewsRoute(app);
registerJsonApiGuards(app);

/* -------- start -------- */
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
