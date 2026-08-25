import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Box } from "@mui/material";
import AllGamesCalendar from "./components/AllGamesCalendar";
import Header from "./components/Header";
import GamePage from "./components/GamePage";
import Blog from "./components/Blog";
import { Analytics } from "@vercel/analytics/react";

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <Box component="main" sx={{ minHeight: "calc(100vh - 64px)" }}>
        <Routes>
          <Route path="/" element={<Navigate to="/all" replace />} />
          <Route path="/all" element={<AllGamesCalendar />} />
          <Route path="/game/:id" element={<GamePage />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="*" element={<Navigate to="/all" replace />} />
        </Routes>
      </Box>
      <Analytics />
    </BrowserRouter>
  );
}
