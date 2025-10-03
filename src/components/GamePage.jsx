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

export default function GamePage() {
  const { id } = useParams();
  const [game, setGame] = useState(null);
  const [err, setErr] = useState(null);

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
        {game.away.name} at {game.home.name} · {safeDateLabel(game.dateISO, game.hasClock)}
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
              : `${game.away.code} visit ${game.home.code} on ${safeDateLabel(game.dateISO, game.hasClock)}.`}
          </Typography>
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
