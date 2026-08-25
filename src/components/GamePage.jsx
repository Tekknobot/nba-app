import React, { useEffect, useState } from "react";
import { useParams, Link as RouterLink } from "react-router-dom";
import { Avatar, Box, Button, Card, CardContent, CircularProgress, Stack, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import GameComparePanel from "./GameComparePanel";
import { logoForTeam } from "../utils/teamAssets";

function Logo({ team }) {
  return (
    <Avatar src={logoForTeam(team)} alt={`${team?.name || team?.code} logo`} sx={{ width: { xs: 52, sm: 68 }, height: { xs: 52, sm: 68 }, p: 0.75, bgcolor: "rgba(255,255,255,.06)", "& img": { objectFit: "contain" } }}>
      {team?.code}
    </Avatar>
  );
}

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

  return (
    <Box sx={{ maxWidth: 1120, mx: "auto", px: { xs: 1.25, sm: 2.5 }, py: { xs: 1.5, sm: 3 } }}>
      <Button component={RouterLink} to="/all" startIcon={<ArrowBackRoundedIcon />} size="small" variant="text" sx={{ mb: 1.5 }}>
        Games
      </Button>

      {err ? (
        <Card variant="outlined" sx={{ borderRadius: 3 }}><CardContent><Typography variant="h6">Game unavailable</Typography><Typography color="warning.main" sx={{ mt: 1 }}>{String(err)}</Typography></CardContent></Card>
      ) : !game ? (
        <Stack alignItems="center" sx={{ py: 10 }} spacing={1}><CircularProgress size={24} /><Typography variant="body2" sx={{ color: "text.secondary" }}>Loading game…</Typography></Stack>
      ) : (
        <>
          <Card className="pivt-hero" variant="outlined" sx={{ borderRadius: 4, mb: 2 }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Stack direction="row" alignItems="center" justifyContent="center" spacing={{ xs: 1.25, sm: 2.5 }}>
                <Stack alignItems="center" spacing={0.6} sx={{ flex: 1, minWidth: 0 }}>
                  <Logo team={game.away} />
                  <Typography variant="h6" noWrap>{game.away?.code}</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", textAlign: "center" }}>{game.away?.name}</Typography>
                </Stack>
                <Typography sx={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: { xs: 32, sm: 46 }, color: "text.secondary" }}>@</Typography>
                <Stack alignItems="center" spacing={0.6} sx={{ flex: 1, minWidth: 0 }}>
                  <Logo team={game.home} />
                  <Typography variant="h6" noWrap>{game.home?.code}</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", textAlign: "center" }}>{game.home?.name}</Typography>
                </Stack>
              </Stack>
              <Typography variant="body2" sx={{ color: "text.secondary", textAlign: "center", mt: 1.5 }}>{game.status}</Typography>
            </CardContent>
          </Card>
          <GameComparePanel game={game} />
        </>
      )}
    </Box>
  );
}
