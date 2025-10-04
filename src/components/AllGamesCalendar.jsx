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

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

import SportsBasketballIcon from "@mui/icons-material/SportsBasketball";
import GameComparePanel from "./GameComparePanel";

import { formatGameLabel } from "../utils/datetime";
import NbaNews from "./NbaNews";
import { API_BASE } from "../api/base";

import Link from "@mui/material/Link";
import ArrowRightAltIcon from "@mui/icons-material/ArrowRightAlt";
import { Link as RouterLink } from "react-router-dom";

/* ========= small date helpers ========= */
function firstOfMonth(d){ const x=new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; }
function addMonths(d,n){ const x=new Date(d); x.setDate(1); x.setMonth(x.getMonth()+n); return x; }
function dateKeyFromDate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function daysInMonth(year, month){ const out=[]; const d=new Date(year,month,1); while(d.getMonth()===month){ out.push(new Date(d)); d.setDate(d.getDate()+1); } return out; }

/* ========= team code lookup for schedule ========= */
const TEAM_CODE = {
  "Atlanta Hawks":"ATL","Boston Celtics":"BOS","Brooklyn Nets":"BKN","Charlotte Hornets":"CHA","Chicago Bulls":"CHI",
  "Cleveland Cavaliers":"CLE","Dallas Mavericks":"DAL","Denver Nuggets":"DEN","Detroit Pistons":"DET","Golden State Warriors":"GSW",
  "Houston Rockets":"HOU","Indiana Pacers":"IND","LA Clippers":"LAC","Los Angeles Lakers":"LAL","Memphis Grizzlies":"MEM",
  "Miami Heat":"MIA","Milwaukee Bucks":"MIL","Minnesota Timberwolves":"MIN","New Orleans Pelicans":"NOP","New York Knicks":"NYK",
  "Oklahoma City Thunder":"OKC","Orlando Magic":"ORL","Philadelphia 76ers":"PHI","Phoenix Suns":"PHX","Portland Trail Blazers":"POR",
  "Sacramento Kings":"SAC","San Antonio Spurs":"SAS","Toronto Raptors":"TOR","Utah Jazz":"UTA","Washington Wizards":"WAS"
};

