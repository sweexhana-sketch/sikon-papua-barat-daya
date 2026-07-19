const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, HeadingLevel, ShadingType,
  PageOrientation, VerticalAlign,
} = require("docx");
const { rupiahTerbilang, formatRupiah, tanggalIndonesia, tambahHariKalender, JENIS_KONTRAK, JENIS_PENYEDIA, KATEGORI } = require("./contractLogic");

const FONT = "Arial";
const NOBORDER = { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } };

function p(text, opts = {}) {
  return new Paragraph({
    alignment: opts.align || AlignmentType.JUSTIFIED,
    spacing: { after: 120, ...(opts.spacing || {}) },
    children: [new TextRun({ text, bold: !!opts.bold, italics: !!opts.italics, size: opts.size || 22, font: FONT })],
  });
}

function titleP(text, size = 28) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text, bold: true, size, font: FONT })],
  });
}

// Two-column "label : value" row without visible borders (mirrors the LKPP layout)
function infoRow(label, value, labelWidth = 2500) {
  return new TableRow({
    children: [
      new TableCell({ width: { size: labelWidth, type: WidthType.DXA }, borders: NOBORDER, children: [p(label, { spacing: { after: 40 } })] }),
      new TableCell({ width: { size: 300, type: WidthType.DXA }, borders: NOBORDER, children: [p(":", { spacing: { after: 40 } })] }),
      new TableCell({ borders: NOBORDER, children: [p(value || "…………………………………", { spacing: { after: 40 } })] }),
    ],
  });
}

function infoTable(rows, labelWidth) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((r) => infoRow(r[0], r[1], labelWidth)),
  });
}

function signatureBlock(pihakKiri, pihakKanan) {
  const cell = (title, nama, jabatan, extra) =>
    new TableCell({
      borders: NOBORDER,
      children: [
        p(title, { align: AlignmentType.CENTER, bold: true }),
        p("", {}),
        p("", {}),
        p("", {}),
        p(nama || "…………………………………", { align: AlignmentType.CENTER, bold: true }),
        p(jabatan || "…………………………………", { align: AlignmentType.CENTER }),
        ...(extra ? [p(extra, { align: AlignmentType.CENTER })] : []),
      ],
    });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          cell(pihakKanan.label, pihakKanan.nama, pihakKanan.jabatan, pihakKanan.extra),
          cell(pihakKiri.label, pihakKiri.nama, pihakKiri.jabatan, pihakKiri.extra),
        ],
      }),
    ],
  });
}

function baseDoc(children) {
  return new Document({
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [
      {
        properties: { page: { size: { width: 11907, height: 16840 }, margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 } } },
        children,
      },
    ],
  });
}

/* ------------------------------------------------------------------ */
/*  SURAT PERJANJIAN (kontrak nilai > ambang SPK)                      */
/* ------------------------------------------------------------------ */
function buildSuratPerjanjian(ctx) {
  const { paket, vendor, official, jenisKontrakLabel } = ctx;
  const tgl = tanggalIndonesia(paket.tanggal_kontrak);

  const children = [
    titleP("SURAT PERJANJIAN"),
    titleP("PEKERJAAN KONSTRUKSI"),
    titleP(jenisKontrakLabel, 24),
    p("", {}),
    p("Paket Pekerjaan Konstruksi", { align: AlignmentType.CENTER, bold: true }),
    p(paket.nama_paket, { align: AlignmentType.CENTER, bold: true }),
    p(`Nomor: ${paket.nomor_kontrak || "…………………………"}`, { align: AlignmentType.CENTER }),
    p("", {}),
    p(
      `SURAT PERJANJIAN ini berikut semua lampirannya adalah Kontrak Kerja Konstruksi ${jenisKontrakLabel}, ` +
        `yang selanjutnya disebut "Kontrak", dibuat dan ditandatangani di ${paket.lokasi_ttd || "Kota Sorong"} pada ` +
        `${tgl.formatted || "…………………………"}, berdasarkan Surat Penetapan Pemenang Nomor ${paket.no_sp_pemenang || "……"} ` +
        `tanggal ${paket.tgl_sp_pemenang || "……"}, Surat Penunjukan Penyedia Barang/Jasa (SPPBJ) Nomor ${paket.no_sppbj || "……"} ` +
        `tanggal ${paket.tgl_sppbj || "……"}, antara:`
    ),
    infoTable([
      ["Nama", official.nama],
      ["NIP", official.nip],
      ["Jabatan", official.jabatan],
      ["Berkedudukan di", official.alamat],
    ]),
    p(
      `yang bertindak untuk dan atas nama Pemerintah Provinsi Papua Barat Daya c.q. ${official.satuan_kerja} ` +
        `berdasarkan Surat Keputusan Nomor ${official.sk_pengangkatan?.nomor || "……"} tanggal ${official.sk_pengangkatan?.tanggal || "……"} ` +
        `tentang ${official.sk_pengangkatan?.tentang || "……"}, selanjutnya disebut "Pejabat Penandatangan Kontrak", dengan:`
    ),
    infoTable([
      ["Nama", vendor.wakil?.nama],
      ["Jabatan", vendor.wakil?.jabatan],
      ["Berkedudukan di", vendor.alamat],
      ["Akta Notaris Nomor", vendor.akta_notaris?.nomor],
      ["Tanggal", vendor.akta_notaris?.tanggal],
      ["Notaris", vendor.akta_notaris?.notaris],
    ]),
    p(`yang bertindak untuk dan atas nama ${vendor.nama}, selanjutnya disebut "Penyedia".`),
    p("", {}),
    p(
      "Pejabat Penandatangan Kontrak dan Penyedia selanjutnya secara bersama-sama disebut \"Para Pihak\" dan " +
        "secara sendiri-sendiri disebut \"Pihak\", MENGINGAT BAHWA:"
    ),
    p("(a) Pejabat Penandatangan Kontrak telah meminta Penyedia untuk melaksanakan Pekerjaan Konstruksi sebagaimana diterangkan dalam Syarat-Syarat Umum Kontrak (SSUK) yang terlampir dalam Kontrak ini;"),
    p("(b) Penyedia sebagaimana dinyatakan kepada Pejabat Penandatangan Kontrak, memiliki keahlian profesional, personel, dan sumber daya teknis, serta telah menyetujui untuk melaksanakan Pekerjaan Konstruksi sesuai dengan persyaratan dan ketentuan dalam Kontrak ini;"),
    p("(c) Pejabat Penandatangan Kontrak dan Penyedia menyatakan memiliki kewenangan untuk menandatangani Kontrak ini, dan mengikat pihak yang diwakili;"),
    p("(d) Pejabat Penandatangan Kontrak dan Penyedia mengakui dan menyatakan bahwa sehubungan dengan penandatanganan Kontrak ini masing-masing pihak telah memenuhi syarat sesuai dengan peraturan perundang-undangan."),
    p("", {}),
    p("MAKA OLEH KARENA ITU, Para Pihak dengan ini bersepakat dan menyetujui hal-hal sebagai berikut:"),
    p("1. Total harga Kontrak atau Nilai Kontrak termasuk Pajak Pertambahan Nilai (PPN) yang diperlukan untuk penyelesaian pekerjaan sebagaimana diperinci dalam RAB adalah sebesar " +
      `${formatRupiah(paket.nilai_kontrak)} (${rupiahTerbilang(paket.nilai_kontrak)}).`),
    p(`2. Jangka waktu pelaksanaan pekerjaan ditetapkan selama ${paket.jangka_waktu_hari || "…"} (${terbilangSafe(paket.jangka_waktu_hari)}) hari kalender terhitung sejak tanggal mulai kerja yang tercantum dalam Surat Perintah Mulai Kerja (SPMK).`),
    p("3. Dokumen-dokumen berikut merupakan satu-kesatuan dan bagian yang tidak terpisahkan dari Kontrak ini:"),
    ...[
      "a. Adendum Surat Perjanjian (apabila ada);",
      "b. Pokok Perjanjian;",
      "c. Surat Penawaran, beserta penawaran harga;",
      "d. Syarat-Syarat Khusus Kontrak (SSKK);",
      "e. Syarat-Syarat Umum Kontrak (SSUK);",
      "f. Spesifikasi Teknis dan/atau Gambar;",
      `g. ${paket.jenis_kontrak === JENIS_KONTRAK.LUMSUM ? "Daftar Keluaran dan Harga" : "Daftar Kuantitas dan Harga (untuk Kontrak Harga Satuan atau Kontrak Gabungan Lumsum dan Harga Satuan);"};`,
      "h. Dokumen lainnya seperti: SPPBJ, BAHP/BAHPL, dan BAPP.",
    ].map((t) => p(t)),
    p("4. Urutan hierarki dokumen di atas dijadikan dasar untuk penentuan dan penafsiran apabila terjadi pertentangan antara ketentuan dalam dokumen-dokumen tersebut."),
    p("5. Hak dan kewajiban timbal balik Pejabat Penandatangan Kontrak dan Penyedia dinyatakan dalam Kontrak yang meliputi SSUK dan SSKK terlampir."),
    p("", {}),
    p("DENGAN DEMIKIAN, Pejabat Penandatangan Kontrak dan Penyedia telah bersepakat untuk menandatangani Kontrak ini pada tanggal tersebut di atas dan melaksanakan Kontrak sesuai dengan ketentuan peraturan perundang-undangan di Republik Indonesia."),
    p("", {}),
    signatureBlock(
      { label: "Untuk dan atas nama Penyedia", nama: vendor.wakil?.nama, jabatan: vendor.wakil?.jabatan },
      { label: "Untuk dan atas nama Pemerintah Provinsi Papua Barat Daya", nama: official.nama, jabatan: `${official.jabatan}${official.nip ? "\nNIP. " + official.nip : ""}` }
    ),
  ];
  return baseDoc(children);
}

/* ------------------------------------------------------------------ */
/*  SPK (nilai <= ambang)                                              */
/* ------------------------------------------------------------------ */
function buildSPK(ctx) {
  const { paket, vendor, official, jenisKontrakLabel } = ctx;
  const isBadanUsaha = vendor.jenis === JENIS_PENYEDIA.BADAN_USAHA;
  const tgl = tanggalIndonesia(paket.tanggal_kontrak);

  const header = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({ width: { size: 5000, type: WidthType.DXA }, children: [
            p("SURAT PERINTAH KERJA (SPK)", { bold: true, align: AlignmentType.CENTER }),
            p(`Satuan Kerja: ${official.satuan_kerja}`, { align: AlignmentType.CENTER, size: 20 }),
          ]}),
          new TableCell({ width: { size: 5000, type: WidthType.DXA }, children: [
            p("NOMOR DAN TANGGAL SPK", { bold: true, align: AlignmentType.CENTER }),
            p(`Nomor: ${paket.nomor_kontrak || "…………………"}`, { align: AlignmentType.CENTER, size: 20 }),
            p(`Tanggal: ${tgl.formatted || "…………………"}`, { align: AlignmentType.CENTER, size: 20 }),
          ]}),
        ],
      }),
    ],
  });

  const children = [
    titleP("SURAT PERINTAH KERJA (SPK)"),
    p(`PEKERJAAN KONSTRUKSI ${isBadanUsaha ? "BADAN USAHA" : "PERORANGAN"} JENIS KONTRAK ${jenisKontrakLabel.toUpperCase()}`, { align: AlignmentType.CENTER, italics: true }),
    p("", {}),
    header,
    p("", {}),
    p("PAKET PEKERJAAN:", { bold: true }),
    p(paket.nama_paket),
    p("", {}),
    infoTable([
      ["Nama PPK / Pejabat Penandatangan Kontrak", official.nama],
      ["NIP", official.nip],
      ["Jabatan", official.jabatan],
      ["Alamat", official.alamat],
    ], 3800),
    p("", {}),
    infoTable([
      ["Nama Penyedia", vendor.nama],
      [isBadanUsaha ? "Nama Wakil/Direktur" : "Nama Penyedia Perorangan", vendor.wakil?.nama],
      ["Alamat", vendor.alamat],
      ["NPWP", vendor.npwp],
    ], 3800),
    p("", {}),
    p(
      `Berdasarkan Surat Penunjukan Penyedia Barang/Jasa (SPPBJ) Nomor ${paket.no_sppbj || "……"} tanggal ${paket.tgl_sppbj || "……"}, ` +
        "bersama ini kami memerintahkan:"
    ),
    p(`${vendor.nama}`, { bold: true }),
    p(`untuk melaksanakan pekerjaan konstruksi "${paket.nama_paket}" dengan ketentuan sebagai berikut:`),
    p("", {}),
    p(`1. Total harga SPK termasuk PPN sebesar ${formatRupiah(paket.nilai_kontrak)} (${rupiahTerbilang(paket.nilai_kontrak)}).`),
    p(`2. Jenis Kontrak: ${jenisKontrakLabel}.`),
    p(`3. Jangka waktu pelaksanaan pekerjaan selama ${paket.jangka_waktu_hari || "…"} (${terbilangSafe(paket.jangka_waktu_hari)}) hari kalender sejak tanggal mulai kerja pada SPMK.`),
    p(`4. Sumber dana: ${paket.sumber_dana}.`),
    p("5. Penyedia berkewajiban untuk melaksanakan pekerjaan sesuai spesifikasi teknis dan gambar yang telah ditetapkan, serta tunduk pada ketentuan umum SPK sebagaimana lazimnya kontrak pengadaan pemerintah untuk pekerjaan bernilai kecil, meliputi ketentuan itikad baik, penggunaan dokumen kontrak, hak kekayaan intelektual, jaminan kualitas, pengawasan, jadwal, perubahan SPK, hak dan kewajiban para pihak, personel dan/atau peralatan, pembayaran, denda keterlambatan, penyelesaian perselisihan, serta keadaan kahar."),
    p("6. Dengan ditandatanganinya SPK ini, Penyedia menyatakan sanggup melaksanakan pekerjaan dengan sebaik-baiknya dan penuh tanggung jawab sesuai dengan Kontrak."),
    p("", {}),
    signatureBlock(
      { label: "Untuk dan atas nama Penyedia", nama: vendor.wakil?.nama || vendor.nama, jabatan: vendor.wakil?.jabatan },
      { label: "Pejabat Penandatangan Kontrak", nama: official.nama, jabatan: `${official.jabatan}${official.nip ? "\nNIP. " + official.nip : ""}` }
    ),
  ];
  return baseDoc(children);
}

