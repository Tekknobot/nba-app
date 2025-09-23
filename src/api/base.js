// --- DROP-IN (src/api/base.js): API base helper for prod ---
export const API_BASE =
  process.env.REACT_APP_API_BASE && process.env.REACT_APP_API_BASE.trim() !== ""
    ? process.env.REACT_APP_API_BASE.replace(/\/+$/, "") // strip trailing "/"
    : ""; // empty string = use CRA dev proxy in development
