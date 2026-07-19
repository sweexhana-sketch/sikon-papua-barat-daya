const express = require("express");
const cors = require("cors");
const path = require("path");
const apiRouter = require("./routes/api");
const authRouter = require("./routes/auth");

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Auth routes (tidak perlu token)
app.use("/api/auth", authRouter);

// API routes (semua dilindungi auth di dalam router)
app.use("/api", apiRouter);

// Serve frontend
const FRONTEND_DIR = path.join(__dirname, "..", "frontend", "public");
app.use(express.static(FRONTEND_DIR));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) return res.status(404).json({ error: "not found" });
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n🏛  SIKON — Sistem Kontrak Otomatis Papua Barat Daya`);
  console.log(`   Berjalan di http://localhost:${PORT}`);
  console.log(`   Database: SQLite (data/sikon.db)\n`);
});
