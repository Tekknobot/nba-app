// src/components/AllGamesCalendar.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Card, CardContent, Chip, IconButton, Stack, Typography,
  Drawer, Divider, List, ListItem, ListItemText, Button,
  CircularProgress, Tooltip, ListItemButton, Avatar
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import "@fontsource/bebas-neue";

import SportsBasketballIcon from "@mui/icons-material/SportsBasketball";
import GameComparePanel from "./GameComparePanel";

import { formatGameLabel } from "../utils/datetime";
import NbaNews from "./NbaNews";

import Link from "@mui/material/Link";
import ArrowRightAltIcon from "@mui/icons-material/ArrowRightAlt";
import { Link as RouterLink } from "react-router-dom";

import HaikuOfTheDay from "./HaikuOfTheDay";

// Rough NBA calendar: regular season runs Oct–Jun; offseason Jul–Sep
function isOffseasonMonth(d = new Date()) {
  const m = d.getMonth(); // 0..11
  return m >= 6 && m <= 8; // Jul (6), Aug (7), Sep (8)
}

// Does the eventsMap have any games at all this month?
function mapHasAnyGames(map) {
  for (const arr of map.values()) {
    if (Array.isArray(arr) && arr.length) return true;
  }
  return false;
}

/* ========= small date helpers ========= */
function firstOfMonth(d){ const x=new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; }
function addMonths(d,n){ const x=new Date(d); x.setDate(1); x.setMonth(x.getMonth()+n); return x; }
function dateKeyFromDate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function daysInMonth(year, month){ const out=[]; const d=new Date(year,month,1); while(d.getMonth()===month){ out.push(new Date(d)); d.setDate(d.getDate()+1); } return out; }

/* ========= keyless month schedule fetch ========= */
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

/* ========= Drawer (uses shared panel) ========= */
function ComparisonDrawer({ open, onClose, game }) {
  if (!open || !game) return null;
  return (
    <Drawer
      anchor="right" open={open} onClose={onClose}
      PaperProps={{ sx:{ width:{ xs:'100%', sm:620 }, p:2, borderTopLeftRadius:{ xs:1, sm:0 }, display:'flex', flexDirection:'column', height:'100vh', boxSizing:'border-box' } }}
    >
      {/* header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb:2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight:700 }}>
          Recent form — {game?.away?.code} @ {game?.home?.code}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton onClick={onClose}><CloseIcon /></IconButton>
        </Stack>
      </Stack>

      <Divider sx={{ mb:1 }} />

      {/* body */}
      <Box sx={{ flex:1, minHeight:0, overflow:'auto', pr:0.5 }}>
        <Typography variant="caption" sx={{ opacity:0.8, mb:1, display:'block' }}>
          Clicked game: {game?.away?.name} at {game?.home?.name}
        </Typography>
        <GameComparePanel game={game} />
      </Box>

      {/* footer */}
      <Box sx={{ position:'sticky', bottom:0, pt:1.5, background:(t)=>`linear-gradient(180deg, ${t.palette.background.default}00, ${t.palette.background.default} 40%)` }}>
        <Tooltip title="Close">
          <Button variant="contained" onClick={onClose} fullWidth>Close</Button>
        </Tooltip>
      </Box>
    </Drawer>
  );
}

/* ========= Agenda card ========= */
function isFinal(game){ return (game?.status || "").toLowerCase().includes("final"); }
function resultMeta(game){
  if (!isFinal(game)) return null;
  const home = game.home?.code || "HOME";
  const away = game.away?.code || "AWAY";
  const hs = Number(game.homeScore ?? 0);
  const as = Number(game.awayScore ?? 0);
  const homeWon = hs > as;
  const winnerTeam = homeWon ? home : away;
  const loserTeam  = homeWon ? away : home;
  const winnerPts  = homeWon ? hs   : as;
  const loserPts   = homeWon ? as   : hs;
  return { lines:[`${winnerTeam} ${winnerPts}`, `${loserTeam} ${loserPts}`], homeWon };
}

