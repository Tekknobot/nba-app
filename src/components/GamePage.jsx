// src/components/GamePage.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link as RouterLink } from "react-router-dom";
import {
  Box, Card, CardContent, Typography, List, ListItem, ListItemText
} from "@mui/material";

const BDL_BASE =
  process.env.NODE_ENV === "development" ? "/bdl" : "/api/bdl";

function safeDateLabel(iso, hasClock) {
  if (!iso) return "TBD";
  const d = new Date(iso);
  try {
    return hasClock
      ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d)
      : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d);
  } catch { return "TBD"; }
}

function calendarDateLabel(dateKey) {
  // Force noon UTC on the date-only key so the day never shifts by timezone
  if (!dateKey) return "TBD";
  const d = new Date(`${dateKey}T12:00:00Z`);
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d);
  } catch { return "TBD"; }
}

async function bdl(url) {
  const r = await fetch(url, { cache: "no-store" });
  const ct = (r.headers.get("content-type") || "").toLowerCase();
  const text = await r.text();
  if (!r.ok) throw new Error(`BDL ${r.status}: ${text.slice(0, 180)}`);
  if (ct.includes("application/json")) return JSON.parse(text);
  throw new Error(`BDL non-JSON response (${ct || "unknown"}). First bytes: ${text.slice(0, 120)}`);
}

async function fetchGameById(id) {
  const j = await bdl(`${BDL_BASE}/games/${id}`);
  const g = (j && (j.data || j)) || {};
  if (!g.home_team || !g.visitor_team) {
    throw new Error(`Game not found or unexpected response for id "${id}". Keys: ${Object.keys(j || {})}`);
  }
  return {
    id: g.id,
    status: g.status || "",
    dateISO: g.date || null,
    dateKey: (g.date || "").slice(0, 10),
    hasClock: !!(g.date && new Date(g.date).getUTCHours() !== 0),
    home: {
      code: (g.home_team?.abbreviation || "").toUpperCase(),
      name: g.home_team?.full_name || g.home_team?.name || "",
      score: Number.isFinite(g.home_team_score) ? g.home_team_score : null,
    },
    away: {
      code: (g.visitor_team?.abbreviation || "").toUpperCase(),
      name: g.visitor_team?.full_name || g.visitor_team?.name || "",
      score: Number.isFinite(g.visitor_team_score) ? g.visitor_team_score : null,
    },
  };
}

// Derive NBA season window from an ISO (NBA seasons run Oct–Jun, named by END year)
function seasonWindowFromISO(iso) {
  const d = iso ? new Date(iso) : new Date();
  const endYear = d.getMonth() >= 9 ? d.getFullYear() + 1 : d.getFullYear(); // Oct (9) → next year
  return { start: `${endYear - 1}-10-01`, end: `${endYear}-06-30`, endYear };
}

