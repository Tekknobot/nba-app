// api/bdl/season-averages.js
// Serverless proxy for balldontlie 'season_averages'.
// Calls upstream once per player_id (avoids "player_id must be a single integer") and merges results.
//
// Env (set in Vercel Project → Settings → Environment Variables):
//   BDL_API_KEY = YOUR_GOAT_KEY   (no "Bearer " prefix)

const BDL_BASE = "https://api.balldontlie.io/v1";

// tiny concurrency helper to avoid hammering upstream
async function pMap(inputs, mapper, concurrency = 8) {
  const ret = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, inputs.length) }, async () => {
    while (i < inputs.length) {
      const idx = i++;
      ret[idx] = await mapper(inputs[idx], idx);
    }
  });
  await Promise.all(workers);
  return ret;
}

module.exports = async function handler(req, res) {
  // CORS
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

  const key = (process.env.BDL_API_KEY || "").trim();
  if (!key) return res.status(500).end(JSON.stringify({ error: "server_key_missing" }));

  try {
    // fan-out: one upstream call per ID using the *singular* "player_id" param
    const results = await pMap(ids, async (id) => {
      const url = new URL(`${BDL_BASE}/season_averages`);
      url.searchParams.set("season", String(season));
      url.searchParams.set("player_id", String(id)); // <- singular

      const r = await fetch(url, { headers: { Authorization: key } });
      const txt = await r.text();
      if (!r.ok) {
        // return structured error for this id; we'll just skip it
        return { error: true, id, status: r.status, body: tryParseJSON(txt) };
      }
      const json = tryParseJSON(txt);
      const arr = Array.isArray(json?.data) ? json.data : [];
      return { error: false, id, data: arr };
    }, 8);

    // merge successful data, ignore errored ids
    const merged = [];
    for (const r of results) {
      if (!r || r.error) continue;
      merged.push(...(r.data || []));
    }

    return res.status(200).end(JSON.stringify({ data: merged }));
  } catch (e) {
    return res.status(200).end(JSON.stringify({ error: "proxy_error", detail: String(e?.message || e) }));
  }
};

function parseQuery(url) {
  const u = new URL(url, "http://x");
  // support both player_ids[]=...&player_ids[]=... and (if any) player_id=...
  const many = u.searchParams.getAll("player_ids[]");
  const single = u.searchParams.get("player_id");
  const all = [...many, ...(single ? [single] : [])];
  return {
    season: u.searchParams.get("season"),
    player_ids: all,
  };
}
function tryParseJSON(t) { try { return JSON.parse(t); } catch { return t; } }
