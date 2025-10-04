// src/components/GamePage.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link as RouterLink } from "react-router-dom";
import {
  Box, Card, CardContent, Typography, List, ListItem, ListItemText
} from "@mui/material";

const BDL_BASE = "/api/bdl";

/* ---------------- helpers: sleep + retry w/ jitter ---------------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function withRetry(fn, tries = 3, baseDelay = 120) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      // jittered backoff: 120ms, 240ms, 360ms (+/- random)
      const delay = baseDelay * (i + 1) + Math.random() * 180;
      await sleep(delay);
    }
  }
  throw lastErr;
}

/* ---------------- date labels ---------------- */
function safeDateLabel(iso, hasClock) {
  if (!iso) return "TBD";
  const d = new Date(iso);
  try {
    return hasClock
      ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d)
      : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d);
  } catch {
    return "TBD";
  }
}

function calendarDateLabel(dateKey) {
  // Force noon UTC so the day never shifts by timezone
  if (!dateKey) return "TBD";
  const d = new Date(`${dateKey}T12:00:00Z`);
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d);
  } catch {
    return "TBD";
  }
}

/* ---------------- low-level fetchers with clearer errors ---------------- */
async function bdl(url) {
  const r = await fetch(url, { cache: "no-store" });
  const ct = (r.headers.get("content-type") || "").toLowerCase();
  const text = await r.text();
  if (!r.ok) throw new Error(`BDL ${r.status}: ${text.slice(0, 220)}`);
  if (ct.includes("application/json")) return JSON.parse(text);
  throw new Error(`BDL non-JSON response (${ct || "unknown"}). First bytes: ${text.slice(0, 160)}`);
}

async function fetchJsonViaGateway(pathAndQs) {
  const url = `${BDL_BASE}/${pathAndQs}`;
  const r = await fetch(url, { cache: "no-store" });
  const txt = await r.text();
  if (!r.ok) throw new Error(`BDL ${r.status}: ${txt.slice(0, 220)}`);
  const j = JSON.parse(txt);
  return j?.data ?? j;
}

