const express = require("express");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const db = require("../lib/db");
const logic = require("../lib/contractLogic");
const gen = require("../lib/docxGenerator");
const { requireAuth } = require("../lib/auth");

const router = express.Router();
const GEN_DIR = path.join(__dirname, "..", "generated");
const STATIC_DIR = path.join(__dirname, "..", "templates_static");

// Semua endpoint API memerlukan token login yang valid
router.use(requireAuth);

/* -------- Master data: Vendors -------- */
router.get("/vendors", (req, res) => res.json(db.readAll("vendors")));
router.post("/vendors", (req, res) => res.json(db.insert("vendors", req.body)));
router.put("/vendors/:id", (req, res) => res.json(db.update("vendors", req.params.id, req.body)));
router.delete("/vendors/:id", (req, res) => res.json({ ok: db.remove("vendors", req.params.id) }));

/* -------- Master data: Officials (PPK) -------- */
router.get("/officials", (req, res) => res.json(db.readAll("officials")));
router.post("/officials", (req, res) => res.json(db.insert("officials", req.body)));
router.put("/officials/:id", (req, res) => res.json(db.update("officials", req.params.id, req.body)));
router.delete("/officials/:id", (req, res) => res.json({ ok: db.remove("officials", req.params.id) }));

/* -------- Packages (paket pekerjaan) -------- */
router.get("/packages", (req, res) => res.json(db.readAll("packages")));
router.post("/packages", (req, res) => {
  const errors = logic.validatePaketInput(req.body);
  if (errors.length) return res.status(400).json({ errors });
  res.json(db.insert("packages", req.body));
});
router.put("/packages/:id", (req, res) => res.json(db.update("packages", req.params.id, req.body)));
router.delete("/packages/:id", (req, res) => res.json({ ok: db.remove("packages", req.params.id) }));

/* -------- Logic preview: tentukan bentuk dokumen tanpa generate file -------- */
router.post("/logic/preview", (req, res) => {
  const errors = logic.validatePaketInput(req.body);
  if (errors.length) return res.status(400).json({ errors });
  res.json(logic.determineDocumentSet(req.body));
});

