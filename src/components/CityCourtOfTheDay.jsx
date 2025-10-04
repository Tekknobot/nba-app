import React from "react";
import { Card, CardContent, Typography, Stack, Button, Box } from "@mui/material";

/** ---------- seeded PRNG so each date renders the same art ---------- */
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(str, salt = 0) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

/** ---------- palettes by city (team-ish colors; tweak freely) ---------- */
const CITY_DATA = [
  { city: "Boston",        code: "BOS", court: "#e5c9a8", woodHi:"#f1dabc", woodLo:"#dbb98f", line:"#ffffff", accent:"#1d6f42" },
  { city: "New York",      code: "NYC", court: "#f0d8b9", woodHi:"#f7e6cc", woodLo:"#e6c99d", line:"#0f4c81", accent:"#ff6f3c" },
  { city: "Philadelphia",  code: "PHI", court: "#eddcd2", woodHi:"#f3e7df", woodLo:"#e0cbbf", line:"#13315c", accent:"#c1121f" },
  { city: "Miami",         code: "MIA", court: "#ffe3ef", woodHi:"#ffeef6", woodLo:"#ffd1e6", line:"#00d9ff", accent:"#ff0a54" },
  { city: "Chicago",       code: "CHI", court: "#f1dec6", woodHi:"#f6ead9", woodLo:"#e7ccad", line:"#111827", accent:"#e11d48" },
  { city: "Milwaukee",     code: "MIL", court: "#ead2b7", woodHi:"#f1dec7", woodLo:"#e2c29f", line:"#ecf8f8", accent:"#1c4532" },
  { city: "Los Angeles",   code: "LAL", court: "#fff3b0", woodHi:"#fff7c8", woodLo:"#ffe88a", line:"#6a00f4", accent:"#f7b801" },
  { city: "San Francisco", code: "SFO", court: "#ffe8cc", woodHi:"#ffeed9", woodLo:"#ffdcb3", line:"#facc15", accent:"#1d4ed8" },
  { city: "Dallas",        code: "DAL", court: "#e2d4c0", woodHi:"#eadfce", woodLo:"#d9c6ad", line:"#0b7285", accent:"#0ea5e9" },
  { city: "Denver",        code: "DEN", court: "#fee2b3", woodHi:"#feeac7", woodLo:"#fdd89b", line:"#073b4c", accent:"#ffd166" },
  { city: "Phoenix",       code: "PHX", court: "#ffe5b4", woodHi:"#ffedc9", woodLo:"#ffd99a", line:"#7c3aed", accent:"#f97316" },
  { city: "Toronto",       code: "TOR", court: "#e9d5c1", woodHi:"#f1e2d3", woodLo:"#dec6ab", line:"#111827", accent:"#d61f48" },
];

function cityOfDay(dateKey) {
  const idx = hash(dateKey) % CITY_DATA.length;
  return CITY_DATA[idx];
}

/** ---------- Court geometry (NBA) ----------
 * Full court: 94 ft (length) x 50 ft (width)
 * Basket centers: 5.25 ft from each baseline (x = 5.25, 88.75)
 * Lane (paint): 16 ft wide, from baseline to FT line at 19 ft
 * Free-throw circle radius: 6 ft (we draw the arcs)
 * Center circle radius: 6 ft
 * Restricted circle radius: 4 ft (dashed)
 * Three-point arc: radius 23.75 ft (from basket center)
 * Corner 3: 22 ft (vertical lines) from basket center, where arc meets
 */
const COURT_L = 94;  // ft, horizontal (x)
const COURT_W = 50;  // ft, vertical   (y)
const RIM_X_LEFT  = 5.25;
const RIM_X_RIGHT = COURT_L - RIM_X_LEFT; // 88.75
const RIM_Y       = COURT_W / 2;          // centered on width
const LANE_W      = 16;
const FT_DIST     = 19;
const CENTER_R    = 6;
const RESTRICT_R  = 4;
const THREE_R     = 23.75;
const CORNER_DX   = 22; // corner line x-distance from basket center

