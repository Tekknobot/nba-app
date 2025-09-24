// api/bdl/season-averages.js
// Serverless proxy for balldontlie 'season_averages' (GOAT key stays server-side)

const BDL_BASE = "https://api.balldontlie.io/v1";

module.exports = async function handler(req, res) {
  // CORS (safe default; tighten to your domain if you prefer)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).end(JSON.stringify({ error: "method_not_allowed" }));

  const { season, player_ids } = parseQuery(req.url);

  if (!season || !/^\d{4}$/.test(String(season))) {
    return res.status(400).end(JSON.stringify({ error: "bad_request", detail: "season must be a 4-digit year (e.g., 2025)" }));
  }

  const ids = Array.from(new Set(
    (player_ids || []).map(n => Number(n)).filter(n => Number.isInteger(n) && n > 0)
  ));
  if (!ids.length) {
    return res.status(400).end(JSON.stringify({ error: "bad_request", detail: "at least one valid player_ids[] required" }));
  }

  const key = process.env.BDL_API_KEY; // set this in Vercel → Project → Settings → Environment Variables
  if (!key) return res.status(500).end(JSON.stringify({ error: "server_key_missing" }));

  const url = new URL(`${BDL_BASE}/season_averages`);
  url.searchParams.set("season", String(season));
  ids.forEach(id => url.searchParams.append("player_ids[]", String(id)));

  try {
    const upstream = await fetch(url, { headers: { Authorization: key } });
    const text = await upstream.text();

    if (!upstream.ok) {
      return res.status(200).end(JSON.stringify({ error: "bdl_error", status: upstream.status, body: tryParseJSON(text) }));
    }
    return res.status(200).end(text);
  } catch (e) {
    return res.status(200).end(JSON.stringify({ error: "proxy_error", detail: String(e?.message || e) }));
  }
};

function parseQuery(url) {
  const u = new URL(url, "http://x");
  return {
    season: u.searchParams.get("season"),
    player_ids: u.searchParams.getAll("player_ids[]"),
  };
}
function tryParseJSON(t) { try { return JSON.parse(t); } catch { return t; } }
