# SIKON — Sistem Informasi Kontrak Otomatis
Pekerjaan Konstruksi · Pemerintah Provinsi Papua Barat Daya

Sistem ini menghasilkan berkas kontrak (`SPK` atau `Surat Perjanjian + SSKK + SSUK`)
secara otomatis dalam format `.docx`, berdasarkan 10 dokumen acuan resmi LKPP yang
dilampirkan (SSKK, SSUK, SPK, Surat Perjanjian — masing-masing untuk jenis kontrak
Harga Satuan & Lumsum, dan jenis penyedia Perorangan & Badan Usaha).

## 1. Logika Bisnis (Inti Sistem)

Aturan pemilihan dokumen mengikuti praktik umum pengadaan konstruksi pemerintah
(Perpres 12/2021 jo. 16/2018 & Perlem LKPP 12/2021), diimplementasikan di
`backend/lib/contractLogic.js`:

| Kondisi | Dokumen yang dihasilkan |
|---|---|
| Nilai kontrak **≤ Rp200.000.000** | **SPK** (Surat Perintah Kerja) + **SPMK** + **SPL** |
| Nilai kontrak **> Rp200.000.000** | **Surat Perjanjian** + **SSKK** (otomatis sesuai data paket) + **SSUK** (lampiran baku) + **SPMK** + **SPL** |

**SPMK** (Surat Perintah Mulai Kerja) dan **SPL** (Berita Acara Serah Terima Lokasi
Kerja) selalu diterbitkan pada **kedua** jalur, karena keduanya menandai titik resmi
mulai kerja di lapangan dan menjadi dasar hitung mundur jangka waktu pelaksanaan —
terlepas dari besar-kecilnya nilai kontrak. Tanggal selesai pekerjaan pada SPMK
dihitung otomatis dari `tanggal_spmk + jangka_waktu_hari` (`tambahHariKalender` di
`contractLogic.js`).

Variabel lain yang memengaruhi template yang dipilih:
- **Jenis Kontrak**: Harga Satuan vs Lumsum → memengaruhi klausul pembayaran
  (pengukuran volume vs capaian keluaran) dan lampiran (Daftar Kuantitas & Harga vs
  Daftar Keluaran dan Harga).
- **Jenis Penyedia** (khusus SPK): Perorangan vs Badan Usaha → memengaruhi struktur
  identitas pihak kedua.

Ambang batas (`SPK_MAX_VALUE`), dan seluruh redaksi pasal, dapat diubah langsung di
`contractLogic.js` / `docxGenerator.js` tanpa menyentuh bagian lain sistem — ini
sengaja dipisahkan (separation of concerns) supaya perubahan kebijakan tidak
merembet ke kode UI atau penyimpanan data.

## 1b. Kategori Kedua: Jasa Konsultansi Konstruksi

Selain Pekerjaan Konstruksi (fisik), sistem kini juga menangani **Jasa
Konsultansi Konstruksi** (perencanaan, pengawasan, manajemen konstruksi),
dengan logika yang SENGAJA dibedakan karena karakteristik & aturannya berbeda:

| | Pekerjaan Konstruksi | Jasa Konsultansi Konstruksi |
|---|---|---|
| Ambang nilai SPK | ≤ Rp200.000.000 | ≤ Rp100.000.000 |
| Jenis Kontrak | Harga Satuan / Lumsum | Lumsum / **Waktu Penugasan** (person-month × billing rate) |
| SPL (serah terima lokasi) | Selalu wajib | Opsional — hanya jika dicentang "butuh akses lokasi proyek" (mis. pengawasan) |
| Dasar pembayaran | Volume pekerjaan fisik / capaian output | Capaian keluaran (Lumsum) atau realisasi orang-bulan personil (Waktu Penugasan) |
| SSKK | Berisi klausul RAB, denda fisik | Berisi klausul personil, pelaporan, billing rate |

