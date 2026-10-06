import React, { useEffect, useState } from "react";
import { useParams, Link as RouterLink } from "react-router-dom";
import { Avatar, Box, Button, CircularProgress, Divider, Stack, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import GameComparePanel from "./GameComparePanel";
import { logoForTeam } from "../utils/teamAssets";

export default function GamePage() {
  const { id } = useParams();
  const [game, setGame] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams({ action: "game", id: String(id || "") });
    fetch(`/api/nba-data?${q}`, { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body?.detail || body?.error || `HTTP ${r.status}`);
        return body?.game;
      })
      .then((row) => { if (!cancelled) setGame(row || null); })
      .catch((e) => { if (!cancelled) setError(e?.message || String(e)); });
    return () => { cancelled = true; };
  }, [id]);

  return (
    <Box sx={{ maxWidth: 1040, mx: "auto", px: { xs: 1.5, sm: 3 }, py: { xs: 2, sm: 3 } }}>
      <Button component={RouterLink} to="/all" startIcon={<ArrowBackRoundedIcon />} color="inherit" size="small" sx={{ mb: 2 }}>Games</Button>
      {error ? <Typography color="text.secondary">Game unavailable.</Typography> : !game ? (
        <Stack alignItems="center" sx={{ py: 10 }}><CircularProgress size={20} /></Stack>
      ) : (
        <>
          <Stack direction="row" alignItems="center" justifyContent="center" spacing={{ xs: 2, sm: 4 }} sx={{ py: { xs: 2, sm: 3 } }}>
            {[game.away, game.home].map((team, i) => (
              <React.Fragment key={team?.code || i}>
                {i === 1 && <Typography color="text.secondary" sx={{ fontWeight: 700 }}>@</Typography>}
                <Stack alignItems="center" spacing={.6} sx={{ minWidth: 0, flex: 1 }}>
                  <Avatar src={logoForTeam(team)} alt="" sx={{ width: { xs: 54, sm: 70 }, height: { xs: 54, sm: 70 }, p: .5, bgcolor: "transparent", "& img": { objectFit: "contain" } }}>{team?.code}</Avatar>
                  <Typography sx={{ fontWeight: 850 }}>{team?.code}</Typography>
                  <Typography variant="caption" color="text.secondary" align="center">{team?.name}</Typography>
                </Stack>
              </React.Fragment>
            ))}
          </Stack>
          <Divider sx={{ mb: 2 }} />
          <GameComparePanel game={game} />
        </>
      )}
    </Box>
  );
}
