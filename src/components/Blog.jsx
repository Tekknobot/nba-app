import React from "react";
import { Avatar, Box, CircularProgress, Divider, Stack, Typography } from "@mui/material";
import { formatGameLabel } from "../utils/datetime";
import { logoForTeam, stageLabel } from "../utils/teamAssets";

function easternISODate(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

async function loadPulse(date) {
  const q = new URLSearchParams({ action: "pulse", date });
  const r = await fetch(`/api/nba-data?${q}`, { cache: "no-store" });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body?.detail || body?.error || `HTTP ${r.status}`);
  return body;
}

function isFinal(game) { return Boolean(game?.completed) || /final/i.test(String(game?.status || "")); }
function isLive(game) { return /in progress|halftime|quarter|q\d|end of/i.test(String(game?.status || "")); }

function MiniTeam({ team, score, winner, loser }) {
  const tone = winner ? "success.main" : loser ? "error.main" : "text.primary";
  return (
    <Stack direction="row" alignItems="center" spacing={.8} sx={{ minWidth: 0 }}>
      <Avatar src={logoForTeam(team)} alt="" sx={{ width: 28, height: 28, p: .3, bgcolor: "transparent", "& img": { objectFit: "contain" } }}>{team?.code}</Avatar>
      <Typography variant="body2" sx={{ flex: 1, minWidth: 0, fontWeight: winner ? 850 : 700, color: tone }} noWrap>{team?.code}</Typography>
      {Number.isFinite(Number(score)) && <Typography variant="body2" sx={{ fontWeight: winner ? 900 : 800, color: tone, fontVariantNumeric: "tabular-nums" }}>{score}</Typography>}
    </Stack>
  );
}

function PulseGame({ game }) {
  const final = isFinal(game);
  const live = isLive(game);
  const awayScore = Number.isFinite(Number(game?.awayScore)) ? Number(game.awayScore) : null;
  const homeScore = Number.isFinite(Number(game?.homeScore)) ? Number(game.homeScore) : null;
  const awayWon = final && awayScore !== null && homeScore !== null && awayScore > homeScore;
  const homeWon = final && awayScore !== null && homeScore !== null && homeScore > awayScore;
  const time = live
    ? `LIVE · ${game?.status || "In progress"}`
    : final
      ? "FINAL"
      : (game?._iso ? formatGameLabel(game._iso, { mode: "ET", withTZ: true }) : (game?.status || "Scheduled"));
  const showScore = live || final;
  return (
    <Box sx={{ py: 1.15, borderTop: "1px solid", borderColor: "divider" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: .8 }}>
        <Typography variant="caption" sx={{ color: live ? "warning.main" : "text.secondary", fontWeight: live ? 850 : 500 }}>{time}</Typography>
        <Typography variant="caption" color="text.secondary">{stageLabel(game?.seasonStageId)}</Typography>
      </Stack>
      <Stack spacing={.6}>
        <MiniTeam team={game?.away} score={showScore ? awayScore : null} winner={awayWon} loser={final && homeWon} />
        <MiniTeam team={game?.home} score={showScore ? homeScore : null} winner={homeWon} loser={final && awayWon} />
      </Stack>
    </Box>
  );
}


export default function Blog() {
  const date = React.useMemo(() => easternISODate(), []);
  const [state, setState] = React.useState({ loading: true, error: "", pulse: null });

  React.useEffect(() => {
    let cancelled = false;
    const refresh = async (initial = false) => {
      if (!initial && typeof document !== "undefined" && document.hidden) return;
      try {
        const pulse = await loadPulse(date);
        if (!cancelled) setState({ loading: false, error: "", pulse });
      } catch (e) {
        if (!cancelled && initial) setState({ loading: false, error: e?.message || String(e), pulse: null });
      }
    };
    refresh(true);
    const interval = window.setInterval(() => refresh(false), 20000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [date]);

  const pulse = state.pulse;
  const stages = pulse?.stages || [];
  const phase = stages.includes(1) ? "Preseason" : stages.includes(3) ? "Postseason" : stages.includes(2) ? "Regular season" : "NBA";

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", px: { xs: 1.5, sm: 3 }, py: { xs: 2.5, sm: 4 } }}>
      <Typography variant="overline" color="text.secondary">NBA Pulse</Typography>
      <Typography component="h1" variant="h4" sx={{ mt: .4 }}>{date}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Live slate context from PIVT's public NBA data source. Preseason, regular season, and postseason are all included.</Typography>
      <Divider sx={{ my: 3 }} />

      {state.loading ? (
        <Stack alignItems="center" sx={{ py: 10 }}><CircularProgress size={20} /></Stack>
      ) : state.error ? (
        <Box sx={{ py: 5 }}>
          <Typography sx={{ fontWeight: 800 }}>NBA Pulse unavailable.</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>{state.error}</Typography>
        </Box>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.1fr .9fr" }, gap: 3 }}>
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
              <Typography variant="overline" color="text.secondary">Today's slate</Typography>
              <Typography variant="caption" color="text.secondary">{phase}</Typography>
            </Stack>
            {pulse?.today?.length ? pulse.today.map((g) => <PulseGame key={g.id || `${g.dateKey}-${g.away?.code}-${g.home?.code}`} game={g} />) : (
              <Box sx={{ borderTop: "1px solid", borderColor: "divider", py: 3 }}><Typography variant="body2" color="text.secondary">No NBA games today.</Typography></Box>
            )}

            <Typography variant="overline" color="text.secondary" sx={{ display: "block", mt: 3, mb: 1 }}>Recent results</Typography>
            {pulse?.recent?.length ? pulse.recent.slice(0, 4).map((g) => <PulseGame key={`recent-${g.id}`} game={g} />) : (
              <Typography variant="body2" color="text.secondary">No recent finals in the current window.</Typography>
            )}
          </Box>

          <Box>
            <Typography variant="overline" color="text.secondary">Up next</Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 800, mt: .5, mb: 1 }}>{pulse?.nextDate || "No upcoming date found"}</Typography>
            {pulse?.next?.length ? pulse.next.map((g) => <PulseGame key={`next-${g.id}`} game={g} />) : (
              <Typography variant="body2" color="text.secondary">No games found in the next 10 days.</Typography>
            )}
            <Divider sx={{ my: 2.5 }} />
            <Typography variant="overline" color="text.secondary">Pulse notes</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: .7, lineHeight: 1.7 }}>
              Matchup panels use each team's most recent completed games and available player production for the PIVT pre-game lean. Early preseason samples are intentionally marked low confidence.
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}
