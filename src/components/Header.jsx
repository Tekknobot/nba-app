import React from "react";
import { AppBar, Box, Button, Stack, Toolbar, Typography } from "@mui/material";
import { Link as RouterLink, useLocation } from "react-router-dom";

export default function Header() {
  const { pathname } = useLocation();
  const onGames = pathname === "/" || pathname.startsWith("/all") || pathname.startsWith("/game/");
  const onBlog = pathname.startsWith("/pulse") || pathname.startsWith("/blog");
  const onRecord = pathname.startsWith("/record");

  return (
    <AppBar position="sticky" elevation={0} color="transparent" sx={{ borderBottom: "1px solid", borderColor: "divider", bgcolor: "rgba(10,10,10,.92)", backdropFilter: "blur(14px)" }}>
      <Toolbar sx={{ minHeight: { xs: 54, sm: 60 }, maxWidth: 1280, width: "100%", mx: "auto", px: { xs: 2, sm: 3 } }}>
        <Typography component={RouterLink} to="/all" sx={{ textDecoration: "none", color: "text.primary", fontSize: 21, fontWeight: 900, letterSpacing: ".14em", mr: "auto" }}>
          PIVT
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <Button component={RouterLink} to="/all" color="inherit" size="small" sx={{ color: onGames ? "text.primary" : "text.secondary", bgcolor: onGames ? "action.selected" : "transparent" }}>Games</Button>
          <Button component={RouterLink} to="/pulse" color="inherit" size="small" sx={{ color: onBlog ? "text.primary" : "text.secondary", bgcolor: onBlog ? "action.selected" : "transparent" }}>Pulse</Button>
          <Button component={RouterLink} to="/record" color="inherit" size="small" sx={{ color: onRecord ? "text.primary" : "text.secondary", bgcolor: onRecord ? "action.selected" : "transparent" }}>Record</Button>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
