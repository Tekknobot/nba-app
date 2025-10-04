// src/components/GameComparePanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Card, CardContent, Chip, CircularProgress, Divider, Tooltip,
  Typography, List, ListItem, ListItemText, Stack, Avatar
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Accordion, AccordionSummary, AccordionDetails } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";

/* ====================== small utils ====================== */
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
const isoDaysAgo = (n, from = new Date()) => {
  const d = new Date(from); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0,10);
};
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const logit = (p) => Math.log(Math.max(1e-9, Math.min(1-1e-9, p)) / (1 - Math.max(1e-9, Math.min(1-1e-9, p))));
const ilogit = (z) => 1 / (1 + Math.exp(-z));

/* ====================== maps ====================== */
const BDL_TEAM_ID = {
  ATL:1, BOS:2, BKN:3, CHA:4, CHI:5, CLE:6, DAL:7, DEN:8, DET:9,
  GSW:10, HOU:11, IND:12, LAC:13, LAL:14, MEM:15, MIA:16, MIL:17,
  MIN:18, NOP:19, NYK:20, OKC:21, ORL:22, PHI:23, PHX:24, POR:25,
  SAC:26, SAS:27, TOR:28, UTA:29, WAS:30
};

/* ====================== season windows ====================== */
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
function lastCompletedSeasonEndYear(today = new Date()){
  // NBA seasons end in June; last completed ended this calendar year if month >= July
  const y = today.getFullYear();
  const m = today.getMonth(); // 0=Jan
  return (m >= 6) ? y : (y - 1);
}

/* ====================== verdict helpers (mirrored with calendar) ====================== */
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
  const pick = String(game?.model?.predictedWinner || "").toUpperCase().trim();
  if (pick === "HOME" && homeCode) return homeCode;
  if (pick === "AWAY" && awayCode) return awayCode;
  if (pick) return pick;
  const pHome = Number(game?.model?.pHome);
  if (Number.isFinite(pHome) && homeCode && awayCode) return pHome > 0.5 ? homeCode : awayCode;
  return null;
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
    label: "Model"
  };
}

/* ====================== BDL fetchers used by the panel ====================== */
// last-10 up to anchor (this season)
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

