// src/components/HaikuOfTheDay.jsx
import React from "react";
import { Card, CardContent, Typography, Stack, Button, Box } from "@mui/material";

// 👉 Script font (install: npm i @fontsource/dancing-script)
import "@fontsource/dancing-script/600.css"; // weight 600 looks great for poetry

// Simple 5-7-5 curated lines (clean/safe)
const L5 = [
  "net twitches softly",
  "shoes hum on hardwood",
  "hands find the rhythm",
  "cold rim warms at dawn",
  "crowd learns to exhale",
  "whistle splits the chill",
  "rookies trust the light",
  "winter sun on glass",
  "legs remember spring",
  "ink dries on box scores",
];

const L7 = [
  "screens bloom into open lanes",
  "timeouts bend the noise to hush",
  "bounce pass threads the quiet air",
  "coaches carve chalk into space",
  "scoreboard blinks a steady pulse",
  "stars breathe under heavy lights",
  "bench thunder wakes the rafters",
  "defense speaks in tapping feet",
  "corners wait for willing threes",
  "rhythm names the backdoor cut",
];

const L5B = [
  "night leans on the rim",
  "score slips into hush",
  "nets hold the echo",
  "crowd floats home slower",
  "the ball keeps its spin",
  "sneakers fade to sleep",
  "box scores close like books",
  "hoops dream in the dark",
  "chalk dust falls like snow",
  "hands cool, hearts stay warm",
];

// tiny PRNG so the same date produces same poem
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Seed from date (YYYY-MM-DD) plus optional salt for shuffle
function seedFromDate(dateStr, salt = 0) {
  // simple 32-bit hash
  let h = 2166136261 ^ salt;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export default function HaikuOfTheDay({
  date = new Date(),             // optional override
  title = "NBA Haiku (daily)",
  compact = false,               // tighter spacing if true
  look = "script",               // "script" | "serif"
}) {
  const [salt, setSalt] = React.useState(0);
  const dateKey = new Date(date).toISOString().slice(0, 10); // YYYY-MM-DD
  const rng = mulberry32(seedFromDate(dateKey, salt));

  const line1 = pick(rng, L5);
  const line2 = pick(rng, L7);
  const line3 = pick(rng, L5B);

  // Typography styling for the poem
  const poemSx =
    look === "script"
      ? {
          fontFamily: `"Dancing Script", ui-serif, Georgia, "Times New Roman", serif`,
          fontWeight: 600,
          letterSpacing: 0.2,
          fontSize: { xs: compact ? 16 : 18, sm: compact ? 18 : 20 },
          lineHeight: compact ? 1.35 : 1.5,
        }
      : {
          // Clean serif fallback (if you prefer a non-script vibe)
          fontFamily: `ui-serif, Georgia, "Times New Roman", serif`,
          letterSpacing: 0.1,
          fontSize: { xs: compact ? 15 : 17, sm: compact ? 17 : 19 },
          lineHeight: compact ? 1.4 : 1.55,
        };

  return (
    <Card variant="outlined" sx={{ borderRadius: 1, mb: 2 }}>
      <CardContent sx={{ p: 2 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 1 }}
        >
          <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {/* keep deterministic by default; shuffle is user opt-in */}
          <Button size="small" variant="text" onClick={() => setSalt((s) => s + 1)}>
            Shuffle
          </Button>
        </Stack>

        {/* decorative poem block */}
        <Box
          sx={{
            p: { xs: 1.25, sm: 1.5 },
            borderLeft: '3px solid',
            borderColor: 'primary.main',
            borderRadius: 1,
            bgcolor: (t) =>
              t.palette.mode === 'dark'
                ? `${t.palette.action.hover}` // subtle in dark
                : t.palette.action.hover,     // subtle in light
          }}
        >
          <Typography
            variant={compact ? "body2" : "body1"}
            component="blockquote"
            sx={{
              m: 0,
              fontStyle: "italic",
              whiteSpace: "pre-wrap",
              ...poemSx,
            }}
            aria-label={`Daily haiku for ${dateKey}`}
          >
            {`${line1}
${line2}
${line3}`}
          </Typography>
        </Box>

        <Typography
          variant="caption"
          sx={{ display: "block", opacity: 0.7, mt: 0.75 }}
        >
          {dateKey}
        </Typography>
      </CardContent>
    </Card>
  );
}
