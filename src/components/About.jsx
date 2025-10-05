// src/components/About.jsx
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
            PIVT is an NBA calendar and matchup helper. It gives a clean, mobile-first
            way to browse the schedule, scan recent team form, and see a light, fan-oriented
            “Model edge” estimate for upcoming games. It’s for context, not betting advice.
          </Typography>

          <Divider sx={{ my: 3 }} />

          {/* Privacy Section */}
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            Privacy Policy
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            The developer of PIVT does not collect, store, or share any personal user data.
            The app has no accounts and does not track individual usage.
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Any ads are served by third-party providers (e.g., Google AdSense). Those providers
            may use cookies or similar technologies to deliver more relevant ads. PIVT itself
            does not distribute, sell, or share private user information.
          </Typography>

          <Divider sx={{ my: 3 }} />

          {/* Model Edge Section (aligned with implementation) */}
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            How “Model edge” Works
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            “Model edge” is a simple, transparent estimate of the <em>home team’s</em> win
            probability. It combines a prior (from last season) with very recent form so it’s
            useful from opening night onward. It’s intentionally conservative and easy to read.
          </Typography>

          <Box component="ul" sx={{ pl: 3, m: 0 }}>
            <Box component="li" sx={{ mb: 1.25 }}>
              <Typography variant="body1">
                <strong>Prior baseline:</strong> We start with last completed season’s average
                point differential for both teams (home minus away), add a modest home-court
                advantage (~2.3 points), and include a tiny preseason nudge (last 30 days, very
                small weight). This becomes a prior probability via a logistic mapping.
              </Typography>
            </Box>

            <Box component="li" sx={{ mb: 1.25 }}>
              <Typography variant="body1">
                <strong>Recent form (this season):</strong> When regular-season finals exist,
                we summarize each team’s last 10 results up to the game date and convert the
                win–loss difference (home minus away) into a recent-form probability. (H2H is
                shown in the UI for context but does not drive the probability.)
              </Typography>
            </Box>

            <Box component="li" sx={{ mb: 1.25 }}>
              <Typography variant="body1">
                <strong>Smooth blend on log-odds:</strong> We blend prior and recent on the
                logit scale. The recent weight (<code>α</code>) grows with the amount of
                current-season data for both teams: 0 games → 0%, 1 → 25%, 2 → 40%, 3 → 55%,
                4 → 70%, ≥5 → 80%. This avoids overreacting to tiny samples and shifts toward
                current form as the season matures.
              </Typography>
            </Box>

            <Box component="li" sx={{ mb: 1.25 }}>
              <Typography variant="body1">
                <strong>Output & labels:</strong> The drawer shows the home win percent and a
                small bar. It also labels the source: <em>prior</em> (no current data yet),
                <em>recent</em> (plenty of current data), or <em>blend</em> (mix of both).
              </Typography>
            </Box>

            <Box component="li" sx={{ mb: 1.25 }}>
              <Typography variant="body1">
                <strong>Top players panel:</strong> We try to show 21-day rolling player
                averages from recent box scores. If your data tier blocks that endpoint,
                we fall back to season averages and label the panel accordingly.
              </Typography>
            </Box>

            <Box component="li" sx={{ mb: 1.25 }}>
              <Typography variant="body1">
                <strong>Verdict chip (finals only):</strong> After a game is Final, the chip
                indicates whether the model pick (or the blended edge when the model pick is
                absent) matched the actual result (✔/✖). If the month view lacks final scores,
                we fetch the single game once to fill them so the verdict can render.
              </Typography>
            </Box>
          </Box>

          <Typography variant="body2" sx={{ mt: 2, opacity: 0.8 }}>
            Notes: The estimate is deliberately lightweight. It does <em>not</em> include
            injuries, travel logistics, rotations, or betting markets. It’s for fan context
            and fun — not wagering.
          </Typography>

          <Divider sx={{ my: 3 }} />

          {/* Data Sources / Tech */}
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            Data & Tech
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Schedules, finals, and box scores are fetched from the public{" "}
            <strong>balldontlie</strong> API. Times shown in the calendar are normalized to
            avoid day slips across time zones where possible.
          </Typography>

          {/* Accuracy & Disclaimer */}
          <Divider sx={{ my: 3 }} />

          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            Accuracy & Disclaimer
          </Typography>

          <Typography variant="body1" sx={{ mb: 2 }}>
            PIVT provides win-probability estimates and matchup context for informational and
            entertainment purposes only. It is <strong>not</strong> betting advice, a prediction
            service, or a guarantee of outcomes.
          </Typography>

          <Box component="ul" sx={{ pl: 3, m: 0 }}>
            <Box component="li" sx={{ mb: 1.25 }}>
              <Typography variant="body1">
                <strong>Estimates, not promises:</strong> Numbers can be wrong. Data feed delays,
                missing box scores, and simplified assumptions all introduce error.
              </Typography>
            </Box>
            <Box component="li" sx={{ mb: 1.25 }}>
              <Typography variant="body1">
                <strong>Scope limits:</strong> The model is lightweight and does not account for
                injuries, rest, rotations, travel, or late news unless explicitly noted.
              </Typography>
            </Box>
            <Box component="li" sx={{ mb: 1.25 }}>
              <Typography variant="body1">
                <strong>No liability:</strong> The developer assumes no responsibility for decisions
                made using this site, including financial losses.
              </Typography>
            </Box>
            <Box component="li" sx={{ mb: 1.25 }}>
              <Typography variant="body1">
                <strong>No guarantees of accuracy or availability:</strong> Services may be interrupted
                or data may be incomplete, outdated, or incorrect.
              </Typography>
            </Box>
          </Box>

          <Typography variant="body2" sx={{ mt: 2, opacity: 0.85 }}>
            If you choose to wager, do so responsibly and only where legal. By using PIVT, you agree the
            information is provided “as is” without warranties and that you bear sole responsibility for
            how you use it. PIVT does not solicit, promote, or facilitate gambling.
          </Typography>
          
        </CardContent>
      </Card>
    </Box>
  );
}
