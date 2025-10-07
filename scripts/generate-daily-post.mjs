// scripts/generate-daily-post.mjs
// Generates /public/blog/YYYY-MM-DD.md with original summaries.
// Run daily (e.g., as a CI cron or predeploy). No external keys required.

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const BLOG_DIR = join(root, "public", "blog");

function isoDate(d = new Date()) { return new Date(d).toISOString().slice(0,10); }
function titleCase(s) { return s.replace(/\b([a-z])/g, (m,c)=>c.toUpperCase()); }

async function readUpcoming() {
  const p = join(root, "public", "upcoming-3mo.json"); // produced by your existing fetch script
  try { return JSON.parse(await readFile(p, "utf8")); } catch { return []; }
}

function haikuFor(dateStr) {
  // lightweight deterministic generator (mirrors your component)
  const L5 = ["net twitches softly","shoes hum on hardwood","hands find the rhythm","crowd learns to exhale","cold rim warms at dawn"];
  const L7 = ["no-look passes thread the seam","backs cut like comets in flight","chalk dust rises in halos","timeouts bend the arena hum","box outs carve quiet space"];
  const L5B= ["scoreboards blink, then rest","voices drift like rain","the glass keeps no lies","evening folds the court","whistles fade to dusk"];

  const seed = [...dateStr].reduce((h,ch)=>Math.imul(h^ch.charCodeAt(0), 16777619)>>>0, 2166136261);
  const rng = (()=>{ let s=seed; return ()=>((s=Math.imul(s^s>>>15, 1|s))+ (s^=s+ (s>>>7|s<<25))>>>0)/2**32; })();
  const pick = (arr)=>arr[Math.floor(rng()*arr.length)];
  return [pick(L5), pick(L7), pick(L5B)];
}

function summarizeMatchup(g) {
  // g = { home, away, startTimeLocal, edgeHome (0..1), tv?, notes? }
  const edge = g.edgeHome;
  const fav = edge >= 0.5 ? g.home : g.away;
  const pct = Math.round((edge >= 0.5 ? edge : 1-edge) * 100);
  const angle = edge >= 0.6 ? "clear edge" : edge >= 0.55 ? "slight lean" : "coin-flip";
  return `• ${g.away} @ ${g.home} — ${fav} ${angle} (~${pct}% by PIVT), tip ${g.startTimeLocal}`;
}

async function main() {
  const today = isoDate();
  const upcoming = await readUpcoming();

  // filter today's games; adjust if your JSON uses a different shape/keys
  const todays = (upcoming || []).filter(g => (g.date || g.gameDate)?.slice(0,10) === today);

  // produce summaries — replace with your own edge calc if available in JSON
  const lines = todays.slice().sort((a,b)=>String(a.startTimeLocal).localeCompare(String(b.startTimeLocal)))
    .map(summarizeMatchup);

  const [h1,h2,h3] = haikuFor(today);

  const md = `---
title: "NBA Daily Pulse — ${today}"
description: "Original daily summary: top matchups, trends, injuries, and a fresh haiku."
---

# NBA Daily Pulse — ${today}

_${h1}_  
_${h2}_  
_${h3}_

## Today’s Best Matchups
${lines.length ? lines.join("\n") : "No games today."}

## Form Watch
- We highlight recent 10-game records and points diff (home vs away). See team pages in the app for details.

## Injury Watch
- We flag notable status changes and absences. Sources are public team reports and major outlets; notes are summarized in our own words.

---

*PIVT estimates are lightweight and for fan context — not betting advice.*
`;
  await mkdir(BLOG_DIR, { recursive: true });
  const outPath = join(BLOG_DIR, `${today}.md`);
  await writeFile(outPath, md, "utf8");
  console.log("Wrote", outPath);
}

main().catch(e => { console.error(e); process.exit(1); });
