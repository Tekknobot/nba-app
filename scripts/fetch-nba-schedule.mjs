// scripts/fetch-nba-schedule.mjs
// Node script: writes next 3 months to public/upcoming-3mo.json in your app's "calendar row" shape.
// Uses NBA CDN (with national TV) and falls back to data.nba.net if needed.

import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..");
const OUT_FILE = join(projectRoot, "public", "upcoming-3mo.json");

const NBA_CDN = "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json";
const DATA_NBA_NET = (year) => `https://data.nba.net/prod/v2/${year}/schedule.json`;

// --- team code map (must match your app) ---
const TEAM_CODES = {
  "Atlanta Hawks":"ATL","Boston Celtics":"BOS","Brooklyn Nets":"BKN","Charlotte Hornets":"CHA","Chicago Bulls":"CHI",
  "Cleveland Cavaliers":"CLE","Dallas Mavericks":"DAL","Denver Nuggets":"DEN","Detroit Pistons":"DET","Golden State Warriors":"GSW",
  "Houston Rockets":"HOU","Indiana Pacers":"IND","Los Angeles Clippers":"LAC","Los Angeles Lakers":"LAL",
  "Memphis Grizzlies":"MEM","Miami Heat":"MIA","Milwaukee Bucks":"MIL","Minnesota Timberwolves":"MIN","New Orleans Pelicans":"NOP",
  "New York Knicks":"NYK","Oklahoma City Thunder":"OKC","Orlando Magic":"ORL","Philadelphia 76ers":"PHI","Phoenix Suns":"PHX",
  "Portland Trail Blazers":"POR","Sacramento Kings":"SAC","San Antonio Spurs":"SAS","Toronto Raptors":"TOR","Utah Jazz":"UTA",
  "Washington Wizards":"WAS"
};

function normTeamName(name=""){
  return String(name).trim()
    .replace(/^LA\s+Clippers$/i,"Los Angeles Clippers")
    .replace(/^L\.?A\.?\s+Clippers$/i,"Los Angeles Clippers")
    .replace(/^L\.?A\.?\s+Lakers$/i,"Los Angeles Lakers")
    .replace(/^LA\s+Lakers$/i,"Los Angeles Lakers")
    .replace(/^PHX\s+Suns$/i,"Phoenix Suns")
    .replace(/^OKC\s+Thunder$/i,"Oklahoma City Thunder");
}
const teamCode = (name)=> TEAM_CODES[normTeamName(name)] || null;

const STAGE = { "Preseason":1, "Emirates NBA Cup":3, "Regular Season":2 };

function addMonthsClamp(d, months){ const x=new Date(d); x.setMonth(x.getMonth()+months); return x; }
function toDateKey(dt){ return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`; }
function ymd(d){ return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`; }
function etLabel(dt){
  try{
    return `${dt.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/New_York"})} ET`;
  }catch{
    return `${dt.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"})} ET`;
  }
}
function seasonYearForToday(){
  const d = new Date();
  const m = d.getMonth() + 1;
  return (m >= 8 ? d.getFullYear() : d.getFullYear() - 1);
}

async function fetchJson(url, init){
  const r = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "nba-app/1.0",
      "Accept": "application/json",
      "Referer": "https://www.nba.com/"
    },
    ...init
  });
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
}

