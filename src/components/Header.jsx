import React from "react";
import {
  AppBar, Toolbar, Button, Stack, Box, Typography, Chip
} from "@mui/material";
import SportsBasketballRoundedIcon from "@mui/icons-material/SportsBasketballRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import { Link as RouterLink, useLocation } from "react-router-dom";

export default function Header() {
  const { pathname } = useLocation();
  const isAll = pathname === "/" || pathname.startsWith("/all") || pathname.startsWith("/game/");
  const isBlog = pathname.startsWith("/blog");

  return (
    <AppBar
      position="sticky"
      color="transparent"
      elevation={0}
      sx={{
        top: 0,
        zIndex: (t) => t.zIndex.appBar,
        backgroundColor: "rgba(8, 13, 22, 0.88)",
        backdropFilter: "blur(18px)",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Toolbar sx={{ minHeight: { xs: 58, sm: 64 }, px: { xs: 1.5, sm: 3 }, maxWidth: 1400, width: "100%", mx: "auto" }}>
        <Button
          component={RouterLink}
          to="/all"
          color="inherit"
          sx={{ p: 0, mr: "auto", minWidth: 0, textTransform: "none", "&:hover": { background: "transparent" } }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Box className="brand-mark">
              <SportsBasketballRoundedIcon sx={{ fontSize: 19 }} />
            </Box>
            <Box sx={{ textAlign: "left" }}>
              <Typography sx={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: { xs: 24, sm: 28 }, letterSpacing: 1.6, lineHeight: 0.9 }}>
                PIVT
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary", display: { xs: "none", sm: "block" }, lineHeight: 1.1, mt: 0.3 }}>
                NBA schedule & form
              </Typography>
            </Box>
          </Stack>
        </Button>

        <Stack direction="row" spacing={0.5} alignItems="center">
          <Button
            component={RouterLink}
            to="/all"
            startIcon={<CalendarMonthRoundedIcon />}
            variant={isAll ? "contained" : "text"}
            size="small"
            sx={{ minWidth: { xs: 44, sm: 92 }, px: { xs: 1, sm: 1.5 }, ".MuiButton-startIcon": { mr: { xs: 0, sm: 0.75 } } }}
          >
            <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>Games</Box>
          </Button>
          <Button
            component={RouterLink}
            to="/blog"
            startIcon={<ArticleOutlinedIcon />}
            variant={isBlog ? "contained" : "text"}
            size="small"
            sx={{ minWidth: { xs: 44, sm: 86 }, px: { xs: 1, sm: 1.5 }, ".MuiButton-startIcon": { mr: { xs: 0, sm: 0.75 } } }}
          >
            <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>Blog</Box>
          </Button>
          <Chip label="No login" size="small" variant="outlined" sx={{ display: { xs: "none", md: "inline-flex" }, ml: 0.5 }} />
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
