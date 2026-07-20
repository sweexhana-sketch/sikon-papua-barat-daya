const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db");

const JWT_SECRET = process.env.JWT_SECRET || "sikon-super-secret-key-change-this-in-production";
const JWT_EXPIRES_IN = "8h";

/* ─── Seed admin default jika belum ada user ────────────────────────────── */
async function seedAdminIfEmpty() {
  try {
    const users = await db.getAllUsers();
    if (users.length === 0) {
      const hash = bcrypt.hashSync("admin123", 10);
      await db.insertUser({
        username: "admin",
        password_hash: hash,
        role: "admin",
        nama: "Administrator",
      });
      console.log("[auth] User admin default dibuat. Username: admin | Password: admin123");
    }
  } catch (e) {
    console.error("[auth] Gagal mengecek/membuat admin default:", e.message);
  }
}

/* ─── Auth functions ─────────────────────────────────────────────────────── */
async function login(username, password) {
  // Jalankan seed admin secara lazy saat percobaan login pertama kali
  await seedAdminIfEmpty();

  const user = await db.findUserByUsername(username);
  if (!user) return { ok: false, error: "Username atau password salah" };

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return { ok: false, error: "Username atau password salah" };

  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    nama: user.nama
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  return {
    ok: true,
    token,
    user: payload,
  };
}

function verifyToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

function logout(token) {
  // Stateless JWT: logout dilakukan di sisi client dengan menghapus token
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