// season H2H in this year window
async function fetchHeadToHeadBDL(teamA_abbr, teamB_abbr, { start, end }){
  const teamId = BDL_TEAM_ID[teamA_abbr];
  if (!teamId) throw new Error(`Unknown team code: ${teamA_abbr}`);
  const u = new URL("https://api.balldontlie.io/v1/games");
  u.searchParams.set("team_ids[]", String(teamId));
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

// recent player averages (21d)
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

/* ====================== prior edge (more accurate model) ====================== */
// Average point differential over a season window
async function fetchTeamSeasonPointDiffBDL(teamAbbr, seasonEndYear){
  const teamId = BDL_TEAM_ID[teamAbbr];
  if (!teamId) throw new Error(`Unknown team code: ${teamAbbr}`);
  const start = `${seasonEndYear-1}-10-01`;
  const end   = `${seasonEndYear}-06-30`;

  const u = new URL("https://api.balldontlie.io/v1/games");
  u.searchParams.set("team_ids[]", String(teamId));
  u.searchParams.set("start_date", start);
  u.searchParams.set("end_date", end);
  u.searchParams.set("postseason", "false");
  u.searchParams.set("per_page", "100");

  let page = 1, gp = 0, sumMargin = 0;
  while (true) {
    u.searchParams.set("page", String(page));
    const r = await fetch(u, { headers: bdlHeaders() });
    if (r.status === 401) throw new Error("BDL 401 (missing/invalid API key). Add REACT_APP_BDL_API_KEY in .env.local and restart.");
    if (!r.ok) throw new Error(`BDL HTTP ${r.status}`);
    const j = await r.json();
    const data = Array.isArray(j?.data) ? j.data : [];
    for (const g of data) {
      const hs = g?.home_team_score, as = g?.visitor_team_score;
      if (!Number.isFinite(hs) || !Number.isFinite(as)) continue;
      const home = (g?.home_team?.abbreviation || "").toUpperCase();
      const isHome = home === teamAbbr;
      const my = isHome ? hs : as;
      const opp = isHome ? as : hs;
      gp += 1; sumMargin += (my - opp);
    }
    if (!j?.meta?.next_page) break;
    page = j.meta.next_page;
  }
  const diff = gp ? (sumMargin / gp) : 0;
  return { gp, diff };
}

// Tiny preseason adjustment from last 30 days
async function fetchTinyPreseasonNudgeBDL(teamAbbr){
  const teamId = BDL_TEAM_ID[teamAbbr];
  if (!teamId) return 0;
  const u = new URL("https://api.balldontlie.io/v1/games");
  u.searchParams.set("team_ids[]", String(teamId));
  u.searchParams.set("start_date", isoDaysAgo(30));
  u.searchParams.set("end_date", new Date().toISOString().slice(0,10));
  u.searchParams.set("per_page", "100");

  const r = await fetch(u, { headers: bdlHeaders() });
  if (!r.ok) return 0;
  const j = await r.json();
  const data = Array.isArray(j?.data) ? j.data : [];

  let gp = 0, sumMargin = 0;
  for (const g of data) {
    if (!/final/i.test(g?.status || "")) continue;
    const hs = g?.home_team_score, as = g?.visitor_team_score;
    if (!Number.isFinite(hs) || !Number.isFinite(as)) continue;
    const home = (g?.home_team?.abbreviation || "").toUpperCase();
    const isHome = home === teamAbbr;
    const my = isHome ? hs : as;
    const opp = isHome ? as : hs;
    gp += 1; sumMargin += (my - opp);
  }
  if (!gp) return 0;
  return (sumMargin / gp) * 0.2; // tiny weight
}

const HCA_POINTS = 2.3; // baseline home-court advantage
const logistic = (pointAdv, scale = 6.5) => 1 / (1 + Math.exp(-Math.max(-50, Math.min(50, pointAdv/scale))));

async function computePriorEdgeBDL(homeCode, awayCode){
  const prevSeasonEnd = lastCompletedSeasonEndYear();
  const [homePrev, awayPrev] = await Promise.all([
    fetchTeamSeasonPointDiffBDL(homeCode, prevSeasonEnd),
    fetchTeamSeasonPointDiffBDL(awayCode, prevSeasonEnd),
  ]);
  const [hPre, aPre] = await Promise.all([
    fetchTinyPreseasonNudgeBDL(homeCode),
    fetchTinyPreseasonNudgeBDL(awayCode),
  ]);

  const pointAdv = (homePrev.diff - awayPrev.diff) + HCA_POINTS + (hPre - aPre);
  const pHome = logistic(pointAdv, 6.5);

  return {
    pHome,
    factors: [
      { label: "Last season diff (H−A)", value: `${(homePrev.diff - awayPrev.diff).toFixed(2)} pts/g` },
      { label: "Home-court", value: `${HCA_POINTS.toFixed(1)} pts` },
      { label: "Preseason nudge", value: `${(hPre - aPre).toFixed(2)} pts` },
    ],
    mode: "prior",
    confidence: 0.25
  };
}

/* ====================== recent-form edge + blend ====================== */
// quick recent form pHome from W-L delta
function computeRecentEdgeFromLast10(awayPack, homePack){
  const away = awayPack?.games || [];
  const home = homePack?.games || [];
  if (!home.length || !away.length) return null;

  const W = (arr)=>arr.filter(g=>g.result==='W').length;
  const L = (arr)=>arr.filter(g=>g.result==='L').length;
  const homeEdge = (W(home)-L(home)) - (W(away)-L(away));  // [-10..+10]
  const pHome = 1 / (1 + Math.exp(-homeEdge/3.0));

  return {
    pHome,
    factors: [{ label: "Recent form (H−A)", value: `${homeEdge>0?'+':''}${homeEdge}` }],
    mode: "recent",
    confidence: 0.6
  };
}

/* If possible, blend prior + recent using logit blend with alpha based on games seen */
async function computeBlendedEdge({ homeCode, awayCode, awayPack, homePack }){
  const recent = computeRecentEdgeFromLast10(awayPack, homePack);
  if (!recent) return null;

  const prior = await computePriorEdgeBDL(homeCode, awayCode);

  // number of recent games available (finals)
  const nH = (homePack?.games || []).length;
  const nA = (awayPack?.games || []).length;
  const nEff = Math.min(nH, nA);

  const alpha = clamp01(
    nEff >= 5 ? 0.80 :
    nEff === 4 ? 0.70 :
    nEff === 3 ? 0.55 :
    nEff === 2 ? 0.40 :
    nEff === 1 ? 0.25 : 0.00
  );

  const z = (1 - alpha) * logit(prior.pHome) + alpha * logit(recent.pHome);
  const pHome = ilogit(z);

  const factors = [
    ...recent.factors,
    ...prior.factors
  ];

  return {
    pHome,
    factors,
    mode: alpha >= 0.8 ? "recent" : "blend",
    confidence: Math.max(0.25, alpha)
  };
}

/* ====================== UI widgets ====================== */
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
function PlayerPill({ avg, accent = 'primary.main' }) {
  const name = displayName(avg.player, avg.player_id);
  const iv = initials(avg?.player?.first_name, avg?.player?.last_name);
  return (
    <Chip
      avatar={
        <Avatar sx={{
          width:22, height:22, fontSize:12,
          bgcolor:(t)=>t.palette.action.hover,
          color:(t)=>t.palette.text.primary,
          border:'2px solid', borderColor: accent
        }}>{iv}</Avatar>
      }
      label={
        <Box sx={{ display:'flex', flexDirection:'row', alignItems:'baseline', gap:1, textAlign:'left', width:'100%' }}>
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

function Last10List({ title, loading, error, data }){
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

/* Verdict that can fall back to the computed edge when model pick is missing */
function panelVerdict(game, edge){
  const mv = modelVerdict(game);
  if (mv) return mv; // use model verdict if available

  const isFinal = (game?.status || '').toLowerCase().includes('final');
  if (!isFinal || !edge || !Number.isFinite(edge.pHome)) return null;

  const home = codeify(game?.home, 'HOME');
  const away = codeify(game?.away, 'AWAY');
  const predicted = edge.pHome > 0.5 ? home : away;
  const actual = getActualWinnerCode(game);
  if (!actual || actual === 'TIE') return null;

  const pct = Math.round(edge.pHome * 100);
  return {
    state: actual === predicted ? 'correct' : 'incorrect',
    tooltip: `Edge predicted ${predicted} (${pct}%), actual ${actual}`,
    label: "Edge"
  };
}

function ProbabilityCard({ game, edge }) {
  const verdict = panelVerdict(game, edge);

  // choose probability: prefer model.pHome, otherwise the blended/ recent edge
  const pModel = Number(game?.model?.pHome);
  const hasModelProb = Number.isFinite(pModel);
  const pFromEdge = Number(edge?.pHome);
  const hasEdgeProb = Number.isFinite(pFromEdge);

  const pHome = hasModelProb ? pModel : (hasEdgeProb ? pFromEdge : NaN);
  const hasProb = Number.isFinite(pHome);
  const pct = hasProb ? Math.round(pHome * 100) : null;

  if (!hasProb && !verdict) return null;

  const homeCode = game?.home?.code;
  const awayCode = game?.away?.code;

  const modeHint = hasModelProb
    ? "model prob"
    : (edge?.mode || "recent");

  return (
    <Card variant="outlined" sx={{ borderRadius:1, mt:2 }}>
      <CardContent sx={{ p:2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="baseline" spacing={1}>
            <Typography variant="subtitle2" sx={{ fontWeight:700 }}>
              Model edge
            </Typography>
            {hasProb && (
              <Typography variant="caption" sx={{ opacity:0.7 }}>
                (home win)
              </Typography>
            )}
            <Typography variant="caption" sx={{ opacity:0.6, ml:1 }}>
              {modeHint}
            </Typography>
            {Number.isFinite(edge?.confidence) && (
              <Typography variant="caption" sx={{ opacity:0.6, ml:1 }}>
                conf ~{Math.round(edge.confidence*100)}%
              </Typography>
            )}
          </Stack>

          {verdict && (verdict.state === 'correct'
            ? (
              <Tooltip title={verdict.tooltip}>
                <Chip size="small" color="success" variant="outlined"
                      icon={<CheckCircleIcon fontSize="small" />} label={verdict.label} />
              </Tooltip>
            ) : (
              <Tooltip title={verdict.tooltip}>
                <Chip size="small" color="error" variant="outlined"
                      icon={<CancelIcon fontSize="small" />} label={verdict.label} />
              </Tooltip>
            )
          )}
        </Stack>

        {/* With probability -> show number + bar. Without -> simple pick line */}
        {hasProb ? (
          <>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt:1 }}>
              <Typography variant="h5" sx={{ fontWeight:800 }}>{pct}%</Typography>
              <Typography variant="body2" sx={{ opacity:0.75 }}>
                {homeCode} vs {awayCode}
              </Typography>
            </Stack>
            <Box sx={{ mt:1.25, height:8, bgcolor:'action.hover', borderRadius:1, overflow:'hidden' }}>
              <Box sx={{ width: `${pct}%`, height:'100%', bgcolor:'primary.main' }} />
            </Box>
          </>
        ) : (
          <Typography variant="body2" sx={{ mt:1, opacity:0.85 }}>
            Model pick: <strong>{getPredictedWinnerCode(game) || '—'}</strong>
          </Typography>
        )}

        {/* Factors */}
        {(edge?.factors?.length) ? (
          <List dense sx={{ mt:1 }}>
            {edge.factors.slice(0,4).map((f,i)=>(
              <ListItem key={i} disableGutters sx={{ py:0.25 }}>
                <ListItemText primaryTypographyProps={{ variant:'body2' }}
                              primary={`${f.label}: ${f.value}`} />
              </ListItem>
            ))}
          </List>
        ) : null}
      </CardContent>
    </Card>
  );
}

function NarrativeBlock({ game, a, b, h2h }) {
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

  return (
    <Card variant="outlined" sx={{ borderRadius:1 }}>
      <CardContent sx={{ p:2 }}>
        <Typography component="h2" variant="subtitle1" sx={{ fontWeight:700, mb:0.5 }}>
          {isFinal ? "Game recap" : isLive ? "Live update" : "Game preview"}
        </Typography>

        <Typography variant="body2" sx={{ mb:1 }}>
          {isFinal
            ? `Final: ${(Number(game?.homeScore)>Number(game?.awayScore)?home:away)} win ${Math.max(game.homeScore ?? 0, game.awayScore ?? 0)}–${Math.min(game.homeScore ?? 0, game.awayScore ?? 0)}.`
            : `${away} visit ${home}. Recent form: ${home} ${hForm}, ${away} ${aForm}.`}
        </Typography>

        {h2hLine && (
          <List dense sx={{ mt:0, pt:0 }}>
            <ListItem disableGutters sx={{ py:0.25 }}>
              <ListItemText primaryTypographyProps={{ variant:'body2' }} primary={h2hLine} />
            </ListItem>
          </List>
        )}
      </CardContent>
    </Card>
  );
}

/* ====================== main shared panel ====================== */
export default function GameComparePanel({ game }) {
  const [a, setA] = useState({ loading: true, error: null, data: null }); // away last-10
  const [b, setB] = useState({ loading: true, error: null, data: null }); // home last-10
  const [h2h, setH2h] = useState({ loading: true, error: null, data: null });
  const [mini, setMini] = useState({ loading: true, error: null, data: null });
  const [miniModeLabel, setMiniModeLabel] = useState("last 21 days");

  // blended / recent model edge shown in the card
  const [edge, setEdge] = useState(null);

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

  // mini player avgs (recent, soft-fail)
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

  // compute the edge (blend prior + recent) when last-10 ready
  useEffect(() => { let stop=false; (async()=>{
    if (a.loading || b.loading || a.error || b.error || !a.data || !b.data) { setEdge(null); return; }
    try {
      const blended = await computeBlendedEdge({
        homeCode: game?.home?.code,
        awayCode: game?.away?.code,
        awayPack: a.data,
        homePack: b.data
      });
      if (!stop) setEdge(blended || computeRecentEdgeFromLast10(a.data, b.data));
    } catch {
      if (!stop) setEdge(computeRecentEdgeFromLast10(a.data, b.data));
    }
  })(); return ()=>{ stop=true; }; }, [a.loading, b.loading, a.error, b.error, a.data, b.data, game?.home?.code, game?.away?.code]);

  return (
    <Box sx={{ flex: 1, minHeight: 0 }}>
      {/* Narrative */}
      <NarrativeBlock game={game} a={a} b={b} h2h={h2h} />

      <Divider sx={{ my: 1 }} />

      {/* Recent form lists */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Last10List title={`${game?.away?.code} (${game?.away?.name})`} loading={a.loading} error={a.error} data={a.data} />
        <Last10List title={`${game?.home?.code} (${game?.home?.name})`} loading={b.loading} error={b.error} data={b.data} />
      </Stack>

      <Typography variant="caption" sx={{ opacity: 0.65, mt: 0.25, display:'block' }}>
        Showing last 10 this season up to {anchorISO}
      </Typography>

      {/* Probability (model/edge) */}
      <ProbabilityCard game={game} edge={edge} />

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
