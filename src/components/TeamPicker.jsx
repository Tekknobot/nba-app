import React, { useEffect, useMemo, useState } from "react";
import { Autocomplete, TextField, Stack, Chip } from "@mui/material";
import TEAMS from "../utils/teams";

/**
 * TeamPicker:
 * - Shows an Autocomplete of all NBA teams
 * - Broadcasts selection via window "team:change"
 * - Remembers last selection in localStorage
 */
export default function TeamPicker({ autoSelectFirst = true }) {
  const options = useMemo(
    () => TEAMS.map(t => ({ id: t.code, label: t.name })),
    []
  );
  const [sel, setSel] = useState(null);

  // restore last selection
  useEffect(() => {
    const saved = localStorage.getItem("teamPicker:last");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSel(parsed);
        window.dispatchEvent(new CustomEvent("team:change", {
          detail: { code: parsed.id, name: parsed.label, season: "2025-26" }
        }));
        return;
      } catch {}
    }
    // optionally select first team on mount
    if (autoSelectFirst && options[0]) {
      setSel(options[0]);
      window.dispatchEvent(new CustomEvent("team:change", {
        detail: { code: options[0].id, name: options[0].label, season: "2025-26" }
      }));
    }
  }, [autoSelectFirst, options]);

  function handleChange(_e, v) {
    setSel(v);
    if (v) {
      localStorage.setItem("teamPicker:last", JSON.stringify(v));
      window.dispatchEvent(new CustomEvent("team:change", {
        detail: { code: v.id, name: v.label, season: "2025-26" }
      }));
    }
  }

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
      <Autocomplete
        options={options}
        value={sel}
        onChange={handleChange}
        sx={{ minWidth: 260, flex: 1 }}
        renderInput={(params) => <TextField {...params} label="Select team" />}
        isOptionEqualToValue={(o, v) => o.id === v.id}
      />
      {sel?.id && <Chip label={sel.id} size="small" />}
    </Stack>
  );
}
