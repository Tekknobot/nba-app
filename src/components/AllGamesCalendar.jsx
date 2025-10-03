// src/components/AllGamesCalendar.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Card, CardContent, Chip, IconButton, Stack, Typography,
  Drawer, Divider, List, ListItem, ListItemText, Button,
  CircularProgress, Tooltip, ListItemButton, Avatar
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import "@fontsource/bebas-neue"; // defaults to 400 weight

import { Accordion, AccordionSummary, AccordionDetails } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

import SportsBasketballIcon from "@mui/icons-material/SportsBasketball";

import {
  summarizeLastNGames,
  daysRestBefore,
  isBackToBack,
  computeGameProbabilities,
  explainFactors,
} from "../utils/probability";

import {
  formatISOToLocal,
  formatISOInZone,
  shortLocal,
  shortInET,
  timeOnlyET,
  formatGameLabel,
} from "../utils/datetime";

import NbaNews from "./NbaNews";

import { API_BASE } from "../api/base"; // ✅ import only

/* ========= small date helpers ========= */
function firstOfMonth(d){ const x=new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; }
function addMonths(d,n){ const x=new Date(d); x.setDate(1); x.setMonth(x.getMonth()+n); return x; }
function dateKeyFromDate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function daysInMonth(year, month){ // month 0..11
  const out=[]; const d=new Date(year,month,1);
  while(d.getMonth()===month){ out.push(new Date(d)); d.setDate(d.getDate()+1); }
  return out;
}

/* ========= team codes (UI labels) ========= */
const TEAM_CODE = {
  "Atlanta Hawks":"ATL","Boston Celtics":"BOS","Brooklyn Nets":"BKN","Charlotte Hornets":"CHA","Chicago Bulls":"CHI",
  "Cleveland Cavaliers":"CLE","Dallas Mavericks":"DAL","Denver Nuggets":"DEN","Detroit Pistons":"DET","Golden State Warriors":"GSW",
  "Houston Rockets":"HOU","Indiana Pacers":"IND","LA Clippers":"LAC","Los Angeles Lakers":"LAL","Memphis Grizzlies":"MEM",
  "Miami Heat":"MIA","Milwaukee Bucks":"MIL","Minnesota Timberwolves":"MIN","New Orleans Pelicans":"NOP","New York Knicks":"NYK",
  "Oklahoma City Thunder":"OKC","Orlando Magic":"ORL","Philadelphia 76ers":"PHI","Phoenix Suns":"PHX","Portland Trail Blazers":"POR",
  "Sacramento Kings":"SAC","San Antonio Spurs":"SAS","Toronto Raptors":"TOR","Utah Jazz":"UTA","Washington Wizards":"WAS"
};

/* ========= balldontlie (free) team ids ========= */
const BDL_TEAM_ID = {
  ATL:1, BOS:2, BRK:3, BKN:3, CHO:4, CHA:4, CHI:5, CLE:6, DAL:7, DEN:8,
  DET:9, GSW:10, HOU:11, IND:12, LAC:13, LAL:14, MEM:15, MIA:16, MIL:17,
  MIN:18, NOP:19, NYK:20, OKC:21, ORL:22, PHI:23, PHX:24, PHO:24, POR:25,
  SAC:26, SAS:27, TOR:28, UTA:29, WAS:30
};
// 2024–25 season window (season end year = 2025; “summer-ish”)
const SEASON_START = "2024-10-01";
const SEASON_END   = "2025-06-30";

// --- DROP-IN: pretty number + name helpers ---
const nf1 = (v) => (v ?? 0).toFixed(1); // one decimal everywhere
function initials(first = "", last = "") {
  const f = (first || "").trim(); const l = (last || "").trim();
  return `${f ? f[0] : ""}${l ? l[0] : ""}`.toUpperCase() || "•";
}

const logit = (p) => Math.log(Math.max(1e-9, Math.min(1-1e-9, p)) / (1 - Math.max(1e-9, Math.min(1-1e-9, p))));
const ilogit = (z) => 1 / (1 + Math.exp(-z));
const clamp01 = (x) => Math.max(0, Math.min(1, x));


function displayName(player, fallbackId) {
  if (!player) return `#${fallbackId}`;
  const f = (player.first_name || "").trim();
  const l = (player.last_name || "").trim();
  return l ? `${f ? f[0] + ". " : ""}${l}` : (f || `#${fallbackId}`);
}

// --- Predictions attach/merge (legacy-tolerant, single source of truth) -----
function norm(s) {
  return String(s || "").trim().toUpperCase();
}
function codeOfTeam(t) {
  if (!t) return "";
  if (typeof t === "string") return norm(t);
  return norm(t.code || t.abbr || t.abbreviation || t.name);
}
function nameOfTeam(t) {
  if (!t) return "";
  if (typeof t === "string") return norm(t);
  return norm(t.name || t.full_name || t.team || t.code || t.abbr || t.abbreviation);
}
function keyVariants(dateKey, away, home) {
  const d = norm(dateKey);
  const A = codeOfTeam(away), H = codeOfTeam(home);
  const An = nameOfTeam(away), Hn = nameOfTeam(home);
  return [
    `${d}|${A}@${H}`,    // preferred
    `${d}|${H}vs${A}`,   // old shape
    `${d}|${H}@${A}`,    // swapped
    `${d}|${An}@${Hn}`,  // names
    `${d}|${Hn}@${An}`,  // swapped names
    `${d}|${A}|${H}`,    // pipe
    `${d}|${H}|${A}`,    // swapped pipe
  ];
}

/**
 * Accepts:
 * 1) Map:  { "<key>": { pick?: "POR", pHome?: 0.62 }, ... }
 * 2) Array: [{ date, away, home, pick?, pHome? }, ...] (codes or names)
 */
