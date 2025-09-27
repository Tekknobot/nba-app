// --- Fast Refresh guard (prevents "_s is not a function" in dev) ---
if (typeof self !== "undefined") {
  self.$RefreshSig$ = self.$RefreshSig$ || (() => (type) => type);
  self.$RefreshReg$ = self.$RefreshReg$ || (() => {});
}

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ThemeProvider, createTheme, alpha } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

// Hardwood palette
const WOOD_LIGHT = "#E7CFA5";
const WOOD_MED   = "#D5B47A";
const WOOD_DARK  = "#B68B4C";
const PAPER      = "#1A1410";   // card/well background
const LINES      = "#7A5A2E";   // court lines
const PAINT_BG   = "#2E3A8C";   // lane/CTA accent
const ACCENT_RED = "#C9082A";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary:   { main: PAINT_BG },
    secondary: { main: ACCENT_RED },
    background: { default: WOOD_MED, paper: PAPER },
    divider: "rgba(0,0,0,0.28)",
    text: { primary: "rgba(255,255,255,0.95)", secondary: "rgba(255,255,255,0.7)" },
    action: {
      hover: alpha("#000", 0.06),
      selected: alpha(PAINT_BG, 0.16),
      focus: alpha(ACCENT_RED, 0.18),
      disabledOpacity: 0.38,
    },
  },
  shape: { borderRadius: 12 },
  typography: {
    h1: { fontFamily: '"Bebas Neue", sans-serif', letterSpacing: 1, fontWeight: 400 },
    h2: { fontFamily: '"Bebas Neue", sans-serif', letterSpacing: 1, fontWeight: 400 },
    h3: { fontFamily: '"Bebas Neue", sans-serif', letterSpacing: 0.8, fontWeight: 400 },
    h4: { fontFamily: '"Bebas Neue", sans-serif', letterSpacing: 0.6, fontWeight: 400 },
    h5: { fontFamily: '"Bebas Neue", sans-serif', letterSpacing: 0.5, fontWeight: 400 },
    h6: { fontFamily: '"Bebas Neue", sans-serif', letterSpacing: 0.5, fontWeight: 400 },
    subtitle1: { fontWeight: 700 },
    subtitle2: { fontWeight: 700 },
    button: { fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase" },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          // parquet + lines + center circle
          backgroundImage: `
            repeating-linear-gradient(45deg, ${WOOD_LIGHT} 0 24px, ${WOOD_MED} 24px 48px),
            repeating-linear-gradient(-45deg, ${alpha(WOOD_DARK,0.14)} 0 2px, transparent 2px 48px),
            radial-gradient(circle at 50% 50%, transparent 0 108px, ${alpha(LINES,0.55)} 109px 111px, transparent 112px),
            linear-gradient(transparent 0 calc(50% - 2px), ${alpha(LINES,0.55)} calc(50% - 2px) calc(50% + 2px), transparent calc(50% + 2px))
          `,
          backgroundSize: "auto, auto, 100% 100%, 100% 100%",
          boxShadow: `inset 0 0 300px ${alpha("#000", 0.35)}`,
        },
        "*::-webkit-scrollbar": { height: 8, width: 8 },
        "*::-webkit-scrollbar-thumb": { backgroundColor: alpha("#000", 0.22), borderRadius: 8 },
        "*::-webkit-scrollbar-thumb:hover": { backgroundColor: alpha("#000", 0.32) },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          background: `linear-gradient(180deg, ${alpha("#000",0.5)}, ${alpha("#000",0.65)})`,
          border: `1px solid ${alpha("#000", 0.35)}`,
          boxShadow: `0 10px 26px ${alpha("#000", 0.45)}`,
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 12,
          paddingInline: 16,
          "&:hover": { boxShadow: `0 0 0 2px ${alpha("#fff", 0.08)} inset` },
        },
        containedPrimary: {
          background: `linear-gradient(180deg, ${PAINT_BG}, ${alpha(PAINT_BG,0.92)})`,
        },
        containedSecondary: {
          background: `linear-gradient(180deg, ${ACCENT_RED}, ${alpha(ACCENT_RED,0.92)})`,
        },
        outlined: {
          borderColor: alpha("#fff", 0.2),
          backgroundColor: alpha("#000", 0.12),
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 999, fontWeight: 800, letterSpacing: 0.3 },
        colorSuccess: { backgroundColor: alpha("#22c55e", 0.18) },
        colorError: { backgroundColor: alpha("#ef4444", 0.18) },
        outlined: { borderColor: alpha("#fff", 0.24), backgroundColor: alpha("#000", 0.12) },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: "transform 80ms ease, background-color 120ms ease",
          "&:hover": { backgroundColor: alpha(PAINT_BG, 0.12), transform: "translateY(-1px)" },
          "&.Mui-selected": {
            backgroundColor: alpha(ACCENT_RED, 0.16),
            "&:hover": { backgroundColor: alpha(ACCENT_RED, 0.2) },
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontWeight: 700,
          border: `1px solid ${alpha("#000", 0.35)}`,
          background: `linear-gradient(180deg, ${alpha("#000",0.85)}, ${alpha("#000",0.7)})`,
        },
      },
    },
    MuiLinearProgress: { styleOverrides: { bar: { boxShadow: `0 0 10px ${alpha(PAINT_BG, 0.45)}` } } },
    MuiDivider: { styleOverrides: { root: { borderColor: "rgba(0,0,0,0.34)" } } },
  },
});

const root = createRoot(document.getElementById("root"));
root.render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <App />
  </ThemeProvider>
);
