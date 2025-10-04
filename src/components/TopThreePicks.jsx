// src/components/TopThreePicks.jsx
import React, { useMemo } from "react";
import {
  Box, Card, CardContent, Chip, Stack, Typography,
  IconButton, Tooltip, LinearProgress
} from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";

function isFinal(game){ return (game?.status || "").toLowerCase().includes("final"); }
function isLive(game){ return /in progress|halftime|end of|quarter|q\d/i.test((game?.status || "").toLowerCase()); }

function pickSide(game) {
  const ph = Number(game?.model?.pHome);
  if (Number.isFinite(ph)) return ph >= 0.5 ? "home" : "away";
  const code = String(game?.model?.predictedWinner || "").toUpperCase();
  if (code && [game.home?.code, game.away?.code].includes(code)) {
    return code === game.home.code ? "home" : "away";
  }
  return null;
}
function pickConfidence(game) {
  const ph = Number(game?.model?.pHome);
  if (!Number.isFinite(ph)) return null;
  // measure from coin-flip
  return Math.abs(ph - 0.5); // 0..0.5
}
function pct(v){ return Math.round(v * 100); }

function shareLine({ g, side, confPct }) {
  const fav = side === "home" ? g.home : g.away;
  return `${g.away.code} @ ${g.home.code} — Pick: ${fav.code} ${confPct}%`;
}

export default function TopThreePicks({ games = [] }) {
  const picks = useMemo(() => {
    const candidates = (games || [])
      // prefer not to include finished games
      .filter(g => !isFinal(g))
      // must have a pick signal
      .map(g => {
        const side = pickSide(g);
        const conf = pickConfidence(g);
        if (!side || conf == null) return null;

        const favored = side === "home" ? g.home : g.away;
        const favoredPct = side === "home" ? Number(g?.model?.pHome) : (1 - Number(g?.model?.pHome));

        return {
          key: `${g.dateKey}|${g.away.code}@${g.home.code}`,
          g,
          side,
          conf,                 // 0..0.5
          confPct: pct(Math.min(1, Math.max(0, favoredPct))),
          title: `${g.away.code} @ ${g.home.code}`,
          favored,
          favoredPct,
          live: isLive(g),
        };
      })
      .filter(Boolean);

    // Sort by confidence desc, then live games first (optional), then earliest tip if available
    candidates.sort((a, b) => {
      const byConf = b.conf - a.conf;
      if (byConf !== 0) return byConf;
      if (a.live !== b.live) return a.live ? -1 : 1;
      return String(a.g._iso || "").localeCompare(String(b.g._iso || ""));
    });

    return candidates.slice(0, 3);
  }, [games]);

  if (!picks.length) return null;

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); } catch {}
  }

  return (
    <Card variant="outlined" sx={{ borderRadius: 1, mt: 2 }}>
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <EmojiEventsIcon fontSize="small" />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Top 3 Picks</Typography>
          <Chip size="small" variant="outlined" label="Model" sx={{ ml: "auto" }} />
        </Stack>

        <Stack spacing={1.25}>
          {picks.map((p, idx) => {
            const { g } = p;
            const line = shareLine(p);
            const statusIcon = isFinal(g)
              ? (g.homeScore > g.awayScore ? (g.home.code === p.favored.code ? <CheckCircleIcon fontSize="small" color="success" /> : <CancelIcon fontSize="small" color="error" />)
                : (g.away.code === p.favored.code ? <CheckCircleIcon fontSize="small" color="success" /> : <CancelIcon fontSize="small" color="error" />))
              : null;

            return (
              <Box key={p.key}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {idx + 1}. {p.title}
                  </Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    {p.live && <Chip size="small" color="warning" label="Live" />}
                    <Chip
                      size="small"
                      color="secondary"
                      label={`${p.favored.code} · ${p.confPct}%`}
                    />
                    <Tooltip title="Copy summary">
                      <IconButton size="small" onClick={() => copy(line)}>
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {statusIcon}
                  </Stack>
                </Stack>

                <LinearProgress
                  variant="determinate"
                  value={p.favoredPct * 100}
                  sx={{ height: 8, borderRadius: 1, mt: 0.5 }}
                />
                <Typography variant="caption" sx={{ opacity: 0.75 }}>
                  Favored: {p.favored.name} (~{p.confPct}%)
                </Typography>
              </Box>
            );
          })}
        </Stack>

        <Typography variant="caption" sx={{ opacity: 0.7, display: "block", mt: 1.25 }}>
          Based on model edge (probabilities). For fun display only.
        </Typography>
      </CardContent>
    </Card>
  );
}
