// api/bdl/[...path].js
export default async function handler(req, res) {
  try {
    const parts = Array.isArray(req.query.path) ? req.query.path : [];
    const suffix = parts.join("/");
    const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    const upstream = `https://api.balldontlie.io/v1/${suffix}${qs}`;

    const headers = { Accept: "application/json" };
    if (process.env.BDL_API_KEY) {
      // BDL expects the raw key (no "Bearer ")
      headers.Authorization = process.env.BDL_API_KEY;
    }

    const init = {
      method: req.method,
      headers,
    };

    // Pass body for non-GET/HEAD
    if (!["GET", "HEAD"].includes(req.method)) {
      init.body = req.body ? JSON.stringify(req.body) : undefined;
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
    }

    const r = await fetch(upstream, init);

    const text = await r.text();
    const ct = r.headers.get("content-type") || "application/json; charset=utf-8";

    res.status(r.status);
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "no-store");
    // helpful, non-sensitive debug
    res.setHeader("x-bdl-proxy", "1");
    res.setHeader("x-bdl-key-present", String(Boolean(process.env.BDL_API_KEY)));

    res.send(text);
  } catch (e) {
    res.status(500).json({ error: "proxy_error", message: String(e) });
  }
}
