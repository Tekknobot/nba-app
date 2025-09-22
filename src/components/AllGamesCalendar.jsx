// src/components/AllGamesCalendar.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Card, CardContent, Chip, IconButton, Stack, Typography,
  Drawer, Divider, List, ListItem, ListItemText, Button,
  CircularProgress, Tooltip, ListItemButton, Avatar, Badge
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import "@fontsource/bebas-neue"; // defaults to 400 weight
import {
  summarizeLastNGames,
  daysRestBefore,
  isBackToBack,
  computeGameProbabilities,
  explainFactors,
} from "../utils/probability";

/* ========= small date helpers ========= */
function firstOfMonth(d){ const x=new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; }
function addMonths(d,n){ const x=new Date(d); x.setDate(1); x.setMonth(x.getMonth()+n); return x; }
function dateKeyFromDate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function daysInMonth(year, month){ // month 0..11
  const out=[]; const d=new Date(year,month,1);
  while(d.getMonth()===month){ out.push(new Date(d)); d.setDate(d.getDate()+1); }
  return out;
}
const stageDotColor = (id)=> (Number(id)===1?'warning.main':Number(id)===3?'secondary.main':'success.main');

/* ========= team codes (UI labels) ========= */
const TEAM_CODE = {
  "Atlanta Hawks":"ATL","Boston Celtics":"BOS","Brooklyn Nets":"BKN","Charlotte Hornets":"CHA","Chicago Bulls":"CHI",
  "Cleveland Cavaliers":"CLE","Dallas Mavericks":"DAL","Denver Nuggets":"DEN","Detroit Pistons":"DET","Golden State Warriors":"GSW",
  "Houston Rockets":"HOU","Indiana Pacers":"IND","LA Clippers":"LAC","Los Angeles Lakers":"LAL","Memphis Grizzlies":"MEM",
  "Miami Heat":"MIA","Milwaukee Bucks":"MIL","Minnesota Timberwolves":"MIN","New Orleans Pelicans":"NOP","New York Knicks":"NYK",
  "Oklahoma City Thunder":"OKC","Orlando Magic":"ORL","Philadelphia 76ers":"PHI","Phoenix Suns":"PHX","Portland Trail Blazers":"POR",
  "Sacramento Kings":"SAC","San Antonio Spurs":"SAS","Toronto Raptors":"TOR","Utah Jazz":"UTA","Washington Wizards":"WAS"
};

/* ========= balldontlie (free) team ids ========= */
const BDL_TEAM_ID = {
  ATL:1, BOS:2, BRK:3, BKN:3, CHO:4, CHA:4, CHI:5, CLE:6, DAL:7, DEN:8,
  DET:9, GSW:10, HOU:11, IND:12, LAC:13, LAL:14, MEM:15, MIA:16, MIL:17,
  MIN:18, NOP:19, NYK:20, OKC:21, ORL:22, PHI:23, PHX:24, PHO:24, POR:25,
  SAC:26, SAS:27, TOR:28, UTA:29, WAS:30
};
// 2024–25 season window (season end year = 2025; “summer-ish”)
const SEASON_START = "2024-10-01";
const SEASON_END   = "2025-06-30";

/* ========= build events from JSON ========= */
function buildEventsFromSchedule(json){
  const rows = [];
  const games = json?.regular_season_games || [];
  for (const g of games) {
    if (!g?.date || !g?.home || !g?.away) continue;
    const iso = `${g.date}T00:00:00Z`;
    const d = new Date(g.date);
    const dateKey = dateKeyFromDate(d);
    const seasonStageId = 2;
    const et = "TBD";
    const homeTeam = g.home, awayTeam = g.away;

    rows.push({
      _iso: iso,
      dateKey,
      et,
      seasonStageId,
      home: { name: homeTeam, code: TEAM_CODE[homeTeam] || homeTeam },
      away: { name: awayTeam, code: TEAM_CODE[awayTeam] || awayTeam }
    });
  }
  rows.sort((a,b)=> (a._iso||"").localeCompare(b._iso||"") || (a.home?.name||"").localeCompare(b.home?.name||""));
  return rows;
}

