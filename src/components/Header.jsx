import React from "react";
import { AppBar, Toolbar, Button, Stack, Typography } from "@mui/material";
import { Link as RouterLink, useLocation } from "react-router-dom";

export default function Header() {
  const { pathname } = useLocation();
  const isAll = pathname.startsWith("/all");
  const isAbout = pathname.startsWith("/about");
  const isContact = pathname.startsWith("/contact");

  return (
    <AppBar position="sticky" elevation={0} color="default" sx={{ borderBottom: 1, borderColor: "divider" }}>
      <Toolbar sx={{ gap: 2 }}>
        <Typography
          variant="h6"
          sx={{ fontFamily: '"Bebas Neue", sans-serif', letterSpacing: 1, mr: 1 }}
        >
          PIVT
        </Typography>

        <Stack direction="row" spacing={1}>
        <Button component={RouterLink} to="/all"   variant={isAll ? "contained" : "text"}   size="small">All</Button>
        <Button component={RouterLink} to="/about" variant={isAbout ? "contained" : "text"} size="small">About</Button>
        <Button component={RouterLink} to="/contact" variant={isContact ? "contained" : "text"} size="small">Contact</Button>
        </Stack>

      </Toolbar>
    </AppBar>
  );
}
