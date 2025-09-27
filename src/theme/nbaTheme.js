// src/theme.js (clean, no court visuals)
import { createTheme, alpha } from "@mui/material/styles";

// Minimal palette
const NBA_BLUE = "#17408B";
const NBA_RED  = "#C9082A";
const INK      = "#0B0F14"; // app bg
const PAPER    = "#11161D"; // card bg

const theme = createTheme({
  palette: {
    mode: "dark",
    primary:   { main: NBA_BLUE },
    secondary: { main: NBA_RED },
    background: { default: INK, paper: PAPER },
    divider: "rgba(255,255,255,0.12)",
    text: {
      primary: "rgba(255,255,255,0.95)",
      secondary: "rgba(255,255,255,0.7)",
    },
    action: {
      hover: alpha("#ffffff", 0.06),
      selected: alpha(NBA_BLUE, 0.14),
      focus: alpha(NBA_RED, 0.2),
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
    // Keep only subtle global tweaks (no background textures)
    MuiCssBaseline: {
      styleOverrides: {
        "*::-webkit-scrollbar": { height: 8, width: 8 },
        "*::-webkit-scrollbar-thumb": {
          backgroundColor: alpha("#fff", 0.18),
          borderRadius: 8,
        },
        "*::-webkit-scrollbar-thumb:hover": { backgroundColor: alpha("#fff", 0.28) },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          background: `linear-gradient(180deg, ${alpha("#ffffff",0.02)} 0%, transparent 60%)`,
          border: `1px solid ${alpha("#fff", 0.06)}`,
          boxShadow: `0 8px 24px ${alpha("#000", 0.35)}`,
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
          "&:hover": { boxShadow: `0 0 0 2px ${alpha(NBA_BLUE, 0.25)} inset` },
        },
        containedPrimary: {
          background: `linear-gradient(180deg, ${NBA_BLUE}, ${alpha(NBA_BLUE, 0.9)})`,
        },
        containedSecondary: {
          background: `linear-gradient(180deg, ${NBA_RED}, ${alpha(NBA_RED, 0.9)})`,
        },
        outlined: {
          borderColor: alpha("#fff", 0.2),
          backgroundColor: alpha("#fff", 0.04),
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 999, fontWeight: 800, letterSpacing: 0.3 },
        outlined: { borderColor: alpha("#fff", 0.24), backgroundColor: alpha("#fff", 0.04) },
      },
    },

    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          transition: "transform 80ms ease, background-color 120ms ease",
          "&:hover": { backgroundColor: alpha(NBA_BLUE, 0.08), transform: "translateY(-1px)" },
          "&.Mui-selected": {
            backgroundColor: alpha(NBA_RED, 0.14),
            "&:hover": { backgroundColor: alpha(NBA_RED, 0.18) },
          },
        },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontWeight: 700,
          border: `1px solid ${alpha("#fff", 0.1)}`,
          background: `linear-gradient(180deg, ${alpha("#000",0.85)}, ${alpha("#000",0.7)})`,
        },
      },
    },

    MuiLinearProgress: {
      styleOverrides: { bar: { boxShadow: `0 0 12px ${alpha(NBA_BLUE, 0.4)}` } },
    },

    MuiDivider: { styleOverrides: { root: { borderColor: "rgba(255,255,255,0.12)" } } },
  },
});

export default theme;
