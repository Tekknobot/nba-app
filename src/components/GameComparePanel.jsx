import React, { useEffect, useState } from "react";
import { Avatar, Box, CircularProgress, Divider, Stack, Typography } from "@mui/material";
import { logoForTeam } from "../utils/teamAssets";

async function api(params) {
  const q = new URLSearchParams(params);
  const r = await fetch(`/api/nba-data?${q}`, { cache: "no-store" });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body?.detail || body?.error || `HTTP ${r.status}`);
  return body;
}

function seasonStart(anchor) {
  const d = new Date(`${anchor}T12:00:00Z`);
  const startYear = d.getUTCMonth() >= 9 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${startYear}-10-01`;
}

function PlayerRow({ item }) {
  const name = [item?.player?.first_name, item?.player?.last_name].filter(Boolean).join(" ") || "Player";
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ py: .8 }}>
      <Avatar src={item?.image || ""} alt="" sx={{ width: 34, height: 34, bgcolor: "#1b1b1b", fontSize: 10 }}>{name.slice(0, 2).toUpperCase()}</Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{name}</Typography>
        <Typography variant="caption" color="text.secondary">{item?.min || "0:00"} min</Typography>
      </Box>
      <Stack direction="row" spacing={1.2} sx={{ fontVariantNumeric: "tabular-nums" }}>
        <Box sx={{ textAlign: "right" }}><Typography variant="body2" sx={{ fontWeight: 750 }}>{Number(item?.pts || 0).toFixed(1)}</Typography><Typography variant="caption" color="text.secondary">PTS</Typography></Box>
        <Box sx={{ textAlign: "right" }}><Typography variant="body2" sx={{ fontWeight: 750 }}>{Number(item?.reb || 0).toFixed(1)}</Typography><Typography variant="caption" color="text.secondary">REB</Typography></Box>
        <Box sx={{ textAlign: "right" }}><Typography variant="body2" sx={{ fontWeight: 750 }}>{Number(item?.ast || 0).toFixed(1)}</Typography><Typography variant="caption" color="text.secondary">AST</Typography></Box>
      </Stack>
    </Stack>
  );
}

function FormRow({ game }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ py: .55 }}>
      <Typography sx={{ width: 18, fontSize: 12, fontWeight: 850, color: game?.result === "W" ? "success.main" : game?.result === "L" ? "error.main" : "text.secondary" }}>{game?.result}</Typography>
      <Typography variant="body2" sx={{ flex: 1 }}>{game?.homeAway === "Home" ? "vs" : "@"} {game?.opp}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>{game?.score}</Typography>
    </Stack>
  );
}

function TeamSection({ team, form, players, playersMode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Avatar src={logoForTeam(team)} alt="" sx={{ width: 38, height: 38, p: .35, bgcolor: "transparent", "& img": { objectFit: "contain" } }}>{team?.code}</Avatar>
        <Box>
          <Typography sx={{ fontWeight: 800 }}>{team?.name}</Typography>
          <Typography variant="caption" color="text.secondary">{team?.code}</Typography>
        </Box>
      </Stack>

      <Typography variant="overline" color="text.secondary">Recent form</Typography>
      <Box sx={{ mt: .35 }}>
        {(form || []).slice(0, 5).map((g, i) => <FormRow key={`${g.date}-${g.opp}-${i}`} game={g} />)}
        {!form?.length && <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>No completed games available.</Typography>}
      </Box>

      <Divider sx={{ my: 1.5 }} />
      <Stack direction="row" justifyContent="space-between" alignItems="baseline">
        <Typography variant="overline" color="text.secondary">Players</Typography>
        <Typography variant="caption" color="text.secondary">{playersMode === "recent" ? "recent avg" : "season avg"}</Typography>
      </Stack>
      <Box sx={{ mt: .35 }}>
        {(players || []).map((p) => <PlayerRow key={p.player_id} item={p} />)}
        {!players?.length && <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>Player data unavailable.</Typography>}
      </Box>
    </Box>
  );
}

export default function GameComparePanel({ game }) {
  const anchor = (game?._iso || game?.dateKey || new Date().toISOString()).slice(0, 10);
  const [state, setState] = useState({ loading: true, error: "", awayForm: [], homeForm: [], awayPlayers: [], homePlayers: [], awayMode: "", homeMode: "", h2h: null });

  useEffect(() => {
    if (!game?.away?.code || !game?.home?.code) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: "" }));

    Promise.all([
      api({ action: "team-last10", team: game.away.code, anchor }),
      api({ action: "team-last10", team: game.home.code, anchor }),
      api({ action: "top-players", team: game.away.code, anchor, days: "21", topN: "3" }),
      api({ action: "top-players", team: game.home.code, anchor, days: "21", topN: "3" }),
      api({ action: "h2h", a: game.away.code, b: game.home.code, start: seasonStart(anchor), end: anchor }),
    ]).then(([awayForm, homeForm, awayPlayers, homePlayers, h2h]) => {
      if (cancelled) return;
      setState({
        loading: false,
        error: "",
        awayForm: awayForm?.games || [],
        homeForm: homeForm?.games || [],
        awayPlayers: awayPlayers?.players || [],
        homePlayers: homePlayers?.players || [],
        awayMode: awayPlayers?._mode || "",
        homeMode: homePlayers?._mode || "",
        h2h: { away: h2h?.aWins || 0, home: h2h?.bWins || 0 },
      });
    }).catch((e) => {
      if (!cancelled) setState((s) => ({ ...s, loading: false, error: e?.message || String(e) }));
    });

    return () => { cancelled = true; };
  }, [game?.away?.code, game?.home?.code, anchor]);

  const liveOrFinal = /final|in progress|halftime|quarter|q\d/i.test(String(game?.status || ""));
  const awayScore = Number.isFinite(Number(game?.awayScore)) ? Number(game.awayScore) : null;
  const homeScore = Number.isFinite(Number(game?.homeScore)) ? Number(game.homeScore) : null;

  return (
    <Box>
      <Box sx={{ py: .5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
          <Box>
            <Typography variant="caption" color="text.secondary">{game?.status || "Scheduled"}</Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 800, mt: .2 }}>{game?.away?.name} @ {game?.home?.name}</Typography>
          </Box>
          {liveOrFinal && awayScore !== null && homeScore !== null && (
            <Typography sx={{ fontSize: 26, fontWeight: 850, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{awayScore}–{homeScore}</Typography>
          )}
        </Stack>
        {state.h2h && <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: .75 }}>Season series: {game?.away?.code} {state.h2h.away}–{state.h2h.home} {game?.home?.code}</Typography>}
      </Box>

      <Divider sx={{ my: 1.5 }} />
      {state.loading ? <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress size={18} /></Stack> : state.error ? (
        <Typography variant="body2" color="text.secondary">Matchup detail unavailable.</Typography>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5 }}>
          <TeamSection team={game.away} form={state.awayForm} players={state.awayPlayers} playersMode={state.awayMode} />
          <TeamSection team={game.home} form={state.homeForm} players={state.homePlayers} playersMode={state.homeMode} />
        </Box>
      )}
      <Divider sx={{ my: 1.5 }} />
      <Typography variant="caption" color="text.secondary">Stats and results: free ESPN public feeds. Images are supplied by the source when available.</Typography>
    </Box>
  );
}
