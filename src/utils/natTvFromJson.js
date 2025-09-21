// src/utils/natTvFromJson.js

// Canonical team-code map (keys are canonical names after normTeamName)
const TEAM_CODES = {
  "Atlanta Hawks":"ATL","Boston Celtics":"BOS","Brooklyn Nets":"BKN","Charlotte Hornets":"CHA","Chicago Bulls":"CHI",
  "Cleveland Cavaliers":"CLE","Dallas Mavericks":"DAL","Denver Nuggets":"DEN","Detroit Pistons":"DET","Golden State Warriors":"GSW",
  "Houston Rockets":"HOU","Indiana Pacers":"IND","Los Angeles Clippers":"LAC","Los Angeles Lakers":"LAL",
  "Memphis Grizzlies":"MEM","Miami Heat":"MIA","Milwaukee Bucks":"MIL","Minnesota Timberwolves":"MIN","New Orleans Pelicans":"NOP",
  "New York Knicks":"NYK","Oklahoma City Thunder":"OKC","Orlando Magic":"ORL","Philadelphia 76ers":"PHI","Phoenix Suns":"PHX",
  "Portland Trail Blazers":"POR","Sacramento Kings":"SAC","San Antonio Spurs":"SAS","Toronto Raptors":"TOR","Utah Jazz":"UTA",
  "Washington Wizards":"WAS"
};

// Normalize common variants to canonical names used above
function normTeamName(name = "") {
  return String(name).trim()
    // Clippers
    .replace(/^LA\s+Clippers$/i, "Los Angeles Clippers")
    .replace(/^L\.?A\.?\s+Clippers$/i, "Los Angeles Clippers")
    // Lakers
    .replace(/^L\.?A\.?\s+Lakers$/i, "Los Angeles Lakers")
    .replace(/^LA\s+Lakers$/i, "Los Angeles Lakers")
    // Warriors shorthand
    .replace(/^G\.?S\.?W\.?$/i, "Golden State Warriors")
    // Suns odd sources
    .replace(/^PHX\s+Suns$/i, "Phoenix Suns")
    // Thunder shorthand
    .replace(/^OKC\s+Thunder$/i, "Oklahoma City Thunder");
}

function teamCode(name) {
  const code = TEAM_CODES[normTeamName(name)];
  return code || null; // null => non-NBA team
}

const STAGE = {
  "Preseason": 1,
  "Emirates NBA Cup": 3,
  "Regular Season": 2
};

// ----- stage handling (preseason/title suffixes) -----
const STAGE_NAMES = Object.keys(STAGE); // ["Preseason", "Emirates NBA Cup", "Regular Season"]
const STAGE_RE = new RegExp(`\\b(?:${STAGE_NAMES.map(s=>s.replace(/\s+/g,'\\s+')).join('|')})\\b`, 'i');

// Derive competition from description or from a “— Stage” suffix
function deriveCompetition({ description, summary, title }) {
  const firstPipe = (description || "").split(" | ")[0];
  if (STAGE_RE.test(firstPipe)) return firstPipe;

  const text = String(summary ?? title ?? "");
  const m = text.match(/[—-]\s*(.*)$/);
  if (m && STAGE_RE.test(m[1])) return m[1].trim();

  return "Regular Season";
}

// Strip stage words from the title so they aren’t parsed as opponents
function sanitizeTitleForMatchup(txt) {
  let s = String(txt || "");
  s = s.replace(/\s*[—-]\s*(?:Preseason|Emirates\s+NBA\s+Cup|Regular\s+Season)\s*$/i, ""); // suffix
  s = s.replace(/\s+(?:vs|@|at)\s+(?:Preseason|Emirates\s+NBA\s+Cup|Regular\s+Season)\b/i, ""); // malformed "vs Preseason"
  return s.replace(/\s+/g, " ").trim();
}

// Parse “A at B”, “A vs B”, or “A @ B”
function parseMatchupFromSummary(summaryOrTitle) {
  const cleaned = sanitizeTitleForMatchup(summaryOrTitle);
  const patterns = [
    /^(.+?)\s+at\s+(.+)$/i,
    /^(.+?)\s+vs\.?\s+(.+)$/i,
    /^(.+?)\s+@\s+(.+)$/i,
  ];
  for (const re of patterns) {
    const m = cleaned.match(re);
    if (m) {
      const visitor = m[1].trim();
      const home = m[2].trim();
      if (STAGE_RE.test(visitor) || STAGE_RE.test(home)) continue;
      return { visitor, home };
    }
  }
  return { visitor: null, home: null };
}

function toDateKey(dt) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth()+1).padStart(2,"0");
  const d = String(dt.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}

