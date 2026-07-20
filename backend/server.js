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

// Global error handler - selalu kembalikan JSON, tidak pernah plain text
app.use((err, req, res, next) => {
  console.error("[error]", err.message, err.stack);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

// Serve frontend (hanya dipakai saat development, Vercel pakai static CDN)
const FRONTEND_DIR = path.join(__dirname, "..", "frontend", "public");
app.use(express.static(FRONTEND_DIR));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) return res.status(404).json({ error: "not found" });
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

const PORT = process.env.PORT || 4000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🏛  SIKON — Sistem Kontrak Otomatis Papua Barat Daya`);
    console.log(`   Berjalan di http://localhost:${PORT}`);
    console.log(`   Database: PostgreSQL (Neon)\n`);
  });
}

// Export for serverless environments (e.g. Vercel)
module.exports = app;
