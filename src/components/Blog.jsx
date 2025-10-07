// src/components/Blog.jsx
import React from "react";
import { Box, Card, CardContent, Typography, Divider } from "@mui/material";
import AdUnit from "./AdUnit";

export default function Blog() {
  const [text, setText] = React.useState("");

  React.useEffect(() => {
    const today = new Date().toISOString().slice(0,10);
    fetch(`/blog/${today}.md`, { cache: "no-store" })
      .then(r => r.ok ? r.text() : "# NBA Daily Pulse\nPost for today not generated yet.")
      .then(setText)
      .catch(() => setText("# NBA Daily Pulse\nUnable to load post."));
  }, []);

  return (
    <Box sx={{ mx: "auto", width: "100%", maxWidth: 860, p: 2 }}>
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>Blog</Typography>
          <Divider sx={{ mb: 2 }} />

          {/* TOP blog ad placement */}
          <AdUnit slot="blog-top-slot" />

          {/* Blog post content */}
          <div style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{text}</div>

          {/* BOTTOM blog ad placement */}
          <AdUnit slot="blog-bottom-slot" />
        </CardContent>
      </Card>
    </Box>
  );
}