function GameCard({ game, onPick }) {
  const final = resultMeta(game);
  const isLive = /in progress|halftime|end of|quarter|q\d/i.test((game?.status || "").toLowerCase());
  const titleCodes = `${game.away.code} @ ${game.home.code}`;
  const subLine = `${game.away.name} at ${game.home.name}`;

  // Short live status like "End Q3"
  const liveStatusLabel = (() => {
    const s = String(game?.status || "");
    const m = s.match(/end of\s*(\d)/i);
    if (m) return `End Q${m[1]}`;
    return s;
  })();

  // Small animated dot for "Live"
  const LiveDot = (
    <Box
      sx={{
        width: 8, height: 8, borderRadius: '50%',
        bgcolor: 'warning.main',
        '@keyframes pulse': { '0%': { transform:'scale(1)' }, '50%': { transform:'scale(1.4)' }, '100%': { transform:'scale(1)' } },
        animation: 'pulse 1.3s ease-in-out infinite'
      }}
    />
  );

  // trailing status cluster (right side)
  const RightStatus = final ? (
    <Stack direction="column" spacing={0.25} sx={{ alignItems: 'flex-end', flexShrink: 0 }}>
      <Chip size="small" color="success" label="Final" sx={{ height: 22 }} />
      <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
        {final.lines[0]}
      </Typography>
      <Typography variant="body2" sx={{ opacity: 0.9, lineHeight: 1.1 }}>
        {final.lines[1]}
      </Typography>
      {(() => {
        const v = modelVerdict(game);
        if (!v) return null;
        return v.state === "correct" ? (
          <Tooltip title={v.tooltip}>
            <Chip size="small" color="success" variant="outlined" icon={<CheckCircleIcon fontSize="small" />} label="Model" sx={{ mt: 0.25 }} />
          </Tooltip>
        ) : (
          <Tooltip title={v.tooltip}>
            <Chip size="small" color="error" variant="outlined" icon={<CancelIcon fontSize="small" />} label="Model" sx={{ mt: 0.25 }} />
          </Tooltip>
        );
      })()}
    </Stack>
  ) : isLive ? (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexShrink: 0 }}>
      {LiveDot}
      <Chip size="small" color="warning" label="Live" sx={{ height: 22 }} />
      <Chip
        size="small"
        variant="outlined"
        label={`${game.home.code} ${game.homeScore ?? "–"} — ${game.away.code} ${game.awayScore ?? "–"}`}
        sx={{ height: 22, display: { xs: 'none', sm: 'inline-flex' } }}
      />
      <Chip size="small" variant="outlined" label={liveStatusLabel} sx={{ height: 22 }} />
    </Stack>
  ) : (
    <Chip
      size="small"
      variant="outlined"
      sx={{ flexShrink: 0, height: 22 }}
      label={
        game?.hasClock
          ? formatGameLabel(game._iso, { mode: "ET", withTZ: true })
          : new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" })
              .format(new Date(`${game.dateKey}T12:00:00Z`))
      }
    />
  );

  return (
    <Card variant="outlined" sx={{ borderRadius: 1 }}>
      <ListItemButton
        onClick={onPick}
        sx={{
          borderRadius: 1,
          px: 1,
          py: 1,
          minHeight: 64,                 // comfy tap target
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ width: "100%" }}>
          {/* Compact home badge */}
          <Avatar
            sx={{
              width: 34, height: 34, fontSize: 12,
              bgcolor: "primary.main",
              color: "primary.contrastText",
              flexShrink: 0,
            }}
            aria-label={`Home team ${game.home.code}`}
          >
            {game.home.code}
          </Avatar>

          {/* Main text block */}
          <Box sx={{ flex: "1 1 auto", minWidth: 0 }}>
            {/* Top line: codes or bolded winner on final */}
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                display: "block",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              aria-label={`${game.away.code} at ${game.home.code}`}
            >
              {final ? (
                <>
                  <Box component="span" sx={{ fontWeight: final.homeWon ? 800 : 600 }}>{game.home.code}</Box>
                  <Box component="span" sx={{ mx: 0.5, opacity: 0.7 }}>vs</Box>
                  <Box component="span" sx={{ fontWeight: !final.homeWon ? 800 : 600 }}>{game.away.code}</Box>
                </>
              ) : (
                titleCodes
              )}
            </Typography>

            {/* Second line: long names (2-line clamp) */}
            <Typography
              variant="caption"
              sx={{
                opacity: 0.8,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                whiteSpace: "normal",
              }}
              aria-label={subLine}
            >
              {subLine}
            </Typography>

            {/* Third line (only on mobile, when live) — compact score */}
            {isLive && (
              <Typography
                variant="caption"
                sx={{ mt: 0.25, display: { xs: 'block', sm: 'none' }, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
              >
                {`${game.home.code} ${game.homeScore ?? "–"} — ${game.away.code} ${game.awayScore ?? "–"} · ${liveStatusLabel}`}
              </Typography>
            )}
          </Box>

          {/* Right-side status cluster */}
          {RightStatus}
        </Stack>
      </ListItemButton>
    </Card>
  );
}


/* ========= Main Mobile Calendar ========= */
export default function AllGamesCalendar(){
  const [allGames,setAllGames]=useState([]);
  const [viewMonth,setViewMonth]=useState(firstOfMonth(new Date()));
  const [selectedDate,setSelectedDate]=useState(new Date());
  const [loadErr,setLoadErr]=useState(null);
  const [loading,setLoading]=useState(true);

  const [compareGame,setCompareGame]=useState(null);
  const [compareOpen,setCompareOpen]=useState(false);

  const [monthCache, setMonthCache] = useState(new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const y = viewMonth.getFullYear();
        const mIdx = viewMonth.getMonth();
        const m = String(mIdx + 1).padStart(2, '0');
        const monthKey = `${y}-${m}`;

        if (monthCache.has(monthKey)) {
          if (!cancelled) {
            setAllGames(monthCache.get(monthKey));
            setLoadErr(null);
            setLoading(false);
          }
          return;
        }

        const rows = await fetchMonthSchedulePublic(y, mIdx);
        if (cancelled) return;

        const next = new Map(monthCache);
        next.set(monthKey, rows);
        setMonthCache(next);
        setAllGames(rows);
        setLoadErr(null);
      } catch (e) {
        if (!cancelled){ setLoadErr(e?.message || String(e)); setAllGames([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return ()=>{ cancelled=true; };
  }, [viewMonth, monthCache]);

  function bucketByDayAll(games){
    const m = new Map();
    for (const g of games || []) {
      const k = g?.dateKey; if (!k) continue;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(g);
    }
    for (const arr of m.values()) {
      arr.sort((a,b)=> String(a._iso||"").localeCompare(String(b._iso||"")) || String(a.home?.name||"").localeCompare(String(b.home?.name||"")));
    }
    return m;
  }

  const monthDays = useMemo(()=> daysInMonth(viewMonth.getFullYear(), viewMonth.getMonth()), [viewMonth]);
  const eventsMap = useMemo(()=>{
    const y = viewMonth.getFullYear(); const m = String(viewMonth.getMonth()+1).padStart(2,'0');
    const monthKey = `${y}-${m}`;
    const monthGames = allGames.filter(g => (g.dateKey||'').startsWith(monthKey));
    return bucketByDayAll(monthGames);
  }, [allGames, viewMonth]);

  const monthHasGames = useMemo(() => mapHasAnyGames(eventsMap), [eventsMap]);
  const inOffseasonView = isOffseasonMonth(viewMonth);

  const selectedKey = dateKeyFromDate(selectedDate);
  const selectedGames = eventsMap.get(selectedKey) || [];

  const stripRef = useRef(null);
  useEffect(()=>{
    const idx = monthDays.findIndex(d => dateKeyFromDate(d)===selectedKey);
    if (idx>=0 && stripRef.current) {
      const el = stripRef.current.querySelector(`[data-idx="${idx}"]`);
      if (el) el.scrollIntoView({ inline:'center', behavior:'smooth', block:'nearest' });
    }
  }, [selectedKey, monthDays]);

  const headerMonth = viewMonth.toLocaleDateString(undefined,{ month:'long', year:'numeric' });
  function openCompare(game){ setCompareGame(game); setCompareOpen(true); }

  return (
    <Box sx={{ mx:'auto', width:'100%', maxWidth: 720, px:{ xs:1, sm:1.5 }, py:1.5 }}>
      {/* 👇 Intro/Explainer card goes here */}
      <Card variant="outlined" sx={{ borderRadius: 1, mb: 2 }}>
        <CardContent sx={{ p: 2 }}>
          <Typography component="h1" variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
            NBA Calendar & Matchup Helper
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            Browse the NBA schedule month by month, tap on any game to see both teams’ recent
            form, head-to-head history, player stat snapshots, and quick matchup notes.
            It’s built to be clean, mobile-friendly, and fun to explore.
          </Typography>
        </CardContent>
      </Card>

      {/* header */}
      <Box
        sx={{
          position: 'sticky',
          top: { xs: 56, sm: 64 },                 // offset for fixed AppBar (Toolbar height)
          zIndex: (t) => t.zIndex.appBar - 1,      // stay under the site header
          bgcolor: 'background.default',
          pt: 1,
          pb: 1,
          borderBottom: 1,
          borderColor: 'divider',
          backdropFilter: 'saturate(180%) blur(8px)', // subtle glassy feel (optional)
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5 }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
            <Box sx={{ lineHeight: 1 }}>
              <Typography
                variant="h6"
                sx={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: { xs: 26, sm: 32 }, letterSpacing: 1, fontWeight: 400 }}
              />
              <Typography
                variant="caption"
                sx={{ opacity: 0.75, display: 'block', mt: -0.25, maxWidth: 280, whiteSpace: 'normal', wordBreak: 'break-word' }}
              >
                NBA <SportsBasketballIcon fontSize="small" sx={{ verticalAlign: 'middle' }} />
              </Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ opacity: 0.2 }} />
            <Stack direction="row" spacing={1} alignItems="center">
              <CalendarMonthIcon fontSize="small" />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
                {headerMonth}
              </Typography>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0, alignSelf: 'center' }}>
            <IconButton
              size="small"
              onClick={() => {
                const n = addMonths(viewMonth, -1);
                setViewMonth(n);
                setSelectedDate(n);
              }}
            >
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => {
                const n = addMonths(viewMonth, 1);
                setViewMonth(n);
                setSelectedDate(n);
              }}
            >
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
      </Box>

      {/* Offseason / empty-month fallback (always real content for AdSense) */}
      {!loading && !monthHasGames && (
        <Card variant="outlined" sx={{ borderRadius: 1, mb: 2 }}>
          <CardContent sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
              {inOffseasonView ? "We’re between seasons" : "No games in this month"}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
              {inOffseasonView
                ? "The NBA regular season begins in October. Until tip-off, you can still read the latest news and browse previous matchup context."
                : "There aren’t any scheduled games in this month’s view. Try the arrows to switch months, or explore the latest NBA news below."}
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                component={RouterLink}
                to="/about"
                variant="outlined"
                size="small"
              >
                About PIVT
              </Button>
              <Button
                href="https://www.nba.com/news"
                target="_blank"
                rel="noopener"
                variant="outlined"
                size="small"
              >
                Latest NBA headlines
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* day strip */}
      <Box ref={stripRef} sx={{ mt: 1.5, display:'flex', gap:1, overflowX:'auto', pb:1, "&::-webkit-scrollbar": { display:'none' } }}>
        {monthDays.map((d, idx)=>{
          const key = dateKeyFromDate(d);
          const count = (eventsMap.get(key) || []).length;
          const selected = key===selectedKey;
          return (
            <Box key={key} data-idx={idx} sx={{ flex:'0 0 auto' }}>
              <DayPill d={d} selected={selected} count={count} onClick={()=> setSelectedDate(d)} />
            </Box>
          );
        })}
      </Box>

      {/* agenda */}
      <Card variant="outlined" sx={{ borderRadius:1 }}>
        <CardContent sx={{ p:1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight:700, mb:1 }}>
            {selectedDate.toLocaleDateString(undefined,{ weekday:'long', month:'short', day:'numeric' })}
          </Typography>

          {loading ? (
            <Stack alignItems="center" sx={{ py:3 }}><CircularProgress size={22} /></Stack>
          ) : selectedGames.length ? (
            <Stack spacing={1}>
              {selectedGames.map((g, i)=>(
                <GameCard key={i} game={g} onPick={()=> openCompare(g)} />
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ opacity:0.7 }}>No games today.</Typography>
          )}

          {loadErr && (
            <Typography variant="caption" sx={{ color:'warning.main', mt:1, display:'block' }}>
              Load error: {loadErr}
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* drawer */}
      <ComparisonDrawer open={compareOpen} onClose={()=> setCompareOpen(false)} game={compareGame} />

      {/* 👇 Daily original content */}
      <Box sx={{ mt: 2 }}>
        <HaikuOfTheDay compact look="typewriter" />
      </Box>
      
      {/* news */}
      <NbaNews />
    </Box>
  );
}

/* ========= Day pill ========= */
function DayPill({ d, selected, count, onClick }) {
  const dow = d.toLocaleDateString(undefined,{ weekday:'short' });
  const day = d.getDate();
  const isToday = dateKeyFromDate(new Date()) === dateKeyFromDate(d);

  return (
    <Button
      onClick={onClick}
      variant={selected ? "contained" : "outlined"}
      size="large"
      aria-label={`${dow} ${day}, ${count || 0} games`}
      sx={{
        borderRadius: 1, minWidth: 96, height: 88, px: 1.25, py: 0.75,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        bgcolor: selected ? 'primary.main' : 'background.paper',
        color: selected ? 'primary.contrastText' : 'text.primary',
        borderColor: selected ? 'primary.main' : 'divider',
        boxShadow: selected ? 2 : 0, transition:'transform 80ms ease, box-shadow 120ms ease',
        '&:hover': { transform: 'translateY(-1px)' }, '&:active': { transform: 'translateY(0px)' }
      }}
    >
      <Typography variant="caption" sx={{ opacity: 0.85, lineHeight: 1 }}>
        {dow}{isToday && !selected ? ' •' : ''}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1, mt: 0.25 }}>
        {String(day).padStart(2,'0')}
      </Typography>
      <Chip size="small" label={count ? `${count} game${count>1?'s':''}` : '0'}
        color={count ? 'secondary' : 'default'}
        variant={selected ? 'filled' : 'outlined'}
        sx={{ mt: 0.9, height: 20, borderRadius: 0.75, '& .MuiChip-label': { px: 0.8, fontSize: 11, fontWeight: 700 } }}
      />
    </Button>
  );
}
