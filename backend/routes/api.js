const express = require("express");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const db = require("../lib/db");
const logic = require("../lib/contractLogic");
const gen = require("../lib/docxGenerator");
const { requireAuth } = require("../lib/auth");

const router = express.Router();
const STATIC_DIR = path.join(__dirname, "..", "templates_static");

// Semua endpoint API memerlukan token login yang valid
router.use(requireAuth);

/* -------- Master data: Vendors -------- */
router.get("/vendors", async (req, res) => {
  try { res.json(await db.readAll("vendors")); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post("/vendors", async (req, res) => {
  try { res.json(await db.insert("vendors", req.body)); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put("/vendors/:id", async (req, res) => {
  try { res.json(await db.update("vendors", req.params.id, req.body)); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete("/vendors/:id", async (req, res) => {
  try { res.json({ ok: await db.remove("vendors", req.params.id) }); } catch (e) { res.status(500).json({ error: e.message }); }
});

/* -------- Master data: Officials (PPK) -------- */
router.get("/officials", async (req, res) => {
  try { res.json(await db.readAll("officials")); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post("/officials", async (req, res) => {
  try { res.json(await db.insert("officials", req.body)); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put("/officials/:id", async (req, res) => {
  try { res.json(await db.update("officials", req.params.id, req.body)); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete("/officials/:id", async (req, res) => {
  try { res.json({ ok: await db.remove("officials", req.params.id) }); } catch (e) { res.status(500).json({ error: e.message }); }
});

/* -------- Packages (paket pekerjaan) -------- */
router.get("/packages", async (req, res) => {
  try { res.json(await db.readAll("packages")); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post("/packages", async (req, res) => {
  try {
    const errors = logic.validatePaketInput(req.body);
    if (errors.length) return res.status(400).json({ errors });
    res.json(await db.insert("packages", req.body));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put("/packages/:id", async (req, res) => {
  try { res.json(await db.update("packages", req.params.id, req.body)); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete("/packages/:id", async (req, res) => {
  try { res.json({ ok: await db.remove("packages", req.params.id) }); } catch (e) { res.status(500).json({ error: e.message }); }
});

/* -------- Logic preview -------- */
router.post("/logic/preview", (req, res) => {
  const errors = logic.validatePaketInput(req.body);
  if (errors.length) return res.status(400).json({ errors });
  res.json(logic.determineDocumentSet(req.body));
});

/* -------- Cek kelengkapan data sebelum generate -------- */
router.post("/logic/kelengkapan", async (req, res) => {
  try {
    const { package_id, vendor_id, official_id } = req.body;
    const paket = (await db.findById("packages", package_id)) || req.body.paket;
    const vendor = (await db.findById("vendors", vendor_id)) || req.body.vendor;
    const official = (await db.findById("officials", official_id)) || req.body.official;
    if (!paket) return res.status(400).json({ error: "paket wajib ada" });
    res.json(logic.checkKelengkapan({ paket, vendor: vendor || {}, official: official || {} }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -------- Generate kontrak (Serverless version - No Disk I/O) -------- */
router.post("/contracts/generate", async (req, res) => {
  try {
    const { package_id, vendor_id, official_id } = req.body;
    const paket = (await db.findById("packages", package_id)) || req.body.paket;
    const vendor = (await db.findById("vendors", vendor_id)) || req.body.vendor;
    const official = (await db.findById("officials", official_id)) || req.body.official;

    if (!paket || !vendor || !official) {
      return res.status(400).json({ error: "paket, vendor, dan official wajib ada" });
    }

    const errors = logic.validatePaketInput(paket);
    if (errors.length) return res.status(400).json({ errors });

    const docSet = logic.determineDocumentSet(paket);

    // Di Vercel, kita TIDAK menulis ke file system lokal (backend/generated).
    // Sebaliknya, kita mensimulasikan generate dengan menyimpan SNAPSHOT datanya
    // ke tabel contracts. Dokumen akan di-generate on-the-fly saat download.
    
    // Save snapshot of the exact data used for generation to ensure immutable contracts
    const snapshot = {
      paket, vendor, official
    };

    const record = await db.insert("contracts", {
      package_id: paket.id || null,
      vendor_id: vendor.id || null,
      official_id: official.id || null,
      nama_paket: paket.nama_paket,
      nilai_kontrak: paket.nilai_kontrak,
      jenis_pekerjaan: docSet.kategori,
      jenis_dokumen: docSet.jenisDokumen,
      jenis_kontrak: paket.jenis_kontrak,
      snapshot, // JSON object saved into the text field via db.js JSON.stringify
      warnings: docSet.warnings,
    });

    res.json({ contract: record, docSet, downloadZip: `/api/contracts/${record.id}/download` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/contracts", async (req, res) => {
  try {
    const rows = await db.readAll("contracts");
    // Jangan kirim seluruh snapshot ke list UI agar payload tidak terlalu besar
    const slim = rows.map(r => {
      const { snapshot, ...rest } = r;
      return rest;
    });
    res.json(slim);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -------- Download ZIP on-the-fly (Serverless) -------- */
router.get("/contracts/:id/download", async (req, res) => {
  try {
    const record = await db.findById("contracts", req.params.id);
    if (!record) return res.status(404).json({ error: "Kontrak tidak ditemukan" });

    // Cek snapshot
    if (!record.snapshot) {
      return res.status(400).json({ error: "Data kontrak ini dibuat dengan versi aplikasi lama yang tidak mendukung download on-the-fly." });
    }

    const { paket, vendor, official } = record.snapshot;
    const docSet = logic.determineDocumentSet(paket);
    
    const kategori = docSet.kategori;
    const jenisKontrakLabel =
      kategori === logic.KATEGORI.KONSULTANSI_KONSTRUKSI ? gen.jenisKontrakKonsultansiLabel(paket.jenis_kontrak)
      : kategori === logic.KATEGORI.KONSULTANSI_NON_KONSTRUKSI ? gen.jenisKontrakKonsultansiNonKonstruksiLabel(paket.jenis_kontrak)
      : kategori === logic.KATEGORI.BARANG ? gen.jenisKontrakBarangLabel(paket.jenis_kontrak)
      : kategori === logic.KATEGORI.JASA_LAINNYA ? gen.jenisKontrakJasaLainnyaLabel(paket.jenis_kontrak)
      : (paket.jenis_kontrak === "lumsum" ? "Kontrak Lumsum" : "Kontrak Harga Satuan");
      
    const ctx = { paket, vendor, official, jenisKontrakLabel, kategori };

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${(record.nama_paket || "kontrak").replace(/[^a-z0-9]+/gi, "_")}.zip"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);

    // Fungsi helper untuk generate dan append
    const appendDoc = async (buildFunc, filename) => {
      const doc = buildFunc(ctx);
      const buf = await gen.toBuffer(doc);
      archive.append(buf, { name: filename });
    };

    if (kategori === logic.KATEGORI.KONSTRUKSI) {
      if (docSet.jenisDokumen === logic.DOKUMEN.SPK) {
        await appendDoc(gen.buildSPK, "SPK.docx");
      } else {
        await appendDoc(gen.buildSuratPerjanjian, "SURAT_PERJANJIAN.docx");
        await appendDoc(gen.buildSSKK, "SSKK.docx");
        
        const ssukSrc = paket.jenis_kontrak === "lumsum"
          ? "SSUK_Pekerjaan_Konstruksi_Lumsum_2021.docx"
          : "SSUK_Pekerjaan_Konstruksi_Harga_satuan_2021.docx";
        archive.file(path.join(STATIC_DIR, ssukSrc), { name: "SSUK.docx" });
      }
    } else if (kategori === logic.KATEGORI.KONSULTANSI_KONSTRUKSI) {
      if (docSet.jenisDokumen === logic.DOKUMEN.SPK) {
        await appendDoc(gen.buildSPKKonsultansi, "SPK.docx");
      } else {
        await appendDoc(gen.buildSuratPerjanjianKonsultansi, "SURAT_PERJANJIAN.docx");
        await appendDoc(gen.buildSSKKKonsultansi, "SSKK.docx");
        await appendDoc(gen.buildSSUKKonsultansiKerangka, "SSUK_KERANGKA_PERLU_VERIFIKASI.docx");
      }
    } else if (kategori === logic.KATEGORI.BARANG) {
      if (docSet.jenisDokumen === logic.DOKUMEN.SPK) {
        await appendDoc(gen.buildSPKBarang, "SPK.docx");
      } else {
        await appendDoc(gen.buildSuratPerjanjianBarang, "SURAT_PERJANJIAN.docx");
        await appendDoc(gen.buildSSKKBarang, "SSKK.docx");
        archive.file(path.join(STATIC_DIR, "SSUK_Barang_2021.docx"), { name: "SSUK.docx" });
      }
    } else if (kategori === logic.KATEGORI.JASA_LAINNYA) {
      if (docSet.jenisDokumen === logic.DOKUMEN.SPK) {
        await appendDoc(gen.buildSPKJasaLainnya, "SPK.docx");
      } else {
        await appendDoc(gen.buildSuratPerjanjianJasaLainnya, "SURAT_PERJANJIAN.docx");
        await appendDoc(gen.buildSSKKJasaLainnya, "SSKK.docx");
        archive.file(path.join(STATIC_DIR, "SSUK_Jasa_Lainnya_2021.docx"), { name: "SSUK.docx" });
      }
    } else {
      if (docSet.jenisDokumen === logic.DOKUMEN.SPK) {
        await appendDoc(gen.buildSPKKonsultansiNonKonstruksi, "SPK.docx");
      } else {
        await appendDoc(gen.buildSuratPerjanjianKonsultansiNonKonstruksi, "SURAT_PERJANJIAN.docx");
        await appendDoc(gen.buildSSKKKonsultansiNonKonstruksi, "SSKK.docx");
        
        const isBadanUsaha = vendor.jenis === logic.JENIS_PENYEDIA.BADAN_USAHA;
        const ssukSrc = isBadanUsaha
          ? "SSUK_KonsultansiNonKonstruksi_BadanUsaha_2021.docx"
          : "SSUK_KonsultansiNonKonstruksi_Perorangan_2021.docx";
        archive.file(path.join(STATIC_DIR, ssukSrc), { name: "SSUK.docx" });
      }
    }

    if (docSet.perluSPMK) {
      await appendDoc(gen.buildSPMK, "SPMK.docx");
    }
    if (docSet.perluSPL) {
      await appendDoc(gen.buildSPL, "SPL_Serah_Terima_Lokasi_Kerja.docx");
    }

    await archive.finalize();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

module.exports = router;
