// api/nba-data.js
// Keyless NBA data adapter for PIVT.
// Uses ESPN's public site JSON endpoints from the server so the browser never
// needs an API key and we can normalize response shapes in one place.

const ESPN_SITE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const ESPN_WEB = "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba";

const TEAM_ID = {
  ATL: "1", BOS: "2", BKN: "17", CHA: "30", CHI: "4", CLE: "5",
  DAL: "6", DEN: "7", DET: "8", GSW: "9", HOU: "10", IND: "11",
  LAC: "12", LAL: "13", MEM: "29", MIA: "14", MIL: "15", MIN: "16",
  NOP: "3", NYK: "18", OKC: "25", ORL: "19", PHI: "20", PHX: "21",
  POR: "22", SAC: "23", SAS: "24", TOR: "28", UTA: "26", WAS: "27",
};

const ESPN_TO_UI = {
  GS: "GSW", GSW: "GSW", NO: "NOP", NOP: "NOP", NY: "NYK", NYK: "NYK",
  SA: "SAS", SAS: "SAS", UTAH: "UTA", UTA: "UTA", WSH: "WAS", WAS: "WAS",
  BKN: "BKN", BRK: "BKN", PHO: "PHX", PHX: "PHX", CHO: "CHA", CHA: "CHA",
};

const cache = new Map();
const TTL = {
  scoreboard: 20 * 1000,
  schedule: 30 * 60 * 1000,
  summary: 60 * 60 * 1000,
  stats: 60 * 60 * 1000,
};

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}
function cacheSet(key, value, ttl) {
  cache.set(key, { value, expires: Date.now() + ttl });
  return value;
}

async function fetchJson(url, ttl = 5 * 60 * 1000) {
  const key = String(url);
  const cached = cacheGet(key);
  if (cached) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const r = await fetch(url, {
      headers: {
        Accept: "application/json,text/plain,*/*",
        "User-Agent": "PIVT/2.0 (+keyless public NBA data adapter)",
      },
      signal: controller.signal,
    });
    if (!r.ok) throw new Error(`upstream HTTP ${r.status}`);
    const json = await r.json();
    return cacheSet(key, json, ttl);
  } finally {
    clearTimeout(timer);
  }
}

function normCode(v = "") {
  const c = String(v || "").trim().toUpperCase();
  return ESPN_TO_UI[c] || c;
}
function asNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function dateOnly(v) {
  if (!v) return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}
function ymd(iso) { return String(iso || "").replace(/-/g, "").slice(0, 8); }
function dateKeyEastern(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return dateOnly(v);
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(d);
    const get = (t) => parts.find((x) => x.type === t)?.value || "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return d.toISOString().slice(0, 10);
  }
}
function seasonEndYearFrom(anchorISO) {
  const d = anchorISO ? new Date(`${dateOnly(anchorISO)}T12:00:00Z`) : new Date();
  return d.getUTCMonth() >= 9 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
}
function monthBounds(year, month1) {
  const y = Number(year), m = Number(month1);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(y, m, 0));
  const end = endDate.toISOString().slice(0, 10);
  return { start, end };
}

function teamFromCompetitor(c) {
  const t = c?.team || {};
  return {
    name: t.displayName || t.shortDisplayName || t.name || t.location || normCode(t.abbreviation),
    code: normCode(t.abbreviation || t.shortDisplayName || t.name),
    logo: t.logo || t.logos?.[0]?.href || "",
    color: t.color ? `#${String(t.color).replace(/^#/, "")}` : "",
    alternateColor: t.alternateColor ? `#${String(t.alternateColor).replace(/^#/, "")}` : "",
  };
}

function normalizeCompetition(comp, event = {}) {
  const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
  const homeC = competitors.find((c) => String(c?.homeAway).toLowerCase() === "home") || competitors[0];
  const awayC = competitors.find((c) => String(c?.homeAway).toLowerCase() === "away") || competitors[1];
  if (!homeC || !awayC) return null;

  const dt = event?.date || comp?.date || event?.competitions?.[0]?.date || null;
  const statusType = event?.status?.type || comp?.status?.type || {};
  const state = String(statusType?.state || "").toLowerCase();
  const completed = Boolean(statusType?.completed) || state === "post" || /final/i.test(statusType?.description || "");
  const status = statusType?.shortDetail || statusType?.detail || statusType?.description || (completed ? "Final" : "Scheduled");
  const seasonType = Number(event?.season?.type ?? comp?.type?.id ?? comp?.season?.type ?? 2);
  const homeScore = asNum(homeC?.score?.value ?? homeC?.score);
  const awayScore = asNum(awayC?.score?.value ?? awayC?.score);
  const home = teamFromCompetitor(homeC);
  const away = teamFromCompetitor(awayC);

  return {
    id: String(event?.id || comp?.id || ""),
    _iso: dt ? new Date(dt).toISOString() : "",
    dateKey: dateKeyEastern(dt),
    status,
    state,
    completed,
    hasClock: Boolean(dt),
    homeScore,
    awayScore,
    et: status,
    seasonStageId: seasonType || 2,
    home,
    away,
  };
}

function normalizeEvent(event) {
  const comp = event?.competitions?.[0];
  return comp ? normalizeCompetition(comp, event) : null;
}

