// scripts/fetch-nba-schedule.mjs
// Optional build-time snapshot used by the legacy markdown generator.
// The live PIVT calendar and NBA Pulse use /api/nba-data directly.
// This snapshot keeps preseason/regular/postseason labels intact.

import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..");
const OUT_FILE = join(projectRoot, "public", "upcoming-3mo.json");
const NBA_CDN = "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json";
const ESPN = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard";

const ESPN_CODE = { GS: "GSW", NO: "NOP", NY: "NYK", SA: "SAS", UTAH: "UTA", WSH: "WAS", PHO: "PHX", BRK: "BKN", CHO: "CHA" };
const normCode = (v = "") => ESPN_CODE[String(v).toUpperCase()] || String(v).toUpperCase();

function addMonths(d, count) { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() + count); return x; }
function easternDateKey(v) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function stageId(g = {}) {
  const text = [g.gameLabel, g.gameSubLabel, g.gameSubtype, g.seriesText].filter(Boolean).join(" ").toLowerCase();
  if (/preseason/.test(text)) return 1;
  if (/postseason|playoff|play-in|finals/.test(text)) return 3;
  return 2;
}
function displayTeam(t = {}) {
  const full = [t.teamCity, t.teamName].filter(Boolean).join(" ").trim();
  return { name: full || t.teamName || t.teamTricode || "Team", code: normCode(t.teamTricode || "") };
}
async function fetchJson(url) {
  const r = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "PIVT/2.1" } });
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
}

function fromNbaCdn(json) {
  const out = [];
  for (const day of json?.leagueSchedule?.gameDates || []) {
    for (const g of day?.games || []) {
      const when = g?.gameDateTimeUTC || g?.gameDateTimeEst || g?.gameDateUTC || g?.gameDateEst;
      const d = when ? new Date(when) : null;
      if (!d || Number.isNaN(d.getTime())) continue;
      const home = displayTeam(g?.homeTeam || {});
      const away = displayTeam(g?.awayTeam || {});
      if (!home.code || !away.code) continue;
      out.push({
        id: String(g?.gameId || ""),
        dateKey: easternDateKey(d),
        _iso: d.toISOString(),
        status: g?.gameStatusText || "Scheduled",
        completed: Number(g?.gameStatus) === 3 || /final/i.test(String(g?.gameStatusText || "")),
        homeScore: Number.isFinite(Number(g?.homeTeam?.score)) ? Number(g.homeTeam.score) : null,
        awayScore: Number.isFinite(Number(g?.awayTeam?.score)) ? Number(g.awayTeam.score) : null,
        seasonStageId: stageId(g),
        home,
        away,
      });
    }
  }
  return out;
}

function normalizeEspnEvent(event = {}) {
  const comp = event?.competitions?.[0];
  const teams = comp?.competitors || [];
  const homeC = teams.find((x) => x?.homeAway === "home");
  const awayC = teams.find((x) => x?.homeAway === "away");
  if (!homeC || !awayC) return null;
  const toTeam = (c) => ({ name: c?.team?.displayName || c?.team?.name || c?.team?.abbreviation, code: normCode(c?.team?.abbreviation) });
  const when = event?.date || comp?.date;
  const type = event?.status?.type || comp?.status?.type || {};
  return {
    id: String(event?.id || comp?.id || ""), dateKey: easternDateKey(when), _iso: new Date(when).toISOString(),
    status: type?.shortDetail || type?.description || "Scheduled",
    completed: Boolean(type?.completed) || String(type?.state).toLowerCase() === "post",
    homeScore: Number.isFinite(Number(homeC?.score)) ? Number(homeC.score) : null,
    awayScore: Number.isFinite(Number(awayC?.score)) ? Number(awayC.score) : null,
    seasonStageId: Number(event?.season?.type ?? comp?.type?.id ?? 2) || 2,
    home: toTeam(homeC), away: toTeam(awayC),
  };
}

async function fromEspn(start, end) {
  const months = new Set();
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor < end) {
    months.add(`${cursor.getUTCFullYear()}${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const batches = await Promise.all([...months].map(async (m) => {
    const u = new URL(ESPN); u.searchParams.set("dates", m); u.searchParams.set("limit", "1000");
    const j = await fetchJson(u);
    return (j?.events || []).map(normalizeEspnEvent).filter(Boolean);
  }));
  return batches.flat();
}

const start = new Date(); start.setUTCHours(0, 0, 0, 0);
const end = addMonths(start, 3);
let rows = [];
try {
  rows = fromNbaCdn(await fetchJson(NBA_CDN));
} catch (nbaErr) {
  console.warn("NBA CDN schedule unavailable, using ESPN fallback:", nbaErr?.message || nbaErr);
  rows = await fromEspn(start, end);
}

const startKey = easternDateKey(start);
const endKey = easternDateKey(end);
const seen = new Set();
const sliced = rows
  .filter((g) => g.dateKey >= startKey && g.dateKey < endKey)
  .filter((g) => { const k = g.id || `${g.dateKey}-${g.away?.code}-${g.home?.code}`; if (seen.has(k)) return false; seen.add(k); return true; })
  .sort((a, b) => String(a._iso).localeCompare(String(b._iso)));

await mkdir(dirname(OUT_FILE), { recursive: true });
await writeFile(OUT_FILE, JSON.stringify(sliced, null, 2), "utf8");
console.log(`Wrote ${sliced.length} games to ${OUT_FILE}`);