async function fetchPredictionsRange(startISO, endISO) {
  const base = (typeof API_BASE === "string" && API_BASE) ? API_BASE : "";

  // Try your API first
  if (base) {
    try {
      const url = `${base}/api/predictions?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        if (j && (Array.isArray(j) || typeof j === "object")) return j;
      }
    } catch { /* ignore and fall back */ }
  }

  // Dev fallback (bucketed by month)
  try {
    const monthKey = (startISO || "").slice(0, 7); // "YYYY-MM"
    const local = localStorage.getItem(`preds:${monthKey}`);
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && (Array.isArray(parsed) || typeof parsed === "object")) return parsed;
    }
  } catch {}

  return {}; // nothing
}

function resolveFromContainer(container, dateKey, away, home) {
  // Map-like lookup
  if (container && !Array.isArray(container)) {
    for (const k of keyVariants(dateKey, away, home)) {
      const v = container[k];
      if (v) return v;
    }
  }
  // Array lookup
  if (Array.isArray(container)) {
    for (const item of container) {
      const d  = norm(item.date || item.gameDate || item.d);
      const aw = norm(item.away || item.awayCode || item.visitor || item.v);
      const hm = norm(item.home || item.homeCode || item.h);
      if (d !== norm(dateKey)) continue;

      const codesMatch =
        (aw === codeOfTeam(away) || aw === nameOfTeam(away)) &&
        (hm === codeOfTeam(home) || hm === nameOfTeam(home));
      const swappedMatch =
        (aw === codeOfTeam(home) || aw === nameOfTeam(home)) &&
        (hm === codeOfTeam(away) || hm === nameOfTeam(away));

      if (codesMatch || swappedMatch) return item;
    }
  }
  return null;
}

/** Mutates rows in place by setting row.model.{predictedWinner|pHome} */
async function attachPredictionsForMonth(rows) {
  if (!rows?.length) return rows;
  const startISO = rows[0].dateKey;
  const endISO   = rows[rows.length - 1].dateKey;

  const container = await fetchPredictionsRange(startISO, endISO);

    for (const r of rows) {
    const found = resolveFromContainer(container, r.dateKey, r.away, r.home);
    if (!found) continue;

    // 1) Normalize explicit pick (accept codes, names, and "HOME"/"AWAY")
    let pick = found.pick || found.winner || found.predictedWinner || found.pred;
    if (pick) {
        const p = String(pick).trim().toUpperCase();
        if (p === "HOME") pick = r.home?.code;           // map to team code
        else if (p === "AWAY") pick = r.away?.code;      // map to team code
        r.model = { ...(r.model || {}), predictedWinner: norm(pick) };
    }

    // 2) Normalize probability (accept strings, alternate field names)
    const phRaw =
        found.pHome ?? found.p_home ?? found.homeProb ?? found.probHome ?? found.prob_home;
    const ph = Number(phRaw);
    if (Number.isFinite(ph)) {
        r.model = { ...(r.model || {}), pHome: ph };     // always store as Number
    }
    }

  return rows;
}
// ---------------------------------------------------------------------------

function verdictFromProbs(game, probs) {
  if (!probs || !game) return null;

  const pHome = Number(probs.pHome);
  if (!Number.isFinite(pHome)) return null;

  // Only show verdict once the game has a final score
  const isFinal = (game?.status || '').toLowerCase().includes('final');
  if (!isFinal) return null;

  const homeCode = codeify(game?.home, null);
  const awayCode = codeify(game?.away, null);
  if (!homeCode || !awayCode) return null;

  const predicted = pHome > 0.5 ? homeCode : awayCode;
  const actual = getActualWinnerCode(game);
  if (!actual || actual === 'TIE') return null;

  const correct = actual === predicted;
  const pct = Math.round(pHome * 100);
  return {
    state: correct ? 'correct' : 'incorrect',
    tooltip: `Predicted ${predicted} (${pct}%), actual ${actual}`,
  };
}


/* ========= Last-10 panel bits ========= */
function Last10List({ title, loading, error, data }){
  const record = React.useMemo(()=>{
    const arr = data?.games || [];
    let w=0,l=0,t=0;
    arr.forEach(g => { if(g.result==='W') w++; else if(g.result==='L') l++; else t++; });
    return arr.length ? `${w}-${l}${t?`-${t}`:''}` : null;
  }, [data]);

  return (
    <Card variant="outlined" sx={{ borderRadius:1, flex:1, minWidth:0 }}>
      <CardContent sx={{ p:2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight:700, mb:1 }}>
          {title}{record ? ` · ${record}` : ""}
        </Typography>
        <Divider sx={{ mb:1 }} />
        {loading ? (
          <Stack alignItems="center" sx={{ py:4 }}><CircularProgress size={20} /></Stack>
        ) : error ? (
          <Typography variant="body2" color="warning.main">{error}</Typography>
        ) : !data?.games?.length ? (
          <Typography variant="body2" sx={{ opacity:0.8 }}>No data.</Typography>
        ) : (
          <List dense sx={{ maxHeight: '45vh', overflow:'auto' }}>
            {data.games.slice(0,10).map((g,i)=>(
              <ListItem key={i} disableGutters>
                <ListItemText
                  primaryTypographyProps={{ variant:'body2', fontWeight:600 }}
                  secondaryTypographyProps={{ variant:'caption' }}
                  primary={`${g.date} — ${g.homeAway === 'Home' ? 'vs' : '@'} ${g.opp}`}
                  secondary={`${g.result || '?'} ${g.score || ''}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}

// --- Model helpers ----------------------------------------------------------
function codeify(teamObjOrStr, fallback = '') {
  if (!teamObjOrStr) return fallback;
  if (typeof teamObjOrStr === 'string') return teamObjOrStr.toUpperCase();
  return (teamObjOrStr.code || teamObjOrStr.abbr || teamObjOrStr.name || fallback).toUpperCase();
}

// Try to locate the model's predicted winner across a few common shapes.
function getPredictedWinnerCode(game) {
  // Prefer explicit winner strings/objects first
  const homeCode = codeify(game?.home, null);
  const awayCode = codeify(game?.away, null);

  const stringPickCandidates = [
    game?.model?.predictedWinner,
    game?.model?.winner,
    game?.prediction?.winner,
    game?.prediction?.predictedWinner,
    game?.predictedWinner,
    game?.predictedWinnerCode,
    game?.odds?.modelPick,
  ];

  for (const c of stringPickCandidates) {
    if (!c) continue;
    const raw = String(typeof c === "string" ? c : (c.code || c.abbr || c.name || "")).toUpperCase().trim();
    if (raw === "HOME" && homeCode) return homeCode;
    if (raw === "AWAY" && awayCode) return awayCode;
    const code = codeify(raw, null);
    if (code) return code; // e.g., "POR"
  }

  // Fallback: choose by probability when available (now numeric for sure)
  const probCandidates = [
    game?.model?.pHome,
    game?.model?.probHome,
    game?.prediction?.pHome,
    game?.prediction?.homeWinProb,
    game?.probabilities?.home,
    game?.probabilities?.pHome,
  ].map((v) => Number(v)).filter((v) => Number.isFinite(v));

  if (probCandidates.length && homeCode && awayCode) {
    const pHome = probCandidates[0];
    return pHome > 0.5 ? homeCode : awayCode;
  }

  return null;
}

function seasonDateWindow(endYear){
  const start = `${endYear-1}-10-01`;
  const end   = `${endYear}-06-30`;
  return { start, end };
}

function getActualWinnerCode(game) {
  const home = codeify(game?.home, 'HOME');
  const away = codeify(game?.away, 'AWAY');
  const hs = Number(game?.homeScore ?? NaN);
  const as = Number(game?.awayScore ?? NaN);
  if (Number.isNaN(hs) || Number.isNaN(as)) return null;
  if (hs === as) return 'TIE';
  return hs > as ? home : away;
}

function modelVerdict(game) {
  // Only evaluate when Final
  const isFinal = (game?.status || '').toLowerCase().includes('final');
  if (!isFinal) return null;

  const actual = getActualWinnerCode(game);
  const predicted = getPredictedWinnerCode(game);

  // If we don't have both a result and a prediction, don't render anything.
  if (!actual || !predicted || actual === 'TIE') return null;

  const correct = actual === predicted;
  return {
    state: correct ? 'correct' : 'incorrect',
    tooltip: `Predicted ${predicted}, actual ${actual}`,
  };
}

function isoDaysAgo(n, from = new Date()){
  const d = new Date(from); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0,10);
}
function clampISODateOnly(iso){ return (iso || '').slice(0,10); }

function lastCompletedSeasonEndYear(d = new Date()){
  // NBA seasons end in June. If we're before July, last completed season ended last year.
  const y = d.getFullYear();
  const m = d.getMonth(); // 0=Jan
  return (m >= 6) ? y : (y - 1);
}

function toISODateOnly(d) { return new Date(d).toISOString().slice(0,10); }
function windowISO({ anchorISO, days }) {
  const anchor = anchorISO || toISODateOnly(new Date());
  const start  = isoDaysAgo(days, new Date(anchor));
  return { start, end: anchor };
}
function lastCompletedSeasonEndYearAt(anchor = new Date()){
  // season ends in June; if anchor is after June, last completed season ended this year, else last year
  const y = anchor.getFullYear();
  const m = anchor.getMonth(); // 0=Jan … 11=Dec
  return (m >= 6) ? y : (y - 1);
}

function seasonWindowUpTo(anchorISO){
  const d = new Date(anchorISO || new Date());
  const endYear = (d.getMonth() >= 9) ? d.getFullYear() + 1 : d.getFullYear(); // season named by END year
  const start = `${endYear - 1}-10-01`;
  const end   = clampISODateOnly(anchorISO) || `${endYear}-06-30`;
  return { start, end, endYear };
}

async function fetchTeamLast10UpToBDL(teamAbbr, anchorISO){
  const teamId = BDL_TEAM_ID[teamAbbr];
  if (!teamId) throw new Error(`Unknown team code: ${teamAbbr}`);

  const { start, end } = seasonWindowUpTo(anchorISO);

  const u = new URL("https://api.balldontlie.io/v1/games");
  u.searchParams.set("team_ids[]", String(teamId));
  u.searchParams.set("start_date", start);
  u.searchParams.set("end_date", end);
  u.searchParams.set("postseason", "false");
  u.searchParams.set("per_page", "100");

  const headers = bdlHeaders();
  let page = 1, all = [];
  while (true) {
    u.searchParams.set("page", String(page));
    const r = await fetch(u, { headers });
    if (r.status === 401) throw new Error("BDL 401 (missing/invalid API key). Add REACT_APP_BDL_API_KEY in .env.local and restart.");
    if (!r.ok) throw new Error(`BDL HTTP ${r.status}`);
    const j = await r.json();
    const data = Array.isArray(j?.data) ? j.data : [];
    all.push(...data);
    if (!j?.meta?.next_page) break;
    page = j.meta.next_page;
  }

  const finals = all
    .filter(g => (g?.status || "").toLowerCase().includes("final"))
    .filter(g => clampISODateOnly(g?.date) <= clampISODateOnly(end))
    .sort((a,b)=> new Date(b.date) - new Date(a.date))
    .slice(0, 10)
    .map(g => {
      const home = (g.home_team?.abbreviation || "HOME").toUpperCase();
      const away = (g.visitor_team?.abbreviation || "AWAY").toUpperCase();
      const isHome = home === teamAbbr;
      const my     = isHome ? g.home_team_score : g.visitor_team_score;
      const their  = isHome ? g.visitor_team_score : g.home_team_score;
      const result = my > their ? "W" : (my < their ? "L" : "T");
      const opp    = isHome ? away : home;
      const score  = `${home} ${g.home_team_score} - ${away} ${g.visitor_team_score}`;
      return {
        date: clampISODateOnly(g.date),
        opp,
        homeAway: isHome ? "Home" : "Away",
        result,
        score
      };
    });

  return { team: teamAbbr, games: finals, _source: `balldontlie:seasonTo(${end})` };
}

async function fetchTeamLast10FromSeasonBDL(teamAbbr, seasonEndYear){
  const teamId = BDL_TEAM_ID[teamAbbr];
  if (!teamId) throw new Error(`Unknown team code: ${teamAbbr}`);
  const { start, end } = seasonDateWindow(seasonEndYear);

  const u = new URL("https://api.balldontlie.io/v1/games");
  u.searchParams.set("team_ids[]", String(teamId));
  u.searchParams.set("start_date", start);
  u.searchParams.set("end_date", end);
  u.searchParams.set("postseason", "false");
  u.searchParams.set("per_page", "100");

  const headers = bdlHeaders();
  let page = 1, all = [];
  while (true) {
    u.searchParams.set("page", String(page));
    const r = await fetch(u, { headers });
    if (r.status === 401) throw new Error("BDL 401 (missing/invalid API key). Add REACT_APP_BDL_API_KEY in .env.local and restart.");
    if (r.status === 402 || r.status === 403) throw new Error("BDL paid tier required for date filters.");
    if (!r.ok) throw new Error(`BDL HTTP ${r.status}`);
    const j = await r.json();
    const data = Array.isArray(j?.data) ? j.data : [];
    all.push(...data);
    if (!j?.meta?.next_page) break;
    page = j.meta.next_page;
  }

  const finals = all
    .filter(g => (g?.status || "").toLowerCase().includes("final"))
    .sort((a,b)=> new Date(b.date) - new Date(a.date))
    .slice(0, 10)
    .map(g => {
      const home = (g.home_team?.abbreviation || "HOME").toUpperCase();
      const away = (g.visitor_team?.abbreviation || "AWAY").toUpperCase();
      const isHome = home === teamAbbr;
      const my     = isHome ? g.home_team_score : g.visitor_team_score;
      const their  = isHome ? g.visitor_team_score : g.home_team_score;
      const result = my > their ? "W" : (my < their ? "L" : "T");
      const opp    = isHome ? away : home;
      const score  = `${home} ${g.home_team_score} - ${away} ${g.visitor_team_score}`;
      return {
        date: (g.date || "").slice(0,10),
        opp,
        homeAway: isHome ? "Home" : "Away",
        result,
        score
      };
    });

  return { team: teamAbbr, games: finals, _source: `balldontlie:season(${start}→${end})` };
}

// ---------------------------------------------------------------------------
async function fetchTeamSeasonPointDiffBDL(teamAbbr, seasonEndYear){
  const teamId = BDL_TEAM_ID[teamAbbr];
  if (!teamId) throw new Error(`Unknown team code: ${teamAbbr}`);

  const { start, end } = seasonDateWindow(seasonEndYear);

  const u = new URL("https://api.balldontlie.io/v1/games");
  u.searchParams.set("team_ids[]", String(teamId));
  u.searchParams.set("start_date", start);
  u.searchParams.set("end_date", end);
  u.searchParams.set("postseason", "false");
  u.searchParams.set("per_page", "100");

  const headers = bdlHeaders();
  let page = 1, gp = 0, sumMargin = 0;
  while (true) {
    u.searchParams.set("page", String(page));
    const r = await fetch(u, { headers });
    if (r.status === 401) throw new Error("BDL 401 (missing/invalid API key). Add REACT_APP_BDL_API_KEY in .env.local and restart.");
    if (!r.ok) throw new Error(`BDL HTTP ${r.status}`);
    const j = await r.json();
    const data = Array.isArray(j?.data) ? j.data : [];

    for (const g of data) {
      const hs = g?.home_team_score;
      const as = g?.visitor_team_score;
      if (!Number.isFinite(hs) || !Number.isFinite(as)) continue;

      const home = (g?.home_team?.abbreviation || "").toUpperCase();
      const isHome = home === teamAbbr;
      const my = isHome ? hs : as;
      const opp = isHome ? as : hs;

      gp += 1;
      sumMargin += (my - opp); // positive if team outscored opp
    }

    if (!j?.meta?.next_page) break;
    page = j.meta.next_page;
  }

  const diff = gp ? (sumMargin / gp) : 0; // average point differential
  return { gp, diff };
}

async function fetchTinyPreseasonNudgeBDL(teamAbbr){
  const teamId = BDL_TEAM_ID[teamAbbr];
  if (!teamId) return 0;
  const u = new URL("https://api.balldontlie.io/v1/games");
  u.searchParams.set("team_ids[]", String(teamId));
  u.searchParams.set("start_date", isoDaysAgo(30));
  u.searchParams.set("end_date", new Date().toISOString().slice(0,10));
  u.searchParams.set("per_page", "100");

  const headers = bdlHeaders();
  const r = await fetch(u, { headers });
  if (!r.ok) return 0;
  const j = await r.json();
  const data = Array.isArray(j?.data) ? j.data : [];

  let gp = 0, sumMargin = 0;
  for (const g of data) {
    if (!/final/i.test(g?.status || "")) continue;
    const hs = g?.home_team_score, as = g?.visitor_team_score;
    if (!Number.isFinite(hs) || !Number.isFinite(as)) continue;
    const home = (g?.home_team?.abbreviation || "").toUpperCase();
    const isHome = home === teamAbbr;
    const my = isHome ? hs : as;
    const opp = isHome ? as : hs;
    gp += 1; sumMargin += (my - opp);
  }
  if (!gp) return 0;
  // tiny weight: convert to ~0.2 of its raw effect
  return (sumMargin / gp) * 0.2;
}

function logistic(pAdv, scale = 6.5){ // scale ~ how many points ~= 75/25 swing
  // p = 1 / (1 + e^(-pAdv/scale))
  const z = Math.max(-50, Math.min(50, pAdv / scale));
  return 1 / (1 + Math.exp(-z));
}

function seasonBoundsFor(anchorISO){
  const d = new Date(anchorISO || new Date());
  const y = d.getFullYear();
  const m = d.getMonth(); // 0..11
  const endYear = (m >= 9) ? y + 1 : y; // season named by END year
  const start = new Date(`${endYear - 1}-10-01T00:00:00Z`);
  const end   = new Date(`${endYear}-06-30T23:59:59Z`);
  return { start, end, endYear };
}
function isWithinSeason(anchorISO){
  const a = new Date(anchorISO || new Date());
  const { start, end } = seasonBoundsFor(anchorISO);
  return a >= start && a <= end;
}

async function computePriorEdgeBDL(homeCode, awayCode){
  // Pick last completed season as prior
  const today = new Date();
  const seasonEndYear = (today.getMonth() >= 9) ? today.getFullYear() : today.getFullYear(); // before tip, last completed season ended this calendar year
  const prevSeasonEnd = seasonEndYear; // e.g., before 2024-25 starts, prev end = 2024

  const [homePrev, awayPrev] = await Promise.all([
    fetchTeamSeasonPointDiffBDL(homeCode, prevSeasonEnd),
    fetchTeamSeasonPointDiffBDL(awayCode, prevSeasonEnd),
  ]);

  // Home-court baseline (in points)
  const HCA = 2.3; // conservative NBA HCA estimate

  // Optional tiny preseason nudge
  const [hPre, aPre] = await Promise.all([
    fetchTinyPreseasonNudgeBDL(homeCode),
    fetchTinyPreseasonNudgeBDL(awayCode),
  ]);

  // Point-advantage estimate: (home prior - away prior) + HCA + preseason deltas
  const pointAdv = (homePrev.diff - awayPrev.diff) + HCA + (hPre - aPre);

  const pHome = logistic(pointAdv, 6.5);

  return {
    pHome,
    deltas: {
      priorDiff: +(homePrev.diff - awayPrev.diff).toFixed(2),
      hca: +HCA.toFixed(1),
      preseason: +(hPre - aPre).toFixed(2),
    },
    sources: {
      seasonEndYear: prevSeasonEnd,
      homeGP: homePrev.gp,
      awayGP: awayPrev.gp,
    }
  };
}

async function buildProbsForGameAsync({ game, awayData, homeData }) {
  const gameDateISO =
    (game?._iso || "").slice(0,10) || (game?.dateKey || "") || new Date().toISOString().slice(0,10);

  const homeGames = homeData?.games || [];
  const awayGames = awayData?.games || [];

  // Always compute a PRIOR
  const homeCode = game?.home?.code, awayCode = game?.away?.code;
  const prior = (homeCode && awayCode) ? await computePriorEdgeBDL(homeCode, awayCode) : null;
  const pPrior = prior?.pHome ?? 0.5;

  // If we have recent games for BOTH teams, build a recent-form probability
  let pRecent = null, recentInfo = null;
  if (homeGames.length && awayGames.length) {
    const homeSummary = summarizeLastNGames(homeGames, 10);
    const awaySummary = summarizeLastNGames(awayGames, 10);
    const homeRestDays = daysRestBefore(gameDateISO, homeGames);
    const awayRestDays = daysRestBefore(gameDateISO, awayGames);
    const homeB2B = isBackToBack(gameDateISO, homeGames);
    const awayB2B = isBackToBack(gameDateISO, awayGames);

    const P = computeGameProbabilities({
      homeSummary, awaySummary,
      homeRestDays, awayRestDays,
      homeB2B, awayB2B,
      neutralSite: false,
    });
    pRecent = P.pHome;
    recentInfo = { P, homeGamesN: homeGames.length, awayGamesN: awayGames.length };
  }

  // BLENDING LOGIC
  if (pRecent == null) {
    // No recent window yet → prior only
    return {
      pHome: pPrior,
      mode: "prior",
      deltas: prior?.deltas || {},
      factors: [
        { label: "Last season diff (H−A)", value: `${prior?.deltas?.priorDiff?.toFixed?.(2) ?? 0} pts/g` },
        { label: "Home-court", value: `${prior?.deltas?.hca ?? 2.3} pts` },
        { label: "Preseason nudge", value: `${prior?.deltas?.preseason?.toFixed?.(2) ?? 0} pts` },
      ],
      provenance: `Prior-only (no current-season window yet). Based on last season point differential + home-court + tiny preseason weight.`,
      confidence: 0.25, // low
      gamesUsed: { recentHome: 0, recentAway: 0 }
    };
  }

  // Compute how much **current-season** data we have and grow alpha with it
  const nH = homeGames.filter(g => /W|L|T/.test(g.result)).length || homeGames.length;
  const nA = awayGames.filter(g => /W|L|T/.test(g.result)).length || awayGames.length;
  const nEff = Math.min(nH, nA);

  // Example schedule:
  // 0 games → 0.00, 1 → 0.25, 2 → 0.40, 3 → 0.55, 4 → 0.70, ≥5 → 0.80
  const alpha = clamp01(
    nEff >= 5 ? 0.80 :
    nEff === 4 ? 0.70 :
    nEff === 3 ? 0.55 :
    nEff === 2 ? 0.40 :
    nEff === 1 ? 0.25 : 0.00
  );

  // Blend on the logit scale for better calibration
  const z = (1 - alpha) * logit(pPrior) + alpha * logit(pRecent);
  const pBlend = ilogit(z);

  return {
    pHome: pBlend,
    mode: alpha >= 0.8 ? "recent" : "blend",
    deltas: recentInfo?.P?.deltas || prior?.deltas || {},
    factors: recentInfo
      ? explainFactors({ homeSummary: summarizeLastNGames(homeGames, 10),
                         awaySummary: summarizeLastNGames(awayGames, 10),
                         deltas: recentInfo.P.deltas })
      : [
          { label: "Last season diff (H−A)", value: `${prior?.deltas?.priorDiff?.toFixed?.(2) ?? 0} pts/g` },
          { label: "Home-court", value: `${prior?.deltas?.hca ?? 2.3} pts` },
          { label: "Preseason nudge", value: `${prior?.deltas?.preseason?.toFixed?.(2) ?? 0} pts` },
        ],
    provenance:
      alpha === 0
        ? `Prior-only (no current-season data).`
        : `Blended: ${Math.round(alpha*100)}% recent form (last 21 days) + ${Math.round((1-alpha)*100)}% prior (last season + HCA + tiny preseason).`,
    confidence: Math.max(0.25, alpha),              // expose as 0.25–0.8 in early going
    gamesUsed: { recentHome: nH, recentAway: nA },  // handy for the UI
  };
}


async function fetchTeamFormBDL(teamAbbr, {
   days = 21, includePostseason = false, anchorISO = null
 } = {}) {
  const teamId = BDL_TEAM_ID[teamAbbr];
  if (!teamId) throw new Error(`Unknown team code: ${teamAbbr}`);

  const { start: start_date, end: end_date } = windowISO({ anchorISO, days });

  // /v1/games supports team_ids[], start_date, end_date, postseason
  const u = new URL("https://api.balldontlie.io/v1/games");
  u.searchParams.set("team_ids[]", String(teamId));
  u.searchParams.set("start_date", start_date);
  u.searchParams.set("end_date", end_date);
  u.searchParams.set("postseason", includePostseason ? "true" : "false");
  u.searchParams.set("per_page", "100");

  const headers = bdlHeaders();
  let page = 1, all = [];
  while (true) {
    u.searchParams.set("page", String(page));
    const r = await fetch(u, { headers });
    if (r.status === 401) throw new Error("BDL 401 (missing/invalid API key). Add REACT_APP_BDL_API_KEY in .env.local and restart.");
    if (r.status === 402 || r.status === 403) throw new Error("BDL paid tier required for recent game window.");
    if (!r.ok) throw new Error(`BDL HTTP ${r.status}`);
    const j = await r.json();
    const data = Array.isArray(j?.data) ? j.data : [];
    all.push(...data);
    if (!j?.meta?.next_page) break;
    page = j.meta.next_page;
  }

  // Convert to your { team, games:[{date,opp,homeAway,result,score}] } shape
  const games = all
    .filter(g => (g?.status || "").toLowerCase().includes("final"))
    .sort((a,b)=> new Date(b.date) - new Date(a.date))
    .slice(0, 10) // still last-10, but taken from the recent window
    .map(g => {
      const home = (g.home_team?.abbreviation || "HOME").toUpperCase();
      const away = (g.visitor_team?.abbreviation || "AWAY").toUpperCase();
      const isHome = home === teamAbbr;
      const my     = isHome ? g.home_team_score : g.visitor_team_score;
      const their  = isHome ? g.visitor_team_score : g.home_team_score;
      const result = my > their ? "W" : (my < their ? "L" : "T");
      const opp    = isHome ? away : home;
      const score  = `${home} ${g.home_team_score} - ${away} ${g.visitor_team_score}`;
      return {
        date: clampISODateOnly(g.date),
        opp, homeAway: isHome ? "Home" : "Away", result, score
      };
    });

  return { team: teamAbbr, games, _source: `balldontlie:recent(${start_date}→${end_date})` };
}

async function fetchTeamLast10FromSeasonAtBDL(teamAbbr, anchorISO){
  const endYear = lastCompletedSeasonEndYearAt(new Date(anchorISO));
  return fetchTeamLast10FromSeasonBDL(teamAbbr, endYear);
}

async function fetchRecentPlayerAveragesBDL(teamAbbr, {
   days = 21, seasonEndYear = 2025, anchorISO = null,
 } = {}) {
  const teamId = BDL_TEAM_ID[teamAbbr];
  if (!teamId) throw new Error(`Unknown team code: ${teamAbbr}`);

  const { start: start_date, end: end_date } = windowISO({ anchorISO, days });

  // Pull recent box-score level rows, aggregated client-side by player_id.
  // /v1/stats supports team_ids[], start_date, end_date, postseason=false
  const u = new URL("https://api.balldontlie.io/v1/stats");
  u.searchParams.set("team_ids[]", String(teamId));
  u.searchParams.set("start_date", start_date);
  u.searchParams.set("end_date", end_date);
  u.searchParams.set("postseason", "false");
  u.searchParams.set("per_page", "100");

  const headers = bdlHeaders();
  let page = 1, rows = [];
  while (true) {
    u.searchParams.set("page", String(page));
    const r = await fetch(u, { headers });
    if (r.status === 401) throw new Error("BDL 401 (missing/invalid API key). Add REACT_APP_BDL_API_KEY in .env.local and restart.");
    if (r.status === 402 || r.status === 403) throw new Error("BDL paid tier required for recent player stats.");
    if (!r.ok) throw new Error(`BDL HTTP ${r.status}`);
    const j = await r.json();
    const data = Array.isArray(j?.data) ? j.data : [];
    rows.push(...data);
    if (!j?.meta?.next_page) break;
    page = j.meta.next_page;
  }

  // Aggregate per player_id
  const byPlayer = new Map();
  for (const s of rows) {
    const pid = Number(s?.player?.id ?? s?.player_id);
    if (!Number.isFinite(pid)) continue;
    if (!byPlayer.has(pid)) {
      byPlayer.set(pid, {
        player_id: pid,
        player: s.player || null,
        gp: 0, min: 0, pts: 0, reb: 0, ast: 0,
      });
    }
    const p = byPlayer.get(pid);
    p.gp += 1;
    // times are strings like "32:18"; approximate to minutes.float
    p.min += parseMinToNumber(String(s?.min || s?.minutes || "0:00"));
    p.pts += Number(s?.pts || 0);
    p.reb += Number(s?.reb || 0);
    p.ast += Number(s?.ast || 0);
  }

  // Convert to averages
  const avgs = Array.from(byPlayer.values()).map(p => ({
    player_id: p.player_id,
    player: p.player,
    // Keep min as "avg minutes per game" in mm:ss-like precision? we’ll keep float for ranking and present 1-decimal.
    min: `${Math.floor((p.min / p.gp) || 0)}:${String(Math.round((((p.min / p.gp) % 1) * 60))||0).padStart(2,'0')}`,
    pts: (p.pts / p.gp) || 0,
    reb: (p.reb / p.gp) || 0,
    ast: (p.ast / p.gp) || 0,
  }));

  // Rank by minutes (desc), then points
  avgs.sort((a,b)=>{
    const am = parseMinToNumber(a.min), bm = parseMinToNumber(b.min);
    if (bm !== am) return bm - am;
    return (b.pts||0) - (a.pts||0);
  });

  return { window: `${start_date}→${end_date}`, players: avgs };
}

/* ========= Fetch last-10 (existing) ========= */
async function fetchLast10BDL(teamCode) {
  const id = BDL_TEAM_ID[teamCode];
  if (!id) throw new Error(`Unknown team code: ${teamCode}`);

  const params = new URLSearchParams({
    "team_ids[]": String(id),
    "start_date": SEASON_START,
    "end_date": SEASON_END,
    "per_page": "100",
  });

  const url = `https://api.balldontlie.io/v1/games?${params.toString()}`;

  const headers = {};
  const key = process.env.REACT_APP_BDL_API_KEY;
  if (key) headers["Authorization"] = key;

  const res = await fetch(url, { headers });
  if (res.status === 401) throw new Error("BDL 401 (missing/invalid API key). Add REACT_APP_BDL_API_KEY in .env.local and restart.");
  if (!res.ok) throw new Error(`BDL HTTP ${res.status}`);

  const json = await res.json();
  const data = Array.isArray(json?.data) ? json.data : [];

  const finals = data
    .filter(g => (g?.status || "").toLowerCase().includes("final"))
    .filter(g => !g?.postseason)
    .sort((a,b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);

  const games = finals.map(g => {
    const home = (g.home_team?.abbreviation || "HOME").toUpperCase();
    const away = (g.visitor_team?.abbreviation || "AWAY").toUpperCase();
    const isHome = home === teamCode;
    const my = isHome ? g.home_team_score : g.visitor_team_score;
    const their = isHome ? g.visitor_team_score : g.home_team_score;
    const result = my > their ? "W" : (my < their ? "L" : "T");
    const opp = isHome ? away : home;
    const score = `${home} ${g.home_team_score} - ${away} ${g.visitor_team_score}`;
    return {
      date: (g.date || "").slice(0,10),
      opp,
      homeAway: isHome ? "Home" : "Away",
      result,
      score
    };
  });

  return { team: teamCode, games, _source: "balldontlie" };
}

/* ========= New: Month schedule from balldontlie ========= */
function monthRange(year, month /* 0-11 */){
  const start = new Date(year, month, 1);
  const end   = new Date(year, month + 1, 0);
  const fmt = (d)=> `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return { start: fmt(start), end: fmt(end) };
}

// Robust month fetch: follows meta.next_page and de-dupes by id
async function fetchMonthScheduleBDL(year, month /* 0-11 */) {
  const { start, end } = monthRange(year, month);
  const headers = {};
  const key = process.env.REACT_APP_BDL_API_KEY;
  if (key) headers["Authorization"] = key;

  const per_page = 100;
  let page = 1;
  const byId = new Map(); // dedupe

  while (true) {
    const params = new URLSearchParams({
      start_date: start,
      end_date: end,
      per_page: String(per_page),
      page: String(page),
    });

    const url = `https://api.balldontlie.io/v1/games?${params.toString()}`;
    const res = await fetch(url, { headers });
    if (res.status === 401)
      throw new Error("BDL 401 (missing/invalid API key). Add REACT_APP_BDL_API_KEY in .env.local and restart.");
    if (!res.ok) throw new Error(`BDL HTTP ${res.status}`);

    const json = await res.json();
    const data = Array.isArray(json?.data) ? json.data : [];
    const nextPage = json?.meta?.next_page || null;

    for (const g of data) {
      if (g?.postseason) continue; // regular season only

      const dateISO = (g?.date || "").slice(0, 10); // YYYY-MM-DD
      if (!dateISO) continue;

      const homeName = g?.home_team?.full_name || g?.home_team?.name || g?.home_team?.abbreviation;
      const awayName = g?.visitor_team?.full_name || g?.visitor_team?.name || g?.visitor_team?.abbreviation;
      if (!homeName || !awayName) continue;

      // detect whether BDL provided a real tip time (non-midnight UTC)
      const raw = g?.date ? new Date(g.date) : null;
      const hasClock = !!(raw && !Number.isNaN(raw.getTime()) && raw.getUTCHours() !== 0);
      const isoFull = hasClock ? raw.toISOString() : `${dateISO}T12:00:00Z`; // noon fallback to avoid date slip

      byId.set(g.id, {
        id: g.id,
        _iso: isoFull,
        dateKey: dateISO,
        status: g?.status || "Scheduled",
        hasClock,
        homeScore: Number.isFinite(g?.home_team_score) ? g.home_team_score : null,
        awayScore: Number.isFinite(g?.visitor_team_score) ? g.visitor_team_score : null,
        et: (g?.status || "").toLowerCase().includes("scheduled") ? "TBD" : (g?.status || "TBD"),
        seasonStageId: 2,
        home: { name: homeName, code: TEAM_CODE[homeName] || (g?.home_team?.abbreviation || homeName) },
        away: { name: awayName, code: TEAM_CODE[awayName] || (g?.visitor_team?.abbreviation || awayName) },
      });
    }

    if (!nextPage) break;
    page = nextPage;
  }

  const rows = Array.from(byId.values());
  rows.sort(
    (a, b) =>
      (a._iso || "").localeCompare(b._iso || "") ||
      (a.home?.name || "").localeCompare(b.home?.name || "")
  );
  return rows;
}

// --- DROP-IN: small helpers reused below ---
function bdlHeaders() {
  const key = process.env.REACT_APP_BDL_API_KEY;
  return key ? { Authorization: key } : {};
}
function parseMinToNumber(minStr) {
  // "34:12" -> 34.2 approx; very rough, ok for sorting
  if (!minStr || typeof minStr !== "string") return 0;
  const [m, s] = minStr.split(":").map(Number);
  return (isFinite(m) ? m : 0) + (isFinite(s) ? s/60 : 0);
}

// --- DROP-IN: head-to-head this season (A vs B) ---
async function fetchHeadToHeadBDL(teamA_abbr, teamB_abbr, {
  start = SEASON_START, end = SEASON_END
} = {}) {
  const teamA_id = BDL_TEAM_ID[teamA_abbr];
  if (!teamA_id) throw new Error(`Unknown team code: ${teamA_abbr}`);
  const u = new URL("https://api.balldontlie.io/v1/games");
  u.searchParams.set("team_ids[]", String(teamA_id));
  u.searchParams.set("start_date", start);
  u.searchParams.set("end_date", end);
  u.searchParams.set("per_page", "100");

  const headers = bdlHeaders();
  let page = 1, all = [];
  while (true) {
    u.searchParams.set("page", String(page));
    const r = await fetch(u, { headers });
    if (r.status === 401) throw new Error("BDL 401 (missing/invalid API key). Add REACT_APP_BDL_API_KEY in .env.local and restart.");
    if (!r.ok) throw new Error(`BDL HTTP ${r.status}`);
    const j = await r.json();
    const data = Array.isArray(j?.data) ? j.data : [];
    all.push(...data);
    if (!j?.meta?.next_page) break;
    page = j.meta.next_page;
  }

  // Keep only games where the opponent is B
  const vs = all.filter(g => {
    const h = (g?.home_team?.abbreviation || "").toUpperCase();
    const v = (g?.visitor_team?.abbreviation || "").toUpperCase();
    return h === teamB_abbr || v === teamB_abbr;
  });

  // Tally wins for A and B (finals only)
  let aWins = 0, bWins = 0;
  for (const g of vs) {
    const hs = g?.home_team_score, as = g?.visitor_team_score;
    if (!Number.isFinite(hs) || !Number.isFinite(as)) continue;
    const homeAbbr = (g?.home_team?.abbreviation || "").toUpperCase();
    const aIsHome = homeAbbr === teamA_abbr;
    const aScore = aIsHome ? hs : as;
    const bScore = aIsHome ? as : hs;
    if (aScore > bScore) aWins++; else if (aScore < bScore) bWins++;
  }
  return { aWins, bWins, games: vs };
}

// --- DROP-IN: roster by team id (quick) ---
async function fetchTeamRosterByTeamIdBDL(teamAbbr, { perPage = 100 } = {}) {
  const teamId = BDL_TEAM_ID[teamAbbr];
  if (!teamId) throw new Error(`Unknown team code: ${teamAbbr}`);
  const headers = bdlHeaders();
  let page = 1, out = [];
  const u = new URL("https://api.balldontlie.io/v1/players");
  u.searchParams.set("team_ids[]", String(teamId));
  u.searchParams.set("per_page", String(perPage));
  while (true) {
    u.searchParams.set("page", String(page));
    const r = await fetch(u, { headers });
    if (r.status === 401) throw new Error("BDL 401 (missing/invalid API key). Add REACT_APP_BDL_API_KEY in .env.local and restart.");
    if (!r.ok) throw new Error(`BDL HTTP ${r.status}`);
    const j = await r.json();
    const arr = Array.isArray(j?.data) ? j.data : [];
    out.push(...arr);
    if (!j?.meta?.next_page) break;
    page = j.meta.next_page;
  }
  return out; // array of players with .id
}

// --- DROP-IN: season averages for many players at once ---
async function fetchSeasonAveragesBatchBDL(playerIds, seasonEndYear = 2025) {
  if (!playerIds?.length) return [];
  // Batch request with multiple player_ids[]
  const u = new URL("https://api.balldontlie.io/v1/season_averages");
  u.searchParams.set("season", String(seasonEndYear));
  for (const id of playerIds) u.searchParams.append("player_ids[]", String(id));
  const r = await fetch(u, { headers: bdlHeaders() });
  if (r.status === 401) throw new Error("BDL 401 (missing/invalid API key). Add REACT_APP_BDL_API_KEY in .env.local and restart.");
  if (!r.ok) throw new Error(`BDL HTTP ${r.status}`);
  const j = await r.json();
  return Array.isArray(j?.data) ? j.data : [];
}

function dateOnlyLabel(dateKey) {
  if (!dateKey) return "TBD";
  // Noon UTC to keep the same calendar date across US time zones
  const d = new Date(`${dateKey}T12:00:00Z`);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

/* ========= Probability helpers for the drawer UI ========= */
function buildProbsForGame({ game, awayData, homeData }) {
  const gameDateISO =
    (game?._iso || "").slice(0, 10) ||
    (game?.dateKey || "") ||
    new Date().toISOString().slice(0, 10);

  const homeGames = homeData?.games || [];
  const awayGames = awayData?.games || [];
  if (!homeGames.length || !awayGames.length) return null;

  const homeSummary = summarizeLastNGames(homeGames, 10);
  const awaySummary = summarizeLastNGames(awayGames, 10);
  const homeRestDays = daysRestBefore(gameDateISO, homeGames);
  const awayRestDays = daysRestBefore(gameDateISO, awayGames);
  const homeB2B = isBackToBack(gameDateISO, homeGames);
  const awayB2B = isBackToBack(gameDateISO, awayGames);

  const P = computeGameProbabilities({
    homeSummary,
    awaySummary,
    homeRestDays,
    awayRestDays,
    homeB2B,
    awayB2B,
    neutralSite: false,
  });

  return {
    ...P,
    factors: explainFactors({ homeSummary, awaySummary, deltas: P.deltas }),
  };
}

function ProbabilityCard({ probs, homeCode, awayCode, verdict }) {
  if (!probs) return null;
  const pct = Math.round(probs.pHome * 100);

  return (
    <Card variant="outlined" sx={{ borderRadius:1, mt:2 }}>
      <CardContent sx={{ p:2 }}>
        {/* Header row: title on left, verdict chip on right */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="baseline" spacing={1}>
            <Typography variant="subtitle2" sx={{ fontWeight:700 }}>
              Model edge
            </Typography>
            <Typography variant="caption" sx={{ opacity:0.7 }}>
              (home win)
            </Typography>
            {probs?.mode && (
              <Typography variant="caption" sx={{ opacity:0.6, ml:1 }}>
                {probs.mode === 'recent' ? 'recent form' :
                probs.mode === 'prior'  ? 'prior model' :
                                          'data unavailable'}
              </Typography>
            )}
          </Stack>

          {/* ✔ / ✖ only if we have a verdict */}
          {verdict && (
            verdict.state === 'correct' ? (
              <Tooltip title={verdict.tooltip}>
                <Chip
                  size="small"
                  color="success"
                  variant="outlined"
                  icon={<CheckCircleIcon fontSize="small" />}
                  label="Correct"
                />
              </Tooltip>
            ) : (
              <Tooltip title={verdict.tooltip}>
                <Chip
                  size="small"
                  color="error"
                  variant="outlined"
                  icon={<CancelIcon fontSize="small" />}
                  label="Wrong"
                />
              </Tooltip>
            )
          )}
        </Stack>

        {typeof probs?.confidence === 'number' && (
          <Chip
            size="small"
            variant="outlined"
            sx={{ ml: 1 }}
            label={`Confidence ${Math.round(probs.confidence*100)}%${probs?.gamesUsed ? ` · H${probs.gamesUsed.recentHome}/A${probs.gamesUsed.recentAway}` : ''}`}
          />
        )}

        <Stack direction="row" alignItems="center" spacing={1} sx={{ mt:1 }}>
          <Typography variant="h5" sx={{ fontWeight:800 }}>
            {pct}%
          </Typography>
          <Typography variant="body2" sx={{ opacity:0.75 }}>
            {homeCode} vs {awayCode}
          </Typography>
        </Stack>

        <Box sx={{ mt:1.25, height:8, bgcolor:'action.hover', borderRadius:1, overflow:'hidden' }}>
          <Box sx={{ width: `${pct}%`, height:'100%', bgcolor:'primary.main' }} />
        </Box>

        {probs.provenance && (
          <Typography variant="caption" sx={{ display:'block', opacity:0.75, mt:1 }}>
            {probs.provenance}
          </Typography>
        )}

        <List dense sx={{ mt:1 }}>
          {probs.factors.map((f, i) => (
            <ListItem key={i} disableGutters sx={{ py:0.25 }}>
              <ListItemText
                primaryTypographyProps={{ variant:'body2' }}
                primary={`${f.label}: ${f.value}`}
              />
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
}

// --- DROP-IN: single player stat "pill" ---
function PlayerPill({ avg, accent = 'primary.main' }) {
  const name = displayName(avg.player, avg.player_id);
  const iv = initials(avg?.player?.first_name, avg?.player?.last_name);

  return (
    <Chip
      avatar={
        <Avatar
          sx={{
            width: 22,
            height: 22,
            fontSize: 12,
            bgcolor: (t) => t.palette.action.hover,
            color: (t) => t.palette.text.primary,
            border: '2px solid',
            borderColor: accent,
          }}
        >
          {iv}
        </Avatar>
      }
      label={
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: 1,
            justifyContent: 'flex-start', // ⬅️ left-align the contents
            textAlign: 'left',            // ⬅️ ensure text itself is left-aligned
            width: '100%',                // ⬅️ stretch so justifyContent works
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1 }}>
            {name}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              opacity: 0.9,
              lineHeight: 1,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            {nf1(avg.pts)} PTS · {nf1(avg.reb)} REB · {nf1(avg.ast)} AST
          </Typography>
        </Box>
      }
      sx={{
        borderRadius: 999,
        px: 0.5,
        py: 0.25,
        bgcolor: (t) => t.palette.action.selected,
        '& .MuiChip-label': {
          py: 0.5,
          width: '100%', // ⬅️ let label fill full width of pill
        },
      }}
      variant="filled"
    />
  );
}

// Fetch a single game by balldontlie game id
async function fetchGameByIdBDL(gameId) {
  if (!gameId) throw new Error("Missing game id");
  const u = `https://api.balldontlie.io/v1/games/${gameId}`;
  const r = await fetch(u, { headers: bdlHeaders() });
  if (r.status === 401) throw new Error("BDL 401 (missing/invalid API key). Add REACT_APP_BDL_API_KEY in .env.local and restart.");
  if (!r.ok) throw new Error(`BDL HTTP ${r.status}`);
  const j = await r.json();
  const g = j || {};
  return {
    id: g.id,
    status: g.status || "",
    homeCode: (g.home_team?.abbreviation || "").toUpperCase(),
    awayCode: (g.visitor_team?.abbreviation || "").toUpperCase(),
    homeScore: Number.isFinite(g.home_team_score) ? g.home_team_score : null,
    awayScore: Number.isFinite(g.visitor_team_score) ? g.visitor_team_score : null,
    period: Number.isFinite(g.period) ? g.period : null,
    time: g.time || "", // sometimes empty; we’ll guard
  };
}


/* ========= Drawer ========= */
function ComparisonDrawer({ open, onClose, game }) {
  const [a, setA] = useState({ loading: true, error: null, data: null }); // away recent form
  const [b, setB] = useState({ loading: true, error: null, data: null }); // home recent form
  const [probs, setProbs] = useState(null);
  const [live, setLive] = useState(null);
  const gameAnchorISO = (game?._iso || "").slice(0,10) || (game?.dateKey || toISODateOnly(new Date()));
  const isInPast = new Date(gameAnchorISO) < new Date(toISODateOnly(new Date()));

  // head-to-head
  const [h2h, setH2h] = useState({ loading: true, error: null, data: null });

  // mini-averages (rolling recent; fallback to season if blocked)
  const [mini, setMini] = useState({ loading: true, error: null, data: null }); // { away:[], home:[] }
  const [miniMode, setMiniMode] = useState("recent"); // "recent" | "season-fallback"
  const [avgSeason, setAvgSeason] = useState(2025);   // used when season-fallback is in play

// ------------------ Recent form (last-10 inside recent window) with season fallback ------------------
useEffect(() => {
  if (!open || !game?.home?.code || !game?.away?.code) return;
  let cancelled = false;

  (async () => {
    try {
      setA({ loading: true, error: null, data: null });
      setB({ loading: true, error: null, data: null });

      // Always pull the last 10 from THIS season up to the selected date
      let [Ares, Bres] = await Promise.all([
        fetchTeamLast10UpToBDL(game.away.code, gameAnchorISO),
        fetchTeamLast10UpToBDL(game.home.code, gameAnchorISO),
      ]);

      // If BOTH sides have zero, show a friendly message (no previous-season fallback)
      const bothEmpty = !(Ares?.games?.length) && !(Bres?.games?.length);
      if (bothEmpty) {
        if (cancelled) return;
        const msg = `No games this season as of ${gameAnchorISO}.`;
        setA({ loading: false, error: msg, data: { team: game?.away?.code, games: [] } });
        setB({ loading: false, error: msg, data: { team: game?.home?.code, games: [] } });
        return;
      }

      if (cancelled) return;
      setA({ loading: false, error: null, data: Ares });
      setB({ loading: false, error: null, data: Bres });
    } catch (e) {
      if (cancelled) return;
      const msg = e?.message || String(e);
      setA({ loading: false, error: msg, data: { team: game?.away?.code, games: [] } });
      setB({ loading: false, error: msg, data: { team: game?.home?.code, games: [] } });
    }
  })();

  return () => { cancelled = true; };
}, [open, game?.home?.code, game?.away?.code, gameAnchorISO]);

  // ------------------ Head-to-head (this season) ------------------
  useEffect(() => {
    if (!open || !game?.home?.code || !game?.away?.code) return;
    let cancelled = false;
    (async () => {
      try {
        setH2h({ loading: true, error: null, data: null });
        const { start, end } = seasonWindowUpTo(gameAnchorISO);
        const { aWins, bWins } = await fetchHeadToHeadBDL(game.home.code, game.away.code, { start, end });
        if (cancelled) return;
        setH2h({ loading: false, error: null, data: { aWins, bWins } });
      } catch (e) {
        if (cancelled) return;
        setH2h({ loading: false, error: e?.message || String(e), data: null });
      }
    })();
    return () => { cancelled = true; };
  }, [open, game?.home?.code, game?.away?.code, gameAnchorISO]);

// ------------------ Rolling recent player averages (fallback to season) ------------------
useEffect(() => {
  if (!open || !game?.home?.code || !game?.away?.code) return;
  let cancelled = false;

  (async () => {
    try {
      setMini({ loading: true, error: null, data: null });
      setMiniMode("recent");

      // First try the recent window via /v1/stats anchored to the game date
      let awayRecent, homeRecent;
      try {
        [awayRecent, homeRecent] = await Promise.all([
          fetchRecentPlayerAveragesBDL(game.away.code, { days: 21, anchorISO: gameAnchorISO }),
          fetchRecentPlayerAveragesBDL(game.home.code, { days: 21, anchorISO: gameAnchorISO }),
        ]);
      } catch (tierErr) {
        // Likely API key/tier limits -> fall back to season averages via your proxy
        setMiniMode("season-fallback");

        // 1) Rosters (get BDL IDs from here)
        const [awayRoster, homeRoster] = await Promise.all([
          fetchTeamRosterByTeamIdBDL(game.away.code),
          fetchTeamRosterByTeamIdBDL(game.home.code),
        ]);
        if (cancelled) return;

        const normIds = (arr) =>
          Array.from(new Set((arr || [])
            .map(p => Number(p?.id))
            .filter(n => Number.isInteger(n) && n > 0)))
            .slice(0, 30);

        const awayIds = normIds(awayRoster);
        const homeIds = normIds(homeRoster);

        // Proxy call for season_averages (unchanged from your version)
        const callAvg = async (ids, season) => {
          if (!ids.length) return [];
          const qs = new URLSearchParams({ season: String(season) });
          ids.forEach(id => qs.append("player_id", String(id)));
          const base = (typeof API_BASE === "string" && API_BASE) ? API_BASE : "";
          const url = `${base}/api/bdl/season-averages?${qs.toString()}`;

          const res = await fetch(url, { cache: "no-store" });
          const ct = (res.headers.get("content-type") || "").toLowerCase();
          const txt = await res.text();
          if (!ct.includes("application/json")) {
            throw new Error(`Non-JSON from ${url}: ${txt.slice(0,200).replace(/\s+/g," ").trim()}`);
          }
          const body = JSON.parse(txt);
          if (body?.error === "bdl_error") throw new Error(`BDL ${body.status}: ${JSON.stringify(body.body)}`);
          if (body?.error) throw new Error(body.error);
          return Array.isArray(body?.data) ? body.data : [];
        };

        function currentSeasonEndYear(d = new Date()) {
          // NBA seasons run Oct–Jun; "season" is named by the END year
          const y = d.getFullYear();
          const m = d.getMonth(); // 0=Jan ... 9=Oct
          return (m >= 9) ? y + 1 : y; // Oct (9) or later -> next calendar year
        }
        const thisSeason = currentSeasonEndYear();

        let [awayAvgs, homeAvgs] = await Promise.all([
          callAvg(awayIds, thisSeason),
          callAvg(homeIds, thisSeason),
        ]);
        let usedSeason = thisSeason;

        if ((!awayAvgs?.length) && (!homeAvgs?.length)) {
          const prev = thisSeason - 1;
          [awayAvgs, homeAvgs] = await Promise.all([
            callAvg(awayIds, prev),
            callAvg(homeIds, prev),
          ]);
          usedSeason = prev;
        }
        if (cancelled) return;

        setAvgSeason(usedSeason);

        // Attach names
        const aMap = new Map(awayRoster.map(p => [p.id, p]));
        const hMap = new Map(homeRoster.map(p => [p.id, p]));
        awayAvgs.forEach(x => (x.player = aMap.get(x.player_id)));
        homeAvgs.forEach(x => (x.player = hMap.get(x.player_id)));

        // Top 3 by minutes, fallback by points
        const minToNum = (m) => {
          if (!m || typeof m !== "string") return 0;
          const [mm, ss] = m.split(":").map(Number);
          return (isFinite(mm) ? mm : 0) + (isFinite(ss) ? ss/60 : 0);
        };
        const pickTop = (arr) => {
          const copy = [...arr];
          copy.sort((x, y) => {
            const ym = minToNum(y.min), xm = minToNum(x.min);
            if (ym !== xm) return ym - xm;
            return (y.pts || 0) - (x.pts || 0);
          });
          return copy.slice(0, 3);
        };

        setMini({
          loading: false,
          error: "Recent player stats unavailable (need GOAT tier or valid API key). Showing season averages.",
          data: { away: pickTop(awayAvgs), home: pickTop(homeAvgs) }
        });
        return; // done via fallback path
      }

      // If recent stats succeeded, take top 3 by recent minutes (already averaged)
      const pickTopRecent = (pack) => (pack?.players || []).slice(0, 3);
      if (cancelled) return;
      setMini({
        loading: false,
        error: null,
        data: {
          away: pickTopRecent(awayRecent),
          home: pickTopRecent(homeRecent),
        }
      });
      // For the accordion label; not used when in "recent" mode but harmless
      setAvgSeason(new Date().getFullYear());
    } catch (e) {
      if (cancelled) return;
      setMini({ loading: false, error: e?.message || String(e), data: null });
    }
  })();

  return () => { cancelled = true; };
}, [open, game?.home?.code, game?.away?.code, gameAnchorISO]);

  // ------------------ Build probabilities (async; recent -> prior fallback) ------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!open) return;
      if (a.loading || b.loading) return;
      if (a.error || b.error) { setProbs(null); return; }
      const built = await buildProbsForGameAsync({ game, awayData: a.data, homeData: b.data });
      if (!cancelled) setProbs(built);
    })();
    return () => { cancelled = true; };
  }, [open, a.loading, b.loading, a.error, b.error, a.data, b.data, game]);

  // ------------------ Live polling (BDL game-by-id) ------------------
  useEffect(() => {
    if (!open || !game?.id) return;
    if (isInPast) return; // do not poll historic games

    let stop = false;
    let timer = null;

    const load = async () => {
      try {
        const g = await fetchGameByIdBDL(game.id);
        if (stop) return;

        setLive({
          status: g.status,               // "In Progress", "Final", "Halftime"
          homeCode: g.homeCode,
          awayCode: g.awayCode,
          homeScore: g.homeScore,
          awayScore: g.awayScore,
          period: g.period,
          time: g.time,                   // "08:12" or ""
          isFinal: /final/i.test(g.status || ""),
          isLive: /in progress|end of|halftime|quarter|q\d/i.test(g.status || ""),
        });

        if (/final/i.test(g.status || "")) return;         // stop when final
        timer = setTimeout(load, 15000);                   // poll again
      } catch {
        if (!stop) timer = setTimeout(load, 20000);        // gentle backoff
      }
    };

    load();
    return () => { stop = true; if (timer) clearTimeout(timer); };
  }, [open, game?.id, isInPast]);

  // ✔/✖ verdict chip (only when Final)
  const verdict = verdictFromProbs(game, probs);

  // Small label to reflect data mode in the Top Players accordion
  const miniModeLabel = miniMode === "recent" ? "last 21 days" : "season averages (fallback)";

  // ⬇️ put this inside ComparisonDrawer, anywhere before the `return ( ... )`
  function NarrativeBlock({ game, probs, a, b, h2h }) {
    if (!game) return null;

    const status = String(game?.status || "");
    const isFinal = /final/i.test(status);
    const isLive  = /in progress|end of|halftime|quarter|q\d/i.test(status);

    const home = game?.home?.code || "HOME";
    const away = game?.away?.code || "AWAY";

    const last10Home = b?.data?.games || [];
    const last10Away = a?.data?.games || [];

    const wlt = (arr) => {
      let w=0,l=0,t=0; arr.forEach(g => (g.result==='W'?w++:g.result==='L'?l++:t++));
      return `${w}-${l}${t?`-${t}`:''}`;
    };

    // --- SAFE date formatting (no throws)
    const safeWhen = (() => {
      // Prefer _iso if present & valid
      const dtISO = game?._iso ? new Date(game._iso) : null;
      const dtKey = game?.dateKey ? new Date(`${game.dateKey}T12:00:00Z`) : null;
      const dt    = (dtISO && !Number.isNaN(+dtISO)) ? dtISO :
                    (dtKey && !Number.isNaN(+dtKey)) ? dtKey : null;

      if (!dt) return "TBD";
      try {
        return game?.hasClock
          ? new Intl.DateTimeFormat(undefined, { dateStyle:"medium", timeStyle:"short" }).format(dt)
          : new Intl.DateTimeFormat(undefined, { dateStyle:"medium" }).format(dt);
      } catch {
        return "TBD";
      }
    })();

    const h2hLine = h2h?.data
      ? `This season, ${home} lead the series ${h2h.data.aWins}-${h2h.data.bWins}.`
      : "";

    const modelLine = (() => {
      const p = Number(probs?.pHome);
      if (!Number.isFinite(p)) return "";
      const pct  = Math.round(p * 100);
      const mode = probs?.mode === "recent" ? "recent form"
                : probs?.mode === "prior"  ? "a prior model"
                : "available data";
      return `Our model, based on ${mode}, gives ${home} a ${pct}% chance at home.`;
    })();

    const finalLine = (() => {
      if (!isFinal) return "";
      const hs = Number(game?.homeScore ?? NaN);
      const as = Number(game?.awayScore ?? NaN);
      if (!Number.isFinite(hs) || !Number.isFinite(as)) return `${home} vs ${away} — Final.`;
      const winner = hs > as ? home : away;
      return `${winner} won ${Math.max(hs,as)}–${Math.min(hs,as)}.`;
    })();

    const liveLine = isLive
      ? `${home} ${game?.homeScore ?? "–"} – ${away} ${game?.awayScore ?? "–"} (${status})`
      : "";

    const previewLine = (!isFinal && !isLive)
      ? `${away} visit ${home} on ${safeWhen}. Recent form: ${home} ${wlt(last10Home)}, ${away} ${wlt(last10Away)}.`
      : "";

    const whyLine = (() => {
      const f = probs?.factors;
      if (!Array.isArray(f) || f.length === 0) return "";
      const top = f.slice(0,3).map(x => String(x?.label || "").toLowerCase()).filter(Boolean).join(", ");
      return top ? `Key factors: ${top}.` : "";
    })();

    // If everything ends up empty, still render a small placeholder line.
    const bodyTop = isFinal ? finalLine : (isLive ? liveLine : previewLine);
    const hasAny = bodyTop || modelLine || h2hLine || whyLine;

    return (
      <Card variant="outlined" sx={{ borderRadius:1, mt:1.5 }}>
        <CardContent sx={{ p:2 }}>
          <Typography component="h2" variant="subtitle1" sx={{ fontWeight:700, mb:0.5 }}>
            {isFinal ? "Game recap" : isLive ? "Live update" : "Game preview"}
          </Typography>

          <Typography variant="body2" sx={{ mb:0.75 }}>
            {bodyTop || `${away} at ${home}.`}
          </Typography>

          {modelLine && (
            <Typography variant="body2" sx={{ mb:0.5 }}>{modelLine}</Typography>
          )}
          {h2hLine && (
            <Typography variant="body2" sx={{ mb:0.5 }}>{h2hLine}</Typography>
          )}
          {whyLine && (
            <Typography variant="body2">{whyLine}</Typography>
          )}

          {!hasAny && (
            <Typography variant="body2" sx={{ opacity:0.7 }}>
              Preview will appear once data loads.
            </Typography>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 620 },
          p: 2,
          borderTopLeftRadius: { xs: 1, sm: 0 },
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          boxSizing: 'border-box',
        },
      }}
    >
      {/* header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Recent form — {game?.away?.code} @ {game?.home?.code}
        </Typography>

        <Stack direction="row" spacing={1} alignItems="center">
          {verdict && (
            verdict.state === 'correct' ? (
              <Tooltip title={verdict.tooltip}>
                <Chip size="small" color="success" variant="outlined"
                      icon={<CheckCircleIcon fontSize="small" />} label="Correct" />
              </Tooltip>
            ) : (
              <Tooltip title={verdict.tooltip}>
                <Chip size="small" color="error" variant="outlined"
                      icon={<CancelIcon fontSize="small" />} label="Wrong" />
              </Tooltip>
            )
          )}
          <IconButton onClick={onClose}><CloseIcon /></IconButton>
        </Stack>
      </Stack>

      {/* after the Last10 lists and before ProbabilityCard */}
      <NarrativeBlock game={game} probs={probs} a={a} b={b} h2h={h2h} />

      {/* scrollable middle */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', pr: 0.5 }}>
        <Typography variant="caption" sx={{ opacity: 0.8, mb: 1, display: 'block' }}>
          Clicked game: {game?.away?.name} at {game?.home?.name}
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Last10List
            title={`${game?.away?.code} (${game?.away?.name})`}
            loading={a.loading}
            error={a.error}
            data={a.data}
          />
          <Last10List
            title={`${game?.home?.code} (${game?.home?.name})`}
            loading={b.loading}
            error={b.error}
            data={b.data}
          />
        </Stack>

        {/* recent window anchor caption */}
        <Typography variant="caption" sx={{ opacity: 0.65, mt: 0.25, display:'block' }}>
          Showing last 10 this season up to {gameAnchorISO}
        </Typography>

        <ProbabilityCard
          probs={probs}
          homeCode={game?.home?.code}
          awayCode={game?.away?.code}
          verdict={verdict}
        />

        {/* --- Head-to-head (this season) --- */}
        {h2h.loading ? (
          <Typography variant="caption" sx={{ opacity:0.7, mt:1, display:'block' }}>
            Loading season series…
          </Typography>
        ) : h2h.error ? (
          <Typography variant="caption" color="warning.main" sx={{ mt:1, display:'block' }}>
            H2H error: {h2h.error}
          </Typography>
        ) : h2h.data ? (
          <Typography variant="body2" sx={{ mt:1 }}>
            Season series: <strong>{game?.home?.code} {h2h.data.aWins}–{h2h.data.bWins} {game?.away?.code}</strong>
          </Typography>
        ) : null}

        {/* --- Top players (rolling or fallback) --- */}
        <Accordion sx={{ mt:1.5 }} disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" sx={{ fontWeight:700 }}>
              Top players
            </Typography>
            <Typography variant="caption" sx={{ ml:1, opacity:0.7 }}>
              {miniModeLabel}{miniMode === "season-fallback" ? ` ’${String(avgSeason).slice(2)}` : ""}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            {mini.loading ? (
              <Stack alignItems="center" sx={{ py:1 }}>
                <CircularProgress size={18} />
              </Stack>
            ) : mini.error ? (
              <Typography variant="caption" color="warning.main">
                {mini.error}
              </Typography>
            ) : mini.data ? (
              <Stack spacing={1.25}>
                {/* Away group */}
                {(() => {
                  const accent = (t) => t.palette.info.main; // away color
                  return (
                    <Stack direction="row" alignItems="flex-start" spacing={1}>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={game?.away?.code}
                        sx={{
                          minWidth: 56,
                          justifyContent: 'center',
                          borderColor: accent,
                          color: accent,
                        }}
                      />
                      <Box
                        sx={{
                          flex: 1,
                          pl: 1.5,
                          mt: 0.25,
                          borderLeft: '3px solid',
                          borderColor: accent,
                        }}
                      >
                        <Stack direction="column" spacing={1} sx={{ '& > *': { maxWidth: '100%' } }}>
                          {mini.data.away.map((p) => (
                            <PlayerPill key={`a-${p.player_id}`} avg={p} accent={accent} />
                          ))}
                        </Stack>
                      </Box>
                    </Stack>
                  );
                })()}

                {/* Home group */}
                {(() => {
                  const accent = (t) => t.palette.success.main; // home color
                  return (
                    <Stack direction="row" alignItems="flex-start" spacing={1}>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={game?.home?.code}
                        sx={{
                          minWidth: 56,
                          justifyContent: 'center',
                          borderColor: accent,
                          color: accent,
                        }}
                      />
                      <Box
                        sx={{
                          flex: 1,
                          pl: 1.5,
                          mt: 0.25,
                          borderLeft: '3px solid',
                          borderColor: accent,
                        }}
                      >
                        <Stack direction="column" spacing={1} sx={{ '& > *': { maxWidth: '100%' } }}>
                          {mini.data.home.map((p) => (
                            <PlayerPill key={`h-${p.player_id}`} avg={p} accent={accent} />
                          ))}
                        </Stack>
                      </Box>
                    </Stack>
                  );
                })()}
              </Stack>
            ) : null}
          </AccordionDetails>
        </Accordion>
      </Box>

      {/* sticky footer */}
      <Box
        sx={{
          position: 'sticky',
          bottom: 0,
          pt: 1.5,
          background: (t) => `linear-gradient(180deg, ${t.palette.background.default}00, ${t.palette.background.default} 40%)`,
        }}
      >
        <Tooltip title="Close">
          <Button variant="contained" onClick={onClose} fullWidth>Close</Button>
        </Tooltip>
      </Box>
    </Drawer>
  );
}


// --- Replace the whole resultMeta with this version ---
function isFinal(game){
  return (game?.status || "").toLowerCase().includes("final");
}

function resultMeta(game){
  if (!isFinal(game)) return null;

  const home = game.home?.code || "HOME";
  const away = game.away?.code || "AWAY";
  const hs = Number(game.homeScore ?? 0);
  const as = Number(game.awayScore ?? 0);

  const homeWon = hs > as;
  const winnerTeam = homeWon ? home : away;
  const loserTeam  = homeWon ? away : home;
  const winnerPts  = homeWon ? hs   : as;
  const loserPts   = homeWon ? as   : hs;

  // Keep a single-line label around for any legacy callers
  const label = `${away} ${as} – ${home} ${hs}`;

  // New: stacked lines, winner first
  const lines = [
    `${winnerTeam} ${winnerPts}`,
    `${loserTeam} ${loserPts}`,
  ];

  return { label, lines, winner: winnerTeam, homeWon };
}

/* ========= Mobile UI bits ========= */

/* WeekDay-pill in the horizontal strip */
function DayPill({ d, selected, count, onClick }) {
  const dow = d.toLocaleDateString(undefined,{ weekday:'short' });
  const day = d.getDate();
  const isToday = dateKeyFromDate(new Date()) === dateKeyFromDate(d);

  return (
    <Button
      onClick={onClick}
      variant={selected ? "contained" : "outlined"}
      size="large"
      aria-label={`${dow} ${day}, ${count || 0} games`}
      sx={{
        borderRadius: 1,
        minWidth: 96,
        height: 88,
        px: 1.25,
        py: 0.75,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: selected ? 'primary.main' : 'background.paper',
        color: selected ? 'primary.contrastText' : 'text.primary',
        borderColor: selected ? 'primary.main' : 'divider',
        boxShadow: selected ? 2 : 0,
        transition: 'transform 80ms ease, box-shadow 120ms ease',
        '&:hover': { transform: 'translateY(-1px)' },
        '&:active': { transform: 'translateY(0px)' }
      }}
    >
      <Typography variant="caption" sx={{ opacity: 0.85, lineHeight: 1 }}>
        {dow}{isToday && !selected ? ' •' : ''}
      </Typography>

      <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1, mt: 0.25 }}>
        {String(day).padStart(2,'0')}
      </Typography>

      <Chip
        size="small"
        label={count ? `${count} game${count>1?'s':''}` : '0'}
        color={count ? 'secondary' : 'default'}
        variant={selected ? 'filled' : 'outlined'}
        sx={{
          mt: 0.9,
          height: 20,
          borderRadius: 0.75,
          '& .MuiChip-label': { px: 0.8, fontSize: 11, fontWeight: 700 }
        }}
      />
    </Button>
  );
}

