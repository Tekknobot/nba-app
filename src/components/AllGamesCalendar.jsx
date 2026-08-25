import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
  Drawer, IconButton, Stack, Typography, useMediaQuery
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import SportsBasketballRoundedIcon from "@mui/icons-material/SportsBasketballRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import WifiRoundedIcon from "@mui/icons-material/WifiRounded";
import "@fontsource/bebas-neue";

import GameComparePanel from "./GameComparePanel";
import NbaNews from "./NbaNews";
import HaikuOfTheDay from "./HaikuOfTheDay";
import { formatGameLabel } from "../utils/datetime";
import { logoForTeam, stageLabel } from "../utils/teamAssets";

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
function dateKeyFromDate(d) {
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
function isOffseasonMonth(d = new Date()) {
  const m = d.getMonth();
  return m >= 6 && m <= 8;
}
function mapHasAnyGames(map) {
  for (const arr of map.values()) if (Array.isArray(arr) && arr.length) return true;
  return false;
}
function nextOctober(from = new Date()) {
  const y = from.getFullYear();
  return new Date(y, 9, 1);
}
function isFinal(game) {
  return /final/i.test(String(game?.status || ""));
}
function isLive(game) {
  return /in progress|halftime|end of|quarter|q\d/i.test(String(game?.status || ""));
}
function scoreValue(v) {
  return Number.isFinite(Number(v)) ? Number(v) : null;
}

async function fetchMonthSchedulePublic(year, monthIndex) {
  const params = new URLSearchParams({
    action: "month",
    year: String(year),
    month: String(monthIndex + 1),
  });
  const res = await fetch(`/api/nba-data?${params.toString()}`, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.detail || json?.error || `NBA data HTTP ${res.status}`);
  return Array.isArray(json?.games) ? json.games : [];
}

function TeamLogo({ team, size = 50 }) {
  return (
    <Avatar
      src={logoForTeam(team)}
      alt={`${team?.name || team?.code || "NBA team"} logo`}
      sx={{
        width: size,
        height: size,
        bgcolor: "rgba(255,255,255,.07)",
        border: "1px solid rgba(255,255,255,.10)",
        p: 0.65,
        color: "text.primary",
        fontSize: Math.max(10, Math.round(size * 0.25)),
        fontWeight: 900,
        "& img": { objectFit: "contain" },
      }}
    >
      {team?.code || "NBA"}
    </Avatar>
  );
}

function ComparisonDrawer({ open, onClose, game }) {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down("sm"));
  if (!open || !game) return null;

  return (
    <Drawer
      anchor={phone ? "bottom" : "right"}
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: phone
          ? { height: "92vh", borderRadius: 0, p: 1.5 }
          : { width: 700, maxWidth: "46vw", p: 2.5 },
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={-0.8}>
            <TeamLogo team={game.away} size={38} />
            <TeamLogo team={game.home} size={38} />
          </Stack>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" sx={{ color: "text.secondary", lineHeight: 1 }}>MATCHUP</Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 900 }} noWrap>
              {game?.away?.code} @ {game?.home?.code}
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose} aria-label="Close matchup panel"><CloseRoundedIcon /></IconButton>
      </Stack>
      <Divider sx={{ mb: 1.5 }} />
      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", pb: 2 }}>
        <GameComparePanel game={game} />
      </Box>
    </Drawer>
  );
}

function TeamLine({ team, score, winner, homeAway }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
      <TeamLogo team={team} size={46} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" spacing={0.75} alignItems="baseline" sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: winner ? 900 : 750, fontSize: { xs: 16, sm: 17 } }} noWrap>
            {team?.code}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>{homeAway}</Typography>
        </Stack>
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }} noWrap>
          {team?.name}
        </Typography>
      </Box>
      {score !== null && (
        <Typography sx={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: { xs: 31, sm: 36 }, lineHeight: 1, letterSpacing: 0.6 }}>
          {score}
        </Typography>
      )}
    </Stack>
  );
}