/* ------------------------------------------------------------------ */
/*  SSKK - Syarat-Syarat Khusus Kontrak (hanya untuk Surat Perjanjian) */
/* ------------------------------------------------------------------ */
function buildSSKK(ctx) {
  const { paket, vendor, official, jenisKontrakLabel } = ctx;

  const row = (pasal, ketentuan, data) =>
    new TableRow({
      children: [
        new TableCell({ width: { size: 1200, type: WidthType.DXA }, children: [p(pasal, { align: AlignmentType.CENTER })] }),
        new TableCell({ width: { size: 2600, type: WidthType.DXA }, children: [p(ketentuan, { bold: true })] }),
        new TableCell({ children: data.map((d) => p(d, { spacing: { after: 60 } })) }),
      ],
    });

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({ shading: { type: ShadingType.CLEAR, fill: "D9D9D9" }, children: [p("Pasal SSUK", { bold: true, align: AlignmentType.CENTER })] }),
          new TableCell({ shading: { type: ShadingType.CLEAR, fill: "D9D9D9" }, children: [p("Ketentuan", { bold: true, align: AlignmentType.CENTER })] }),
          new TableCell({ shading: { type: ShadingType.CLEAR, fill: "D9D9D9" }, children: [p("Data / Pengaturan", { bold: true, align: AlignmentType.CENTER })] }),
        ],
      }),
      row("4.1 & 4.2", "Korespondensi", [
        `Satuan Kerja Pejabat Penandatangan Kontrak: ${official.satuan_kerja}`,
        `Nama: ${official.nama}`,
        `Alamat: ${official.alamat}`,
        `Penyedia: ${vendor.nama}`,
        `Nama yang menandatangani: ${vendor.wakil?.nama || ""}`,
        `Alamat: ${vendor.alamat}`,
        `Email: ${vendor.email || "-"}`,
      ]),
      row("6.1", "Wakil Sah Para Pihak", [
        `Pejabat Penandatangan Kontrak: ${official.nama}`,
        `Penyedia: ${vendor.wakil?.nama || ""}`,
      ]),
      row("7.1", "Jenis Kontrak", [jenisKontrakLabel]),
      row("11", "Jadwal Pelaksanaan Pekerjaan", [`${paket.jangka_waktu_hari || "…"} hari kalender sejak SPMK diterbitkan.`]),
      row("17.1", "Uang Muka", [
        paket.persentase_uang_muka
          ? `Diberikan uang muka sebesar ${paket.persentase_uang_muka}% dari Nilai Kontrak, yaitu ${formatRupiah((paket.nilai_kontrak * paket.persentase_uang_muka) / 100)}.`
          : "Tidak diberikan uang muka.",
      ]),
      row("18", "Pembayaran Prestasi Pekerjaan", [
        paket.jenis_kontrak === JENIS_KONTRAK.LUMSUM
          ? "Dilakukan berdasarkan capaian keluaran (output) sebagaimana disepakati dalam Kontrak."
          : "Dilakukan berdasarkan hasil pengukuran bersama atas volume pekerjaan yang benar-benar telah dilaksanakan (Monthly Certificate).",
      ]),
      row("23", "Denda Keterlambatan", ["1‰ (satu permil) per hari dari nilai Kontrak/bagian Kontrak sesuai ketentuan SSUK."]),
      row("35", "Sumber Dana", [paket.sumber_dana]),
      row("37", "Nilai Kontrak", [`${formatRupiah(paket.nilai_kontrak)} (${rupiahTerbilang(paket.nilai_kontrak)})`]),
    ],
  });

  const children = [
    titleP("SYARAT-SYARAT KHUSUS KONTRAK (SSKK)"),
    p(`PEKERJAAN KONSTRUKSI JENIS KONTRAK ${jenisKontrakLabel.toUpperCase()}`, { align: AlignmentType.CENTER, italics: true }),
    p(`Paket: ${paket.nama_paket}`, { align: AlignmentType.CENTER, bold: true }),
    p("", {}),
    p("SSKK berikut merupakan lampiran dan bagian yang tidak terpisahkan dari Surat Perjanjian, digunakan bersama Syarat-Syarat Umum Kontrak (SSUK) yang bersifat baku dan dilampirkan terpisah. Ketentuan dalam SSKK melengkapi, mengubah, atau menambah ketentuan dalam SSUK sesuai kebutuhan paket pekerjaan ini."),
    p("", {}),
    table,
  ];
  return baseDoc(children);
}

/* ------------------------------------------------------------------ */
/*  SPMK - Surat Perintah Mulai Kerja (wajib, kedua jalur kontrak)     */
/* ------------------------------------------------------------------ */
function buildSPMK(ctx) {
  const { paket, vendor, official, jenisKontrakLabel, kategori } = ctx;
  const tglMulai = tanggalIndonesia(paket.tanggal_spmk);
  const tglSelesaiDate = tambahHariKalender(paket.tanggal_spmk, paket.jangka_waktu_hari);
  const tglSelesai = tglSelesaiDate ? tanggalIndonesia(tglSelesaiDate.toISOString().slice(0, 10)) : null;
  const wakilNama = vendor.wakil?.nama || vendor.nama;
  const wakilJabatan = vendor.wakil?.jabatan || "";
  const poin5 = kategori === KATEGORI.BARANG
    ? "5. Penyedia wajib segera menyiapkan dan mengirimkan Barang sesuai spesifikasi teknis, jadwal pengiriman, dan kuantitas yang disepakati dalam Kontrak."
    : (kategori === KATEGORI.KONSULTANSI_KONSTRUKSI || kategori === KATEGORI.KONSULTANSI_NON_KONSTRUKSI)
      ? "5. Penyedia wajib segera menugaskan personil/tenaga ahli sesuai kualifikasi dan menyerahkan rencana kerja (jadwal penugasan) sesuai Kontrak."
      : kategori === KATEGORI.JASA_LAINNYA
        ? "5. Penyedia wajib segera menyiapkan sumber daya (personil/peralatan) dan memulai pelaksanaan layanan sesuai spesifikasi/Kerangka Acuan Kerja dan jadwal yang disepakati dalam Kontrak."
        : "5. Penyedia wajib segera menyusun dan menyerahkan Program Mutu, jadwal pelaksanaan (kurva-S), serta melakukan mobilisasi personel dan peralatan sesuai Kontrak.";

  const children = [
    titleP("SURAT PERINTAH MULAI KERJA (SPMK)"),
    p(`Nomor: ${paket.nomor_spmk || "…………………………"}`, { align: AlignmentType.CENTER }),
    p("", {}),
    infoTable([
      ["Paket Pekerjaan", paket.nama_paket],
      ["Nomor Kontrak/SPK", paket.nomor_kontrak],
      ["Jenis Kontrak", jenisKontrakLabel],
      ["Sumber Dana", paket.sumber_dana],
    ]),
    p("", {}),
    p(
      `Sehubungan dengan Surat Perjanjian/Surat Perintah Kerja Nomor ${paket.nomor_kontrak || "……"} untuk paket ` +
        `pekerjaan "${paket.nama_paket}", dengan ini Pejabat Penandatangan Kontrak memerintahkan:`
    ),
    p(`${vendor.nama}`, { bold: true }),
    p(`yang diwakili oleh ${wakilNama || "……"}${wakilJabatan ? " selaku " + wakilJabatan : ""}, untuk segera memulai pelaksanaan pekerjaan tersebut di atas, dengan ketentuan sebagai berikut:`),
    p("", {}),
    p(`1. Tanggal mulai kerja: ${tglMulai.formatted || "…………………"}.`),
    p(`2. Jangka waktu pelaksanaan pekerjaan: ${paket.jangka_waktu_hari || "…"} (${terbilangSafe(paket.jangka_waktu_hari)}) hari kalender.`),
    p(`3. Pekerjaan harus sudah selesai 100% (seratus persen) pada tanggal: ${tglSelesai?.formatted || "…………………"}.`),
    p("4. Keterlambatan penyelesaian pekerjaan dari jadwal yang ditetapkan akan dikenakan denda sesuai ketentuan dalam Kontrak."),
    p(poin5),
    p("", {}),
    signatureBlock(
      { label: "Menerima dan melaksanakan,\nuntuk dan atas nama Penyedia", nama: wakilNama, jabatan: wakilJabatan },
      { label: "Dikeluarkan di " + (paket.lokasi_ttd || "Kota Sorong") + "\npada tanggal " + (tglMulai.formatted || "…") + "\nPejabat Penandatangan Kontrak", nama: official.nama, jabatan: `${official.jabatan}${official.nip ? "\nNIP. " + official.nip : ""}` }
    ),
  ];
  return baseDoc(children);
}

/* ------------------------------------------------------------------ */
/*  SPL - Berita Acara Serah Terima Lokasi Kerja (wajib, kedua jalur)  */
/* ------------------------------------------------------------------ */
function buildSPL(ctx) {
  const { paket, vendor, official } = ctx;
  const tgl = tanggalIndonesia(paket.tanggal_spmk);

  const children = [
    titleP("BERITA ACARA SERAH TERIMA LOKASI KERJA"),
    p("(Surat Penyerahan Lokasi Kerja / SPL)", { align: AlignmentType.CENTER, italics: true }),
    p("", {}),
    p(
      `Pada hari ini, ${tgl.formatted || "…………………"}, bertempat di ${paket.lokasi_pekerjaan || paket.lokasi_ttd || "……"}, ` +
        "kami yang bertanda tangan di bawah ini:"
    ),
    p("", {}),
    infoTable([
      ["1. Nama", official.nama],
      ["Jabatan", `${official.jabatan}, selanjutnya disebut PIHAK PERTAMA`],
    ]),
    p("", {}),
    infoTable([
      ["2. Nama", vendor.wakil?.nama],
      ["Jabatan", `${vendor.wakil?.jabatan || "Wakil/Direktur"} ${vendor.nama}, selanjutnya disebut PIHAK KEDUA`],
    ]),
    p("", {}),
    p(
      `PIHAK PERTAMA dengan ini menyerahkan lokasi pekerjaan untuk paket "${paket.nama_paket}" kepada PIHAK KEDUA, ` +
        `beralamat/berlokasi di ${paket.lokasi_pekerjaan || "……………………………"}, dalam keadaan baik dan siap untuk dilaksanakan pekerjaan konstruksi sesuai Kontrak Nomor ${paket.nomor_kontrak || "……"}.`
    ),
    p("PIHAK KEDUA menyatakan telah menerima lokasi pekerjaan tersebut di atas dan bertanggung jawab penuh atas keamanan serta pelaksanaan pekerjaan di lokasi dimaksud terhitung sejak tanggal Berita Acara ini ditandatangani, sesuai dengan tanggal mulai kerja pada Surat Perintah Mulai Kerja (SPMK)."),
    p("Demikian Berita Acara Serah Terima Lokasi Kerja ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya."),
    p("", {}),
    signatureBlock(
      { label: "PIHAK KEDUA\nuntuk dan atas nama Penyedia", nama: vendor.wakil?.nama, jabatan: vendor.wakil?.jabatan },
      { label: "PIHAK PERTAMA\nPejabat Penandatangan Kontrak", nama: official.nama, jabatan: `${official.jabatan}${official.nip ? "\nNIP. " + official.nip : ""}` }
    ),
  ];
  return baseDoc(children);
}

/* ==================================================================== */
/*  JASA KONSULTANSI KONSTRUKSI                                         */
/*  (Perencanaan / Pengawasan / Manajemen Konstruksi)                   */
/* ==================================================================== */

function jenisKontrakKonsultansiLabel(jenisKontrak) {
  return jenisKontrak === JENIS_KONTRAK.WAKTU_PENUGASAN ? "Kontrak Waktu Penugasan" : "Kontrak Lumsum";
}

