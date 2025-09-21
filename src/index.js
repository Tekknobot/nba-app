import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
const theme = createTheme({ palette:{ mode:"dark", primary:{ main:"#90caf9"}, secondary:{ main:"#f48fb1"}, background:{ default:"#0b0f14", paper:"#11161d"}, divider:"rgba(255,255,255,0.12)" }, shape:{ borderRadius:12 }});
const root = createRoot(document.getElementById("root"));
root.render(<ThemeProvider theme={theme}><CssBaseline /><App /></ThemeProvider>);
