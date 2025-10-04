// api/bdl/[...path].js
export default async function handler(req, res) {
  try {
    const parts = Array.isArray(req.query.path) ? req.query.path : [];
    const suffix = parts.join("/");
    const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    const upstream = `https://api.balldontlie.io/v1/${suffix}${qs}`;

    const key = process.env.BDL_API_KEY || "";
    const asIs = key;                         // whatever you put in Vercel
    const asBearer = key.startsWith("Bearer ") ? key : `Bearer ${key}`;

    // helper to try one header form
    const tryFetch = async (authValue) => {
      const headers = { Accept: "application/json" };
      if (authValue) headers.Authorization = authValue;
      const r = await fetch(upstream, { method: req.method, headers });
      const text = await r.text();
      return { r, text };
    };

    // 1st attempt: as provided; 2nd: with Bearer (only if needed)
    let { r, text } = await tryFetch(asIs);
    let authMode = "as-is";
    if (r.status === 401 || r.status === 403) {
      ({ r, text } = await tryFetch(asBearer));
      authMode = "bearer";
    }

    const ct = r.headers.get("content-type") || "application/json; charset=utf-8";
    res.status(r.status);
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("x-bdl-proxy", "1");
    res.setHeader("x-bdl-auth-mode", authMode);
    res.setHeader("x-bdl-key-present", String(Boolean(key)));
    res.send(text);
  } catch (e) {
    res.status(500).json({ error: "proxy_error", message: String(e) });
  }
}
