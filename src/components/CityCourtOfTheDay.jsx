import React from "react";
import { Card, CardContent, Typography, Stack, Button, Box, useTheme } from "@mui/material";

/** ---------- seeded PRNG so each date renders the same art ---------- */
function mulberry32(a) {
  return function() {
    let t = (a += 0x6D2B79F5);
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
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const lerp  = (a, b, t) => a + (b - a) * t;

/** ---------- city palettes (team-inspired, tweak freely) ---------- */
const CITY_DATA = [
  { city: "Boston",        code: "BOS", sky: ["#102a43","#1f3b52"],  bld: "#1d6f42", court: "#e4c29e", line: "#ffffff", accent:"#21a179" },
  { city: "New York",      code: "NYC", sky: ["#0d1321","#1d2d44"],  bld: "#f06400", court: "#f2d4ae", line: "#0f4c81", accent:"#ff6f3c" },
  { city: "Philadelphia",  code: "PHI", sky: ["#0c1b33","#173a63"],  bld: "#c1121f", court: "#eddcd2", line: "#13315c", accent:"#d7263d" },
  { city: "Miami",         code: "MIA", sky: ["#0b132b","#1c2541"],  bld: "#ff0a54", court: "#ffd6e0", line: "#00d9ff", accent:"#ff477e" },
  { city: "Chicago",       code: "CHI", sky: ["#0f172a","#1f2937"],  bld: "#e11d48", court: "#f1dec6", line: "#111827", accent:"#f43f5e" },
  { city: "Milwaukee",     code: "MIL", sky: ["#0e1a2b","#173042"],  bld: "#1c4532", court: "#ead2b7", line: "#ecf8f8", accent:"#2f855a" },
  { city: "Los Angeles",   code: "LAL", sky: ["#0b1220","#182747"],  bld: "#f7b801", court: "#fff3b0", line: "#6a00f4", accent:"#ffd166" },
  { city: "San Francisco", code: "SFO", sky: ["#0e1428","#1f2a48"],  bld: "#1d4ed8", court: "#ffe8cc", line: "#facc15", accent:"#60a5fa" },
  { city: "Dallas",        code: "DAL", sky: ["#0a1220","#172845"],  bld: "#0ea5e9", court: "#e2d4c0", line: "#0b7285", accent:"#22d3ee" },
  { city: "Denver",        code: "DEN", sky: ["#0b1321","#1c2541"],  bld: "#ffd166", court: "#fee2b3", line: "#073b4c", accent:"#ef476f" },
  { city: "Phoenix",       code: "PHX", sky: ["#0e1329","#2c1b47"],  bld: "#f97316", court: "#ffe5b4", line: "#7c3aed", accent:"#fb923c" },
  { city: "Toronto",       code: "TOR", sky: ["#0f122e","#1f244a"],  bld: "#d61f48", court: "#e9d5c1", line: "#111827", accent:"#ef4444" },
];

/** pick a city deterministically by date */
function cityOfDay(dateKey) {
  const idx = hash(dateKey) % CITY_DATA.length;
  return CITY_DATA[idx];
}

/** draw randomized skyline blocks */
function Skyline({ w, h, seed, baseColor }) {
  const rng = mulberry32(seed);
  const cols = 22;
  const spacing = w / cols;
  const blocks = [];
  for (let i=0; i<cols; i++){
    const x = i * spacing + rng()*2;
    const hFactor = clamp(rng()*0.8 + Math.sin(i*0.2)*0.2 + 0.35, 0.15, 0.95);
    const bh = hFactor * h;
    const bw = spacing * (0.7 + rng()*0.2);
    const y  = h - bh;
    const darken = Math.floor(30 + rng()*60);
    // simple darken of baseColor
    const fill = shadeHex(baseColor, -darken);
    blocks.push(<rect key={i} x={x} y={y} width={bw} height={bh} fill={fill} rx="2" />);
    // windows (sparse)
    if (rng() > 0.6) {
      const winCount = 1 + Math.floor(rng()*3);
      for (let k=0;k<winCount;k++){
        const wy = y + (bh*(0.2 + rng()*0.6));
        const wx = x + (bw*(0.2 + rng()*0.6));
        blocks.push(<circle key={`w${i}-${k}`} cx={wx} cy={wy} r={1.2} fill="#ffd166" opacity={0.9} />);
      }
    }
  }
  return <g>{blocks}</g>;
}

/** color utils */
function shadeHex(hex, amt) {
  // hex like "#RRGGBB"
  let c = hex.replace(/^#/,'');
  if (c.length !== 6) return hex;
  const to = (n)=> clamp(n, 0, 255);
  let r = parseInt(c.slice(0,2),16)+amt;
  let g = parseInt(c.slice(2,4),16)+amt;
  let b = parseInt(c.slice(4,6),16)+amt;
  return `#${to(r).toString(16).padStart(2,'0')}${to(g).toString(16).padStart(2,'0')}${to(b).toString(16).padStart(2,'0')}`;
}

export default function CityCourtOfTheDay({
  date = new Date(),            // optional
  height = 180,                 // SVG height (responsive width)
  title = "City Court Series",
  overrideCity = null,          // { city, code, sky:[a,b], bld, court, line, accent } if you ever want to force a city
}) {
  const theme = useTheme();
  const [salt, setSalt] = React.useState(0);  // optional shuffle without changing date
  const dateKey = new Date(date).toISOString().slice(0,10); // YYYY-MM-DD
  const city = overrideCity || cityOfDay(dateKey);
  const seed = hash(dateKey + city.code, salt);
  const rng  = mulberry32(seed);

  // layout
  const W = 720; // internal viewBox width; scales with width:100%
  const H = height;
  const skyH = H * 0.62;
  const baseY = skyH; // top of court plane

  // colors
  const [skyA, skyB] = city.sky;
  const court = city.court;
  const line  = city.line;
  const accent= city.accent;
  const bld   = city.bld;

  // court styling jitter
  const laneW  = W * 0.18;
  const rimX   = W * 0.75;
  const rimY   = baseY + H*0.08;
  const arcR   = W * 0.14;

  // subtle arc control points
  const cp1x = lerp(W*0.58, W*0.64, rng());
  const cp1y = lerp(baseY+H*0.03, baseY+H*0.12, rng());
  const cp2x = lerp(W*0.7,  W*0.8,  rng());
  const cp2y = lerp(baseY-6, baseY+H*0.04, rng());

  return (
    <Card variant="outlined" sx={{ borderRadius: 1, mb: 2 }}>
      <CardContent sx={{ p:2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight:700 }}>{title}</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" sx={{ opacity:0.8 }}>{city.city}</Typography>
            <Button size="small" variant="text" onClick={()=> setSalt(s=>s+1)}>Shuffle</Button>
          </Stack>
        </Stack>

        <Box sx={{ width: '100%' }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} role="img"
               aria-label={`Stylized skyline and court for ${city.city}`}>
            {/* sky gradient */}
            <defs>
              <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor={skyA} />
                <stop offset="100%" stopColor={skyB} />
              </linearGradient>
              <linearGradient id="woodGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor={shadeHex(court, +10)} />
                <stop offset="100%" stopColor={shadeHex(court, -8)} />
              </linearGradient>
              <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="0.7" result="blur"/>
                <feBlend in="SourceGraphic" in2="blur" mode="normal"/>
              </filter>
            </defs>

            {/* sky */}
            <rect x="0" y="0" width={W} height={skyH} fill="url(#skyGrad)" />

            {/* skyline, two layers for parallax tint */}
            <g transform={`translate(0, ${skyH*0.12})`} opacity={0.85}>
              <Skyline w={W} h={skyH*0.85} seed={seed} baseColor={bld} />
            </g>
            <g transform={`translate(0, ${skyH*0.22})`} opacity={0.55}>
              <Skyline w={W} h={skyH*0.7} seed={seed+123} baseColor={shadeHex(bld,-35)} />
            </g>

            {/* court plane */}
            <rect x="0" y={baseY} width={W} height={H-baseY} fill="url(#woodGrad)"/>

            {/* half court center line */}
            <line x1={W*0.5} y1={baseY} x2={W*0.5} y2={H} stroke={line} strokeWidth="2"/>

            {/* center circle */}
            <circle cx={W*0.5} cy={baseY+H*0.2} r={W*0.06} fill="none" stroke={line} strokeWidth="2"/>

            {/* lane (right) */}
            <rect x={rimX - laneW/2} y={baseY+H*0.02} width={laneW} height={H*0.24}
                  fill="none" stroke={line} strokeWidth="2"/>

            {/* rim + backboard */}
            <rect x={rimX-18} y={rimY-24} width="36" height="4" fill={line} opacity="0.9"/> {/* backboard */}
            <circle cx={rimX} cy={rimY} r="7.5" fill="none" stroke={accent} strokeWidth="3" filter="url(#soft)"/>

            {/* arcade 3pt-ish arc (stylized) */}
            <path
              d={`M ${rimX-arcR} ${rimY}
                 C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${rimX+arcR} ${rimY}`}
              fill="none" stroke={accent} strokeWidth="2" opacity="0.75"
            />

            {/* subtle foreground vignette */}
            <rect x="0" y={baseY} width={W} height={H-baseY}
                  fill="url(#woodGrad)" opacity="0.08"/>
          </svg>
        </Box>

        <Typography variant="caption" sx={{ display:'block', opacity:0.7, mt:0.75 }}>
          {city.city} · {new Date(date).toLocaleDateString()}
        </Typography>
      </CardContent>
    </Card>
  );
}