/* ========= predictions attach/merge ========= */
function norm(s) { return String(s || "").trim().toUpperCase(); }
function codeOfTeam(t) { if (!t) return ""; if (typeof t === "string") return norm(t); return norm(t.code || t.abbr || t.abbreviation || t.name); }
function nameOfTeam(t) { if (!t) return ""; if (typeof t === "string") return norm(t); return norm(t.name || t.full_name || t.team || t.code || t.abbr || t.abbreviation); }
function keyVariants(dateKey, away, home) {
  const d = norm(dateKey); const A = codeOfTeam(away), H = codeOfTeam(home); const An = nameOfTeam(away), Hn = nameOfTeam(home);
  return [`${d}|${A}@${H}`,`${d}|${H}vs${A}`,`${d}|${H}@${A}`,`${d}|${An}@${Hn}`,`${d}|${Hn}@${An}`,`${d}|${A}|${H}`,`${d}|${H}|${A}`];
}
async function fetchPredictionsRange(startISO, endISO) {
  const base = (typeof API_BASE === "string" && API_BASE) ? API_BASE : "";
  if (base) {
    try {
      const url = `${base}/api/predictions?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        if (j && (Array.isArray(j) || typeof j === "object")) return j;
      }
    } catch {}
  }
  try {
    const monthKey = (startISO || "").slice(0, 7);
    const local = localStorage.getItem(`preds:${monthKey}`);
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && (Array.isArray(parsed) || typeof parsed === "object")) return parsed;
    }
  } catch {}
  return {};
}
function resolveFromContainer(container, dateKey, away, home) {
  if (container && !Array.isArray(container)) {
    for (const k of keyVariants(dateKey, away, home)) { const v = container[k]; if (v) return v; }
  }
  if (Array.isArray(container)) {
    for (const item of container) {
      const d  = norm(item.date || item.gameDate || item.d);
      const aw = norm(item.away || item.awayCode || item.visitor || item.v);
      const hm = norm(item.home || item.homeCode || item.h);
      if (d !== norm(dateKey)) continue;
      const codesMatch =
        (aw === codeOfTeam(away) || aw === nameOfTeam(away)) &&
        (hm === codeOfTeam(home) || hm === nameOfTeam(home));
      const swappedMatch =
        (aw === codeOfTeam(home) || aw === nameOfTeam(home)) &&
        (hm === codeOfTeam(away) || hm === nameOfTeam(away));
      if (codesMatch || swappedMatch) return item;
    }
  }
  return null;
}
async function attachPredictionsForMonth(rows) {
  if (!rows?.length) return rows;
  const startISO = rows[0].dateKey;
  const endISO   = rows[rows.length - 1].dateKey;
  const container = await fetchPredictionsRange(startISO, endISO);
  for (const r of rows) {
    const found = resolveFromContainer(container, r.dateKey, r.away, r.home);
    if (!found) continue;
    let pick = found.pick || found.winner || found.predictedWinner || found.pred;
    if (pick) {
      const p = String(pick).trim().toUpperCase();
      if (p === "HOME") pick = r.home?.code;
      else if (p === "AWAY") pick = r.away?.code;
      r.model = { ...(r.model || {}), predictedWinner: norm(pick) };
    }
    const phRaw = found.pHome ?? found.p_home ?? found.homeProb ?? found.probHome ?? found.prob_home;
    const ph = Number(phRaw);
    if (Number.isFinite(ph)) {
      r.model = { ...(r.model || {}), pHome: ph };
    }
  }
  return rows;
}

/* ========= month schedule fetch ========= */
function monthRange(year, month){ const start = new Date(year, month, 1); const end = new Date(year, month + 1, 0);
  const fmt = (d)=> `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return { start: fmt(start), end: fmt(end) };
}
function bdlHeaders() { const key = process.env.REACT_APP_BDL_API_KEY; return key ? { Authorization: key } : {}; }
async function fetchMonthScheduleBDL(year, month) {
  const { start, end } = monthRange(year, month);
  const headers = bdlHeaders();
  const per_page = 100;
  let page = 1;
  const byId = new Map();
  while (true) {
    const params = new URLSearchParams({ start_date: start, end_date: end, per_page: String(per_page), page: String(page) });
    const url = `https://api.balldontlie.io/v1/games?${params.toString()}`;
    const res = await fetch(url, { headers });
    if (res.status === 401) throw new Error("BDL 401 (missing/invalid API key). Add REACT_APP_BDL_API_KEY in .env.local and restart.");
    if (!res.ok) throw new Error(`BDL HTTP ${res.status}`);
    const json = await res.json();
    const data = Array.isArray(json?.data) ? json.data : [];
    const nextPage = json?.meta?.next_page || null;

    for (const g of data) {
      if (g?.postseason) continue;
      const dateISO = (g?.date || "").slice(0, 10);
      if (!dateISO) continue;

      const homeName = g?.home_team?.full_name || g?.home_team?.name || g?.home_team?.abbreviation;
      const awayName = g?.visitor_team?.full_name || g?.visitor_team?.name || g?.visitor_team?.abbreviation;
      if (!homeName || !awayName) continue;

      const raw = g?.date ? new Date(g.date) : null;
      const hasClock = !!(raw && !Number.isNaN(raw.getTime()) && raw.getUTCHours() !== 0);
      const isoFull = hasClock ? raw.toISOString() : `${dateISO}T12:00:00Z`;

      byId.set(g.id, {
        id: g.id,
        _iso: isoFull,
        dateKey: dateISO,
        status: g?.status || "Scheduled",
        hasClock,
        homeScore: Number.isFinite(g?.home_team_score) ? g.home_team_score : null,
        awayScore: Number.isFinite(g?.visitor_team_score) ? g.visitor_team_score : null,
        et: (g?.status || "").toLowerCase().includes("scheduled") ? "TBD" : (g?.status || "TBD"),
        seasonStageId: 2,
        home: { name: homeName, code: TEAM_CODE[homeName] || (g?.home_team?.abbreviation || homeName) },
        away: { name: awayName, code: TEAM_CODE[awayName] || (g?.visitor_team?.abbreviation || awayName) },
      });
    }

    if (!nextPage) break;
    page = nextPage;
  }

  const rows = Array.from(byId.values());
  rows.sort((a, b) =>
    (a._iso || "").localeCompare(b._iso || "") ||
    (a.home?.name || "").localeCompare(b.home?.name || "")
  );
  return rows;
}

/* ========= verdict helpers (for drawer header & game cards) ========= */
function codeify(teamObjOrStr, fallback = '') {
  if (!teamObjOrStr) return fallback;
  if (typeof teamObjOrStr === 'string') return teamObjOrStr.toUpperCase();
  return (teamObjOrStr.code || teamObjOrStr.abbr || teamObjOrStr.name || fallback).toUpperCase();
}
function getPredictedWinnerCode(game) {
  const homeCode = codeify(game?.home, null);
  const awayCode = codeify(game?.away, null);
  const stringPickCandidates = [
    game?.model?.predictedWinner, game?.model?.winner, game?.prediction?.winner,
    game?.prediction?.predictedWinner, game?.predictedWinner, game?.predictedWinnerCode, game?.odds?.modelPick,
  ];
  for (const c of stringPickCandidates) {
    if (!c) continue;
    const raw = String(typeof c === "string" ? c : (c.code || c.abbr || c.name || "")).toUpperCase().trim();
    if (raw === "HOME" && homeCode) return homeCode;
    if (raw === "AWAY" && awayCode) return awayCode;
    const code = codeify(raw, null);
    if (code) return code;
  }
  const pHome = Number(game?.model?.pHome);
  if (Number.isFinite(pHome) && homeCode && awayCode) return pHome > 0.5 ? homeCode : awayCode;
  return null;
}
function getActualWinnerCode(game) {
  const home = codeify(game?.home, 'HOME');
  const away = codeify(game?.away, 'AWAY');
  const hs = Number(game?.homeScore ?? NaN);
  const as = Number(game?.awayScore ?? NaN);
  if (Number.isNaN(hs) || Number.isNaN(as)) return null;
  if (hs === as) return 'TIE';
  return hs > as ? home : away;
}
function modelVerdict(game) {
  const isFinal = (game?.status || '').toLowerCase().includes('final');
  if (!isFinal) return null;
  const actual = getActualWinnerCode(game);
  const predicted = getPredictedWinnerCode(game);
  if (!actual || !predicted || actual === 'TIE') return null;
  const pHome = Number(game?.model?.pHome);
  const pct = Number.isFinite(pHome) ? Math.round(pHome * 100) : null;
  return {
    state: actual === predicted ? 'correct' : 'incorrect',
    tooltip: pct != null ? `Predicted ${predicted} (${pct}%), actual ${actual}` : `Predicted ${predicted}, actual ${actual}`,
  };
}
function headerVerdict(game) { return modelVerdict(game); }

/* ========= Drawer (uses shared panel) ========= */
function ComparisonDrawer({ open, onClose, game }) {
  if (!open || !game) return null;
  const verdict = headerVerdict(game);

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
          {verdict && (verdict.state === "correct"
            ? <Tooltip title={verdict.tooltip}><Chip size="small" color="success" variant="outlined" icon={<CheckCircleIcon fontSize="small" />} label="Model" /></Tooltip>
            : <Tooltip title={verdict.tooltip}><Chip size="small" color="error" variant="outlined" icon={<CancelIcon fontSize="small" />} label="Model" /></Tooltip>
          )}
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
  const vsLabel = `${game.away.code} @ ${game.home.code}`;
  const sub = `${game.away.name} at ${game.home.name}`;
  const final = resultMeta(game);
  const isLive = /in progress|halftime|end of|quarter|q\d/i.test((game?.status || "").toLowerCase());

  const liveStatusLabel = (() => {
    const s = String(game?.status || "");
    const m = s.match(/end of\s*(\d)/i);
    if (m) return `End Q${m[1]}`;
    return s;
  })();

  return (
    <Card variant="outlined" sx={{ borderRadius: 1 }}>
      <ListItemButton onClick={onPick} sx={{ borderRadius:1, "&:hover": { bgcolor: "rgba(25,118,210,0.06)" } }}>
        <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ width: "100%" }}>
          <Avatar sx={{ width:30, height:30, fontSize:12, bgcolor:"primary.main", color:"primary.contrastText" }}>
            {game.home.code}
          </Avatar>

          <Box sx={{ flex:"1 1 auto", minWidth:0 }}>
            <Typography variant="body2" sx={{ fontWeight:700, wordBreak:"break-word", overflow:"hidden", display:"-webkit-box", WebkitLineClamp:1, WebkitBoxOrient:"vertical" }}>
              {final ? (
                <>
                  <span style={{ fontWeight: final.homeWon ? 800 : 600 }}>{game.home.code}</span>
                  {" vs "}
                  <span style={{ fontWeight: !final.homeWon ? 800 : 600 }}>{game.away.code}</span>
                </>
              ) : vsLabel}
            </Typography>
            <Typography variant="caption" sx={{ opacity:0.8, wordBreak:"break-word", whiteSpace:"normal", overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>
              {sub}
            </Typography>
          </Box>

          {final ? (
            <Stack direction="row" spacing={1} sx={{ flexShrink:0, alignItems:"flex-start" }}>
              <Chip size="small" color="success" label="Final" />
              <Box sx={{ display:"flex", flexDirection:"column", alignItems:"flex-end", lineHeight:1.15 }} aria-label="Final score">
                <Typography variant="body2" sx={{ fontWeight:700 }}>{final.lines[0]}</Typography>
                <Typography variant="body2" sx={{ opacity:0.9 }}>{final.lines[1]}</Typography>
              </Box>
              {(() => {
                const v = modelVerdict(game);
                if (!v) return null;
                return v.state === "correct"
                  ? <Tooltip title={v.tooltip}><Chip size="small" color="success" variant="outlined" icon={<CheckCircleIcon fontSize="small" />} label="Model" sx={{ ml:0.5 }} /></Tooltip>
                  : <Tooltip title={v.tooltip}><Chip size="small" color="error" variant="outlined" icon={<CancelIcon fontSize="small" />} label="Model" sx={{ ml:0.5 }} /></Tooltip>;
              })()}
            </Stack>
          ) : isLive ? (
            <Stack direction="row" spacing={1} sx={{ flexShrink:0, alignItems:"center" }}>
              <Chip size="small" color="warning" label="Live" />
              <Chip size="small" variant="outlined" label={`${game.home.code} ${game.homeScore ?? "–"} — ${game.away.code} ${game.awayScore ?? "–"}`} />
              <Chip size="small" variant="outlined" label={liveStatusLabel} />
            </Stack>
          ) : (
            <Chip size="small" variant="outlined" sx={{ flexShrink:0, maxWidth:"50vw", alignSelf:"center" }}
              label={game?.hasClock
                ? formatGameLabel(game._iso, { mode:"ET", withTZ:true })
                : new Intl.DateTimeFormat(undefined, { weekday:"short", month:"short", day:"numeric" }).format(new Date(`${game.dateKey}T12:00:00Z`))
              }
            />
          )}
        </Stack>

        <Stack direction="row" alignItems="center" justifyContent="center" sx={{ mt:0.5, pl:2 }}>
          <Link component={RouterLink} to={`/game/${game.id}`} underline="hover" color="primary"
            sx={{ fontSize:12, fontWeight:600, display:"inline-flex", alignItems:"center", gap:0.5, px:1, py:0.25, borderRadius:1, transition:"background-color 120ms ease",
              "&:hover": { bgcolor:"action.hover" },
              "&:focus-visible": { outline:"2px solid", outlineColor:"primary.main", outlineOffset:2, borderRadius:4 },
            }}
          >
            Full game page
            <ArrowRightAltIcon sx={{ fontSize: 14, ml: 0.25 }} />
          </Link>
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

        let rows = await fetchMonthScheduleBDL(y, mIdx);
        try {
          rows = await attachPredictionsForMonth(rows);
          console.log('[predictions]', { monthKey, rowsWithModel: rows.filter(r => r.model && (r.model.predictedWinner || Number.isFinite(r.model.pHome))).length });
        } catch {}
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
      {/* header */}
      <Box sx={{ position:'sticky', top:0, zIndex:(t)=>t.zIndex.appBar, bgcolor:'background.default', pt:1, pb:1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px:1.5 }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth:0 }}>
            <Box sx={{ lineHeight: 1 }}>
              <Typography variant="h6" sx={{ fontFamily:'"Bebas Neue", sans-serif', fontSize:{ xs:26, sm:32 }, letterSpacing:1, fontWeight:400 }} />
              <Typography variant="caption" sx={{ opacity:0.75, display:'block', mt:-0.25, maxWidth:280, whiteSpace:'normal', wordBreak:'break-word' }}>
                NBA <SportsBasketballIcon fontSize="small" sx={{ verticalAlign:"middle" }} />
              </Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ opacity:0.2 }} />
            <Stack direction="row" spacing={1} alignItems="center">
              <CalendarMonthIcon fontSize="small" />
              <Typography variant="subtitle1" sx={{ fontWeight:700 }} noWrap>{headerMonth}</Typography>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0, alignSelf: 'center' }}>
            <IconButton size="small" onClick={()=>{ const n=addMonths(viewMonth,-1); setViewMonth(n); setSelectedDate(n); }}><ChevronLeftIcon fontSize="small" /></IconButton>
            <IconButton size="small" onClick={()=>{ const n=addMonths(viewMonth, 1); setViewMonth(n); setSelectedDate(n); }}><ChevronRightIcon fontSize="small" /></IconButton>
          </Stack>
        </Stack>
      </Box>

      {/* day strip */}
      <Box ref={stripRef} sx={{ display:'flex', gap:1, overflowX:'auto', pb:1, "&::-webkit-scrollbar": { display:'none' } }}>
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