**Keterbatasan yang perlu diketahui:** sistem memiliki 10 dokumen baku resmi
untuk Pekerjaan Konstruksi (diunggah langsung dari LKPP/Instansi), tetapi
**belum memiliki file SSUK baku resmi untuk Jasa Konsultansi Konstruksi**.
Untuk kategori ini, `SSUK_KERANGKA_PERLU_VERIFIKASI.docx` dihasilkan sebagai
kerangka umum mengikuti struktur baku LKPP (definisi, personil, HKI,
pelaporan, keadaan kahar, dst) dengan **catatan tebal di halaman pertama**
yang meminta verifikasi/penggantian dengan dokumen resmi sebelum dipakai
sebagai dasar hukum kontrak. SPK, Surat Perjanjian, dan SSKK Jasa Konsultansi
tidak memakai kerangka ini — keduanya disusun penuh dari struktur kontrak
konsultansi standar dan siap pakai.

Jika Anda memperoleh file SSUK/SSKK Jasa Konsultansi Konstruksi baku resmi
di kemudian hari, cukup: (1) simpan filenya di `backend/templates_static/`,
(2) ganti pemanggilan `gen.buildSSUKKonsultansiKerangka(ctx)` di
`routes/api.js` menjadi `fs.copyFileSync(...)` seperti pola SSUK Pekerjaan
Konstruksi — persis mengikuti pola yang sudah ada.

## 1c. Kategori Ketiga: Pengadaan Barang

Kategori ketiga menangani **Pengadaan Barang**, dengan pola paling mirip
Pekerjaan Konstruksi (ambang sama, SSUK baku tersedia) namun dengan
identitas penyedia yang bercabang dan dokumen bermuara pada **BAST
(Berita Acara Serah Terima) Barang**, bukan penyelesaian fisik pekerjaan:

| | Pekerjaan Konstruksi | Pengadaan Barang |
|---|---|---|
| Ambang nilai SPK | ≤ Rp200.000.000 | ≤ Rp200.000.000 (sama) |
| Jenis Kontrak | Harga Satuan / Lumsum | Harga Satuan / Lumsum |
| SSUK | Baku, dilampirkan apa adanya | **Baku, dilampirkan apa adanya** (dari `1_SSUK_Barang_2021.docx`) |
| SPL (serah terima lokasi) | Selalu wajib | Opsional — hanya jika dicentang (barang butuh instalasi di lokasi) |
| Identitas Penyedia (Surat Perjanjian) | — | **Bercabang menurut jenis penyedia**: Badan Usaha memakai Akta Notaris + Wakil/Direktur; Perorangan memakai No. Kartu Identitas (KTP/SIM/Paspor), mengikuti 2 varian dokumen baku yang diunggah |
| Titik penyelesaian pekerjaan | 100% fisik pada tanggal SPMK + durasi | **BAST Barang** setelah pemeriksaan kesesuaian spesifikasi |
| SSKK tambahan | — | Klausul **Jaminan Pelaksanaan** (pasal 4.3.b — kas tujuan pencairan), **Masa Garansi**, jadwal & lokasi serah terima |

Berbeda dari Jasa Konsultansi Konstruksi, untuk Pengadaan Barang sistem
**memiliki file SSUK baku resmi** (diunggah langsung), sehingga — sama
seperti Pekerjaan Konstruksi — SSUK dilampirkan **apa adanya** (disalin
byte-per-byte, bukan digenerate ulang) untuk menjaga keaslian redaksi
hukum. Hanya SSKK yang digenerate khusus per paket, dan Surat
Perjanjian/SPK yang dibangun dari struktur data (bukan mail-merge ke
blanko asli), mengikuti alasan yang sama seperti kategori lain (lihat
bagian 2 di bawah).

Sistem juga menambahkan peringatan otomatis: kontrak Pengadaan Barang di
atas ambang SPK yang belum melampirkan info Jaminan Pelaksanaan akan
diberi catatan pengingat pada hasil `logic/preview` dan hasil generate.

## 1d. Kategori Keempat: Jasa Lainnya (Non-Konstruksi)

