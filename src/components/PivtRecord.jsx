import React from "react";
import { Avatar, Box, Button, CircularProgress, Divider, Stack, Typography, TextField, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import { easternDateKey, getPivtDbInfo, loadPivtHistory, recordPivt3Slate, resultForGame, updatePivt3Results, exportPivtBackup, importPivtBackup, synchronizePivtCloud } from "../utils/pivtHistory";
import { logoForTeam } from "../utils/teamAssets";


async function fetchTopPicks(date) {
  const q = new URLSearchParams({ action: "top-picks", date });
  const r = await fetch(`/api/nba-data?${q}`, { cache: "no-store" });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body?.detail || body?.error || `HTTP ${r.status}`);
  return Array.isArray(body?.picks) ? body.picks : [];
}

async function fetchMonth(year, month) {
  const q = new URLSearchParams({ action: "month", year: String(year), month: String(month) });
  const r = await fetch(`/api/nba-data?${q}`, { cache: "no-store" });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body?.detail || body?.error || `HTTP ${r.status}`);
  return Array.isArray(body?.games) ? body.games : [];
}

function prettyDate(value) {
  const d = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function confidenceLabel(v) {
  return String(v || "low").toUpperCase();
}

function confidenceColor(v) {
  const value = String(v || "low").toLowerCase();
  if (value === "high") return "success.main";
  if (value === "low") return "warning.main";
  return "text.secondary";
}

function pickPercent(pick) {
  return pick?.pick === pick?.home?.code ? Number(pick?.homeProbability) || 50 : Number(pick?.awayProbability) || 50;
}

function PickStatus({ correct, pending }) {
  if (pending) return (
    <Box sx={{ width: 26, height: 26, border: "1px solid", borderColor: "warning.main", display: "grid", placeItems: "center", color: "warning.main", flex: "0 0 auto" }}>
      <RemoveRoundedIcon sx={{ fontSize: 16 }} />
    </Box>
  );
  return (
    <Box sx={{ width: 26, height: 26, border: "1px solid", borderColor: correct ? "success.main" : "error.main", display: "grid", placeItems: "center", color: correct ? "success.main" : "error.main", flex: "0 0 auto" }}>
      {correct ? <CheckRoundedIcon sx={{ fontSize: 16 }} /> : <CloseRoundedIcon sx={{ fontSize: 16 }} />}
    </Box>
  );
}

function PickRow({ pick }) {
  const result = pick?.result || {};
  const resolved = Boolean(result.completed && result.actualWinner);
  const correct = resolved && result.actualWinner === pick.pick;
  const pct = pickPercent(pick);
  const pickedTeam = pick.pick === pick?.home?.code ? pick.home : pick.away;
  const finalText = resolved && Number.isFinite(result.awayScore) && Number.isFinite(result.homeScore)
    ? `${pick.away?.code} ${result.awayScore} · ${pick.home?.code} ${result.homeScore}`
    : result.completed ? "FINAL" : "PENDING";

  return (
    <Stack direction="row" alignItems="center" spacing={1.2} sx={{ py: 1.15, borderTop: "1px solid", borderColor: "divider" }}>
      <PickStatus correct={correct} pending={!resolved} />
      <Avatar src={logoForTeam(pickedTeam)} alt="" sx={{ width: 32, height: 32, p: .35, bgcolor: "transparent", "& img": { objectFit: "contain" } }}>{pick.pick}</Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={.8} alignItems="baseline" sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 850, fontSize: 14, color: resolved ? (correct ? "success.main" : "error.main") : "text.primary" }}>{pick.pick} {pct}%</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>{pick.away?.code} @ {pick.home?.code}</Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          <Box component="span" sx={{ color: confidenceColor(pick.confidence), fontWeight: 800 }}>{confidenceLabel(pick.confidence)} confidence</Box>
          {" · "}{finalText}
        </Typography>
      </Box>
      <Typography variant="caption" sx={{ color: resolved ? (correct ? "success.main" : "error.main") : "warning.main", fontWeight: 850, letterSpacing: ".05em" }}>
        {resolved ? (correct ? "WIN" : "MISS") : "OPEN"}
      </Typography>
    </Stack>
  );
}

