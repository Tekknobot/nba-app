// src/components/GameCalendar.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Card, CardContent, Chip, IconButton, Stack, Typography,
  Drawer, Divider, List, ListItem, ListItemText, Button
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { normalizeNatTvJson } from "../utils/natTvFromJson";

/* ---------------- small date helpers ---------------- */
function firstOfMonth(d){ const x=new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; }
function addMonths(d,n){ const x=new Date(d); x.setDate(1); x.setMonth(x.getMonth()+n); return x; }
function todayKey(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
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

/* ---------------- drawer ---------------- */
const stageDotColor = (id)=> (Number(id)===1?'warning.main':Number(id)===3?'secondary.main':'success.main');

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

  useEffect(()=>{
    const handler=e=>{ if(e?.detail) setTeam(e.detail); };
    window.addEventListener("team:change", handler);
    return ()=> window.removeEventListener("team:change", handler);
  },[]);

  // Load JSON once (passthrough if already normalized)
  useEffect(()=>{
    let cancelled=false;

    const sortCal = rows =>
      [...rows].sort(
        (a,b)=> String(a.dateKey||"").localeCompare(String(b.dateKey||""))
            || String(a._iso||"").localeCompare(String(b._iso||""))
      );

    (async()=>{
      try{
        const r = await fetch("/all-games-subject-to-change.json", { cache: "no-store" });
        if(!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();

        // PASSTHROUGH when your JSON is already in calendar row shape
        const isCalShape = Array.isArray(json) && json[0] && json[0].dateKey && (json[0]._teamCode || json[0]._teamName);
        const parsed = isCalShape ? sortCal(json) : normalizeNatTvJson(json);

        // Jump safely to first month that exists in data (not "future only")
        if (!cancelled && parsed.length) {
          const first = parsed[0].dateKey;
          const m = first && first.match(/^(\d{4})-(\d{2})-\d{2}$/);
          if (m) setViewMonth(new Date(Number(m[1]), Number(m[2]) - 1, 1));
        }

        if(!cancelled){
          setLoadErr(null);
          setAllEvents(parsed);
        }
      }catch(e){
        if(!cancelled){
          setLoadErr(e?.message || String(e));
          setAllEvents([]);
        }
      }
    })();

    return ()=>{ cancelled=true; };
  },[]);


    // ONLY show future games for the selected team
    const events = useMemo(() => {
    if (!allEvents?.length || !team?.code) return [];

    // yyyy-mm for the currently visible month
    const y = viewMonth.getFullYear();
    const m = String(viewMonth.getMonth() + 1).padStart(2, '0');
    const monthKey = `${y}-${m}`;

    // keep rows that match the visible month and the selected team
    return allEvents.filter(ev =>
      (ev.dateKey || '').startsWith(monthKey) &&
      ev._teamCode === team.code
    );
  }, [allEvents, team?.code, viewMonth]);

  const eventsMap=useMemo(()=> bucketByDay(events),[events]);

  return (
    <Box sx={{ mx:'auto', width:'100%', maxWidth:{ xs: 300, md: 400, lg: 500 } }}>
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

      <MonthGrid monthStart={viewMonth} eventsMap={eventsMap} />

      {events.length===0 && (
        <Stack sx={{ mt:2 }}>
          <Typography variant="body2" sx={{ opacity:0.8 }}>
            {team?.code
              ? `No upcoming national TV games for ${team.code} in the current view.`
              : 'Pick a team to see upcoming national TV games.'}
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
