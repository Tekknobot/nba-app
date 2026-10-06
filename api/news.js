const { XMLParser } = require("fast-xml-parser");
const he = require("he");

const ESPN_NEWS = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=24";
const RSS_FEEDS = [
  { source: "ESPN", url: "https://www.espn.com/espn/rss/nba/news" },
  { source: "CBS Sports", url: "https://www.cbssports.com/rss/headlines/nba/" },
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

function dedupe(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item.link || item.title).replace(/[?#].*$/, "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ items: [], error: "method_not_allowed" });
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=900");

  try {
    const [espn, ...rss] = await Promise.all([
      fetchJson(ESPN_NEWS).then((j) => (Array.isArray(j?.articles) ? j.articles.map(espnArticle) : [])).catch(() => []),
      ...RSS_FEEDS.map(fetchRss),
    ]);
    const items = dedupe([...espn, ...rss.flat()])
      .filter((x) => x.title && x.link)
      .sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0))
      .slice(0, 30);
    return res.status(200).json({ items, sources: ["ESPN public news JSON", "ESPN RSS", "CBS Sports RSS"], keyRequired: false });
  } catch (err) {
    return res.status(200).json({ items: [], error: "news_unavailable", detail: err?.message || String(err), keyRequired: false });
  }
};
