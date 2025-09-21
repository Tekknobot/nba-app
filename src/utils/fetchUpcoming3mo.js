// src/utils/fetchUpcoming3mo.js
// Works in CRA with ZERO proxy required. Uses balldontlie (reliable) as the base,
// and *optionally* enriches rows with national TV broadcasters from cdn.nba.com
// or data.nba.net when those endpoints are reachable. No natTvFromJson dependency.

// ---------------- team mapping ----------------
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
    .replace(/^LA\s+Lakers$/i,"Los Angeles Lakers");
}
const teamCode = (name)=> TEAM_CODES[normTeamName(name)] || null;

const STAGE = { "Preseason":1, "Emirates NBA Cup":3, "Regular Season":2 };

// ---------------- helpers ----------------
const BDL_URL = "https://www.balldontlie.io/api/v1/games";
const NBA_CDN = "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json"; // may be blocked in some networks
const DATA_NBA_NET = (year)=> `https://data.nba.net/prod/v2/${year}/schedule.json`; // secondary NBA source

const ymdDash = (d)=> `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
function addMonthsClamp(d, months){ const x=new Date(d); x.setMonth(x.getMonth()+months); return x; }
function toDateKey(dt){ return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`; }
function etLabel(dt){
  try{
    return `${dt.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/New_York"})} ET`;
  }catch{ return `${dt.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"})} ET`; }
}
async function fetchJson(url, init){
  const r = await fetch(url, { cache: "no-store", ...init });
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
}
function seasonYearForToday(){
  const d = new Date();
  const m = d.getMonth() + 1; // 1..12
  // Use current year from Aug+ (covers preseason/season), otherwise prev year
  return (m >= 8 ? d.getFullYear() : d.getFullYear() - 1);
}

// ---------------- base source: balldontlie (reliable) ----------------
async function fetchBdlRange(start, end){
  const per_page = 100;
  let page = 1, done = false;
  const rows = [];

  while(!done && page <= 5){ // cap pages to keep it snappy
    const params = new URLSearchParams({
      start_date: ymdDash(start),
      end_date: ymdDash(end),
      per_page: String(per_page),
      page: String(page),
    });
    const j = await fetchJson(`${BDL_URL}?${params.toString()}`);

    for (const g of j?.data || []) {
      const awayName = normTeamName(g?.visitor_team?.full_name || g?.visitor_team?.name);
      const homeName = normTeamName(g?.home_team?.full_name || g?.home_team?.name);
      if (!awayName || !homeName) continue;
      const vCode = teamCode(awayName);
      const hCode = teamCode(homeName);
      if (!vCode && !hCode) continue;

      const startISO = g?.date ? new Date(g.date) : null;
      if (!startISO || isNaN(startISO)) continue;

      const dateKey = toDateKey(startISO);
      const _iso = startISO.toISOString();
      const et = etLabel(startISO);
      const seasonStageId = STAGE["Regular Season"] ?? 2;

      // Emit two rows (away & home perspectives)
      if (vCode) rows.push({ dateKey,_iso,et,_teamCode:vCode,_teamName:awayName,homeAway:"Away",opp:homeName,seasonStageId });
      if (hCode) rows.push({ dateKey,_iso,et,_teamCode:hCode,_teamName:homeName,homeAway:"Home",opp:awayName,seasonStageId });
    }

    const meta = j?.meta;
    if (!meta || meta.current_page >= meta.total_pages) done = true;
    page += 1;
  }

  rows.sort((a,b)=>
    String(a.dateKey).localeCompare(String(b.dateKey)) ||
    String(a._iso).localeCompare(String(b._iso)) ||
    String(a._teamCode||"").localeCompare(String(b._teamCode||""))
  );
  return rows;
}

