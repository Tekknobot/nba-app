const { XMLParser } = require("fast-xml-parser");
const he = require("he");

const ESPN_NEWS = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=24";
const RSS_FEEDS = [
  { source: "CBS Sports", url: "https://www.cbssports.com/rss/headlines/nba/" },
  { source: "Yahoo Sports", url: "https://sports.yahoo.com/nba/rss/" },
  { source: "RotoWire", url: "https://www.rotowire.com/rss/news.php?sport=NBA" },
  { source: "SB Nation", url: "https://www.sbnation.com/rss/nba/index.xml" },
];

function detectInjury(text = "") {
  const hay = String(text).toLowerCase();
  const negatives = [/throwback/i, /jersey/i, /uniform/i, /hardwood classic/i];
  if (negatives.some((re) => re.test(hay))) return false;
  return /(injur|ruled out|will not play|inactive|sidelined|surgery|fracture|sprain|strain|soreness|tightness|torn|tear|acl|mcl|meniscus|achilles|hamstring|calf|quad|groin|knee|ankle|foot|wrist|hand|shoulder|hip|concussion)/i.test(hay);
}

async function fetchJson(url, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "PIVT/3.0" }, signal: controller.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, timeoutMs = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { Accept: "application/rss+xml,text/xml,*/*", "User-Agent": "PIVT/3.0" }, signal: controller.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.text();
  } finally {
    clearTimeout(timer);
  }
}

function espnArticle(item) {
  const link = item?.links?.web?.href || item?.links?.mobile?.href || "";
  const image = item?.images?.find((x) => x?.url)?.url || "";
  const title = he.decode(item?.headline || item?.title || "");
  const desc = he.decode(item?.description || "");
  return {
    title,
    link,
    pubDate: item?.published || item?.lastModified || "",
    source: "ESPN",
    image,
    isInjury: detectInjury(`${title} ${desc}`),
  };
}

function pickRssImage(item) {
  const media = Array.isArray(item?.["media:content"]) ? item["media:content"][0] : item?.["media:content"];
  const thumb = Array.isArray(item?.["media:thumbnail"]) ? item["media:thumbnail"][0] : item?.["media:thumbnail"];
  const enclosure = Array.isArray(item?.enclosure) ? item.enclosure[0] : item?.enclosure;
  const choices = [media?.url, media?.href, thumb?.url, thumb?.href, enclosure?.url, enclosure?.href, item?.image?.url, item?.image?.href, typeof item?.image === "string" ? item.image : ""];
  const direct = choices.find((x) => typeof x === "string" && /^https?:\/\//i.test(x));
  if (direct) return direct;
  const html = String(item?.description || item?.["content:encoded"] || "");
  return html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || "";
}

async function fetchRss(feed) {
  try {
    const xml = await fetchText(feed.url);
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
    const doc = parser.parse(xml);
    const raw = doc?.rss?.channel?.item || [];
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((item) => {
      const title = he.decode(item?.title || "");
      const desc = he.decode(String(item?.description || ""));
      return {
        title,
        link: item?.link || item?.guid || "",
        pubDate: item?.pubDate || item?.published || item?.updated || "",
        source: feed.source,
        image: pickRssImage(item),
        isInjury: detectInjury(`${title} ${desc}`),
      };
    }).filter((x) => x.title && x.link);
  } catch {
    return [];
  }
}

function normalizeHeadline(v = "") {
  return String(v || "")
    .toLowerCase()
    .replace(/&[^;]+;/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dedupe(items) {
  const seenLinks = new Set();
  const seenTitles = new Set();
  return items.filter((item) => {
    const linkKey = String(item.link || "").replace(/[?#].*$/, "").toLowerCase();
    const titleKey = normalizeHeadline(item.title);
    if ((!linkKey && !titleKey) || (linkKey && seenLinks.has(linkKey)) || (titleKey && seenTitles.has(titleKey))) return false;
    if (linkKey) seenLinks.add(linkKey);
    if (titleKey) seenTitles.add(titleKey);
    return true;
  });
}

// Keep the news rail from turning into a single-publisher feed simply because
// one outlet posts more frequently. The freshest item from each source gets a
// pass before the second-freshest item from each source, and so on.
function balanceSources(items, limit = 30) {
  const groups = new Map();
  for (const item of items) {
    const source = item?.source || "Other";
    if (!groups.has(source)) groups.set(source, []);
    groups.get(source).push(item);
  }
  for (const rows of groups.values()) {
    rows.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
  }

  const sourceOrder = Array.from(groups.keys()).sort((a, b) => {
    const at = new Date(groups.get(a)?.[0]?.pubDate || 0).getTime();
    const bt = new Date(groups.get(b)?.[0]?.pubDate || 0).getTime();
    return bt - at;
  });
  const cursors = new Map(sourceOrder.map((source) => [source, 0]));
  const out = [];
  while (out.length < limit) {
    let added = false;
    for (const source of sourceOrder) {
      const rows = groups.get(source) || [];
      const index = cursors.get(source) || 0;
      if (index >= rows.length) continue;
      out.push(rows[index]);
      cursors.set(source, index + 1);
      added = true;
      if (out.length >= limit) break;
    }
    if (!added) break;
  }
  return out;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ items: [], error: "method_not_allowed" });
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=900");

  try {
    const [espn, ...rss] = await Promise.all([
      fetchJson(ESPN_NEWS).then((j) => (Array.isArray(j?.articles) ? j.articles.map(espnArticle) : [])).catch(() => []),
      ...RSS_FEEDS.map(fetchRss),
    ]);
    const merged = dedupe([...espn, ...rss.flat()])
      .filter((x) => x.title && x.link);
    const items = balanceSources(merged, 30);
    return res.status(200).json({
      items,
      sources: ["ESPN public news JSON", "CBS Sports RSS", "Yahoo Sports RSS", "RotoWire RSS", "SB Nation RSS"],
      keyRequired: false,
      balanced: true,
    });
  } catch (err) {
    return res.status(200).json({ items: [], error: "news_unavailable", detail: err?.message || String(err), keyRequired: false });
  }
};
