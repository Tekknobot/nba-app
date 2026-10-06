import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Avatar, Box, Button, Card, CardContent, CircularProgress, Divider,
  Drawer, IconButton, Stack, Typography, useMediaQuery
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

import GameComparePanel from "./GameComparePanel";
import NbaNews from "./NbaNews";
import { formatGameLabel } from "../utils/datetime";
import { logoForTeam } from "../utils/teamAssets";

function firstOfMonth(d) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addMonths(d, n) {
  const x = new Date(d);
  x.setDate(1);
  x.setMonth(x.getMonth() + n);
  return x;
}
function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysInMonth(year, month) {
  const out = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}
function isFinal(game) { return /final/i.test(String(game?.status || "")); }
function isLive(game) { return /in progress|halftime|quarter|q\d|end of/i.test(String(game?.status || "")); }
function num(v) { return Number.isFinite(Number(v)) ? Number(v) : null; }

async function fetchMonth(year, monthIndex) {
  const q = new URLSearchParams({ action: "month", year: String(year), month: String(monthIndex + 1) });
  const r = await fetch(`/api/nba-data?${q}`, { cache: "no-store" });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body?.detail || body?.error || `HTTP ${r.status}`);
  return Array.isArray(body?.games) ? body.games : [];
}

async function fetchTopPicks(date) {
  const q = new URLSearchParams({ action: "top-picks", date });
  const r = await fetch(`/api/nba-data?${q}`, { cache: "no-store" });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body?.detail || body?.error || `HTTP ${r.status}`);
  return Array.isArray(body?.picks) ? body.picks : [];
}

function PivtThree({ date, onOpen }) {
  const [state, setState] = useState({ loading: true, picks: [], error: "" });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, picks: [], error: "" });
    fetchTopPicks(date)
      .then((picks) => { if (!cancelled) setState({ loading: false, picks, error: "" }); })
      .catch((e) => { if (!cancelled) setState({ loading: false, picks: [], error: e?.message || String(e) }); });
    return () => { cancelled = true; };
  }, [date]);

  if (!state.loading && !state.picks.length) return null;

  return (
    <Box sx={{ mb: 2.25, borderTop: "1px solid", borderBottom: "1px solid", borderColor: "divider", py: 1.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
        <Box>
          <Typography variant="overline" color="text.secondary">PIVT 3</Typography>
          <Typography sx={{ fontSize: 15, fontWeight: 800 }}>Strongest model leans</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">not betting odds</Typography>
      </Stack>

      {state.loading ? (
        <Stack alignItems="center" sx={{ py: 2 }}><CircularProgress size={16} /></Stack>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3,minmax(0,1fr))" }, gap: .75 }}>
          {state.picks.map((row, index) => {
            const game = row?.game || {};
            const prediction = row?.prediction || {};
            const pct = Math.max(Number(prediction?.awayProbability) || 50, Number(prediction?.homeProbability) || 50);
            return (
              <Box
                key={game.id || `${game?.away?.code}-${game?.home?.code}-${index}`}
                onClick={() => onOpen?.({ ...game, _pivtPrediction: prediction })}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onOpen?.({ ...game, _pivtPrediction: prediction }); }}
                sx={{ p: 1.1, border: "1px solid", borderColor: "divider", cursor: "pointer", minWidth: 0, "&:hover": { bgcolor: "#141414", borderColor: "#454545" } }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
                  <Typography variant="caption" color="text.secondary">#{index + 1} · {game?.away?.code} @ {game?.home?.code}</Typography>
                  <Typography variant="caption" color="text.secondary">{prediction?.confidence || "low"}</Typography>
                </Stack>
                <Typography sx={{ fontSize: 18, fontWeight: 900, mt: .45 }}>{prediction?.pick || "—"} {pct}%</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: .45, lineHeight: 1.35 }}>
                  {(prediction?.factors || []).slice(0, 2).join(" · ") || "Recent form model"}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}

      {!state.loading && !state.error && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          Ranked from recent form, scoring margin, consistency, top-player production, rest and home court. Low-confidence picks stay labeled low.
        </Typography>
      )}
    </Box>
  );
}

function TeamMark({ team, size = 34 }) {
  return (
    <Avatar src={logoForTeam(team)} alt="" sx={{ width: size, height: size, p: .4, bgcolor: "transparent", color: "text.secondary", fontSize: 10, "& img": { objectFit: "contain" } }}>
      {team?.code}
    </Avatar>
  );
}

function TeamRow({ team, score, winner }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.1} sx={{ minWidth: 0 }}>
      <TeamMark team={team} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: 14, fontWeight: winner ? 850 : 700 }} noWrap>{team?.name || team?.code}</Typography>
        <Typography variant="caption" color="text.secondary">{team?.code}</Typography>
      </Box>
      {score !== null && <Typography sx={{ fontSize: 22, fontWeight: winner ? 850 : 600, fontVariantNumeric: "tabular-nums" }}>{score}</Typography>}
    </Stack>
  );
}