async function fetchJsonViaGateway(pathAndQs) {
  const url = `${BDL_BASE}/${pathAndQs}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`BDL ${r.status}`);
  const j = await r.json();
  return j?.data ?? j;
}

// Head-to-head this season (wins for HOME vs AWAY)
async function fetchHeadToHead(homeCode, awayCode, dateISO) {
  const { start, end } = seasonWindowFromISO(dateISO);
  // Pull all HOME games this season and filter opponent == AWAY
  const qs = new URLSearchParams({
    "team_ids[]": homeCodeToId(homeCode),
    start_date: start,
    end_date: end,
    per_page: "100",
  }).toString();
  const data = await fetchJsonViaGateway(`games?${qs}`);

  let homeWins = 0, awayWins = 0;
  for (const g of data || []) {
    const hs = g?.home_team_score, as = g?.visitor_team_score;
    if (!Number.isFinite(hs) || !Number.isFinite(as)) continue;
    const h = (g?.home_team?.abbreviation || "").toUpperCase();
    const v = (g?.visitor_team?.abbreviation || "").toUpperCase();
    const involves = (h === homeCode && v === awayCode) || (h === awayCode && v === homeCode);
    if (!involves) continue;
    const homeTeamIsH = h === homeCode;
    const homeScore   = homeTeamIsH ? hs : as;
    const awayScore   = homeTeamIsH ? as : hs;
    if (homeScore > awayScore) homeWins++; else if (awayScore > homeScore) awayWins++;
  }
  return { homeWins, awayWins };
}

// Minimal map (extend if you want all teams)
const BDL_TEAM_ID = { ATL:1,BOS:2,BKN:3,CHA:4,CHI:5,CLE:6,DAL:7,DEN:8,DET:9,GSW:10,HOU:11,IND:12,LAC:13,LAL:14,MEM:15,MIA:16,MIL:17,MIN:18,NOP:19,NYK:20,OKC:21,ORL:22,PHI:23,PHX:24,POR:25,SAC:26,SAS:27,TOR:28,UTA:29,WAS:30 };
function homeCodeToId(code){ const id = BDL_TEAM_ID[(code||"").toUpperCase()]; if (!id) throw new Error(`Unknown team code: ${code}`); return String(id); }

// Roster → player ids (for season_averages), then compute leaders
async function fetchTeamLeaders(teamCode, dateISO) {
  const { endYear } = seasonWindowFromISO(dateISO);
  // 1) roster (players endpoint)
  const rosterQs = new URLSearchParams({ "team_ids[]": homeCodeToId(teamCode), per_page: "100" }).toString();
  const roster = await fetchJsonViaGateway(`players?${rosterQs}`);
  const ids = Array.from(new Set((roster || []).map(p => p?.id).filter(Number))).slice(0, 30);
  if (!ids.length) return null;

  // 2) season averages
  const saQs = new URLSearchParams({ season: String(endYear) });
  ids.forEach(id => saQs.append("player_ids[]", String(id)));
  const avgs = await fetchJsonViaGateway(`season_averages?${saQs.toString()}`);
  if (!Array.isArray(avgs) || !avgs.length) return null;

  // Join names from roster
  const byId = new Map((roster || []).map(p => [p.id, p]));
  const rows = avgs.map(a => ({
    id: a.player_id,
    gp: a.games_played ?? a.gp ?? 0,
    min: a.min ?? 0,
    pts: a.pts ?? 0,
    reb: a.reb ?? 0,
    ast: a.ast ?? 0,
    ply: byId.get(a.player_id) || null
  }));

  // pick leaders (min GP gate to avoid tiny samples)
  const minGp = 5;
  const top = (key) => rows.filter(r => r.gp >= minGp).sort((x,y)=> (y[key]||0)-(x[key]||0))[0];

  const p = top("pts"), r = top("reb"), a = top("ast");
  const name = (row) => row?.ply ? `${row.ply.first_name || ""} ${row.ply.last_name || ""}`.trim() : null;

  return {
    season: endYear,
    points: p ? { name: name(p), v: p.pts } : null,
    rebounds: r ? { name: name(r), v: r.reb } : null,
    assists: a ? { name: name(a), v: a.ast } : null,
  };
}

export default function GamePage() {
  const { id } = useParams();
  const [game, setGame] = useState(null);
  const [err, setErr] = useState(null);

    const [h2h, setH2h] = useState(null);
    const [leadersHome, setLeadersHome] = useState(null);
    const [leadersAway, setLeadersAway] = useState(null);

    useEffect(() => {
    if (!game) return;
    let ok = true;
    (async () => {
        try {
        const [hh, lh, la] = await Promise.all([
            fetchHeadToHead(game.home.code, game.away.code, game.dateISO).catch(()=>null),
            fetchTeamLeaders(game.home.code, game.dateISO).catch(()=>null),
            fetchTeamLeaders(game.away.code, game.dateISO).catch(()=>null),
        ]);
        if (!ok) return;
        setH2h(hh);
        setLeadersHome(lh);
        setLeadersAway(la);
        } catch { /* silent */ }
    })();
    return () => { ok = false; };
    }, [game]);

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const g = await fetchGameById(id);
        if (!ok) return;
        setGame(g);
      } catch (e) {
        if (!ok) return;
        setErr(e?.message || String(e));
      }
    })();
    return () => { ok = false; };
  }, [id]);

  // AdSense push (ignore if you don't use)
  useEffect(() => {
    if (window.adsbygoogle && document.querySelector(".adsbygoogle")) {
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
    }
  }, [game]);

  if (err) {
    return (
      <Box sx={{ maxWidth: 720, mx: "auto", p: 2 }}>
        <Typography variant="h6">Game</Typography>
        <Typography color="warning.main" sx={{ mt: 1, whiteSpace: "pre-wrap" }}>
          {String(err)}
        </Typography>
        <Typography variant="caption" sx={{ display: "block", mt: 1.5 }}>
          Test endpoint: <a href={`${BDL_BASE}/games/${encodeURIComponent(id)}`} target="_blank" rel="noreferrer">
            {`${BDL_BASE}/games/${id}`}
          </a>
        </Typography>
        <Typography sx={{ mt: 2 }}>
          <RouterLink to="/all">← Back to calendar</RouterLink>
        </Typography>
      </Box>
    );
  }

  if (!game) {
    return (
      <Box sx={{ maxWidth: 720, mx: "auto", p: 2 }}>
        <Typography variant="h6">Loading game…</Typography>
      </Box>
    );
  }

  const title = `${game.away.code} @ ${game.home.code}`;
  const status = (game.status || "").toLowerCase();
  const isFinal = /final/.test(status);
  const friendlyStatus =
    /final/.test(status) ? "Final" :
    /in progress|halftime|end of|quarter|q\d/.test(status) ? game.status : "Scheduled";

  return (
    <Box sx={{ maxWidth: 720, mx: "auto", p: 2 }}>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>{title}</Typography>
      <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5 }}>
        {game.away.name} at {game.home.name} · {calendarDateLabel(game.dateKey)}
      </Typography>

      <Typography variant="body2" sx={{ mt: 1.5 }}>
        Short, human-readable preview or recap for this matchup, plus model context and quick facts.
      </Typography>

      {/* Ad slot (optional) */}
      <Box sx={{ my: 2 }}>
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client="ca-pub-XXXX"
          data-ad-slot="YYYY"
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </Box>

      {/* Narrative (simple) */}
      <Card variant="outlined" sx={{ borderRadius: 1 }}>
        <CardContent sx={{ p: 2 }}>
          <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
            {isFinal ? "Game recap" : "Game preview"}
          </Typography>
          <Typography variant="body2">
            {isFinal
              ? `All wrapped up: ${(game.home.score > game.away.score ? game.home.code : game.away.code)} win ${Math.max(game.home.score ?? 0, game.away.score ?? 0)}–${Math.min(game.home.score ?? 0, game.away.score ?? 0)}.`
              : `${game.away.code} visit ${game.home.code} on ${calendarDateLabel(game.dateKey)}.`}
          </Typography>
        </CardContent>
      </Card>

        {/* Preview notes */}
        <Card variant="outlined" sx={{ borderRadius: 1, mt: 2 }}>
        <CardContent sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            Preview notes
            </Typography>

            {/* Head-to-head */}
            {h2h ? (
            <Typography variant="body2" sx={{ mb: 1 }}>
                Season series so far: {game.home.code} {h2h.homeWins}–{h2h.awayWins} {game.away.code}.
            </Typography>
            ) : (
            <Typography variant="body2" sx={{ mb: 1, opacity: 0.7 }}>
                Season series info will appear here once games are played.
            </Typography>
            )}

            {/* Impact players */}
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Impact players (season averages)
            </Typography>
            <List dense sx={{ mt: 0 }}>
            {/* Home leaders */}
            {leadersHome ? (
                <ListItem disableGutters sx={{ py: 0.25 }}>
                <ListItemText
                    primaryTypographyProps={{ variant: "body2" }}
                    primary={
                    <>
                        <strong>{game.home.name}</strong>{": "}
                        {leadersHome.points?.name ? `${leadersHome.points.name} ${leadersHome.points.v.toFixed(1)} PPG` : "—"}
                        {" · "}
                        {leadersHome.rebounds?.name ? `${leadersHome.rebounds.name} ${leadersHome.rebounds.v.toFixed(1)} RPG` : "—"}
                        {" · "}
                        {leadersHome.assists?.name ? `${leadersHome.assists.name} ${leadersHome.assists.v.toFixed(1)} APG` : "—"}
                    </>
                    }
                />
                </ListItem>
            ) : (
                <ListItem disableGutters sx={{ py: 0.25 }}>
                <ListItemText primaryTypographyProps={{ variant: "body2" }} primary="Home leaders loading…" />
                </ListItem>
            )}

            {/* Away leaders */}
            {leadersAway ? (
                <ListItem disableGutters sx={{ py: 0.25 }}>
                <ListItemText
                    primaryTypographyProps={{ variant: "body2" }}
                    primary={
                    <>
                        <strong>{game.away.name}</strong>{": "}
                        {leadersAway.points?.name ? `${leadersAway.points.name} ${leadersAway.points.v.toFixed(1)} PPG` : "—"}
                        {" · "}
                        {leadersAway.rebounds?.name ? `${leadersAway.rebounds.name} ${leadersAway.rebounds.v.toFixed(1)} RPG` : "—"}
                        {" · "}
                        {leadersAway.assists?.name ? `${leadersAway.assists.name} ${leadersAway.assists.v.toFixed(1)} APG` : "—"}
                    </>
                    }
                />
                </ListItem>
            ) : (
                <ListItem disableGutters sx={{ py: 0.25 }}>
                <ListItemText primaryTypographyProps={{ variant: "body2" }} primary="Away leaders loading…" />
                </ListItem>
            )}
            </List>
        </CardContent>
        </Card>


      {/* Quick facts */}
      <Card variant="outlined" sx={{ borderRadius: 1, mt: 2 }}>
        <CardContent sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Quick facts</Typography>
          <List dense>
            <ListItem disableGutters>
              <ListItemText primary={`Status: ${friendlyStatus}`} />
            </ListItem>
            {isFinal && Number.isFinite(game.home.score) && Number.isFinite(game.away.score) && (
              <ListItem disableGutters>
                <ListItemText primary={`Final score: ${game.home.code} ${game.home.score} — ${game.away.code} ${game.away.score}`} />
              </ListItem>
            )}
            <ListItem disableGutters><ListItemText primary={`Home: ${game.home.name} (${game.home.code})`} /></ListItem>
            <ListItem disableGutters><ListItemText primary={`Away: ${game.away.name} (${game.away.code})`} /></ListItem>
          </List>
        </CardContent>
      </Card>

      <Typography variant="body2" sx={{ mt: 2 }}>
        <RouterLink to="/all">← Back to calendar</RouterLink>
      </Typography>
    </Box>
  );
}