/* Game card in the agenda list */
function GameCard({ game, onPick }) {
  const vsLabel = `${game.away.code} @ ${game.home.code}`;
  const sub = `${game.away.name} at ${game.home.name}`;
  const final = resultMeta(game);
  const isLive = /in progress|halftime|end of|quarter|q\d/i.test(
    (game?.status || "").toLowerCase()
  );

  // Short status helper for live games (keeps chips compact)
  const liveStatusLabel = (() => {
    const s = String(game?.status || "");
    // Common trims like "End of 3rd Qtr" -> "End Q3"
    const m = s.match(/end of\s*(\d)/i);
    if (m) return `End Q${m[1]}`;
    return s; // "In Progress", "Halftime", etc.
  })();

  return (
    <Card variant="outlined" sx={{ borderRadius: 1 }}>
      <ListItemButton
        onClick={onPick}
        sx={{
          borderRadius: 1,
          "&:hover": { bgcolor: "rgba(25,118,210,0.06)" },
        }}
      >
        <Stack
          direction="row"
          alignItems="flex-start" // let text take 2 lines if needed
          spacing={1}
          sx={{ width: "100%" }}
        >
          <Avatar
            sx={{
              width: 30,
              height: 30,
              fontSize: 12,
              bgcolor: "primary.main",
              color: "primary.contrastText",
            }}
          >
            {game.home.code}
          </Avatar>

          {/* TEXT COLUMN */}
          <Box sx={{ flex: "1 1 auto", minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                wordBreak: "break-word",
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 1, // title stays to 1 line
                WebkitBoxOrient: "vertical",
              }}
            >
              {final ? (
                <>
                  <span style={{ fontWeight: final.homeWon ? 800 : 600 }}>
                    {game.home.code}
                  </span>
                  {" vs "}
                  <span style={{ fontWeight: !final.homeWon ? 800 : 600 }}>
                    {game.away.code}
                  </span>
                </>
              ) : (
                vsLabel
              )}
            </Typography>

            <Typography
              variant="caption"
              sx={{
                opacity: 0.8,
                wordBreak: "break-word",
                whiteSpace: "normal", // allow wrapping
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2, // clamp to 2 lines on mobile
                WebkitBoxOrient: "vertical",
              }}
            >
              {sub}
            </Typography>
          </Box>

          {/* RIGHT CHIP(S) – don't let these shrink */}
          {final ? (
            <Stack
              direction="row"
              spacing={1}
              sx={{ flexShrink: 0, alignItems: "flex-start" }}
            >
              {/* Final status */}
              <Chip size="small" color="success" label="Final" />

              {/* Stacked score */}
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  lineHeight: 1.15,
                }}
                aria-label="Final score"
              >
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {final.lines[0]}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  {final.lines[1]}
                </Typography>
              </Box>

              {/* Model verdict near the right edge */}
              {(() => {
                const verdict = modelVerdict(game);
                if (!verdict) return null;

                return verdict.state === "correct" ? (
                  <Tooltip title={verdict.tooltip}>
                    <Chip
                      size="small"
                      color="success"
                      variant="outlined"
                      icon={<CheckCircleIcon fontSize="small" />}
                      label="Model"
                      sx={{ ml: 0.5 }}
                    />
                  </Tooltip>
                ) : (
                  <Tooltip title={verdict.tooltip}>
                    <Chip
                      size="small"
                      color="error"
                      variant="outlined"
                      icon={<CancelIcon fontSize="small" />}
                      label="Model"
                      sx={{ ml: 0.5 }}
                    />
                  </Tooltip>
                );
              })()}
            </Stack>
          ) : isLive ? (
            // LIVE: show live badge + current score; keep compact
            <Stack
              direction="row"
              spacing={1}
              sx={{ flexShrink: 0, alignItems: "center" }}
            >
              <Chip size="small" color="warning" label="Live" />
              <Chip
                size="small"
                variant="outlined"
                label={`${game.home.code} ${
                  game.homeScore ?? "–"
                } — ${game.away.code} ${game.awayScore ?? "–"}`}
              />
              <Chip size="small" variant="outlined" label={liveStatusLabel} />
            </Stack>
          ) : (
            // SCHEDULED: show ET if clock exists, otherwise a date label
            <Chip
              size="small"
              variant="outlined"
              sx={{ flexShrink: 0, maxWidth: "50vw", alignSelf: "center" }}
              label={
                game?.hasClock
                  ? formatGameLabel(game._iso, { mode: "ET", withTZ: true })
                  : new Intl.DateTimeFormat(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    }).format(new Date(`${game.dateKey}T12:00:00Z`))
              }
            />
          )}
        </Stack>
      </ListItemButton>
    </Card>
  );
}

