/**
 * contractLogic.js
 * Business rules untuk Sistem Informasi Pembuatan Kontrak Otomatis
 * Pemerintah Provinsi Papua Barat Daya
 *
 * Mendukung 2 kategori pekerjaan, masing-masing dengan ambang nilai & jenis
 * kontrak yang BERBEDA:
 *   1. Pekerjaan Konstruksi        (fisik/bangunan)
 *   2. Jasa Konsultansi Konstruksi (perencanaan/pengawasan/manajemen konstruksi)
 *
 * Rujukan aturan (ringkas, dipakai sebagai basis logika, BUKAN kutipan pasal):
 *  - Perpres 12/2021 jo. Perpres 16/2018 tentang Pengadaan Barang/Jasa Pemerintah
 *  - Peraturan LKPP No. 12 Tahun 2021 tentang Pedoman Pelaksanaan Pengadaan
 *    Barang/Jasa Pemerintah Melalui Penyedia
 *
 * Aturan inti yang diimplementasikan:
 *  1. PEKERJAAN KONSTRUKSI:
 *     - Nilai <= Rp200.000.000 -> SPK. Nilai > Rp200.000.000 -> Surat Perjanjian + SSUK + SSKK.
 *     - Jenis Kontrak: Harga Satuan atau Lumsum.
 *  2. JASA KONSULTANSI KONSTRUKSI:
 *     - Nilai <= Rp100.000.000 -> SPK. Nilai > Rp100.000.000 -> Surat Perjanjian + SSUK + SSKK.
 *       (Ambang lebih rendah dari pekerjaan konstruksi karena sifat jasa personil/keahlian.)
 *     - Jenis Kontrak: Lumsum atau Waktu Penugasan (time-based, dibayar per
 *       satuan waktu penugasan personil x billing rate).
 *  3. Untuk SPK, jenis penyedia menentukan template: Perorangan / Badan Usaha.
 *  4. SPMK wajib terbit di kedua kategori. SPL (serah terima lokasi kerja fisik)
 *     hanya relevan untuk Pekerjaan Konstruksi -- pada Jasa Konsultansi Konstruksi
 *     tidak wajib kecuali penyedia butuh akses ke lokasi proyek (mis. pengawasan).
 */

const KATEGORI = {
  KONSTRUKSI: "konstruksi",
  KONSULTANSI_KONSTRUKSI: "konsultansi_konstruksi",
  BARANG: "barang",
  JASA_LAINNYA: "jasa_lainnya",
  KONSULTANSI_NON_KONSTRUKSI: "konsultansi_non_konstruksi",
};

const SPK_MAX_VALUE = 200_000_000;              // ambang SPK/Pengadaan Langsung - Konstruksi, Barang & Jasa Lainnya
const SPK_MAX_VALUE_KONSULTANSI = 100_000_000;  // ambang SPK - Jasa Konsultansi (Konstruksi maupun Non-Konstruksi)

// Ambang nilai Pengadaan Langsung/SPK per kategori (Perpres 12/2021 jo. 16/2018:
// Barang/Konstruksi/Jasa Lainnya <= Rp200jt, Jasa Konsultansi <= Rp100jt).
const AMBANG_SPK_PER_KATEGORI = {
  [KATEGORI.KONSTRUKSI]: SPK_MAX_VALUE,
  [KATEGORI.BARANG]: SPK_MAX_VALUE,
  [KATEGORI.JASA_LAINNYA]: SPK_MAX_VALUE,
  [KATEGORI.KONSULTANSI_KONSTRUKSI]: SPK_MAX_VALUE_KONSULTANSI,
  [KATEGORI.KONSULTANSI_NON_KONSTRUKSI]: SPK_MAX_VALUE_KONSULTANSI,
};

const JENIS_KONTRAK = {
  HARGA_SATUAN: "harga_satuan",   // Pekerjaan Konstruksi, Barang & Jasa Lainnya
  LUMSUM: "lumsum",               // berlaku di semua kategori
  WAKTU_PENUGASAN: "waktu_penugasan", // khusus Jasa Konsultansi (Konstruksi & Non-Konstruksi)
};

const JENIS_KONTRAK_PER_KATEGORI = {
  [KATEGORI.KONSTRUKSI]: [JENIS_KONTRAK.HARGA_SATUAN, JENIS_KONTRAK.LUMSUM],
  [KATEGORI.KONSULTANSI_KONSTRUKSI]: [JENIS_KONTRAK.LUMSUM, JENIS_KONTRAK.WAKTU_PENUGASAN],
  [KATEGORI.BARANG]: [JENIS_KONTRAK.HARGA_SATUAN, JENIS_KONTRAK.LUMSUM],
  [KATEGORI.JASA_LAINNYA]: [JENIS_KONTRAK.HARGA_SATUAN, JENIS_KONTRAK.LUMSUM],
  [KATEGORI.KONSULTANSI_NON_KONSTRUKSI]: [JENIS_KONTRAK.LUMSUM, JENIS_KONTRAK.WAKTU_PENUGASAN],
};