function slateSummary(slate) {
  const resolved = (slate?.picks || []).filter((pick) => pick?.result?.completed && pick?.result?.actualWinner);
  const wins = resolved.filter((pick) => pick.result.actualWinner === pick.pick).length;
  const complete = resolved.length === (slate?.picks || []).length && resolved.length > 0;
  return { wins, resolved: resolved.length, total: (slate?.picks || []).length, complete };
}

export default function PivtRecord() {
  const [state, setState] = React.useState({ loading: true, verifying: false, error: "", history: [], dbInfo: null });
  const [syncKey, setSyncKey] = React.useState("");
  const [syncStatus, setSyncStatus] = React.useState("");
  const fileRef = React.useRef(null);
  const downloadBackup = async () => {
    const backup = await exportPivtBackup();
    const url = URL.createObjectURL(new Blob([backup], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `pivt3-backup-${easternDateKey()}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const restore = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try { const rows = await importPivtBackup(await file.text()); setSyncStatus(`Imported ${rows.length} slates (original picks preserved)`); }
    catch (e) { setSyncStatus(e.message); }
    event.target.value = "";
  };
  const cloudSync = async () => {
    setSyncStatus("Synchronizing...");
    try { const r = await synchronizePivtCloud(syncKey); setSyncStatus(`Cloud synchronized: ${r.slates} slates`); }
    catch (e) { setSyncStatus(`Cloud sync unavailable: ${e.message}`); }
  };

  const verify = React.useCallback(async () => {
    let history = await loadPivtHistory();
    const dbInfo = await getPivtDbInfo().catch(() => null);
    setState((s) => ({ ...s, history, dbInfo, loading: false, verifying: true, error: "" }));
    try {
      const today = easternDateKey();
      if (!history.some((row) => row?.date === today)) {
        const picks = await fetchTopPicks(today).catch(() => []);
        if (picks.length) history = await recordPivt3Slate(today, picks);
      }
      if (!history.length) {
        setState((s) => ({ ...s, verifying: false }));
        return;
      }

      const months = Array.from(new Set(
        history
          .filter((row) => (row.picks || []).some((pick) => !pick?.result?.completed))
          .map((row) => String(row.date || "").slice(0, 7))
          .filter(Boolean)
      ));
      const batches = await Promise.all(months.map(async (key) => {
        const [year, month] = key.split("-").map(Number);
        return fetchMonth(year, month);
      }));
      const resultMap = {};
      batches.flat().forEach((game) => {
        if (game?.id) resultMap[String(game.id)] = resultForGame(game);
      });
      const next = await updatePivt3Results(resultMap);
      const dbInfo = await getPivtDbInfo().catch(() => null);
      setState({ loading: false, verifying: false, error: "", history: next, dbInfo });
    } catch (e) {
      setState((s) => ({ ...s, verifying: false, error: e?.message || String(e) }));
    }
  }, []);

  React.useEffect(() => {
    verify();
    const refresh = async () => {
      const history = await loadPivtHistory();
      const dbInfo = await getPivtDbInfo().catch(() => null);
      setState((s) => ({ ...s, history, dbInfo }));
    };
    window.addEventListener("pivt3-history-change", refresh);
    const interval = window.setInterval(() => {
      if (typeof document === "undefined" || !document.hidden) verify();
    }, 60000);
    return () => {
      window.removeEventListener("pivt3-history-change", refresh);
      window.clearInterval(interval);
    };
  }, [verify]);

  const history = state.history || [];
  const allPicks = history.flatMap((row) => row.picks || []);
  const resolved = allPicks.filter((pick) => pick?.result?.completed && pick?.result?.actualWinner);
  const wins = resolved.filter((pick) => pick.result.actualWinner === pick.pick).length;
  const misses = Math.max(0, resolved.length - wins);
  const accuracy = resolved.length ? Math.round((wins / resolved.length) * 100) : null;
  const completedSlates = history.filter((row) => slateSummary(row).complete);
  const sweeps = completedSlates.filter((row) => slateSummary(row).wins === slateSummary(row).total).length;

  const settled = history.flatMap(row => (row.picks || []).map(pick => ({ ...pick, slateDate: row.date })) )
    .filter(pick => pick.result?.completed && pick.result?.actualWinner);
  const grouped = (keyFn) => Object.entries(settled.reduce((acc, p) => {
    const key = keyFn(p); (acc[key] ||= []).push(p); return acc;
  }, {})).sort(([a],[b]) => a.localeCompare(b)).map(([key, picks]) => {
    const n = picks.length, correct = picks.filter(p => p.pick === p.result.actualWinner).length;
    const brier = picks.reduce((sum,p) => sum + ((pickPercent(p) / 100) - (p.pick === p.result.actualWinner ? 1 : 0)) ** 2, 0) / n;
    return { key, n, correct, accuracy: Math.round(correct/n*100), brier: brier.toFixed(3) };
  });
  const stages = grouped(p => p.seasonType === 1 ? "Preseason" : p.seasonType === 2 ? "Regular season" : "Legacy / unknown");
  const bands = grouped(p => p.confidence?.toUpperCase() || "UNKNOWN");
  const probabilities = grouped(p => {
    const pct = pickPercent(p);
    return pct < 60 ? "50–59%" : pct < 65 ? "60–64%" : "65–70%";
  });
  const chronology = [...settled].sort((a,b) => (a.slateDate || "").localeCompare(b.slateDate || ""));
  const rolling = [25, 50, 100].map(n => {
    const window = chronology.slice(-n);
    return { n, count: window.length, accuracy: window.length ? Math.round(window.filter(p=>p.pick===p.result.actualWinner).length / window.length * 100) : null };
  });
  return (
    <Box sx={{ maxWidth: 980, mx: "auto", px: { xs: 1.5, sm: 3 }, py: { xs: 2.5, sm: 4 } }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "end" }} spacing={1.5}>
        <Box>
          <Typography variant="overline" color="text.secondary">PIVT 3</Typography>
          <Typography component="h1" variant="h4" sx={{ mt: .2 }}>Prediction record</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: .8, maxWidth: 620, lineHeight: 1.65 }}>
            Original PIVT 3 picks are frozen when recorded. Final scores are checked later, so model changes cannot rewrite an old prediction.
          </Typography>
        </Box>
        {state.verifying && <Stack direction="row" spacing={.8} alignItems="center"><CircularProgress size={14} /><Typography variant="caption" color="text.secondary">Verifying finals</Typography></Stack>}
      </Stack>

      <Divider sx={{ my: 3 }} />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", sm: "repeat(4,minmax(0,1fr))" }, borderTop: "1px solid", borderLeft: "1px solid", borderColor: "divider", mb: 3 }}>
        {[
          [accuracy === null ? "—" : `${accuracy}%`, "Pick accuracy", accuracy === null ? "text.primary" : accuracy >= 60 ? "success.main" : accuracy >= 50 ? "warning.main" : "error.main"],
          [`${wins}-${misses}`, "Pick record", resolved.length ? (wins > misses ? "success.main" : wins === misses ? "warning.main" : "error.main") : "text.primary"],
          [`${sweeps}/${completedSlates.length}`, "3/3 sweeps", sweeps > 0 ? "success.main" : "text.primary"],
          [String(history.length), "Slates recorded", "text.primary"],
        ].map(([value, label, tone]) => (
          <Box key={label} sx={{ p: 1.5, borderRight: "1px solid", borderBottom: "1px solid", borderColor: "divider" }}>
            <Typography sx={{ fontSize: { xs: 22, sm: 26 }, fontWeight: 900, fontVariantNumeric: "tabular-nums", color: tone }}>{value}</Typography>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
          </Box>
        ))}
      </Box>


      <Box sx={{ mt: 3, mb: 3, borderTop: "1px solid", borderColor: "divider", pt: 2 }}>
        <Typography sx={{ fontWeight: 850, fontSize: 16, mb: .8 }}>Model performance</Typography>
        <Typography variant="caption" color="text.secondary">Only settled picks count. Legacy picks with unknown season type remain separate. Brier: lower is better; reliable probability calibration requires a larger sample.</Typography>
        <Stack direction="row" spacing={2} sx={{ mt: 1.5, mb: 2, flexWrap: "wrap" }}>
          {rolling.map(r => <Box key={r.n}><Typography sx={{ fontSize: 21, fontWeight: 850 }}>{r.accuracy === null ? "—" : `${r.accuracy}%`}</Typography><Typography variant="caption" color="text.secondary">Last {r.n} ({r.count} played)</Typography></Box>)}
        </Stack>
        {[['Season type',stages],['Confidence band',bands],['Predicted probability band',probabilities]].map(([heading,rows]) => <Box key={heading} sx={{ mb: 1.5 }}>
          <Typography sx={{ fontWeight: 750, mb: .5 }}>{heading}</Typography>
          <Table size="small"><TableHead><TableRow><TableCell>Group</TableCell><TableCell align="right">W / N</TableCell><TableCell align="right">Accuracy</TableCell><TableCell align="right">Brier</TableCell></TableRow></TableHead>
          <TableBody>{rows.map(r => <TableRow key={r.key}><TableCell>{r.key}</TableCell><TableCell align="right">{r.correct}/{r.n}</TableCell><TableCell align="right">{r.accuracy}%</TableCell><TableCell align="right">{r.brier}</TableCell></TableRow>)}</TableBody></Table>
        </Box>)}
      </Box>
      <Box sx={{ borderTop: "1px solid", borderColor: "divider", pt: 2, pb: 2 }}>
        <Typography sx={{ fontWeight: 850, mb: .75 }}>History backup and cloud sync</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.3 }}>Browser storage remains primary. Export a backup first. Cloud sync requires a Vercel Neon database and private sync key.</Typography>
        <Stack direction={{xs:"column",sm:"row"}} spacing={1} sx={{ mb: 1 }}>
          <Button variant="outlined" size="small" onClick={downloadBackup}>Export JSON backup</Button>
          <Button variant="outlined" size="small" onClick={()=>fileRef.current?.click()}>Import backup</Button>
          <input type="file" accept="application/json,.json" ref={fileRef} hidden onChange={restore}/>
        </Stack>
        <Stack direction={{xs:"column",sm:"row"}} spacing={1}>
          <TextField size="small" type="password" label="Private cloud sync key" value={syncKey} onChange={e=>setSyncKey(e.target.value)} sx={{ minWidth: 220 }}/>
          <Button variant="outlined" size="small" disabled={!syncKey} onClick={cloudSync}>Sync with Vercel database</Button>
        </Stack>
        {!!syncStatus && <Typography variant="caption" sx={{ display:"block", mt:1 }}>{syncStatus}</Typography>}
      </Box>

      {state.error && <Typography variant="caption" color="error.main" sx={{ display: "block", mb: 2 }}>Result verification unavailable: {state.error}</Typography>}

      {!history.length && !state.loading ? (
        <Box sx={{ py: 8, borderTop: "1px solid", borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography sx={{ fontWeight: 800 }}>No PIVT 3 slates recorded yet.</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: .5, maxWidth: 560 }}>
            PIVT will start the record automatically when a current or future PIVT 3 slate appears. Existing browser history is migrated into the PIVT database automatically. Past dates are never back-filled after results are known.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.25}>
          {history.map((slate) => {
            const summary = slateSummary(slate);
            const label = summary.complete ? `${summary.wins}/${summary.total}${summary.wins === summary.total ? " SWEEP" : ""}` : `${summary.resolved}/${summary.total} FINAL`;
            return (
              <Box key={slate.date} sx={{ border: "1px solid", borderColor: "divider", px: { xs: 1.2, sm: 1.5 }, pt: 1.35 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={2} sx={{ pb: 1.1 }}>
                  <Box>
                    <Typography sx={{ fontWeight: 850 }}>{prettyDate(slate.date)}</Typography>
                    <Typography variant="caption" color="text.secondary">Recorded {new Date(slate.recordedAt).toLocaleString()}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 900, letterSpacing: ".05em", color: !summary.complete ? "warning.main" : summary.wins === summary.total ? "success.main" : summary.wins >= 2 ? "warning.main" : "error.main", whiteSpace: "nowrap" }}>{label}</Typography>
                </Stack>
                {(slate.picks || []).map((pick, i) => <PickRow key={pick.gameId || `${slate.date}-${i}`} pick={pick} />)}
              </Box>
            );
          })}
        </Stack>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2.5, lineHeight: 1.55 }}>
        {state.dbInfo?.available ? `PIVT database: ${state.dbInfo.engine} · ${state.dbInfo.slates ?? history.length} slates stored. Local browser storage; optional Neon cloud sync.` : "PIVT database unavailable in this browser."}
      </Typography>
    </Box>
  );
}