// ---------------- enrichment sources: NBA (TV networks) ----------------
function extractFromCdn(json){
  // returns Map<key, Set<string>> keyed by "YYYY-MM-DD|Away Name|Home Name"
  const tvMap = new Map();
  const dates = json?.leagueSchedule?.gameDates || [];
  for (const day of dates) {
    for (const g of (day?.games || [])) {
      const awayName = normTeamName(g?.awayTeam?.teamName || g?.awayTeam?.teamCity || g?.awayTeam?.teamTricode);
      const homeName = normTeamName(g?.homeTeam?.teamName || g?.homeTeam?.teamCity || g?.homeTeam?.teamTricode);
      if (!awayName || !homeName) continue;

      const whenStr = g?.gameDateTimeUTC || g?.gameDateTimeEst || g?.gameDateUTC || g?.gameDateEst;
      const start = whenStr ? new Date(whenStr) : null;
      if (!start || isNaN(start)) continue;

      const nat = g?.broadcasters?.nationalTvBroadcasters?.map(b=>b?.broadcasterName)?.filter(Boolean) || [];
      if (nat.length === 0) continue;

      const key = `${toDateKey(start)}|${awayName}|${homeName}`;
      const existing = tvMap.get(key);
      if (existing) nat.forEach(n=> existing.add(n));
      else tvMap.set(key, new Set(nat));
    }
  }
  return tvMap;
}

function extractFromDataNba(json){
  // data.nba.net rarely includes national TV consistently; keep for structural parity.
  // We’ll just return keys (no TV) so CDN is the main enrichment.
  const tvMap = new Map();
  const games = json?.league?.standard || [];
  for (const g of games) {
    const awayName = normTeamName(g?.vTeam?.fullName || g?.vTeam?.triCode || g?.vTeam?.nickname);
    const homeName = normTeamName(g?.hTeam?.fullName || g?.hTeam?.triCode || g?.hTeam?.nickname);
    if (!awayName || !homeName) continue;
    const whenStr = g?.startTimeUTC || g?.startTimeEastern || g?.startTime;
    const start = whenStr ? new Date(whenStr) : null;
    if (!start || isNaN(start)) continue;

    const key = `${toDateKey(start)}|${awayName}|${homeName}`;
    if (!tvMap.has(key)) tvMap.set(key, new Set()); // empty set
  }
  return tvMap;
}

// Merge BDL rows with NBA TV (prefer rows that gain TV info)
function mergeTvIntoRows(rows, tvMap){
  if (!tvMap || tvMap.size === 0) return rows;
  const out = rows.map(r => {
    // Build the game key from an away/home perspective
    const isAway = r.homeAway === "Away";
    const awayName = isAway ? r._teamName : r.opp;
    const homeName = isAway ? r.opp : r._teamName;
    const key = `${r.dateKey}|${awayName}|${homeName}`;

    const tvSet = tvMap.get(key);
    if (!tvSet || tvSet.size === 0) return r;

    const tvList = [...tvSet];
    return { ...r, _tv: tvList }; // add TV networks without changing your existing UI
  });
  return out;
}

/**
 * Public API: getUpcomingGamesNextMonths
 * - Always returns rows from balldontlie for next `months`.
 * - In parallel, tries NBA sources and, if available, enriches rows with `_tv: [..]`.
 * - If you want to show TV in your UI, display a chip when `row._tv?.length`.
 */
export async function getUpcomingGamesNextMonths(months = 3, { filterTeamCode = null } = {}) {
  const start = new Date(); start.setHours(0,0,0,0);
  const end = addMonthsClamp(start, months);

  // 1) Fetch base schedule (BDL) – reliable
  const basePromise = fetchBdlRange(start, end);

  // 2) In parallel, *attempt* NBA feeds (may fail under some networks)
  const nbaPromises = [
    fetchJson(NBA_CDN).then(extractFromCdn).catch(()=> null),
    fetchJson(DATA_NBA_NET(seasonYearForToday())).then(extractFromDataNba).catch(()=> null),
  ];

  const [baseRows, nbaA, nbaB] = await Promise.all([
    basePromise,
    ...nbaPromises
  ]);

  // Filter by team if needed (do before enrichment to reduce work)
  let rows = filterTeamCode ? baseRows.filter(r => r._teamCode === filterTeamCode) : baseRows;

  // 3) Merge TV info if any NBA map succeeded
  const tvMap = nbaA || nbaB; // prefer CDN map if present
  rows = mergeTvIntoRows(rows, tvMap);

  return rows;
}