const JENIS_PENYEDIA = {
  PERORANGAN: "perorangan",
  BADAN_USAHA: "badan_usaha",
};

const DOKUMEN = {
  SPK: "SPK",
  SURAT_PERJANJIAN: "SURAT_PERJANJIAN",
};

function validatePaketInput(paket) {
  const errors = [];
  const kategori = paket.jenis_pekerjaan || KATEGORI.KONSTRUKSI;
  if (!Object.values(KATEGORI).includes(kategori)) errors.push("Jenis pekerjaan tidak dikenali");
  if (!paket.nama_paket) errors.push("Nama paket pekerjaan wajib diisi");
  if (!paket.nilai_kontrak || Number(paket.nilai_kontrak) <= 0)
    errors.push("Nilai kontrak wajib diisi dan lebih besar dari 0");
  const opsiJenisKontrak = JENIS_KONTRAK_PER_KATEGORI[kategori] || [];
  if (!opsiJenisKontrak.includes(paket.jenis_kontrak))
    errors.push(`Jenis kontrak untuk kategori ini harus salah satu dari: ${opsiJenisKontrak.join(", ")}`);
  if (!Object.values(JENIS_PENYEDIA).includes(paket.jenis_penyedia))
    errors.push("Jenis penyedia harus 'perorangan' atau 'badan_usaha'");
  if (!paket.sumber_dana) errors.push("Sumber dana wajib diisi");
  return errors;
}

/**
 * Menentukan bentuk dokumen kontrak & kelengkapan lampirannya.
 */
function determineDocumentSet(paket) {
  const kategori = paket.jenis_pekerjaan || KATEGORI.KONSTRUKSI;
  const isKonsultansi = kategori === KATEGORI.KONSULTANSI_KONSTRUKSI;
  const isBarang = kategori === KATEGORI.BARANG;
  const ambang = AMBANG_SPK_PER_KATEGORI[kategori] || SPK_MAX_VALUE;

  const nilai = Number(paket.nilai_kontrak || 0);
  const isSPK = nilai <= ambang;

  const jenisDokumen = isSPK ? DOKUMEN.SPK : DOKUMEN.SURAT_PERJANJIAN;

  const warnings = [];
  if (!isSPK && paket.jenis_penyedia === JENIS_PENYEDIA.PERORANGAN) {
    warnings.push(
      "Nilai kontrak melebihi ambang SPK namun penyedia berstatus perorangan. " +
        "Umumnya paket bernilai besar mensyaratkan penyedia badan usaha bersertifikat/berbadan hukum. Mohon periksa kembali kualifikasi penyedia."
    );
  }
  const isKonsultansiApapun = isKonsultansi || kategori === KATEGORI.KONSULTANSI_NON_KONSTRUKSI;
  if (isKonsultansiApapun && paket.jenis_kontrak === JENIS_KONTRAK.WAKTU_PENUGASAN && !paket.billing_rate_info) {
    warnings.push(
      "Kontrak Waktu Penugasan sebaiknya melampirkan rincian billing rate per personil dan estimasi orang-bulan (person-month) pada SSKK/lampiran teknis."
    );
  }
  const isBarangAtauJasaLainnya = kategori === KATEGORI.BARANG || kategori === KATEGORI.JASA_LAINNYA;
  if (isBarangAtauJasaLainnya && !isSPK && !paket.jaminan_pelaksanaan_info) {
    warnings.push(
      `Kontrak ${kategori === KATEGORI.BARANG ? "Pengadaan Barang" : "Jasa Lainnya"} bernilai di atas ambang SPK umumnya mensyaratkan Jaminan Pelaksanaan. Pastikan data jaminan (nomor, penerbit, masa berlaku) dilengkapi sebelum kontrak difinalkan.`
    );
  }

  return {
    kategori, // 'konstruksi' | 'konsultansi_konstruksi' | 'barang'
    jenisDokumen, // 'SPK' | 'SURAT_PERJANJIAN'
    perluSSUK: !isSPK,
    perluSSKK: !isSPK,
    // SPMK wajib di ketiga kategori (titik mulai kerja/pengiriman). SPL (serah
    // terima lokasi fisik) wajib default hanya untuk Pekerjaan Konstruksi --
    // untuk Konsultansi & Barang bersifat opsional (mis. barang dengan instalasi
    // di lokasi, atau konsultansi pengawasan).
    perluSPMK: true,
    perluSPL: kategori === KATEGORI.KONSTRUKSI || !!paket.butuh_serah_terima_lokasi,
    templateUtama: buildTemplateKey(kategori, jenisDokumen, paket.jenis_penyedia, paket.jenis_kontrak),
    ambangSPK: ambang,
    warnings,
  };
}

