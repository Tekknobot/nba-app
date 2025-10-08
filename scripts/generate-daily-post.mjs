// scripts/generate-daily-post.mjs
// Generates /public/blog/YYYY-MM-DD.md using your schedule + (optional) light model info.
// No haiku; front-matter kept, but we'll strip it client-side for display.
// Safe to run during prebuild.

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const BLOG_DIR = join(root, "public", "blog");
const UPCOMING_JSON = join(root, "public", "upcoming-3mo.json");

function localISODate(tz = "America/Toronto", d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(d);
  const get = (t) => parts.find(p => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

async function readUpcoming() {
  try { return JSON.parse(await readFile(UPCOMING_JSON, "utf8")); } catch { return []; }
}

function fmtTimeLocal(iso) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      weekday: "short"
    }).format(d);
  } catch { return "TBD"; }
}

function summarizeMatchup(g) {
  const edge = Number(g?.model?.pHome);
  const home = g?.home?.name || g?.home || "Home";
  const away = g?.away?.name || g?.away || "Away";
  const tip  = g?._iso ? fmtTimeLocal(g._iso) : "TBD";
  if (Number.isFinite(edge)) {
    const fav = edge >= 0.5 ? home : away;
    const pct = Math.round((edge >= 0.5 ? edge : 1 - edge) * 100);
    const note =
      edge >= 0.60 ? "clear edge" :
      edge >= 0.55 ? "slight lean" : "coin-flip";
    return `• **${away} @ ${home}** — ${fav} ${note} (~${pct}%) · ${tip}`;
  }
  return `• **${away} @ ${home}** — ${tip}`;
}

function pickTopEdges(list, k = 3) {
  const withProb = list.filter(g => Number.isFinite(g?.model?.pHome));
  withProb.sort((a,b) => Math.abs((b.model.pHome ?? 0.5) - 0.5) - Math.abs((a.model.pHome ?? 0.5) - 0.5));
  return withProb.slice(0, k);
}

function nextGameDay(all, todayStr) {
  const sorted = [...all].sort((a,b)=>String(a.dateKey||"").localeCompare(String(b.dateKey||"")));
  const t = todayStr;
  for (const g of sorted) {
    const d = (g.dateKey||"").slice(0,10);
    if (d > t) return d;
  }
  return null;
}

async function main() {
  const today = isoDate();
  const upcoming = await readUpcoming(); // array of game rows produced by your fetch script

  // Games today
  const todays = (upcoming || []).filter(g => (g.dateKey || g.gameDate || "").slice(0,10) === today);

  // Build sections based on your app’s core features
  let lines = todays
    .slice()
    .sort((a,b)=>String(a._iso||"").localeCompare(String(b._iso||"")))
    .map(summarizeMatchup);

  const edges = pickTopEdges(todays, 3).map(summarizeMatchup);
  const nxt = nextGameDay(upcoming, today);

  const header = `--- 
title: "NBA Daily Pulse — ${today}"
description: "Daily slate overview with Model edge, form notes, injuries, and what’s next."
---`;

  const md = [
    header,
    `# NBA Daily Pulse — ${today}`,
    "",
    "## Today’s Slate",
    lines.length ? lines.join("\n") : "No games today.",
    "",
    "## Model Edge Spotlight",
    edges.length ? edges.join("\n") : "No quantified edges available for today’s slate.",
    "",
    "## Form Watch",
    "- Recent 10-game results and scoring margins are reflected in each matchup panel of the app.",
    "- Use the calendar to jump days; tap a game to compare teams’ recent form.",
    "",
    "## Injury Watch",
    "- We surface notable status changes from reliable outlets. Notes are summarized in our own words (no copied text).",
    "",
    "## What’s Next",
    nxt ? `- Next tip-off day: **${nxt}**` : "- Check back soon for the next slate.",
    "",
    "*PIVT estimates are for fan context — not betting advice.*",
  ].join("\n");

  await mkdir(BLOG_DIR, { recursive: true });
  await writeFile(join(BLOG_DIR, `${today}.md`), md, "utf8");
  console.log("Daily blog written:", today);
}

main().catch(e => { console.error(e); process.exit(1); });
