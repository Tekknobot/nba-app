// api/bdl/season-averages.js
// Vercel serverless proxy for balldontlie season_averages.
// Keeps your GOAT key secret and returns JSON with clear errors.
//
// Usage (client):
//   GET /api/bdl/season-averages?season=2025&player_ids[]=237&player_ids[]=140
//
// Set env var in Vercel project settings:
//   BDL_API_KEY=YOUR_GOAT_KEY   (no "Bearer " prefix)

const BDL_BASE = "https://api.balldontlie.io/v1";

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    return res.status(405).end(JSON.stringify({ error: "method_not_allowed" }));
  }

  const { season, player_ids } = parseQuery(req.url);

  // Validate inputs early
  if (!season || !/^\d{4}$/.test(String(season))) {
    return res
      .status(400)
      .end(JSON.stringify({ error: "bad_request", detail: "season must be a 4-digit year (e.g., 2025)" }));
  }

  // Sanitize player_ids: remove empties, coerce to positive ints, de-dupe
  const ids = Array.from(
    new Set(
      (player_ids || [])
        .map((x) => Number(x))
        .filter((n) => Number.isInteger(n) && n > 0)
    )
  );

  if (!ids.length) {
    return res
      .status(400)
      .end(JSON.stringify({ error: "bad_request", detail: "at least one valid player_ids[] required" }));
  }

  // Build upstream URL
  const url = new URL(`${BDL_BASE}/season_averages`);
  url.searchParams.set("season", String(season));
  ids.forEach((id) => url.searchParams.append("player_ids[]", String(id)));

  const key = process.env.BDL_API_KEY;
  if (!key) {
    return res.status(500).end(JSON.stringify({ error: "server_key_missing" }));
  }

  try {
    const upstream = await fetch(url, { headers: { Authorization: key } });
    const text = await upstream.text();

    // Always return 200 to avoid HTML proxy pages; include status in body if error
    if (!upstream.ok) {
      return res
        .status(200)
        .end(JSON.stringify({ error: "bdl_error", status: upstream.status, body: tryParseJSON(text) }));
    }

    // Pass through JSON from BDL on success
    return res.status(200).end(text);
  } catch (e) {
    return res
      .status(200)
      .end(JSON.stringify({ error: "proxy_error", detail: String(e?.message || e) }));
  }
};

function parseQuery(url) {
  const u = new URL(url, "http://localhost"); // base is ignored; needed for URL()
  return {
    season: u.searchParams.get("season"),
    player_ids: u.searchParams.getAll("player_ids[]"),
  };
}

function tryParseJSON(t) {
  try { return JSON.parse(t); } catch { return t; }
}
