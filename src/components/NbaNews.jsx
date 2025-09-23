import React, { useEffect, useState } from "react";
import { Card, CardContent, Typography, List, ListItem, ListItemText, Chip, Stack, Link, Divider } from "@mui/material";

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
        const r = await fetch("/api/news", { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
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
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
                      <Chip size="small" variant="outlined" label={it.source} />
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
