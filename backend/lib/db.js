const { Pool } = require("pg");
const { v4: uuid } = require("uuid");

// Hapus channel_binding=require karena tidak didukung oleh pg library standar
const rawConnStr = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_xZKIEB02Vhpt@ep-polished-dust-awfz5230-pooler.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require";
const connectionString = rawConnStr.replace("&channel_binding=require", "").replace("?channel_binding=require", "");

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 5,
});

pool.on("error", (err) => {
  console.error("[db] Pool error:", err.message);
});

// Test koneksi saat startup
pool.query("SELECT 1")
  .then(() => console.log("[db] Koneksi ke Neon PostgreSQL berhasil!"))
  .catch((e) => console.error("[db] GAGAL koneksi ke database:", e.message));

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendors (
        id          VARCHAR(255) PRIMARY KEY,
        created_at  VARCHAR(255) NOT NULL,
        updated_at  VARCHAR(255),
        data        TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS officials (
        id          VARCHAR(255) PRIMARY KEY,
        created_at  VARCHAR(255) NOT NULL,
        updated_at  VARCHAR(255),
        data        TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS packages (
        id          VARCHAR(255) PRIMARY KEY,
        created_at  VARCHAR(255) NOT NULL,
        updated_at  VARCHAR(255),
        data        TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS contracts (
        id          VARCHAR(255) PRIMARY KEY,
        created_at  VARCHAR(255) NOT NULL,
        updated_at  VARCHAR(255),
        data        TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS users (
        id          VARCHAR(255) PRIMARY KEY,
        created_at  VARCHAR(255) NOT NULL,
        updated_at  VARCHAR(255),
        username    VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role        VARCHAR(255) NOT NULL DEFAULT 'operator',
        nama        VARCHAR(255)
      );
    `);
    console.log("[db] Tabel berhasil diinisialisasi.");
  } catch (err) {
    console.error("[db] initDB gagal:", err.message);
  }
}
initDB();

async function readAll(table) {
  const result = await pool.query(`SELECT data FROM ${table} ORDER BY created_at ASC`);
  return result.rows.map((r) => JSON.parse(r.data));
}

async function insert(table, record) {
  const id = uuid();
  const now = new Date().toISOString();
  const full = { id, created_at: now, ...record };
  await pool.query(
    `INSERT INTO ${table} (id, created_at, updated_at, data) VALUES ($1, $2, $3, $4)`,
    [id, now, null, JSON.stringify(full)]
  );
  return full;
}

async function update(table, id, patch) {
  const rowResult = await pool.query(`SELECT data FROM ${table} WHERE id = $1`, [id]);
  if (rowResult.rows.length === 0) return null;
  const now = new Date().toISOString();
  const updated = { ...JSON.parse(rowResult.rows[0].data), ...patch, updated_at: now };
  await pool.query(
    `UPDATE ${table} SET updated_at = $1, data = $2 WHERE id = $3`,
    [now, JSON.stringify(updated), id]
  );
  return updated;
}

async function remove(table, id) {
  const info = await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
  return info.rowCount > 0;
}

async function findById(table, id) {
  if (!id) return null;
  const rowResult = await pool.query(`SELECT data FROM ${table} WHERE id = $1`, [id]);
  return rowResult.rows.length > 0 ? JSON.parse(rowResult.rows[0].data) : null;
}

async function findUserByUsername(username) {
  const result = await pool.query(`SELECT * FROM users WHERE username = $1`, [username]);
  return result.rows.length > 0 ? result.rows[0] : null;
}

async function findUserById(id) {
  const result = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
}

async function insertUser({ username, password_hash, role = "operator", nama = "" }) {
  const id = uuid();
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO users (id, created_at, username, password_hash, role, nama) VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, now, username, password_hash, role, nama]
  );
  return { id, username, role, nama, created_at: now };
}

async function getAllUsers() {
  const result = await pool.query(`SELECT id, username, role, nama, created_at FROM users ORDER BY created_at ASC`);
  return result.rows;
}

async function getStats() {
  const contracts = await readAll("contracts");
  const now = new Date();
  const thisMonth = contracts.filter((c) => {
    const d = new Date(c.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const totalNilai = contracts.reduce((s, c) => s + (Number(c.nilai_kontrak) || 0), 0);
  const perKategori = {};
  const perDokumen = { SPK: 0, "Surat Perjanjian": 0 };
  for (const c of contracts) {
    const k = c.jenis_pekerjaan || "konstruksi";
    perKategori[k] = (perKategori[k] || 0) + 1;
    if (c.jenis_dokumen === "SPK") perDokumen.SPK++;
    else perDokumen["Surat Perjanjian"]++;
  }
  return {
    totalKontrak: contracts.length,
    totalNilai,
    kontrakBulanIni: thisMonth.length,
    perKategori,
    perDokumen,
  };
}

module.exports = {
  readAll, insert, update, remove, findById,
  findUserByUsername, findUserById, insertUser, getAllUsers, getStats,
  pool,
};
