import React, { useEffect, useState } from "react";
import { Box, CircularProgress, Link, Stack, Typography } from "@mui/material";
import { API_BASE } from "../api/base";

function timeAgo(ts) {
  const t = ts ? new Date(ts).getTime() : 0;
  if (!t) return "";
  const mins = Math.max(1, Math.round((Date.now() - t) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function Thumbnail({ item }) {
  const [failed, setFailed] = useState(false);
  if (!item?.image || failed) {
    return <Box sx={{ width: "100%", height: "100%", bgcolor: "#181818" }} />;
  }
  return (
    <Box
      component="img"
      src={item.image}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "saturate(.82) contrast(1.02)" }}
    />
  );
}

export default function NbaNews({ compact = false }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/news`, { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body?.detail || `HTTP ${r.status}`);
        return body;
      })
      .then((body) => { if (!cancelled) setItems(Array.isArray(body?.items) ? body.items : []); })
      .catch((e) => { if (!cancelled) setError(e?.message || String(e)); });
    return () => { cancelled = true; };
  }, []);

  const shown = (items || []).slice(0, compact ? 8 : 14);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1.4 }}>
        <Typography variant="overline" color="text.secondary">Latest</Typography>
        <Typography variant="caption" color="text.secondary">Free publisher feeds</Typography>
      </Stack>

      {!items && !error && <Stack alignItems="center" sx={{ py: 5 }}><CircularProgress size={18} /></Stack>}
      {error && <Typography variant="body2" color="text.secondary">News unavailable.</Typography>}
      {items && !shown.length && <Typography variant="body2" color="text.secondary">No current stories.</Typography>}

      <Stack divider={<Box sx={{ borderTop: "1px solid", borderColor: "divider" }} />}>
        {shown.map((item, index) => (
          <Link key={`${item.link}-${index}`} href={item.link} target="_blank" rel="noopener noreferrer" underline="none" color="inherit" sx={{ display: "block", py: 1.2, "&:hover .story-title": { color: "#fff" } }}>
            <Box sx={{ display: "grid", gridTemplateColumns: compact ? "92px minmax(0,1fr)" : { xs: "104px minmax(0,1fr)", sm: "132px minmax(0,1fr)" }, gap: 1.25, alignItems: "center" }}>
              <Box sx={{ aspectRatio: "16 / 10", overflow: "hidden", border: "1px solid", borderColor: "divider", bgcolor: "#171717" }}>
                <Thumbnail item={item} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography className="story-title" variant="body2" sx={{ fontWeight: 750, lineHeight: 1.28, color: "#dcdcdc", transition: "color 120ms ease", display: "-webkit-box", WebkitLineClamp: compact ? 3 : 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {item.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: .65 }}>
                  {item.source}{item.isInjury ? "  ·  INJURY" : ""}{item.pubDate ? `  ·  ${timeAgo(item.pubDate)}` : ""}
                </Typography>
              </Box>
            </Box>
          </Link>
        ))}
      </Stack>
    </Box>
  );
}