/* -------- Cek kelengkapan data sebelum generate (dipakai di step Preview) -------- */
router.post("/logic/kelengkapan", (req, res) => {
  try {
    const { package_id, vendor_id, official_id } = req.body;
    const paket = db.findById("packages", package_id) || req.body.paket;
    const vendor = db.findById("vendors", vendor_id) || req.body.vendor;
    const official = db.findById("officials", official_id) || req.body.official;
    if (!paket) return res.status(400).json({ error: "paket wajib ada (via id atau objek langsung)" });
    res.json(logic.checkKelengkapan({ paket, vendor: vendor || {}, official: official || {} }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -------- Generate kontrak -------- */
router.post("/contracts/generate", async (req, res) => {
  try {
    const { package_id, vendor_id, official_id } = req.body;
    const paket = db.findById("packages", package_id) || req.body.paket;
    const vendor = db.findById("vendors", vendor_id) || req.body.vendor;
    const official = db.findById("officials", official_id) || req.body.official;

    if (!paket || !vendor || !official) {
      return res.status(400).json({ error: "paket, vendor, dan official wajib ada (via id atau objek langsung)" });
    }

    const errors = logic.validatePaketInput(paket);
    if (errors.length) return res.status(400).json({ errors });

    const docSet = logic.determineDocumentSet(paket);
    const kategori = docSet.kategori;
    const jenisKontrakLabel =
      kategori === logic.KATEGORI.KONSULTANSI_KONSTRUKSI ? gen.jenisKontrakKonsultansiLabel(paket.jenis_kontrak)
      : kategori === logic.KATEGORI.KONSULTANSI_NON_KONSTRUKSI ? gen.jenisKontrakKonsultansiNonKonstruksiLabel(paket.jenis_kontrak)
      : kategori === logic.KATEGORI.BARANG ? gen.jenisKontrakBarangLabel(paket.jenis_kontrak)
      : kategori === logic.KATEGORI.JASA_LAINNYA ? gen.jenisKontrakJasaLainnyaLabel(paket.jenis_kontrak)
      : (paket.jenis_kontrak === "lumsum" ? "Kontrak Lumsum" : "Kontrak Harga Satuan");
    const ctx = { paket, vendor, official, jenisKontrakLabel, kategori };

    const stamp = Date.now();
    const outDir = path.join(GEN_DIR, String(stamp));
    fs.mkdirSync(outDir, { recursive: true });

    const filesWritten = [];

    if (kategori === logic.KATEGORI.KONSTRUKSI) {
      /* ---------------- PEKERJAAN KONSTRUKSI ---------------- */
      if (docSet.jenisDokumen === logic.DOKUMEN.SPK) {
        const doc = gen.buildSPK(ctx);
        const buf = await gen.toBuffer(doc);
        const fname = "SPK.docx";
        fs.writeFileSync(path.join(outDir, fname), buf);
        filesWritten.push(fname);
      } else {
        const perjanjian = await gen.toBuffer(gen.buildSuratPerjanjian(ctx));
        fs.writeFileSync(path.join(outDir, "SURAT_PERJANJIAN.docx"), perjanjian);
        filesWritten.push("SURAT_PERJANJIAN.docx");

        const sskk = await gen.toBuffer(gen.buildSSKK(ctx));
        fs.writeFileSync(path.join(outDir, "SSKK.docx"), sskk);
        filesWritten.push("SSKK.docx");

        // SSUK: lampiran baku, disalin apa adanya sesuai jenis kontrak
        const ssukSrc = paket.jenis_kontrak === "lumsum"
          ? "SSUK_Pekerjaan_Konstruksi_Lumsum_2021.docx"
          : "SSUK_Pekerjaan_Konstruksi_Harga_satuan_2021.docx";
        const ssukDest = "SSUK.docx";
        fs.copyFileSync(path.join(STATIC_DIR, ssukSrc), path.join(outDir, ssukDest));
        filesWritten.push(ssukDest);
      }
    } else if (kategori === logic.KATEGORI.KONSULTANSI_KONSTRUKSI) {
      /* ---------------- JASA KONSULTANSI KONSTRUKSI ---------------- */
      if (docSet.jenisDokumen === logic.DOKUMEN.SPK) {
        const doc = gen.buildSPKKonsultansi(ctx);
        const buf = await gen.toBuffer(doc);
        const fname = "SPK.docx";
        fs.writeFileSync(path.join(outDir, fname), buf);
        filesWritten.push(fname);
      } else {
        const perjanjian = await gen.toBuffer(gen.buildSuratPerjanjianKonsultansi(ctx));
        fs.writeFileSync(path.join(outDir, "SURAT_PERJANJIAN.docx"), perjanjian);
        filesWritten.push("SURAT_PERJANJIAN.docx");

        const sskk = await gen.toBuffer(gen.buildSSKKKonsultansi(ctx));
        fs.writeFileSync(path.join(outDir, "SSKK.docx"), sskk);
        filesWritten.push("SSKK.docx");

        // Belum ada file SSUK baku Jasa Konsultansi -> generate kerangka + catatan verifikasi
        const ssuk = await gen.toBuffer(gen.buildSSUKKonsultansiKerangka(ctx));
        fs.writeFileSync(path.join(outDir, "SSUK_KERANGKA_PERLU_VERIFIKASI.docx"), ssuk);
        filesWritten.push("SSUK_KERANGKA_PERLU_VERIFIKASI.docx");
      }
    } else if (kategori === logic.KATEGORI.BARANG) {
      /* ---------------- PENGADAAN BARANG ---------------- */
      if (docSet.jenisDokumen === logic.DOKUMEN.SPK) {
        const doc = gen.buildSPKBarang(ctx);
        const buf = await gen.toBuffer(doc);
        const fname = "SPK.docx";
        fs.writeFileSync(path.join(outDir, fname), buf);
        filesWritten.push(fname);
      } else {
        const perjanjian = await gen.toBuffer(gen.buildSuratPerjanjianBarang(ctx));
        fs.writeFileSync(path.join(outDir, "SURAT_PERJANJIAN.docx"), perjanjian);
        filesWritten.push("SURAT_PERJANJIAN.docx");

        const sskk = await gen.toBuffer(gen.buildSSKKBarang(ctx));
        fs.writeFileSync(path.join(outDir, "SSKK.docx"), sskk);
        filesWritten.push("SSKK.docx");

        // SSUK Barang: lampiran baku, disalin apa adanya (satu varian untuk semua jenis kontrak)
        const ssukDest = "SSUK.docx";
        fs.copyFileSync(path.join(STATIC_DIR, "SSUK_Barang_2021.docx"), path.join(outDir, ssukDest));
        filesWritten.push(ssukDest);
      }
    } else if (kategori === logic.KATEGORI.JASA_LAINNYA) {
      /* ---------------- PENGADAAN JASA LAINNYA ---------------- */
      if (docSet.jenisDokumen === logic.DOKUMEN.SPK) {
        const doc = gen.buildSPKJasaLainnya(ctx);
        const buf = await gen.toBuffer(doc);
        const fname = "SPK.docx";
        fs.writeFileSync(path.join(outDir, fname), buf);
        filesWritten.push(fname);
      } else {
        const perjanjian = await gen.toBuffer(gen.buildSuratPerjanjianJasaLainnya(ctx));
        fs.writeFileSync(path.join(outDir, "SURAT_PERJANJIAN.docx"), perjanjian);
        filesWritten.push("SURAT_PERJANJIAN.docx");

        const sskk = await gen.toBuffer(gen.buildSSKKJasaLainnya(ctx));
        fs.writeFileSync(path.join(outDir, "SSKK.docx"), sskk);
        filesWritten.push("SSKK.docx");

        // SSUK Jasa Lainnya: lampiran baku, disalin apa adanya
        const ssukDest = "SSUK.docx";
        fs.copyFileSync(path.join(STATIC_DIR, "SSUK_Jasa_Lainnya_2021.docx"), path.join(outDir, ssukDest));
        filesWritten.push(ssukDest);
      }
    } else {
      /* ---------------- JASA KONSULTANSI NON-KONSTRUKSI ---------------- */
      if (docSet.jenisDokumen === logic.DOKUMEN.SPK) {
        const doc = gen.buildSPKKonsultansiNonKonstruksi(ctx);
        const buf = await gen.toBuffer(doc);
        const fname = "SPK.docx";
        fs.writeFileSync(path.join(outDir, fname), buf);
        filesWritten.push(fname);
      } else {
        const perjanjian = await gen.toBuffer(gen.buildSuratPerjanjianKonsultansiNonKonstruksi(ctx));
        fs.writeFileSync(path.join(outDir, "SURAT_PERJANJIAN.docx"), perjanjian);
        filesWritten.push("SURAT_PERJANJIAN.docx");

        const sskk = await gen.toBuffer(gen.buildSSKKKonsultansiNonKonstruksi(ctx));
        fs.writeFileSync(path.join(outDir, "SSKK.docx"), sskk);
        filesWritten.push("SSKK.docx");

        // SSUK Konsultansi Non-Konstruksi: baku, dipilih menurut JENIS PENYEDIA
        // (bukan jenis kontrak) -- sesuai 2 varian dokumen resmi yang diunggah.
        const isBadanUsaha = vendor.jenis === logic.JENIS_PENYEDIA.BADAN_USAHA;
        const ssukSrc = isBadanUsaha
          ? "SSUK_KonsultansiNonKonstruksi_BadanUsaha_2021.docx"
          : "SSUK_KonsultansiNonKonstruksi_Perorangan_2021.docx";
        const ssukDest = "SSUK.docx";
        fs.copyFileSync(path.join(STATIC_DIR, ssukSrc), path.join(outDir, ssukDest));
        filesWritten.push(ssukDest);
      }
    }

    // SPMK & SPL wajib terbit di kedua jalur (SPK maupun Surat Perjanjian)
    if (docSet.perluSPMK) {
      const spmk = await gen.toBuffer(gen.buildSPMK(ctx));
      fs.writeFileSync(path.join(outDir, "SPMK.docx"), spmk);
      filesWritten.push("SPMK.docx");
    }
    if (docSet.perluSPL) {
      const spl = await gen.toBuffer(gen.buildSPL(ctx));
      fs.writeFileSync(path.join(outDir, "SPL_Serah_Terima_Lokasi_Kerja.docx"), spl);
      filesWritten.push("SPL_Serah_Terima_Lokasi_Kerja.docx");
    }

    const record = db.insert("contracts", {
      package_id: paket.id || null,
      vendor_id: vendor.id || null,
      official_id: official.id || null,
      nama_paket: paket.nama_paket,
      nilai_kontrak: paket.nilai_kontrak,
      jenis_pekerjaan: docSet.kategori,
      jenis_dokumen: docSet.jenisDokumen,
      jenis_kontrak: paket.jenis_kontrak,
      files: filesWritten,
      out_dir: String(stamp),
      warnings: docSet.warnings,
    });

    res.json({ contract: record, docSet, downloadZip: `/api/contracts/${record.id}/download` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/contracts", (req, res) => res.json(db.readAll("contracts")));

router.get("/contracts/:id/download", (req, res) => {
  const record = db.findById("contracts", req.params.id);
  if (!record) return res.status(404).json({ error: "Kontrak tidak ditemukan" });
  const outDir = path.join(GEN_DIR, record.out_dir);

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${(record.nama_paket || "kontrak").replace(/[^a-z0-9]+/gi, "_")}.zip"`);

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(res);
  for (const f of record.files) archive.file(path.join(outDir, f), { name: f });
  archive.finalize();
});

module.exports = router;
