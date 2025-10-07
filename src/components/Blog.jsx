import React from "react";
import { Box, Card, CardContent, Typography, Divider } from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AdUnit from "./AdUnit";

export default function Blog() {
  const [text, setText] = React.useState("");
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    fetch(`/blog/${today}.md`, { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : null))
      .then((txt) => {
        if (!txt) {
          setText(`# NBA Daily Pulse\nNo post generated yet for ${today}.`);
        } else {
          setText(txt);
        }
      })
      .catch(() => setText("# NBA Daily Pulse\nUnable to load post."))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <Box sx={{ mx: "auto", width: "100%", maxWidth: 860, p: 2 }}>
      <Card
        variant="outlined"
        sx={{
          borderRadius: 2,
          overflow: "hidden",
          bgcolor: "background.paper",
          boxShadow: 2,
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 4 } }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
            Blog
          </Typography>
          <Divider sx={{ mb: 3 }} />

          {/* top ad placement */}
          <AdUnit slot="blog-top-slot" />

          {!loaded ? (
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
              Loading daily post…
            </Typography>
          ) : (
            <Box
              className="blog-markdown"
              sx={{
                "& h1": { fontSize: "1.8rem", fontWeight: 700, mt: 3, mb: 1 },
                "& h2": { fontSize: "1.3rem", fontWeight: 600, mt: 3, mb: 1 },
                "& p": { mb: 1.5, lineHeight: 1.7 },
                "& em": { opacity: 0.9 },
                "& ul": { pl: 3, mb: 2 },
                "& li": { mb: 0.5 },
                "& hr": { my: 3, opacity: 0.2 },
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {text}
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
