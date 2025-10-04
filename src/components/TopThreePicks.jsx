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

// --- Small helpers mirroring your AllGamesCalendar logic ---
function isFinal(game){ return (game?.status || "").toLowerCase().includes("final"); }
function isLive(game){ return /in progress|halftime|end of|quarter|q\d/i.test((game?.status || "").toLowerCase()); }
function codeify(t){ if(!t) return ""; if(typeof t==="string") return t.toUpperCase(); return (t.code||t.abbr||t.name||"").toUpperCase(); }
function actualWinnerCode(game){
  const hs = Number(game?.homeScore ?? NaN);
  const as = Number(game?.awayScore ?? NaN);
  if (!Number.isFinite(hs) || !Number.isFinite(as) || hs===as) return null;
  return (hs>as ? codeify(game.home) : codeify(game.away)) || null;
}
function predictedWinnerCode(game){
  // prefer numeric prob when present
  const ph = Number(game?.model?.pHome);
  if (Number.isFinite(ph)) return ph >= 0.5 ? codeify(game.home) : codeify(game.away);

  // otherwise try strings in a few common places
  const cands = [
    game?.model?.predictedWinner, game?.model?.winner,
    game?.predictedWinner, game?.prediction?.predictedWinner, game?.odds?.modelPick
  ];
  for (const c of cands){
    if (!c) continue;
    const raw = String(typeof c === "string" ? c : (c.code||c.abbr||c.name||"")).toUpperCase().trim();
    if (raw==="HOME") return codeify(game.home);
    if (raw==="AWAY") return codeify(game.away);
    const code = codeify(raw);
    if (code) return code;
  }
  return null;
}
function favoredPct(game){
  const ph = Number(game?.model?.pHome);
  if (!Number.isFinite(ph)) return null;
  return Math.round((ph >= 0.5 ? ph : 1 - ph) * 100); // 50..100
}
function confidenceDistance(game){
  const ph = Number(game?.model?.pHome);
  return Number.isFinite(ph) ? Math.abs(ph - 0.5) : null; // 0..0.5 or null
}
function shareLine({ g, pickCode, pct }){
  return `${g.away.code} @ ${g.home.code} — Pick: ${pickCode}${pct!=null ? ` ${pct}%` : ""}`;
}

export default function TopThreePicks({ games = [] }){
  const picks = useMemo(()=>{
    const rows = (games||[])
      .map(g=>{
        const pickCode = predictedWinnerCode(g);
        if (!pickCode) return null; // no signal at all

        const pct = favoredPct(g);                // null if unknown
        const conf = confidenceDistance(g) ?? -1; // sort key; unknowns go last

        const live = isLive(g);
        const final = isFinal(g);
        const actual = final ? actualWinnerCode(g) : null;
        const correct = final && actual ? (actual === pickCode) : null;

        return {
          key: `${g.dateKey}|${g.away.code}@${g.home.code}`,
          g,
          title: `${g.away.code} @ ${g.home.code}`,
          pickCode,
          pct, conf, live, final, correct,
        };
      })
      .filter(Boolean);

    // Sort:
    // 1) has numeric confidence first, by conf desc
    // 2) live next
    // 3) then finals, then scheduled (optional tweak)
    // 4) earliest tip
    rows.sort((a,b)=>{
      const aHas = a.conf>=0, bHas = b.conf>=0;
      if (aHas!==bHas) return aHas ? -1 : 1;
      if (aHas && bHas){
        const byConf = b.conf - a.conf;
        if (byConf) return byConf;
      }
      if (a.live!==b.live) return a.live ? -1 : 1;
      if (a.final!==b.final) return a.final ? -1 : 1;
      return String(a.g._iso||"").localeCompare(String(b.g._iso||""));
    });

    return rows.slice(0,3);
  }, [games]);

  if (!picks.length) return null;

  const doCopy = async (text)=>{ try{ await navigator.clipboard.writeText(text); }catch{} };

  return (
    <Card variant="outlined" sx={{ borderRadius:1, mt:2 }}>
      <CardContent sx={{ p:2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb:1 }}>
          <EmojiEventsIcon fontSize="small" />
          <Typography variant="subtitle1" sx={{ fontWeight:700 }}>Top 3 Picks</Typography>
          <Chip size="small" variant="outlined" label="Model" sx={{ ml:'auto' }} />
        </Stack>

        <Stack spacing={1.25}>
          {picks.map((p, idx)=>{
            const share = shareLine({ g:p.g, pickCode:p.pickCode, pct:p.pct });
            const statusIcon = p.final
              ? (p.correct
                  ? <CheckCircleIcon fontSize="small" color="success" />
                  : <CancelIcon fontSize="small" color="error" />)
              : null;

            return (
              <Box key={p.key}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ gap:1 }}>
                  <Typography variant="body2" sx={{ fontWeight:700 }}>
                    {idx+1}. {p.title}
                  </Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    {p.live && <Chip size="small" color="warning" label="Live" />}
                    <Chip size="small" color="secondary" label={`${p.pickCode}${p.pct!=null ? ` · ${p.pct}%` : ""}`} />
                    <Tooltip title="Copy summary">
                      <IconButton size="small" onClick={()=>doCopy(share)}>
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {statusIcon}
                  </Stack>
                </Stack>

                {p.pct!=null ? (
                  <>
                    <LinearProgress variant="determinate" value={p.pct} sx={{ height:8, borderRadius:1, mt:0.5 }} />
                    <Typography variant="caption" sx={{ opacity:0.75 }}>
                      Confidence ~{p.pct}% toward {p.pickCode}
                    </Typography>
                  </>
                ) : (
                  <Typography variant="caption" sx={{ opacity:0.65, display:'block', mt:0.5 }}>
                    Confidence unavailable — showing model pick only.
                  </Typography>
                )}
              </Box>
            );
          })}
        </Stack>

        <Typography variant="caption" sx={{ opacity:0.7, display:'block', mt:1.25 }}>
          Uses model probabilities when available; otherwise shows the model’s pick without a percentage.
        </Typography>
      </CardContent>
    </Card>
  );
}