/* -------- SURAT PERJANJIAN JASA KONSULTANSI KONSTRUKSI (nilai > ambang) -------- */
function buildSuratPerjanjianKonsultansi(ctx) {
  const { paket, vendor, official, jenisKontrakLabel } = ctx;
  const tgl = tanggalIndonesia(paket.tanggal_kontrak);
  const isWaktuPenugasan = paket.jenis_kontrak === JENIS_KONTRAK.WAKTU_PENUGASAN;

  const children = [
    titleP("SURAT PERJANJIAN"),
    titleP("JASA KONSULTANSI KONSTRUKSI"),
    titleP(jenisKontrakLabel, 24),
    p("", {}),
    p("Paket Pekerjaan Jasa Konsultansi Konstruksi", { align: AlignmentType.CENTER, bold: true }),
    p(paket.nama_paket, { align: AlignmentType.CENTER, bold: true }),
    p(`Nomor: ${paket.nomor_kontrak || "…………………………"}`, { align: AlignmentType.CENTER }),
    p("", {}),
    p(
      `SURAT PERJANJIAN ini berikut semua lampirannya adalah Kontrak Jasa Konsultansi Konstruksi ${jenisKontrakLabel}, ` +
        `yang selanjutnya disebut "Kontrak", dibuat dan ditandatangani di ${paket.lokasi_ttd || "Kota Sorong"} pada ` +
        `${tgl.formatted || "…………………………"}, berdasarkan Surat Penetapan Pemenang Nomor ${paket.no_sp_pemenang || "……"} ` +
        `tanggal ${paket.tgl_sp_pemenang || "……"}, Surat Penunjukan Penyedia Barang/Jasa (SPPBJ) Nomor ${paket.no_sppbj || "……"} ` +
        `tanggal ${paket.tgl_sppbj || "……"}, antara:`
    ),
    infoTable([
      ["Nama", official.nama],
      ["NIP", official.nip],
      ["Jabatan", official.jabatan],
      ["Berkedudukan di", official.alamat],
    ]),
    p(
      `yang bertindak untuk dan atas nama Pemerintah Provinsi Papua Barat Daya c.q. ${official.satuan_kerja} ` +
        `berdasarkan Surat Keputusan Nomor ${official.sk_pengangkatan?.nomor || "……"} tanggal ${official.sk_pengangkatan?.tanggal || "……"} ` +
        `tentang ${official.sk_pengangkatan?.tentang || "……"}, selanjutnya disebut "Pejabat Penandatangan Kontrak", dengan:`
    ),
    infoTable([
      ["Nama", vendor.wakil?.nama],
      ["Jabatan", vendor.wakil?.jabatan],
      ["Berkedudukan di", vendor.alamat],
      ["Akta Notaris Nomor", vendor.akta_notaris?.nomor],
      ["Tanggal", vendor.akta_notaris?.tanggal],
      ["Notaris", vendor.akta_notaris?.notaris],
    ]),
    p(`yang bertindak untuk dan atas nama ${vendor.nama}, selanjutnya disebut "Penyedia Jasa Konsultansi".`),
    p("", {}),
    p(
      "Pejabat Penandatangan Kontrak dan Penyedia Jasa Konsultansi selanjutnya secara bersama-sama disebut " +
        "\"Para Pihak\" dan secara sendiri-sendiri disebut \"Pihak\", MENGINGAT BAHWA:"
    ),
    p("(a) Pejabat Penandatangan Kontrak telah meminta Penyedia untuk melaksanakan layanan Jasa Konsultansi Konstruksi sebagaimana diterangkan dalam Kerangka Acuan Kerja (KAK) dan Syarat-Syarat Umum Kontrak (SSUK) yang terlampir dalam Kontrak ini;"),
    p("(b) Penyedia sebagaimana dinyatakan kepada Pejabat Penandatangan Kontrak, memiliki keahlian profesional, tenaga ahli/personil, dan sumber daya yang memadai, serta telah menyetujui untuk melaksanakan layanan jasa konsultansi sesuai dengan persyaratan dan ketentuan dalam Kontrak ini;"),
    p("(c) Pejabat Penandatangan Kontrak dan Penyedia menyatakan memiliki kewenangan untuk menandatangani Kontrak ini, dan mengikat pihak yang diwakili;"),
    p("(d) Pejabat Penandatangan Kontrak dan Penyedia mengakui dan menyatakan bahwa sehubungan dengan penandatanganan Kontrak ini masing-masing pihak telah memenuhi syarat sesuai dengan peraturan perundang-undangan."),
    p("", {}),
    p("MAKA OLEH KARENA ITU, Para Pihak dengan ini bersepakat dan menyetujui hal-hal sebagai berikut:"),
    p(
      `1. Total nilai Kontrak termasuk Pajak Pertambahan Nilai (PPN) adalah sebesar ${formatRupiah(paket.nilai_kontrak)} ` +
        `(${rupiahTerbilang(paket.nilai_kontrak)}), ` +
        (isWaktuPenugasan
          ? "terdiri atas Biaya Langsung Personil (remunerasi tenaga ahli berdasarkan satuan waktu penugasan) dan Biaya Langsung Non-Personil, sebagaimana rincian pada SSKK dan lampiran teknis."
          : "merupakan nilai lumsum yang tidak berubah berdasarkan capaian keluaran (output) yang disepakati dalam Kontrak.")
    ),
    p(`2. Jangka waktu pelaksanaan layanan konsultansi ditetapkan selama ${paket.jangka_waktu_hari || "…"} (${terbilangSafe(paket.jangka_waktu_hari)}) hari kalender terhitung sejak tanggal mulai kerja yang tercantum dalam Surat Perintah Mulai Kerja (SPMK).`),
    p("3. Dokumen-dokumen berikut merupakan satu-kesatuan dan bagian yang tidak terpisahkan dari Kontrak ini:"),
    ...[
      "a. Adendum Surat Perjanjian (apabila ada);",
      "b. Pokok Perjanjian;",
      "c. Surat Penawaran, beserta penawaran biaya;",
      "d. Syarat-Syarat Khusus Kontrak (SSKK);",
      "e. Syarat-Syarat Umum Kontrak (SSUK);",
      "f. Kerangka Acuan Kerja (KAK);",
      isWaktuPenugasan
        ? "g. Daftar Personil dan Rincian Biaya Langsung Personil/Non-Personil;"
        : "g. Rincian Biaya Penawaran (Lumsum);",
      "h. Dokumen lainnya seperti: SPPBJ, BAHP/BAHPL, dan BAPP.",
    ].map((t) => p(t)),
    p("4. Urutan hierarki dokumen di atas dijadikan dasar untuk penentuan dan penafsiran apabila terjadi pertentangan antara ketentuan dalam dokumen-dokumen tersebut."),
    p("5. Hak dan kewajiban timbal balik Pejabat Penandatangan Kontrak dan Penyedia dinyatakan dalam Kontrak yang meliputi SSUK dan SSKK terlampir."),
    p("", {}),
    p("DENGAN DEMIKIAN, Pejabat Penandatangan Kontrak dan Penyedia telah bersepakat untuk menandatangani Kontrak ini pada tanggal tersebut di atas dan melaksanakan Kontrak sesuai dengan ketentuan peraturan perundang-undangan di Republik Indonesia."),
    p("", {}),
    signatureBlock(
      { label: "Untuk dan atas nama Penyedia Jasa Konsultansi", nama: vendor.wakil?.nama, jabatan: vendor.wakil?.jabatan },
      { label: "Untuk dan atas nama Pemerintah Provinsi Papua Barat Daya", nama: official.nama, jabatan: `${official.jabatan}${official.nip ? "\nNIP. " + official.nip : ""}` }
    ),
  ];
  return baseDoc(children);
}

/* -------- SPK JASA KONSULTANSI KONSTRUKSI (nilai <= ambang) -------- */
function buildSPKKonsultansi(ctx) {
  const { paket, vendor, official, jenisKontrakLabel } = ctx;
  const isBadanUsaha = vendor.jenis === JENIS_PENYEDIA.BADAN_USAHA;
  const isWaktuPenugasan = paket.jenis_kontrak === JENIS_KONTRAK.WAKTU_PENUGASAN;
  const tgl = tanggalIndonesia(paket.tanggal_kontrak);

  const header = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({ width: { size: 5000, type: WidthType.DXA }, children: [
            p("SURAT PERINTAH KERJA (SPK)", { bold: true, align: AlignmentType.CENTER }),
            p(`Satuan Kerja: ${official.satuan_kerja}`, { align: AlignmentType.CENTER, size: 20 }),
          ]}),
          new TableCell({ width: { size: 5000, type: WidthType.DXA }, children: [
            p("NOMOR DAN TANGGAL SPK", { bold: true, align: AlignmentType.CENTER }),
            p(`Nomor: ${paket.nomor_kontrak || "…………………"}`, { align: AlignmentType.CENTER, size: 20 }),
            p(`Tanggal: ${tgl.formatted || "…………………"}`, { align: AlignmentType.CENTER, size: 20 }),
          ]}),
        ],
      }),
    ],
  });

  const children = [
    titleP("SURAT PERINTAH KERJA (SPK)"),
    p(`JASA KONSULTANSI KONSTRUKSI ${isBadanUsaha ? "BADAN USAHA" : "PERORANGAN"} JENIS KONTRAK ${jenisKontrakLabel.toUpperCase()}`, { align: AlignmentType.CENTER, italics: true }),
    p("", {}),
    header,
    p("", {}),
    p("PAKET PEKERJAAN:", { bold: true }),
    p(paket.nama_paket),
    p("", {}),
    infoTable([
      ["Nama PPK / Pejabat Penandatangan Kontrak", official.nama],
      ["NIP", official.nip],
      ["Jabatan", official.jabatan],
      ["Alamat", official.alamat],
    ], 3800),
    p("", {}),
    infoTable([
      ["Nama Penyedia", vendor.nama],
      [isBadanUsaha ? "Nama Wakil/Direktur" : "Nama Konsultan Perorangan", vendor.wakil?.nama],
      ["Alamat", vendor.alamat],
      ["NPWP", vendor.npwp],
    ], 3800),
    p("", {}),
    p(
      `Berdasarkan Surat Penunjukan Penyedia Barang/Jasa (SPPBJ) Nomor ${paket.no_sppbj || "……"} tanggal ${paket.tgl_sppbj || "……"}, ` +
        "bersama ini kami memerintahkan:"
    ),
    p(`${vendor.nama}`, { bold: true }),
    p(`untuk melaksanakan layanan jasa konsultansi konstruksi "${paket.nama_paket}" dengan ketentuan sebagai berikut:`),
    p("", {}),
    p(`1. Total nilai SPK termasuk PPN sebesar ${formatRupiah(paket.nilai_kontrak)} (${rupiahTerbilang(paket.nilai_kontrak)}).`),
    p(`2. Jenis Kontrak: ${jenisKontrakLabel}${isWaktuPenugasan ? " (dibayar berdasarkan satuan waktu penugasan personil sesuai billing rate yang disepakati)" : " (dibayar berdasarkan keluaran/output sesuai Kerangka Acuan Kerja)"}.`),
    p(`3. Jangka waktu pelaksanaan layanan selama ${paket.jangka_waktu_hari || "…"} (${terbilangSafe(paket.jangka_waktu_hari)}) hari kalender sejak tanggal mulai kerja pada SPMK.`),
    p(`4. Sumber dana: ${paket.sumber_dana}.`),
    p("5. Penyedia berkewajiban melaksanakan layanan sesuai Kerangka Acuan Kerja (KAK), menugaskan personil/tenaga ahli sesuai kualifikasi yang disepakati, serta tunduk pada ketentuan umum SPK sebagaimana lazimnya kontrak jasa konsultansi pemerintah untuk pekerjaan bernilai kecil, meliputi ketentuan itikad baik, kerahasiaan, hak kekayaan intelektual, jaminan mutu layanan, pelaporan, jadwal penugasan, perubahan SPK, hak dan kewajiban para pihak, pembayaran, denda keterlambatan penyerahan laporan/keluaran, penyelesaian perselisihan, serta keadaan kahar."),
    p("6. Dengan ditandatanganinya SPK ini, Penyedia menyatakan sanggup melaksanakan layanan dengan sebaik-baiknya dan penuh tanggung jawab profesional sesuai dengan Kontrak."),
    p("", {}),
    signatureBlock(
      { label: "Untuk dan atas nama Penyedia", nama: vendor.wakil?.nama || vendor.nama, jabatan: vendor.wakil?.jabatan },
      { label: "Pejabat Penandatangan Kontrak", nama: official.nama, jabatan: `${official.jabatan}${official.nip ? "\nNIP. " + official.nip : ""}` }
    ),
  ];
  return baseDoc(children);
}

