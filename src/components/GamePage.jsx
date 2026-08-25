// src/components/GamePage.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link as RouterLink } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import GameComparePanel from "./GameComparePanel";

export default function GamePage() {
  const { id } = useParams();
  const [game, setGame] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const params = new URLSearchParams({ action: "game", id: String(id || "") });
        const r = await fetch(`/api/nba-data?${params.toString()}`, { cache: "no-store" });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body?.detail || body?.error || `NBA data HTTP ${r.status}`);
        if (!body?.game) throw new Error("Game data unavailable");
        if (!ok) return;
        setGame(body.game);
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

  const title = `${game.away?.code || "AWAY"} @ ${game.home?.code || "HOME"}`;

  return (
    <Box sx={{ maxWidth: 720, mx: "auto", p: 2 }}>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>{title}</Typography>
      <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5 }}>
        {game.away?.name} at {game.home?.name}
      </Typography>

      <Box sx={{ mt: 2 }}>
        <GameComparePanel game={game} />
      </Box>

      <Typography variant="body2" sx={{ mt: 2 }}>
        <RouterLink to="/all">← Back to calendar</RouterLink>
      </Typography>
    </Box>
  );
}
