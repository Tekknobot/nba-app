// src/components/GameCalendar.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Card, CardContent, Chip, IconButton, Stack, Typography,
  Drawer, Divider, List, ListItem, ListItemText, Button
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

/* ---------------- small date helpers ---------------- */
function firstOfMonth(d){ const x=new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; }
function addMonths(d,n){ const x=new Date(d); x.setDate(1); x.setMonth(x.getMonth()+n); return x; }
function dateKeyFromDate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

/* ---------------- data helpers ---------------- */
function bucketByDay(events){
  const m = new Map();
  for (const ev of events || []) {
    const k = ev.dateKey; if (!k) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(ev);
  }
  for (const arr of m.values()) arr.sort((a,b)=> String(a._iso||"").localeCompare(String(b._iso||"")));
  return m;
}

/* ---------------- month matrix (42 cells) ---------------- */
function buildMonthMatrix(monthStart) {
  const first = firstOfMonth(monthStart);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay()); // Sunday-start
  const days = [];
  let cur = new Date(start);
  for (let i = 0; i < 42; i++) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
  return days;
}

/* ---------------- stage dot color ---------------- */
const stageDotColor = (id)=> (Number(id)===1?'warning.main':Number(id)===3?'secondary.main':'success.main');

/* ---------------- team code map ---------------- */
const TEAM_CODE = {
  "Atlanta Hawks":"ATL","Boston Celtics":"BOS","Brooklyn Nets":"BKN","Charlotte Hornets":"CHA","Chicago Bulls":"CHI",
  "Cleveland Cavaliers":"CLE","Dallas Mavericks":"DAL","Denver Nuggets":"DEN","Detroit Pistons":"DET","Golden State Warriors":"GSW",
  "Houston Rockets":"HOU","Indiana Pacers":"IND","LA Clippers":"LAC","Los Angeles Lakers":"LAL","Memphis Grizzlies":"MEM",
  "Miami Heat":"MIA","Milwaukee Bucks":"MIL","Minnesota Timberwolves":"MIN","New Orleans Pelicans":"NOP","New York Knicks":"NYK",
  "Oklahoma City Thunder":"OKC","Orlando Magic":"ORL","Philadelphia 76ers":"PHI","Phoenix Suns":"PHX","Portland Trail Blazers":"POR",
  "Sacramento Kings":"SAC","San Antonio Spurs":"SAS","Toronto Raptors":"TOR","Utah Jazz":"UTA","Washington Wizards":"WAS"
};

/* ---------------- transform JSON → team-scoped events ----------------
   Expected JSON shape in /public/all-games-subject-to-change.json:
   {
     "season": "2025-2026",
     "regular_season_games": [
       { "date": "2025-10-21", "home": "Los Angeles Lakers", "away": "Golden State Warriors" },
       ...
     ]
   }
----------------------------------------------------------------------- */
function buildEventsFromSchedule(json){
  const rows = [];
  const games = json?.regular_season_games || [];
  for (const g of games) {
    if (!g?.date || !g?.home || !g?.away) continue;
    const iso = `${g.date}T00:00:00Z`; // time not provided → midnight UTC
    const d = new Date(g.date);
    const dateKey = dateKeyFromDate(d);
    const seasonStageId = 2;          // 2 = Regular Season
    const et = "TBD";

    const homeTeam = g.home;
    const awayTeam = g.away;

    rows.push({
      _iso: iso, dateKey, et, seasonStageId,
      homeAway: "Home",
      _teamName: homeTeam,
      _teamCode: TEAM_CODE[homeTeam] || homeTeam,
      opp: awayTeam
    });

    rows.push({
      _iso: iso, dateKey, et, seasonStageId,
      homeAway: "Away",
      _teamName: awayTeam,
      _teamCode: TEAM_CODE[awayTeam] || awayTeam,
      opp: homeTeam
    });
  }
  rows.sort((a,b)=> (a._iso||"").localeCompare(b._iso||"") || (a._teamName||"").localeCompare(b._teamName||""));
  return rows;
}

/* ---------------- drawer ---------------- */
function DayDrawer({ open, onClose, date, items }){
  return (
    <Drawer anchor="bottom" open={open} onClose={onClose} PaperProps={{ sx:{ borderTopLeftRadius:1, borderTopRightRadius:1 } }}>
      <Box sx={{ p:2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight:700, mb:1 }}>
          {date?.toLocaleDateString(undefined,{ weekday:'long', month:'short', day:'numeric' })}
        </Typography>
        <Divider sx={{ mb:1 }} />
        <List dense>
          {(items||[]).map((ev,i)=>(
            <ListItem key={i} disableGutters secondaryAction={<Chip size="small" label={ev.et || 'TBD'} variant="outlined" />}>
              <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                <Box sx={{ width:6, height:6, borderRadius:1, bgcolor:stageDotColor(ev.seasonStageId) }} />
                <ListItemText
                  primaryTypographyProps={{ variant:'body2', fontWeight:600 }}
                  secondaryTypographyProps={{ variant:'caption' }}
                  primary={`${ev.homeAway==='Away'?'@':'vs'} ${ev.opp}`}
                  secondary={ev._teamName}
                />
              </Box>
            </ListItem>
          ))}
        </List>
        <Button fullWidth variant="contained" onClick={onClose} sx={{ mt:1 }}>Close</Button>
      </Box>
    </Drawer>
  );
}

