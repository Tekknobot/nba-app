// pages/api/nba-schedule.js
const NBA_SCHEDULE_URL = "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json";

export default async function handler(req, res) {
  try {
    const r = await fetch(NBA_SCHEDULE_URL, {
      cache: "no-store",
      headers: {
        "User-Agent": "nba-app/1.0",
        "Accept": "application/json",
        "Referer": "https://www.nba.com/",
      },
    });
    if (!r.ok) {
      res.status(r.status).json({ error: `NBA CDN ${r.status}` });
      return;
    }
    const json = await r.json();
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(json);
  } catch (err) {
    res.status(502).json({ error: "Upstream fetch failed", detail: String(err) });
  }
}
