// src/components/GameComparePanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Card, CardContent, Chip, CircularProgress, Divider, Tooltip,
  Typography, List, ListItem, ListItemText, Stack, Avatar
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Accordion, AccordionSummary, AccordionDetails } from "@mui/material";
import { logoForTeam } from "../utils/teamAssets";

// Explain *why* there is no current-season data at the selected anchor date
function noDataReason(anchorISO) {
  const { start, end } = seasonWindowUpTo(anchorISO);
  const a = new Date(`${anchorISO}T12:00:00Z`);
  const startDt = new Date(`${start}T00:00:00Z`);
  const endDt   = new Date(`${end}T23:59:59Z`);

  if (a < startDt) return `Regular season hasn’t started as of ${anchorISO}.`;
  if (a > endDt)   return `Regular season is over as of ${anchorISO}.`;
  return `No completed regular-season games for one or both teams up to ${anchorISO}.`;
}

/* ====================== small utils ====================== */
const nf1 = (v) => (v ?? 0).toFixed(1);
const clampISODateOnly = (iso) => (iso || "").slice(0, 10);

/* ====================== season windows ====================== */
function seasonWindowUpTo(anchorISO){
  const d = new Date(anchorISO || new Date());
  const endYear = (d.getMonth() >= 9) ? d.getFullYear() + 1 : d.getFullYear();
  const start = `${endYear - 1}-10-01`;
  const end   = clampISODateOnly(anchorISO) || `${endYear}-06-30`;
  return { start, end, endYear };
}

/* ====================== keyless PIVT NBA data client ====================== */
async function nbaData(action, params = {}) {
  const q = new URLSearchParams({ action, ...Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)])
  )});
  const r = await fetch(`/api/nba-data?${q.toString()}`, { cache: "no-store" });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body?.detail || body?.error || `NBA data HTTP ${r.status}`);
  return body;
}

async function fetchGameByIdPublic(gameId){
  if (!gameId) throw new Error("Missing game id");
  const { game } = await nbaData("game", { id: gameId });
  return game || {};
}

async function fetchTeamLast10UpToPublic(teamAbbr, anchorISO){
  const body = await nbaData("team-last10", { team: teamAbbr, anchor: anchorISO });
  return { team: body?.team || teamAbbr, games: Array.isArray(body?.games) ? body.games : [] };
}

async function fetchHeadToHeadPublic(teamA_abbr, teamB_abbr, { start, end }){
  const body = await nbaData("h2h", { a: teamA_abbr, b: teamB_abbr, start, end });
  return { aWins: Number(body?.aWins || 0), bWins: Number(body?.bWins || 0) };
}

async function fetchRecentPlayerAveragesPublic(teamAbbr, { days = 21, anchorISO = null, topN = 3 } = {}) {
  const body = await nbaData("top-players", { team: teamAbbr, days, anchor: anchorISO, topN });
  return {
    players: Array.isArray(body?.players) ? body.players : [],
    _mode: body?._mode || "recent",
    _season: body?._season,
  };
}