/* ---------------- game loader ---------------- */
async function fetchGameById(id) {
  const j = await withRetry(() => bdl(`${BDL_BASE}/games/${id}`));
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

/* ---------------- season window ---------------- */
// NBA seasons run Oct–Jun, named by END year.
function seasonWindowFromISO(iso) {
  const d = iso ? new Date(iso) : new Date();
  const endYear = d.getMonth() >= 9 ? d.getFullYear() + 1 : d.getFullYear(); // Oct (9) → next year
  return { start: `${endYear - 1}-10-01`, end: `${endYear}-06-30`, endYear };
}

/* ---------------- lookups that power notes (made resilient) ---------------- */
// Minimal map (extend if you want all teams)
const BDL_TEAM_ID = { ATL:1,BOS:2,BKN:3,CHA:4,CHI:5,CLE:6,DAL:7,DEN:8,DET:9,GSW:10,HOU:11,IND:12,LAC:13,LAL:14,MEM:15,MIA:16,MIL:17,MIN:18,NOP:19,NYK:20,OKC:21,ORL:22,PHI:23,PHX:24,POR:25,SAC:26,SAS:27,TOR:28,UTA:29,WAS:30 };
function homeCodeToId(code){ const id = BDL_TEAM_ID[(code||"").toUpperCase()]; if (!id) throw new Error(`Unknown team code: ${code}`); return String(id); }

// Head-to-head this season (wins for HOME vs AWAY), includes games where either team was home.
// Soft-fails to [] so the UI shows “First meeting …” instead of “unavailable”.
async function fetchHeadToHead(homeCode, awayCode, dateISO) {
  const { start, end } = seasonWindowFromISO(dateISO);

  // Pull games for BOTH teams in the season window
  const qs = new URLSearchParams({
    start_date: start,
    end_date: end,
    per_page: "100",
  });
  qs.append("team_ids[]", homeCodeToId(homeCode));
  qs.append("team_ids[]", homeCodeToId(awayCode));

  const data = await fetchJsonViaGateway(`games?${qs.toString()}`).catch(() => []);
  const seen = new Set();

  let homeWins = 0, awayWins = 0;
  for (const g of data || []) {
    if (!g?.id || seen.has(g.id)) continue;
    seen.add(g.id);

    const hs = g?.home_team_score, as = g?.visitor_team_score;
    if (!Number.isFinite(hs) || !Number.isFinite(as)) continue;

    const h = (g?.home_team?.abbreviation || "").toUpperCase();
    const v = (g?.visitor_team?.abbreviation || "").toUpperCase();
    const involves = (h === homeCode && v === awayCode) || (h === awayCode && v === homeCode);
    if (!involves) continue;

    // Count from the perspective of the page's HOME team code
    const homeTeamIsH = h === homeCode;
    const homeScore   = homeTeamIsH ? hs : as;
    const awayScore   = homeTeamIsH ? as : hs;

    if (homeScore > awayScore) homeWins++;
    else if (awayScore > homeScore) awayWins++;
  }
  return { homeWins, awayWins };
}

function h2hAfterIncludingCurrent(h2h, game) {
  if (!h2h || !game) return h2h;
  const res = { ...h2h };
  const hs = game.home?.score;
  const as = game.away?.score;
  if (!Number.isFinite(hs) || !Number.isFinite(as)) return res;
  if (hs > as) res.homeWins += 1;
  else if (as > hs) res.awayWins += 1;
  return res;
}

// Roster → player ids → season_averages (fallback to 21-day stats)
async function fetchTeamLeaders(teamCode, dateISO) {
  const { endYear } = seasonWindowFromISO(dateISO);

  const rosterQs = new URLSearchParams({ "team_ids[]": homeCodeToId(teamCode), per_page: "100" }).toString();
  const roster = await withRetry(() => fetchJsonViaGateway(`players?${rosterQs}`)).catch(() => null);
  const ids = Array.from(new Set((roster || []).map(p => p?.id).filter(Number))).slice(0, 30);
  if (!ids.length) return null;

  // Try season averages first
  const saQs = new URLSearchParams({ season: String(endYear) });
  ids.forEach(id => saQs.append("player_ids[]", String(id)));
  let avgs = await withRetry(() => fetchJsonViaGateway(`season_averages?${saQs.toString()}`)).catch(() => null);

  // Fallback: recent 21-day stats -> compute per-game
  if (!Array.isArray(avgs) || avgs.length === 0) {
    const anchor = dateISO ? new Date(dateISO) : new Date();
    const endStr = anchor.toISOString().slice(0,10);
    const startStr = new Date(anchor.getTime() - 21*864e5).toISOString().slice(0,10);

    const statsQs = new URLSearchParams({
      "team_ids[]": homeCodeToId(teamCode),
      start_date: startStr,
      end_date: endStr,
      postseason: "false",
      per_page: "100"
    }).toString();

    const stats = await withRetry(() => fetchJsonViaGateway(`stats?${statsQs}`)).catch(() => []);
    const byId = new Map();
    for (const s of stats || []) {
      const pid = s?.player?.id;
      if (!pid) continue;
      if (!byId.has(pid)) byId.set(pid, { gp: 0, pts:0, reb:0, ast:0, ply: s.player });
      const row = byId.get(pid);
      row.gp += 1; row.pts += s?.pts||0; row.reb += s?.reb||0; row.ast += s?.ast||0;
    }
    avgs = Array.from(byId.values()).map(r => ({
      player_id: r.ply?.id, games_played: r.gp,
      pts: r.gp ? r.pts/r.gp : 0, reb: r.gp ? r.reb/r.gp : 0, ast: r.gp ? r.ast/r.gp : 0
    }));
  }

  if (!Array.isArray(avgs) || avgs.length === 0) return null;

  const byRoster = new Map((roster||[]).map(p=>[p.id, p]));
  const rows = avgs.map(a => ({
    id: a.player_id,
    gp: a.games_played ?? a.gp ?? 0,
    pts: a.pts ?? 0,
    reb: a.reb ?? 0,
    ast: a.ast ?? 0,
    ply: byRoster.get(a.player_id) || null
  }));

  const minGp = 3;
  const top = (key) => rows.filter(r => r.gp >= minGp).sort((x,y)=> (y[key]||0)-(x[key]||0))[0];
  const p = top("pts"), r = top("reb"), a = top("ast");
  const name = (row) => row?.ply ? `${row.ply.first_name||""} ${row.ply.last_name||""}`.trim() : null;

  return {
    season: endYear,
    points: p ? { name: name(p), v: p.pts } : null,
    rebounds: r ? { name: name(r), v: r.reb } : null,
    assists: a ? { name: name(a), v: a.ast } : null,
  };
}

async function fetchLast10Record(teamCode, dateISO) {
  const { start, end } = seasonWindowFromISO(dateISO);
  const qs = new URLSearchParams({
    "team_ids[]": homeCodeToId(teamCode),
    start_date: start,
    end_date: end,
    postseason: "false",
    per_page: "100"
  }).toString();

  // Primary attempt: finals up to anchor date, newest first
  const data = await fetchJsonViaGateway(`games?${qs}`).catch(() => []);
  let finals = (data || [])
    .filter(g => /final/i.test(g?.status || ""))
    .filter(g => (g?.date || "").slice(0, 10) <= (dateISO || "").slice(0, 10))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);

  // Fallback A: ignore anchor cutoff, just take most recent finals this season
  if (finals.length === 0 && Array.isArray(data)) {
    finals = data
      .filter(g => /final/i.test(g?.status || ""))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);
  }

  // Fallback B: previous season window if still empty (early season / preseason edge)
  if (finals.length === 0) {
    const d = dateISO ? new Date(dateISO) : new Date();
    const endYear = d.getMonth() >= 9 ? d.getFullYear() + 1 : d.getFullYear();
    const prevEndYear = endYear - 1;
    const prevStart = `${prevEndYear - 1}-10-01`;
    const prevEnd   = `${prevEndYear}-06-30`;
    const qs2 = new URLSearchParams({
      "team_ids[]": homeCodeToId(teamCode),
      start_date: prevStart,
      end_date: prevEnd,
      postseason: "false",
      per_page: "100"
    }).toString();
    const data2 = await fetchJsonViaGateway(`games?${qs2}`).catch(() => []);
    finals = (data2 || [])
      .filter(g => /final/i.test(g?.status || ""))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);
  }

  let w = 0, l = 0, t = 0;
  for (const g of finals) {
    const homeAbbr = (g.home_team?.abbreviation || "").toUpperCase();
    const hs = g.home_team_score, as = g.visitor_team_score;
    const mine   = homeAbbr === teamCode ? hs : as;
    const theirs = homeAbbr === teamCode ? as : hs;
    if (!Number.isFinite(mine) || !Number.isFinite(theirs)) continue;
    if (mine > theirs) w++; else if (mine < theirs) l++; else t++;
  }
  return `${w}-${l}${t ? `-${t}` : ""}`;
}


