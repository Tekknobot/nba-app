const STORAGE_KEY = "pivt3-history-v1";

function safeParse(raw, fallback) {
  try {
    const value = JSON.parse(raw);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function easternDateKey(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const get = (type) => parts.find((part) => part.type === type)?.value || "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return new Date(date).toISOString().slice(0, 10);
  }
}

export function loadPivtHistory() {
  if (typeof window === "undefined") return [];
  try {
    const rows = safeParse(window.localStorage.getItem(STORAGE_KEY), []);
    return Array.isArray(rows) ? rows.sort((a, b) => String(b.date).localeCompare(String(a.date))) : [];
  } catch {
    return [];
  }
}

function write(rows) {
  if (typeof window === "undefined") return rows;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    window.dispatchEvent(new CustomEvent("pivt3-history-change"));
  } catch {
    // The app continues to work if browser storage is disabled.
  }
  return rows;
}

function compactTeam(team) {
  return {
    code: team?.code || "",
    name: team?.name || team?.code || "",
    logo: team?.logo || "",
  };
}

function compactPick(row) {
  const game = row?.game || {};
  const prediction = row?.prediction || {};
  return {
    gameId: String(game?.id || ""),
    dateKey: game?.dateKey || "",
    iso: game?._iso || "",
    away: compactTeam(game?.away),
    home: compactTeam(game?.home),
    pick: prediction?.pick || "",
    awayProbability: Number(prediction?.awayProbability) || 50,
    homeProbability: Number(prediction?.homeProbability) || 50,
    confidence: prediction?.confidence || "low",
    factors: Array.isArray(prediction?.factors) ? prediction.factors.slice(0, 4) : [],
    model: prediction?.model || "",
    result: null,
  };
}

// A slate is immutable after first capture. This protects the historical record
// from later model tweaks or new team/player information. Past dates are never
// back-filled, because doing that after the result is known would contaminate
// the track record.
export function recordPivt3Slate(date, picks) {
  if (typeof window === "undefined" || !date || !Array.isArray(picks) || !picks.length) return loadPivtHistory();
  const today = easternDateKey();
  if (String(date) < today) return loadPivtHistory();

  const history = loadPivtHistory();
  if (history.some((row) => row?.date === date)) return history;

  // Never start a record after one of the selected PIVT 3 games has begun.
  // This keeps the archive genuinely pre-game rather than allowing a slate to
  // be captured after one of its outcomes is already visible.
  if (String(date) === today) {
    const selectedGameStarted = picks.slice(0, 3).some((row) => {
      const game = row?.game || {};
      return Boolean(game.completed) || game.state === "in" || /final|in progress|halftime|quarter|q\d|end of/i.test(String(game.status || ""));
    });
    if (selectedGameStarted) return history;
  }

  const snapshot = {
    date,
    recordedAt: new Date().toISOString(),
    picks: picks.slice(0, 3).map(compactPick),
  };
  return write([snapshot, ...history].sort((a, b) => String(b.date).localeCompare(String(a.date))));
}

export function updatePivt3Results(resultMap) {
  if (!resultMap || typeof resultMap !== "object") return loadPivtHistory();
  const history = loadPivtHistory();
  let changed = false;

  const next = history.map((slate) => ({
    ...slate,
    picks: (slate.picks || []).map((pick) => {
      const result = resultMap[String(pick.gameId)] || null;
      if (!result) return pick;
      const existing = pick.result || {};
      const core = {
        completed: Boolean(result.completed),
        status: result.status || "",
        actualWinner: result.actualWinner || null,
        awayScore: Number.isFinite(Number(result.awayScore)) ? Number(result.awayScore) : null,
        homeScore: Number.isFinite(Number(result.homeScore)) ? Number(result.homeScore) : null,
      };
      const existingCore = {
        completed: Boolean(existing.completed),
        status: existing.status || "",
        actualWinner: existing.actualWinner || null,
        awayScore: Number.isFinite(Number(existing.awayScore)) ? Number(existing.awayScore) : null,
        homeScore: Number.isFinite(Number(existing.homeScore)) ? Number(existing.homeScore) : null,
      };
      const differs = JSON.stringify(existingCore) !== JSON.stringify(core);
      if (differs) changed = true;
      return { ...pick, result: { ...core, verifiedAt: differs || !existing.verifiedAt ? new Date().toISOString() : existing.verifiedAt } };
    }),
  }));

  return changed ? write(next) : history;
}

export function resultForGame(game) {
  if (!game?.id) return null;
  const awayScore = Number(game?.awayScore);
  const homeScore = Number(game?.homeScore);
  const completed = Boolean(game?.completed) || /final/i.test(String(game?.status || ""));
  let actualWinner = null;
  if (completed && Number.isFinite(awayScore) && Number.isFinite(homeScore) && awayScore !== homeScore) {
    actualWinner = awayScore > homeScore ? game?.away?.code : game?.home?.code;
  }
  return {
    completed,
    status: game?.status || "",
    actualWinner,
    awayScore: Number.isFinite(awayScore) ? awayScore : null,
    homeScore: Number.isFinite(homeScore) ? homeScore : null,
  };
}