/* ========= Main Mobile Calendar (uses balldontlie per-month) ========= */
export default function AllGamesCalendar(){
  const [allGames,setAllGames]=useState([]);
  const [viewMonth,setViewMonth]=useState(firstOfMonth(new Date()));
  const [selectedDate,setSelectedDate]=useState(new Date());
  const [loadErr,setLoadErr]=useState(null);
  const [loading,setLoading]=useState(true);

  // comparison drawer state
  const [compareGame,setCompareGame]=useState(null);
  const [compareOpen,setCompareOpen]=useState(false);

  // cache of fetched months so we don’t refetch on every click
  const [monthCache, setMonthCache] = useState(new Map()); // key: "YYYY-MM" -> rows[]

  // load schedule for the visible month (from balldontlie), cache per month
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const y = viewMonth.getFullYear();
        const mIdx = viewMonth.getMonth();
        const m = String(mIdx + 1).padStart(2, '0');
        const monthKey = `${y}-${m}`;

        if (monthCache.has(monthKey)) {
          if (!cancelled) {
            setAllGames(monthCache.get(monthKey));
            setLoadErr(null);
            setLoading(false);
          }
          return;
        }

        let rows = await fetchMonthScheduleBDL(y, mIdx);
        try {
          rows = await attachPredictionsForMonth(rows);
          console.log('[predictions]', {
            monthKey,
            rowsWithModel: rows.filter(r => r.model && (r.model.predictedWinner || Number.isFinite(r.model.pHome))).length
          });          
        } catch { /* non-fatal if predictions service is down */ }
        if (cancelled) return;

        const next = new Map(monthCache);
        next.set(monthKey, rows);
        setMonthCache(next);
        setAllGames(rows);
        setLoadErr(null);

      } catch (e) {
        if (!cancelled){
          setLoadErr(e?.message || String(e));
          setAllGames([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return ()=>{ cancelled=true; };
  }, [viewMonth, monthCache]);

    // Group a month's rows by YYYY-MM-DD and sort within each day
    function bucketByDayAll(games){
    const m = new Map();
    for (const g of games || []) {
        const k = g?.dateKey;
        if (!k) continue;
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(g);
    }
    // stable sort within a day by ISO (time if present), then by home name
    for (const arr of m.values()) {
        arr.sort((a,b)=>
        String(a._iso||"").localeCompare(String(b._iso||"")) ||
        String(a.home?.name||"").localeCompare(String(b.home?.name||""))
        );
    }
    return m;
    }

  // month days & events (from the currently loaded month's rows)
  const monthDays = useMemo(()=> daysInMonth(viewMonth.getFullYear(), viewMonth.getMonth()), [viewMonth]);
  const eventsMap = useMemo(()=>{
    const y = viewMonth.getFullYear();
    const m = String(viewMonth.getMonth()+1).padStart(2,'0');
    const monthKey = `${y}-${m}`;
    const monthGames = allGames.filter(g => (g.dateKey||'').startsWith(monthKey));
    return bucketByDayAll(monthGames);
  }, [allGames, viewMonth]);

  const selectedKey = dateKeyFromDate(selectedDate);
  const selectedGames = eventsMap.get(selectedKey) || [];

  const stripRef = useRef(null);
  useEffect(()=>{ // auto-scroll strip to selected day
    const idx = monthDays.findIndex(d => dateKeyFromDate(d)===selectedKey);
    if (idx>=0 && stripRef.current) {
      const el = stripRef.current.querySelector(`[data-idx="${idx}"]`);
      if (el) el.scrollIntoView({ inline:'center', behavior:'smooth', block:'nearest' });
    }
  }, [selectedKey, monthDays]);

  const headerMonth = viewMonth.toLocaleDateString(undefined,{ month:'long', year:'numeric' });

  function openCompare(game){ setCompareGame(game); setCompareOpen(true); }

  return (
        <Box
        sx={{
            mx:'auto',
            width:'100%',
            maxWidth: 520,
            px: { xs: 1, sm: 1.5 },   // 8px left/right on mobile, 12px on sm+
            py: 1.5
        }}
        >
      {/* top header (sticky) */}
      <Box sx={{ position:'sticky', top:0, zIndex:(t)=>t.zIndex.appBar, bgcolor:'background.default', pt:1, pb:1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px:1.5 }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth:0 }}>
            <Box sx={{ lineHeight: 1 }}>
            <Typography
                variant="h6"
                sx={{
                fontFamily: '"Bebas Neue", sans-serif',
                fontSize: { xs: 26, sm: 32 },
                letterSpacing: 1,
                fontWeight: 400
                }}
            >
                
            </Typography>
            <Typography
                variant="caption"
                sx={{
                opacity: 0.75,
                display: 'block',
                mt: -0.25,
                maxWidth: 280,          // tweak as you like
                whiteSpace: 'normal',   // allow wrapping
                wordBreak: 'break-word' // break long words if needed
                }}
            >
                NBA <SportsBasketballIcon fontSize="small" sx={{ verticalAlign: "middle" }} />
            </Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ opacity:0.2 }} />

            <Stack direction="row" spacing={1} alignItems="center">
              <CalendarMonthIcon fontSize="small" />
              <Typography variant="subtitle1" sx={{ fontWeight:700 }} noWrap>
                {headerMonth}
              </Typography>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0, alignSelf: 'center' }}>
            <IconButton size="small" onClick={()=>{ const n=addMonths(viewMonth,-1); setViewMonth(n); setSelectedDate(n); }}>
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={()=>{ const n=addMonths(viewMonth, 1); setViewMonth(n); setSelectedDate(n); }}>
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
      </Box>

      {/* horizontal day strip */}
      <Box
        ref={stripRef}
        sx={{
          display:'flex', gap:1, overflowX:'auto', pb:1,
          "&::-webkit-scrollbar": { display:'none' }
        }}
      >
        {monthDays.map((d, idx)=>{
          const key = dateKeyFromDate(d);
          const count = (eventsMap.get(key) || []).length;
          const selected = key===selectedKey;
          return (
            <Box key={key} data-idx={idx} sx={{ flex:'0 0 auto' }}>
              <DayPill
                d={d}
                selected={selected}
                count={count}
                onClick={()=> setSelectedDate(d)}
              />
            </Box>
          );
        })}
      </Box>

      {/* day agenda */}
      <Card variant="outlined" sx={{ borderRadius:1 }}>
        <CardContent sx={{ p:1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight:700, mb:1 }}>
            {selectedDate.toLocaleDateString(undefined,{ weekday:'long', month:'short', day:'numeric' })}
          </Typography>

          {loading ? (
            <Stack alignItems="center" sx={{ py:3 }}><CircularProgress size={22} /></Stack>
          ) : selectedGames.length ? (
            <Stack spacing={1}>
              {selectedGames.map((g, i)=>(
                <GameCard key={i} game={g} onPick={()=> openCompare(g)} />
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ opacity:0.7 }}>No games today.</Typography>
          )}

          {loadErr && (
            <Typography variant="caption" sx={{ color:'warning.main', mt:1, display:'block' }}>
              Load error: {loadErr}
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* comparison drawer */}
      <ComparisonDrawer open={compareOpen} onClose={()=> setCompareOpen(false)} game={compareGame} />
      {/* news below everything */}
      <NbaNews />        
    </Box>
  );
}
