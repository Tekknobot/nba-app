import React, { useEffect, useState } from "react";
import {
  Box, Card, CardContent, Chip, CircularProgress, Divider, Link, Stack, Typography
} from "@mui/material";
import ArrowOutwardRoundedIcon from "@mui/icons-material/ArrowOutwardRounded";
import ImageNotSupportedOutlinedIcon from "@mui/icons-material/ImageNotSupportedOutlined";
import { API_BASE } from "../api/base";

function timeAgo(ts) {
  const t = ts ? new Date(ts).getTime() : 0;
  if (!t) return "";
  const diff = Math.max(0, Date.now() - t);
  const mins = Math.max(1, Math.round(diff / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function StoryImage({ item }) {
  if (!item?.image) {
    return (
      <Box className="news-image-fallback">
        <ImageNotSupportedOutlinedIcon sx={{ fontSize: 20, opacity: 0.55 }} />
      </Box>
    );
  }
  return (
    <Box
      component="img"
      src={item.image}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={(e) => {
        e.currentTarget.style.visibility = "hidden";
      }}
      sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
    />
  );
}

export default function NbaNews({ compact = false }) {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/news`, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        const arr = Array.isArray(json?.items) ? [...json.items] : [];
        arr.sort((a, b) => {
          if (a.isInjury !== b.isInjury) return a.isInjury ? -1 : 1;
          return new Date(b.pubDate || 0) - new Date(a.pubDate || 0);
        });
        if (!cancel) setItems(arr);
      } catch (e) {
        if (!cancel) setErr(e?.message || String(e));
      }
    })();
    return () => { cancel = true; };
  }, []);

  const shown = (items || []).slice(0, compact ? 7 : 12);

  return (
    <Card variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
      <CardContent sx={{ p: { xs: 1.6, sm: 2 }, "&:last-child": { pb: { xs: 1.6, sm: 2 } } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
          <Box>
            <Typography variant="overline" sx={{ color: "text.secondary", letterSpacing: 1.2 }}>AROUND THE LEAGUE</Typography>
            <Typography variant="h6" sx={{ mt: -0.4 }}>NBA NEWS</Typography>
          </Box>
          <Chip size="small" variant="outlined" label="ESPN · Yahoo · CBS" />
        </Stack>
        <Divider sx={{ mb: 1.25 }} />

        {err && <Typography variant="body2" color="warning.main">News feed unavailable: {err}</Typography>}
        {!items && !err && (
          <Stack alignItems="center" sx={{ py: 3 }}><CircularProgress size={20} /></Stack>
        )}
        {items && !shown.length && (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>No stories available right now.</Typography>
        )}

        <Stack spacing={0.65}>
          {shown.map((it, i) => (
            <Link
              key={`${it.link}-${i}`}
              href={it.link}
              target="_blank"
              rel="noopener noreferrer"
              underline="none"
              color="inherit"
              sx={{ borderRadius: 2.2, p: 0.7, mx: -0.7, "&:hover": { bgcolor: "action.hover" } }}
            >
              <Box sx={{ display: "grid", gridTemplateColumns: compact ? "76px minmax(0,1fr)" : { xs: "84px minmax(0,1fr)", sm: "112px minmax(0,1fr)" }, gap: 1.1, alignItems: "center" }}>
                <Box sx={{ height: compact ? 58 : { xs: 64, sm: 76 }, borderRadius: 1.8, overflow: "hidden", bgcolor: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}>
                  <StoryImage item={it} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 850,
                      lineHeight: 1.22,
                      display: "-webkit-box",
                      WebkitLineClamp: compact ? 2 : 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {it.title}
                  </Typography>
                  <Stack direction="row" spacing={0.7} alignItems="center" sx={{ mt: 0.65, minWidth: 0 }}>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>{it.source}</Typography>
                    {it.isInjury && <Chip size="small" label="Injury" color="error" sx={{ height: 18, "& .MuiChip-label": { px: 0.7, fontSize: 10 } }} />}
                    <Typography variant="caption" sx={{ color: "text.disabled" }}>{timeAgo(it.pubDate)}</Typography>
                    <ArrowOutwardRoundedIcon sx={{ fontSize: 14, ml: "auto !important", color: "text.disabled" }} />
                  </Stack>
                </Box>
              </Box>
            </Link>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