function GameCard({ game, onPick }) {
  const final = isFinal(game);
  const live = isLive(game);
  const hs = scoreValue(game?.homeScore);
  const as = scoreValue(game?.awayScore);
  const homeWon = final && hs !== null && as !== null && hs > as;
  const awayWon = final && hs !== null && as !== null && as > hs;

  let statusLabel = game?.status || "Scheduled";
  if (!final && !live && game?.hasClock && game?._iso) {
    statusLabel = formatGameLabel(game._iso, { mode: "ET", withTZ: true });
  }

  return (
    <Card
      variant="outlined"
      onClick={onPick}
      sx={{
        borderRadius: 0,
        cursor: "pointer",
        overflow: "hidden",
        transition: "transform 140ms ease, border-color 140ms ease, background-color 140ms ease",
        "&:hover": { transform: { sm: "translateY(-2px)" }, borderColor: "rgba(255,255,255,.24)", bgcolor: "rgba(255,255,255,.025)" },
      }}
    >
      <CardContent sx={{ p: { xs: 1.5, sm: 2 }, "&:last-child": { pb: { xs: 1.5, sm: 2 } } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1.25 }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Chip size="small" label={stageLabel(game?.seasonStageId)} variant="outlined" />
            {live && <Chip size="small" label="LIVE" color="warning" />}
            {final && <Chip size="small" label="FINAL" color="success" />}
          </Stack>
          <Typography variant="caption" sx={{ color: "text.secondary", textAlign: "right" }}>
            {statusLabel}
          </Typography>
        </Stack>

        <Stack spacing={1.2}>
          <TeamLine team={game.away} score={(final || live) ? as : null} winner={awayWon} homeAway="Away" />
          <Divider />
          <TeamLine team={game.home} score={(final || live) ? hs : null} winner={homeWon} homeAway="Home" />
        </Stack>

        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1.35 }}>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Tap for recent form, series & player stats
          </Typography>
          <ArrowForwardRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
        </Stack>
      </CardContent>
    </Card>
  );
}

function DayPill({ d, selected, count, onClick }) {
  const dow = d.toLocaleDateString(undefined, { weekday: "short" });
  const day = d.getDate();
  const today = dateKeyFromDate(new Date()) === dateKeyFromDate(d);

  return (
    <Button
      onClick={onClick}
      variant={selected ? "contained" : "outlined"}
      aria-label={`${dow} ${day}, ${count || 0} games`}
      sx={{
        flex: "0 0 auto",
        minWidth: { xs: 70, sm: 78 },
        height: { xs: 72, sm: 78 },
        px: 1,
        borderRadius: 0,
        flexDirection: "column",
        gap: 0.2,
        textTransform: "none",
      }}
    >
      <Typography variant="caption" sx={{ opacity: 0.76, fontWeight: 800, lineHeight: 1 }}>{dow}</Typography>
      <Typography sx={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 27, lineHeight: 1 }}>{String(day).padStart(2, "0")}</Typography>
      <Typography variant="caption" sx={{ fontSize: 10, opacity: 0.72, lineHeight: 1.1 }}>
        {today ? "Today" : count ? `${count} game${count > 1 ? "s" : ""}` : "—"}
      </Typography>
    </Button>
  );
}