/* ---------------- component ---------------- */
export default function GamePage() {
  const { id } = useParams();
  const [game, setGame] = useState(null);
  const [err, setErr] = useState(null);

  const [h2h, setH2h] = useState(null);
  const [leadersHome, setLeadersHome] = useState(null);
  const [leadersAway, setLeadersAway] = useState(null);
  const [notesTried, setNotesTried] = useState({ h2h: false, leaders: false });
  const [formHome, setFormHome] = useState(null);
  const [formAway, setFormAway] = useState(null);

  // 1) Load the game when :id changes
  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const g = await fetchGameById(id);
        if (!ok) return;
        setGame(g);
        setErr(null);
      } catch (e) {
        if (!ok) return;
        setErr(e?.message || String(e));
        setGame(null);
      }
    })();
    return () => { ok = false; };
  }, [id]);

  // 2) When game is present, load Preview Notes (stagger + retry + soft fallbacks)
  useEffect(() => {
    if (!game) return;
    let ok = true;
    (async () => {
      try {
        const [hh, lh, la, fh, fa] = await Promise.all([
          withRetry(() => fetchHeadToHead(game.home.code, game.away.code, game.dateISO))
            .catch(() => ({ homeWins: 0, awayWins: 0 })),  // soft fallback
          sleep(60).then(() =>
            withRetry(() => fetchTeamLeaders(game.home.code, game.dateISO)).catch(() => null)
          ),
          sleep(120).then(() =>
            withRetry(() => fetchTeamLeaders(game.away.code, game.dateISO)).catch(() => null)
          ),
          sleep(180).then(() =>
            withRetry(() => fetchLast10Record(game.home.code, game.dateISO)).catch(() => "0-0")
          ),
          sleep(240).then(() =>
            withRetry(() => fetchLast10Record(game.away.code, game.dateISO)).catch(() => "0-0")
          ),
        ]);
        if (!ok) return;
        setH2h(hh);
        setLeadersHome(lh);
        setLeadersAway(la);
        setFormHome(fh);
        setFormAway(fa);
      } finally {
        if (ok) setNotesTried({ h2h: true, leaders: true });
      }
    })();
    return () => { ok = false; };
  }, [game]);

  // 3) AdSense push (optional)
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
  const h2hPost = isFinal && h2h ? h2hAfterIncludingCurrent(h2h, game) : h2h;
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
            (h2h.homeWins === 0 && h2h.awayWins === 0)
              ? (
                <Typography variant="body2" sx={{ mb: 1 }}>
                  First meeting between {game.away.code} and {game.home.code} this season.
                </Typography>
              ) : (
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Season series so far: {game.home.code} {h2h.homeWins}–{h2h.awayWins} {game.away.code}.
                </Typography>
              )
          ) : notesTried.h2h ? (
            <Typography variant="body2" sx={{ mb: 1, opacity: 0.8 }}>
              No season series info right now.
            </Typography>
          ) : (
            <Typography variant="body2" sx={{ mb: 1, opacity: 0.7 }}>
              Loading season series…
            </Typography>
          )}

            {isFinal && h2h && (
            <Typography variant="caption" sx={{ display:'block', mt: 0.25, mb: 1, opacity: 0.8 }}>
                After this result, the season series is {game.home.code} {h2hPost.homeWins}–{h2hPost.awayWins} {game.away.code}.
            </Typography>
            )}

          {/* Recent form */}
          {formHome && formAway && (
            <Typography variant="body2" sx={{ mb: 1 }}>
              Recent form (last 10): {game.home.code} {formHome}, {game.away.code} {formAway}.
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
            ) : notesTried.leaders ? (
              <ListItem disableGutters sx={{ py: 0.25 }}>
                <ListItemText primaryTypographyProps={{ variant: "body2" }} primary="Leaders temporarily unavailable." />
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
            ) : notesTried.leaders ? (
              <ListItem disableGutters sx={{ py: 0.25 }}>
                <ListItemText primaryTypographyProps={{ variant: "body2" }} primary="Leaders temporarily unavailable." />
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
