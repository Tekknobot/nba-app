// server/index.js
const path = require("path");
const express = require("express");
const app = express();
const PORT = process.env.PORT || 5000;
const URLS = [
  "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json",
  "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json",
  "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_9.json",
];

app.get("/api/nba/schedule", async (_req, res) => {
  for (const u of URLS) {
    try {
      const r = await fetch(u, { cache: "no-store" });
      if (r.ok) {
        const json = await r.json();
        res.set("Cache-Control", "public, max-age=900");
        return res.json(json);
      }
    } catch {}
  }
  res.status(502).json({ error: "Failed to fetch NBA schedule" });
});

if (process.env.NODE_ENV === "production") {
  const buildPath = path.join(__dirname, "..", "build");
  app.use(express.static(buildPath));
  app.get("*", (_req, res) => res.sendFile(path.join(buildPath, "index.html")));
}

app.listen(PORT, () => console.log(`Server http://localhost:${PORT}`));
