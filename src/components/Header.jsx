// src/components/Header.jsx
import React from "react";
import { AppBar, Toolbar, Button, Stack } from "@mui/material";
import { Link as RouterLink, useLocation } from "react-router-dom";

export default function Header() {
  const { pathname } = useLocation();
  const isAll = pathname === "/" || pathname.startsWith("/all");
  const isAbout = pathname.startsWith("/about");
  const isContact = pathname.startsWith("/contact");
  const isPrivacy = pathname.startsWith("/privacy");
  const isBlog = pathname.startsWith("/blog");

  return (
    <AppBar
      position="fixed"                 // <-- fixed so content scrolls under
      color="inherit"
      elevation={3}
      sx={{
        bgcolor: "background.paper",   // <-- opaque background
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Toolbar sx={{ gap: 1, justifyContent: "space-between" }}>
        <Button component={RouterLink} to="/" variant="text" size="small">
          PIVT
        </Button>

        <Stack direction="row" spacing={1}>
          <Button component={RouterLink} to="/all" variant={isAll ? "contained" : "text"} size="small">
            All
          </Button>
          <Button component={RouterLink} to="/blog" variant={isBlog ? "contained" : "text"} size="small">
            Blog
          </Button>
          <Button component={RouterLink} to="/about" variant={isAbout ? "contained" : "text"} size="small">
            About
          </Button>
          <Button component={RouterLink} to="/privacy" variant={isPrivacy ? "contained" : "text"} size="small">
            Privacy
          </Button>
          <Button component={RouterLink} to="/contact" variant={isContact ? "contained" : "text"} size="small">
            Contact
          </Button>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
