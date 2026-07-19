const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const { v4: uuid } = require("uuid");

const DATA_DIR = path.join(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "sikon.db");
const db = new Database(DB_PATH);

// Aktifkan WAL mode untuk performa lebih baik pada concurrent reads
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/* ─── Schema ─────────────────────────────────────────────────────────────── */
db.exec(`
  CREATE TABLE IF NOT EXISTS vendors (
    id          TEXT PRIMARY KEY,
    created_at  TEXT NOT NULL,
    updated_at  TEXT,
    data        TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS officials (
    id          TEXT PRIMARY KEY,
    created_at  TEXT NOT NULL,
    updated_at  TEXT,
    data        TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS packages (
    id          TEXT PRIMARY KEY,
    created_at  TEXT NOT NULL,
    updated_at  TEXT,
    data        TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS contracts (
    id          TEXT PRIMARY KEY,
    created_at  TEXT NOT NULL,
    updated_at  TEXT,
    data        TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    created_at  TEXT NOT NULL,
    updated_at  TEXT,
    username    TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'operator',
    nama        TEXT
  );
`);

/* ─── Migration dari JSON lama (jalankan sekali) ─────────────────────────── */
const JSON_FILES = {
  vendors:   path.join(DATA_DIR, "vendors.json"),
  officials: path.join(DATA_DIR, "officials.json"),
  packages:  path.join(DATA_DIR, "packages.json"),
  contracts: path.join(DATA_DIR, "contracts.json"),
};

function migrateTableFromJson(table) {
  const filePath = JSON_FILES[table];
  if (!fs.existsSync(filePath)) return;
  const existing = db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get();
  if (existing.cnt > 0) return; // sudah ter-migrate, skip
  try {
    const rows = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (!Array.isArray(rows) || rows.length === 0) return;
    const insert = db.prepare(
      `INSERT OR IGNORE INTO ${table} (id, created_at, updated_at, data) VALUES (?, ?, ?, ?)`
    );
    const migrate = db.transaction(() => {
      for (const row of rows) {
        const { id, created_at, updated_at, ...rest } = row;
        insert.run(
          id || uuid(),
          created_at || new Date().toISOString(),
          updated_at || null,
          JSON.stringify({ id: id || uuid(), created_at, updated_at, ...rest })
        );
      }
    });
    migrate();
    console.log(`[db] Migrated ${rows.length} rows dari ${table}.json ke SQLite.`);
    // Rename file lama agar tidak di-migrate ulang
    fs.renameSync(filePath, filePath + ".migrated");
  } catch (e) {
    console.error(`[db] Gagal migrate ${table}:`, e.message);
  }
}

["vendors", "officials", "packages", "contracts"].forEach(migrateTableFromJson);

/* ─── Public API (sama persis seperti sebelumnya) ────────────────────────── */

function readAll(table) {
  const rows = db.prepare(`SELECT data FROM ${table} ORDER BY created_at ASC`).all();
  return rows.map((r) => JSON.parse(r.data));
}

function writeAll(table, arr) {
  // Digunakan oleh kode lama yang membutuhkan penggantian massal
  const del = db.prepare(`DELETE FROM ${table}`);
  const ins = db.prepare(
    `INSERT INTO ${table} (id, created_at, updated_at, data) VALUES (?, ?, ?, ?)`
  );
  const tx = db.transaction(() => {
    del.run();
    for (const record of arr) {
      ins.run(record.id, record.created_at, record.updated_at || null, JSON.stringify(record));
    }
  });
  tx();
}

function insert(table, record) {
  const id = uuid();
  const now = new Date().toISOString();
  const full = { id, created_at: now, ...record };
  db.prepare(
    `INSERT INTO ${table} (id, created_at, updated_at, data) VALUES (?, ?, ?, ?)`
  ).run(id, now, null, JSON.stringify(full));
  return full;
}

function update(table, id, patch) {
  const row = db.prepare(`SELECT data FROM ${table} WHERE id = ?`).get(id);
  if (!row) return null;
  const now = new Date().toISOString();
  const updated = { ...JSON.parse(row.data), ...patch, updated_at: now };
  db.prepare(`UPDATE ${table} SET updated_at = ?, data = ? WHERE id = ?`).run(
    now, JSON.stringify(updated), id
  );
  return updated;
}

function remove(table, id) {
  const info = db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  return info.changes > 0;
}

function findById(table, id) {
  if (!id) return null;
  const row = db.prepare(`SELECT data FROM ${table} WHERE id = ?`).get(id);
  return row ? JSON.parse(row.data) : null;
}

/* ─── User helpers (khusus tabel users, skema berbeda) ───────────────────── */
function findUserByUsername(username) {
  return db.prepare(`SELECT * FROM users WHERE username = ?`).get(username) || null;
}

function findUserById(id) {
  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) || null;
}

function insertUser({ username, password_hash, role = "operator", nama = "" }) {
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, created_at, username, password_hash, role, nama) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, now, username, password_hash, role, nama);
  return { id, username, role, nama, created_at: now };
}

function getAllUsers() {
  return db.prepare(`SELECT id, username, role, nama, created_at FROM users ORDER BY created_at ASC`).all();
}

function getStats() {
  const contracts = readAll("contracts");
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
  readAll, writeAll, insert, update, remove, findById,
  findUserByUsername, findUserById, insertUser, getAllUsers, getStats,
  _db: db, // expose raw db untuk keperluan advanced
};
