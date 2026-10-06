// scripts/generate-daily-post.mjs
// Legacy static fallback. The visible NBA Pulse page now uses live /api/nba-data.

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const BLOG_DIR = join(root, "public", "blog");
const UPCOMING_JSON = join(root, "public", "upcoming-3mo.json");

function isoDate(tz = "America/New_York", d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function stage(id) { return Number(id) === 1 ? "Preseason" : Number(id) === 3 ? "Postseason" : "Regular season"; }
async function readUpcoming() { try { return JSON.parse(await readFile(UPCOMING_JSON, "utf8")); } catch { return []; } }
function fmtTime(iso) { try { return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).format(new Date(iso)) + " ET"; } catch { return "TBD"; } }
function line(g) { return `- **${g?.away?.name || g?.away?.code} @ ${g?.home?.name || g?.home?.code}** — ${fmtTime(g?._iso)} · ${stage(g?.seasonStageId)}`; }

const today = isoDate();
const all = (await readUpcoming()).sort((a, b) => String(a?._iso).localeCompare(String(b?._iso)));
const todays = all.filter((g) => g?.dateKey === today);
const nextDate = all.find((g) => g?.dateKey > today)?.dateKey || null;
const next = nextDate ? all.filter((g) => g?.dateKey === nextDate) : [];
const md = [
  `---`,
  `title: "NBA Daily Pulse — ${today}"`,
  `description: "Daily NBA slate context including preseason, regular season, and postseason."`,
  `---`,
  `# NBA Daily Pulse — ${today}`,
  ``,
  `## Today's Slate`,
  todays.length ? todays.map(line).join("\n") : `No games today.`,
  ``,
  `## Up Next`,
  next.length ? next.map(line).join("\n") : `No upcoming games found in the snapshot.`,
  ``,
  `## PIVT`,
  `Predictions in the live app use recent five-game form, scoring margin, and available player production.`,
  ``,
].join("\n");
await mkdir(BLOG_DIR, { recursive: true });
await writeFile(join(BLOG_DIR, `${today}.md`), md, "utf8");
console.log("Daily fallback pulse written:", today);
