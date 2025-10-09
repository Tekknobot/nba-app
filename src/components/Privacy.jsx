import React from "react";
import { Box, Card, CardContent, Typography, Divider, Link } from "@mui/material";

export default function Privacy() {
  return (
    <Box sx={{ mx: "auto", width: "100%", maxWidth: 800, p: 2 }}>
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
            Privacy Policy
          </Typography>

          <Typography variant="body2" sx={{ mb: 2, opacity: 0.8 }}>
            Last updated: {new Date().toISOString().slice(0,10)}
          </Typography>

          <Typography variant="body1" sx={{ mb: 2 }}>
            PIVT does not collect, store, or sell personal information. We don’t run accounts or track individual usage.
          </Typography>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Cookies & Storage</Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            PIVT does not use advertising cookies or third-party trackers. We do not run ads.
            Your browser may perform standard caching to improve performance; PIVT does not use this to identify you.
          </Typography>

          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Contact</Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Questions? See our <Link href="/contact">Contact</Link> page.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
