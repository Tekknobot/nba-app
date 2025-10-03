export default async function handler(req, res) {
  try {
    const { id } = req.query;
    const qs = req.url.includes("?") ? "?" + req.url.split("?")[1] : "";
    const upstream = `https://api.balldontlie.io/v1/games/${id}${qs}`;
    const r = await fetch(upstream, {
      headers: process.env.BDL_API_KEY ? { Authorization: process.env.BDL_API_KEY } : {},
      method: req.method,
    });
    const body = await r.text();
    res.status(r.status);
    res.setHeader("Content-Type", r.headers.get("content-type") || "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(body);
  } catch (e) {
    res.status(500).json({ error: "proxy_error", message: String(e) });
  }
}
