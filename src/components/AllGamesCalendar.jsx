// src/components/AllGamesCalendar.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Card, CardContent, Chip, IconButton, Stack, Typography,
  Drawer, Divider, List, ListItem, ListItemText, Button, CircularProgress, Tooltip
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import { ListItemButton } from "@mui/material";

/* -------- shared helpers -------- */
function firstOfMonth(d){ const x=new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; }
function addMonths(d,n){ const x=new Date(d); x.setDate(1); x.setMonth(x.getMonth()+n); return x; }
function dateKeyFromDate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
const stageDotColor = (id)=> (Number(id)===1?'warning.main':Number(id)===3?'secondary.main':'success.main');

const TEAM_CODE = {
  "Atlanta Hawks":"ATL","Boston Celtics":"BOS","Brooklyn Nets":"BKN","Charlotte Hornets":"CHA","Chicago Bulls":"CHI",
  "Cleveland Cavaliers":"CLE","Dallas Mavericks":"DAL","Denver Nuggets":"DEN","Detroit Pistons":"DET","Golden State Warriors":"GSW",
  "Houston Rockets":"HOU","Indiana Pacers":"IND","LA Clippers":"LAC","Los Angeles Lakers":"LAL","Memphis Grizzlies":"MEM",
  "Miami Heat":"MIA","Milwaukee Bucks":"MIL","Minnesota Timberwolves":"MIN","New Orleans Pelicans":"NOP","New York Knicks":"NYK",
  "Oklahoma City Thunder":"OKC","Orlando Magic":"ORL","Philadelphia 76ers":"PHI","Phoenix Suns":"PHX","Portland Trail Blazers":"POR",
  "Sacramento Kings":"SAC","San Antonio Spurs":"SAS","Toronto Raptors":"TOR","Utah Jazz":"UTA","Washington Wizards":"WAS"
};

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

function buildMonthMatrix(monthStart) {
  const first = firstOfMonth(monthStart);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay()); // Sunday-start
  const days = [];
  let cur = new Date(start);
  for (let i = 0; i < 42; i++) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
  return days;
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

