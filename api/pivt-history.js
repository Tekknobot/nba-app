// Optional Neon persistence. Never exposes database credentials to the client.
const crypto = require("node:crypto");
const { neon } = require("@neondatabase/serverless");
const configured = () => Boolean(process.env.DATABASE_URL);
const dateOK = date => /^\d{4}-\d{2}-\d{2}$/.test(String(date || ""));
const authorize = (req) => {
  const secret = process.env.PIVT_SYNC_SECRET || "";
  const supplied = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(supplied), b = Buffer.from(secret);
  return Boolean(secret && a.length === b.length && crypto.timingSafeEqual(a, b));
};
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!configured()) return res.status(503).json({ error: "Cloud sync not configured; local records remain available" });
  if (req.method !== "GET" && !authorize(req)) return res.status(401).json({ error: "Incorrect sync key" });
  const sql = neon(process.env.DATABASE_URL);
  try {
    // Table setup uses an idempotent schema and never drops existing rows.
    await sql`CREATE TABLE IF NOT EXISTS pivt3_slates (date text PRIMARY KEY, snapshot jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
    if (req.method === "GET") {
      const rows = await sql`SELECT snapshot FROM pivt3_slates ORDER BY date DESC LIMIT 2000`;
      return res.status(200).json({ slates: rows.map(r => r.snapshot) });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const rows = req.body?.slates;
    if (!Array.isArray(rows) || rows.length > 2000 || JSON.stringify(req.body || {}).length > 950000)
      return res.status(400).json({ error: "Invalid or oversized payload" });
    let saved = 0;
    for (const row of rows) {
      if (!dateOK(row?.date) || !Array.isArray(row.picks) || row.picks.length > 3 || !row.picks.length) continue;
      const sanitized = { date: row.date, recordedAt: row.recordedAt, picks: row.picks };
      // First snapshot wins. Later result verification may fill in completed scores,
      // but the original pick, probabilities and metadata are never overwritten.
      const [existing] = await sql`SELECT snapshot FROM pivt3_slates WHERE date = ${row.date}`;
      if (existing) {
        const old = existing.snapshot;
        const merged = { ...old, picks: (old.picks || []).map(pick => {
          const incoming = sanitized.picks.find(p => String(p.gameId) === String(pick.gameId));
          return { ...pick, result: pick.result?.completed ? pick.result : incoming?.result?.completed ? incoming.result : pick.result };
        }) };
        await sql`UPDATE pivt3_slates SET snapshot = ${JSON.stringify(merged)}::jsonb, updated_at = now() WHERE date = ${row.date}`;
      } else {
        await sql`INSERT INTO pivt3_slates (date, snapshot) VALUES (${row.date}, ${JSON.stringify(sanitized)}::jsonb) ON CONFLICT (date) DO NOTHING`;
      }
      saved++;
    }
    return res.status(200).json({ saved });
  } catch (error) {
    console.error("PIVT sync", error);
    return res.status(500).json({ error: "Database request failed" });
  }
};
