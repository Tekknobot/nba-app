// src/components/AdUnit.jsx
import React, { useEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";

export default function AdUnit({
  slot = "0000000000",         // replace with real slot after approval
  format = "auto",
  layout = "in-article",
  label = "Advertisement",
  minHeight = 90,
  review,                      // force review placeholders
}) {
  const isReview = review ?? (process.env.REACT_APP_REVIEW_MODE === "true");
  const adTestOn = process.env.REACT_APP_ADTEST === "true"; // optional: show test ads
  const [filled, setFilled] = useState(false);
  const insRef = useRef(null);
  const moRef = useRef(null);

  // REVIEW MODE: just show the gray box, never load AdSense
  if (isReview) {
    return (
      <Box sx={{ my: 2 }}>
        <Typography variant="caption" sx={{ display: "block", mb: 0.5, opacity: 0.7 }}>
          {label}
        </Typography>
        <Box
          sx={{
            bgcolor: "#eee",
            border: "1px dashed rgba(0,0,0,0.25)",
            borderRadius: 1,
            height: minHeight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            color: "rgba(0,0,0,0.6)",
          }}
        >
          [Ad placeholder — Blog]
        </Box>
      </Box>
    );
  }

  useEffect(() => {
    // Don’t run until client-side
    if (!insRef.current || typeof window === "undefined") return;

    // Observe the ins element for data-ad-status changes
    const el = insRef.current;
    const check = () => {
      const status = el.getAttribute("data-ad-status");
      if (status === "filled") {
        setFilled(true);
        if (moRef.current) moRef.current.disconnect();
      }
    };
    // MutationObserver to detect when Google marks it filled
    const mo = new MutationObserver(check);
    mo.observe(el, { attributes: true, attributeFilter: ["data-ad-status"] });
    moRef.current = mo;

    // Trigger AdSense. If it never fills, we'll keep it collapsed.
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch { /* no-op */ }

    // Failsafe timeout: if not filled within 3s, keep collapsed
    const t = setTimeout(() => {
      if (!filled) setFilled(false);
    }, 3000);

    return () => {
      clearTimeout(t);
      if (moRef.current) moRef.current.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box sx={{ my: 2 }}>
      {/* Only show the label if an ad actually filled */}
      {filled && (
        <Typography variant="caption" sx={{ display: "block", mb: 0.5, opacity: 0.7 }}>
          {label}
        </Typography>
      )}

      {/* We always render the <ins>, but it stays display:none until filled */}
      <ins
        className="adsbygoogle"
        style={{ display: filled ? "block" : "none", minHeight: filled ? minHeight : 0 }}
        data-ad-client="ca-pub-3857320396977962"
        data-ad-slot={slot}
        data-ad-format={format}
        data-ad-layout={layout}
        {...(adTestOn ? { "data-adtest": "on" } : {})}
        ref={insRef}
      />
    </Box>
  );
}
