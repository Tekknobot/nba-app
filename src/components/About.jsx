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
            win probability insights for upcoming matchups. 
            The goal is to give fans an easy-to-use tool for following the season.
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
          <Typography variant="body1">
            Any ads displayed within the app are served by third-party providers 
            (such as Google AdSense). These providers may use cookies or similar 
            technologies to deliver more relevant ads. PIVT itself does not 
            distribute, sell, or share any private user information.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