export default function CityCourtOfTheDay({
  date = new Date(),
  height = 260,             // SVG pixel height (responsive width)
  title = "City Court Series — Bird’s-Eye",
  overrideCity = null,
  showLabels = false,       // set true to show tiny labels (debug/education)
}) {
  const [salt, setSalt] = React.useState(0);
  const dateKey = new Date(date).toISOString().slice(0, 10);
  const city = overrideCity || cityOfDay(dateKey);
  const seed = hash(dateKey + city.code, salt);
  const rng  = mulberry32(seed);

  // We draw at 10 px/ft via viewBox 940 x 500 (makes geometry easy).
  const VB_W = 940;
  const VB_H = 500;
  const S    = VB_W / COURT_L; // 10 px per foot
  const Hpx  = height;         // real element height
  const Wpx  = Hpx * (VB_W / VB_H); // maintain aspect ratio

  // Helpers: ft → px
  const fx = (ft) => ft * S;
  const fy = (ft) => ft * (VB_H / COURT_W);

  // Compute tangent points for 3pt corner lines (left & right)
  function cornerLineYOffsets() {
    // vertical offset from rim center where x = rimX ± CORNER_DX meets the 3pt circle
    const yOff = Math.sqrt(THREE_R * THREE_R - CORNER_DX * CORNER_DX); // ~8.949 ft
    return [RIM_Y - yOff, RIM_Y + yOff];
  }
  const [cornerYTop, cornerYBot] = cornerLineYOffsets();

  // random subtle rotation/texture to keep art lively (very small)
  const woodJitter = (rng() - 0.5) * 0.004; // ±0.2% skew
  const woodRotate = (rng() - 0.5) * 0.7;   // ±0.35 deg

  return (
    <Card variant="outlined" sx={{ borderRadius: 1, mb: 2 }}>
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" sx={{ opacity: 0.8 }}>{city.city}</Typography>
            <Button size="small" variant="text" onClick={() => setSalt((s) => s + 1)}>Shuffle</Button>
          </Stack>
        </Stack>

        <Box sx={{ width: "100%" }}>
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            width="100%"
            height={Hpx}
            role="img"
            aria-label={`NBA bird’s-eye court for ${city.city}`}
          >
            {/* wood gradients + filters */}
            <defs>
              <linearGradient id="woodGrad" x1="0" y1="0" x2="0" y2="1" gradientTransform={`rotate(${woodRotate})`}>
                <stop offset="0%" stopColor={city.woodHi} />
                <stop offset="100%" stopColor={city.woodLo} />
              </linearGradient>
              <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" result="blur"/>
                <feBlend in="SourceGraphic" in2="blur" mode="normal"/>
              </filter>

              {/* Clip to inside court (to avoid overflowing arcs) */}
              <clipPath id="courtClip">
                <rect x={fx(0)} y={fy(0)} width={fx(COURT_L)} height={fy(COURT_W)} />
              </clipPath>
            </defs>

            {/* Court background (full 94x50) */}
            <rect x={fx(0)} y={fy(0)} width={fx(COURT_L)} height={fy(COURT_W)} fill="url(#woodGrad)" />

            {/* Outer boundary */}
            <rect
              x={fx(0)} y={fy(0)} width={fx(COURT_L)} height={fy(COURT_W)}
              fill="none" stroke={city.line} strokeWidth="4"
            />

            {/* Center line */}
            <line x1={fx(COURT_L/2)} y1={fy(0)} x2={fx(COURT_L/2)} y2={fy(COURT_W)} stroke={city.line} strokeWidth="3" />

            {/* Center circle */}
            <circle
              cx={fx(COURT_L/2)} cy={fy(COURT_W/2)} r={fx(CENTER_R)}
              fill="none" stroke={city.line} strokeWidth="3"
            />

            {/* Helper to draw one basket side (parameterized by direction) */}
            {/** Left side */}
            <CourtSide
              side="left"
              city={city}
              fx={fx} fy={fy}
              rimX={RIM_X_LEFT} rimY={RIM_Y}
              laneWidth={LANE_W} ftDist={FT_DIST}
              circleR={CENTER_R} restrictR={RESTRICT_R}
              threeR={THREE_R} cornerDX={CORNER_DX}
              cornerYTop={cornerYTop} cornerYBot={cornerYBot}
            />
            {/** Right side */}
            <CourtSide
              side="right"
              city={city}
              fx={fx} fy={fy}
              rimX={RIM_X_RIGHT} rimY={RIM_Y}
              laneWidth={LANE_W} ftDist={FT_DIST}
              circleR={CENTER_R} restrictR={RESTRICT_R}
              threeR={THREE_R} cornerDX={CORNER_DX}
              cornerYTop={cornerYTop} cornerYBot={cornerYBot}
            />

            {/* Optional tiny labels (debug/ed) */}
            {showLabels && (
              <g fill={city.line} fontSize="12" opacity="0.7">
                <text x={fx(COURT_L/2)+6} y={fy(2)}>Center</text>
                <text x={fx(3)} y={fy(3)}>94 x 50 ft</text>
              </g>
            )}
          </svg>
        </Box>

        <Typography variant="caption" sx={{ display: "block", opacity: 0.7, mt: 0.75 }}>
          {city.city} · {new Date(date).toLocaleDateString()}
        </Typography>
      </CardContent>
    </Card>
  );
}

