import React from "react";
import { Avatar, Box, CircularProgress, Divider, Stack, Typography } from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import { easternDateKey, loadPivtHistory, recordPivt3Slate, resultForGame, updatePivt3Results } from "../utils/pivtHistory";
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

function pickPercent(pick) {
  return pick?.pick === pick?.home?.code ? Number(pick?.homeProbability) || 50 : Number(pick?.awayProbability) || 50;
}

function PickStatus({ correct, pending }) {
  if (pending) return (
    <Box sx={{ width: 26, height: 26, border: "1px solid", borderColor: "divider", display: "grid", placeItems: "center", color: "text.secondary", flex: "0 0 auto" }}>
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
          <Typography sx={{ fontWeight: 850, fontSize: 14 }}>{pick.pick} {pct}%</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>{pick.away?.code} @ {pick.home?.code}</Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary">{confidenceLabel(pick.confidence)} confidence · {finalText}</Typography>
      </Box>
      <Typography variant="caption" sx={{ color: resolved ? (correct ? "success.main" : "error.main") : "text.secondary", fontWeight: 850, letterSpacing: ".05em" }}>
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
  const [state, setState] = React.useState({ loading: true, verifying: false, error: "", history: [] });

  const verify = React.useCallback(async () => {
    let history = loadPivtHistory();
    setState((s) => ({ ...s, history, loading: false, verifying: true, error: "" }));
    try {
      const today = easternDateKey();
      if (!history.some((row) => row?.date === today)) {
        const picks = await fetchTopPicks(today).catch(() => []);
        if (picks.length) history = recordPivt3Slate(today, picks);
      }
      if (!history.length) {
        setState((s) => ({ ...s, verifying: false }));
        return;
      }

      const months = Array.from(new Set(history.map((row) => String(row.date || "").slice(0, 7)).filter(Boolean)));
      const batches = await Promise.all(months.map(async (key) => {
        const [year, month] = key.split("-").map(Number);
        return fetchMonth(year, month);
      }));
      const resultMap = {};
      batches.flat().forEach((game) => {
        if (game?.id) resultMap[String(game.id)] = resultForGame(game);
      });
      const next = updatePivt3Results(resultMap);
      setState({ loading: false, verifying: false, error: "", history: next });
    } catch (e) {
      setState((s) => ({ ...s, verifying: false, error: e?.message || String(e) }));
    }
  }, []);

  React.useEffect(() => {
    verify();
    const refresh = () => setState((s) => ({ ...s, history: loadPivtHistory() }));
    window.addEventListener("pivt3-history-change", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("pivt3-history-change", refresh);
      window.removeEventListener("storage", refresh);
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
          [accuracy === null ? "—" : `${accuracy}%`, "Pick accuracy"],
          [`${wins}-${misses}`, "Pick record"],
          [`${sweeps}/${completedSlates.length}`, "3/3 sweeps"],
          [String(history.length), "Slates recorded"],
        ].map(([value, label]) => (
          <Box key={label} sx={{ p: 1.5, borderRight: "1px solid", borderBottom: "1px solid", borderColor: "divider" }}>
            <Typography sx={{ fontSize: { xs: 22, sm: 26 }, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
          </Box>
        ))}
      </Box>

      {state.error && <Typography variant="caption" color="error.main" sx={{ display: "block", mb: 2 }}>Result verification unavailable: {state.error}</Typography>}

      {!history.length && !state.loading ? (
        <Box sx={{ py: 8, borderTop: "1px solid", borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography sx={{ fontWeight: 800 }}>No PIVT 3 slates recorded yet.</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: .5, maxWidth: 560 }}>
            PIVT will start the record automatically when a current or future PIVT 3 slate appears in this browser. Past dates are never back-filled after results are known.
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
                  <Typography sx={{ fontSize: 13, fontWeight: 900, letterSpacing: ".05em", color: summary.complete && summary.wins === summary.total ? "success.main" : "text.secondary", whiteSpace: "nowrap" }}>{label}</Typography>
                </Stack>
                {(slate.picks || []).map((pick, i) => <PickRow key={pick.gameId || `${slate.date}-${i}`} pick={pick} />)}
              </Box>
            );
          })}
        </Stack>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2.5, lineHeight: 1.55 }}>
        Record storage is local to this browser/device because PIVT currently has no database. Clearing browser storage also clears this local record.
      </Typography>
    </Box>
  );
}