function GameCard({ game, onOpen }) {
  const final = isFinal(game);
  const live = isLive(game);
  const homeScore = num(game?.homeScore);
  const awayScore = num(game?.awayScore);
  const homeWon = final && homeScore !== null && awayScore !== null && homeScore > awayScore;
  const awayWon = final && homeScore !== null && awayScore !== null && awayScore > homeScore;
  const time = !final && !live && game?._iso ? formatGameLabel(game._iso, { mode: "ET", withTZ: true }) : (game?.status || "Scheduled");

  return (
    <Card onClick={onOpen} sx={{ cursor: "pointer", "&:hover": { borderColor: "#4a4a4a", bgcolor: "#141414" } }}>
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.15 }}>
          <Typography variant="caption" sx={{ color: live ? "warning.main" : "text.secondary", fontWeight: live ? 800 : 600 }}>{live ? "LIVE" : final ? "FINAL" : time}</Typography>
          <Typography variant="caption" color="text.secondary">{game?.seasonStageId === 1 ? "PRE" : game?.seasonStageId === 3 ? "POST" : "NBA"}</Typography>
        </Stack>
        <Stack spacing={1}>
          <TeamRow team={game.away} score={final || live ? awayScore : null} winner={awayWon} />
          <Divider />
          <TeamRow team={game.home} score={final || live ? homeScore : null} winner={homeWon} />
        </Stack>
      </CardContent>
    </Card>
  );
}