function LeagueStatus({ currentOffseason, onJumpOctober }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 0, overflow: "hidden" }}>
      <CardContent sx={{ p: 2.25 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box>
            <Typography variant="overline" sx={{ color: "text.secondary", letterSpacing: 1.2 }}>LEAGUE STATUS</Typography>
            <Typography variant="h5" sx={{ mt: -0.35 }}>
              {currentOffseason ? "NBA OFFSEASON" : "SEASON ACTIVE"}
            </Typography>
          </Box>
          <Box className={currentOffseason ? "status-orb offseason" : "status-orb active"} />
        </Stack>
        <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
          {currentOffseason
            ? "It’s currently the NBA offseason. The 2026–27 regular season begins October 20, so August has no regular-season slate."
            : "The NBA calendar is active. Use the date rail to move through the current month and open any matchup for recent team context."}
        </Typography>
        {currentOffseason && (
          <Button onClick={onJumpOctober} size="small" variant="outlined" sx={{ mt: 1.5 }}>
            Jump to October
          </Button>
        )}
        <Divider sx={{ my: 1.5 }} />
        <Stack direction="row" spacing={0.75} alignItems="center">
          <WifiRoundedIcon sx={{ fontSize: 16, color: "success.main" }} />
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Public NBA data · no account or API key required
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function AllGamesCalendar() {
  const now = new Date();
  const [allGames, setAllGames] = useState([]);
  const [viewMonth, setViewMonth] = useState(firstOfMonth(now));
  const [selectedDate, setSelectedDate] = useState(now);
  const [loadErr, setLoadErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [compareGame, setCompareGame] = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const cacheRef = useRef(new Map());
  const stripRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const y = viewMonth.getFullYear();
      const mIdx = viewMonth.getMonth();
      const key = `${y}-${String(mIdx + 1).padStart(2, "0")}`;
      try {
        setLoading(true);
        if (cacheRef.current.has(key)) {
          if (!cancelled) {
            setAllGames(cacheRef.current.get(key));
            setLoadErr(null);
          }
          return;
        }
        const rows = await fetchMonthSchedulePublic(y, mIdx);
        if (cancelled) return;
        cacheRef.current.set(key, rows);
        setAllGames(rows);
        setLoadErr(null);
      } catch (e) {
        if (!cancelled) {
          setLoadErr(e?.message || String(e));
          setAllGames([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [viewMonth]);

  const monthDays = useMemo(() => daysInMonth(viewMonth.getFullYear(), viewMonth.getMonth()), [viewMonth]);
  const eventsMap = useMemo(() => {
    const map = new Map();
    for (const game of allGames || []) {
      if (!game?.dateKey) continue;
      if (!map.has(game.dateKey)) map.set(game.dateKey, []);
      map.get(game.dateKey).push(game);
    }
    for (const games of map.values()) games.sort((a, b) => String(a._iso || "").localeCompare(String(b._iso || "")));
    return map;
  }, [allGames]);

  const selectedKey = dateKeyFromDate(selectedDate);
  const selectedGames = eventsMap.get(selectedKey) || [];
  const monthHasGames = useMemo(() => mapHasAnyGames(eventsMap), [eventsMap]);
  const viewedOffseason = isOffseasonMonth(viewMonth);
  const currentOffseason = isOffseasonMonth(now);

  useEffect(() => {
    const idx = monthDays.findIndex((d) => dateKeyFromDate(d) === selectedKey);
    if (idx < 0 || !stripRef.current) return;
    const el = stripRef.current.querySelector(`[data-idx="${idx}"]`);
    if (el) el.scrollIntoView({ inline: "center", block: "nearest" });
  }, [monthDays, selectedKey]);

  function moveMonth(amount) {
    const next = addMonths(viewMonth, amount);
    setViewMonth(next);
    setSelectedDate(next);
  }
  function jumpToday() {
    const d = new Date();
    setViewMonth(firstOfMonth(d));
    setSelectedDate(d);
  }
  function jumpOctober() {
    const d = nextOctober(now);
    setViewMonth(firstOfMonth(d));
    setSelectedDate(d);
  }
  function openCompare(game) {
    setCompareGame(game);
    setCompareOpen(true);
  }

  const headerMonth = viewMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const selectedLabel = selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <Box sx={{ maxWidth: 1380, width: "100%", mx: "auto", px: { xs: 1.25, sm: 2.5, lg: 3 }, py: { xs: 1.5, sm: 2.5 } }}>
      <Card className="pivt-hero" variant="outlined" sx={{ borderRadius: 0, mb: { xs: 1.5, sm: 2.25 } }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 }, "&:last-child": { pb: { xs: 2, sm: 3 } } }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0,1fr) auto" }, gap: 2, alignItems: "end" }}>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Chip
                  size="small"
                  color={currentOffseason ? "warning" : "success"}
                  label={currentOffseason ? "OFFSEASON NOW" : "NBA NOW"}
                />
                <Chip size="small" variant="outlined" label="Keyless public data" />
              </Stack>
              <Typography component="h1" sx={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: { xs: 43, sm: 58, lg: 68 }, lineHeight: 0.94, letterSpacing: 1.2 }}>
                THE NBA, DAY BY DAY.
              </Typography>
              <Typography sx={{ color: "text.secondary", maxWidth: 720, mt: 1, fontSize: { xs: 14, sm: 16 } }}>
                Scores, schedules, recent form, season series and player snapshots in one fast calendar. Team logos and available story images are pulled from public source data.
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center" justifyContent={{ xs: "space-between", md: "flex-end" }}>
              <Button size="small" variant="text" onClick={jumpToday}>Today</Button>
              <IconButton onClick={() => moveMonth(-1)} aria-label="Previous month"><ChevronLeftRoundedIcon /></IconButton>
              <Chip icon={<CalendarMonthRoundedIcon />} label={headerMonth} variant="outlined" sx={{ minWidth: { xs: 145, sm: 174 } }} />
              <IconButton onClick={() => moveMonth(1)} aria-label="Next month"><ChevronRightRoundedIcon /></IconButton>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Box
        ref={stripRef}
        sx={{
          display: "flex", gap: 0.8, overflowX: "auto", pb: 1.2, mb: 1.1,
          scrollSnapType: "x proximity", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {monthDays.map((d, idx) => {
          const key = dateKeyFromDate(d);
          const count = (eventsMap.get(key) || []).length;
          return (
            <Box key={key} data-idx={idx} sx={{ scrollSnapAlign: "center" }}>
              <DayPill d={d} selected={key === selectedKey} count={count} onClick={() => setSelectedDate(d)} />
            </Box>
          );
        })}
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.72fr) minmax(320px, .78fr)" }, gap: { xs: 1.5, sm: 2 } }}>
        <Stack spacing={1.5}>
          <Card variant="outlined" sx={{ borderRadius: 0}}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2.25 } }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} sx={{ mb: 1.4 }}>
                <Box>
                  <Typography variant="overline" sx={{ color: "text.secondary", letterSpacing: 1.2 }}>SELECTED DAY</Typography>
                  <Typography variant="h5" sx={{ mt: -0.4 }}>{selectedLabel}</Typography>
                </Box>
                <Chip
                  icon={<SportsBasketballRoundedIcon />}
                  label={loading ? "Loading" : `${selectedGames.length} game${selectedGames.length === 1 ? "" : "s"}`}
                  variant="outlined"
                />
              </Stack>
              <Divider sx={{ mb: 1.5 }} />

              {loading ? (
                <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 220 }} spacing={1}>
                  <CircularProgress size={24} />
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>Loading public NBA schedule…</Typography>
                </Stack>
              ) : selectedGames.length ? (
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: selectedGames.length > 1 ? "repeat(2, minmax(0, 1fr))" : "1fr" }, gap: 1.2 }}>
                  {selectedGames.map((game) => <GameCard key={game.id || `${game.dateKey}-${game.away?.code}-${game.home?.code}`} game={game} onPick={() => openCompare(game)} />)}
                </Box>
              ) : (
                <Box sx={{ py: { xs: 4, sm: 6 }, textAlign: "center" }}>
                  <SportsBasketballRoundedIcon sx={{ fontSize: 42, color: "text.disabled", mb: 1 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>No games on this date</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary", maxWidth: 500, mx: "auto", mt: 0.5 }}>
                    {viewedOffseason
                      ? "This date falls in the NBA offseason. Move to October to browse the new season schedule."
                      : "Try another day in the rail above or move to a different month."}
                  </Typography>
                  {viewedOffseason && <Button onClick={jumpOctober} variant="outlined" size="small" sx={{ mt: 1.5 }}>October schedule</Button>}
                </Box>
              )}

              {loadErr && (
                <Typography variant="caption" sx={{ color: "warning.main", mt: 1.25, display: "block" }}>
                  Schedule source error: {loadErr}
                </Typography>
              )}
            </CardContent>
          </Card>

          {!loading && !monthHasGames && (
            <Card variant="outlined" sx={{ borderRadius: 0}}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                  {viewedOffseason ? `${headerMonth} is in the offseason` : `No NBA games listed for ${headerMonth}`}
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                  {viewedOffseason
                    ? "That empty calendar is expected—not a data failure. PIVT keeps news and historical matchup context available while the regular season is idle."
                    : "The public schedule returned no games for this month. Use the month controls above to continue browsing."}
                </Typography>
              </CardContent>
            </Card>
          )}
        </Stack>

        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
          <LeagueStatus currentOffseason={currentOffseason} onJumpOctober={jumpOctober} />
          <NbaNews compact />
          <HaikuOfTheDay compact look="typewriter" />
        </Stack>
      </Box>

      <ComparisonDrawer open={compareOpen} onClose={() => setCompareOpen(false)} game={compareGame} />

      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={0.5} sx={{ py: 3, color: "text.secondary" }}>
        <Typography variant="caption">PIVT · NBA schedule, scores and recent form</Typography>
        <Typography variant="caption">Public-source data · no login required</Typography>
      </Stack>
    </Box>
  );
}
