import React from "react";
import { Alert, Button, Stack } from "@mui/material";

export default function ConsentBanner() {
  const [open, setOpen] = React.useState(() => !localStorage.getItem("pivt-consent"));
  if (!open) return null;

  const update = (mode) => {
    const allow = mode === "accept";
    window.gtag?.('consent', 'update', {
      ad_storage: allow ? 'granted' : 'denied',
      ad_user_data: allow ? 'granted' : 'denied',
      ad_personalization: allow ? 'granted' : 'denied',
      analytics_storage: allow ? 'granted' : 'denied',
    });
    localStorage.setItem("pivt-consent", allow ? "accept" : "reject");
    setOpen(false);
  };

  return (
    <Alert
      severity="info"
      icon={false}
      sx={{ position: "fixed", bottom: 16, left: 16, right: 16, zIndex: 1300 }}
      action={
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" onClick={() => update("reject")}>Reject</Button>
          <Button size="small" variant="contained" onClick={() => update("accept")}>Accept</Button>
        </Stack>
      }
    >
      We use cookies for ads/measurement. Choose your preference.
    </Alert>
  );
}