Kategori keempat menangani **Jasa Lainnya** — layanan non-konstruksi seperti
kebersihan, keamanan, sewa kendaraan, catering, dsb. Pola dokumennya nyaris
identik dengan Pengadaan Barang (karena keduanya satu keluarga aturan dalam
Perpres 12/2021: Barang/Konstruksi/Jasa Lainnya berambang sama), hanya
istilah dan titik penyelesaian pekerjaannya yang disesuaikan:

| | Pengadaan Barang | Jasa Lainnya |
|---|---|---|
| Ambang nilai SPK | ≤ Rp200.000.000 | ≤ Rp200.000.000 (sama) |
| SSUK | Baku, dilampirkan apa adanya (`SSUK_Barang_2021.docx`) | **Baku, dilampirkan apa adanya** (`SSUK_Jasa_Lainnya_2021.docx`) |
| Identitas Penyedia | Bercabang Badan Usaha (Akta Notaris) vs Perorangan (Kartu Identitas) | **Sama persis** — mengikuti 2 varian dokumen baku yang diunggah |
| Titik penyelesaian pekerjaan | BAST Barang | **Berita Acara Serah Terima Hasil Pekerjaan** |
| SSKK tambahan | Jaminan Pelaksanaan, Masa Garansi | **Sama** — Jaminan Pelaksanaan (pasal 4.3.b), Masa Garansi, jadwal & lokasi pelaksanaan |

Karena kesamaan struktural ini, builder Jasa Lainnya di `docxGenerator.js`
(`buildSuratPerjanjianJasaLainnya`, `buildSPKJasaLainnya`,
`buildSSKKJasaLainnya`) sengaja ditulis mengikuti pola yang sama persis
dengan builder Barang, hanya redaksi & rujukan dokumen yang diganti — ini
memudahkan pemeliharaan: perubahan struktural pada satu kategori mudah
direplikasi ke kategori yang lain karena keduanya "sepasang".

## 1e. Kategori Kelima: Jasa Konsultansi Non-Konstruksi

Kategori kelima menangani **Jasa Konsultansi Non-Konstruksi** — kajian,
studi, audit, pelatihan, dan layanan olah-pikir profesional lain di luar
bidang konstruksi. Ambangnya mengikuti keluarga Konsultansi (Rp100 juta,
sama seperti Jasa Konsultansi Konstruksi), namun **berbeda dari Konsultansi
Konstruksi dalam satu hal penting**: kali ini sistem punya file SSUK baku
resmi — bukan kerangka buatan sendiri.

| | Jasa Konsultansi Konstruksi | Jasa Konsultansi Non-Konstruksi |
|---|---|---|
| Ambang nilai SPK | ≤ Rp100.000.000 | ≤ Rp100.000.000 (sama) |
| Jenis Kontrak | Lumsum / Waktu Penugasan | Lumsum / Waktu Penugasan (sama) |
| SSUK | **Kerangka buatan sistem** (belum ada file baku resmi, perlu verifikasi) | **Baku resmi, dilampirkan apa adanya** — dan uniknya **dipilih berdasarkan jenis penyedia**, bukan jenis kontrak: `SSUK_..._BadanUsaha_2021.docx` vs `SSUK_..._Perorangan_2021.docx` |
| Surat Perjanjian (Badan Usaha) | Identitas Wakil/Direktur standar | Judul eksplisit **"BADAN USAHA NON-KEMITRAAN"**, sesuai dokumen resmi yang diunggah (varian Kemitraan/KSO dapat ditambahkan kelak) |
| Surat Perjanjian (Perorangan) | Identitas Wakil/Direktur | **Kartu Identitas (KTP/SIM/Paspor)**, tanpa akta notaris |

Poin penting soal pemilihan SSUK: untuk kategori ini, kriteria pemilihan
file baku bukan `jenis_kontrak` (seperti Pekerjaan Konstruksi memilih
antara SSUK Harga Satuan/Lumsum) melainkan **`jenis_penyedia`** — karena
dua dokumen baku yang diunggah memang terpisah menurut Badan Usaha vs
Perorangan, bukan menurut jenis kontrak. Logika ini ada di
`routes/api.js` pada percabangan `KONSULTANSI_NON_KONSTRUKSI`.

