const express = require("express");
const auth = require("../lib/auth");
const db = require("../lib/db");
const bcrypt = require("bcryptjs");

const router = express.Router();

/* POST /api/auth/login */
router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username dan password wajib diisi." });
  }
  const result = auth.login(username, password);
  if (!result.ok) return res.status(401).json({ error: result.error });
  res.json({ token: result.token, user: result.user });
});

/* POST /api/auth/logout */
router.post("/logout", (req, res) => {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (token) auth.logout(token);
  res.json({ ok: true });
});

/* GET /api/auth/me — kembalikan user dari token */
router.get("/me", (req, res) => {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const user = auth.verifyToken(token);
  if (!user) return res.status(401).json({ error: "Token tidak valid atau sudah kadaluarsa." });
  res.json({ user });
});

/* GET /api/auth/users — daftar semua user (admin only) */
router.get("/users", auth.requireAuth, auth.requireAdmin, (req, res) => {
  res.json(db.getAllUsers());
});

/* POST /api/auth/users — tambah user baru (admin only) */
router.post("/users", auth.requireAuth, auth.requireAdmin, (req, res) => {
  const { username, password, role = "operator", nama = "" } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username dan password wajib diisi." });
  }
  const existing = db.findUserByUsername(username);
  if (existing) return res.status(409).json({ error: "Username sudah digunakan." });
  const password_hash = bcrypt.hashSync(password, 10);
  const user = db.insertUser({ username, password_hash, role, nama });
  res.json(user);
});

/* GET /api/auth/stats — statistik untuk dashboard */
router.get("/stats", auth.requireAuth, (req, res) => {
  res.json(db.getStats());
});

module.exports = router;
