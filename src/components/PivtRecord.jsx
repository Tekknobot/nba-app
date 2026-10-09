import React from "react";
import { Avatar, Box, Button, CircularProgress, Divider, Stack, Typography, TextField, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import { easternDateKey, getPivtDbInfo, loadPivtHistory, recordPivt3Slate, resultForGame, updatePivt3Results, exportPivtBackup, importPivtBackup, synchronizePivtCloud, hasPivtCloudKey } from "../utils/pivtHistory";
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
  const [writeEnabled, setWriteEnabled] = React.useState(false);
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
    try { const rows = await importPivtBackup(await file.text()); setSyncStatus(`Imported ${rows.length} slates to Neon (original picks preserved)`); await verify(); }
    catch (e) { setSyncStatus(e.message); }
    event.target.value = "";
  };
  const cloudSync = async () => {
    setSyncStatus("Synchronizing...");
    try { const r = await synchronizePivtCloud(syncKey); setSyncStatus(`Neon connected: ${r.slates} slates, ${r.migrated} local slates migrated`); setWriteEnabled(true); await verify(); }
    catch (e) { setSyncStatus(`Cloud sync unavailable: ${e.message}`); }
  };

  const verify = React.useCallback(async () => {
    let history;
    try { history = await loadPivtHistory(); } catch (e) { setState(s => ({ ...s, loading: false, verifying: false, error: e.message })); return; }
    const dbInfo = await getPivtDbInfo().catch(() => null);
    setState((s) => ({ ...s, history, dbInfo, loading: false, verifying: true, error: "" }));
    try {
      const today = easternDateKey();
      if (hasPivtCloudKey() && !history.some((row) => row?.date === today)) {
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
      const next = hasPivtCloudKey() ? await updatePivt3Results(resultMap) : history;
      const dbInfo = await getPivtDbInfo().catch(() => null);
      setState({ loading: false, verifying: false, error: "", history: next, dbInfo });
    } catch (e) {
      setState((s) => ({ ...s, verifying: false, error: e?.message || String(e) }));
    }
  }, []);

  React.useEffect(() => {
    verify();
    const refresh = async () => {
      const history = await loadPivtHistory().catch(() => []);
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


      <Box sx={{ mb: 3, border: "1px solid", borderColor: "divider", borderRadius: 1, overflow: "hidden" }}>
        <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography sx={{ fontWeight: 850, fontSize: 16 }}>Model performance</Typography>
          <Typography variant="caption" color="text.secondary">Settled picks only. Brier score: lower is better. Calibration needs a larger sample.</Typography>
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", borderBottom: "1px solid", borderColor: "divider" }}>
          {rolling.map((r,i) => <Box key={r.n} sx={{ px: 2, py: 1.5, borderRight: i<2 ? "1px solid" : 0, borderColor: "divider" }}>
            <Typography sx={{ fontSize: 22, fontWeight: 850, fontVariantNumeric:"tabular-nums" }}>{r.accuracy === null ? "—" : `${r.accuracy}%`}</Typography>
            <Typography variant="caption" color="text.secondary">Last {r.n} · {r.count} played</Typography>
          </Box>)}
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs:"1fr", md:"repeat(3,minmax(0,1fr))" } }}>
          {[["Season type",stages],["Confidence",bands],["Probability",probabilities]].map(([heading,rows],i) => <Box key={heading} sx={{ minWidth:0, borderRight:{md:i<2 ? "1px solid":"none"}, borderBottom:{xs:i<2 ? "1px solid":"none",md:"none"}, borderColor:"divider" }}>
            <Typography sx={{ fontWeight: 800, px:1.5, py:1.25, fontSize:13, bgcolor:"action.hover" }}>{heading}</Typography>
            <Table size="small" sx={{ "& th, & td": { px: 1, py: 1, fontSize: 11.5 }, "& th": { color:"text.secondary" } }}>
              <TableHead><TableRow><TableCell>Group</TableCell><TableCell align="right">W/N</TableCell><TableCell align="right">Hit %</TableCell><TableCell align="right">Brier</TableCell></TableRow></TableHead>
              <TableBody>{rows.length ? rows.map(r => <TableRow key={r.key}><TableCell sx={{fontWeight:650}}>{r.key}</TableCell><TableCell align="right">{r.correct}/{r.n}</TableCell><TableCell align="right" sx={{color:r.accuracy>=60?"success.main":r.accuracy<50?"error.main":"text.primary"}}>{r.accuracy}%</TableCell><TableCell align="right">{r.brier}</TableCell></TableRow>) : <TableRow><TableCell colSpan={4}>No settled picks</TableCell></TableRow>}</TableBody>
            </Table>
          </Box>)}
        </Box>
      </Box>
      <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, px: 2, py: 2, mb: 3 }}>
        <Stack direction={{xs:"column",sm:"row"}} justifyContent="space-between" spacing={1}>
          <Box><Typography sx={{ fontWeight: 850 }}>Neon database</Typography>
            <Typography variant="body2" color="text.secondary">Neon is the primary record store. Enter your write key for automated recording and final-score verification while this tab is open. Existing browser slates can be migrated once.</Typography>
          </Box>
          <Typography variant="caption" sx={{ color: state.error ? "error.main" : "success.main", fontWeight:800, whiteSpace:"nowrap" }}>{state.error ? "UNAVAILABLE" : writeEnabled ? "READ / WRITE" : "READ ONLY"}</Typography>
        </Stack>
        <Stack direction={{xs:"column",sm:"row"}} spacing={1} sx={{ mt:2, mb:1 }}>
          <TextField size="small" type="password" label="Database write key" value={syncKey} onChange={e=>setSyncKey(e.target.value)} sx={{ flex:1, minWidth: 180 }}/>
          <Button variant="contained" size="small" disabled={!syncKey} onClick={cloudSync}>Connect & migrate local records</Button>
        </Stack>
        {!!syncStatus && <Typography variant="caption" sx={{ display:"block", mb:1 }}>{syncStatus}</Typography>}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button variant="outlined" size="small" onClick={downloadBackup}>Export database JSON</Button>
          <Button variant="outlined" size="small" disabled={!writeEnabled} onClick={()=>fileRef.current?.click()}>Import JSON to Neon</Button>
          <input type="file" accept="application/json,.json" ref={fileRef} hidden onChange={restore}/>
        </Stack>
      </Box>

      {state.error && <Typography variant="caption" color="error.main" sx={{ display: "block", mb: 2 }}>Result verification unavailable: {state.error}</Typography>}

      {!history.length && !state.loading ? (
        <Box sx={{ py: 8, borderTop: "1px solid", borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography sx={{ fontWeight: 800 }}>No PIVT 3 slates recorded yet.</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: .5, maxWidth: 560 }}>
            PIVT will start the record automatically when a current or future PIVT 3 slate appears. Existing browser history can be migrated to Neon with the write key. Past dates are never back-filled after results are known.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, overflow:"hidden" }}>
          <Box sx={{ px:2, py:1.25, bgcolor:"action.hover", borderBottom:"1px solid", borderColor:"divider" }}><Typography sx={{fontWeight:850}}>Recorded slates</Typography></Box>
          <Box sx={{overflowX:"auto"}}>
            <Table size="small" sx={{minWidth:640, "& th":{fontWeight:800, fontSize:11, textTransform:"uppercase", color:"text.secondary"}, "& td":{fontSize:12, py:1.2}}}>
              <TableHead><TableRow><TableCell>Date</TableCell><TableCell>Matchup</TableCell><TableCell>Pick</TableCell><TableCell align="right">Chance</TableCell><TableCell>Confidence</TableCell><TableCell>Final score</TableCell><TableCell align="right">Result</TableCell></TableRow></TableHead>
              <TableBody>{history.flatMap(slate => (slate.picks||[]).map((pick,i) => {
                const r=pick.result||{}; const done=Boolean(r.completed&&r.actualWinner); const win=done&&r.actualWinner===pick.pick;
                return <TableRow key={`${slate.date}-${pick.gameId||i}`} hover>
                  <TableCell sx={{whiteSpace:"nowrap"}}>{i===0 ? <><Typography sx={{fontWeight:800,fontSize:12}}>{prettyDate(slate.date)}</Typography><Typography variant="caption" color="text.secondary">{slateSummary(slate).wins}/{slateSummary(slate).total} wins</Typography></>: ""}</TableCell>
                  <TableCell sx={{fontWeight:650, whiteSpace:"nowrap"}}>{pick.away?.code} @ {pick.home?.code}</TableCell>
                  <TableCell sx={{fontWeight:850}}>{pick.pick}</TableCell><TableCell align="right">{pickPercent(pick)}%</TableCell>
                  <TableCell sx={{color:confidenceColor(pick.confidence)}}>{confidenceLabel(pick.confidence)}</TableCell>
                  <TableCell sx={{whiteSpace:"nowrap"}}>{done?`${pick.away?.code} ${r.awayScore} · ${pick.home?.code} ${r.homeScore}`:"—"}</TableCell>
                  <TableCell align="right" sx={{fontWeight:850,color:done?(win?"success.main":"error.main"):"warning.main"}}>{done?(win?"WIN":"MISS"):"OPEN"}</TableCell>
                </TableRow>;
              }))}</TableBody>
            </Table>
          </Box>
        </Box>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2.5, lineHeight: 1.55 }}>
        {state.dbInfo?.available ? `Primary database: ${state.dbInfo.engine} · ${state.dbInfo.slates ?? history.length} slates stored.` : "PIVT database unavailable in this browser."}
      </Typography>
    </Box>
  );
}