## 1f. Pengecekan Kelengkapan Data (Checklist Sebelum Generate)

Setiap field kosong di dokumen tampil sebagai placeholder titik-titik
(`……`) — ini BUKAN diisi otomatis oleh sistem, melainkan sinyal visual
"field ini belum ada datanya, isi manual di Word". Supaya pengguna tidak
perlu membuka dokumen dulu untuk tahu bagian mana yang masih bolong,
sistem menyediakan **checklist kelengkapan** yang muncul otomatis begitu
masuk ke step 4 (Preview & Generate):

- `lib/contractLogic.js` → `checkKelengkapan({ paket, vendor, official })`
  memeriksa semua field yang lazimnya diisi untuk jenis dokumen yang
  akan dihasilkan, dan mengembalikan daftar field yang masih kosong,
  dikelompokkan per Paket / Pejabat (PPK) / Penyedia.
- Pemeriksaannya **sadar-konteks**: field yang hanya relevan untuk Surat
  Perjanjian (mis. Nomor Akta Notaris, SK Pengangkatan PPK, Surat
  Penetapan Pemenang) tidak dituntut pada jalur SPK karena memang tidak
  dipakai di dokumen itu. Begitu juga field identitas penyedia menyesuaikan
  Badan Usaha (Akta Notaris) vs Perorangan (Kartu Identitas).
- Endpoint: `POST /api/logic/kelengkapan` menerima `{ paket, vendor,
  official }` (atau `*_id` untuk data yang sudah tersimpan) dan
  mengembalikan `{ complete, missing[], totalMissing }`.
- Di frontend, checklist ini **tidak memblokir generate** — dokumen
  tetap bisa dibuat dengan field kosong (jadi `……`) karena kadang
  informasi itu memang belum tersedia saat kontrak awal dibuat dan akan
  dilengkapi belakangan di Word. Tujuannya murni informatif: pengguna
  tahu persis apa yang perlu dicari-ganti sebelum dokumen dikirim resmi.

## 2. Arsitektur

```
kontrak-otsus/
├── backend/
│   ├── server.js              # Express app (API + serve frontend)
│   ├── routes/api.js          # Endpoint REST (vendors, officials, packages, contracts)
│   ├── lib/
│   │   ├── contractLogic.js   # Aturan bisnis & util (terbilang, format tanggal, dsb)
│   │   ├── docxGenerator.js   # Mesin pembuat .docx (docx npm library)
│   │   └── db.js              # Penyimpanan JSON sederhana (mudah diganti ke PostgreSQL/MySQL)
│   ├── data/                  # "Database": vendors.json, officials.json, packages.json, contracts.json
│   ├── templates_static/      # SSUK baku (dilampirkan apa adanya, tidak digenerate ulang)
│   └── generated/             # Output docx per transaksi (folder per timestamp)
└── frontend/
    └── public/
        ├── index.html
        └── app.js              # SPA vanilla JS — wizard 5 langkah
```

**Alur data:** Frontend (wizard) → `POST /api/logic/preview` (pratinjau logika
real-time) → `POST /api/contracts/generate` (server menjalankan `contractLogic`
untuk menentukan dokumen, lalu `docxGenerator` merangkai .docx dari data terstruktur)
→ file di-zip → diunduh oleh pengguna → riwayat tersimpan di `contracts.json`.

**Kenapa generate dari data terstruktur, bukan mail-merge ke file Word asli?**
Blanko asli LKPP memakai titik-titik berulang (`……`) yang tidak unik secara XML,
sehingga rawan salah isi saat mail-merge otomatis. Sistem ini membangun ulang
struktur dokumen (docx npm) dari 10 file asli sebagai acuan tata letak dan redaksi,
tapi diisi dari data terstruktur (database) — jauh lebih andal untuk produksi massal
dan mudah diaudit. SSUK (syarat umum, 20+ halaman, nyaris tidak pernah berubah per
paket) tetap dilampirkan langsung dari file aslinya agar tidak ada risiko redaksi
hukum berubah tanpa sengaja.

## 3. Model Data

