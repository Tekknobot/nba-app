const DB_NAME = "pivt";
const DB_VERSION = 1;
const SLATE_STORE = "pivt3_slates";
const META_STORE = "meta";
const LEGACY_STORAGE_KEY = "pivt3-history-v1";
const MIGRATION_KEY = "legacy-localstorage-v1";

function hasBrowserDb() {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
  });
}

let dbPromise = null;
function openPivtDb() {
  if (!hasBrowserDb()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SLATE_STORE)) {
        const store = db.createObjectStore(SLATE_STORE, { keyPath: "date" });
        store.createIndex("recordedAt", "recordedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error("Unable to open PIVT database"));
    };
    request.onblocked = () => {
      dbPromise = null;
      reject(new Error("PIVT database upgrade is blocked by another tab"));
    };
  });

  return dbPromise;
}

function dispatchHistoryChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pivt3-history-change"));
  }
}

function sortHistory(rows) {
  return (Array.isArray(rows) ? rows : []).sort((a, b) => String(b?.date || "").localeCompare(String(a?.date || "")));
}

async function migrateLegacyHistory(db) {
  if (!db || typeof window === "undefined") return;

  const readTx = db.transaction([META_STORE], "readonly");
  const migrated = await requestToPromise(readTx.objectStore(META_STORE).get(MIGRATION_KEY)).catch(() => null);
  await transactionDone(readTx).catch(() => {});
  if (migrated?.done) return;

  let rows = [];
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) rows = parsed;
  } catch {
    rows = [];
  }

  const tx = db.transaction([SLATE_STORE, META_STORE], "readwrite");
  const slates = tx.objectStore(SLATE_STORE);
  for (const row of rows) {
    if (row?.date) slates.put(row);
  }
  tx.objectStore(META_STORE).put({ key: MIGRATION_KEY, done: true, migratedAt: new Date().toISOString(), count: rows.length });
  await transactionDone(tx);

  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Migration is already committed; a stale localStorage copy is harmless.
  }
}

async function readyDb() {
  const db = await openPivtDb();
  if (db) await migrateLegacyHistory(db);
  return db;
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

export async function loadPivtHistory() {
  const db = await readyDb();
  if (!db) return [];
  const tx = db.transaction([SLATE_STORE], "readonly");
  const rows = await requestToPromise(tx.objectStore(SLATE_STORE).getAll()).catch(() => []);
  await transactionDone(tx).catch(() => {});
  return sortHistory(rows);
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

// A slate is immutable after first capture. Past dates are never back-filled,
// and an existing row is never overwritten by a later model calculation.
export async function recordPivt3Slate(date, picks) {
  if (!date || !Array.isArray(picks) || !picks.length) return loadPivtHistory();
  const today = easternDateKey();
  if (String(date) < today) return loadPivtHistory();

  if (String(date) === today) {
    const selectedGameStarted = picks.slice(0, 3).some((row) => {
      const game = row?.game || {};
      return Boolean(game.completed) || game.state === "in" || /final|in progress|halftime|quarter|q\d|end of/i.test(String(game.status || ""));
    });
    if (selectedGameStarted) return loadPivtHistory();
  }

  const db = await readyDb();
  if (!db) return [];
  const tx = db.transaction([SLATE_STORE], "readwrite");
  const store = tx.objectStore(SLATE_STORE);
  const snapshot = {
    date,
    recordedAt: new Date().toISOString(),
    picks: picks.slice(0, 3).map(compactPick),
  };
  let inserted = true;
  const addRequest = store.add(snapshot);
  addRequest.onerror = (event) => {
    if (addRequest.error?.name === "ConstraintError") {
      // The date already exists. Keep the original immutable snapshot.
      inserted = false;
      event.preventDefault();
      event.stopPropagation();
    }
  };
  await transactionDone(tx);
  if (inserted) dispatchHistoryChange();
  return loadPivtHistory();
}

export async function updatePivt3Results(resultMap) {
  if (!resultMap || typeof resultMap !== "object") return loadPivtHistory();
  const db = await readyDb();
  if (!db) return [];

  const readTx = db.transaction([SLATE_STORE], "readonly");
  const rows = await requestToPromise(readTx.objectStore(SLATE_STORE).getAll()).catch(() => []);
  await transactionDone(readTx).catch(() => {});

  let changed = false;
  const changedRows = [];
  for (const slate of rows) {
    let slateChanged = false;
    const nextPicks = (slate.picks || []).map((pick) => {
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
      if (!differs) return pick;
      changed = true;
      slateChanged = true;
      return { ...pick, result: { ...core, verifiedAt: new Date().toISOString() } };
    });
    if (slateChanged) changedRows.push({ ...slate, picks: nextPicks });
  }

  if (changedRows.length) {
    const writeTx = db.transaction([SLATE_STORE], "readwrite");
    const store = writeTx.objectStore(SLATE_STORE);
    changedRows.forEach((row) => store.put(row));
    await transactionDone(writeTx);
  }
  if (changed) dispatchHistoryChange();
  return loadPivtHistory();
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

export async function getPivtDbInfo() {
  const db = await readyDb();
  if (!db) return { available: false, engine: "none", name: DB_NAME, version: DB_VERSION };
  const history = await loadPivtHistory();
  return { available: true, engine: "IndexedDB", name: DB_NAME, version: DB_VERSION, slates: history.length };
}