function MatchupDrawer({ game, open, onClose }) {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down("sm"));
  return (
    <Drawer anchor={phone ? "bottom" : "right"} open={open} onClose={onClose} PaperProps={{ sx: phone ? { height: "92vh" } : { width: 620, maxWidth: "48vw" } }}>
      {game && (
        <Box sx={{ p: { xs: 1.5, sm: 2.25 }, overflow: "auto" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <Box>
              <Typography variant="overline" color="text.secondary">Matchup</Typography>
              <Typography variant="h6">{game.away?.code} @ {game.home?.code}</Typography>
            </Box>
            <IconButton onClick={onClose} aria-label="Close matchup"><CloseRoundedIcon /></IconButton>
          </Stack>
          <Divider sx={{ mb: 1.5 }} />
          <GameComparePanel game={game} />
        </Box>
      )}
    </Drawer>
  );
}

export default function AllGamesCalendar() {
  const now = new Date();
  const [viewMonth, setViewMonth] = useState(firstOfMonth(now));
  const [selectedDate, setSelectedDate] = useState(now);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openGame, setOpenGame] = useState(null);
  const cache = useRef(new Map());
  const rail = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const y = viewMonth.getFullYear();
    const m = viewMonth.getMonth();
    const key = `${y}-${m}`;
    setLoading(true);
    setError("");
    (cache.current.has(key) ? Promise.resolve(cache.current.get(key)) : fetchMonth(y, m).then((rows) => { cache.current.set(key, rows); return rows; }))
      .then((rows) => { if (!cancelled) setGames(rows); })
      .catch((e) => { if (!cancelled) { setGames([]); setError(e?.message || String(e)); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [viewMonth]);

  const days = useMemo(() => daysInMonth(viewMonth.getFullYear(), viewMonth.getMonth()), [viewMonth]);
  const byDay = useMemo(() => {
    const map = new Map();
    for (const game of games) {
      if (!game?.dateKey) continue;
      if (!map.has(game.dateKey)) map.set(game.dateKey, []);
      map.get(game.dateKey).push(game);
    }
    for (const rows of map.values()) rows.sort((a, b) => String(a._iso).localeCompare(String(b._iso)));
    return map;
  }, [games]);

  const selectedKey = dateKey(selectedDate);
  const selectedGames = byDay.get(selectedKey) || [];
  const monthName = viewMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const dateLabel = selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  useEffect(() => {
    const idx = days.findIndex((d) => dateKey(d) === selectedKey);
    const el = rail.current?.querySelector(`[data-day="${idx}"]`);
    el?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [days, selectedKey]);

  useEffect(() => {
    const el = rail.current;
    if (!el) return undefined;
    const handleWheel = (event) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        el.scrollLeft += event.deltaY;
        event.preventDefault();
      }
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  function moveMonth(delta) {
    const next = addMonths(viewMonth, delta);
    setViewMonth(next);
    setSelectedDate(next);
  }
  function goToday() {
    const d = new Date();
    setViewMonth(firstOfMonth(d));
    setSelectedDate(d);
  }

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 1.5, sm: 3 }, py: { xs: 2, sm: 3 } }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "end" }} spacing={1.5} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="overline" color="text.secondary">NBA calendar</Typography>
          <Typography component="h1" variant="h4" sx={{ mt: .1 }}>{dateLabel}</Typography>
        </Box>
        <Stack direction="row" spacing={.5} alignItems="center">
          <Button onClick={goToday} size="small" color="inherit">Today</Button>
          <IconButton onClick={() => moveMonth(-1)} aria-label="Previous month"><ChevronLeftRoundedIcon fontSize="small" /></IconButton>
          <Typography sx={{ minWidth: 138, textAlign: "center", fontSize: 14, fontWeight: 700 }}>{monthName}</Typography>
          <IconButton onClick={() => moveMonth(1)} aria-label="Next month"><ChevronRightRoundedIcon fontSize="small" /></IconButton>
        </Stack>
      </Stack>

      <Box
        ref={rail}
        tabIndex={0}
        role="region"
        aria-label="NBA calendar dates"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") rail.current?.scrollBy({ left: -160, behavior: "smooth" });
          if (event.key === "ArrowRight") rail.current?.scrollBy({ left: 160, behavior: "smooth" });
        }}
        sx={{
          display: "flex",
          gap: .5,
          overflowX: "auto",
          overflowY: "hidden",
          overscrollBehaviorX: "contain",
          scrollBehavior: "smooth",
          pb: 1.2,
          mb: 2,
          scrollbarWidth: "thin",
          scrollbarColor: "#3b3b3b transparent",
          "&::-webkit-scrollbar": { height: 6 },
          "&::-webkit-scrollbar-track": { background: "transparent" },
          "&::-webkit-scrollbar-thumb": { background: "#3b3b3b", borderRadius: 999 },
          "&:focus-visible": { outline: "1px solid", outlineColor: "divider", outlineOffset: 4 },
        }}
      >
        {days.map((d, i) => {
          const key = dateKey(d);
          const selected = key === selectedKey;
          const count = (byDay.get(key) || []).length;
          return (
            <Button key={key} data-day={i} onClick={() => setSelectedDate(d)} variant={selected ? "contained" : "outlined"} color="inherit" sx={{ flex: "0 0 auto", minWidth: 62, px: .8, py: .7, display: "block", bgcolor: selected ? "#ededed" : "transparent", color: selected ? "#0b0b0b" : "text.secondary", borderColor: selected ? "#ededed" : "divider" }}>
              <Typography variant="caption" sx={{ display: "block", color: "inherit", textTransform: "uppercase" }}>{d.toLocaleDateString(undefined, { weekday: "short" })}</Typography>
              <Typography sx={{ fontSize: 19, lineHeight: 1.25, fontWeight: 800 }}>{d.getDate()}</Typography>
              <Typography sx={{ fontSize: 10, opacity: .7 }}>{count || "—"}</Typography>
            </Button>
          );
        })}
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0,1.65fr) minmax(300px,.75fr)" }, gap: { xs: 2.5, lg: 3 } }}>
        <Box>
          {!loading && selectedGames.some((game) => !game?.completed && game?.state !== "in") && (
            <PivtThree date={selectedKey} onOpen={setOpenGame} />
          )}
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1.2 }}>
            <Typography variant="overline" color="text.secondary">Games</Typography>
            <Typography variant="caption" color="text.secondary">{loading ? "Loading" : `${selectedGames.length} listed`}</Typography>
          </Stack>

          {loading ? (
            <Stack alignItems="center" sx={{ py: 10 }}><CircularProgress size={20} /></Stack>
          ) : selectedGames.length ? (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2,minmax(0,1fr))" }, gap: 1 }}>
              {selectedGames.map((game) => <GameCard key={game.id || `${game.dateKey}-${game.away?.code}-${game.home?.code}`} game={game} onOpen={() => setOpenGame(game)} />)}
            </Box>
          ) : (
            <Box sx={{ borderTop: "1px solid", borderBottom: "1px solid", borderColor: "divider", py: 6 }}>
              <Typography sx={{ fontWeight: 750 }}>No games on this date.</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>Choose another date or month.</Typography>
            </Box>
          )}

          {error && <Typography variant="caption" color="error.main" sx={{ display: "block", mt: 1.25 }}>Schedule unavailable: {error}</Typography>}
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <NbaNews compact />
        </Box>
      </Box>

      <Divider sx={{ my: 3 }} />
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={.5}>
        <Typography variant="caption" color="text.secondary">PIVT</Typography>
        <Typography variant="caption" color="text.secondary">No API key · public NBA and publisher data</Typography>
      </Stack>

      <MatchupDrawer game={openGame} open={Boolean(openGame)} onClose={() => setOpenGame(null)} />
    </Box>
  );
}
