const bcrypt = require("bcryptjs");
const { v4: uuid } = require("uuid");
const db = require("./db");

// In-memory token store: token -> { userId, expiresAt }
const tokenStore = new Map();
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 jam

/* ─── Seed admin default jika belum ada user ────────────────────────────── */
function seedAdminIfEmpty() {
  const users = db.getAllUsers();
  if (users.length === 0) {
    const hash = bcrypt.hashSync("admin123", 10);
    db.insertUser({
      username: "admin",
      password_hash: hash,
      role: "admin",
      nama: "Administrator",
    });
    console.log("[auth] User admin default dibuat. Username: admin | Password: admin123");
    console.log("[auth] ⚠  SEGERA ganti password default di production!");
  }
}
seedAdminIfEmpty();

/* ─── Auth functions ─────────────────────────────────────────────────────── */
function login(username, password) {
  const user = db.findUserByUsername(username);
  if (!user) return { ok: false, error: "Username atau password salah" };

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return { ok: false, error: "Username atau password salah" };

  const token = uuid();
  tokenStore.set(token, {
    userId: user.id,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });

  return {
    ok: true,
    token,
    user: { id: user.id, username: user.username, role: user.role, nama: user.nama },
  };
}

function verifyToken(token) {
  if (!token) return null;
  const entry = tokenStore.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    tokenStore.delete(token);
    return null;
  }
  const user = db.findUserById(entry.userId);
  if (!user) return null;
  return { id: user.id, username: user.username, role: user.role, nama: user.nama };
}

function logout(token) {
  tokenStore.delete(token);
}

/* ─── Express middleware ─────────────────────────────────────────────────── */
function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const user = verifyToken(token);
  if (!user) return res.status(401).json({ error: "Tidak terautentikasi. Silakan login." });
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Hanya admin yang dapat melakukan aksi ini." });
  }
  next();
}

module.exports = { login, verifyToken, logout, requireAuth, requireAdmin };
