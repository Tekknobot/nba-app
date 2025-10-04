// api/bdl/[...path].js
const CACHE_TTL_MS = 90_000;
const cache = new Map(); // key: req.url -> { t, status, ct, body }

export default async function handler(req, res) {
  try {
    const parts = Array.isArray(req.query.path) ? req.query.path : [];
    const suffix = parts.join("/");
    const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    const upstream = `https://api.balldontlie.io/v1/${suffix}${qs}`;

    // Serve small in-memory cache for GETs
    if (req.method === "GET") {
      const hit = cache.get(req.url);
      if (hit && Date.now() - hit.t < CACHE_TTL_MS) {
        res.status(hit.status);
        res.setHeader("Content-Type", hit.ct);
        res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60, stale-while-revalidate=60");
        res.setHeader("x-bdl-cache", "hit");
        return res.send(hit.body);
      }
    }

    const key = process.env.BDL_API_KEY || "";
    const headers = { Accept: "application/json" };

    // Prefer Bearer; if 401/403, retry as-is
    headers.Authorization = key.startsWith("Bearer ") ? key : `Bearer ${key}`;
    let r = await fetch(upstream, { method: req.method, headers });
    let text = await r.text();
    if (r.status === 401 || r.status === 403) {
      headers.Authorization = key; // try raw
      r = await fetch(upstream, { method: req.method, headers });
      text = await r.text();
    }

    const ct = r.headers.get("content-type") || "application/json; charset=utf-8";

    if (req.method === "GET" && r.status === 200) {
      cache.set(req.url, { t: Date.now(), status: r.status, ct, body: text });
    }

    res.status(r.status);
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60, stale-while-revalidate=60");
    res.setHeader("x-bdl-proxy", "1");
    res.setHeader("x-bdl-key-present", String(Boolean(key)));
    res.setHeader("x-bdl-auth-mode", key.startsWith("Bearer ") ? "bearer" : "prefixed");
    res.send(text);
  } catch (e) {
    res.status(500).json({ error: "proxy_error", message: String(e) });
  }
}