/* -------- SSKK JASA KONSULTANSI KONSTRUKSI (khusus, untuk Surat Perjanjian) -------- */
function buildSSKKKonsultansi(ctx) {
  const { paket, vendor, official, jenisKontrakLabel } = ctx;
  const isWaktuPenugasan = paket.jenis_kontrak === JENIS_KONTRAK.WAKTU_PENUGASAN;

  const row = (pasal, ketentuan, data) =>
    new TableRow({
      children: [
        new TableCell({ width: { size: 1200, type: WidthType.DXA }, children: [p(pasal, { align: AlignmentType.CENTER })] }),
        new TableCell({ width: { size: 2600, type: WidthType.DXA }, children: [p(ketentuan, { bold: true })] }),
        new TableCell({ children: data.map((d) => p(d, { spacing: { after: 60 } })) }),
      ],
    });

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({ shading: { type: ShadingType.CLEAR, fill: "D9D9D9" }, children: [p("Pasal SSUK", { bold: true, align: AlignmentType.CENTER })] }),
          new TableCell({ shading: { type: ShadingType.CLEAR, fill: "D9D9D9" }, children: [p("Ketentuan", { bold: true, align: AlignmentType.CENTER })] }),
          new TableCell({ shading: { type: ShadingType.CLEAR, fill: "D9D9D9" }, children: [p("Data / Pengaturan", { bold: true, align: AlignmentType.CENTER })] }),
        ],
      }),
      row("4.1 & 4.2", "Korespondensi", [
        `Satuan Kerja Pejabat Penandatangan Kontrak: ${official.satuan_kerja}`,
        `Nama: ${official.nama}`,
        `Alamat: ${official.alamat}`,
        `Penyedia: ${vendor.nama}`,
        `Nama yang menandatangani: ${vendor.wakil?.nama || ""}`,
        `Alamat: ${vendor.alamat}`,
        `Email: ${vendor.email || "-"}`,
      ]),
      row("6.1", "Wakil Sah Para Pihak", [
        `Pejabat Penandatangan Kontrak: ${official.nama}`,
        `Penyedia: ${vendor.wakil?.nama || ""}`,
      ]),
      row("7.1", "Jenis Kontrak", [jenisKontrakLabel]),
      row("9", "Personil/Tenaga Ahli", [
        paket.daftar_personil ||
          "Daftar personil, kualifikasi, dan jumlah orang-bulan (person-month) sesuai Kerangka Acuan Kerja (KAK) dan lampiran teknis penawaran.",
      ]),
      row("11", "Jadwal Pelaksanaan Layanan", [`${paket.jangka_waktu_hari || "…"} hari kalender sejak SPMK diterbitkan.`]),
      row("17.1", "Uang Muka", [
        paket.persentase_uang_muka
          ? `Diberikan uang muka sebesar ${paket.persentase_uang_muka}% dari Nilai Kontrak, yaitu ${formatRupiah((paket.nilai_kontrak * paket.persentase_uang_muka) / 100)}.`
          : "Tidak diberikan uang muka.",
      ]),
      row("18", "Pembayaran Prestasi Layanan", [
        isWaktuPenugasan
          ? "Dilakukan berdasarkan realisasi waktu penugasan personil (person-month) dikalikan billing rate yang disepakati, dibuktikan dengan Laporan Kegiatan Personil dan Berita Acara Prestasi Layanan."
          : "Dilakukan berdasarkan capaian keluaran (output/deliverable) sesuai tahapan pelaporan yang disepakati dalam Kerangka Acuan Kerja.",
      ]),
      row("19", "Pelaporan", ["Laporan Pendahuluan, Laporan Antara, dan Laporan Akhir (atau sesuai tahapan pada KAK), diserahkan sesuai jadwal yang disepakati."]),
      row("23", "Denda Keterlambatan", ["1‰ (satu permil) per hari dari nilai Kontrak/bagian Kontrak atas keterlambatan penyerahan laporan/keluaran, sesuai ketentuan SSUK."]),
      row("35", "Sumber Dana", [paket.sumber_dana]),
      row("37", "Nilai Kontrak", [`${formatRupiah(paket.nilai_kontrak)} (${rupiahTerbilang(paket.nilai_kontrak)})`]),
    ],
  });

  const children = [
    titleP("SYARAT-SYARAT KHUSUS KONTRAK (SSKK)"),
    p(`JASA KONSULTANSI KONSTRUKSI JENIS ${jenisKontrakLabel.toUpperCase()}`, { align: AlignmentType.CENTER, italics: true }),
    p(`Paket: ${paket.nama_paket}`, { align: AlignmentType.CENTER, bold: true }),
    p("", {}),
    p("SSKK berikut merupakan lampiran dan bagian yang tidak terpisahkan dari Surat Perjanjian, digunakan bersama Syarat-Syarat Umum Kontrak (SSUK) Jasa Konsultansi Konstruksi. Ketentuan dalam SSKK melengkapi, mengubah, atau menambah ketentuan dalam SSUK sesuai kebutuhan paket pekerjaan ini."),
    p("", {}),
    table,
  ];
  return baseDoc(children);
}

/* -------- SSUK JASA KONSULTANSI KONSTRUKSI ----------------------------
   CATATAN PENTING: Tidak seperti SSUK Pekerjaan Konstruksi (dilampirkan
   apa adanya dari file baku resmi yang diunggah), sistem BELUM memiliki
   file SSUK Jasa Konsultansi Konstruksi baku dari LKPP/Instansi. Kerangka
   di bawah ini disusun mengikuti struktur umum SSUK jasa konsultansi
   (definisi, hak kekayaan intelektual, personil, pelaporan, pembayaran,
   keadaan kahar, penyelesaian perselisihan) sebagai TITIK AWAL yang dapat
   dipakai, namun WAJIB diverifikasi/diganti dengan dokumen SSUK Jasa
   Konsultansi Konstruksi resmi bila Dinas memilikinya. -------------------- */
function buildSSUKKonsultansiKerangka(ctx) {
  const { paket } = ctx;
  const children = [
    titleP("SYARAT-SYARAT UMUM KONTRAK (SSUK)"),
    p("JASA KONSULTANSI KONSTRUKSI", { align: AlignmentType.CENTER, italics: true }),
    p("", {}),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({ children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: "FFF3CD" },
        children: [p(
          "CATATAN: Dokumen ini adalah KERANGKA UMUM SSUK Jasa Konsultansi Konstruksi yang disusun mengikuti struktur baku LKPP, " +
          "karena sistem belum memiliki file SSUK resmi untuk kategori Jasa Konsultansi Konstruksi (berbeda dari SSUK Pekerjaan Konstruksi " +
          "yang sudah dilampirkan apa adanya dari dokumen asli). Mohon verifikasi/ganti dengan dokumen SSUK baku resmi dari LKPP atau Biro " +
          "Hukum Instansi sebelum digunakan sebagai dasar kontrak yang sah.", { bold: true, spacing: { after: 0 } }
        )],
      })]})],
    }),
    p("", {}),
    ...[
      ["1. Definisi", "Istilah-istilah dalam SSUK ini mengikuti definisi umum pada peraturan pengadaan barang/jasa pemerintah yang berlaku, disesuaikan untuk konteks jasa konsultansi (Kerangka Acuan Kerja/KAK, Tenaga Ahli, Laporan, dsb)."],
      ["2. Ruang Lingkup Pekerjaan", "Penyedia melaksanakan layanan jasa konsultansi konstruksi sesuai Kerangka Acuan Kerja (KAK) yang menjadi bagian tidak terpisahkan dari Kontrak."],
      ["3. Standar", "Layanan dilaksanakan sesuai kaidah keprofesian, kode etik profesi terkait, dan standar teknis yang berlaku di bidang jasa konstruksi."],
      ["4. Personil", "Penyedia wajib menugaskan personil/tenaga ahli sesuai kualifikasi dalam penawaran. Penggantian personil hanya dapat dilakukan dengan persetujuan tertulis Pejabat Penandatangan Kontrak dan kualifikasi setara atau lebih baik."],
      ["5. Hak Kekayaan Intelektual", "Seluruh dokumen, laporan, gambar, dan produk hasil pekerjaan menjadi milik Pemerintah Provinsi Papua Barat Daya, kecuali diperjanjikan lain."],
      ["6. Kerahasiaan", "Penyedia wajib menjaga kerahasiaan seluruh data dan informasi yang diperoleh selama pelaksanaan pekerjaan."],
      ["7. Jadwal & Pelaporan", "Penyedia wajib menyerahkan laporan sesuai tahapan yang ditetapkan dalam KAK dan SSKK, tepat waktu dan sesuai format yang disepakati."],
      ["8. Pembayaran", "Dilaksanakan sesuai jenis kontrak (Lumsum atau Waktu Penugasan) sebagaimana diatur lebih lanjut dalam SSKK."],
      ["9. Perubahan Kontrak", "Perubahan lingkup, jadwal, atau nilai kontrak dituangkan dalam adendum tertulis yang disepakati Para Pihak."],
      ["10. Keadaan Kahar", "Pihak yang mengalami keadaan kahar dibebaskan dari kewajiban yang tertunda akibat keadaan kahar, dengan pemberitahuan tertulis paling lambat 14 (empat belas) hari kalender sejak kejadian."],
      ["11. Denda dan Ganti Rugi", "Keterlambatan penyerahan laporan/keluaran dikenakan denda sesuai ketentuan pada SSKK."],
      ["12. Penyelesaian Perselisihan", "Diselesaikan secara musyawarah; apabila tidak tercapai kesepakatan, diselesaikan melalui mekanisme yang diatur dalam Kontrak dan peraturan perundang-undangan."],
      ["13. Pemutusan Kontrak", "Dapat dilakukan oleh salah satu Pihak sesuai ketentuan wanprestasi yang diatur dalam Kontrak dan peraturan perundang-undangan pengadaan barang/jasa pemerintah."],
    ].map(([judul, isi]) => new Paragraph({ spacing: { after: 160 }, children: [
      new TextRun({ text: judul + "\n", bold: true, size: 22, font: FONT }),
      new TextRun({ text: isi, size: 22, font: FONT }),
    ]})),
    p(`Paket: ${paket.nama_paket}`, { italics: true, spacing: { before: 200 } }),
  ];
  return baseDoc(children);
}

/* ==================================================================== */
/*  PENGADAAN BARANG                                                     */
/* ==================================================================== */

function jenisKontrakBarangLabel(jenisKontrak) {
  return jenisKontrak === JENIS_KONTRAK.LUMSUM ? "Kontrak Lumsum" : "Kontrak Harga Satuan";
}

/* -------- SURAT PERJANJIAN PENGADAAN BARANG (nilai > ambang) --------
   Bercabang menurut jenis penyedia (Badan Usaha vs Perorangan) mengikuti
   2 varian dokumen baku yang diunggah: identitas Badan Usaha memakai Akta
   Notaris, sedangkan Perorangan memakai Kartu Identitas (KTP/SIM/Paspor). */
