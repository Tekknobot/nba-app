// src/utils/probability.js
// Lightweight, transparent probability model for NBA head-to-head bets
// Uses last-10 (balldontlie-shaped rows) + basic context (rest/B2B/home).

// ---------------- math helpers ----------------
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Exponential weights to emphasize most recent games (game 0 = most recent)
function expWeights(n = 10, decay = 0.85){
  const w = Array.from({length:n}, (_,i) => Math.pow(decay, i));
  const s = w.reduce((a,b)=>a+b,0);
  return w.map(x => x/s);
}

// Summarize a team's last N games from balldontlie-shaped rows
// expected shape per row: { date:"YYYY-MM-DD", opp, homeAway:"Home"|"Away", result:"W"|"L"|"T", score }
export function summarizeLastNGames(rows = [], n = 10){
  const games = rows.slice(0, n);
  const w = expWeights(games.length);

  let wins = 0, losses = 0, ties = 0;
  let marginSum = 0, marginAbsSum = 0;
  let ptsFor = 0, ptsAgainst = 0;
  let recentScore = 0; // weighted recent form (W=+1, L=-1)

  games.forEach((g, i) => {
    const m = parseScoreToMargin(g.score, g.homeAway);
    const isW = g.result === 'W';
    const isL = g.result === 'L';
    const isT = !(isW||isL);
    wins += isW; losses += isL; ties += isT;
    marginSum += m;
    marginAbsSum += Math.abs(m);
    // weighted recent form
    const val = isW ? 1 : (isL ? -1 : 0);
    recentScore += w[i] * val;
    // points for/against (best-effort parse)
    const pfpa = parseScoreForAgainst(g.score, g.homeAway);
    ptsFor += pfpa.for; ptsAgainst += pfpa.against;
  });

  const nPlayed = games.length;
  const winPct = nPlayed ? (wins + 0.5 * ties) / nPlayed : 0.5;
  const avgMargin = nPlayed ? marginSum / nPlayed : 0;
  const avgAbsMargin = nPlayed ? marginAbsSum / nPlayed : 0;
  const avgPtsFor = nPlayed ? ptsFor / nPlayed : 0;
  const avgPtsAgainst = nPlayed ? ptsAgainst / nPlayed : 0;

  return { nPlayed, wins, losses, ties, winPct, avgMargin, avgAbsMargin, avgPtsFor, avgPtsAgainst, recentScore };
}

function parseScoreToMargin(scoreStr = '', homeAway = 'Home'){
  // Expected like: "BOS 110 - NYK 105"; compute margin from the perspective of this team
  const m = scoreStr.match(/([A-Z]{2,3})\s+(\d+)\s*-\s*([A-Z]{2,3})\s+(\d+)/);
  if (!m) return 0;
  const homeTeamScore = parseInt(m[2],10);
  const awayTeamScore = parseInt(m[4],10);
  const isHome = homeAway === 'Home';
  const my = isHome ? homeTeamScore : awayTeamScore;
  const their = isHome ? awayTeamScore : homeTeamScore;
  return (my - their);
}

function parseScoreForAgainst(scoreStr = '', homeAway = 'Home'){
  const m = scoreStr.match(/([A-Z]{2,3})\s+(\d+)\s*-\s*([A-Z]{2,3})\s+(\d+)/);
  if (!m) return { for:0, against:0 };
  const homeTeamScore = parseInt(m[2],10);
  const awayTeamScore = parseInt(m[4],10);
  const isHome = homeAway === 'Home';
  return { for: isHome ? homeTeamScore : awayTeamScore, against: isHome ? awayTeamScore : homeTeamScore };
}

// Estimate rest heading into the specific matchup date
export function daysRestBefore(gameDateISO, prevGames = []){
  const gd = new Date(gameDateISO);
  const lastPlayed = prevGames
    .map(g => new Date(g.date))
    .filter(d => d < gd)
    .sort((a,b) => b - a)[0];
  if (!lastPlayed) return 3; // neutral-ish default
  const ms = gd - lastPlayed;
  return Math.max(0, Math.round(ms / (1000*60*60*24)));
}

export function isBackToBack(gameDateISO, prevGames = []){
  return daysRestBefore(gameDateISO, prevGames) <= 1; // 0 or 1 day rest
}

// Core model: Bradley–Terry style via logistic of a score difference
// Feature deltas are (HOME - AWAY)
const COEFFS = {
  intercept: 0.10,  // slight home-court baked in
  homeAdv: 0.20,    // extra home bump
  winPct: 1.40,     // last-10 win% diff
  margin: 0.06,     // avg margin per point
  recent: 0.90,     // exp-weighted recent W/L form
  rest: 0.06,       // per day of extra rest
  b2b: 0.35         // penalty if on B2B
};

export function computeGameProbabilities({
  homeSummary, awaySummary,
  homeRestDays, awayRestDays,
  homeB2B, awayB2B,
  neutralSite = false
}){
  const dWinPct = (homeSummary?.winPct ?? 0.5) - (awaySummary?.winPct ?? 0.5);
  const dMargin = (homeSummary?.avgMargin ?? 0) - (awaySummary?.avgMargin ?? 0);
  const dRecent = (homeSummary?.recentScore ?? 0) - (awaySummary?.recentScore ?? 0);
  const dRest = (homeRestDays ?? 0) - (awayRestDays ?? 0);

  const homeFlag = neutralSite ? 0 : 1;

  let score = 0;
  score += COEFFS.intercept;
  score += COEFFS.homeAdv * homeFlag;
  score += COEFFS.winPct * dWinPct;
  score += COEFFS.margin * dMargin;
  score += COEFFS.recent * dRecent;
  score += COEFFS.rest * dRest;
  if (homeB2B) score -= COEFFS.b2b;
  if (awayB2B) score += COEFFS.b2b;

  const pHome = clamp01(sigmoid(score));
  const pAway = clamp01(1 - pHome);
  return { pHome, pAway, score, deltas: { dWinPct, dMargin, dRecent, dRest, homeB2B, awayB2B, homeFlag } };
}

export function explainFactors({ homeSummary, awaySummary, deltas }){
  const fmtPct = (x)=> `${(100*x).toFixed(1)}%`;
  return [
    { label: 'Home last-10 win%', value: fmtPct(homeSummary.winPct), side: 'home' },
    { label: 'Away last-10 win%', value: fmtPct(awaySummary.winPct), side: 'away' },
    { label: 'Avg margin (H/A)', value: `${homeSummary.avgMargin.toFixed(1)} / ${awaySummary.avgMargin.toFixed(1)}` },
    { label: 'Recent form (EW)', value: `${homeSummary.recentScore.toFixed(2)} / ${awaySummary.recentScore.toFixed(2)}` },
    { label: 'Rest Δ (H-A)', value: `${deltas.dRest>=0?'+':''}${deltas.dRest}` },
    { label: 'Back-to-back', value: `${deltas.homeB2B?'Home B2B':''}${deltas.homeB2B&&deltas.awayB2B?' · ':''}${deltas.awayB2B?'Away B2B':''}` || 'None' }
  ];
}

export default {
  summarizeLastNGames,
  daysRestBefore,
  isBackToBack,
  computeGameProbabilities,
  explainFactors
};
