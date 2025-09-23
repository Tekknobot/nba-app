import React, { useEffect, useState } from "react";
import { Card, CardContent, Typography, List, ListItem, ListItemText, Chip, Stack, Link, Divider } from "@mui/material";

// --- DROP-IN IMPORT (top of src/components/NbaNews.jsx) ---
import { API_BASE } from "../api/base";

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
        // Injuries first, then recency
        itemsArr.sort((a, b) => {
        if (a.isInjury !== b.isInjury) return a.isInjury ? -1 : 1;
        return new Date(b.pubDate || 0) - new Date(a.pubDate || 0);
        });
        if (!cancel) setItems(itemsArr);

        if (!cancel) setItems(Array.isArray(json?.items) ? json.items : []);
      } catch (e) {
        if (!cancel) setErr(e?.message || String(e));
      }
    })();
    return () => { cancel = true; };
  }, []);

  return (
    <Card variant="outlined" sx={{ borderRadius: 1, mt: 2 }}>
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            NBA News (ESPN · Yahoo · CBS)
          </Typography>
        </Stack>
        <Divider sx={{ mb: 1 }} />

        {err && <Typography variant="body2" color="warning.main">Failed to load news: {err}</Typography>}
        {!items && !err && <Typography variant="body2" sx={{ opacity: 0.7 }}>Loading…</Typography>}

        {items && (
          <List dense disablePadding>
            {items.map((it, i) => (
              <ListItem key={i} disableGutters sx={{ py: 0.5 }}>
                <ListItemText
                  primaryTypographyProps={{ variant: "body2" }}
                  secondaryTypographyProps={{ variant: "caption" }}
                  primary={
                    <Link href={it.link} target="_blank" rel="noopener noreferrer" underline="hover">
                      {it.title}
                    </Link>
                  }
                    secondary={
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25, flexWrap: 'wrap' }}>
                        <Chip size="small" variant="outlined" label={it.source} />
                        {it.isInjury && (
                        <Chip
                            size="small"
                            label="Injury"
                            color="error"
                            variant="filled"
                            sx={{ ml: 0.5 }}
                        />
                        )}
                        <Typography variant="caption" sx={{ opacity: 0.7 }}>{timeAgo(it.pubDate)}</Typography>
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
