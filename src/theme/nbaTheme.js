// src/theme/nbaTheme.js
import { createTheme, alpha } from "@mui/material/styles";

// Brand-y NBA hues
const NBA_BLUE = "#17408B";     // classic NBA blue
const NBA_RED  = "#C9082A";     // classic NBA red
const GOLD     = "#F7B500";     // accent (trophies, banners)
const INK      = "#0B0F14";     // app bg
const PAPER    = "#11161D";     // card bg

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: NBA_BLUE },
    secondary: { main: NBA_RED },
    info: { main: "#4FC3F7" },
    success: { main: "#2e7d32" },
    warning: { main: "#ed6c02" },
    error:   { main: "#d32f2f" },
    background: {
      default: INK,
      paper: PAPER,
    },
    divider: "rgba(255,255,255,0.12)",
    // nice glow for progress bars, chips, etc.
    action: {
      hover: alpha("#ffffff", 0.06),
      selected: alpha(NBA_BLUE, 0.14),
      focus: alpha(NBA_RED, 0.2),
      disabledOpacity: 0.38,
    },
  },

  shape: { borderRadius: 12 },

  typography: {
    // Body stays modern/neutral; headings are Bebas
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji"',
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
      styleOverrides: (theme) => ({
        // subtle hardwood / court lines vibe
        body: {
          backgroundImage: `
            radial-gradient(${alpha("#ffffff", 0.03)} 1px, transparent 1px),
            linear-gradient(0deg, ${alpha("#ffffff",0.02)}, ${alpha("#ffffff",0.02)}),
            radial-gradient(${alpha("#ffffff", 0.03)} 1px, transparent 1px)
          `,
          backgroundSize: "24px 24px, 100% 100%, 24px 24px",
          backgroundPosition: "0 0, 0 0, 12px 12px",
        },
        // thin, modern scrollbars
        "*::-webkit-scrollbar": { height: 8, width: 8 },
        "*::-webkit-scrollbar-thumb": {
          backgroundColor: alpha("#fff", 0.18),
          borderRadius: 8,
        },
        "*::-webkit-scrollbar-thumb:hover": {
          backgroundColor: alpha("#fff", 0.28),
        },
      }),
    },

    // Cards feel like courtside displays
    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          background:
            `linear-gradient(180deg, ${alpha("#ffffff",0.02)} 0%, transparent 60%)`,
          border: `1px solid ${alpha("#fff", 0.06)}`,
          boxShadow: `0 8px 24px ${alpha("#000", 0.35)}`,
        }),
      },
    },

    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundImage: "none" } },
    },

    // Buttons: bolder, with slight outline on hover
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 12,
          paddingInline: 16,
          "&:hover": {
            boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.25)} inset`,
          },
        }),
        containedPrimary: {
          background: `linear-gradient(180deg, ${NBA_BLUE}, ${alpha(NBA_BLUE, 0.9)})`,
        },
        containedSecondary: {
          background: `linear-gradient(180deg, ${NBA_RED}, ${alpha(NBA_RED, 0.9)})`,
        },
      },
    },

    // Chips styled like scoreboard tags
    MuiChip: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 999,
          fontWeight: 800,
          letterSpacing: 0.3,
        }),
        outlined: ({ theme }) => ({
          borderColor: alpha("#fff", 0.24),
          backgroundColor: alpha("#fff", 0.04),
        }),
      },
    },

    // List items get a subtle court-line hover
    MuiListItemButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 8,
          transition: "transform 80ms ease, background-color 120ms ease",
          "&:hover": {
            backgroundColor: alpha(NBA_BLUE, 0.08),
            transform: "translateY(-1px)",
          },
          "&.Mui-selected": {
            backgroundColor: alpha(NBA_RED, 0.14),
            "&:hover": { backgroundColor: alpha(NBA_RED, 0.18) },
          },
        }),
      },
    },

    // Tooltips like arena jumbotrons
    MuiTooltip: {
      styleOverrides: {
        tooltip: ({ theme }) => ({
          fontWeight: 700,
          border: `1px solid ${alpha("#fff", 0.1)}`,
          background:
            `linear-gradient(180deg, ${alpha("#000",0.85)}, ${alpha("#000",0.7)})`,
        }),
      },
    },

    // Progress bars: add a light glow
    MuiLinearProgress: {
      styleOverrides: {
        bar: ({ theme }) => ({
          boxShadow: `0 0 12px ${alpha(theme.palette.primary.main, 0.4)}`,
        }),
      },
    },

    // Dividers a tad brighter
    MuiDivider: {
      styleOverrides: { root: { borderColor: alpha("#fff", 0.12) } },
    },
  },
});

export default theme;
