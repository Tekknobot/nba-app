// src/theme.js (mid-dark variant)
import { createTheme, alpha } from "@mui/material/styles";

const NBA_BLUE = "#17408B";
const NBA_RED  = "#C9082A";

// Mid-dark neutrals (lighter than before)
const INK   = "#161B22"; // app bg (midnight slate)
const PAPER = "#1F2631"; // card bg (softer contrast)

const theme = createTheme({
  palette: {
    mode: "dark",
    primary:   { main: NBA_BLUE },
    secondary: { main: NBA_RED },
    background: { default: INK, paper: PAPER },
    divider: "rgba(255,255,255,0.18)", // a touch brighter
    text: {
      primary: "rgba(255,255,255,0.92)",
      secondary: "rgba(255,255,255,0.72)",
    },
    action: {
      hover: alpha("#ffffff", 0.08),
      selected: alpha(NBA_BLUE, 0.16),
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
    MuiCssBaseline: {
      styleOverrides: {
        "*::-webkit-scrollbar": { height: 8, width: 8 },
        "*::-webkit-scrollbar-thumb": {
          backgroundColor: alpha("#fff", 0.2),
          borderRadius: 8,
        },
        "*::-webkit-scrollbar-thumb:hover": { backgroundColor: alpha("#fff", 0.3) },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          // lighter, neutral sheen (works on mid-dark)
          background: `linear-gradient(180deg, ${alpha("#ffffff",0.03)} 0%, ${alpha("#ffffff",0.00)} 60%)`,
          border: `1px solid ${alpha("#ffffff", 0.12)}`,
          boxShadow: `0 10px 24px ${alpha("#000", 0.28)}`,
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
          "&:hover": { boxShadow: `0 0 0 2px ${alpha(NBA_BLUE, 0.22)} inset` },
        },
        containedPrimary: {
          background: `linear-gradient(180deg, ${NBA_BLUE}, ${alpha(NBA_BLUE, 0.9)})`,
        },
        containedSecondary: {
          background: `linear-gradient(180deg, ${NBA_RED}, ${alpha(NBA_RED, 0.9)})`,
        },
        outlined: {
          borderColor: alpha("#fff", 0.22),
          backgroundColor: alpha("#fff", 0.06),
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 999, fontWeight: 800, letterSpacing: 0.3 },
        outlined: { borderColor: alpha("#fff", 0.26), backgroundColor: alpha("#fff", 0.06) },
      },
    },

    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          transition: "transform 80ms ease, background-color 120ms ease",
          "&:hover": { backgroundColor: alpha(NBA_BLUE, 0.10), transform: "translateY(-1px)" },
          "&.Mui-selected": {
            backgroundColor: alpha(NBA_RED, 0.16),
            "&:hover": { backgroundColor: alpha(NBA_RED, 0.20) },
          },
        },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontWeight: 700,
          border: `1px solid ${alpha("#fff", 0.12)}`,
          background: `linear-gradient(180deg, ${alpha("#000",0.78)}, ${alpha("#000",0.64)})`,
        },
      },
    },

    MuiLinearProgress: {
      styleOverrides: { bar: { boxShadow: `0 0 10px ${alpha(NBA_BLUE, 0.35)}` } },
    },

    MuiDivider: { styleOverrides: { root: { borderColor: "rgba(255,255,255,0.18)" } } },
  },
});

export default theme;