function buildSuratPerjanjianBarang(ctx) {
  const { paket, vendor, official, jenisKontrakLabel } = ctx;
  const tgl = tanggalIndonesia(paket.tanggal_kontrak);
  const isBadanUsaha = vendor.jenis === JENIS_PENYEDIA.BADAN_USAHA;

  const identitasPenyediaRows = isBadanUsaha
    ? [
        ["Nama", vendor.wakil?.nama],
        ["Jabatan", vendor.wakil?.jabatan],
        ["Berkedudukan di", vendor.alamat],
        ["Akta Notaris Nomor", vendor.akta_notaris?.nomor],
        ["Tanggal", vendor.akta_notaris?.tanggal],
        ["Notaris", vendor.akta_notaris?.notaris],
      ]
    : [
        ["Nama", vendor.nama],
        ["Berkedudukan di", vendor.alamat],
        ["No. Kartu Identitas (KTP/SIM/Paspor)", vendor.nomor_identitas],
      ];

  const children = [
    titleP("SURAT PERJANJIAN"),
    titleP(isBadanUsaha ? "PENGADAAN BARANG" : "PENYEDIA PERORANGAN"),
    isBadanUsaha ? null : titleP("untuk melaksanakan Pengadaan Barang", 22),
    titleP(jenisKontrakLabel, 24),
    p("", {}),
    p("Paket Pekerjaan Pengadaan Barang", { align: AlignmentType.CENTER, bold: true }),
    p(paket.nama_paket, { align: AlignmentType.CENTER, bold: true }),
    p(`Nomor: ${paket.nomor_kontrak || "…………………………"}`, { align: AlignmentType.CENTER }),
    p("", {}),
    p(
      `SURAT PERJANJIAN ini berikut semua lampirannya adalah Kontrak Pengadaan Barang ${jenisKontrakLabel}, ` +
        `yang selanjutnya disebut "Kontrak", dibuat dan ditandatangani di ${paket.lokasi_ttd || "Kota Sorong"} pada ` +
        `${tgl.formatted || "…………………………"}, berdasarkan Surat Penetapan Pemenang Nomor ${paket.no_sp_pemenang || "……"} ` +
        `tanggal ${paket.tgl_sp_pemenang || "……"}, Surat Penunjukan Penyedia Barang/Jasa (SPPBJ) Nomor ${paket.no_sppbj || "……"} ` +
        `tanggal ${paket.tgl_sppbj || "……"}, antara:`
    ),
    infoTable([
      ["Nama", official.nama],
      ["NIP", official.nip],
      ["Jabatan", official.jabatan],
      ["Berkedudukan di", official.alamat],
    ]),
    p(
      `yang bertindak untuk dan atas nama Pemerintah Provinsi Papua Barat Daya c.q. ${official.satuan_kerja} ` +
        `berdasarkan Surat Keputusan Nomor ${official.sk_pengangkatan?.nomor || "……"} tanggal ${official.sk_pengangkatan?.tanggal || "……"} ` +
        `tentang ${official.sk_pengangkatan?.tentang || "……"}, selanjutnya disebut "Pejabat Penandatangan Kontrak", dengan:`
    ),
    infoTable(identitasPenyediaRows),
    p(
      isBadanUsaha
        ? `yang bertindak untuk dan atas nama ${vendor.nama}, selanjutnya disebut "Penyedia".`
        : `selanjutnya disebut "Penyedia".`
    ),
    p("", {}),
    p(
      "Pejabat Penandatangan Kontrak dan Penyedia selanjutnya secara bersama-sama disebut \"Para Pihak\" dan " +
        "secara sendiri-sendiri disebut \"Pihak\", MENERANGKAN TERLEBIH DAHULU BAHWA:"
    ),
    p("(a) Telah diadakan proses pemilihan penyedia yang telah sesuai dengan Dokumen Pemilihan;"),
    p(`(b) Pejabat Penandatangan Kontrak telah menunjuk Penyedia melalui Surat Penunjukan Penyedia Barang/Jasa (SPPBJ) Nomor ${paket.no_sppbj || "……"} tanggal ${paket.tgl_sppbj || "……"}, untuk melaksanakan pekerjaan sebagaimana diterangkan dalam Syarat-Syarat Umum Kontrak, selanjutnya disebut "Pengadaan Barang";`),
    p("(c) Penyedia menyatakan memiliki keahlian profesional, personel, dan sumber daya teknis, serta telah menyetujui untuk melaksanakan Pengadaan Barang sesuai dengan persyaratan dan ketentuan dalam Kontrak ini;"),
    p("(d) Pejabat Penandatangan Kontrak dan Penyedia menyatakan memiliki kewenangan untuk menandatangani Kontrak ini, dan mengikat pihak yang diwakili."),
    p("", {}),
    p("MAKA OLEH KARENA ITU, Para Pihak dengan ini bersepakat dan menyetujui hal-hal sebagai berikut:"),
    p(`1. Total harga Kontrak atau Nilai Kontrak termasuk Pajak Pertambahan Nilai (PPN) yang diperlukan untuk penyelesaian Pengadaan Barang ini adalah sebesar ${formatRupiah(paket.nilai_kontrak)} (${rupiahTerbilang(paket.nilai_kontrak)}).`),
    p(`2. Jangka waktu penyerahan Barang ditetapkan selama ${paket.jangka_waktu_hari || "…"} (${terbilangSafe(paket.jangka_waktu_hari)}) hari kalender terhitung sejak tanggal mulai kerja yang tercantum dalam Surat Perintah Mulai Kerja (SPMK), dan dinyatakan selesai dengan diterbitkannya Berita Acara Serah Terima (BAST) Barang.`),
    p("3. Dokumen-dokumen berikut merupakan satu-kesatuan dan bagian yang tidak terpisahkan dari Kontrak ini:"),
    ...[
      "a. Adendum Surat Perjanjian (apabila ada);",
      "b. Pokok Perjanjian;",
      "c. Surat Penawaran, beserta penawaran harga;",
      "d. Syarat-Syarat Khusus Kontrak (SSKK);",
      "e. Syarat-Syarat Umum Kontrak (SSUK);",
      "f. Spesifikasi Teknis;",
      "g. Daftar Kuantitas dan Harga (apabila ada);",
      "h. Dokumen lainnya seperti: SPPBJ, BAHP/BAHPL, dan BAPP.",
    ].map((t) => p(t)),
    p("4. Urutan hierarki dokumen di atas dijadikan dasar untuk penentuan dan penafsiran apabila terjadi pertentangan antara ketentuan dalam dokumen-dokumen tersebut."),
    p("5. Hak dan kewajiban timbal balik Pejabat Penandatangan Kontrak dan Penyedia dinyatakan dalam Kontrak yang meliputi SSUK dan SSKK terlampir."),
    p("", {}),
    p("DENGAN DEMIKIAN, Pejabat Penandatangan Kontrak dan Penyedia telah bersepakat untuk menandatangani Kontrak ini pada tanggal tersebut di atas dan melaksanakan Kontrak sesuai dengan ketentuan peraturan perundang-undangan di Republik Indonesia."),
    p("", {}),
    signatureBlock(
      { label: "Untuk dan atas nama Penyedia", nama: isBadanUsaha ? vendor.wakil?.nama : vendor.nama, jabatan: isBadanUsaha ? vendor.wakil?.jabatan : "" },
      { label: "Untuk dan atas nama Pemerintah Provinsi Papua Barat Daya", nama: official.nama, jabatan: `${official.jabatan}${official.nip ? "\nNIP. " + official.nip : ""}` }
    ),
  ].filter(Boolean);
  return baseDoc(children);
}

/* -------- SPK PENGADAAN LANGSUNG BARANG (nilai <= ambang) -------- */
function buildSPKBarang(ctx) {
  const { paket, vendor, official, jenisKontrakLabel } = ctx;
  const isBadanUsaha = vendor.jenis === JENIS_PENYEDIA.BADAN_USAHA;
  const tgl = tanggalIndonesia(paket.tanggal_kontrak);

  const header = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({ width: { size: 5000, type: WidthType.DXA }, children: [
            p("SURAT PERINTAH KERJA (SPK)", { bold: true, align: AlignmentType.CENTER }),
            p("Pengadaan Langsung Barang", { align: AlignmentType.CENTER, size: 20, italics: true }),
            p(`Satuan Kerja: ${official.satuan_kerja}`, { align: AlignmentType.CENTER, size: 20 }),
          ]}),
          new TableCell({ width: { size: 5000, type: WidthType.DXA }, children: [
            p("NOMOR DAN TANGGAL SPK", { bold: true, align: AlignmentType.CENTER }),
            p(`Nomor: ${paket.nomor_kontrak || "…………………"}`, { align: AlignmentType.CENTER, size: 20 }),
            p(`Tanggal: ${tgl.formatted || "…………………"}`, { align: AlignmentType.CENTER, size: 20 }),
          ]}),
        ],
      }),
    ],
  });

  const children = [
    titleP("SURAT PERINTAH KERJA (SPK)"),
    p(`PENGADAAN LANGSUNG BARANG ${isBadanUsaha ? "BADAN USAHA" : "PERORANGAN"} JENIS KONTRAK ${jenisKontrakLabel.toUpperCase()}`, { align: AlignmentType.CENTER, italics: true }),
    p("", {}),
    header,
    p("", {}),
    p("PAKET PEKERJAAN:", { bold: true }),
    p(paket.nama_paket),
    p("", {}),
    infoTable([
      ["Nama PPK / Pejabat Penandatangan Kontrak", official.nama],
      ["NIP", official.nip],
      ["Jabatan", official.jabatan],
      ["Alamat", official.alamat],
    ], 3800),
    p("", {}),
    infoTable(isBadanUsaha ? [
      ["Nama Penyedia", vendor.nama],
      ["Nama Wakil/Direktur", vendor.wakil?.nama],
      ["Alamat", vendor.alamat],
      ["NPWP", vendor.npwp],
    ] : [
      ["Nama Penyedia (Perorangan)", vendor.nama],
      ["No. Kartu Identitas (KTP/SIM/Paspor)", vendor.nomor_identitas],
      ["Alamat", vendor.alamat],
    ], 3800),
    p("", {}),
    p(
      `Berdasarkan Surat Penunjukan Penyedia Barang/Jasa (SPPBJ) Nomor ${paket.no_sppbj || "……"} tanggal ${paket.tgl_sppbj || "……"}, ` +
        "bersama ini kami memerintahkan:"
    ),
    p(`${vendor.nama}`, { bold: true }),
    p(`untuk melaksanakan Pengadaan Barang "${paket.nama_paket}" dengan ketentuan sebagai berikut:`),
    p("", {}),
    p(`1. Total harga SPK termasuk PPN sebesar ${formatRupiah(paket.nilai_kontrak)} (${rupiahTerbilang(paket.nilai_kontrak)}).`),
    p(`2. Jenis Kontrak: ${jenisKontrakLabel}.`),
    p(`3. Jangka waktu penyerahan Barang selama ${paket.jangka_waktu_hari || "…"} (${terbilangSafe(paket.jangka_waktu_hari)}) hari kalender sejak tanggal mulai kerja pada SPMK, dinyatakan selesai dengan Berita Acara Serah Terima (BAST) Barang.`),
    p(`4. Sumber dana: ${paket.sumber_dana}.`),
    p("5. Penyedia berkewajiban menyerahkan Barang sesuai spesifikasi teknis yang telah ditetapkan, dalam kondisi baik dan lengkap, serta tunduk pada ketentuan umum SPK sebagaimana lazimnya kontrak pengadaan barang pemerintah untuk pekerjaan bernilai kecil, meliputi ketentuan itikad baik, pemeriksaan dan pengujian barang, garansi/purna jual (apabila ada), asuransi, pengepakan dan pengiriman, perubahan SPK, hak dan kewajiban para pihak, pembayaran, denda keterlambatan, penyelesaian perselisihan, serta keadaan kahar."),
    p("6. Dengan ditandatanganinya SPK ini, Penyedia menyatakan sanggup menyerahkan Barang dengan sebaik-baiknya dan penuh tanggung jawab sesuai dengan Kontrak."),
    p("", {}),
    signatureBlock(
      { label: "Untuk dan atas nama Penyedia", nama: isBadanUsaha ? (vendor.wakil?.nama || vendor.nama) : vendor.nama, jabatan: isBadanUsaha ? vendor.wakil?.jabatan : "" },
      { label: "Pejabat Penandatangan Kontrak", nama: official.nama, jabatan: `${official.jabatan}${official.nip ? "\nNIP. " + official.nip : ""}` }
    ),
  ];
  return baseDoc(children);
}

/* -------- SSKK PENGADAAN BARANG (khusus, untuk Surat Perjanjian) -------- */
function buildSSKKBarang(ctx) {
  const { paket, vendor, official, jenisKontrakLabel } = ctx;

  const row = (pasal, ketentuan, data) =>
    new TableRow({
      children: [
        new TableCell({ width: { size: 1200, type: WidthType.DXA }, children: [p(pasal, { align: AlignmentType.CENTER })] }),
        new TableCell({ width: { size: 2600, type: WidthType.DXA }, children: [p(ketentuan, { bold: true })] }),
        new TableCell({ children: data.map((d) => p(d, { spacing: { after: 60 } })) }),
      ],
    });

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({ shading: { type: ShadingType.CLEAR, fill: "D9D9D9" }, children: [p("Pasal SSUK", { bold: true, align: AlignmentType.CENTER })] }),
          new TableCell({ shading: { type: ShadingType.CLEAR, fill: "D9D9D9" }, children: [p("Ketentuan", { bold: true, align: AlignmentType.CENTER })] }),
          new TableCell({ shading: { type: ShadingType.CLEAR, fill: "D9D9D9" }, children: [p("Data / Pengaturan", { bold: true, align: AlignmentType.CENTER })] }),
        ],
      }),
      row("4.3.b", "Jaminan Pelaksanaan (bila dicairkan)", [
        `Disetor ke ${paket.kas_tujuan_jaminan || "Kas Daerah Provinsi Papua Barat Daya"}.`,
      ]),
      row("Korespondensi", "Alamat Para Pihak", [
        `Satuan Kerja Pejabat Penandatangan Kontrak: ${official.satuan_kerja}`,
        `Nama: ${official.nama}`,
        `Alamat: ${official.alamat}`,
        `Penyedia: ${vendor.nama}`,
        `Alamat: ${vendor.alamat}`,
        `Email: ${vendor.email || "-"}`,
      ]),
      row("Wakil Sah", "Wakil Sah Para Pihak", [
        `Pejabat Penandatangan Kontrak: ${official.nama}`,
        `Penyedia: ${vendor.jenis === JENIS_PENYEDIA.BADAN_USAHA ? (vendor.wakil?.nama || "") : vendor.nama}`,
      ]),
      row("-", "Jenis Kontrak", [jenisKontrakLabel]),
      row("30.2", "Jadwal & Lokasi Serah Terima Barang", [
        `Barang diserahkan paling lambat ${paket.jangka_waktu_hari || "…"} hari kalender sejak SPMK diterbitkan, bertempat di ${paket.lokasi_pekerjaan || "……………………………"}.`,
      ]),
      row("-", "Masa Garansi", [paket.masa_garansi || "Sesuai ketentuan produsen/spesifikasi teknis (apabila dipersyaratkan)."]),
      row("17.1", "Uang Muka", [
        paket.persentase_uang_muka
          ? `Diberikan uang muka sebesar ${paket.persentase_uang_muka}% dari Nilai Kontrak, yaitu ${formatRupiah((paket.nilai_kontrak * paket.persentase_uang_muka) / 100)}.`
          : "Tidak diberikan uang muka.",
      ]),
      row("59", "Pembayaran Prestasi Pekerjaan", [
        "Dilakukan berdasarkan Berita Acara Serah Terima (BAST) Barang yang telah diperiksa dan diterima sesuai spesifikasi teknis, secara sekaligus atau bertahap/termin sesuai kesepakatan.",
      ]),
      row("59", "Denda Keterlambatan", ["1‰ (satu permil) per hari dari nilai Kontrak/bagian Kontrak sesuai ketentuan SSUK."]),
      row("35", "Sumber Dana", [paket.sumber_dana]),
      row("37", "Nilai Kontrak", [`${formatRupiah(paket.nilai_kontrak)} (${rupiahTerbilang(paket.nilai_kontrak)})`]),
    ],
  });

  const children = [
    titleP("SYARAT-SYARAT KHUSUS KONTRAK (SSKK)"),
    p(`SURAT PERJANJIAN JENIS PENGADAAN BARANG — ${jenisKontrakLabel.toUpperCase()}`, { align: AlignmentType.CENTER, italics: true }),
    p(`Paket: ${paket.nama_paket}`, { align: AlignmentType.CENTER, bold: true }),
    p("", {}),
    p("SSKK berikut merupakan lampiran dan bagian yang tidak terpisahkan dari Surat Perjanjian, digunakan bersama Syarat-Syarat Umum Kontrak (SSUK) Pengadaan Barang yang bersifat baku dan dilampirkan terpisah. Ketentuan dalam SSKK melengkapi, mengubah, atau menambah ketentuan dalam SSUK sesuai kebutuhan paket pekerjaan ini."),
    p("", {}),
    table,
  ];
  return baseDoc(children);
}