// Build rows from NBA CDN schedule (has national TV)
function rowsFromCdn(json){
  const rows = [];
  const dates = json?.leagueSchedule?.gameDates || [];
  for (const day of dates) {
    for (const g of (day?.games || [])) {
      const awayName = normTeamName(g?.awayTeam?.teamName || g?.awayTeam?.teamCity || g?.awayTeam?.teamTricode);
      const homeName = normTeamName(g?.homeTeam?.teamName || g?.homeTeam?.teamCity || g?.homeTeam?.teamTricode);
      if (!awayName || !homeName) continue;

      const vCode = teamCode(awayName);
      const hCode = teamCode(homeName);
      if (!vCode && !hCode) continue;

      const whenStr = g?.gameDateTimeUTC || g?.gameDateTimeEst || g?.gameDateUTC || g?.gameDateEst;
      const start = whenStr ? new Date(whenStr) : null;
      if (!start || isNaN(start)) continue;

      const dateKey = toDateKey(start);
      const _iso = start.toISOString();
      const et = etLabel(start);
      const seasonStageId = STAGE["Regular Season"] ?? 2;

      if (vCode) rows.push({ dateKey,_iso,et,_teamCode:vCode,_teamName:awayName,homeAway:"Away",opp:homeName,seasonStageId });
      if (hCode) rows.push({ dateKey,_iso,et,_teamCode:hCode,_teamName:homeName,homeAway:"Home",opp:awayName,seasonStageId });
    }
  }
  rows.sort((a,b)=>
    String(a.dateKey).localeCompare(String(b.dateKey)) ||
    String(a._iso).localeCompare(String(b._iso)) ||
    String(a._teamCode||"").localeCompare(String(b._teamCode||""))
  );
  return rows;
}

// Fallback builder from data.nba.net (no TV, but has schedule)
function rowsFromDataNba(json){
  const rows = [];
  const games = json?.league?.standard || [];
  for (const g of games) {
    const awayName = normTeamName(g?.vTeam?.fullName || g?.vTeam?.triCode || g?.vTeam?.nickname);
    const homeName = normTeamName(g?.hTeam?.fullName || g?.hTeam?.triCode || g?.hTeam?.nickname);
    if (!awayName || !homeName) continue;

    const vCode = teamCode(awayName);
    const hCode = teamCode(homeName);
    if (!vCode && !hCode) continue;

    const whenStr = g?.startTimeUTC || g?.startTimeEastern || g?.startTime;
    const start = whenStr ? new Date(whenStr) : null;
    if (!start || isNaN(start)) continue;

    const dateKey = toDateKey(start);
    const _iso = start.toISOString();
    const et = etLabel(start);
    const seasonStageId = STAGE["Regular Season"] ?? 2;

    if (vCode) rows.push({ dateKey,_iso,et,_teamCode:vCode,_teamName:awayName,homeAway:"Away",opp:homeName,seasonStageId });
    if (hCode) rows.push({ dateKey,_iso,et,_teamCode:hCode,_teamName:homeName,homeAway:"Home",opp:awayName,seasonStageId });
  }
  rows.sort((a,b)=>
    String(a.dateKey).localeCompare(String(b.dateKey)) ||
    String(a._iso).localeCompare(String(b._iso)) ||
    String(a._teamCode||"").localeCompare(String(b._teamCode||""))
  );
  return rows;
}

(async () => {
  try {
    // 1) Fetch full schedule from NBA CDN (fallback to data.nba.net)
    let rows = [];
    try {
      const cdn = await fetchJson(NBA_CDN);
      rows = rowsFromCdn(cdn);
    } catch (e) {
      const year = seasonYearForToday();
      const alt = await fetchJson(DATA_NBA_NET(year));
      rows = rowsFromDataNba(alt);
    }

    // 2) Slice to next 3 months
    const start = new Date(); start.setHours(0,0,0,0);
    const end = addMonthsClamp(start, 3);
    const startKey = ymd(start);
    const endKey = ymd(end);
    const sliced = rows.filter(r => {
      const k = (r.dateKey || "").replace(/-/g, "");
      return k >= startKey && k < endKey;
    });

    // 3) Write file
    await mkdir(dirname(OUT_FILE), { recursive: true });
    await writeFile(OUT_FILE, JSON.stringify(sliced, null, 2), "utf8");
    console.log(`✔ Wrote ${sliced.length} rows → ${OUT_FILE}`);
  } catch (e) {
    console.error("✖ Failed to fetch schedule:", e?.message || e);
    process.exit(1);
  }
})();
