// src/components/Blog.jsx
import React from "react";
import { Box, Card, CardContent, Typography, Divider, LinearProgress, Stack } from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AdUnit from "./AdUnit";

function stripFrontMatter(md) {
  // remove leading YAML block if present
  const fm = /^---\s*[\s\S]*?---\s*/;
  return md.replace(fm, "");
}

function extractTitle(md) {
  // get first H1 (# Title). If none, fallback to today's date.
  const m = md.match(/^\s*#\s+(.+)\s*$/m);
  return m ? m[1].trim() : null;
}

function removeFirstH1(md) {
  // remove first H1 so we can render it as a page header
  return md.replace(/^\s*#\s+.+\s*$/m, "").trimStart();
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

/** Try to extract a percentage like (~63%) or (63%) from a line of text */
function extractPercent(s) {
  const m = s.match(/~?\s*(\d{1,3})%\s*\)/); // matches (~63%) or (63%)
  if (!m) return null;
  const val = Math.max(0, Math.min(100, parseInt(m[1], 10)));
  return Number.isFinite(val) ? val : null;
}

/** Optional: extract a short left label (e.g., matchup) for the bar row */
function extractLeftLabel(line) {
  // if the line starts with a bold matchup like **PHX @ DEN**, keep that; else take up to the first "—"
  const bold = line.match(/\*\*(.+?)\*\*/);
  if (bold) return bold[1];
  const dash = line.split("—")[0]?.trim();
  return dash && dash.length <= 48 ? dash : "Edge";
}

/** Optional: a right label (e.g., time after · ) */
function extractRightLabel(line) {
  const dot = line.split("·")[1]?.trim();
  return dot || null;
}

/** Markdown <li> renderer with a % bar when it finds (~NN%) */
function MdListItem(props) {
  const txt = nodeText(props.children) || "";
  const pct = extractPercent(txt);

  if (pct == null) {
    // No percentage → render a normal list item
    return <li {...props} />;
  }

  const left = extractLeftLabel(txt);
  const right = extractRightLabel(txt);

  return (
    <li style={{ paddingTop: 8, paddingBottom: 8 }}>
      {/* original text as-is */}
      <div>{props.children}</div>

      {/* percent bar */}
      <Stack spacing={0.5} sx={{ mt: 0.75 }}>
        <Stack direction="row" justifyContent="space-between" sx={{ fontSize: 12, opacity: 0.8 }}>
          <span>{left}</span>
          <span>{right ? right : `${pct}%`}</span>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{
            height: 8,
            borderRadius: 999,
            "& .MuiLinearProgress-bar": { borderRadius: 999 },
          }}
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
    const today = new Date().toISOString().slice(0, 10);
    fetch(`/blog/${today}.md`, { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : null))
      .then((txt) => {
        if (!txt) {
          setRaw(`# NBA Daily Pulse — ${today}\nNo post generated yet for ${today}.`);
        } else {
          setRaw(txt);
        }
      })
      .catch(() => setRaw(`# NBA Daily Pulse — ${new Date().toISOString().slice(0,10)}\nUnable to load post.`))
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

          {/* top ad placement */}
          <AdUnit slot="blog-top-slot" />

          {!loaded ? (
            <Typography variant="body2" sx={{ opacity: 0.7 }}>Loading daily post…</Typography>
          ) : (
            <Box
              sx={{
                "& h2": { fontSize: "1.25rem", fontWeight: 700, mt: 3, mb: 1 },
                "& p": { mb: 1.5, lineHeight: 1.7 },
                "& ul": { pl: 3, mb: 2 },
                "& li": { mb: 0.5 },
                "& hr": { my: 3, opacity: 0.2 },
              }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  li: MdListItem, // <-- our enhanced list item with bar
                }}
              >
                {bodyMd}
              </ReactMarkdown>
            </Box>
          )}

          {/* bottom ad placement */}
          <AdUnit slot="blog-bottom-slot" />
        </CardContent>
      </Card>
    </Box>
  );
}