- **Vendors** (Penyedia): nama, jenis (perorangan/badan usaha), alamat, NPWP, akta
  notaris, wakil/direktur. Sudah diisi awal dengan CV. Papua Paradise & CV. Arbah
  Bersinar — tinggal dilengkapi.
- **Officials** (Pejabat Penandatangan Kontrak / PPK): nama, NIP, jabatan, satuan
  kerja, SK pengangkatan.
- **Packages** (Paket Pekerjaan): nama paket, nilai kontrak, jenis kontrak, sumber
  dana, jangka waktu, nomor SPPBJ, dsb.
- **Contracts**: riwayat setiap kontrak yang pernah digenerate, dengan tautan unduh.

Semua tersimpan sebagai JSON per entitas (`backend/data/*.json`). Untuk produksi
sesungguhnya (multi-user, banyak dinas), ganti `lib/db.js` dengan koneksi
PostgreSQL/MySQL — struktur fungsinya (`insert/update/remove/findById`) sudah
dirancang agar penggantian ini tidak menyentuh routes atau frontend.

## 4. UI/UX

Wizard 5 langkah (bukan formulir raksasa satu halaman) supaya pengguna non-teknis
di dinas tidak kewalahan:
1. **Data Paket** — dengan panel "Logika Sistem" yang langsung menampilkan dokumen
   apa yang akan dihasilkan begitu nilai kontrak & jenis kontrak diisi.
2. **Pejabat (PPK)** — pilih dari data tersimpan atau tambah baru.
3. **Penyedia** — sama, dengan CV yang sudah pernah dipakai muncul sebagai pilihan cepat.
4. **Preview & Generate** — ringkasan 3 kolom sebelum file diunduh.
5. **Riwayat** — semua kontrak yang pernah dibuat, bisa diunduh ulang kapan saja.

## 5. Menjalankan

```bash
cd backend
npm install
npm start        # atau: node server.js
```

Buka `http://localhost:4000` di browser. Backend otomatis menyajikan frontend statis
(`frontend/public`) dan API di `/api/*`.

## 6. Contoh Endpoint API

```
GET  /api/vendors                     daftar penyedia
POST /api/vendors                     tambah penyedia
GET  /api/officials                   daftar PPK
POST /api/officials                   tambah PPK
POST /api/logic/preview               { nama_paket, nilai_kontrak, jenis_kontrak, jenis_penyedia, sumber_dana }
                                       -> { jenisDokumen, perluSSUK, perluSSKK, warnings }
POST /api/logic/kelengkapan           { paket, vendor, official } atau { package_id, vendor_id, official_id }
                                       -> { complete, missing: [{group, key, label}], totalMissing }
POST /api/contracts/generate          { paket, vendor, official } atau { package_id, vendor_id, official_id }
                                       -> { contract, docSet, downloadZip }
GET  /api/contracts/:id/download      unduh ZIP berkas kontrak
```

## 7. Pengembangan Lanjutan yang Disarankan

- **Autentikasi & peran pengguna** (Admin Dinas, PPK, Operator) — saat ini sistem
  single-user untuk kebutuhan internal.
- **E-signature / tanda tangan elektronik** (mis. integrasi BSrE/Peruri) sebelum
  dokumen final dianggap sah.
- **Nomor kontrak, SPMK otomatis** mengikuti format penomoran resmi per dinas/tahun.
- **Berita Acara lanjutan** (BAP/BAHP, BAST Pekerjaan, BAST Akhir/PHO-FHO) —
  strukturnya bisa ditambahkan sebagai builder baru di `docxGenerator.js` mengikuti
  pola SPMK/SPL yang sudah ada.
- **Template untuk SPK Perorangan** — sudah ada logikanya (`buildTemplateKey`),
  tinggal ditambahkan varian redaksi identitas perorangan (KTP/NIK) di
  `docxGenerator.js` bila dibutuhkan.
- **Migrasi `lib/db.js` ke database relasional** begitu jumlah paket per tahun
  cukup besar atau dipakai lintas dinas (Dinas Pangan dan Pertanian, PUPR, Sosial
  P3A, dst).
