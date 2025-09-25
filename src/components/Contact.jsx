// src/components/Contact.jsx
import React from "react";
import {
  Box, Card, CardContent, Typography, TextField, Button,
  Stack, Divider, Alert
} from "@mui/material";

export default function Contact() {
  // ✅ EDIT JUST THESE: email = LOCAL@DOMAIN.TLD
  const LOCAL  = "zillatronics"; // before @
  const DOMAIN = "gmail";    // after @, before .
  const TLD    = "com";     // .com / .app / etc.

  const getEmail = () => `${LOCAL}@${DOMAIN}.${TLD}`;
  const enc = (s) => encodeURIComponent(s).replace(/%20/g, "+");

  const [status, setStatus] = React.useState({ ok: null, msg: "" });
  const formRef = React.useRef(null);

  function onSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const message = String(fd.get("message") || "").trim();

    if (!name || !email || !message) {
      setStatus({ ok: false, msg: "Please complete all fields." });
      return;
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      setStatus({ ok: false, msg: "Please enter a valid email address." });
      return;
    }

    const to = getEmail();
    const subject = enc(`Contact: ${name}`);
    const body = enc(`Name: ${name}\nEmail: ${email}\n\n${message}`);

    try {
      window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
      setStatus({
        ok: true,
        msg: "Your email client should open with your message. If it didn’t, please email us directly."
      });
      formRef.current?.reset();
    } catch {
      setStatus({ ok: false, msg: "Could not open your email client. Please try again." });
    }
  }

  return (
    <Box sx={{ mx: "auto", width: "100%", maxWidth: 640, p: 2 }}>
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            Contact
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Typography variant="body1" sx={{ mb: 2 }}>
            If you'd like to make contact send a message using the form below.
          </Typography>

          {status.ok === true && <Alert severity="success" sx={{ mb: 2 }}>{status.msg}</Alert>}
          {status.ok === false && <Alert severity="error" sx={{ mb: 2 }}>{status.msg}</Alert>}

          <form onSubmit={onSubmit} ref={formRef} noValidate>
            <Stack spacing={2}>
              <TextField label="Your Name" name="name" required fullWidth />
              <TextField label="Your Email" name="email" type="email" required fullWidth />
              <TextField
                label="Message"
                name="message"
                multiline
                rows={4}
                required
                fullWidth
              />
              <Button variant="contained" type="submit">Send Message</Button>
            </Stack>
          </form>

          {/* Optional: no-JS fallback that still hides the address */}
          <noscript>
            <div style={{ marginTop: 16, opacity: 0.7 }}>
              JavaScript is required to submit the form. You can email us at:
              {" "}
              <code>{LOCAL} [at] {DOMAIN} [dot] {TLD}</code>
            </div>
          </noscript>
        </CardContent>
      </Card>
    </Box>
  );
}