/* ==================================================================== */
/*  PENGADAAN JASA LAINNYA (non-konstruksi)                             */
/* ==================================================================== */

function jenisKontrakJasaLainnyaLabel(jenisKontrak) {
  return jenisKontrak === JENIS_KONTRAK.LUMSUM ? "Kontrak Lumsum" : "Kontrak Harga Satuan";
}

/* -------- SURAT PERJANJIAN JASA LAINNYA (nilai > ambang) --------
   Bercabang menurut jenis penyedia (Badan Usaha vs Perorangan), sama
   seperti Pengadaan Barang: identitas Badan Usaha memakai Akta Notaris,
   Perorangan memakai Kartu Identitas (KTP/SIM/Paspor). */
function buildSuratPerjanjianJasaLainnya(ctx) {
  const { paket, vendor, official, jenisKontrakLabel } = ctx;
  const tgl = tanggalIndonesia(paket.tanggal_kontrak);
  const isBadanUsaha = vendor.jenis === JENIS_PENYEDIA.BADAN_USAHA;

  const identitasPenyediaRows = isBadanUsaha
    ? [
        ["Nama", vendor.wakil?.nama],
        ["Jabatan", vendor.wakil?.jabatan],
        ["Berkedudukan di", vendor.alamat],
        ["Akta Notaris Nomor", vendor.akta_notaris?.nomor],
        ["Tanggal", vendor.akta_notaris?.tanggal],
        ["Notaris", vendor.akta_notaris?.notaris],
      ]
    : [
        ["Nama", vendor.nama],
        ["Berkedudukan di", vendor.alamat],
        ["No. Kartu Identitas (KTP/SIM/Paspor)", vendor.nomor_identitas],
      ];

  const children = [
    titleP("SURAT PERJANJIAN"),
    titleP(isBadanUsaha ? "PENYEDIA BADAN USAHA" : "PENYEDIA PERORANGAN"),
    titleP("untuk melaksanakan Paket Pekerjaan Pengadaan Jasa Lainnya", 22),
    titleP(jenisKontrakLabel, 24),
    p("", {}),
    p("Paket Pekerjaan Pengadaan Jasa Lainnya", { align: AlignmentType.CENTER, bold: true }),
    p(paket.nama_paket, { align: AlignmentType.CENTER, bold: true }),
    p(`Nomor: ${paket.nomor_kontrak || "…………………………"}`, { align: AlignmentType.CENTER }),
    p("", {}),
    p(
      `SURAT PERJANJIAN ini berikut semua lampirannya adalah Kontrak Pengadaan Jasa Lainnya ${jenisKontrakLabel}, ` +
        `yang selanjutnya disebut "Kontrak", dibuat dan ditandatangani di ${paket.lokasi_ttd || "Kota Sorong"} pada ` +
        `${tgl.formatted || "…………………………"}, berdasarkan Surat Penetapan Pemenang Nomor ${paket.no_sp_pemenang || "……"} ` +
        `tanggal ${paket.tgl_sp_pemenang || "……"}, Surat Penunjukan Penyedia Barang/Jasa (SPPBJ) Nomor ${paket.no_sppbj || "……"} ` +
        `tanggal ${paket.tgl_sppbj || "……"}, antara:`
    ),
    infoTable([
      ["Nama", official.nama],
      ["NIP", official.nip],
      ["Jabatan", official.jabatan],
      ["Berkedudukan di", official.alamat],
    ]),
    p(
      `yang bertindak untuk dan atas nama Pemerintah Provinsi Papua Barat Daya c.q. ${official.satuan_kerja} ` +
        `berdasarkan Surat Keputusan Nomor ${official.sk_pengangkatan?.nomor || "……"} tanggal ${official.sk_pengangkatan?.tanggal || "……"} ` +
        `tentang ${official.sk_pengangkatan?.tentang || "……"}, selanjutnya disebut "Pejabat Penandatangan Kontrak", dengan:`
    ),
    infoTable(identitasPenyediaRows),
    p(
      isBadanUsaha
        ? `yang bertindak untuk dan atas nama ${vendor.nama}, selanjutnya disebut "Penyedia".`
        : `selanjutnya disebut "Penyedia".`
    ),
    p("", {}),
    p(
      "Pejabat Penandatangan Kontrak dan Penyedia selanjutnya secara bersama-sama disebut \"Para Pihak\" dan " +
        "secara sendiri-sendiri disebut \"Pihak\", MENERANGKAN TERLEBIH DAHULU BAHWA:"
    ),
    p("(a) Telah diadakan proses pemilihan penyedia yang telah sesuai dengan Dokumen Pemilihan;"),
    p(`(b) Pejabat Penandatangan Kontrak telah menunjuk Penyedia melalui Surat Penunjukan Penyedia Barang/Jasa (SPPBJ) Nomor ${paket.no_sppbj || "……"} tanggal ${paket.tgl_sppbj || "……"}, untuk melaksanakan pekerjaan sebagaimana diterangkan dalam Syarat-Syarat Umum Kontrak, selanjutnya disebut "Pengadaan Jasa Lainnya";`),
    p("(c) Penyedia menyatakan memiliki keahlian profesional, personel, dan sumber daya yang memadai, serta telah menyetujui untuk melaksanakan Pengadaan Jasa Lainnya sesuai dengan persyaratan dan ketentuan dalam Kontrak ini;"),
    p("(d) Pejabat Penandatangan Kontrak dan Penyedia menyatakan memiliki kewenangan untuk menandatangani Kontrak ini, dan mengikat pihak yang diwakili."),
    p("", {}),
    p("MAKA OLEH KARENA ITU, Para Pihak dengan ini bersepakat dan menyetujui hal-hal sebagai berikut:"),
    p(`1. Total harga Kontrak atau Nilai Kontrak termasuk Pajak Pertambahan Nilai (PPN) yang diperlukan untuk penyelesaian Pengadaan Jasa Lainnya ini adalah sebesar ${formatRupiah(paket.nilai_kontrak)} (${rupiahTerbilang(paket.nilai_kontrak)}).`),
    p(`2. Jangka waktu pelaksanaan layanan ditetapkan selama ${paket.jangka_waktu_hari || "…"} (${terbilangSafe(paket.jangka_waktu_hari)}) hari kalender terhitung sejak tanggal mulai kerja yang tercantum dalam Surat Perintah Mulai Kerja (SPMK), dan dinyatakan selesai dengan diterbitkannya Berita Acara Serah Terima Hasil Pekerjaan.`),
    p("3. Dokumen-dokumen berikut merupakan satu-kesatuan dan bagian yang tidak terpisahkan dari Kontrak ini:"),
    ...[
      "a. Adendum Surat Perjanjian (apabila ada);",
      "b. Pokok Perjanjian;",
      "c. Surat Penawaran, beserta penawaran harga;",
      "d. Syarat-Syarat Khusus Kontrak (SSKK);",
      "e. Syarat-Syarat Umum Kontrak (SSUK);",
      "f. Kerangka Acuan Kerja/Spesifikasi Teknis;",
      "g. Daftar Kuantitas dan Harga (apabila ada);",
      "h. Dokumen lainnya seperti: SPPBJ, BAHP/BAHPL, dan BAPP.",
    ].map((t) => p(t)),
    p("4. Urutan hierarki dokumen di atas dijadikan dasar untuk penentuan dan penafsiran apabila terjadi pertentangan antara ketentuan dalam dokumen-dokumen tersebut."),
    p("5. Hak dan kewajiban timbal balik Pejabat Penandatangan Kontrak dan Penyedia dinyatakan dalam Kontrak yang meliputi SSUK dan SSKK terlampir."),
    p("", {}),
    p("DENGAN DEMIKIAN, Pejabat Penandatangan Kontrak dan Penyedia telah bersepakat untuk menandatangani Kontrak ini pada tanggal tersebut di atas dan melaksanakan Kontrak sesuai dengan ketentuan peraturan perundang-undangan di Republik Indonesia."),
    p("", {}),
    signatureBlock(
      { label: "Untuk dan atas nama Penyedia", nama: isBadanUsaha ? vendor.wakil?.nama : vendor.nama, jabatan: isBadanUsaha ? vendor.wakil?.jabatan : "" },
      { label: "Untuk dan atas nama Pemerintah Provinsi Papua Barat Daya", nama: official.nama, jabatan: `${official.jabatan}${official.nip ? "\nNIP. " + official.nip : ""}` }
    ),
  ];
  return baseDoc(children);
}

/* -------- SPK PENGADAAN LANGSUNG JASA LAINNYA (nilai <= ambang) -------- */
function buildSPKJasaLainnya(ctx) {
  const { paket, vendor, official, jenisKontrakLabel } = ctx;
  const isBadanUsaha = vendor.jenis === JENIS_PENYEDIA.BADAN_USAHA;
  const tgl = tanggalIndonesia(paket.tanggal_kontrak);

  const header = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({ width: { size: 5000, type: WidthType.DXA }, children: [
            p("SURAT PERINTAH KERJA (SPK)", { bold: true, align: AlignmentType.CENTER }),
            p("Pengadaan Langsung Jasa Lainnya", { align: AlignmentType.CENTER, size: 20, italics: true }),
            p(`Satuan Kerja: ${official.satuan_kerja}`, { align: AlignmentType.CENTER, size: 20 }),
          ]}),
          new TableCell({ width: { size: 5000, type: WidthType.DXA }, children: [
            p("NOMOR DAN TANGGAL SPK", { bold: true, align: AlignmentType.CENTER }),
            p(`Nomor: ${paket.nomor_kontrak || "…………………"}`, { align: AlignmentType.CENTER, size: 20 }),
            p(`Tanggal: ${tgl.formatted || "…………………"}`, { align: AlignmentType.CENTER, size: 20 }),
          ]}),
        ],
      }),
    ],
  });

  const children = [
    titleP("SURAT PERINTAH KERJA (SPK)"),
    p(`PENGADAAN LANGSUNG JASA LAINNYA ${isBadanUsaha ? "BADAN USAHA" : "PERORANGAN"} JENIS KONTRAK ${jenisKontrakLabel.toUpperCase()}`, { align: AlignmentType.CENTER, italics: true }),
    p("", {}),
    header,
    p("", {}),
    p("PAKET PEKERJAAN:", { bold: true }),
    p(paket.nama_paket),
    p("", {}),
    infoTable([
      ["Nama PPK / Pejabat Penandatangan Kontrak", official.nama],
      ["NIP", official.nip],
      ["Jabatan", official.jabatan],
      ["Alamat", official.alamat],
    ], 3800),
    p("", {}),
    infoTable(isBadanUsaha ? [
      ["Nama Penyedia", vendor.nama],
      ["Nama Wakil/Direktur", vendor.wakil?.nama],
      ["Alamat", vendor.alamat],
      ["NPWP", vendor.npwp],
    ] : [
      ["Nama Penyedia (Perorangan)", vendor.nama],
      ["No. Kartu Identitas (KTP/SIM/Paspor)", vendor.nomor_identitas],
      ["Alamat", vendor.alamat],
    ], 3800),
    p("", {}),
    p(
      `Berdasarkan Surat Penunjukan Penyedia Barang/Jasa (SPPBJ) Nomor ${paket.no_sppbj || "……"} tanggal ${paket.tgl_sppbj || "……"}, ` +
        "bersama ini kami memerintahkan:"
    ),
    p(`${vendor.nama}`, { bold: true }),
    p(`untuk melaksanakan Pengadaan Jasa Lainnya "${paket.nama_paket}" dengan ketentuan sebagai berikut:`),
    p("", {}),
    p(`1. Total harga SPK termasuk PPN sebesar ${formatRupiah(paket.nilai_kontrak)} (${rupiahTerbilang(paket.nilai_kontrak)}).`),
    p(`2. Jenis Kontrak: ${jenisKontrakLabel}.`),
    p(`3. Jangka waktu pelaksanaan layanan selama ${paket.jangka_waktu_hari || "…"} (${terbilangSafe(paket.jangka_waktu_hari)}) hari kalender sejak tanggal mulai kerja pada SPMK, dinyatakan selesai dengan Berita Acara Serah Terima Hasil Pekerjaan.`),
    p(`4. Sumber dana: ${paket.sumber_dana}.`),
    p("5. Penyedia berkewajiban melaksanakan layanan sesuai spesifikasi/Kerangka Acuan Kerja yang telah ditetapkan, serta tunduk pada ketentuan umum SPK sebagaimana lazimnya kontrak pengadaan jasa lainnya pemerintah untuk pekerjaan bernilai kecil, meliputi ketentuan itikad baik, standar layanan, asuransi (apabila dipersyaratkan), perubahan SPK, hak dan kewajiban para pihak, pembayaran, denda keterlambatan, penyelesaian perselisihan, serta keadaan kahar."),
    p("6. Dengan ditandatanganinya SPK ini, Penyedia menyatakan sanggup melaksanakan layanan dengan sebaik-baiknya dan penuh tanggung jawab sesuai dengan Kontrak."),
    p("", {}),
    signatureBlock(
      { label: "Untuk dan atas nama Penyedia", nama: isBadanUsaha ? (vendor.wakil?.nama || vendor.nama) : vendor.nama, jabatan: isBadanUsaha ? vendor.wakil?.jabatan : "" },
      { label: "Pejabat Penandatangan Kontrak", nama: official.nama, jabatan: `${official.jabatan}${official.nip ? "\nNIP. " + official.nip : ""}` }
    ),
  ];
  return baseDoc(children);
}

