const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5001;

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.get("/api/nba-data", require("../api/nba-data"));
app.get("/api/news", require("../api/news"));

const buildDir = path.join(__dirname, "..", "build");
app.use(express.static(buildDir));
app.use("/blog", express.static(path.join(buildDir, "blog"), { setHeaders: (res) => res.type("text/markdown; charset=utf-8") }));
app.get("*", (req, res) => res.sendFile(path.join(buildDir, "index.html")));

app.listen(PORT, () => console.log(`PIVT server running on http://localhost:${PORT}`));
