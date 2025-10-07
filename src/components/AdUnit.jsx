import React, { useEffect, useRef } from "react";
import { Typography, Box } from "@mui/material";

export default function AdUnit({ slot, format="auto", layout="in-article" }) {
  const ref = useRef(null);

  useEffect(() => {
    if (window.adsbygoogle && ref.current) {
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
    }
  }, []);

  return (
    <Box sx={{ my: 2 }}>
      <Typography variant="caption" sx={{ display: 'block', mb: 0.5, opacity: 0.7 }}>
        Advertisement
      </Typography>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-3857320396977962"
        data-ad-slot={slot}
        data-ad-format={format}
        data-ad-layout={layout}
        ref={ref}
      />
    </Box>
  );
}