/* ====================== tiny UI bits ====================== */
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
        <Avatar src={avg?.image || ""} alt="" sx={{
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

function Last10List({ title, loading, error, data, note }){
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
          <Stack spacing={0.5}>
            <Typography variant="body2" sx={{ color: 'info.main' }}>
              No data available.
            </Typography>
            {note && (
              <Typography variant="caption" sx={{ color: 'info.main' }}>
                {note}
              </Typography>
            )}
          </Stack>
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

function formatWhenFromGame(game) {
  // Prefer the ISO with a real clock; fall back to dateKey-only
  if (game?._iso && game?.hasClock) {
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" })
        .format(new Date(game._iso));
    } catch {}
  }
  if (game?.dateKey) {
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" })
        .format(new Date(`${game.dateKey}T12:00:00Z`));
    } catch {}
  }
  return "TBD";
}

function shortLiveStatusLabel(status = "") {
  const s = String(status);
  const m = s.match(/end of\s*(\d)/i);
  if (m) return `End Q${m[1]}`;
  // Common live-status labels: "In Progress", "Halftime", "Final", etc.
  return s;
}

function NarrativeBlock({ game, a, b, h2h }) {
  if (!game) return null;

  const status = String(game?.status || "");
  const isFinal = /final/i.test(status);
  const isLive  = /in progress|end of|halftime|quarter|q\d/i.test(status);

  const homeCode = game?.home?.code || "HOME";
  const awayCode = game?.away?.code || "AWAY";
  const homeName = game?.home?.name || homeCode;
  const awayName = game?.away?.name || awayCode;

  const homeScore = Number.isFinite(game?.homeScore) ? Number(game.homeScore) : null;
  const awayScore = Number.isFinite(game?.awayScore) ? Number(game.awayScore) : null;

  const last10Home = a?.data?.team === homeCode ? a?.data?.games : b?.data?.games || [];
  const last10Away = a?.data?.team === awayCode ? a?.data?.games : a?.data?.games || [];

  const WLT = (arr = []) => {
    let w=0,l=0,t=0;
    arr.forEach(g => (g.result==='W'?w++:g.result==='L'?l++:t++));
    return `${w}-${l}${t?`-${t}`:''}`;
  };
  const hForm = (b?.data?.games?.length ? WLT(b.data.games) : (a?.data?.team === homeCode ? WLT(a?.data?.games) : WLT(last10Home))) || "0-0";
  const aForm = (a?.data?.games?.length ? WLT(a.data.games) : (b?.data?.team === awayCode ? WLT(b?.data?.games) : WLT(last10Away))) || "0-0";

  const whenLabel = formatWhenFromGame(game);

  // H2H line (this season)
  const h2hLine = h2h?.data ? `This season: ${homeCode} ${h2h.data.aWins}–${h2h.data.bWins} ${awayCode}.` : "";

  // Compose the first sentence for each state
  let headline;
  if (isFinal) {
    if (homeScore !== null && awayScore !== null) {
      const homeWon = homeScore > awayScore;
      const winnerName = homeWon ? homeName : awayName;
      const loserName  = homeWon ? awayName : homeName;
      const winnerPts  = Math.max(homeScore, awayScore);
      const loserPts   = Math.min(homeScore, awayScore);
      const margin = winnerPts - loserPts;
      headline = `Final — ${winnerName} beat ${loserName} ${winnerPts}–${loserPts}${margin ? ` (by ${margin})` : ""}.`;
    } else {
      headline = `Final — ${awayName} at ${homeName}.`;
    }
  } else if (isLive) {
    const liveLabel = shortLiveStatusLabel(status);
    headline = `Live — ${homeCode} ${homeScore ?? "–"} — ${awayCode} ${awayScore ?? "–"} (${liveLabel}).`;
  } else {
    headline = `Preview — ${awayName} at ${homeName} on ${whenLabel}.`;
  }

  // Secondary context for non-final states
  let context = "";
  if (!isFinal) {
    context = `Recent form: ${homeCode} ${hForm}, ${awayCode} ${aForm}.`;
  }

  return (
    <Card variant="outlined" sx={{ borderRadius:1 }}>
      <CardContent sx={{ p:2 }}>
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb:1.25 }}>
          <Stack direction="row" spacing={-0.6}>
            <Avatar src={logoForTeam(game?.away)} alt="" sx={{ width:36, height:36, p:0.5, bgcolor:'rgba(255,255,255,.05)', '& img':{ objectFit:'contain' } }}>{awayCode}</Avatar>
            <Avatar src={logoForTeam(game?.home)} alt="" sx={{ width:36, height:36, p:0.5, bgcolor:'rgba(255,255,255,.05)', '& img':{ objectFit:'contain' } }}>{homeCode}</Avatar>
          </Stack>
          <Box>
            <Typography component="h2" variant="subtitle1" sx={{ fontWeight:800, lineHeight:1.15 }}>
              {isFinal ? "Game recap" : isLive ? "Live update" : "Game preview"}
            </Typography>
            <Typography variant="caption" sx={{ color:'text.secondary' }}>{awayCode} @ {homeCode}</Typography>
          </Box>
        </Stack>

        <Typography variant="body2" sx={{ mb: isFinal ? 0.5 : 1 }}>
          {headline}
        </Typography>

        {!isFinal && (
          <Typography variant="body2" sx={{ mb: h2hLine ? 0.5 : 0 }}>
            {context}
          </Typography>
        )}

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

  // Hydrate missing final scores for the matchup summary.
  const [hydrated, setHydrated] = useState(null);

  const anchorISO = (game?._iso || "").slice(0,10) || (game?.dateKey || new Date().toISOString().slice(0,10));

  // Hydrate missing final scores once.
  useEffect(() => {
    let stop = false;
    (async () => {
      const isFinal = (game?.status || "").toLowerCase().includes("final");
      const hs = Number(game?.homeScore ?? NaN);
      const as = Number(game?.awayScore ?? NaN);
      if (!isFinal || (Number.isFinite(hs) && Number.isFinite(as)) || !game?.id) {
        setHydrated(null);
        return;
      }
      try {
        const g = await fetchGameByIdPublic(game.id);
        if (stop) return;
        // Only set if we actually got numbers
        if (Number.isFinite(g.homeScore) && Number.isFinite(g.awayScore)) {
          setHydrated({
            ...game,
            homeScore: g.homeScore,
            awayScore: g.awayScore,
          });
        } else {
          setHydrated(null);
        }
      } catch {
        setHydrated(null);
      }
    })();
    return () => { stop = true; };
  }, [game?.id, game?.status, game?.homeScore, game?.awayScore]);

  const gameForDisplay = hydrated || game;

  // Add these derived flags right after your effects / before the return:
  const awayEmpty = !a.loading && !a.error && !(a.data?.games?.length);
  const homeEmpty = !b.loading && !b.error && !(b.data?.games?.length);
  const noDataNote = (awayEmpty || homeEmpty) ? noDataReason(anchorISO) : null;

  // last-10 (this season up to anchor)
  useEffect(()=>{ let cancelled=false; (async()=>{
    if (!game?.home?.code || !game?.away?.code) return;
    try{
      setA({loading:true,error:null,data:null});
      setB({loading:true,error:null,data:null});
      const [Ares, Bres] = await Promise.all([
        fetchTeamLast10UpToPublic(game.away.code, anchorISO),
        fetchTeamLast10UpToPublic(game.home.code, anchorISO),
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
      const { aWins, bWins } = await fetchHeadToHeadPublic(game.home.code, game.away.code, { start, end });
      if (cancelled) return;
      setH2h({loading:false,error:null,data:{ aWins, bWins }});
    }catch(e){
      if (cancelled) return;
      setH2h({loading:false,error:e?.message||String(e),data:null});
    }
  })(); return ()=>{cancelled=true}; }, [game?.home?.code, game?.away?.code, anchorISO]);

    // ------------------ Rolling recent player averages (with season fallback) ------------------
    useEffect(() => {
    if (!game?.home?.code || !game?.away?.code) return;
    let cancelled = false;

    (async () => {
        try {
        setMini({ loading: true, error: null, data: null });
        const [awayPack, homePack] = await Promise.all([
            fetchRecentPlayerAveragesPublic(game.away.code, { days: 21, anchorISO, topN: 3 }),
            fetchRecentPlayerAveragesPublic(game.home.code, { days: 21, anchorISO, topN: 3 }),
        ]);
        if (cancelled) return;

        setMini({
            loading: false,
            error: null,
            data: { away: awayPack.players || [], home: homePack.players || [] },
        });

        const mode =
            awayPack._mode === "season-fallback" || homePack._mode === "season-fallback"
            ? "season-fallback"
            : "recent";

        setMiniModeLabel(mode === "recent" ? "last 21 days" : "season averages (fallback)");
        } catch (e) {
        if (cancelled) return;
        setMini({ loading: false, error: e?.message || String(e), data: null });
        setMiniModeLabel("players unavailable");
        }
    })();

    return () => { cancelled = true; };
    }, [game?.home?.code, game?.away?.code, anchorISO]);

  return (
    <Box sx={{ flex: 1, minHeight: 0 }}>
      {/* Narrative */}
      <NarrativeBlock game={gameForDisplay} a={a} b={b} h2h={h2h} />

      <Divider sx={{ my: 1 }} />

      {noDataNote && (
      <Typography variant="caption" sx={{ color:'info.main', mb: 0.5, display:'block' }}>
          {noDataNote}
      </Typography>
      )}

      {/* Recent form lists */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Last10List title={`${game?.away?.code} (${game?.away?.name})`} loading={a.loading} error={a.error} data={a.data} />
        <Last10List title={`${game?.home?.code} (${game?.home?.name})`} loading={b.loading} error={b.error} data={b.data} />
      </Stack>

      <Typography variant="caption" sx={{ opacity: 0.65, mt: 0.25, display:'block' }}>
        Showing last 10 this season up to {anchorISO}
      </Typography>


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
        ) : (
        <Typography variant="caption" sx={{ color:'info.main', mt:1, display:'block' }}>
            No head-to-head meetings between these teams so far this season.
        </Typography>
        )}

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
