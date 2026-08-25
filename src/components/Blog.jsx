import React from "react";
import { Box, Card, CardContent, Chip, CircularProgress, Divider, Stack, Typography } from "@mui/material";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function stripFrontMatter(md) {
  return md.replace(/^---\s*[\s\S]*?---\s*/, "");
}
function extractTitle(md) {
  const m = md.match(/^\s*#\s+(.+)\s*$/m);
  return m ? m[1].trim() : null;
}
function removeFirstH1(md) {
  return md.replace(/^\s*#\s+.+\s*$/m, "").trimStart();
}
function localISODate(tz = "America/Toronto", d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export default function Blog() {
  const [raw, setRaw] = React.useState("");
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    const today = localISODate("America/Toronto");
    fetch(`/blog/${today}.md`, { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : null))
      .then((txt) => {
        if (!txt || /^\s*<!doctype/i.test(txt)) setRaw(`# NBA Daily Pulse — ${today}\nNo post generated yet for ${today}.`);
        else setRaw(txt);
      })
      .catch(() => setRaw(`# NBA Daily Pulse — ${today}\nUnable to load post.`))
      .finally(() => setLoaded(true));
  }, []);

  const withoutFM = stripFrontMatter(raw || "");
  const title = extractTitle(withoutFM) || "NBA Daily Pulse";
  const bodyMd = removeFirstH1(withoutFM);

  return (
    <Box sx={{ mx: "auto", width: "100%", maxWidth: 1100, px: { xs: 1.25, sm: 2.5 }, py: { xs: 1.5, sm: 3 } }}>
      <Card className="pivt-hero" variant="outlined" sx={{ borderRadius: 0, mb: 1.5 }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Chip icon={<ArticleOutlinedIcon />} label="Daily notebook" size="small" variant="outlined" />
          </Stack>
          <Typography sx={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: { xs: 39, sm: 54 }, lineHeight: 0.98, letterSpacing: 1 }}>
            {title}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 1, maxWidth: 720 }}>
            A compact daily read built from PIVT’s public schedule, results, form context and league-news feed.
          </Typography>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 0}}>
        <CardContent sx={{ p: { xs: 2, sm: 3.5 } }}>
          {!loaded ? (
            <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress size={22} /></Stack>
          ) : (
            <>
              <Divider sx={{ mb: 2.5 }} />
              <Box sx={{
                "& h2": { fontFamily: '"Bebas Neue", sans-serif', letterSpacing: 0.6, fontSize: { xs: "1.55rem", sm: "1.8rem" }, mt: 3.2, mb: 1 },
                "& p": { mb: 1.5, lineHeight: 1.75, color: "text.secondary" },
                "& ul": { pl: { xs: 2.2, sm: 3 }, mb: 2 },
                "& li": { mb: 0.65, lineHeight: 1.6 },
                "& strong": { color: "text.primary" },
              }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{bodyMd}</ReactMarkdown>
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
