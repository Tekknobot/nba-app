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
            check recent team performance, and view simple win probability insights
            for upcoming matchups. The goal is to give fans an easy-to-use tool
            for following the season.
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

          {/* Model Edge Section (updated) */}
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            How “Model edge” Works
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            “Model edge” is a light, explanatory estimate of the home team’s win
            probability. It blends very recent form with a simple prior so it’s
            useful from opening night onward. It is not betting advice.
          </Typography>

          <Box component="ul" sx={{ pl: 3, m: 0 }}>
            <Box component="li" sx={{ mb: 1.25 }}>
              <Typography variant="body1">
                <strong>Recent form (rolling window):</strong> When regular-season games
                are available, PIVT summarizes each team’s most recent finals within a
                rolling window (up to the last 10 games, ~21 days). We track short-term
                performance (record and scoring margins) rather than season-long ratings.
              </Typography>
            </Box>

            <Box component="li" sx={{ mb: 1.25 }}>
              <Typography variant="body1">
                <strong>Prior baseline (fallback before data exists):</strong> If the
                season has just started or recent games are sparse, we use a prior based on
                last season’s average point differential (team strength), a modest home-court
                boost (~2.3 points), and a tiny preseason nudge if any recent exhibition
                finals exist. This prevents “no data” gaps early on.
              </Typography>
            </Box>

            <Box component="li" sx={{ mb: 1.25 }}>
              <Typography variant="body1">
                <strong>Smooth blend (recent ↔ prior):</strong> As the window fills, we
                blend recent form with the prior on <em>log-odds</em> (calibrated) based on
                how many recent finals each team has (0 → prior only, up to 10 → recent-heavy).
                This avoids overreacting on tiny samples and gradually shifts to current form.
              </Typography>
            </Box>

            <Box component="li" sx={{ mb: 1.25 }}>
              <Typography variant="body1">
                <strong>Rest & back-to-back:</strong> The estimate includes days of rest
                before the game and applies a small penalty for back-to-backs to reflect
                typical fatigue effects.
              </Typography>
            </Box>

            <Box component="li" sx={{ mb: 1.25 }}>
              <Typography variant="body1">
                <strong>Home court:</strong> We apply a modest home-court advantage.
                Neutral site is assumed false.
              </Typography>
            </Box>

            <Box component="li" sx={{ mb: 1.25 }}>
              <Typography variant="body1">
                <strong>Logistic mapping:</strong> The combined signal is passed through
                a logistic curve to produce a home-win probability (shown as a percentage).
              </Typography>
            </Box>

            <Box component="li" sx={{ mb: 1.25 }}>
              <Typography variant="body1">
                <strong>Transparency in the UI:</strong> The drawer labels which source
                powered the estimate—“recent form”, “prior model”, or “blended”—and the
                “Top players” panel indicates “last 21 days” or “season averages (fallback)”
                when recent player box scores aren’t available for your API tier.
              </Typography>
            </Box>
          </Box>

          <Typography variant="body2" sx={{ mt: 2, opacity: 0.8 }}>
            Notes: The estimate is intentionally simple and driven by short-term data; it
            does not include injuries, travel details, rotations, or betting market inputs.
            “Model edge” is provided for fan context only.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
