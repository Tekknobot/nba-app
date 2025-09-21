import React from "react";
import { Container, Paper, Typography } from "@mui/material";
import TeamPicker from "./components/TeamPicker";
import GameCalendar from "./components/GameCalendar";

export default function App() {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h5" gutterBottom>
          NBA — Games Calendar (Team View)
        </Typography>
        <TeamPicker />
      </Paper>

      {/* Calendar listens to "team:change" and shows ONLY that team's upcoming games */}
      <GameCalendar />
    </Container>
  );
}
