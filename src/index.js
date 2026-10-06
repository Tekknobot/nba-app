if (typeof self !== "undefined") {
  self.$RefreshSig$ = self.$RefreshSig$ || (() => (type) => type);
  self.$RefreshReg$ = self.$RefreshReg$ || (() => {});
}

import React from "react";
import { createRoot } from "react-dom/client";
import { alpha, createTheme, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import App from "./App";
import "./index.css";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#f2f2f2" },
    background: { default: "#0a0a0a", paper: "#111111" },
    text: { primary: "#f2f2f2", secondary: "#8f8f8f" },
    divider: "#262626",
    success: { main: "#8fd6a7" },
    warning: { main: "#e7c66a" },
    error: { main: "#e67a7a" },
    action: { hover: alpha("#ffffff", .05), selected: alpha("#ffffff", .08), disabledOpacity: .35 },
  },
  shape: { borderRadius: 0 },
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h4: { fontWeight: 800, letterSpacing: "-.03em" },
    h5: { fontWeight: 800, letterSpacing: "-.025em" },
    h6: { fontWeight: 800, letterSpacing: "-.02em" },
    subtitle1: { fontWeight: 750 },
    subtitle2: { fontWeight: 750 },
    button: { textTransform: "none", fontWeight: 700 },
    overline: { fontSize: ".66rem", fontWeight: 800, letterSpacing: ".11em" },
  },
  components: {
    MuiCssBaseline: { styleOverrides: { body: { backgroundColor: "#0a0a0a" } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiCard: { styleOverrides: { root: { backgroundColor: "#111111", border: "1px solid #242424", boxShadow: "none" } } },
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 0, minHeight: 34 }, outlined: { borderColor: "#343434" } } },
    MuiIconButton: { styleOverrides: { root: { borderRadius: 0 } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 0, fontWeight: 700, backgroundImage: "none" }, outlined: { borderColor: "#343434" } } },
    MuiDrawer: { styleOverrides: { paper: { backgroundColor: "#0d0d0d", borderColor: "#262626" } } },
    MuiDivider: { styleOverrides: { root: { borderColor: "#262626" } } },
  },
});

createRoot(document.getElementById("root")).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <App />
  </ThemeProvider>
);
