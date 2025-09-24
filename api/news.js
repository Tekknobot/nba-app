// api/news.js
// Vercel Serverless Function that returns NBA news as JSON.
// No client changes needed: your React code can keep fetch("/api/news").

const { XMLParser } = require("fast-xml-parser");

// --- tiny utils ---
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- DROP-IN (api/news.js): simple injury detector ---
function detectInjury(text) {
  if (!text) return { isInjury: false, hits: [] };
  const hay = text.toLowerCase();

  // Core keywords and phrases seen in NBA injury headlines
  const terms = [
    "injury", "injured", "out for season", "out for the season", "out indefinitely",
    "questionable", "probable", "doubtful", "day-to-day", "day to day",
    "ruled out", "sidelined", "return timetable", "status update",
    "mri", "x-ray", "xray", "fracture", "broken", "sprain", "strain", "tear",
    "acl", "mcl", "pcl", "lcl", "meniscus", "achilles", "concussion",
    "hamstring", "calf", "quad", "groin", "knee", "ankle", "foot", "wrist",
    "hand", "thumb", "finger", "elbow", "shoulder", "hip",
  ];

  const hits = terms.filter(t => hay.includes(t));
  return { isInjury: hits.length > 0, hits };
}

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

async function fetchWithRetry(url, { headers = {}, timeoutMs = 3500, retries = 2, backoffMs = 300 } = {}) {
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

async function fetchFeed(feed, parser, ua) {
  try {
    const r = await fetchWithRetry(feed.url, {
      headers: { "User-Agent": ua },
      timeoutMs: 3500,
      retries: 2,
      backoffMs: 300,
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

    // helper to decode HTML entities
    const he = require("he");

    return arr
    .map((it) => {
        const title = it?.title ? he.decode(it.title) : "";
        const desc  = it?.description ? he.decode(String(it.description)) : "";
        const { isInjury, hits } = detectInjury(`${title} ${desc}`); // check title+desc

        return {
        title,
        link: it?.link || it?.guid || "",
        pubDate: it?.pubDate || it?.published || it?.updated || "",
        source: feed.source,
        isInjury,
        injuryHits: hits, // optional: useful for debugging/analytics
        };
    })
    .filter((x) => x.title && x.link);

  } catch (e) {
    console.warn(`[news] ${feed.source} fetch error: ${e?.name || ""} ${e?.message || e}`);
    return [];
  }
}

module.exports = async function handler(req, res) {
  // Only GET
  if (req.method !== "GET") {
    res.status(405).setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ items: [], error: "method_not_allowed" }));
  }

  // Always JSON
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300"); // CDNs can cache briefly

  const NBA_FEEDS = [
    { source: "ESPN", url: "https://www.espn.com/espn/rss/nba/news" },
    { source: "Yahoo", url: "https://sports.yahoo.com/nba/rss.xml" },
    { source: "CBS", url: "https://www.cbssports.com/rss/headlines/nba/" },
  ];

  const UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });

  // Overall time budget to avoid platform 504s
  const overallTimeoutMs = 5500;
  const overallTimeout = new Promise((resolve) =>
    setTimeout(() => resolve({ __timeout: true }), overallTimeoutMs)
  );

  try {
    const work = (async () => {
      const results = await Promise.all(NBA_FEEDS.map((f) => fetchFeed(f, parser, UA)));
      const flat = results.flat();

      if (!flat.length) {
        // Return empty array, not a 5xx/HTML page
        return { items: [] };
      }

      flat.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
      return { items: flat.slice(0, 25) };
    })();

    const out = await Promise.race([work, overallTimeout]);
    if (out && out.__timeout) {
      return res.status(200).end(JSON.stringify({ items: [], error: "timeout" }));
    }
    return res.status(200).end(JSON.stringify(out));
  } catch (e) {
    console.error("NEWS ERR (outer):", e);
    return res.status(200).end(JSON.stringify({ items: [], error: "route_error" }));
  }
};