function bucketByDayAll(games){
  const m = new Map();
  for (const g of games || []) {
    const k = g.dateKey; if (!k) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(g);
  }
  for (const arr of m.values()) arr.sort((a,b)=> String(a._iso||"").localeCompare(String(b._iso||"")));
  return m;
}

/* ========= Last-10 panel bits ========= */
function Last10List({ title, loading, error, data }){
  const record = React.useMemo(()=>{
    const arr = data?.games || [];
    let w=0,l=0,t=0;
    arr.forEach(g => { if(g.result==='W') w++; else if(g.result==='L') l++; else t++; });
    return arr.length ? `${w}-${l}${t?`-${t}`:''}` : null;
  }, [data]);

  return (
    <Card variant="outlined" sx={{ borderRadius:1, flex:1, minWidth:0 }}>
      <CardContent sx={{ p:2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight:700, mb:1 }}>
          {title}{record ? ` · ${record}` : ""}
        </Typography>
        <Divider sx={{ mb:1 }} />
        {loading ? (
          <Stack alignItems="center" sx={{ py:4 }}><CircularProgress size={20} /></Stack>
        ) : error ? (
          <Typography variant="body2" color="warning.main">{error}</Typography>
        ) : !data?.games?.length ? (
          <Typography variant="body2" sx={{ opacity:0.8 }}>No data.</Typography>
        ) : (
          <List dense sx={{ maxHeight: '60vh', overflow:'auto' }}>
            {data.games.slice(0,10).map((g,i)=>(
              <ListItem key={i} disableGutters>
                <ListItemText
                  primaryTypographyProps={{ variant:'body2', fontWeight:600 }}
                  secondaryTypographyProps={{ variant:'caption' }}
                  primary={`${g.date} — ${g.homeAway === 'Home' ? 'vs' : '@'} ${g.opp}`}
                  secondary={`${g.result || '?'} ${g.score || ''}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}

async function fetchLast10BDL(teamCode) {
  const id = BDL_TEAM_ID[teamCode];
  if (!id) throw new Error(`Unknown team code: ${teamCode}`);

  const params = new URLSearchParams({
    "team_ids[]": String(id),
    "start_date": SEASON_START,
    "end_date": SEASON_END,
    "per_page": "100",
  });

  const url = `https://api.balldontlie.io/v1/games?${params.toString()}`;

  const headers = {};
  const key = process.env.REACT_APP_BDL_API_KEY;
  if (key) headers["Authorization"] = key;

  const res = await fetch(url, { headers });
  if (res.status === 401) throw new Error("BDL 401 (missing/invalid API key). Add REACT_APP_BDL_API_KEY in .env.local and restart.");
  if (!res.ok) throw new Error(`BDL HTTP ${res.status}`);

  const json = await res.json();
  const data = Array.isArray(json?.data) ? json.data : [];

  const finals = data
    .filter(g => (g?.status || "").toLowerCase().includes("final"))
    .filter(g => !g?.postseason)
    .sort((a,b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);

  const games = finals.map(g => {
    const home = (g.home_team?.abbreviation || "HOME").toUpperCase();
    const away = (g.visitor_team?.abbreviation || "AWAY").toUpperCase();
    const isHome = home === teamCode;
    const my = isHome ? g.home_team_score : g.visitor_team_score;
    const their = isHome ? g.visitor_team_score : g.home_team_score;
    const result = my > their ? "W" : (my < their ? "L" : "T");
    const opp = isHome ? away : home;
    const score = `${home} ${g.home_team_score} - ${away} ${g.visitor_team_score}`;
    return {
      date: (g.date || "").slice(0,10),
      opp,
      homeAway: isHome ? "Home" : "Away",
      result,
      score
    };
  });

  return { team: teamCode, games, _source: "balldontlie" };
}

// --- DROP-IN: Pure function to compute probs from your fetched last-10 payloads ---
function buildProbsForGame({ game, awayData, homeData }) {
  // if your game object has _iso: "yyyy-mm-ddTHH:MM:SSZ"
  const gameDateISO =
    (game?._iso || "").slice(0, 10) ||
    (game?.dateKey || "") ||
    new Date().toISOString().slice(0, 10);

  const homeGames = homeData?.games || [];
  const awayGames = awayData?.games || [];
  if (!homeGames.length || !awayGames.length) return null;

  const homeSummary = summarizeLastNGames(homeGames, 10);
  const awaySummary = summarizeLastNGames(awayGames, 10);
  const homeRestDays = daysRestBefore(gameDateISO, homeGames);
  const awayRestDays = daysRestBefore(gameDateISO, awayGames);
  const homeB2B = isBackToBack(gameDateISO, homeGames);
  const awayB2B = isBackToBack(gameDateISO, awayGames);

  const P = computeGameProbabilities({
    homeSummary,
    awaySummary,
    homeRestDays,
    awayRestDays,
    homeB2B,
    awayB2B,
    neutralSite: false,
  });

  return {
    ...P,
    factors: explainFactors({ homeSummary, awaySummary, deltas: P.deltas }),
  };
}

// --- DROP-IN: Presentational component for the probability card ---
function ProbabilityCard({ probs, homeCode, awayCode }) {
  if (!probs) return null;
  const pct = Math.round(probs.pHome * 100);
  return (
    <Card variant="outlined" sx={{ borderRadius:1, mt:2 }}>
      <CardContent sx={{ p:2 }}>
        <Stack direction="row" alignItems="baseline" spacing={1}>
          <Typography variant="subtitle2" sx={{ fontWeight:700 }}>
            Model edge
          </Typography>
          <Typography variant="caption" sx={{ opacity:0.7 }}>
            (home win)
          </Typography>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1} sx={{ mt:1 }}>
          <Typography variant="h5" sx={{ fontWeight:800 }}>
            {pct}%
          </Typography>
          <Typography variant="body2" sx={{ opacity:0.75 }}>
            {homeCode} vs {awayCode}
          </Typography>
        </Stack>

        {/* progress bar */}
        <Box sx={{ mt:1.25, height:8, bgcolor:'action.hover', borderRadius:1, overflow:'hidden' }}>
          <Box sx={{ width: `${pct}%`, height:'100%', bgcolor:'primary.main' }} />
        </Box>

        {/* factor list */}
        <List dense sx={{ mt:1 }}>
          {probs.factors.map((f, i) => (
            <ListItem key={i} disableGutters sx={{ py:0.25 }}>
              <ListItemText
                primaryTypographyProps={{ variant:'body2' }}
                primary={`${f.label}: ${f.value}`}
              />
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
}

function ComparisonDrawer({ open, onClose, game }){
  const [a,setA]=useState({ loading:true, error:null, data:null }); // away last-10
  const [b,setB]=useState({ loading:true, error:null, data:null }); // home last-10
  const [probs, setProbs] = useState(null); // model result

  // fetch last 10 (away = A, home = B)
  useEffect(()=>{
    if (!open || !game?.home?.code || !game?.away?.code) return;
    let cancelled = false;

    (async()=>{
      try{
        setA({ loading:true, error:null, data:null });
        setB({ loading:true, error:null, data:null });

        const [A,B] = await Promise.all([
          fetchLast10BDL(game.away.code),
          fetchLast10BDL(game.home.code),
        ]);
        if (cancelled) return;
        setA({ loading:false, error:null, data:A });
        setB({ loading:false, error:null, data:B });
      }catch(e){
        if (cancelled) return;
        const msg = e?.message || String(e);
        setA({ loading:false, error:msg, data:{ team:game?.away?.code, games:[] } });
        setB({ loading:false, error:msg, data:{ team:game?.home?.code, games:[] } });
      }
    })();

    return ()=>{ cancelled = true; };
  }, [open, game?.home?.code, game?.away?.code]);

  // --- local helpers (scoped here to avoid undefineds) ---
  function buildProbsForGame({ game, awayData, homeData }) {
    const gameDateISO =
      (game?._iso || "").slice(0, 10) ||
      (game?.dateKey || "") ||
      new Date().toISOString().slice(0, 10);

    const homeGames = homeData?.games || [];
    const awayGames = awayData?.games || [];
    if (!homeGames.length || !awayGames.length) return null;

    const homeSummary = summarizeLastNGames(homeGames, 10);
    const awaySummary = summarizeLastNGames(awayGames, 10);
    const homeRestDays = daysRestBefore(gameDateISO, homeGames);
    const awayRestDays = daysRestBefore(gameDateISO, awayGames);
    const homeB2B = isBackToBack(gameDateISO, homeGames);
    const awayB2B = isBackToBack(gameDateISO, awayGames);

    const P = computeGameProbabilities({
      homeSummary,
      awaySummary,
      homeRestDays,
      awayRestDays,
      homeB2B,
      awayB2B,
      neutralSite: false,
    });

    return {
      ...P,
      factors: explainFactors({ homeSummary, awaySummary, deltas: P.deltas }),
    };
  }

  function ProbabilityCard({ probs, homeCode, awayCode }) {
    if (!probs) return null;
    const pct = Math.round(probs.pHome * 100);
    return (
      <Card variant="outlined" sx={{ borderRadius:1, mt:2 }}>
        <CardContent sx={{ p:2 }}>
          <Stack direction="row" alignItems="baseline" spacing={1}>
            <Typography variant="subtitle2" sx={{ fontWeight:700 }}>
              Model edge
            </Typography>
            <Typography variant="caption" sx={{ opacity:0.7 }}>
              (home win)
            </Typography>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1} sx={{ mt:1 }}>
            <Typography variant="h5" sx={{ fontWeight:800 }}>
              {pct}%
            </Typography>
            <Typography variant="body2" sx={{ opacity:0.75 }}>
              {homeCode} vs {awayCode}
            </Typography>
          </Stack>

          <Box sx={{ mt:1.25, height:8, bgcolor:'action.hover', borderRadius:1, overflow:'hidden' }}>
            <Box sx={{ width: `${pct}%`, height:'100%', bgcolor:'primary.main' }} />
          </Box>

          <List dense sx={{ mt:1 }}>
            {probs.factors.map((f, i) => (
              <ListItem key={i} disableGutters sx={{ py:0.25 }}>
                <ListItemText
                  primaryTypographyProps={{ variant:'body2' }}
                  primary={`${f.label}: ${f.value}`}
                />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>
    );
  }
  // --- end helpers ---

  // compute probabilities when lists finish loading
  useEffect(() => {
    if (!open) return;
    if (a.loading || b.loading) return;
    if (a.error || b.error) { setProbs(null); return; }
    const built = buildProbsForGame({ game, awayData: a.data, homeData: b.data });
    setProbs(built);
  }, [open, a.loading, b.loading, a.error, b.error, a.data, b.data, game]);

  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      PaperProps={{ sx:{ width:{ xs:'100%', sm: 620 }, p:2, borderTopLeftRadius: { xs:1, sm:0 } } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb:2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight:700 }}>
          Last 10 — {game?.away?.code} @ {game?.home?.code}
        </Typography>
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </Stack>

      <Typography variant="caption" sx={{ opacity:0.8, mb:1, display:'block' }}>
        Clicked game: {game?.away?.name} at {game?.home?.name}
      </Typography>

      <Stack direction={{ xs:'column', sm:'row' }} spacing={2}>
        <Last10List title={`${game?.away?.code} (${game?.away?.name})`} loading={a.loading} error={a.error} data={a.data}/>
        <Last10List title={`${game?.home?.code} (${game?.home?.name})`} loading={b.loading} error={b.error} data={b.data}/>
      </Stack>

      {/* NEW: probability card */}
      <ProbabilityCard
        probs={probs}
        homeCode={game?.home?.code}
        awayCode={game?.away?.code}
      />

      <Box sx={{ mt:2 }}>
        <Tooltip title="Close"><Button variant="contained" onClick={onClose} fullWidth>Close</Button></Tooltip>
      </Box>
    </Drawer>
  );
}

/* ========= Mobile UI bits ========= */

/* WeekDay-pill in the horizontal strip */
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
        borderRadius: 1,            // was 3 —> tighter corners (~8px)
        minWidth: 96,
        height: 88,
        px: 1.25,
        py: 0.75,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: selected ? 'primary.main' : 'background.paper',
        color: selected ? 'primary.contrastText' : 'text.primary',
        borderColor: selected ? 'primary.main' : 'divider',
        boxShadow: selected ? 2 : 0,
        transition: 'transform 80ms ease, box-shadow 120ms ease',
        '&:hover': { transform: 'translateY(-1px)' },
        '&:active': { transform: 'translateY(0px)' }
      }}
    >
      <Typography variant="caption" sx={{ opacity: 0.85, lineHeight: 1 }}>
        {dow}{isToday && !selected ? ' •' : ''}
      </Typography>

      <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1, mt: 0.25 }}>
        {String(day).padStart(2,'0')}
      </Typography>

      <Chip
        size="small"
        label={count ? `${count} game${count>1?'s':''}` : '0'}
        color={count ? 'secondary' : 'default'}
        variant={selected ? 'filled' : 'outlined'}
        sx={{
          mt: 0.9,
          height: 20,
          borderRadius: 0.75,       // was 1 —> slightly squarer
          '& .MuiChip-label': { px: 0.8, fontSize: 11, fontWeight: 700 }
        }}
      />
    </Button>
  );
}

/* Game card in the agenda list */
function GameCard({ game, onPick }) {
  const vsLabel = `${game.away.code} @ ${game.home.code}`;
  const sub = `${game.away.name} at ${game.home.name}`;
  return (
    <Card variant="outlined" sx={{ borderRadius:1 }}>
      <ListItemButton
        onClick={onPick}
        sx={{
          borderRadius:1,
          '&:hover': { bgcolor: 'rgba(25,118,210,0.06)' }
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ width:'100%' }}>
          <Avatar sx={{ width:30, height:30, fontSize:12, bgcolor:'primary.main', color:'primary.contrastText' }}>
            {game.home.code}
          </Avatar>
          <Box sx={{ flex:1 }}>
            <Typography variant="body2" sx={{ fontWeight:700 }}>{vsLabel}</Typography>
            <Typography variant="caption" sx={{ opacity:0.8 }}>{sub}</Typography>
          </Box>
          <Chip size="small" variant="outlined" label={game.et||'TBD'} />
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

  // comparison drawer state
  const [compareGame,setCompareGame]=useState(null);
  const [compareOpen,setCompareOpen]=useState(false);

  // load schedule once
  useEffect(()=>{
    let cancelled=false;
    (async ()=>{
      try{
        setLoading(true);
        const res = await fetch("/all-games-subject-to-change.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status} loading schedule JSON`);
        const json = await res.json();
        const rows = buildEventsFromSchedule(json);
        if (cancelled) return;
        setAllGames(rows);
        setLoadErr(null);

        // default month to first month with data (or current)
        if (rows.length) {
          const m = rows[0].dateKey.match(/^(\d{4})-(\d{2})-\d{2}$/);
          if (m) {
            const firstMonth = new Date(Number(m[1]), Number(m[2]) - 1, 1);
            setViewMonth(firstMonth);
            setSelectedDate(firstMonth);
          }
        }
      }catch(e){
        if (!cancelled){ setLoadErr(e?.message || String(e)); setAllGames([]); }
      }finally{
        if (!cancelled) setLoading(false);
      }
    })();
    return ()=>{ cancelled=true; };
  },[]);

  // month days & events
  const monthDays = useMemo(()=> daysInMonth(viewMonth.getFullYear(), viewMonth.getMonth()), [viewMonth]);
  const eventsMap = useMemo(()=>{
    const y = viewMonth.getFullYear();
    const m = String(viewMonth.getMonth()+1).padStart(2,'0');
    const monthKey = `${y}-${m}`;
    const monthGames = allGames.filter(g => (g.dateKey||'').startsWith(monthKey));
    return bucketByDayAll(monthGames);
  }, [allGames, viewMonth]);

  const selectedKey = dateKeyFromDate(selectedDate);
  const selectedGames = eventsMap.get(selectedKey) || [];

  const stripRef = useRef(null);
  useEffect(()=>{ // auto-scroll strip to selected day
    const idx = monthDays.findIndex(d => dateKeyFromDate(d)===selectedKey);
    if (idx>=0 && stripRef.current) {
      const el = stripRef.current.querySelector(`[data-idx="${idx}"]`);
      if (el) el.scrollIntoView({ inline:'center', behavior:'smooth', block:'nearest' });
    }
  }, [selectedKey, monthDays]);

  const headerMonth = viewMonth.toLocaleDateString(undefined,{ month:'long', year:'numeric' });

  function openCompare(game){ setCompareGame(game); setCompareOpen(true); }

  return (
    <Box sx={{ mx:'auto', width:'100%', maxWidth: 520, p:1.5 }}>
        {/* top header (sticky) */}
        <Box sx={{ position:'sticky', top:0, zIndex:(t)=>t.zIndex.appBar, bgcolor:'background.default', pt:1, pb:1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px:1.5 }}>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth:0 }}>
                <Typography
                variant="h6"
                sx={{
                    fontFamily: '"Bebas Neue", sans-serif',
                    fontSize: { xs: 26, sm: 32 },
                    letterSpacing: 1,
                    fontWeight: 400
                }}
                >
                Pivt
                </Typography>

            <Divider orientation="vertical" flexItem sx={{ opacity:0.2 }} />

            <Stack direction="row" spacing={1} alignItems="center">
                <CalendarMonthIcon fontSize="small" />
                <Typography variant="subtitle1" sx={{ fontWeight:700 }} noWrap>
                {headerMonth}
                </Typography>
            </Stack>
            </Stack>

            <Stack direction="row" spacing={0.5}>
            <IconButton size="small" onClick={()=>{ const n=addMonths(viewMonth,-1); setViewMonth(n); setSelectedDate(n); }}>
                <ChevronLeftIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={()=>{ const n=addMonths(viewMonth, 1); setViewMonth(n); setSelectedDate(n); }}>
                <ChevronRightIcon fontSize="small" />
            </IconButton>
            </Stack>
        </Stack>
        </Box>

      {/* horizontal day strip */}
      <Box
        ref={stripRef}
        sx={{
          display:'flex', gap:1, overflowX:'auto', pb:1,
          "&::-webkit-scrollbar": { display:'none' }
        }}
      >
        {monthDays.map((d, idx)=>{
          const key = dateKeyFromDate(d);
          const count = (eventsMap.get(key) || []).length;
          const selected = key===selectedKey;
          return (
            <Box key={key} data-idx={idx} sx={{ flex:'0 0 auto' }}>
              <DayPill
                d={d}
                selected={selected}
                count={count}
                onClick={()=> setSelectedDate(d)}
              />
            </Box>
          );
        })}
      </Box>

      {/* day agenda */}
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

      {/* comparison drawer */}
      <ComparisonDrawer open={compareOpen} onClose={()=> setCompareOpen(false)} game={compareGame} />
    </Box>
  );
}