/* ---------------- comparison drawer (right) ---------------- */
function Last10List({ title, loading, error, data }){
  return (
    <Card variant="outlined" sx={{ borderRadius:1, flex:1, minWidth:0 }}>
      <CardContent sx={{ p:2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight:700, mb:1 }}>{title}</Typography>
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

function ComparisonDrawer({ open, onClose, game }){
  const [a,setA]=useState({ loading:true, error:null, data:null });
  const [b,setB]=useState({ loading:true, error:null, data:null });

  const aCode = game?.home?.code;
  const bCode = game?.away?.code;

  useEffect(()=>{
    if (!open || !aCode || !bCode) return;

    let cancelled = false;

    async function fetchLast10(code){
      try{
        const res = await fetch(`/last10/${code}.json`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        // normalize a bit
        const games = Array.isArray(json?.games) ? json.games : [];
        return { team: json?.team || code, games };
      }catch(e){
        return { team: code, games: [], error: e?.message || String(e) };
      }
    }

    (async()=>{
      setA({ loading:true, error:null, data:null });
      setB({ loading:true, error:null, data:null });
      const [resA,resB] = await Promise.all([fetchLast10(aCode), fetchLast10(bCode)]);
      if (cancelled) return;
      setA({ loading:false, error: resA.error || null, data: resA });
      setB({ loading:false, error: resB.error || null, data: resB });
    })();

    return ()=>{ cancelled = true; };
  },[open, aCode, bCode]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx:{ width:{ xs:'100%', sm: 620 }, p:2, borderTopLeftRadius: { xs:1, sm:0 } } }}
    >
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
        <Last10List
          title={`${game?.away?.code} (${game?.away?.name})`}
          loading={a.loading}
          error={a.error}
          data={a.data}
        />
        <Last10List
          title={`${game?.home?.code} (${game?.home?.name})`}
          loading={b.loading}
          error={b.error}
          data={b.data}
        />
      </Stack>

      <Box sx={{ mt:2 }}>
        <Tooltip title="Close">
          <Button variant="contained" onClick={onClose} fullWidth>Close</Button>
        </Tooltip>
      </Box>
    </Drawer>
  );
}

/* ---------------- day drawer (bottom) ---------------- */
function DayDrawer({ open, onClose, date, items, onPickGame }){
  return (
    <Drawer anchor="bottom" open={open} onClose={onClose} PaperProps={{ sx:{ borderTopLeftRadius:1, borderTopRightRadius:1 } }}>
      <Box sx={{ p:2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight:700, mb:1 }}>
          {date?.toLocaleDateString(undefined,{ weekday:'long', month:'short', day:'numeric' })}
        </Typography>
        <Divider sx={{ mb:1 }} />

        <List dense sx={{ display:'flex', flexDirection:'column', gap:0.5 }}>
          {(items||[]).map((g,i)=>(
            <ListItem
              key={i}
              disableGutters
              secondaryAction={<Chip size="small" label={g.et || 'TBD'} variant="outlined" />}
              sx={{ border:'1px solid', borderColor:'divider', borderRadius:1, overflow:'hidden' }}
            >
              <ListItemButton
                onClick={()=> onPickGame?.(g)}
                sx={{
                  '&:hover': { bgcolor:'action.hover' },
                  '&.Mui-focusVisible': { outline:'2px solid', outlineColor:'primary.main' },
                }}
              >
                <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                  <Box sx={{ width:6, height:6, borderRadius:1, bgcolor:stageDotColor(g.seasonStageId) }} />
                  <ListItemText
                    primaryTypographyProps={{ variant:'body2', fontWeight:700 }}
                    secondaryTypographyProps={{ variant:'caption' }}
                    primary={`${g.away.code} @ ${g.home.code}`}
                    secondary={`${g.away.name} at ${g.home.name}`}
                  />
                </Box>
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <Button fullWidth variant="contained" onClick={onClose} sx={{ mt:1 }}>Close</Button>
      </Box>
    </Drawer>
  );
}

/* ---------------- square and month grid ---------------- */
function SquareDay({ d, list, inMonth, today, onClick }) {
  return (
    <Box sx={{ position: 'relative', width: '100%', aspectRatio: '1 / 1' }}>
      <Box
        onClick={onClick}
        sx={{
          position: 'absolute', inset: 0,
          borderRadius: 1, p: 1, border: '1px solid',
          borderColor: today ? 'primary.main' : 'divider',
          bgcolor: inMonth ? (today ? 'action.hover' : 'background.paper') : 'action.selected',
          opacity: inMonth ? 1 : 0.55,
          cursor: list.length ? 'pointer' : 'default',
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1 }}>
            {d.getDate()}
          </Typography>
          {list.length > 0 && <Chip size="small" label={list.length} sx={{ borderRadius: 1 }} />}
        </Stack>

        {list.length > 0 && (
          <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {list.slice(0, 2).map((g, i) => (
              <Chip
                key={i}
                size="small"
                label={`${g.away.code}@${g.home.code}`}
                sx={{ borderRadius: 1 }}
              />
            ))}
            {list.length > 2 && <Chip size="small" label={`+${list.length - 2}`} sx={{ borderRadius: 1 }} />}
          </Box>
        )}
      </Box>
    </Box>
  );
}

function MonthGrid({ monthStart, eventsMap, onPickGame }){
  const days = useMemo(()=> buildMonthMatrix(monthStart), [monthStart]);
  const [drawerDay,setDrawerDay]=useState(null);
  const thisMonth = monthStart.getMonth();

  return (
    <Card variant="outlined" sx={{ borderRadius:1, width:'100%' }}>
      <CardContent sx={{ p:2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight:700, mb:2 }}>
          {monthStart.toLocaleDateString(undefined,{ month:'long', year:'numeric' })}
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, mb: 1 }}>
          {['S','M','T','W','T','F','S'].map((d, i)=>(
            <Box key={i} sx={{ px: 0.5 }}>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>{d}</Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
          {days.map((d, idx)=>{
            const key = dateKeyFromDate(d);
            const list = eventsMap.get(key) || [];
            const inMonth = d.getMonth() === thisMonth;
            const today = dateKeyFromDate(new Date()) === key;
            return (
              <SquareDay
                key={idx}
                d={d}
                list={list}
                inMonth={inMonth}
                today={today}
                onClick={()=> list.length && setDrawerDay({ date:d, items:list })}
              />
            );
          })}
        </Box>
      </CardContent>

      <DayDrawer
        open={Boolean(drawerDay)}
        onClose={()=>setDrawerDay(null)}
        date={drawerDay?.date}
        items={drawerDay?.items}
        onPickGame={(g)=> onPickGame?.(g)}
      />
    </Card>
  );
}

/* ---------------- main: fetch all games & show month ---------------- */
export default function AllGamesCalendar(){
  const [allGames,setAllGames]=useState([]);
  const [viewMonth,setViewMonth]=useState(firstOfMonth(new Date()));
  const [loadErr,setLoadErr]=useState(null);
  const [loading,setLoading]=useState(true);

  // comparison drawer state
  const [compareGame,setCompareGame]=useState(null);
  const [compareOpen,setCompareOpen]=useState(false);

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
        if (rows.length) {
          const m = rows[0].dateKey.match(/^(\d{4})-(\d{2})-\d{2}$/);
          if (m) setViewMonth(new Date(Number(m[1]), Number(m[2]) - 1, 1));
        }
      }catch(e){
        if (!cancelled){
          setLoadErr(e?.message || String(e));
          setAllGames([]);
        }
      }finally{
        if (!cancelled) setLoading(false);
      }
    })();
    return ()=>{ cancelled=true; };
  },[]);

  const monthGames = useMemo(()=>{
    if (!allGames.length) return [];
    const y = viewMonth.getFullYear();
    const m = String(viewMonth.getMonth() + 1).padStart(2, '0');
    const monthKey = `${y}-${m}`;
    return allGames.filter(g => (g.dateKey || '').startsWith(monthKey));
  }, [allGames, viewMonth]);

  const eventsMap = useMemo(()=> bucketByDayAll(monthGames),[monthGames]);

  function handlePickGame(g){
    setCompareGame(g);
    setCompareOpen(true);
  }

  return (
    <Box sx={{ mx:'auto', width:'100%', maxWidth:{ xs: 500, md: 600, lg: 700 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb:2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" sx={{ fontSize:{ xs:18, sm:20 }, fontWeight:700 }}>
            NBA — All Games
          </Typography>
          <Chip size="small" variant="outlined" label={viewMonth.toLocaleDateString(undefined,{month:'long', year:'numeric'})} />
        </Stack>
        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" onClick={()=> setViewMonth(m => addMonths(m, -1))}><ChevronLeftIcon fontSize="small" /></IconButton>
          <IconButton size="small" onClick={()=> setViewMonth(m => addMonths(m, +1))}><ChevronRightIcon fontSize="small" /></IconButton>
        </Stack>
      </Stack>

      {loading ? (
        <Card variant="outlined"><CardContent><Typography variant="body2">Loading schedule…</Typography></CardContent></Card>
      ) : (
        <MonthGrid monthStart={viewMonth} eventsMap={eventsMap} onPickGame={handlePickGame} />
      )}

      {(!loading && monthGames.length===0) && (
        <Stack sx={{ mt:2 }}>
          <Typography variant="body2" sx={{ opacity:0.8 }}>
            No regular-season games found for this month.
          </Typography>
          {loadErr && (
            <Typography variant="caption" sx={{ opacity:0.9, color:'warning.main' }}>
              Load error: {loadErr}
            </Typography>
          )}
        </Stack>
      )}

      {/* Right-side comparison drawer */}
      <ComparisonDrawer
        open={compareOpen}
        onClose={()=> setCompareOpen(false)}
        game={compareGame}
      />
    </Box>
  );
}
