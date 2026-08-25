const ESPN_LOGO_CODE = {
  ATL: "atl", BOS: "bos", BKN: "bkn", CHA: "cha", CHI: "chi", CLE: "cle",
  DAL: "dal", DEN: "den", DET: "det", GSW: "gs", HOU: "hou", IND: "ind",
  LAC: "lac", LAL: "lal", MEM: "mem", MIA: "mia", MIL: "mil", MIN: "min",
  NOP: "no", NYK: "ny", OKC: "okc", ORL: "orl", PHI: "phi", PHX: "phx",
  POR: "por", SAC: "sac", SAS: "sa", TOR: "tor", UTA: "utah", WAS: "wsh",
};

export function teamLogoUrl(code) {
  const key = String(code || "").toUpperCase();
  const slug = ESPN_LOGO_CODE[key];
  return slug ? `https://a.espncdn.com/i/teamlogos/nba/500/${slug}.png` : "";
}

export function logoForTeam(team) {
  return team?.logo || teamLogoUrl(team?.code);
}

export function stageLabel(stageId) {
  const id = Number(stageId);
  if (id === 1) return "Preseason";
  if (id === 3) return "Postseason";
  return "Regular season";
}
