// src/components/GamePage.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Box, Card, CardContent, Typography, List, ListItem, ListItemText } from "@mui/material";

function safeDateLabel(iso, hasClock) {
  if (!iso) return "TBD";
  const d = new Date(iso);
  try {
    return hasClock
      ? new Intl.DateTimeFormat(undefined, { dateStyle:"medium", timeStyle:"short" }).format(d)
      : new Intl.DateTimeFormat(undefined, { dateStyle:"medium" }).format(d);
  } catch { return "TBD"; }
}

async function bdl(url){
    const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`BDL ${r.status}`);
  return r.json();
}

async function fetchGameByIdBDL(id){
  const j = await bdl(`/bdl/games/${id}`);
  const g = j || {};
  return {
    id: g.id,
    status: g.status || "",
    dateISO: g.date || null,
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

function GameNarrative({ game, modelPct=50, modeLabel="recent form" }) {
  const status = (game?.status || "").toLowerCase();
  const isFinal = status.includes("final");
  const isLive  = /in progress|halftime|end of|quarter|q\d/.test(status);

  const home = game.home.code, away = game.away.code;
  const when = safeDateLabel(game.dateISO, game.hasClock);

  let heading = "Game preview";
  let topLine = `${away} visit ${home} on ${when}. Recent form: ${home} 0-0, ${away} 0-0.`;
  if (isLive) {
    heading = "Live update";
    topLine = `Underway: ${home} ${game.home.score ?? "–"} — ${away} ${game.away.score ?? "–"} (${game.status}).`;
  }
  if (isFinal) {
    heading = "Game recap";
    const hs = game.home.score, as = game.away.score;
    topLine = (Number.isFinite(hs) && Number.isFinite(as))
      ? `All wrapped up: ${(hs>as?home:away)} win ${Math.max(hs,as)}–${Math.min(hs,as)}.`
      : `Final: ${away} at ${home}.`;
  }

  const modelLine = Number.isFinite(modelPct)
    ? `Our model, built on ${modeLabel}, gives ${home} a ${Math.round(modelPct)}% chance at home.`
    : "";

  return (
    <Card variant="outlined" sx={{ borderRadius:1 }}>
      <CardContent sx={{ p:2 }}>
        <Typography component="h2" variant="subtitle1" sx={{ fontWeight:700, mb:0.5 }}>
          {heading}
        </Typography>
        <Typography variant="body2" sx={{ mb:1 }}>{topLine}</Typography>
        {modelLine && <Typography variant="body2">{modelLine}</Typography>}
      </CardContent>
    </Card>
  );
}

export default function GamePage(){
  const { id } = useParams();
  const [game, setGame] = useState(null);
  const [err, setErr]   = useState(null);

  useEffect(()=>{
    let ok = true;
    (async ()=>{
      try{
        const g = await fetchGameByIdBDL(id);
        if (!ok) return;
        setGame(g);
      } catch(e){
        if (!ok) return;
        setErr(e?.message || String(e));
      }
    })();
    return ()=>{ ok = false; };
  }, [id]);

  // push AdSense after mount (script loaded globally in public/index.html)
  useEffect(()=>{
    if (window.adsbygoogle && document.querySelector(".adsbygoogle")) {
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
    }
  }, [game]);

  if (err) {
    return (
      <Box sx={{ maxWidth:720, mx:"auto", p:2 }}>
        <Typography variant="h6">Game</Typography>
        <Typography color="warning.main" sx={{ mt:1 }}>{err}</Typography>
        <Typography sx={{ mt:2 }}><Link to="/all">← Back to calendar</Link></Typography>
      </Box>
    );
  }

  if (!game) {
    return (
      <Box sx={{ maxWidth:720, mx:"auto", p:2 }}>
        <Typography variant="h6">Loading game…</Typography>
      </Box>
    );
  }

  const title = `${game.away.code} @ ${game.home.code}`;

  return (
    <Box sx={{ maxWidth:720, mx:"auto", p:2 }}>
      <Typography variant="h4" sx={{ fontWeight:700 }}>{title}</Typography>
      <Typography variant="body2" sx={{ opacity:0.85, mt:0.5 }}>
        {game.away.name} at {game.home.name} · {safeDateLabel(game.dateISO, game.hasClock)}
      </Typography>

      {/* Short intro (helps with AdSense review) */}
      <Typography variant="body2" sx={{ mt:1.5 }}>
        Short, human-readable preview or recap for this matchup, plus model context and quick facts.
      </Typography>

      {/* === Ad slot: below intro, above content === */}
      <Box sx={{ my:2 }}>
        <ins
          className="adsbygoogle"
          style={{ display:"block" }}
          data-ad-client="ca-pub-XXXX"  // <-- your publisher id
          data-ad-slot="YYYY"           // <-- your slot id
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </Box>

      <GameNarrative game={game} />

      <Card variant="outlined" sx={{ borderRadius:1, mt:2 }}>
        <CardContent sx={{ p:2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight:700, mb:1 }}>Quick facts</Typography>
          <List dense>
            <ListItem disableGutters><ListItemText primary={`Status: ${game.status || "Scheduled"}`} /></ListItem>
            {Number.isFinite(game.home.score) && Number.isFinite(game.away.score) && (
              <ListItem disableGutters>
                <ListItemText primary={`Final score: ${game.home.code} ${game.home.score} — ${game.away.code} ${game.away.score}`} />
              </ListItem>
            )}
            <ListItem disableGutters><ListItemText primary={`Home: ${game.home.name} (${game.home.code})`} /></ListItem>
            <ListItem disableGutters><ListItemText primary={`Away: ${game.away.name} (${game.away.code})`} /></ListItem>
          </List>
        </CardContent>
      </Card>

      <Typography variant="body2" sx={{ mt:2 }}>
        <Link to="/all">← Back to calendar</Link>
      </Typography>
    </Box>
  );
}
