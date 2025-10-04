// src/components/GameComparePanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Card, CardContent, Chip, CircularProgress, Divider, Tooltip,
  Typography, List, ListItem, ListItemText, Stack, Avatar
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import { Accordion, AccordionSummary, AccordionDetails } from "@mui/material";

// ========= tiny utils shared locally =========
const nf1 = (v) => (v ?? 0).toFixed(1);
const clampISODateOnly = (iso) => (iso || "").slice(0, 10);
const parseMinToNumber = (minStr) => {
  if (!minStr || typeof minStr !== "string") return 0;
  const [m, s] = minStr.split(":").map(Number);
  return (isFinite(m) ? m : 0) + (isFinite(s) ? s / 60 : 0);
};
const bdlHeaders = () => {
  const key = process.env.REACT_APP_BDL_API_KEY;
  return key ? { Authorization: key } : {};
};

// ========= bits copied from your drawer (trimmed to what we need) =========
const BDL_TEAM_ID = {
  ATL:1, BOS:2, BKN:3, CHA:4, CHI:5, CLE:6, DAL:7, DEN:8, DET:9,
  GSW:10, HOU:11, IND:12, LAC:13, LAL:14, MEM:15, MIA:16, MIL:17,
  MIN:18, NOP:19, NYK:20, OKC:21, ORL:22, PHI:23, PHX:24, POR:25,
  SAC:26, SAS:27, TOR:28, UTA:29, WAS:30
};
function windowISO({ anchorISO, days }) {
  const anchor = anchorISO || new Date().toISOString().slice(0,10);
  const d = new Date(anchor); d.setDate(d.getDate() - days);
  return { start: d.toISOString().slice(0,10), end: anchor };
}
function seasonWindowUpTo(anchorISO){
  const d = new Date(anchorISO || new Date());
  const endYear = (d.getMonth() >= 9) ? d.getFullYear() + 1 : d.getFullYear();
  const start = `${endYear - 1}-10-01`;
  const end   = clampISODateOnly(anchorISO) || `${endYear}-06-30`;
  return { start, end, endYear };
}
function codeify(teamObjOrStr, fallback = '') {
  if (!teamObjOrStr) return fallback;
  if (typeof teamObjOrStr === 'string') return teamObjOrStr.toUpperCase();
  return (teamObjOrStr.code || teamObjOrStr.abbr || teamObjOrStr.name || fallback).toUpperCase();
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
function getPredictedWinnerCode(game) {
  const homeCode = codeify(game?.home, null);
  const awayCode = codeify(game?.away, null);
  const pHome = Number(game?.model?.pHome);
  if (Number.isFinite(pHome) && homeCode && awayCode) {
    return pHome > 0.5 ? homeCode : awayCode;
  }
  const pick = String(game?.model?.predictedWinner || "").toUpperCase();
  if (pick === "HOME" && homeCode) return homeCode;
  if (pick === "AWAY" && awayCode) return awayCode;
  return pick || null;
}
function modelVerdict(game) {
  const isFinal = (game?.status || '').toLowerCase().includes('final');
  if (!isFinal) return null;
  const actual = getActualWinnerCode(game);
  const predicted = getPredictedWinnerCode(game);
  if (!actual || !predicted || actual === 'TIE') return null;
  return {
    state: actual === predicted ? 'correct' : 'incorrect',
    tooltip: `Predicted ${predicted}, actual ${actual}`,
  };
}
function initials(first = "", last = "") {
  const f = (first || "").trim(); const l = (last || "").trim();
  return `${f ? f[0] : ""}${l ? l[0] : ""}`.toUpperCase() || "•";
}
function displayName(player, fallbackId) {
  if (!player) return `#${fallbackId}`;
  const f = (player.first_name || "").trim();
  const l = (player.last_name || "").trim();
  return l ? `${f ? f[0] + ". " : ""}${l}` : (f || `#${fallbackId}`);
}

// ---- BDL fetchers (same behaviour as in your drawer) ----
async function fetchTeamLast10UpToBDL(teamAbbr, anchorISO){
  const teamId = BDL_TEAM_ID[teamAbbr];
  if (!teamId) throw new Error(`Unknown team code: ${teamAbbr}`);
  const { start, end } = seasonWindowUpTo(anchorISO);
  const u = new URL("https://api.balldontlie.io/v1/games");
  u.searchParams.set("team_ids[]", String(teamId));
  u.searchParams.set("start_date", start);
  u.searchParams.set("end_date", end);
  u.searchParams.set("postseason", "false");
  u.searchParams.set("per_page", "100");
  let page = 1, all = [];
  while (true) {
    u.searchParams.set("page", String(page));
    const r = await fetch(u, { headers: bdlHeaders() });
    if (r.status === 401) throw new Error("BDL 401 (missing/invalid API key). Add REACT_APP_BDL_API_KEY in .env.local and restart.");
    if (!r.ok) throw new Error(`BDL HTTP ${r.status}`);
    const j = await r.json();
    all.push(...(j?.data||[]));
    if (!j?.meta?.next_page) break;
    page = j.meta.next_page;
  }
  const finals = all
    .filter(g => /final/i.test(g?.status||""))
    .filter(g => clampISODateOnly(g?.date) <= clampISODateOnly(end))
    .sort((a,b)=> new Date(b.date) - new Date(a.date))
    .slice(0,10)
    .map(g=>{
      const home=(g.home_team?.abbreviation||"HOME").toUpperCase();
      const away=(g.visitor_team?.abbreviation||"AWAY").toUpperCase();
      const isHome = home===teamAbbr;
      const my=isHome?g.home_team_score:g.visitor_team_score;
      const their=isHome?g.visitor_team_score:g.home_team_score;
      return {
        date: clampISODateOnly(g.date),
        opp: isHome?away:home,
        homeAway: isHome ? "Home" : "Away",
        result: my>their?"W":my<their?"L":"T",
        score: `${home} ${g.home_team_score} - ${away} ${g.visitor_team_score}`,
      };
    });
  return { team: teamAbbr, games: finals };
}

async function fetchHeadToHeadBDL(teamA_abbr, teamB_abbr, { start, end }){
  const teamA_id = BDL_TEAM_ID[teamA_abbr];
  if (!teamA_id) throw new Error(`Unknown team code: ${teamA_abbr}`);
  const u = new URL("https://api.balldontlie.io/v1/games");
  u.searchParams.set("team_ids[]", String(teamA_id));
  u.searchParams.set("start_date", start);
  u.searchParams.set("end_date", end);
  u.searchParams.set("per_page", "100");
  let page=1, all=[];
  while(true){
    u.searchParams.set("page", String(page));
    const r = await fetch(u, { headers: bdlHeaders() });
    if (r.status === 401) throw new Error("BDL 401 (missing/invalid API key). Add REACT_APP_BDL_API_KEY in .env.local and restart.");
    if (!r.ok) throw new Error(`BDL HTTP ${r.status}`);
    const j = await r.json();
    all.push(...(j?.data||[]));
    if (!j?.meta?.next_page) break;
    page = j.meta.next_page;
  }
  const vs = all.filter(g=>{
    const h=(g?.home_team?.abbreviation||"").toUpperCase();
    const v=(g?.visitor_team?.abbreviation||"").toUpperCase();
    return h===teamB_abbr || v===teamB_abbr;
  });
  let aWins=0, bWins=0;
  for(const g of vs){
    const hs=g?.home_team_score, as=g?.visitor_team_score;
    if (!Number.isFinite(hs)||!Number.isFinite(as)) continue;
    const homeAbbr=(g?.home_team?.abbreviation||"").toUpperCase();
    const aIsHome=homeAbbr===teamA_abbr;
    const aScore = aIsHome?hs:as;
    const bScore = aIsHome?as:hs;
    if (aScore>bScore) aWins++; else if (bScore>aScore) bWins++;
  }
  return { aWins, bWins };
}

// very small “prior only” probability so the UI can always show something
async function computePriorEdgeLite(homeCode, awayCode){
  // neutral 55% home baseline to avoid emptiness early season
  return { pHome: 0.55, provenance: "Simple prior: home baseline", mode: "prior",
           factors: [{label:"Home-court", value:"+ ~2-3 pts"}], confidence: 0.25, gamesUsed:{recentHome:0,recentAway:0} };
}

// blend recent form if we have both last-10 blocks; else fall back to prior
async function buildProbsForGameAsync({ game, awayData, homeData }) {
  const homeGames = homeData?.games || [];
  const awayGames = awayData?.games || [];
  if (!homeGames.length || !awayGames.length) {
    return computePriorEdgeLite(game?.home?.code, game?.away?.code);
  }
  // naive edge: use last-10 W-L as a quick proxy, then map to prob
  const W = (arr)=>arr.filter(g=>g.result==='W').length;
  const L = (arr)=>arr.filter(g=>g.result==='L').length;
  const homeEdge = (W(homeGames)-L(homeGames)) - (W(awayGames)-L(awayGames)); // between -10..+10
  const pHome = 1/(1+Math.exp(-homeEdge/3.0)); // squashed to [0,1]
  return {
    pHome, mode: "recent",
    factors: [{label:"Recent form edge (H−A)", value: `${homeEdge}`}],
    provenance: "Quick recent-form blend (last 10)",
    confidence: 0.6,
    gamesUsed: { recentHome: homeGames.length, recentAway: awayGames.length }
  };
}

// recent player mini-card (21d) with season fallback via /season_averages
async function fetchRecentPlayerAveragesBDL(teamAbbr, { days = 21, anchorISO = null } = {}) {
  const teamId = BDL_TEAM_ID[teamAbbr];
  if (!teamId) throw new Error(`Unknown team code: ${teamAbbr}`);
  const { start, end } = windowISO({ anchorISO, days });
  const u = new URL("https://api.balldontlie.io/v1/stats");
  u.searchParams.set("team_ids[]", String(teamId));
  u.searchParams.set("start_date", start);
  u.searchParams.set("end_date", end);
  u.searchParams.set("postseason", "false");
  u.searchParams.set("per_page", "100");
  let page=1, rows=[];
  while(true){
    u.searchParams.set("page", String(page));
    const r = await fetch(u, { headers: bdlHeaders() });
    if (!r.ok) throw new Error(`BDL ${r.status}`);
    const j = await r.json();
    rows.push(...(j?.data||[]));
    if (!j?.meta?.next_page) break;
    page=j.meta.next_page;
  }
  const by = new Map();
  for(const s of rows){
    const pid = Number(s?.player?.id ?? s?.player_id); if(!Number.isFinite(pid)) continue;
    if(!by.has(pid)) by.set(pid,{ player_id:pid, player:s.player||null, gp:0, min:0, pts:0, reb:0, ast:0 });
    const p = by.get(pid);
    p.gp += 1;
    p.min += parseMinToNumber(String(s?.min || s?.minutes || "0:00"));
    p.pts += +s.pts||0; p.reb += +s.reb||0; p.ast += +s.ast||0;
  }
  const avgs = Array.from(by.values()).map(p=>({
    player_id:p.player_id, player:p.player,
    min: `${Math.floor((p.min/p.gp)||0)}:${String(Math.round((((p.min/p.gp)%1)*60))||0).padStart(2,'0')}`,
    pts:(p.pts/p.gp)||0, reb:(p.reb/p.gp)||0, ast:(p.ast/p.gp)||0
  }));
  avgs.sort((a,b)=> parseMinToNumber(b.min)-parseMinToNumber(a.min) || (b.pts||0)-(a.pts||0));
  return { players: avgs.slice(0,3), window: `${start}→${end}` };
}

// ========= small UI widgets (same visuals you already use) =========
export function Last10List({ title, loading, error, data }){
  const record = useMemo(()=>{
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
          <List dense sx={{ maxHeight: '45vh', overflow:'auto' }}>
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

export function ProbabilityCard({ probs, homeCode, awayCode, verdict }) {
  if (!probs) return null;
  const pct = Math.round(probs.pHome * 100);
  return (
    <Card variant="outlined" sx={{ borderRadius:1, mt:2 }}>
      <CardContent sx={{ p:2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="baseline" spacing={1}>
            <Typography variant="subtitle2" sx={{ fontWeight:700 }}>Model edge</Typography>
            <Typography variant="caption" sx={{ opacity:0.7 }}>(home win)</Typography>
            {probs?.mode && <Typography variant="caption" sx={{ opacity:0.6, ml:1 }}>{probs.mode}</Typography>}
          </Stack>
          {verdict && (
            verdict.state === 'correct' ? (
              <Tooltip title={verdict.tooltip}><Chip size="small" color="success" variant="outlined" icon={<CheckCircleIcon fontSize="small" />} label="Correct" /></Tooltip>
            ) : (
              <Tooltip title={verdict.tooltip}><Chip size="small" color="error" variant="outlined" icon={<CancelIcon fontSize="small" />} label="Wrong" /></Tooltip>
            )
          )}
        </Stack>

        {typeof probs?.confidence === 'number' && (
          <Chip size="small" variant="outlined" sx={{ ml:1 }} label={`Confidence ${Math.round(probs.confidence*100)}%${probs?.gamesUsed ? ` · H${probs.gamesUsed.recentHome}/A${probs.gamesUsed.recentAway}` : ''}`} />
        )}

        <Stack direction="row" alignItems="center" spacing={1} sx={{ mt:1 }}>
          <Typography variant="h5" sx={{ fontWeight:800 }}>{pct}%</Typography>
          <Typography variant="body2" sx={{ opacity:0.75 }}>{homeCode} vs {awayCode}</Typography>
        </Stack>

        <Box sx={{ mt:1.25, height:8, bgcolor:'action.hover', borderRadius:1, overflow:'hidden' }}>
          <Box sx={{ width: `${pct}%`, height:'100%', bgcolor:'primary.main' }} />
        </Box>

        {probs.provenance && (
          <Typography variant="caption" sx={{ display:'block', opacity:0.75, mt:1 }}>{probs.provenance}</Typography>
        )}

        <List dense sx={{ mt:1 }}>
          {(probs.factors||[]).map((f,i)=>(
            <ListItem key={i} disableGutters sx={{ py:0.25 }}>
              <ListItemText primaryTypographyProps={{ variant:'body2' }} primary={`${f.label}: ${f.value}`} />
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
}

function PlayerPill({ avg, accent = 'primary.main' }) {
  const name = displayName(avg.player, avg.player_id);
  const iv = initials(avg?.player?.first_name, avg?.player?.last_name);
  return (
    <Chip
      avatar={
        <Avatar sx={{ width:22, height:22, fontSize:12, bgcolor:(t)=>t.palette.action.hover, color:(t)=>t.palette.text.primary, border:'2px solid', borderColor: accent }}>
          {iv}
        </Avatar>
      }
      label={
        <Box sx={{ display:'flex', flexDirection:'row', alignItems:'baseline', gap:1, justifyContent:'flex-start', textAlign:'left', width:'100%' }}>
          <Typography variant="body2" sx={{ fontWeight:700, lineHeight:1 }}>{name}</Typography>
          <Typography variant="caption" sx={{ opacity:0.9, lineHeight:1, fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
            {nf1(avg.pts)} PTS · {nf1(avg.reb)} REB · {nf1(avg.ast)} AST
          </Typography>
        </Box>
      }
      sx={{ borderRadius:999, px:0.5, py:0.25, bgcolor:(t)=>t.palette.action.selected, '& .MuiChip-label': { py:0.5, width:'100%' } }}
      variant="filled"
    />
  );
}

export function NarrativeBlock({ game, probs, a, b, h2h, mini, miniModeLabel = "last 21 days" }) {
  if (!game) return null;
  const status = String(game?.status || "");
  const isFinal = /final/i.test(status);
  const isLive  = /in progress|end of|halftime|quarter|q\d/i.test(status);
  const home = game?.home?.code || "HOME";
  const away = game?.away?.code || "AWAY";

  const last10Home = b?.data?.games || [];
  const last10Away = a?.data?.games || [];
  const WLT = (arr) => { let w=0,l=0,t=0; arr.forEach(g => (g.result==='W'?w++:g.result==='L'?l++:t++)); return `${w}-${l}${t?`-${t}`:''}`; };
  const hForm = last10Home.length ? WLT(last10Home) : "0-0";
  const aForm = last10Away.length ? WLT(last10Away) : "0-0";
  const h2hLine = h2h?.data ? `This season, ${home} lead the series ${h2h.data.aWins}–${h2h.data.bWins}.` : "";

  const pct = Number.isFinite(+probs?.pHome) ? Math.round(probs.pHome*100) : null;
  const modelLine = pct==null ? "" : `Our model gives ${home} a ${pct}% chance at home.`;

  return (
    <Card variant="outlined" sx={{ borderRadius:1 }}>
      <CardContent sx={{ p:2 }}>
        <Typography component="h2" variant="subtitle1" sx={{ fontWeight:700, mb:0.5 }}>
          {isFinal ? "Game recap" : isLive ? "Live update" : "Game preview"}
        </Typography>

        <Typography variant="body2" sx={{ mb:1 }}>
          {isFinal
            ? `Final in the books: ${(Number(game?.homeScore)>Number(game?.awayScore)?home:away)} win ${Math.max(Number(game?.homeScore)||0,Number(game?.awayScore)||0)}–${Math.min(Number(game?.homeScore)||0,Number(game?.awayScore)||0)}.`
            : `${away} visit ${home}. Recent form: ${home} ${hForm}, ${away} ${aForm}.`}
        </Typography>

        {modelLine && <Typography variant="body2" sx={{ mb:1 }}>{modelLine}</Typography>}

        <List dense sx={{ mt:0, pt:0 }}>
          {probs?.factors?.length ? (
            <ListItem disableGutters sx={{ py:0.25 }}>
              <ListItemText primaryTypographyProps={{ variant:'body2' }} primary={`Watch for ${probs.factors.slice(0,3).map(f=>f.label.toLowerCase()).join(", ")}.`} />
            </ListItem>
          ) : null}
          {h2hLine && (
            <ListItem disableGutters sx={{ py:0.25 }}>
              <ListItemText primaryTypographyProps={{ variant:'body2' }} primary={h2hLine} />
            </ListItem>
          )}
        </List>
      </CardContent>
    </Card>
  );
}

// ========= the actual shared panel you can render anywhere =========
export default function GameComparePanel({ game }) {
  const [a, setA] = useState({ loading: true, error: null, data: null }); // away
  const [b, setB] = useState({ loading: true, error: null, data: null }); // home
  const [probs, setProbs] = useState(null);
  const [h2h, setH2h] = useState({ loading: true, error: null, data: null });
  const [mini, setMini] = useState({ loading: true, error: null, data: null });
  const [miniModeLabel, setMiniModeLabel] = useState("last 21 days");

  const anchorISO = (game?._iso || "").slice(0,10) || (game?.dateKey || new Date().toISOString().slice(0,10));

  // last-10 (this season up to anchor)
  useEffect(()=>{ let cancelled=false; (async()=>{
    if (!game?.home?.code || !game?.away?.code) return;
    try{
      setA({loading:true,error:null,data:null});
      setB({loading:true,error:null,data:null});
      const [Ares, Bres] = await Promise.all([
        fetchTeamLast10UpToBDL(game.away.code, anchorISO),
        fetchTeamLast10UpToBDL(game.home.code, anchorISO),
      ]);
      if (cancelled) return;
      setA({loading:false,error:null,data:Ares});
      setB({loading:false,error:null,data:Bres});
    }catch(e){
      if (cancelled) return;
      const msg = e?.message || String(e);
      setA({loading:false,error:msg,data:{ games: [] }});
      setB({loading:false,error:msg,data:{ games: [] }});
    }
  })(); return ()=>{cancelled=true}; }, [game?.home?.code, game?.away?.code, anchorISO]);

  // h2h (this season)
  useEffect(()=>{ let cancelled=false; (async()=>{
    try{
      setH2h({loading:true,error:null,data:null});
      const { start, end } = seasonWindowUpTo(anchorISO);
      const { aWins, bWins } = await fetchHeadToHeadBDL(game.home.code, game.away.code, { start, end });
      if (cancelled) return;
      setH2h({loading:false,error:null,data:{ aWins, bWins }});
    }catch(e){
      if (cancelled) return;
      setH2h({loading:false,error:e?.message||String(e),data:null});
    }
  })(); return ()=>{cancelled=true}; }, [game?.home?.code, game?.away?.code, anchorISO]);

  // mini player averages (recent); simple fallback text if blocked
  useEffect(()=>{ let cancelled=false; (async()=>{
    try{
      setMini({loading:true,error:null,data:null});
      const [awayRecent, homeRecent] = await Promise.all([
        fetchRecentPlayerAveragesBDL(game.away.code, { days: 21, anchorISO }),
        fetchRecentPlayerAveragesBDL(game.home.code, { days: 21, anchorISO }),
      ]);
      if (cancelled) return;
      setMini({ loading:false, error:null, data: { away: awayRecent.players, home: homeRecent.players }});
      setMiniModeLabel("last 21 days");
    }catch(e){
      if (cancelled) return;
      setMini({ loading:false, error:"Recent player stats unavailable on your key/tier.", data:null });
      setMiniModeLabel("players unavailable");
    }
  })(); return ()=>{cancelled=true}; }, [game?.home?.code, game?.away?.code, anchorISO]);

  // probs once last-10 present
  useEffect(()=>{ let cancelled=false; (async()=>{
    if (a.loading || b.loading) return;
    if (a.error || b.error) { setProbs(null); return; }
    const built = await buildProbsForGameAsync({ game, awayData: a.data, homeData: b.data });
    if (!cancelled) setProbs(built);
  })(); return ()=>{cancelled=true}; }, [a.loading,b.loading,a.error,b.error,a.data,b.data,game]);

  const verdict = modelVerdict(game);

  return (
    <Box sx={{ flex: 1, minHeight: 0 }}>
      {/* Narrative */}
      <NarrativeBlock game={game} probs={probs} a={a} b={b} h2h={h2h} mini={mini} miniModeLabel={miniModeLabel} />

      <Divider sx={{ my: 1 }} />

      {/* Recent form lists */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Last10List title={`${game?.away?.code} (${game?.away?.name})`} loading={a.loading} error={a.error} data={a.data} />
        <Last10List title={`${game?.home?.code} (${game?.home?.name})`} loading={b.loading} error={b.error} data={b.data} />
      </Stack>

      <Typography variant="caption" sx={{ opacity: 0.65, mt: 0.25, display:'block' }}>
        Showing last 10 this season up to {anchorISO}
      </Typography>

      {/* Probability */}
      <ProbabilityCard probs={probs} homeCode={game?.home?.code} awayCode={game?.away?.code} verdict={verdict} />

      {/* H2H */}
      {h2h.loading ? (
        <Typography variant="caption" sx={{ opacity:0.7, mt:1, display:'block' }}>
          Loading season series…
        </Typography>
      ) : h2h.error ? (
        <Typography variant="caption" color="warning.main" sx={{ mt:1, display:'block' }}>
          H2H error: {h2h.error}
        </Typography>
      ) : h2h.data ? (
        <Typography variant="body2" sx={{ mt:1 }}>
          Season series: <strong>{game?.home?.code} {h2h.data.aWins}–{h2h.data.bWins} {game?.away?.code}</strong>
        </Typography>
      ) : null}

      {/* Top players */}
      <Accordion sx={{ mt:1.5 }} disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" sx={{ fontWeight:700 }}>Top players</Typography>
          <Typography variant="caption" sx={{ ml:1, opacity:0.7 }}>{miniModeLabel}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {mini.loading ? (
            <Stack alignItems="center" sx={{ py:1 }}><CircularProgress size={18} /></Stack>
          ) : mini.error ? (
            <Typography variant="caption" color="warning.main">{mini.error}</Typography>
          ) : mini.data ? (
            <Stack spacing={1.25}>
              {/* Away */}
              <Stack direction="row" alignItems="flex-start" spacing={1}>
                <Chip size="small" variant="outlined" label={game?.away?.code} sx={{ minWidth:56, justifyContent:'center' }} />
                <Box sx={{ flex:1, pl:1.5, mt:0.25, borderLeft:'3px solid', borderColor:(t)=>t.palette.info.main }}>
                  <Stack direction="column" spacing={1} sx={{ '& > *': { maxWidth: '100%' } }}>
                    {mini.data.away.map((p)=> <PlayerPill key={`a-${p.player_id}`} avg={p} accent={(t)=>t.palette.info.main} />)}
                  </Stack>
                </Box>
              </Stack>
              {/* Home */}
              <Stack direction="row" alignItems="flex-start" spacing={1}>
                <Chip size="small" variant="outlined" label={game?.home?.code} sx={{ minWidth:56, justifyContent:'center' }} />
                <Box sx={{ flex:1, pl:1.5, mt:0.25, borderLeft:'3px solid', borderColor:(t)=>t.palette.success.main }}>
                  <Stack direction="column" spacing={1} sx={{ '& > *': { maxWidth: '100%' } }}>
                    {mini.data.home.map((p)=> <PlayerPill key={`h-${p.player_id}`} avg={p} accent={(t)=>t.palette.success.main} />)}
                  </Stack>
                </Box>
              </Stack>
            </Stack>
          ) : null}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
