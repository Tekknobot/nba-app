if (typeof self !== "undefined") {
  self.$RefreshSig$ = self.$RefreshSig$ || (() => (type) => type);
  self.$RefreshReg$ = self.$RefreshReg$ || (() => {});
}

import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider, createTheme, alpha } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import "@fontsource/bebas-neue";
import App from "./App";
import "./index.css";

const BLUE = "#3B82F6";
const RED = "#F04464";
const BG = "#080D16";
const PAPER = "#101826";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: BLUE },
    secondary: { main: RED },
    background: { default: BG, paper: PAPER },
    divider: "rgba(255,255,255,0.10)",
    text: { primary: "#F6F8FC", secondary: "rgba(224,231,242,0.70)" },
    success: { main: "#43C59E" },
    warning: { main: "#F5B942" },
    error: { main: "#F04464" },
    action: {
      hover: alpha("#ffffff", 0.065),
      selected: alpha(BLUE, 0.18),
      focus: alpha(BLUE, 0.25),
      disabledOpacity: 0.4,
    },
  },
  shape: { borderRadius: 0},
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h4: { fontFamily: '"Bebas Neue", sans-serif', letterSpacing: 0.9 },
    h5: { fontFamily: '"Bebas Neue", sans-serif', letterSpacing: 0.8, fontSize: "1.8rem" },
    h6: { fontFamily: '"Bebas Neue", sans-serif', letterSpacing: 0.8, fontSize: "1.4rem" },
    subtitle1: { fontWeight: 800 },
    subtitle2: { fontWeight: 800 },
    button: { fontWeight: 850, letterSpacing: 0.2, textTransform: "none" },
    overline: { fontWeight: 900, fontSize: "0.66rem", lineHeight: 1.5 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: BG },
        "*::selection": { backgroundColor: alpha(BLUE, 0.38) },
        "*::-webkit-scrollbar": { height: 8, width: 8 },
        "*::-webkit-scrollbar-thumb": { backgroundColor: "rgba(255,255,255,.18)", borderRadius: 0},
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: PAPER,
          backgroundImage: "linear-gradient(180deg, rgba(255,255,255,.018), rgba(255,255,255,0))",
          borderColor: "rgba(255,255,255,.10)",
          boxShadow: "0 18px 45px rgba(0,0,0,.18)",
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 0},
        containedPrimary: { background: `linear-gradient(135deg, ${BLUE}, #2563EB)` },
        outlined: { borderColor: "rgba(255,255,255,.16)", backgroundColor: "rgba(255,255,255,.025)" },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { borderRadius: 0, border: "1px solid rgba(255,255,255,.08)" } },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 0, fontWeight: 800 },
        outlined: { borderColor: "rgba(255,255,255,.15)", backgroundColor: "rgba(255,255,255,.025)" },
      },
    },
    MuiDrawer: { styleOverrides: { paper: { backgroundColor: "#0C1320" } } },
    MuiDivider: { styleOverrides: { root: { borderColor: "rgba(255,255,255,.09)" } } },
  },
});

createRoot(document.getElementById("root")).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <App />
  </ThemeProvider>
);
