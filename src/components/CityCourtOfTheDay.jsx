// src/components/CityCourtOfTheDay.jsx
import React from "react";
import { Card, CardContent, Typography, Stack, Button, Box } from "@mui/material";

/* ---------- daily seed ---------- */
function mulberry32(a){return function(){let t=(a+=0x6D2B79F5);t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function hash(str,salt=0){let h=2166136261^salt;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}

/* ---------- palettes (city-tinted) ---------- */
const CITY_DATA = [
  { city:"Boston",        code:"BOS", court:"#e5c9a8", woodHi:"#f1dabc", woodLo:"#dbb98f", line:"#ffffff", accent:"#1d6f42" },
  { city:"New York",      code:"NYC", court:"#f0d8b9", woodHi:"#f7e6cc", woodLo:"#e6c99d", line:"#0f4c81", accent:"#ff6f3c" },
  { city:"Philadelphia",  code:"PHI", court:"#eddcd2", woodHi:"#f3e7df", woodLo:"#e0cbbf", line:"#13315c", accent:"#c1121f" },
  { city:"Miami",         code:"MIA", court:"#ffe3ef", woodHi:"#ffeef6", woodLo:"#ffd1e6", line:"#00d9ff", accent:"#ff0a54" },
  { city:"Chicago",       code:"CHI", court:"#f1dec6", woodHi:"#f6ead9", woodLo:"#e7ccad", line:"#111827", accent:"#e11d48" },
  { city:"Milwaukee",     code:"MIL", court:"#ead2b7", woodHi:"#f1dec7", woodLo:"#e2c29f", line:"#ecf8f8", accent:"#1c4532" },
  { city:"Los Angeles",   code:"LAL", court:"#fff3b0", woodHi:"#fff7c8", woodLo:"#ffe88a", line:"#6a00f4", accent:"#f7b801" },
  { city:"San Francisco", code:"SFO", court:"#ffe8cc", woodHi:"#ffeed9", woodLo:"#ffdcb3", line:"#facc15", accent:"#1d4ed8" },
  { city:"Dallas",        code:"DAL", court:"#e2d4c0", woodHi:"#eadfce", woodLo:"#d9c6ad", line:"#0b7285", accent:"#0ea5e9" },
  { city:"Denver",        code:"DEN", court:"#fee2b3", woodHi:"#feeac7", woodLo:"#fdd89b", line:"#073b4c", accent:"#ffd166" },
  { city:"Phoenix",       code:"PHX", court:"#ffe5b4", woodHi:"#ffedc9", woodLo:"#ffd99a", line:"#7c3aed", accent:"#f97316" },
  { city:"Toronto",       code:"TOR", court:"#e9d5c1", woodHi:"#f1e2d3", woodLo:"#dec6ab", line:"#111827", accent:"#d61f48" },
];
const cityOfDay = (d) => CITY_DATA[ hash(d) % CITY_DATA.length ];

/* ---------- NBA geometry (feet) ---------- */
const COURT_L = 94;               // length (x)
const COURT_W = 50;               // width  (y)
const RIM_X_L = 5.25;             // baskets from baseline
const RIM_X_R = COURT_L - RIM_X_L;
const RIM_Y   = COURT_W / 2;      // centered
const LANE_W  = 16;
const FT_DIST = 19;               // from baseline
const CTR_R   = 6;                // center circle radius
const RST_R   = 4;                // restricted area radius
const TP_R    = 23.75;            // 3pt arc radius
const CORNER_DX = 22;             // corner line offset from rim center

/* helpers */
const rad = (deg)=> (deg*Math.PI)/180;
function arc(cx, cy, r, a0deg, a1deg){
  // SVG arc path for a circle sector (single sweep)
  const a0=rad(a0deg), a1=rad(a1deg);
  const x0=cx + r*Math.cos(a0), y0=cy + r*Math.sin(a0);
  const x1=cx + r*Math.cos(a1), y1=cy + r*Math.sin(a1);
  const large = Math.abs(a1deg - a0deg) > 180 ? 1 : 0;
  const sweep = a1deg > a0deg ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} ${sweep} ${x1} ${y1}`;
}

export default function CityCourtOfTheDay({
  date = new Date(),
  height = 280,
  title = "City Court — Bird’s-Eye",
  overrideCity = null,
  showLabels = false,
}) {
  const [salt, setSalt] = React.useState(0);
  const dateKey = new Date(date).toISOString().slice(0,10);
  const city = overrideCity || cityOfDay(dateKey);
  const seed = hash(dateKey + city.code, salt);
  const rng  = mulberry32(seed);

  // We draw at 10 px/ft for easy mapping
  const VB_W = 940, VB_H = 500, SCALE = VB_W / COURT_L; // 10 px/ft
  const fx = (ft)=> ft * SCALE;
  const fy = (ft)=> ft * (VB_H/COURT_W);

  // Corner-3 vertical extents (intersection of arc radius w/ cornerDX)
  const yOff = Math.sqrt(TP_R*TP_R - CORNER_DX*CORNER_DX);   // ≈ 8.949 ft
  const cornerYTop = RIM_Y - yOff;
  const cornerYBot = RIM_Y + yOff;

  // Small grain variation
  const woodTilt = (rng()-0.5) * 0.6;

  return (
    <Card variant="outlined" sx={{ borderRadius:1, mb:2 }}>
      <CardContent sx={{ p:2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb:1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight:700 }}>{title}</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" sx={{ opacity:0.8 }}>{city.city}</Typography>
            <Button size="small" variant="text" onClick={()=> setSalt(s=>s+1)}>Shuffle</Button>
          </Stack>
        </Stack>

        <Box sx={{ width:'100%' }}>
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" height={height}
               role="img" aria-label={`NBA court for ${city.city}`}>
            <defs>
              <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1" gradientTransform={`rotate(${woodTilt})`}>
                <stop offset="0%"   stopColor={city.woodHi}/>
                <stop offset="100%" stopColor={city.woodLo}/>
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="0.7" result="b"/>
                <feBlend in="SourceGraphic" in2="b" mode="normal"/>
              </filter>
              <clipPath id="courtClip">
                <rect x={fx(0)} y={fy(0)} width={fx(COURT_L)} height={fy(COURT_W)} />
              </clipPath>
            </defs>

            {/* Court wood */}
            <rect x={fx(0)} y={fy(0)} width={fx(COURT_L)} height={fy(COURT_W)} fill="url(#wood)" />

            {/* Outer lines */}
            <rect x={fx(0)} y={fy(0)} width={fx(COURT_L)} height={fy(COURT_W)} fill="none" stroke={city.line} strokeWidth="4"/>

            {/* Center line & circle */}
            <line x1={fx(COURT_L/2)} y1={fy(0)} x2={fx(COURT_L/2)} y2={fy(COURT_W)} stroke={city.line} strokeWidth="3"/>
            <circle cx={fx(COURT_L/2)} cy={fy(COURT_W/2)} r={fx(CTR_R)} fill="none" stroke={city.line} strokeWidth="3"/>

            {/* Left half */}
            <HalfCourt
              side="left"
              city={city}
              fx={fx} fy={fy}
              rimX={RIM_X_L} rimY={RIM_Y}
              laneW={LANE_W} ftDist={FT_DIST}
              ctrR={CTR_R} rstR={RST_R}
              tpR={TP_R} cornerDX={CORNER_DX}
              cornerTop={cornerYTop} cornerBot={cornerYBot}
            />

            {/* Right half */}
            <HalfCourt
              side="right"
              city={city}
              fx={fx} fy={fy}
              rimX={RIM_X_R} rimY={RIM_Y}
              laneW={LANE_W} ftDist={FT_DIST}
              ctrR={CTR_R} rstR={RST_R}
              tpR={TP_R} cornerDX={CORNER_DX}
              cornerTop={cornerYTop} cornerBot={cornerYBot}
            />

            {showLabels && (
              <g fill={city.line} fontSize="12" opacity="0.7">
                <text x={fx(2)} y={fy(3)}>94×50 ft</text>
                <text x={fx(COURT_L/2)+6} y={fy(3)}>Center</text>
              </g>
            )}
          </svg>
        </Box>

        <Typography variant="caption" sx={{ display:'block', opacity:0.7, mt:0.75 }}>
          {city.city} · {new Date(date).toLocaleDateString()}
        </Typography>
      </CardContent>
    </Card>
  );
}

/* --------- one side (baseline→midcourt) geometry --------- */
function HalfCourt({
  side, city, fx, fy,
  rimX, rimY,
  laneW, ftDist,
  ctrR, rstR,
  tpR, cornerDX, cornerTop, cornerBot,
}) {
  const laneHalf = laneW/2;
  const laneY0 = rimY - laneHalf;
  const laneY1 = rimY + laneHalf;
  const ftX    = side === "left" ? ftDist : COURT_L - ftDist;

  // Lane rectangle
  const laneX0 = side === "left" ? 0 : ftX;
  const laneX1 = side === "left" ? ftX : COURT_L;
  const laneWpx = fx(Math.abs(laneX1 - laneX0));
  const laneXpx = fx(Math.min(laneX0, laneX1));

  // Free-throw circle: top solid, bottom dashed
  const ftCx = fx(ftX), ftCy = fy(rimY), ftR = fx(ctrR);
  const ftTopPath = arc(ftCx, ftCy, ftR, 200, -20);      // slightly over 180° for clean joins
  const ftBotPath = arc(ftCx, ftCy, ftR, -20, 200);

  // Restricted area: dashed semicircle toward midcourt
  const rstCx = fx(rimX), rstCy = fy(rimY), rstRpx = fx(rstR);
  const rstStart = side === "left" ? 300 : 240;          // angle tweaks to face inward
  const rstEnd   = side === "left" ? 60  : 120;
  const rstPath  = arc(rstCx, rstCy, rstRpx, rstStart, rstEnd);

  // Corner 3 vertical line
  const cornerX = side === "left" ? rimX + cornerDX : rimX - cornerDX;

  // 3pt arc: from cornerTop to cornerBot with basket center
  const sweep = side === "left" ? 1 : 0;
  const arcR  = fx(tpR);
  const tpPath = `
    M ${fx(cornerX)} ${fy(cornerTop)}
    A ${arcR} ${arcR} 0 0 ${sweep} ${fx(cornerX)} ${fy(cornerBot)}
  `;

  // Backboard line (4 ft inside baseline), 6 ft wide centered on rimY
  const bbX = side === "left" ? 4 : COURT_L - 4;
  const bbY0 = rimY - 3, bbY1 = rimY + 3;

  // Rim (18" diameter -> 0.75 ft radius)
  const rimR = fx(0.75);

  return (
    <g clipPath="url(#courtClip)">
      {/* Lane */}
      <rect x={laneXpx} y={fy(laneY0)} width={laneWpx} height={fy(laneY1 - laneY0)}
            fill="none" stroke={city.line} strokeWidth="3" />

      {/* Free-throw circle (top solid, bottom dashed) */}
      <path d={ftTopPath} fill="none" stroke={city.line} strokeWidth="3" />
      <path d={ftBotPath} fill="none" stroke={city.line} strokeWidth="3" strokeDasharray="10 8" />

      {/* Restricted semicircle (dashed) */}
      <path d={rstPath} fill="none" stroke={city.line} strokeWidth="3" strokeDasharray="8 8" opacity="0.9" />

      {/* Corner three vertical */}
      <line x1={fx(cornerX)} y1={fy(cornerTop)} x2={fx(cornerX)} y2={fy(cornerBot)}
            stroke={city.line} strokeWidth="3" />

      {/* Three-point arc */}
      <path d={tpPath} fill="none" stroke={city.accent} strokeWidth="3" opacity="0.85" />

      {/* Backboard */}
      <line x1={fx(bbX)} y1={fy(bbY0)} x2={fx(bbX)} y2={fy(bbY1)}
            stroke={city.line} strokeWidth="4" opacity="0.95" />

      {/* Rim */}
      <circle cx={fx(rimX)} cy={fy(rimY)} r={rimR} fill="none" stroke={city.accent} strokeWidth="4" filter="url(#glow)" />
    </g>
  );
}
