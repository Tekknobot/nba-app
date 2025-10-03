// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Box } from "@mui/material";
import AllGamesCalendar from "./components/AllGamesCalendar";
import About from "./components/About";
import Contact from "./components/Contact";
import Header from "./components/Header";
import GamePage from "./components/GamePage";

export default function App(){
  return (
    <BrowserRouter>
      <Header />
      <Box sx={{ p:2 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/all" replace />} />
          <Route path="/all" element={<AllGamesCalendar />} />
          <Route path="/game/:id" element={<GamePage />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </Box>
    </BrowserRouter>
  );
}
