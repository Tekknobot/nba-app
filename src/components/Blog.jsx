// src/components/Blog.jsx
import React from "react";
import { Box, Card, CardContent, Typography, Divider, LinearProgress, Stack } from "@mui/material";
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

/** Read the plain text of a markdown node's children */
function nodeText(children) {
  if (Array.isArray(children)) return children.map(nodeText).join("");
  if (typeof children === "string") return children;
  if (children && typeof children === "object" && "props" in children) {
    return nodeText(children.props.children);
  }
  return "";
}
function extractPercent(s) {
  const m = s.match(/~?\s*(\d{1,3})%\s*\)/);
  if (!m) return null;
  const val = Math.max(0, Math.min(100, parseInt(m[1], 10)));
  return Number.isFinite(val) ? val : null;
}
function extractLeftLabel(line) {
  const bold = line.match(/\*\*(.+?)\*\*/);
  if (bold) return bold[1];
  const dash = line.split("—")[0]?.trim();
  return dash && dash.length <= 48 ? dash : "Edge";
}
function extractRightLabel(line) {
  const dot = line.split("·")[1]?.trim();
  return dot || null;
}

function MdListItem(props) {
  const txt = nodeText(props.children) || "";
  const pct = extractPercent(txt);
  if (pct == null) return <li {...props} />;

  const left = extractLeftLabel(txt);
  const right = extractRightLabel(txt);

  return (
    <li style={{ paddingTop: 8, paddingBottom: 8 }}>
      <div>{props.children}</div>
      <Stack spacing={0.5} sx={{ mt: 0.75 }}>
        <Stack direction="row" justifyContent="space-between" sx={{ fontSize: 12, opacity: 0.8 }}>
          <span>{left}</span>
          <span>{right ? right : `${pct}%`}</span>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{ height: 8, borderRadius: 999, "& .MuiLinearProgress-bar": { borderRadius: 999 } }}
          aria-label={`Edge ${pct}%`}
        />
      </Stack>
    </li>
  );
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
            Updated daily · Original summaries based on the app’s calendar, matchup helper, and Model edge.
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
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ li: MdListItem }}>
                {bodyMd}
              </ReactMarkdown>
            </Box>
          )}

        </CardContent>
      </Card>
    </Box>
  );
}
