import React from "react";
import { Box, Card, CardContent, Typography, Divider } from "@mui/material";

export default function About() {
  return (
    <Box sx={{ mx: "auto", width: "100%", maxWidth: 720, p: 2 }}>
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          {/* About Section */}
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            About PIVT
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            PIVT is an NBA calendar and matchup helper built for basketball fans.
            It provides a clean, mobile-friendly way to browse the NBA schedule,
            check recent team performance (last 10 games), and view simple
            win probability insights for upcoming matchups. The goal is to give
            fans an easy-to-use tool for following the season.
          </Typography>

          <Divider sx={{ my: 3 }} />

          {/* Privacy Section */}
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            Privacy Policy
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            The developer of PIVT does not collect, store, or share any personal
            user data. The app does not require user accounts and does not track
            individual usage.
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Any ads displayed within the app are served by third-party providers
            (such as Google AdSense). These providers may use cookies or similar
            technologies to deliver more relevant ads. PIVT itself does not
            distribute, sell, or share any private user information.
          </Typography>

          <Divider sx={{ my: 3 }} />

          {/* Model Edge Section */}
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            How “Model edge” Works
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            The “Model edge” is a light, explanatory estimate of the home team’s win
            probability based on recent form and simple context. It is not betting
            advice. At a high level, PIVT looks at:
          </Typography>

          <Box component="ul" sx={{ pl: 3, m: 0 }}>
            <Box component="li" sx={{ mb: 1.25 }}>
              <Typography variant="body1">
                <strong>Recent performance (Last 10):</strong> Each team’s last 10
                regular-season games are summarized (record and scoring margins). This
                gives a short-term form signal rather than season-long ratings.
              </Typography>
            </Box>
            <Box component="li" sx={{ mb: 1.25 }}>
              <Typography variant="body1">
                <strong>Rest & back-to-back:</strong> The model accounts for days of
                rest before the game and applies a small penalty for back-to-backs.
              </Typography>
            </Box>
            <Box component="li" sx={{ mb: 1.25 }}>
              <Typography variant="body1">
                <strong>Home court:</strong> A modest home-court boost is applied
                (neutral site assumed false).
              </Typography>
            </Box>
            <Box component="li" sx={{ mb: 1.25 }}>
              <Typography variant="body1">
                <strong>Simple combination:</strong> These signals are combined into a
                single score and passed through a logistic curve to produce a home-win
                probability (shown as a percentage).
              </Typography>
            </Box>
          </Box>

          <Typography variant="body2" sx={{ mt: 2, opacity: 0.8 }}>
            Notes: The estimate is intentionally simple and driven by recent data; it does
            not include injuries, travel, rotations, or betting market inputs. “Model edge”
            is for fan context only.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
