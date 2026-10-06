import React from "react";
import { Box, CircularProgress, Divider, Stack, Typography } from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function stripFrontMatter(md) { return md.replace(/^---\s*[\s\S]*?---\s*/, ""); }
function extractTitle(md) { return md.match(/^\s*#\s+(.+)\s*$/m)?.[1]?.trim() || "NBA Daily Pulse"; }
function removeFirstH1(md) { return md.replace(/^\s*#\s+.+\s*$/m, "").trimStart(); }
function localISODate(tz = "America/Toronto", d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export default function Blog() {
  const [raw, setRaw] = React.useState("");
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    const today = localISODate();
    fetch(`/blog/${today}.md`, { cache: "no-store" })
      .then((r) => r.ok ? r.text() : null)
      .then((txt) => setRaw(!txt || /^\s*<!doctype/i.test(txt) ? `# NBA Daily Pulse — ${today}\nNo post generated yet for ${today}.` : txt))
      .catch(() => setRaw(`# NBA Daily Pulse — ${today}\nUnable to load post.`))
      .finally(() => setLoaded(true));
  }, []);

  const clean = stripFrontMatter(raw || "");
  const title = extractTitle(clean);
  const body = removeFirstH1(clean);

  return (
    <Box sx={{ maxWidth: 820, mx: "auto", px: { xs: 1.5, sm: 3 }, py: { xs: 2.5, sm: 4 } }}>
      <Typography variant="overline" color="text.secondary">Notes</Typography>
      <Typography component="h1" variant="h4" sx={{ mt: .4 }}>{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Daily schedule context generated from PIVT's public data sources.</Typography>
      <Divider sx={{ my: 3 }} />
      {!loaded ? <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress size={20} /></Stack> : (
        <Box sx={{ "& h2": { fontSize: "1rem", mt: 3, mb: 1, textTransform: "uppercase", letterSpacing: ".08em" }, "& p": { color: "text.secondary", lineHeight: 1.7 }, "& li": { color: "text.secondary", mb: .7 }, "& strong": { color: "text.primary" } }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
        </Box>
      )}
    </Box>
  );
}