/* -------- SSKK JASA LAINNYA (khusus, untuk Surat Perjanjian) -------- */
function buildSSKKJasaLainnya(ctx) {
  const { paket, vendor, official, jenisKontrakLabel } = ctx;

  const row = (pasal, ketentuan, data) =>
    new TableRow({
      children: [
        new TableCell({ width: { size: 1200, type: WidthType.DXA }, children: [p(pasal, { align: AlignmentType.CENTER })] }),
        new TableCell({ width: { size: 2600, type: WidthType.DXA }, children: [p(ketentuan, { bold: true })] }),
        new TableCell({ children: data.map((d) => p(d, { spacing: { after: 60 } })) }),
      ],
    });

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({ shading: { type: ShadingType.CLEAR, fill: "D9D9D9" }, children: [p("Pasal SSUK", { bold: true, align: AlignmentType.CENTER })] }),
          new TableCell({ shading: { type: ShadingType.CLEAR, fill: "D9D9D9" }, children: [p("Ketentuan", { bold: true, align: AlignmentType.CENTER })] }),
          new TableCell({ shading: { type: ShadingType.CLEAR, fill: "D9D9D9" }, children: [p("Data / Pengaturan", { bold: true, align: AlignmentType.CENTER })] }),
        ],
      }),
      row("4.3.b", "Jaminan Pelaksanaan (bila dicairkan)", [
        `Disetor ke ${paket.kas_tujuan_jaminan || "Kas Daerah Provinsi Papua Barat Daya"}.`,
      ]),
      row("Korespondensi", "Alamat Para Pihak", [
        `Satuan Kerja Pejabat Penandatangan Kontrak: ${official.satuan_kerja}`,
        `Nama: ${official.nama}`,
        `Alamat: ${official.alamat}`,
        `Penyedia: ${vendor.nama}`,
        `Alamat: ${vendor.alamat}`,
        `Email: ${vendor.email || "-"}`,
      ]),
      row("Wakil Sah", "Wakil Sah Para Pihak", [
        `Pejabat Penandatangan Kontrak: ${official.nama}`,
        `Penyedia: ${vendor.jenis === JENIS_PENYEDIA.BADAN_USAHA ? (vendor.wakil?.nama || "") : vendor.nama}`,
      ]),
      row("-", "Jenis Kontrak", [jenisKontrakLabel]),
      row("-", "Jadwal & Lokasi Pelaksanaan", [
        `Layanan dilaksanakan paling lambat ${paket.jangka_waktu_hari || "…"} hari kalender sejak SPMK diterbitkan, bertempat di ${paket.lokasi_pekerjaan || "……………………………"}.`,
      ]),
      row("17.1", "Uang Muka", [
        paket.persentase_uang_muka
          ? `Diberikan uang muka sebesar ${paket.persentase_uang_muka}% dari Nilai Kontrak, yaitu ${formatRupiah((paket.nilai_kontrak * paket.persentase_uang_muka) / 100)}.`
          : "Tidak diberikan uang muka.",
      ]),
      row("-", "Pembayaran Prestasi Pekerjaan", [
        "Dilakukan berdasarkan Berita Acara Serah Terima Hasil Pekerjaan yang telah diperiksa dan diterima sesuai spesifikasi/KAK, secara sekaligus atau bertahap/termin sesuai kesepakatan.",
      ]),
      row("-", "Denda Keterlambatan", ["1‰ (satu permil) per hari dari nilai Kontrak/bagian Kontrak sesuai ketentuan SSUK."]),
      row("35", "Sumber Dana", [paket.sumber_dana]),
      row("37", "Nilai Kontrak", [`${formatRupiah(paket.nilai_kontrak)} (${rupiahTerbilang(paket.nilai_kontrak)})`]),
    ],
  });

  const children = [
    titleP("SYARAT-SYARAT KHUSUS KONTRAK (SSKK)"),
    p(`SURAT PERJANJIAN JENIS PENGADAAN JASA LAINNYA — ${jenisKontrakLabel.toUpperCase()}`, { align: AlignmentType.CENTER, italics: true }),
    p(`Paket: ${paket.nama_paket}`, { align: AlignmentType.CENTER, bold: true }),
    p("", {}),
    p("SSKK berikut merupakan lampiran dan bagian yang tidak terpisahkan dari Surat Perjanjian, digunakan bersama Syarat-Syarat Umum Kontrak (SSUK) Pengadaan Jasa Lainnya yang bersifat baku dan dilampirkan terpisah. Ketentuan dalam SSKK melengkapi, mengubah, atau menambah ketentuan dalam SSUK sesuai kebutuhan paket pekerjaan ini."),
    p("", {}),
    table,
  ];
  return baseDoc(children);
}

/* ==================================================================== */
/*  JASA KONSULTANSI NON-KONSTRUKSI                                     */
/*  (kajian, studi, audit, pelatihan, dsb — di luar bidang konstruksi)  */
/* ==================================================================== */

function jenisKontrakKonsultansiNonKonstruksiLabel(jenisKontrak) {
  return jenisKontrak === JENIS_KONTRAK.WAKTU_PENUGASAN ? "Kontrak Waktu Penugasan" : "Kontrak Lumsum";
}

/* -------- SURAT PERJANJIAN JASA KONSULTANSI NON-KONSTRUKSI (nilai > ambang) --------
   Badan Usaha: "Non-Kemitraan" (mengikuti judul dokumen baku yang diunggah;
   varian Kemitraan/KSO dapat ditambahkan kelak bila dibutuhkan).
   Perorangan: identitas memakai Kartu Identitas (KTP/SIM/Paspor). */
function buildSuratPerjanjianKonsultansiNonKonstruksi(ctx) {
  const { paket, vendor, official, jenisKontrakLabel } = ctx;
  const tgl = tanggalIndonesia(paket.tanggal_kontrak);
  const isBadanUsaha = vendor.jenis === JENIS_PENYEDIA.BADAN_USAHA;
  const isWaktuPenugasan = paket.jenis_kontrak === JENIS_KONTRAK.WAKTU_PENUGASAN;

  const identitasPenyediaRows = isBadanUsaha
    ? [
        ["Nama", vendor.wakil?.nama],
        ["Jabatan", vendor.wakil?.jabatan],
        ["Berkedudukan di", vendor.alamat],
        ["Akta Notaris Nomor", vendor.akta_notaris?.nomor],
        ["Tanggal", vendor.akta_notaris?.tanggal],
        ["Notaris", vendor.akta_notaris?.notaris],
      ]
    : [
        ["Nama", vendor.nama],
        ["Berkedudukan di", vendor.alamat],
        ["No. Kartu Identitas (KTP/SIM/Paspor)", vendor.nomor_identitas],
      ];

  const children = [
    titleP("SURAT PERJANJIAN"),
    titleP(isBadanUsaha ? "BADAN USAHA NON-KEMITRAAN" : "PENYEDIA PERORANGAN"),
    titleP("untuk melaksanakan Paket Pekerjaan Pengadaan Jasa Konsultansi", 22),
    titleP(jenisKontrakLabel, 24),
    p("", {}),
    p("Paket Pekerjaan Pengadaan Jasa Konsultansi", { align: AlignmentType.CENTER, bold: true }),
    p(paket.nama_paket, { align: AlignmentType.CENTER, bold: true }),
    p(`Nomor: ${paket.nomor_kontrak || "…………………………"}`, { align: AlignmentType.CENTER }),
    p("", {}),
    p(
      `SURAT PERJANJIAN ini berikut semua lampirannya adalah Kontrak Jasa Konsultansi Non-Konstruksi ${jenisKontrakLabel}, ` +
        `yang selanjutnya disebut "Kontrak", dibuat dan ditandatangani di ${paket.lokasi_ttd || "Kota Sorong"} pada ` +
        `${tgl.formatted || "…………………………"}, berdasarkan Surat Penetapan Pemenang Nomor ${paket.no_sp_pemenang || "……"} ` +
        `tanggal ${paket.tgl_sp_pemenang || "……"}, Surat Penunjukan Penyedia Barang/Jasa (SPPBJ) Nomor ${paket.no_sppbj || "……"} ` +
        `tanggal ${paket.tgl_sppbj || "……"}, antara:`
    ),
    infoTable([
      ["Nama", official.nama],
      ["NIP", official.nip],
      ["Jabatan", official.jabatan],
      ["Berkedudukan di", official.alamat],
    ]),
    p(
      `yang bertindak untuk dan atas nama Pemerintah Provinsi Papua Barat Daya c.q. ${official.satuan_kerja} ` +
        `berdasarkan Surat Keputusan Nomor ${official.sk_pengangkatan?.nomor || "……"} tanggal ${official.sk_pengangkatan?.tanggal || "……"} ` +
        `tentang ${official.sk_pengangkatan?.tentang || "……"}, selanjutnya disebut "Pejabat Penandatangan Kontrak", dengan:`
    ),
    infoTable(identitasPenyediaRows),
    p(
      isBadanUsaha
        ? `yang bertindak untuk dan atas nama ${vendor.nama}, selanjutnya disebut "Penyedia".`
        : `selanjutnya disebut "Penyedia".`
    ),
    p("", {}),
    p(
      "Pejabat Penandatangan Kontrak dan Penyedia selanjutnya secara bersama-sama disebut \"Para Pihak\" dan " +
        "secara sendiri-sendiri disebut \"Pihak\", MENERANGKAN TERLEBIH DAHULU BAHWA:"
    ),
    p("(a) Telah diadakan proses pemilihan penyedia yang telah sesuai dengan Dokumen Pemilihan;"),
    p(`(b) Pejabat Penandatangan Kontrak telah menunjuk Penyedia melalui Surat Penunjukan Penyedia Barang/Jasa (SPPBJ) Nomor ${paket.no_sppbj || "……"} tanggal ${paket.tgl_sppbj || "……"}, untuk melaksanakan layanan jasa konsultansi sebagaimana diterangkan dalam Kerangka Acuan Kerja (KAK) dan Syarat-Syarat Umum Kontrak;`),
    p("(c) Penyedia menyatakan memiliki keahlian profesional, tenaga ahli/personil, dan sumber daya yang memadai, serta telah menyetujui untuk melaksanakan layanan jasa konsultansi sesuai dengan persyaratan dan ketentuan dalam Kontrak ini;"),
    p("(d) Pejabat Penandatangan Kontrak dan Penyedia menyatakan memiliki kewenangan untuk menandatangani Kontrak ini, dan mengikat pihak yang diwakili."),
    p("", {}),
    p("MAKA OLEH KARENA ITU, Para Pihak dengan ini bersepakat dan menyetujui hal-hal sebagai berikut:"),
    p(
      `1. Total nilai Kontrak termasuk Pajak Pertambahan Nilai (PPN) adalah sebesar ${formatRupiah(paket.nilai_kontrak)} ` +
        `(${rupiahTerbilang(paket.nilai_kontrak)}), ` +
        (isWaktuPenugasan
          ? "terdiri atas Biaya Langsung Personil (remunerasi tenaga ahli berdasarkan satuan waktu penugasan) dan Biaya Langsung Non-Personil, sebagaimana rincian pada SSKK dan lampiran teknis."
          : "merupakan nilai lumsum yang tidak berubah berdasarkan capaian keluaran (output) yang disepakati dalam Kontrak.")
    ),
    p(`2. Jangka waktu pelaksanaan layanan ditetapkan selama ${paket.jangka_waktu_hari || "…"} (${terbilangSafe(paket.jangka_waktu_hari)}) hari kalender terhitung sejak tanggal mulai kerja yang tercantum dalam Surat Perintah Mulai Kerja (SPMK).`),
    p("3. Dokumen-dokumen berikut merupakan satu-kesatuan dan bagian yang tidak terpisahkan dari Kontrak ini:"),
    ...[
      "a. Adendum Surat Perjanjian (apabila ada);",
      "b. Pokok Perjanjian;",
      "c. Surat Penawaran, beserta penawaran biaya;",
      "d. Syarat-Syarat Khusus Kontrak (SSKK);",
      "e. Syarat-Syarat Umum Kontrak (SSUK);",
      "f. Kerangka Acuan Kerja (KAK);",
      isWaktuPenugasan
        ? "g. Daftar Personil dan Rincian Biaya Langsung Personil/Non-Personil;"
        : "g. Rincian Biaya Penawaran (Lumsum);",
      "h. Dokumen lainnya seperti: SPPBJ, BAHP/BAHPL, dan BAPP.",
    ].map((t) => p(t)),
    p("4. Urutan hierarki dokumen di atas dijadikan dasar untuk penentuan dan penafsiran apabila terjadi pertentangan antara ketentuan dalam dokumen-dokumen tersebut."),
    p("5. Hak dan kewajiban timbal balik Pejabat Penandatangan Kontrak dan Penyedia dinyatakan dalam Kontrak yang meliputi SSUK dan SSKK terlampir."),
    p("", {}),
    p("DENGAN DEMIKIAN, Pejabat Penandatangan Kontrak dan Penyedia telah bersepakat untuk menandatangani Kontrak ini pada tanggal tersebut di atas dan melaksanakan Kontrak sesuai dengan ketentuan peraturan perundang-undangan di Republik Indonesia."),
    p("", {}),
    signatureBlock(
      { label: "Untuk dan atas nama Penyedia", nama: isBadanUsaha ? vendor.wakil?.nama : vendor.nama, jabatan: isBadanUsaha ? vendor.wakil?.jabatan : "" },
      { label: "Untuk dan atas nama Pemerintah Provinsi Papua Barat Daya", nama: official.nama, jabatan: `${official.jabatan}${official.nip ? "\nNIP. " + official.nip : ""}` }
    ),
  ];
  return baseDoc(children);
}

