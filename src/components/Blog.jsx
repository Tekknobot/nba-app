// src/components/Blog.jsx
import React from "react";
import { Box, Card, CardContent, Typography, Divider } from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function stripFrontMatter(md) {
  const fm = /^---\s*[\s\S]*?---\s*/;
  return md.replace(fm, "");
}
function extractTitle(md) {
  const m = md.match(/^\s*#\s+(.+)\s*$/m);
  return m ? m[1].trim() : null;
}
function removeFirstH1(md) {
  return md.replace(/^\s*#\s+.+\s*$/m, "").trimStart();
}

/* NEW: local date helper (America/Toronto) */
function localISODate(tz = "America/Toronto", d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(d);
  const get = (t) => parts.find(p => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export default function Blog() {
  const [raw, setRaw] = React.useState("");
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    const today = localISODate("America/Toronto");            // NEW
    fetch(`/blog/${today}.md`, { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : null))
      .then((txt) => {
        // guard against SPA fallback HTML
        if (!txt || /^\s*<!doctype/i.test(txt)) {
          setRaw(`# NBA Daily Pulse — ${today}\nNo post generated yet for ${today}.`);
        } else {
          setRaw(txt);
        }
      })
      .catch(() => setRaw(`# NBA Daily Pulse — ${today}\nUnable to load post.`)) // NEW
      .finally(() => setLoaded(true));
  }, []);

  const withoutFM = stripFrontMatter(raw || "");
  const title = extractTitle(withoutFM) || "NBA Daily Pulse";
  const bodyMd = removeFirstH1(withoutFM);

  return (
    <Box sx={{ mx: "auto", width: "100%", maxWidth: 860, p: 2 }}>
      <Card variant="outlined" sx={{ borderRadius: 2, overflow: "hidden", bgcolor: "background.paper", boxShadow: 2 }}>
        <CardContent sx={{ p: { xs: 2, sm: 4 } }}>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>{title}</Typography>
          <Typography variant="caption" sx={{ opacity: 0.7, display: "block", mb: 2 }}>
            Updated daily · Original summaries based on the app’s calendar, matchup context, and recent form.
          </Typography>
          <Divider sx={{ mb: 3 }} />

          {!loaded ? (
            <Typography variant="body2" sx={{ opacity: 0.7 }}>Loading daily post…</Typography>
          ) : (
            <Box sx={{ "& h2": { fontSize: "1.25rem", fontWeight: 700, mt: 3, mb: 1 },
                       "& p": { mb: 1.5, lineHeight: 1.7 },
                       "& ul": { pl: 3, mb: 2 },
                       "& li": { mb: 0.5 },
                       "& hr": { my: 3, opacity: 0.2 } }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} >
                {bodyMd}
              </ReactMarkdown>
            </Box>
          )}

        </CardContent>
      </Card>
    </Box>
  );
}