async function scoreboard(start, end) {
  const startDate = dateOnly(start);
  const endDate = dateOnly(end || start);
  if (!startDate || !endDate) throw new Error("Invalid scoreboard date");

  // ESPN's NBA scoreboard accepts a single day (YYYYMMDD) or a whole
  // month (YYYYMM). A YYYYMMDD-YYYYMMDD range currently returns HTTP 400,
  // so use the compact month form whenever the requested bounds share one
  // calendar month. Fall back to individual days only for a true cross-month
  // range.
  const sameMonth = startDate.slice(0, 7) === endDate.slice(0, 7);
  if (sameMonth) {
    const dates = startDate === endDate
      ? ymd(startDate)
      : startDate.slice(0, 7).replace("-", "");
    const u = new URL(`${ESPN_SITE}/scoreboard`);
    u.searchParams.set("dates", dates);
    u.searchParams.set("limit", "1000");
    const j = await fetchJson(u, TTL.scoreboard);
    return (Array.isArray(j?.events) ? j.events : []).map(normalizeEvent).filter(Boolean);
  }

  // Cross-month windows are fetched a month at a time instead of one HTTP
  // request per day. This matters for PIVT 3 / form analysis windows and keeps
  // the public upstream load modest.
  const cursor = new Date(`${startDate.slice(0, 7)}-01T12:00:00Z`);
  const last = new Date(`${endDate.slice(0, 7)}-01T12:00:00Z`);
  const months = [];
  while (cursor <= last) {
    months.push(`${cursor.getUTCFullYear()}${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const batches = await Promise.all(months.map(async (month) => {
    const u = new URL(`${ESPN_SITE}/scoreboard`);
    u.searchParams.set("dates", month);
    u.searchParams.set("limit", "1000");
    const j = await fetchJson(u, TTL.scoreboard);
    return (Array.isArray(j?.events) ? j.events : []).map(normalizeEvent).filter(Boolean);
  }));

  const seen = new Set();
  return batches.flat().filter((game) => {
    if (!game?.dateKey || game.dateKey < startDate || game.dateKey > endDate) return false;
    const key = String(game?.id || `${game?.dateKey}-${game?.away?.code}-${game?.home?.code}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function teamSchedule(teamCode, season, seasonType = 2) {
  const code = normCode(teamCode);
  const id = TEAM_ID[code];
  if (!id) throw new Error(`Unknown NBA team code: ${teamCode}`);
  const u = new URL(`${ESPN_SITE}/teams/${id}/schedule`);
  u.searchParams.set("season", String(season));
  u.searchParams.set("seasontype", String(seasonType));
  const j = await fetchJson(u, TTL.schedule);
  return (Array.isArray(j?.events) ? j.events : []).map(normalizeEvent).filter(Boolean);
}

async function gameSummary(id) {
  if (!id) throw new Error("Missing game id");
  const u = new URL(`${ESPN_SITE}/summary`);
  u.searchParams.set("event", String(id));
  return fetchJson(u, TTL.summary);
}

function gameFromSummary(j, fallbackId = "") {
  const header = j?.header || {};
  const comp = header?.competitions?.[0];
  if (!comp) return null;
  return normalizeCompetition(comp, { ...header, id: header.id || fallbackId, date: header.date || comp.date, status: comp.status || header.status });
}

function resultRow(game, teamCode) {
  const code = normCode(teamCode);
  const isHome = game?.home?.code === code;
  const my = isHome ? game.homeScore : game.awayScore;
  const oppScore = isHome ? game.awayScore : game.homeScore;
  const opp = isHome ? game.away?.code : game.home?.code;
  return {
    date: game.dateKey,
    opp,
    homeAway: isHome ? "Home" : "Away",
    result: my > oppScore ? "W" : my < oppScore ? "L" : "T",
    score: `${game.away?.code} ${game.awayScore} - ${game.home?.code} ${game.homeScore}`,
    pointsFor: Number.isFinite(my) ? my : null,
    pointsAgainst: Number.isFinite(oppScore) ? oppScore : null,
    margin: Number.isFinite(my) && Number.isFinite(oppScore) ? my - oppScore : null,
    seasonStageId: game?.seasonStageId || 2,
  };
}

function dedupeCompletedGames(games, teamCode, anchor, limit = 10) {
  const code = normCode(teamCode);
  const seen = new Set();
  return (games || [])
    .filter((g) => {
      if (!g?.completed || !g?.dateKey || (anchor && g.dateKey > anchor)) return false;
      if (g?.home?.code !== code && g?.away?.code !== code) return false;
      const key = String(g.id || `${g.dateKey}-${g.away?.code}-${g.home?.code}`);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => String(b._iso).localeCompare(String(a._iso)))
    .slice(0, limit);
}

function teamFormMetrics(games, teamCode) {
  const code = normCode(teamCode);
  let wins = 0, losses = 0, pointsFor = 0, pointsAgainst = 0, counted = 0;
  const margins = [];
  for (const g of games || []) {
    const home = g?.home?.code === code;
    const my = Number(home ? g.homeScore : g.awayScore);
    const opp = Number(home ? g.awayScore : g.homeScore);
    if (!Number.isFinite(my) || !Number.isFinite(opp)) continue;
    counted += 1;
    pointsFor += my;
    pointsAgainst += opp;
    margins.push(my - opp);
    if (my > opp) wins += 1;
    else if (my < opp) losses += 1;
  }
  const gp = Math.max(1, counted);
  const avgMargin = counted ? (pointsFor - pointsAgainst) / gp : 0;
  const variance = margins.length > 1
    ? margins.reduce((sum, margin) => sum + ((margin - avgMargin) ** 2), 0) / margins.length
    : 0;
  return {
    games: counted, wins, losses,
    winPct: counted ? wins / counted : 0.5,
    avgPointsFor: counted ? pointsFor / gp : 0,
    avgPointsAgainst: counted ? pointsAgainst / gp : 0,
    avgMargin,
    marginStdDev: Math.sqrt(variance),
  };
}

function daysBetween(a, b) {
  const ad = new Date(`${dateOnly(a)}T12:00:00Z`);
  const bd = new Date(`${dateOnly(b)}T12:00:00Z`);
  if (Number.isNaN(ad.getTime()) || Number.isNaN(bd.getTime())) return null;
  return Math.round((bd.getTime() - ad.getTime()) / 86400000);
}

function restProfile(games, anchor) {
  const last = (games || []).find((g) => g?.completed && g?.dateKey);
  if (!last || !anchor) return { daysOff: null, backToBack: false, lastGame: last?.dateKey || null };
  const gap = daysBetween(last.dateKey, anchor);
  if (!Number.isFinite(gap)) return { daysOff: null, backToBack: false, lastGame: last.dateKey };
  const daysOff = Math.max(0, gap - 1);
  return { daysOff, backToBack: gap === 1, lastGame: last.dateKey };
}

function playerImpact(players = []) {
  if (!players.length) return null;
  const values = players.map((p) =>
    (Number(p?.pts) || 0) + 0.55 * (Number(p?.reb) || 0) + 0.7 * (Number(p?.ast) || 0)
  );
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function playerNameParts(athlete = {}) {
  let first = athlete.firstName || "";
  let last = athlete.lastName || "";
  if ((!first || !last) && athlete.displayName) {
    const bits = String(athlete.displayName).trim().split(/\s+/);
    if (!first) first = bits.shift() || "";
    if (!last) last = bits.join(" ");
  }
  return { first_name: first, last_name: last };
}

function minutesToNumber(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v || "0");
  if (s.includes(":")) {
    const [m, sec] = s.split(":").map(Number);
    return (Number.isFinite(m) ? m : 0) + (Number.isFinite(sec) ? sec / 60 : 0);
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
function minutesString(n) {
  const v = Math.max(0, Number(n) || 0);
  const m = Math.floor(v);
  let s = Math.round((v - m) * 60);
  if (s === 60) return `${m + 1}:00`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function pickStatIndex(labels, names) {
  const hay = labels.map((x, i) => ({ i, s: String(x || "").toLowerCase() }));
  for (const name of names) {
    const n = String(name).toLowerCase();
    const hit = hay.find((x) => x.s === n || x.s.replace(/[^a-z0-9]/g, "") === n.replace(/[^a-z0-9]/g, ""));
    if (hit) return hit.i;
  }
  return -1;
}

function playersFromSummary(summary, teamCode) {
  const code = normCode(teamCode);
  const teams = Array.isArray(summary?.boxscore?.players) ? summary.boxscore.players : [];
  const teamEntry = teams.find((x) => normCode(x?.team?.abbreviation) === code);
  if (!teamEntry) return [];

  const groups = Array.isArray(teamEntry?.statistics) ? teamEntry.statistics : [];
  const group = groups.find((g) => Array.isArray(g?.athletes) && g.athletes.length) || groups[0];
  if (!group) return [];

  const labels = Array.isArray(group.labels) ? group.labels : (Array.isArray(group.names) ? group.names : []);
  const minI = pickStatIndex(labels, ["MIN", "minutes"]);
  const ptsI = pickStatIndex(labels, ["PTS", "points"]);
  const rebI = pickStatIndex(labels, ["REB", "rebounds", "totalRebounds"]);
  const astI = pickStatIndex(labels, ["AST", "assists"]);

  return (group.athletes || []).map((row) => {
    const athlete = row?.athlete || {};
    const stats = Array.isArray(row?.stats) ? row.stats : [];
    const id = Number(athlete?.id);
    const min = minI >= 0 ? minutesToNumber(stats[minI]) : 0;
    const pts = ptsI >= 0 ? Number(stats[ptsI]) || 0 : 0;
    const reb = rebI >= 0 ? Number(stats[rebI]) || 0 : 0;
    const ast = astI >= 0 ? Number(stats[astI]) || 0 : 0;
    return {
      player_id: Number.isFinite(id) ? id : athlete?.id,
      player: playerNameParts(athlete),
      image: athlete?.headshot?.href || (typeof athlete?.headshot === "string" ? athlete.headshot : ""),
      min,
      pts,
      reb,
      ast,
      didNotPlay: Boolean(row?.didNotPlay),
    };
  }).filter((p) => p.player_id && !p.didNotPlay);
}

function aggregatePlayers(gamesPlayers, topN) {
  const by = new Map();
  for (const rows of gamesPlayers) {
    for (const row of rows) {
      const id = String(row.player_id);
      if (!by.has(id)) by.set(id, { ...row, gp: 0, minSum: 0, ptsSum: 0, rebSum: 0, astSum: 0 });
      const p = by.get(id);
      p.gp += 1;
      p.minSum += Number(row.min) || 0;
      p.ptsSum += Number(row.pts) || 0;
      p.rebSum += Number(row.reb) || 0;
      p.astSum += Number(row.ast) || 0;
      if (row.player) p.player = row.player;
      if (row.image) p.image = row.image;
    }
  }
  return Array.from(by.values()).map((p) => ({
    player_id: p.player_id,
    player: p.player,
    image: p.image || "",
    min: minutesString(p.minSum / Math.max(1, p.gp)),
    pts: p.ptsSum / Math.max(1, p.gp),
    reb: p.rebSum / Math.max(1, p.gp),
    ast: p.astSum / Math.max(1, p.gp),
  })).sort((a, b) => minutesToNumber(b.min) - minutesToNumber(a.min) || b.pts - a.pts).slice(0, topN);
}

function statPairsFromCategories(categories = []) {
  const out = new Map();
  for (const c of categories || []) {
    const names = Array.isArray(c?.names) ? c.names : [];
    const labels = Array.isArray(c?.labels) ? c.labels : [];
    const totals = Array.isArray(c?.totals) ? c.totals : [];
    const count = Math.max(names.length, labels.length, totals.length);
    for (let i = 0; i < count; i++) {
      const v = Number(totals[i]);
      if (!Number.isFinite(v)) continue;
      for (const key of [names[i], labels[i]]) {
        if (!key) continue;
        out.set(String(key).toLowerCase().replace(/[^a-z0-9]/g, ""), v);
      }
    }
  }
  return out;
}
function firstMapped(map, keys, fallback = 0) {
  for (const key of keys) {
    const k = String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (map.has(k)) return map.get(k);
  }
  return fallback;
}

async function seasonAthleteRows(season) {
  const u = new URL(`${ESPN_WEB}/statistics/byathlete`);
  u.searchParams.set("region", "us");
  u.searchParams.set("lang", "en");
  u.searchParams.set("contentorigin", "espn");
  u.searchParams.set("isqualified", "false");
  u.searchParams.set("page", "1");
  u.searchParams.set("limit", "500");
  u.searchParams.set("sort", "offensive.avgPoints:desc");
  u.searchParams.set("season", String(season));
  u.searchParams.set("seasontype", "2");
  const j = await fetchJson(u, TTL.stats);
  return Array.isArray(j?.athletes) ? j.athletes : [];
}

function parseSeasonPlayers(rows, teamCode, topN) {
  const wanted = normCode(teamCode);
  const parsed = (rows || []).filter((x) => {
    const a = x?.athlete || {};
    return normCode(a?.teamShortName || a?.team?.abbreviation || a?.teamAbbreviation) === wanted;
  }).map((x) => {
    const a = x?.athlete || {};
    const stats = statPairsFromCategories(x?.categories || []);
    const min = firstMapped(stats, ["avgMinutes", "minutesPerGame", "minutes"], 0);
    const pts = firstMapped(stats, ["avgPoints", "pointsPerGame", "points"], 0);
    const reb = firstMapped(stats, ["avgRebounds", "reboundsPerGame", "rebounds"], 0);
    const ast = firstMapped(stats, ["avgAssists", "assistsPerGame", "assists"], 0);
    return {
      player_id: a?.id,
      player: playerNameParts(a),
      image: a?.headshot?.href || (typeof a?.headshot === "string" ? a.headshot : ""),
      min: minutesString(min),
      pts, reb, ast,
    };
  }).filter((p) => p.player_id && (p.pts || p.reb || p.ast || minutesToNumber(p.min)));

  parsed.sort((a, b) => minutesToNumber(b.min) - minutesToNumber(a.min) || b.pts - a.pts);
  return parsed.slice(0, topN);
}

async function seasonFallbackPlayers(teamCode, season, topN) {
  const rows = await seasonAthleteRows(season);
  return parseSeasonPlayers(rows, teamCode, topN);
}

async function getTopPlayers(teamCode, anchor, days = 21, topN = 3, stage = 2) {
  const team = normCode(teamCode);
  const safeAnchor = dateOnly(anchor) || new Date().toISOString().slice(0, 10);
  const safeDays = Math.max(1, Math.min(45, Number(days) || 21));
  const safeTopN = Math.max(1, Math.min(5, Number(topN) || 3));
  const season = seasonEndYearFrom(safeAnchor);
  const startD = new Date(`${safeAnchor}T12:00:00Z`);
  startD.setUTCDate(startD.getUTCDate() - safeDays);
  const start = startD.toISOString().slice(0, 10);

  const [regular, preseason] = await Promise.all([
    teamSchedule(team, season, 2).catch(() => []),
    teamSchedule(team, season, 1).catch(() => []),
  ]);
  const recentGames = dedupeCompletedGames(stage === 1 ? preseason : regular, team, safeAnchor, 10)
    .filter((g) => g.dateKey >= start);

  if (recentGames.length) {
    const boxes = await Promise.all(recentGames.map(async (g) => {
      try { return playersFromSummary(await gameSummary(g.id), team); }
      catch { return []; }
    }));
    const players = aggregatePlayers(boxes, safeTopN);
    if (players.length) return { players, _mode: "recent", _season: season, _sampleGames: recentGames.length };
  }

  let players = await seasonFallbackPlayers(team, season, safeTopN).catch(() => []);
  let usedSeason = season;
  if (!players.length) {
    players = await seasonFallbackPlayers(team, season - 1, safeTopN).catch(() => []);
    usedSeason = season - 1;
  }
  return { players, _mode: "season-fallback", _season: usedSeason, _sampleGames: 0 };
}

async function recentTeamGames(teamCode, anchor, limit = 5, stage = 2) {
  const team = normCode(teamCode);
  const safeAnchor = dateOnly(anchor) || new Date().toISOString().slice(0, 10);
  const season = seasonEndYearFrom(safeAnchor);
  // Preseason never counts as regular-season evidence. Early regular season
  // borrows a discounted prior from the previous regular season, not exhibitions.
  const stages = stage === 1 ? [[season, 1], [season - 1, 1]]
    : [[season, 2], [season - 1, 2]];
  const pools = await Promise.all(stages.map(async ([year, type]) => ({
    year, type, games: await teamSchedule(team, year, type).catch(() => [])
  })));
  const current = dedupeCompletedGames(pools[0].games.filter(g => Number(g.seasonStageId) === stage), team, safeAnchor, limit);
  const older = dedupeCompletedGames(pools[1].games.filter(g => Number(g.seasonStageId) === stage), team, safeAnchor, limit);
  return [...current, ...older].slice(0, limit).map(g => ({ ...g,
    _historicalPrior: !current.some(row => row.id === g.id),
    _currentStageGames: current.length,
  }));
}

function predictionFromInputs(awayCode, homeCode, awayGames, homeGames, awayPlayers, homePlayers, anchor = "") {
  const stage = predictionStage(anchor);
  const currentAway = awayGames.filter(g => !g._historicalPrior && Number(g.seasonStageId) === stage);
  const currentHome = homeGames.filter(g => !g._historicalPrior && Number(g.seasonStageId) === stage);
  const priorAway = awayGames.filter(g => g._historicalPrior && Number(g.seasonStageId) === stage);
  const priorHome = homeGames.filter(g => g._historicalPrior && Number(g.seasonStageId) === stage);
  const blend = (recent, prior) => {
    const m = teamFormMetrics(recent, recent === currentAway || recent === priorAway ? awayCode : homeCode);
    const historical = teamFormMetrics(prior, recent === currentAway || recent === priorAway ? awayCode : homeCode);
    const recentWeight = stage === 1 ? 1 : Math.min(1, recent.length / 12);
    const priorWeight = prior.length ? 1 - recentWeight : 0;
    const divisor = recent.length ? recentWeight + priorWeight : priorWeight;
    return { ...m,
      winPct: divisor ? (m.winPct * (recent.length ? recentWeight : 0) + historical.winPct * priorWeight) / divisor : .5,
      avgMargin: divisor ? (m.avgMargin * (recent.length ? recentWeight : 0) + historical.avgMargin * priorWeight) / divisor : 0,
      marginStdDev: Math.max(m.marginStdDev, historical.marginStdDev * priorWeight),
      games: recent.length,
    };
  };
  const away = blend(currentAway, priorAway);
  const home = blend(currentHome, priorHome);
  const awayImpact = playerImpact(awayPlayers);
  const homeImpact = playerImpact(homePlayers);
  const awayRest = restProfile(currentAway, anchor);
  const homeRest = restProfile(currentHome, anchor);

  const formRating = (m) => ((m.winPct - 0.5) * 18) + clamp(m.avgMargin, -15, 15) * 0.65;
  let homeEdge = formRating(home) - formRating(away) + 1.25;
  const hasPlayerStats = awayImpact !== null && homeImpact !== null;
  if (hasPlayerStats) homeEdge += clamp((homeImpact - awayImpact) / 7, -3, 3);

  // Fatigue is deliberately a modest adjustment. It should break close ties,
  // not overpower actual basketball form.
  if (awayRest.backToBack && !homeRest.backToBack) homeEdge += 1.1;
  else if (homeRest.backToBack && !awayRest.backToBack) homeEdge -= 1.1;
  else if (Number.isFinite(awayRest.daysOff) && Number.isFinite(homeRest.daysOff)) {
    const restGap = clamp(homeRest.daysOff - awayRest.daysOff, -2, 2);
    homeEdge += restGap * 0.3;
  }

  // Volatility, sparse samples and unavailable lineup verification shrink the
  // raw heuristic toward 50%. No invented injury status is assumed.
  const evidence = Math.min(1, Math.min(currentAway.length, currentHome.length) / 10);
  const playerReliability = hasPlayerStats ? .92 : .78;
  const rawProb = 100 / (1 + Math.exp(-homeEdge / 8.5));
  let homeProb = 50 + (rawProb - 50) * (.40 + .60 * evidence) * playerReliability;
  const minGames = Math.min(away.games, home.games);
  homeProb = clamp(homeProb, minGames < 3 ? 42 : 30, minGames < 3 ? 58 : 70);
  const awayProb = 100 - homeProb;
  const pick = homeProb >= 50 ? normCode(homeCode) : normCode(awayCode);
  const pickProb = Math.max(homeProb, awayProb);
  const volatility = Math.max(away.marginStdDev || 0, home.marginStdDev || 0);
  let confidence = "low";
  if (minGames >= 5 && hasPlayerStats && pickProb >= 64 && volatility <= 16) confidence = "high";
  else if (minGames >= 5 && pickProb >= 58 && volatility <= 20) confidence = "medium";

  const factors = [];
  const winDiff = home.winPct - away.winPct;
  const marginDiff = home.avgMargin - away.avgMargin;
  if (Math.abs(winDiff) >= 0.12) factors.push(`${winDiff > 0 ? normCode(homeCode) : normCode(awayCode)} has the stronger recent win rate`);
  if (Math.abs(marginDiff) >= 2.5) factors.push(`${marginDiff > 0 ? normCode(homeCode) : normCode(awayCode)} has the better recent scoring margin`);
  if (hasPlayerStats && Math.abs(homeImpact - awayImpact) >= 2.5) factors.push(`${homeImpact > awayImpact ? normCode(homeCode) : normCode(awayCode)} has the stronger top-player production sample`);
  if (awayRest.backToBack !== homeRest.backToBack) factors.push(`${awayRest.backToBack ? normCode(homeCode) : normCode(awayCode)} has the rest advantage`);
  if (factors.length < 2) factors.push(`${normCode(homeCode)} receives a small home-court adjustment`);

  return {
    pick,
    homeProbability: Math.round(homeProb),
    awayProbability: Math.round(awayProb),
    confidence,
    sample: { awayGames: away.games, homeGames: home.games, playerStats: hasPlayerStats, stage,
      availabilityVerified: false, priorUsed: priorAway.length > 0 || priorHome.length > 0 },
    modelVersion: "stage-aware-v2", seasonType: stage,
    form: { away, home },
    rest: { away: awayRest, home: homeRest },
    playerImpact: { away: awayImpact, home: homeImpact },
    factors: factors.slice(0, 4),
    model: "Stage-isolated form + discounted prior + uncertainty shrinkage + rest + player production (availability unverified)",
  };
}

function predictionStage(anchor) {
  // Current season boundaries use known 2026 opening night. For other years,
  // fall back to October 20 until season-calendar metadata is available.
  const season = seasonEndYearFrom(anchor);
  const opening = season === 2027 ? "2026-10-20" : `${season - 1}-10-20`;
  return anchor < opening ? 1 : 2;
}

// Calibrate only on earlier frozen predictions from this exact model generation.
// Minimum 60 settled picks within the same stage; until then probabilities
// stay deliberately conservative rather than overfit a handful of games.
async function calibratePrediction(prediction, anchor) {
  if (!process.env.DATABASE_URL || !prediction) return prediction;
  try {
    const { neon } = require("@neondatabase/serverless");
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`SELECT snapshot FROM pivt3_slates WHERE date < ${anchor} ORDER BY date DESC LIMIT 600`;
    const eligible = rows.flatMap(row => row.snapshot?.picks || []).filter(p =>
      p.modelVersion === "stage-aware-v2" && Number(p.seasonType) === Number(prediction.seasonType) &&
      p.result?.completed && p.result?.actualWinner);
    if (eligible.length < 60) return prediction;
    const predicted = eligible.map(p => ({
      prob: (p.pick === p.home?.code ? Number(p.homeProbability) : Number(p.awayProbability)) / 100,
      hit: p.pick === p.result.actualWinner ? 1 : 0,
    })).filter(p => Number.isFinite(p.prob));
    const bucket = x => x < .60 ? 0 : x < .65 ? 1 : 2;
    const raw = Math.max(prediction.homeProbability, prediction.awayProbability) / 100;
    const comparable = predicted.filter(p => bucket(p.prob) === bucket(raw));
    if (comparable.length < 25) return prediction;
    // Beta smoothing plus a 50% maximum adjustment weight prevents noisy jumps.
    const empirical = (comparable.reduce((sum,p) => sum + p.hit, 0) + 20 * raw) / (comparable.length + 20);
    const adjusted = Math.min(.70, Math.max(.50, raw + (empirical - raw) * .5));
    // Store direction before refit so away/home mapping is unambiguous.
    const homeLeads = prediction.homeProbability >= prediction.awayProbability;
    const homeProbability = Math.round(homeLeads ? adjusted * 100 : (1 - adjusted) * 100);
    return { ...prediction, homeProbability, awayProbability: 100 - homeProbability,
      calibration: { active: true, stageSample: eligible.length, comparable: comparable.length } };
  } catch (e) {
    // Missing table before first cloud sync and temporary database errors must
    // never prevent games from displaying.
    console.warn("PIVT calibration skipped:", e.message);
    return prediction;
  }
}

async function predictionForMatchup(awayCode, homeCode, anchorInput) {
  const away = normCode(awayCode);
  const home = normCode(homeCode);
  const anchor = dateOnly(anchorInput) || new Date().toISOString().slice(0, 10);
  if (!TEAM_ID[away] || !TEAM_ID[home]) throw new Error("Invalid prediction matchup");

  // Use the day before tipoff as the data cutoff so every PIVT surface uses
  // exactly the same completed-game/player sample for a scheduled matchup.
  const cutoff = new Date(`${anchor}T12:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 1);
  const modelAnchor = cutoff.toISOString().slice(0, 10);

  const [awayGames, homeGames, awayPlayersData, homePlayersData] = await Promise.all([
    recentTeamGames(away, modelAnchor, 5, predictionStage(anchor)),
    recentTeamGames(home, modelAnchor, 5, predictionStage(anchor)),
    getTopPlayers(away, modelAnchor, 21, 3, predictionStage(anchor)),
    getTopPlayers(home, modelAnchor, 21, 3, predictionStage(anchor)),
  ]);

  return {
    prediction: await calibratePrediction(predictionFromInputs(away, home, awayGames, homeGames, awayPlayersData.players, homePlayersData.players, anchor), anchor),
    playerModes: { away: awayPlayersData._mode, home: homePlayersData._mode },
  };
}

function predictionRankScore(prediction) {
  const edge = Math.max(Number(prediction?.homeProbability) || 50, Number(prediction?.awayProbability) || 50) - 50;
  const sample = Math.min(Number(prediction?.sample?.awayGames) || 0, Number(prediction?.sample?.homeGames) || 0);
  const confidenceBonus = prediction?.confidence === "high" ? 4 : prediction?.confidence === "medium" ? 2 : 0;
  const reliability = (0.4 + Math.min(10, sample) * .06) * (prediction?.sample?.playerStats ? 1 : .87);
  const availabilityPenalty = prediction?.sample?.availabilityVerified ? 0 : 1.25;
  return Math.round((edge * reliability + Math.min(5, sample) * .45 + confidenceBonus - availabilityPenalty) * 10) / 10;
}

function recentGamesFromPool(pool, teamCode, anchor, limit = 5) {
  return dedupeCompletedGames(pool || [], teamCode, anchor, limit);
}

async function topPicksForDate(date) {
  const anchor = dateOnly(date);
  if (!anchor) throw new Error("Invalid top-picks date");
  // Rank the full slate using only information available before this date.
  // Keeping live/final games in the slate makes the day's PIVT 3 stable after
  // tipoff instead of replacing a started pick with a later game.
  const games = (await scoreboard(anchor, anchor))
    .filter((g) => g.dateKey === anchor);
  if (!games.length) return [];

  const modelEnd = new Date(`${anchor}T12:00:00Z`);
  modelEnd.setUTCDate(modelEnd.getUTCDate() - 1);
  const historyEnd = modelEnd.toISOString().slice(0, 10);
  const historyStartD = new Date(modelEnd);
  historyStartD.setUTCDate(historyStartD.getUTCDate() - 27);
  const historyStart = historyStartD.toISOString().slice(0, 10);
  const history = (await scoreboard(historyStart, historyEnd)).filter((g) => g.completed && Number(g.seasonStageId) === predictionStage(anchor));

  const season = seasonEndYearFrom(anchor);
  const [currentAthletes, previousAthletes] = await Promise.all([
    seasonAthleteRows(season).catch(() => []),
    seasonAthleteRows(season - 1).catch(() => []),
  ]);
  const playersFor = (teamCode) => {
    const current = parseSeasonPlayers(currentAthletes, teamCode, 3);
    return predictionStage(anchor) === 2 && current.length ? current : parseSeasonPlayers(previousAthletes, teamCode, 3);
  };

  // Fast pass across the whole slate, then re-run the strongest candidates
  // through the exact same canonical predictor used by the matchup drawer.
  // This keeps PIVT 3 responsive while guaranteeing its displayed percentage
  // is the same percentage the user sees after opening that matchup.
  const ranked = games.map((game) => {
    const awayGames = recentGamesFromPool(history, game.away?.code, historyEnd, 5);
    const homeGames = recentGamesFromPool(history, game.home?.code, historyEnd, 5);
    const awayPlayers = playersFor(game.away?.code);
    const homePlayers = playersFor(game.home?.code);
    const prediction = predictionFromInputs(game.away?.code, game.home?.code, awayGames, homeGames, awayPlayers, homePlayers, anchor);
    return { game, prediction, rankScore: predictionRankScore(prediction) };
  }).sort((a, b) => b.rankScore - a.rankScore);

  const shortlist = ranked.slice(0, Math.min(5, ranked.length));
  const canonical = await Promise.all(shortlist.map(async (row) => {
    try {
      const exact = await predictionForMatchup(row.game.away?.code, row.game.home?.code, anchor);
      return { ...row, prediction: exact.prediction, rankScore: predictionRankScore(exact.prediction) };
    } catch {
      return { ...row, prediction: await calibratePrediction(row.prediction, anchor) };
    }
  }));

  return canonical.sort((a, b) => b.rankScore - a.rankScore).slice(0, 3);
}

async function handleAction(q) {
  const action = String(q.action || "");

  if (action === "month") {
    const year = Number(q.year);
    const month = Number(q.month);
    if (!year || month < 1 || month > 12) throw new Error("Invalid year/month");

    const { start, end } = monthBounds(year, month);
    // Keep every NBA season stage ESPN returns: preseason (1), regular season
    // (2), and postseason (3). Filtering only by the requested calendar month
    // avoids hiding early preseason games or future playoff dates.
    const games = (await scoreboard(start, end))
      .filter((g) => g.dateKey >= start && g.dateKey <= end)
      .sort((a, b) => String(a._iso).localeCompare(String(b._iso)));
    return { games, offseason: games.length === 0, source: "ESPN public JSON (no key)", sources: ["ESPN public site JSON"], keyRequired: false };
  }

  if (action === "game") {
    const summary = await gameSummary(q.id);
    const game = gameFromSummary(summary, q.id);
    return { game, source: "ESPN public JSON (no key)", sources: ["ESPN public site JSON"], keyRequired: false };
  }

  if (action === "team-last10") {
    const team = normCode(q.team);
    const anchor = dateOnly(q.anchor) || new Date().toISOString().slice(0, 10);
    const season = seasonEndYearFrom(anchor);
    const games = (await recentTeamGames(team, anchor, 10)).map((g) => resultRow(g, team));
    return { team, games, source: "ESPN public JSON (no key)", sources: ["ESPN public site JSON"], keyRequired: false };
  }

  if (action === "h2h") {
    const a = normCode(q.a), b = normCode(q.b);
    const start = dateOnly(q.start), end = dateOnly(q.end);
    const season = seasonEndYearFrom(end || start);
    const stageSchedules = await Promise.all([1, 2, 3].map((stage) => teamSchedule(a, season, stage).catch(() => [])));
    const seen = new Set();
    const games = stageSchedules.flat().filter((g) => {
      if (!g.completed) return false;
      if (start && g.dateKey < start) return false;
      if (end && g.dateKey > end) return false;
      if (g.home?.code !== b && g.away?.code !== b) return false;
      const key = String(g.id || `${g.dateKey}-${g.away?.code}-${g.home?.code}`);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    let aWins = 0, bWins = 0;
    for (const g of games) {
      const aIsHome = g.home?.code === a;
      const aScore = aIsHome ? g.homeScore : g.awayScore;
      const bScore = aIsHome ? g.awayScore : g.homeScore;
      if (!Number.isFinite(aScore) || !Number.isFinite(bScore)) continue;
      if (aScore > bScore) aWins += 1;
      else if (bScore > aScore) bWins += 1;
    }
    return { aWins, bWins, source: "ESPN public JSON (no key)", sources: ["ESPN public site JSON"], keyRequired: false };
  }

  if (action === "top-players") {
    const team = normCode(q.team);
    const anchor = dateOnly(q.anchor) || new Date().toISOString().slice(0, 10);
    const data = await getTopPlayers(team, anchor, q.days, q.topN);
    return { ...data, source: "ESPN public JSON (no key)", sources: ["ESPN public site JSON"], keyRequired: false };
  }

  if (action === "prediction") {
    const away = normCode(q.away);
    const home = normCode(q.home);
    const anchor = dateOnly(q.anchor) || new Date().toISOString().slice(0, 10);
    const exact = await predictionForMatchup(away, home, anchor);
    return {
      prediction: exact.prediction,
      playerModes: exact.playerModes,
      source: "PIVT model using ESPN public JSON (no key)",
      sources: ["ESPN public site JSON"],
      keyRequired: false,
    };
  }

  if (action === "top-picks") {
    const anchor = dateOnly(q.date) || new Date().toISOString().slice(0, 10);
    const picks = await topPicksForDate(anchor);
    return {
      date: anchor,
      picks,
      model: "PIVT 3 ranks the strongest pre-game leans using recent form, scoring margin, consistency, player production, rest and home court.",
      source: "PIVT model using ESPN public JSON (no key)",
      sources: ["ESPN public site JSON"],
      keyRequired: false,
    };
  }

  if (action === "pulse") {
    const anchor = dateOnly(q.date) || new Date().toISOString().slice(0, 10);
    const a = new Date(`${anchor}T12:00:00Z`);
    const startD = new Date(a); startD.setUTCDate(startD.getUTCDate() - 4);
    const endD = new Date(a); endD.setUTCDate(endD.getUTCDate() + 10);
    const start = startD.toISOString().slice(0, 10);
    const end = endD.toISOString().slice(0, 10);
    const all = (await scoreboard(start, end))
      .filter((g) => g.dateKey >= start && g.dateKey <= end)
      .sort((x, y) => String(x._iso).localeCompare(String(y._iso)));
    const today = all.filter((g) => g.dateKey === anchor);
    const recent = all.filter((g) => g.completed && g.dateKey < anchor).sort((x, y) => String(y._iso).localeCompare(String(x._iso))).slice(0, 6);
    const future = all.filter((g) => g.dateKey > anchor);
    const nextDate = future[0]?.dateKey || null;
    const next = nextDate ? future.filter((g) => g.dateKey === nextDate) : [];
    const stages = [...new Set([...today, ...next].map((g) => g.seasonStageId).filter(Boolean))];
    return {
      date: anchor, today, recent, nextDate, next, stages,
      source: "ESPN public JSON (no key)", sources: ["ESPN public site JSON"], keyRequired: false,
    };
  }

  throw new Error("Unknown action");
}

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  try {
    const query = req.query || {};
    const payload = await handleAction(query);
    // Live-facing schedule surfaces must not sit behind Vercel's multi-minute
    // edge cache. The adapter still keeps a short in-process scoreboard cache
    // to avoid hammering the free upstream feed.
    const liveFacing = query.action === "month" || query.action === "pulse";
    res.setHeader(
      "Cache-Control",
      liveFacing
        ? "no-store, max-age=0"
        : "public, max-age=30, s-maxage=60, stale-while-revalidate=120"
    );
    return res.status(200).json(payload);
  } catch (err) {
    const message = err?.name === "AbortError" ? "NBA data source timed out" : (err?.message || String(err));
    return res.status(502).json({ error: "nba_data_unavailable", detail: message, keyRequired: false });
  }
}

module.exports = handler;
module.exports.handleAction = handleAction;