// Robust parser for string or {dateTime}/{date}/{start} shapes
function parseLocal(dtLike) {
  if (!dtLike) return null;
  const coerce = (val) => {
    const d = new Date(val);
    return isNaN(d) ? null : d;
  };
  if (typeof dtLike === "string") return coerce(dtLike);
  if (typeof dtLike === "object") {
    if (dtLike.dateTime) return coerce(dtLike.dateTime);
    if (dtLike.start)   return coerce(dtLike.start);
    if (dtLike.end)     return coerce(dtLike.end);
    if (dtLike.date)    return coerce(dtLike.date); // all-day
  }
  return null;
}

// Always display label in Eastern Time
function timeETLabel(dt) {
  if (!(dt instanceof Date) || isNaN(dt)) return "TBD";
  try {
    const s = dt.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York"
    });
    return `${s} ET`;
  } catch {
    const s = dt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${s} ET`;
  }
}

// Heuristic: is this “calendar-like” JSON (has start + title/summary)?
function looksCalendarish(obj) {
  if (!obj || typeof obj !== "object") return false;
  const hasStart = "start" in obj;
  const hasTitleOrSummary = ("summary" in obj) || ("title" in obj);
  return hasStart && hasTitleOrSummary;
}

/**
 * normalizeNatTvJson
 * Accepts:
 *  A) calendar-ish objects: { summary|title, start, description? }
 *  B) raw schedule objects: { date, time_et|time, competition, visitor, home }
 * Returns calendar rows (one per team per game).
 */
export function normalizeNatTvJson(inputJson) {
  if (!Array.isArray(inputJson) || !inputJson.length) return [];

  const first = inputJson[0];
  const looksLikeCalendarJson = looksCalendarish(first);
  const looksLikeRawSchedule = first && ("date" in first) && ("visitor" in first) && ("home" in first);

  let games = [];

  if (looksLikeCalendarJson) {
    for (const g of inputJson) {
      const start = parseLocal(g.start);
      if (!start) continue;

      const comp = deriveCompetition({ description: g.description, summary: g.summary, title: g.title });
      const seasonStageId = STAGE[comp] ?? 2;

      const text = g.summary ?? g.title ?? "";
      let { visitor, home } = parseMatchupFromSummary(text);
      if (!visitor || !home) continue;

      const vCode = teamCode(visitor);
      const hCode = teamCode(home);
      if (!vCode && !hCode) continue;

      const et = timeETLabel(start);
      const dateKey = toDateKey(start);
      const _iso = start.toISOString();

      if (vCode) {
        games.push({
          dateKey, _iso, et,
          _teamCode: vCode, _teamName: normTeamName(visitor),
          homeAway: "Away", opp: normTeamName(home),
          seasonStageId
        });
      }
      if (hCode) {
        games.push({
          dateKey, _iso, et,
          _teamCode: hCode, _teamName: normTeamName(home),
          homeAway: "Home", opp: normTeamName(visitor),
          seasonStageId
        });
      }
    }
  } else if (looksLikeRawSchedule) {
    for (const g of inputJson) {
      const dateStr = String(g.date || "").replace(/^\w+,\s+/, "");
      const year = String(g.year || "").trim() || String(new Date().getFullYear());
      const timeStr = String(g.time_et || g.time || "").replace(/\s*ET$/i, "");
      const start = new Date(`${dateStr} ${year} ${timeStr} EDT`);
      if (isNaN(start.getTime())) continue;

      const comp = g.competition || "Regular Season";
      const seasonStageId = STAGE[comp] ?? 2;

      const visitor = normTeamName(g.visitor || "");
      const home = normTeamName(g.home || "");
      const vCode = teamCode(visitor);
      const hCode = teamCode(home);
      if (!vCode && !hCode) continue;

      const et = timeETLabel(start);
      const dateKey = toDateKey(start);
      const _iso = start.toISOString();

      if (vCode) {
        games.push({
          dateKey, _iso, et,
          _teamCode: vCode, _teamName: visitor,
          homeAway: "Away", opp: home,
          seasonStageId
        });
      }
      if (hCode) {
        games.push({
          dateKey, _iso, et,
          _teamCode: hCode, _teamName: home,
          homeAway: "Home", opp: visitor,
          seasonStageId
        });
      }
    }
  } else {
    return [];
  }

  games.sort((a,b)=>
    String(a.dateKey).localeCompare(String(b.dateKey)) ||
    String(a._iso).localeCompare(String(b._iso)) ||
    String(a._teamCode||"").localeCompare(String(b._teamCode||""))
  );
  return games;
}