/**
 * Memeriksa kelengkapan data sebelum generate, dan mengembalikan daftar field
 * yang masih kosong (akan tampil sebagai "……" di dokumen apabila dibiarkan).
 * Dipakai untuk menampilkan checklist peringatan di step Preview & Generate,
 * SEBELUM pengguna mengunduh dokumen -- supaya tidak perlu buka file dulu
 * untuk tahu bagian mana yang masih bolong.
 */
function checkKelengkapan({ paket, vendor, official }) {
  const kategori = paket?.jenis_pekerjaan || KATEGORI.KONSTRUKSI;
  const docSet = determineDocumentSet(paket || {});
  const isSPK = docSet.jenisDokumen === DOKUMEN.SPK;
  const isBadanUsaha = vendor?.jenis === JENIS_PENYEDIA.BADAN_USAHA;
  const missing = [];

  const check = (group, key, value, label) => {
    if (value === undefined || value === null || String(value).trim() === "") {
      missing.push({ group, key, label });
    }
  };

  // --- Paket ---
  check("Paket", "nomor_kontrak", paket?.nomor_kontrak, isSPK ? "Nomor SPK" : "Nomor Kontrak");
  check("Paket", "tanggal_kontrak", paket?.tanggal_kontrak, "Tanggal Penandatanganan Kontrak");
  check("Paket", "jangka_waktu_hari", paket?.jangka_waktu_hari, "Jangka Waktu Pelaksanaan/Penyerahan (hari)");
  check("Paket", "no_sppbj", paket?.no_sppbj, "Nomor SPPBJ");
  check("Paket", "tgl_sppbj", paket?.tgl_sppbj, "Tanggal SPPBJ");
  check("Paket", "nomor_spmk", paket?.nomor_spmk, "Nomor SPMK");
  check("Paket", "tanggal_spmk", paket?.tanggal_spmk, "Tanggal SPMK / Mulai Kerja");
  if (!isSPK) {
    check("Paket", "no_sp_pemenang", paket?.no_sp_pemenang, "Nomor Surat Penetapan Pemenang");
    check("Paket", "tgl_sp_pemenang", paket?.tgl_sp_pemenang, "Tanggal Surat Penetapan Pemenang");
  }
  if (docSet.perluSPL) {
    check("Paket", "lokasi_pekerjaan", paket?.lokasi_pekerjaan, "Lokasi Pekerjaan (untuk SPL)");
  }

  // --- Pejabat Penandatangan Kontrak (PPK) ---
  check("Pejabat (PPK)", "nama", official?.nama, "Nama Pejabat");
  check("Pejabat (PPK)", "nip", official?.nip, "NIP");
  check("Pejabat (PPK)", "jabatan", official?.jabatan, "Jabatan");
  check("Pejabat (PPK)", "satuan_kerja", official?.satuan_kerja, "Satuan Kerja");
  check("Pejabat (PPK)", "alamat", official?.alamat, "Alamat");
  if (!isSPK) {
    check("Pejabat (PPK)", "sk_pengangkatan.nomor", official?.sk_pengangkatan?.nomor, "Nomor SK Pengangkatan PPK");
    check("Pejabat (PPK)", "sk_pengangkatan.tanggal", official?.sk_pengangkatan?.tanggal, "Tanggal SK Pengangkatan PPK");
  }

  // --- Penyedia (Vendor) ---
  check("Penyedia", "nama", vendor?.nama, "Nama Penyedia");
  check("Penyedia", "alamat", vendor?.alamat, "Alamat Penyedia");
  if (isBadanUsaha) {
    check("Penyedia", "wakil.nama", vendor?.wakil?.nama, "Nama Wakil/Direktur");
    check("Penyedia", "wakil.jabatan", vendor?.wakil?.jabatan, "Jabatan Wakil/Direktur");
    check("Penyedia", "npwp", vendor?.npwp, "NPWP");
    if (!isSPK) {
      check("Penyedia", "akta_notaris.nomor", vendor?.akta_notaris?.nomor, "Nomor Akta Notaris");
      check("Penyedia", "akta_notaris.tanggal", vendor?.akta_notaris?.tanggal, "Tanggal Akta Notaris");
      check("Penyedia", "akta_notaris.notaris", vendor?.akta_notaris?.notaris, "Nama Notaris");
    }
  } else {
    check("Penyedia", "nomor_identitas", vendor?.nomor_identitas, "No. Kartu Identitas (KTP/SIM/Paspor)");
  }

  return {
    complete: missing.length === 0,
    missing,
    totalMissing: missing.length,
  };
}


