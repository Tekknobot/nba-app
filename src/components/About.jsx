// src/components/About.jsx
import React from "react";
import { Box, Card, CardContent, Typography, Divider, Button } from "@mui/material";

export default function About() {
  return (
    <Box sx={{ mx: "auto", width: "100%", maxWidth: 720, p: 2 }}>
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            About PIVT
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            PIVT is a clean, mobile-first NBA calendar and matchup helper. Browse schedules,
            recent team form, season-series history, final scores, and compact player stat snapshots.
          </Typography>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            Data & Tech
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            PIVT now uses a small server-side data adapter built into the project. It reads public,
            keyless NBA data sources and converts them into one stable shape for the calendar and
            matchup drawer, so visitors do not need an account, API key, or login.
          </Typography>
          <Box component="ul" sx={{ pl: 3, m: 0 }}>
            <Box component="li" sx={{ mb: 1.25 }}>
              <Typography variant="body1"><strong>Calendar:</strong> monthly NBA schedules, game state, and scores.</Typography>
            </Box>
            <Box component="li" sx={{ mb: 1.25 }}>
              <Typography variant="body1"><strong>Recent form:</strong> each team’s last 10 completed regular-season games up to the selected matchup date.</Typography>
            </Box>
            <Box component="li" sx={{ mb: 1.25 }}>
              <Typography variant="body1"><strong>Season series:</strong> completed head-to-head meetings for the selected season.</Typography>
            </Box>
            <Box component="li" sx={{ mb: 1.25 }}>
              <Typography variant="body1"><strong>Player snapshots:</strong> recent box-score averages when available, with a season-stat fallback.</Typography>
            </Box>
          </Box>

          <Typography variant="body2" sx={{ mt: 2, opacity: 0.8 }}>
            Public sports endpoints can occasionally change or be temporarily unavailable, so PIVT
            caches responses and shows a clear error instead of requiring a paid data account.
          </Typography>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            Privacy Policy
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            The developer of PIVT does not collect, store, or share personal user data. The app has
            no user accounts and does not require visitors to sign in to view basketball data.
          </Typography>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            Accuracy & Availability
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Scores, schedules, and statistics may be delayed, corrected, incomplete, or temporarily
            unavailable when an upstream public feed changes. PIVT presents the data for general
            basketball information and does not guarantee uninterrupted availability.
          </Typography>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            Support
          </Typography>
          <Typography variant="body1" sx={{ mb: 2, opacity: 0.9 }}>
            PIVT is free to use. If you enjoy the project and want to support its hosting and development,
            you can support the developer here:
          </Typography>

          <Button
            href="https://www.buymeacoffee.com/pizzzamoney"
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              backgroundColor: "#FFDD00",
              color: "#000",
              fontWeight: 700,
              textTransform: "none",
              "&:hover": { backgroundColor: "#f1cf00" },
            }}
          >
            Support PIVT
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
