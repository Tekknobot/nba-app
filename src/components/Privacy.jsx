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
          <Typography variant="body1" sx={{ mb: 2 }}>
            Ads on PIVT are provided by third parties (e.g., Google AdSense) which may use cookies or local storage to
            personalize or measure ads. Learn more and control your choices in the consent banner.
          </Typography>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Cookies & Ads</Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            We use Google services that may set cookies or similar identifiers. You can grant or deny consent for ad
            personalization and measurement. Non-personalized ads may still appear.
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
