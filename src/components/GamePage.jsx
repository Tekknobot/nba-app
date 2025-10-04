// src/components/GamePage.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link as RouterLink } from "react-router-dom";
import { Box, Typography, Card, CardContent } from "@mui/material";
import GameComparePanel from "./GameComparePanel"; // ⬅️ NEW

const BDL_BASE = "/api/bdl";

// (keep your existing helpers: sleep, withRetry, bdl, fetchGameById, etc.)

export default function GamePage() {
  const { id } = useParams();
  const [game, setGame] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        // reuse your existing fetcher
        const r = await fetch(`${BDL_BASE}/games/${id}`, { cache: "no-store" });
        const txt = await r.text();
        if (!r.ok) throw new Error(`BDL ${r.status}: ${txt.slice(0, 220)}`);
        const raw = JSON.parse(txt)?.data ?? JSON.parse(txt);
        const g = raw || {};
        const formed = {
          id: g.id,
          status: g.status || "",
          _iso: g.date || null,
          dateKey: (g.date || "").slice(0, 10),
          hasClock: !!(g.date && new Date(g.date).getUTCHours() !== 0),
          home: {
            code: (g.home_team?.abbreviation || "").toUpperCase(),
            name: g.home_team?.full_name || g.home_team?.name || "",
          },
          away: {
            code: (g.visitor_team?.abbreviation || "").toUpperCase(),
            name: g.visitor_team?.full_name || g.visitor_team?.name || "",
          },
          homeScore: Number.isFinite(g.home_team_score) ? g.home_team_score : null,
          awayScore: Number.isFinite(g.visitor_team_score) ? g.visitor_team_score : null,
        };
        if (!ok) return;
        setGame(formed);
        setErr(null);
      } catch (e) {
        if (!ok) return;
        setErr(e?.message || String(e));
        setGame(null);
      }
    })();
    return () => { ok = false; };
  }, [id]);

  if (err) {
    return (
      <Box sx={{ maxWidth: 720, mx: "auto", p: 2 }}>
        <Typography variant="h6">Game</Typography>
        <Typography color="warning.main" sx={{ mt: 1, whiteSpace: "pre-wrap" }}>{String(err)}</Typography>
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

  return (
    <Box sx={{ maxWidth: 720, mx: "auto", p: 2 }}>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>{title}</Typography>
      <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5 }}>
        {game.away.name} at {game.home.name}
      </Typography>

      {/* 🔁 The exact same content as the drawer */}
      <Box sx={{ mt: 2 }}>
        <GameComparePanel game={game} />
      </Box>

      <Typography variant="body2" sx={{ mt: 2 }}>
        <RouterLink to="/all">← Back to calendar</RouterLink>
      </Typography>
    </Box>
  );
}
