// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Box } from "@mui/material";
import AllGamesCalendar from "./components/AllGamesCalendar";

export default function App(){
  return (
    <BrowserRouter>
      <Box sx={{ p:2 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/all" replace />} />
          <Route path="/all" element={<AllGamesCalendar />} />
        </Routes>
      </Box>
    </BrowserRouter>
  );
}