function buildTemplateKey(kategori, jenisDokumen, jenisPenyedia, jenisKontrak) {
  const prefix = kategori === KATEGORI.KONSULTANSI_KONSTRUKSI ? "KONSULTANSI"
    : kategori === KATEGORI.KONSULTANSI_NON_KONSTRUKSI ? "KONSULTANSI_NON_KONSTRUKSI"
    : kategori === KATEGORI.BARANG ? "BARANG"
    : kategori === KATEGORI.JASA_LAINNYA ? "JASA_LAINNYA" : "KONSTRUKSI";
  if (jenisDokumen === DOKUMEN.SPK) {
    return `SPK_${prefix}_${jenisPenyedia === JENIS_PENYEDIA.BADAN_USAHA ? "BADAN_USAHA" : "PERORANGAN"}_${jenisKontrak.toUpperCase()}`;
  }
  return `SURAT_PERJANJIAN_${prefix}_${jenisKontrak.toUpperCase()}`;
}

/**
 * Terbilang sederhana (angka -> huruf) untuk nilai rupiah, dipakai di dokumen kontrak.
 */
const SATUAN = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan",
  "sepuluh", "sebelas"];

function terbilang(n) {
  n = Math.floor(Math.abs(Number(n)));
  if (n < 12) return SATUAN[n];
  if (n < 20) return terbilang(n - 10) + " belas";
  if (n < 100) return terbilang(Math.floor(n / 10)) + " puluh " + terbilang(n % 10);
  if (n < 200) return "seratus " + terbilang(n - 100);
  if (n < 1000) return terbilang(Math.floor(n / 100)) + " ratus " + terbilang(n % 100);
  if (n < 2000) return "seribu " + terbilang(n - 1000);
  if (n < 1_000_000) return terbilang(Math.floor(n / 1000)) + " ribu " + terbilang(n % 1000);
  if (n < 1_000_000_000)
    return terbilang(Math.floor(n / 1_000_000)) + " juta " + terbilang(n % 1_000_000);
  if (n < 1_000_000_000_000)
    return terbilang(Math.floor(n / 1_000_000_000)) + " miliar " + terbilang(n % 1_000_000_000);
  return terbilang(Math.floor(n / 1_000_000_000_000)) + " triliun " + terbilang(n % 1_000_000_000_000);
}

function rupiahTerbilang(n) {
  return terbilang(n).replace(/\s+/g, " ").trim() + " rupiah";
}

function formatRupiah(n) {
  return "Rp" + Number(n || 0).toLocaleString("id-ID");
}

const BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const HARI = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];

function tanggalIndonesia(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return { hari: "", tanggalAngka: "", tanggalHuruf: "", bulan: "", tahunAngka: "", tahunHuruf: "", formatted: "" };
  const hari = HARI[d.getDay()];
  const tgl = d.getDate();
  const bulan = BULAN[d.getMonth()];
  const tahun = d.getFullYear();
  return {
    hari,
    tanggalAngka: tgl,
    tanggalHuruf: terbilang(tgl),
    bulan,
    tahunAngka: tahun,
    tahunHuruf: terbilang(tahun),
    formatted: `${hari}, tanggal ${terbilang(tgl)} bulan ${bulan} tahun ${terbilang(tahun)}`,
  };
}

function tambahHariKalender(dateStr, hari) {
  const d = new Date(dateStr);
  if (isNaN(d) || !hari) return null;
  d.setDate(d.getDate() + Number(hari) - 1); // hari ke-1 = tanggal mulai
  return d;
}

module.exports = {
  KATEGORI,
  SPK_MAX_VALUE,
  SPK_MAX_VALUE_KONSULTANSI,
  AMBANG_SPK_PER_KATEGORI,
  JENIS_KONTRAK_PER_KATEGORI,
  tambahHariKalender,
  JENIS_KONTRAK,
  JENIS_PENYEDIA,
  DOKUMEN,
  validatePaketInput,
  determineDocumentSet,
  checkKelengkapan,
  buildTemplateKey,
  rupiahTerbilang,
  formatRupiah,
  tanggalIndonesia,
};
