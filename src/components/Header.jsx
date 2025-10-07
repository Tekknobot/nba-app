// src/components/Header.jsx
import React from "react";
import {
  AppBar, Toolbar, Button, Stack, IconButton, Drawer,
  List, ListItemButton, ListItemText, Divider, Box
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";

export default function Header() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isAll = pathname === "/" || pathname.startsWith("/all");
  const isAbout = pathname.startsWith("/about");
  const isContact = pathname.startsWith("/contact");
  const isPrivacy = pathname.startsWith("/privacy");
  const isBlog = pathname.startsWith("/blog");

  const [open, setOpen] = React.useState(false);
  const toggle = (v) => () => setOpen(v);

  const go = (to) => () => {
    setOpen(false);
    navigate(to);
  };

  return (
    <>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={3}
        sx={{
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Toolbar sx={{ gap: 1, justifyContent: "space-between" }}>
          {/* Brand / Home */}
          <Button component={RouterLink} to="/" variant="text" size="small">
            PIVT
          </Button>

          {/* Desktop nav (smUp) */}
          <Stack
            direction="row"
            spacing={1}
            sx={{ display: { xs: "none", sm: "flex" } }}
          >
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

          {/* Mobile hamburger (xsOnly) */}
          <IconButton
            aria-label="Open menu"
            onClick={toggle(true)}
            sx={{ display: { xs: "inline-flex", sm: "none" } }}
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Spacer so content starts below the fixed AppBar */}
      <Toolbar />

      {/* Drawer menu */}
      <Drawer anchor="right" open={open} onClose={toggle(false)}>
        <Box
          role="presentation"
          sx={{ width: 260, p: 1 }}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        >
          <List dense>
            <ListItemButton selected={isAll} onClick={go("/all")}>
              <ListItemText primary="All" />
            </ListItemButton>
            <ListItemButton selected={isBlog} onClick={go("/blog")}>
              <ListItemText primary="Blog" />
            </ListItemButton>
            <ListItemButton selected={isAbout} onClick={go("/about")}>
              <ListItemText primary="About" />
            </ListItemButton>
            <ListItemButton selected={isPrivacy} onClick={go("/privacy")}>
              <ListItemText primary="Privacy" />
            </ListItemButton>
            <ListItemButton selected={isContact} onClick={go("/contact")}>
              <ListItemText primary="Contact" />
            </ListItemButton>
          </List>
          <Divider />
          <Box sx={{ px: 2, py: 1.5, fontSize: 12, opacity: 0.7 }}>
            © {new Date().getFullYear()} PIVT
          </Box>
        </Box>
      </Drawer>
    </>
  );
}