/* ---------------- square day cell ---------------- */
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
        <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1 }}>
          {d.getDate()}
        </Typography>
        {list.length > 0 && (
          <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {list.slice(0, 2).map((ev, i) => (
              <Chip key={i} size="small" label={`${ev.homeAway === 'Away' ? '@' : 'vs'} ${ev.opp}`} sx={{ borderRadius: 1 }} />
            ))}
            {list.length > 2 && <Chip size="small" label={`+${list.length - 2}`} sx={{ borderRadius: 1 }} />}
          </Box>
        )}
      </Box>
    </Box>
  );
}

/* ---------------- month grid (pure CSS grid) ---------------- */
function MonthGrid({ monthStart, eventsMap }){
  const days = useMemo(()=> buildMonthMatrix(monthStart), [monthStart]);
  const [drawerDay,setDrawerDay]=useState(null);
  const thisMonth = monthStart.getMonth();

  return (
    <Card variant="outlined" sx={{ borderRadius:1, width:'100%' }}>
      <CardContent sx={{ p:2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight:700, mb:2 }}>
          {monthStart.toLocaleDateString(undefined,{ month:'long', year:'numeric' })}
        </Typography>

        {/* Header row SMTWTFS in 7 equal columns */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, mb: 1 }}>
          {['S','M','T','W','T','F','S'].map((d, i)=>(
            <Box key={i} sx={{ px: 0.5 }}>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>{d}</Typography>
            </Box>
          ))}
        </Box>

        {/* 42 equal square cells */}
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

      <DayDrawer open={Boolean(drawerDay)} onClose={()=>setDrawerDay(null)} date={drawerDay?.date} items={drawerDay?.items} />
    </Card>
  );
}

/* ---------------- main calendar ---------------- */
export default function GameCalendar(){
  const [team,setTeam]=useState(null);
  const [allEvents,setAllEvents]=useState([]);
  const [viewMonth,setViewMonth]=useState(firstOfMonth(new Date()));
  const [loadErr,setLoadErr]=useState(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const handler=e=>{ if(e?.detail) setTeam(e.detail); };
    window.addEventListener("team:change", handler);
    return ()=> window.removeEventListener("team:change", handler);
  },[]);

  // Fetch from /public at runtime
  useEffect(()=>{
    let cancelled=false;
    (async ()=>{
      try{
        setLoading(true);
        const res = await fetch("/all-games-subject-to-change.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status} loading schedule JSON`);
        const scheduleJson = await res.json();
        const rows = buildEventsFromSchedule(scheduleJson);
        if (cancelled) return;
        setAllEvents(rows);
        setLoadErr(null);
        if (rows.length) {
          const m = rows[0].dateKey.match(/^(\d{4})-(\d{2})-\d{2}$/);
          if (m) setViewMonth(new Date(Number(m[1]), Number(m[2]) - 1, 1));
        }
      }catch(e){
        if (!cancelled){
          setLoadErr(e?.message || String(e));
          setAllEvents([]);
        }
      }finally{
        if (!cancelled) setLoading(false);
      }
    })();
    return ()=>{ cancelled=true; };
  },[]);

  // ONLY show games for the selected team in the visible month
  const events = useMemo(() => {
    if (!allEvents?.length || !team?.code) return [];
    const y = viewMonth.getFullYear();
    const m = String(viewMonth.getMonth() + 1).padStart(2, '0');
    const monthKey = `${y}-${m}`;
    return allEvents.filter(ev =>
      (ev.dateKey || '').startsWith(monthKey) &&
      ev._teamCode === team.code
    );
  }, [allEvents, team?.code, viewMonth]);

  const eventsMap=useMemo(()=> bucketByDay(events),[events]);

  return (
    <Box sx={{ mx:'auto', width:'100%', maxWidth:{ xs: 500, md: 600, lg: 700 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb:2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" sx={{ fontSize:{ xs:18, sm:20 }, fontWeight:700 }}>
            {team?.name ? `${team.name} — Upcoming` : 'Select a team — Upcoming'}
          </Typography>
          {team?.code && <Chip size="small" label={team.code} />}
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
        <MonthGrid monthStart={viewMonth} eventsMap={eventsMap} />
      )}

      {(!loading && events.length===0) && (
        <Stack sx={{ mt:2 }}>
          <Typography variant="body2" sx={{ opacity:0.8 }}>
            {team?.code
              ? `No regular-season games for ${team.code} in this month.`
              : 'Pick a team to see games.'}
          </Typography>
          {loadErr && (
            <Typography variant="caption" sx={{ opacity:0.9, color:'warning.main' }}>
              Load error: {loadErr}
            </Typography>
          )}
        </Stack>
      )}
    </Box>
  );
}