/* -------- SPK JASA KONSULTANSI NON-KONSTRUKSI (nilai <= ambang) -------- */
function buildSPKKonsultansiNonKonstruksi(ctx) {
  const { paket, vendor, official, jenisKontrakLabel } = ctx;
  const isBadanUsaha = vendor.jenis === JENIS_PENYEDIA.BADAN_USAHA;
  const isWaktuPenugasan = paket.jenis_kontrak === JENIS_KONTRAK.WAKTU_PENUGASAN;
  const tgl = tanggalIndonesia(paket.tanggal_kontrak);

  const header = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({ width: { size: 5000, type: WidthType.DXA }, children: [
            p("SURAT PERINTAH KERJA (SPK)", { bold: true, align: AlignmentType.CENTER }),
            p(`Jasa Konsultansi Non-Konstruksi — ${isBadanUsaha ? "Badan Usaha" : "Perorangan"}`, { align: AlignmentType.CENTER, size: 20, italics: true }),
            p(`Satuan Kerja: ${official.satuan_kerja}`, { align: AlignmentType.CENTER, size: 20 }),
          ]}),
          new TableCell({ width: { size: 5000, type: WidthType.DXA }, children: [
            p("NOMOR DAN TANGGAL SPK", { bold: true, align: AlignmentType.CENTER }),
            p(`Nomor: ${paket.nomor_kontrak || "…………………"}`, { align: AlignmentType.CENTER, size: 20 }),
            p(`Tanggal: ${tgl.formatted || "…………………"}`, { align: AlignmentType.CENTER, size: 20 }),
          ]}),
        ],
      }),
    ],
  });

  const children = [
    titleP("SURAT PERINTAH KERJA (SPK)"),
    p(`JASA KONSULTANSI NON-KONSTRUKSI ${isBadanUsaha ? "BADAN USAHA" : "PERORANGAN"} JENIS KONTRAK ${jenisKontrakLabel.toUpperCase()}`, { align: AlignmentType.CENTER, italics: true }),
    p("", {}),
    header,
    p("", {}),
    p("PAKET PEKERJAAN:", { bold: true }),
    p(paket.nama_paket),
    p("", {}),
    infoTable([
      ["Nama PPK / Pejabat Penandatangan Kontrak", official.nama],
      ["NIP", official.nip],
      ["Jabatan", official.jabatan],
      ["Alamat", official.alamat],
    ], 3800),
    p("", {}),
    infoTable(isBadanUsaha ? [
      ["Nama Penyedia", vendor.nama],
      ["Nama Wakil/Direktur", vendor.wakil?.nama],
      ["Alamat", vendor.alamat],
      ["NPWP", vendor.npwp],
    ] : [
      ["Nama Penyedia (Perorangan)", vendor.nama],
      ["No. Kartu Identitas (KTP/SIM/Paspor)", vendor.nomor_identitas],
      ["Alamat", vendor.alamat],
    ], 3800),
    p("", {}),
    p(
      `Berdasarkan Surat Penunjukan Penyedia Barang/Jasa (SPPBJ) Nomor ${paket.no_sppbj || "……"} tanggal ${paket.tgl_sppbj || "……"}, ` +
        "bersama ini kami memerintahkan:"
    ),
    p(`${vendor.nama}`, { bold: true }),
    p(`untuk melaksanakan layanan jasa konsultansi "${paket.nama_paket}" dengan ketentuan sebagai berikut:`),
    p("", {}),
    p(`1. Total nilai SPK termasuk PPN sebesar ${formatRupiah(paket.nilai_kontrak)} (${rupiahTerbilang(paket.nilai_kontrak)}).`),
    p(`2. Jenis Kontrak: ${jenisKontrakLabel}${isWaktuPenugasan ? " (dibayar berdasarkan satuan waktu penugasan personil sesuai billing rate yang disepakati)" : " (dibayar berdasarkan keluaran/output sesuai Kerangka Acuan Kerja)"}.`),
    p(`3. Jangka waktu pelaksanaan layanan selama ${paket.jangka_waktu_hari || "…"} (${terbilangSafe(paket.jangka_waktu_hari)}) hari kalender sejak tanggal mulai kerja pada SPMK.`),
    p(`4. Sumber dana: ${paket.sumber_dana}.`),
    p("5. Penyedia berkewajiban melaksanakan layanan sesuai Kerangka Acuan Kerja (KAK), menugaskan personil/tenaga ahli sesuai kualifikasi yang disepakati, serta tunduk pada ketentuan umum SPK sebagaimana lazimnya kontrak jasa konsultansi pemerintah untuk pekerjaan bernilai kecil, meliputi ketentuan itikad baik, kerahasiaan, hak kekayaan intelektual, pelaporan, jadwal penugasan, perubahan SPK, hak dan kewajiban para pihak, pembayaran, denda keterlambatan penyerahan laporan/keluaran, penyelesaian perselisihan, serta keadaan kahar."),
    p("6. Dengan ditandatanganinya SPK ini, Penyedia menyatakan sanggup melaksanakan layanan dengan sebaik-baiknya dan penuh tanggung jawab profesional sesuai dengan Kontrak."),
    p("", {}),
    signatureBlock(
      { label: "Untuk dan atas nama Penyedia", nama: isBadanUsaha ? (vendor.wakil?.nama || vendor.nama) : vendor.nama, jabatan: isBadanUsaha ? vendor.wakil?.jabatan : "" },
      { label: "Pejabat Penandatangan Kontrak", nama: official.nama, jabatan: `${official.jabatan}${official.nip ? "\nNIP. " + official.nip : ""}` }
    ),
  ];
  return baseDoc(children);
}

/* -------- SSKK JASA KONSULTANSI NON-KONSTRUKSI (khusus, untuk Surat Perjanjian) --------
   Judul mengikuti dokumen baku: "JASA KONSULTAN NONKONSTRUKSI" (Badan Usaha) vs
   "JASA KONSULTANSI NONKONSTRUKSI PERORANGAN" (Perorangan). */
function buildSSKKKonsultansiNonKonstruksi(ctx) {
  const { paket, vendor, official, jenisKontrakLabel } = ctx;
  const isBadanUsaha = vendor.jenis === JENIS_PENYEDIA.BADAN_USAHA;
  const isWaktuPenugasan = paket.jenis_kontrak === JENIS_KONTRAK.WAKTU_PENUGASAN;

  const row = (pasal, ketentuan, data) =>
    new TableRow({
      children: [
        new TableCell({ width: { size: 1200, type: WidthType.DXA }, children: [p(pasal, { align: AlignmentType.CENTER })] }),
        new TableCell({ width: { size: 2600, type: WidthType.DXA }, children: [p(ketentuan, { bold: true })] }),
        new TableCell({ children: data.map((d) => p(d, { spacing: { after: 60 } })) }),
      ],
    });

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({ shading: { type: ShadingType.CLEAR, fill: "D9D9D9" }, children: [p("Klausul dalam SSUK", { bold: true, align: AlignmentType.CENTER })] }),
          new TableCell({ shading: { type: ShadingType.CLEAR, fill: "D9D9D9" }, children: [p("Ketentuan", { bold: true, align: AlignmentType.CENTER })] }),
          new TableCell({ shading: { type: ShadingType.CLEAR, fill: "D9D9D9" }, children: [p("Data / Pengaturan", { bold: true, align: AlignmentType.CENTER })] }),
        ],
      }),
      row("Korespondensi", "Alamat Para Pihak", [
        `Satuan Kerja Pejabat Penandatangan Kontrak: ${official.satuan_kerja}`,
        `Nama: ${official.nama}`,
        `Alamat: ${official.alamat}`,
        `Penyedia: ${vendor.nama}`,
        `Alamat: ${vendor.alamat}`,
        `Email: ${vendor.email || "-"}`,
      ]),
      row("Wakil Sah", "Wakil Sah Para Pihak", [
        `Pejabat Penandatangan Kontrak: ${official.nama}`,
        `Penyedia: ${isBadanUsaha ? (vendor.wakil?.nama || "") : vendor.nama}`,
      ]),
      row("-", "Jenis Kontrak", [jenisKontrakLabel]),
      row("-", "Personil/Tenaga Ahli", [
        paket.daftar_personil ||
          "Daftar personil, kualifikasi, dan jumlah orang-bulan (person-month) sesuai Kerangka Acuan Kerja (KAK) dan lampiran teknis penawaran.",
      ]),
      row("-", "Jadwal Pelaksanaan Layanan", [`${paket.jangka_waktu_hari || "…"} hari kalender sejak SPMK diterbitkan.`]),
      row("17.1", "Uang Muka", [
        paket.persentase_uang_muka
          ? `Diberikan uang muka sebesar ${paket.persentase_uang_muka}% dari Nilai Kontrak, yaitu ${formatRupiah((paket.nilai_kontrak * paket.persentase_uang_muka) / 100)}.`
          : "Tidak diberikan uang muka.",
      ]),
      row("-", "Pembayaran Prestasi Layanan", [
        isWaktuPenugasan
          ? "Dilakukan berdasarkan realisasi waktu penugasan personil (person-month) dikalikan billing rate yang disepakati, dibuktikan dengan Laporan Kegiatan Personil dan Berita Acara Prestasi Layanan."
          : "Dilakukan berdasarkan capaian keluaran (output/deliverable) sesuai tahapan pelaporan yang disepakati dalam Kerangka Acuan Kerja.",
      ]),
      row("-", "Pelaporan", ["Laporan Pendahuluan, Laporan Antara, dan Laporan Akhir (atau sesuai tahapan pada KAK), diserahkan sesuai jadwal yang disepakati."]),
      row("-", "Denda Keterlambatan", ["1‰ (satu permil) per hari dari nilai Kontrak/bagian Kontrak atas keterlambatan penyerahan laporan/keluaran, sesuai ketentuan SSUK."]),
      row("-", "Sumber Dana", [paket.sumber_dana]),
      row("-", "Nilai Kontrak", [`${formatRupiah(paket.nilai_kontrak)} (${rupiahTerbilang(paket.nilai_kontrak)})`]),
    ],
  });

  const children = [
    titleP("SYARAT-SYARAT KHUSUS KONTRAK (SSKK)"),
    p(`SURAT PERJANJIAN JASA KONSULTAN${isBadanUsaha ? " NONKONSTRUKSI" : "SI NONKONSTRUKSI PERORANGAN"}`, { align: AlignmentType.CENTER, italics: true }),
    p(`Paket: ${paket.nama_paket}`, { align: AlignmentType.CENTER, bold: true }),
    p("", {}),
    p("SSKK berikut merupakan lampiran dan bagian yang tidak terpisahkan dari Surat Perjanjian, digunakan bersama Syarat-Syarat Umum Kontrak (SSUK) Jasa Konsultansi Non-Konstruksi yang bersifat baku dan dilampirkan terpisah. Ketentuan dalam SSKK melengkapi, mengubah, atau menambah ketentuan dalam SSUK sesuai kebutuhan paket pekerjaan ini."),
    p("", {}),
    table,
  ];
  return baseDoc(children);
}

function terbilangSafe(n) {
  try {
    const { rupiahTerbilang } = require("./contractLogic");
    return rupiahTerbilang(n).replace(" rupiah", "");
  } catch {
    return "";
  }
}

async function toBuffer(doc) {
  return Packer.toBuffer(doc);
}

module.exports = {
  buildSuratPerjanjian, buildSPK, buildSSKK, buildSPMK, buildSPL,
  buildSuratPerjanjianKonsultansi, buildSPKKonsultansi, buildSSKKKonsultansi, buildSSUKKonsultansiKerangka,
  jenisKontrakKonsultansiLabel,
  buildSuratPerjanjianBarang, buildSPKBarang, buildSSKKBarang, jenisKontrakBarangLabel,
  buildSuratPerjanjianJasaLainnya, buildSPKJasaLainnya, buildSSKKJasaLainnya, jenisKontrakJasaLainnyaLabel,
  buildSuratPerjanjianKonsultansiNonKonstruksi, buildSPKKonsultansiNonKonstruksi, buildSSKKKonsultansiNonKonstruksi,
  jenisKontrakKonsultansiNonKonstruksiLabel,
  toBuffer,
};