/** ----------- Side renderer: draws one half (left or right) ----------- */
function CourtSide({
  side, city, fx, fy,
  rimX, rimY,
  laneWidth, ftDist,
  circleR, restrictR,
  threeR, cornerDX, cornerYTop, cornerYBot
}) {
  // Lane (paint): from baseline to free-throw line, width laneWidth centered on rimY
  const laneHalf = laneWidth / 2;
  const laneY0 = rimY - laneHalf;
  const laneY1 = rimY + laneHalf;

  // FT line x
  const ftX = side === "left" ? ftDist : COURT_L - ftDist;

  // Corner 3 vertical line x
  const cornerX = side === "left" ? rimX + cornerDX : rimX - cornerDX;

  // Arc extents: draw arc from (cornerX, cornerYTop) to (cornerX, cornerYBot)
  // Path uses two arcs to ensure correct direction; clip to court rect automatically
  const arcPath = `
    M ${fx(cornerX)} ${fy(cornerYTop)}
    A ${fx(threeR)} ${fx(threeR)} 0 0 ${side === "left" ? 1 : 0} ${fx(cornerX)} ${fy(cornerYBot)}
  `;

  // Backboard plane at 4 ft inside baseline, 6 ft wide (3 ft either side of rim center)
  const backboardX = side === "left" ? 4 : COURT_L - 4;
  const bbX0 = backboardX;
  const bbX1 = backboardX;
  const bbW = 6; // width across y
  const bbY0 = rimY - bbW/2;
  const bbY1 = rimY + bbW/2;

  return (
    <g clipPath="url(#courtClip)">
      {/* Lane rectangle */}
      <rect
        x={fx(Math.min(ftX, 0))} y={fy(laneY0)}
        width={fx(Math.abs(ftX - 0))}
        height={fy(laneY1 - laneY0)}
        transform={side === "right" ? `translate(${fx(COURT_L)},0) scale(-1,1)` : undefined}
        fill="none" stroke={city.line} strokeWidth="3"
      />

      {/* Free-throw arc (full circle drawn as two arcs; we just draw the circle outline) */}
      <circle
        cx={fx(ftX)} cy={fy(rimY)}
        r={fx(circleR)}
        fill="none" stroke={city.line} strokeWidth="3"
      />

      {/* Restricted circle (dashed) */}
      <circle
        cx={fx(rimX)} cy={fy(rimY)}
        r={fx(restrictR)}
        fill="none" stroke={city.line} strokeWidth="3" strokeDasharray="10 8"
        opacity="0.8"
      />

      {/* 3pt corner line */}
      <line
        x1={fx(cornerX)} y1={fy(cornerYTop)}
        x2={fx(cornerX)} y2={fy(cornerYBot)}
        stroke={city.line} strokeWidth="3"
      />

      {/* 3pt arc */}
      <path d={arcPath} fill="none" stroke={city.accent} strokeWidth="3" opacity="0.8" />

      {/* Backboard (thin) */}
      <line
        x1={fx(bbX0)} y1={fy(bbY0)}
        x2={fx(bbX1)} y2={fy(bbY1)}
        stroke={city.line} strokeWidth="4" opacity="0.9"
      />

      {/* Rim */}
      <circle
        cx={fx(rimX)} cy={fy(rimY)}
        r={fx(0.75)} /* 18" diameter => radius 9" = 0.75 ft */
        fill="none" stroke={city.accent} strokeWidth="4" filter="url(#softGlow)"
      />
    </g>
  );
}
