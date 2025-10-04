// src/components/NbaNews.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Card, CardContent, Typography, List, ListItem, ListItemText,
  Chip, Stack, Link, Divider, Box, Skeleton
} from "@mui/material";
import { API_BASE } from "../api/base";

/* ---------- tiny utils ---------- */
function timeAgo(ts) {
  const t = ts ? new Date(ts).getTime() : 0;
  if (!t) return "";
  const diff = Math.max(0, Date.now() - t);
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}
const pickImageField = (it) =>
  it?.image || it?.imageUrl || it?.urlToImage || it?.thumbnail || it?.enclosure?.url || null;

/* ---------- lightweight preview cache (for og:image fallback) ---------- */
const previewCache = new Map(); // key: article url -> { image?, title?, site? }
async function fetchPreview(url) {
  if (!url) return null;
  if (previewCache.has(url)) return previewCache.get(url);
  try {
    const r = await fetch(`${API_BASE}/api/preview?url=${encodeURIComponent(url)}`, { cache: "no-store" });
    const j = await r.json();
    const out = j?.ok ? { image: j.image || null, title: j.title || null, site: j.site || null } : null;
    previewCache.set(url, out);
    return out;
  } catch { return null; }
}

/* ---------- Image-with-fallback component ---------- */
function NewsThumb({ item, sx = {} }) {
  const direct = pickImageField(item);
  const [img, setImg] = useState(direct || null);
  const [loading, setLoading] = useState(!direct);
  useEffect(() => {
    let stop = false;
    (async () => {
      if (direct || !item?.link) { setLoading(false); return; }
      setLoading(true);
      const prev = await fetchPreview(item.link);
      if (!stop) {
        setImg(prev?.image || null);
        setLoading(false);
      }
    })();
    return () => { stop = true; };
  }, [item?.link, direct]);

  // fixed aspect ratio to avoid CLS
  const wrapperSx = {
    width: { xs: 108, sm: 140 },            // ~16:9 thumb
    aspectRatio: '16 / 9',
    borderRadius: 1,
    overflow: 'hidden',
    bgcolor: 'action.hover',
    flexShrink: 0,
    ...sx,
  };

  if (loading) {
    return <Skeleton variant="rectangular" sx={wrapperSx} />;
  }
  if (!img) {
    // no image available → render a subtle placeholder box
    return <Box sx={{ ...wrapperSx, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled', fontSize: 12 }}>
      no image
    </Box>;
  }
  return (
    <Box sx={wrapperSx}>
      <img
        src={img}
        alt={item?.title || ""}
        loading="lazy"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </Box>
  );
}

/* ---------- Main component ---------- */
export default function NbaNews() {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/news`, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();

        const itemsArr = Array.isArray(json?.items) ? json.items : [];
        itemsArr.sort((a, b) => {
          if (a.isInjury !== b.isInjury) return a.isInjury ? -1 : 1; // injuries first
          return new Date(b.pubDate || 0) - new Date(a.pubDate || 0);
        });

        if (!cancel) setItems(itemsArr);
      } catch (e) {
        if (!cancel) setErr(e?.message || String(e));
      }
    })();
    return () => { cancel = true; };
  }, []);

  const header = useMemo(() => (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        NBA News (ESPN · Yahoo · CBS)
      </Typography>
    </Stack>
  ), []);

  return (
    <Card variant="outlined" sx={{ borderRadius: 1, mt: 2 }}>
      <CardContent sx={{ p: 2 }}>
        {header}
        <Divider sx={{ mb: 1 }} />

        {err && (
          <Typography variant="body2" color="warning.main">
            Failed to load news: {err}
          </Typography>
        )}
        {!items && !err && (
          <Typography variant="body2" sx={{ opacity: 0.7 }}>Loading…</Typography>
        )}

        {items && (
          <List dense disablePadding>
            {items.map((it, i) => (
              <ListItem
                key={i}
                disableGutters
                alignItems="flex-start"
                sx={{ py: 0.75 }}
                secondaryAction={null}
              >
                {/* Left: thumbnail */}
                <NewsThumb item={it} />

                {/* Right: text block */}
                <ListItemText
                  sx={{ ml: 1.25 }}
                  primary={
                    <Link
                      href={it.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      underline="hover"
                      sx={{
                        fontWeight: 800,
                        lineHeight: 1.15,
                        color: 'text.primary',
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {it.title}
                    </Link>
                  }
                  secondary={
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                      <Chip size="small" variant="outlined" label={it.source || 'Source'} />
                      {it.isInjury && (
                        <Chip size="small" label="Injury" color="error" variant="filled" sx={{ ml: 0.5 }} />
                      )}
                      <Typography variant="caption" sx={{ opacity: 0.75 }}>
                        {timeAgo(it.pubDate)}
                      </Typography>
                    </Stack>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}
