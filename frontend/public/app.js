/* ═══════════════════════════════════════════════════════════════════════════
   SIKON — Sistem Informasi Kontrak Otomatis
   Pemerintah Provinsi Papua Barat Daya
   ═══════════════════════════════════════════════════════════════════════════ */

const API = "/api";
const fmtRp = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");
const fmtRpShort = (n) => {
  n = Number(n || 0);
  if (n >= 1e12) return "Rp" + (n / 1e12).toFixed(1) + " T";
  if (n >= 1e9)  return "Rp" + (n / 1e9).toFixed(1) + " M";
  if (n >= 1e6)  return "Rp" + (n / 1e6).toFixed(1) + " Jt";
  return fmtRp(n);
};

/* ─── Auth state ────────────────────────────────────────────────────────── */
const auth = {
  token: localStorage.getItem("sikon_token") || null,
  user:  JSON.parse(localStorage.getItem("sikon_user") || "null"),
};

function saveAuth(token, user) {
  auth.token = token;
  auth.user  = user;
  localStorage.setItem("sikon_token", token);
  localStorage.setItem("sikon_user", JSON.stringify(user));
}

function clearAuth() {
  auth.token = null;
  auth.user  = null;
  localStorage.removeItem("sikon_token");
  localStorage.removeItem("sikon_user");
}

/* ─── App view state ────────────────────────────────────────────────────── */
// view: 'login' | 'dashboard' | 'wizard'
let currentView = auth.token ? "dashboard" : "login";

const state = {
  step: 1,
  paket: {
    jenis_pekerjaan: "konstruksi",
    nama_paket: "", sumber_dana: "Dana Otonomi Khusus 2026", nilai_kontrak: "",
    jenis_kontrak: "harga_satuan", jenis_penyedia: "badan_usaha",
    jangka_waktu_hari: "", lokasi_ttd: "Kota Sorong", tanggal_kontrak: "",
    nomor_kontrak: "", no_sppbj: "", tgl_sppbj: "", no_sp_pemenang: "", tgl_sp_pemenang: "",
    persentase_uang_muka: "30",
    nomor_spmk: "", tanggal_spmk: "", lokasi_pekerjaan: "",
    butuh_serah_terima_lokasi: false, daftar_personil: "",
    masa_garansi: "", kas_tujuan_jaminan: "",
  },
  vendors: [], officials: [], history: [],
  vendorId: "", officialId: "",
  newVendor: null, newOfficial: null,
  preview: null,
  kelengkapan: null,
  lastResult: null,
  loading: false,
  stats: null,
  loginError: "",
  loginLoading: false,
};

const JENIS_KONTRAK_OPTIONS = {
  konstruksi: [["harga_satuan", "Harga Satuan"], ["lumsum", "Lumsum"]],
  konsultansi_konstruksi: [["lumsum", "Lumsum"], ["waktu_penugasan", "Waktu Penugasan"]],
  barang: [["harga_satuan", "Harga Satuan"], ["lumsum", "Lumsum"]],
  jasa_lainnya: [["harga_satuan", "Harga Satuan"], ["lumsum", "Lumsum"]],
  konsultansi_non_konstruksi: [["lumsum", "Lumsum"], ["waktu_penugasan", "Waktu Penugasan"]],
};

/* ─── API helper ────────────────────────────────────────────────────────── */
async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth.token) headers["Authorization"] = "Bearer " + auth.token;
  const res = await fetch(API + path, { headers, ...opts });
  if (res.status === 401) {
    clearAuth();
    currentView = "login";
    render();
    throw new Error("Sesi berakhir. Silakan login kembali.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || (data.errors || []).join(", ") || "Terjadi kesalahan");
  return data;
}

/* ─── Data loaders ──────────────────────────────────────────────────────── */
async function loadMasterData() {
  const [vendors, officials, history] = await Promise.all([
    api("/vendors"), api("/officials"), api("/contracts"),
  ]);
  state.vendors = vendors; state.officials = officials; state.history = history.reverse();
  if (!state.vendorId && vendors[0]) state.vendorId = vendors[0].id;
  if (!state.officialId && officials[0]) state.officialId = officials[0].id;
}

async function loadStats() {
  try {
    state.stats = await api("/auth/stats");
  } catch (e) {
    state.stats = { totalKontrak: 0, totalNilai: 0, kontrakBulanIni: 0, perKategori: {}, perDokumen: {} };
  }
}

async function refreshPreview() {
  try {
    const p = { ...state.paket, nilai_kontrak: Number(state.paket.nilai_kontrak || 0) };
    if (!p.nama_paket || !p.nilai_kontrak) { state.preview = null; return render(); }
    state.preview = await api("/logic/preview", { method: "POST", body: JSON.stringify(p) });
  } catch (e) { state.preview = { error: e.message }; }
  render();
}

async function refreshKelengkapan() {
  try {
    const paket = { ...state.paket, nilai_kontrak: Number(state.paket.nilai_kontrak || 0) };
    const vendor = state.vendorId === "__new__" ? state.newVendor : state.vendors.find(v => v.id === state.vendorId);
    const official = state.officialId === "__new__" ? state.newOfficial : state.officials.find(o => o.id === state.officialId);
    state.kelengkapan = await api("/logic/kelengkapan", { method: "POST", body: JSON.stringify({ paket, vendor, official }) });
  } catch (e) { state.kelengkapan = { error: e.message }; }
  render();
}

/* ═══════════════════════════════════════════════════════════════════════════
   RENDER: LOGIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
function renderLogin() {
  document.body.style.background = "#0d3d31";
  
  // Custom styles for this specific login screen to match the screenshot
  const style = `
    <style>
      .login-container {
        min-height: 100vh;
        background-image: url('bg-login.png');
        background-size: cover;
        background-position: center;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        overflow: hidden;
      }
      .glass-card {
        background: rgba(13, 61, 49, 0.4);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 215, 0, 0.3);
        border-radius: 20px;
        position: relative;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(255, 215, 0, 0.05);
        z-index: 10;
      }
      .corner-ornament {
        position: absolute;
        width: 40px;
        height: 40px;
      }
      .tl-ornament { top: 10px; left: 10px; border-top: 2px solid #D4AF37; border-left: 2px solid #D4AF37; border-top-left-radius: 12px; }
      .tr-ornament { top: 10px; right: 10px; border-top: 2px solid #D4AF37; border-right: 2px solid #D4AF37; border-top-right-radius: 12px; }
      .bl-ornament { bottom: 10px; left: 10px; border-bottom: 2px solid #D4AF37; border-left: 2px solid #D4AF37; border-bottom-left-radius: 12px; }
      .br-ornament { bottom: 10px; right: 10px; border-bottom: 2px solid #D4AF37; border-right: 2px solid #D4AF37; border-bottom-right-radius: 12px; }
      
      .tl-ornament::after { content: ''; position: absolute; top: 4px; left: 4px; width: 8px; height: 8px; border: 1px solid #D4AF37; border-radius: 50%; }
      .tr-ornament::after { content: ''; position: absolute; top: 4px; right: 4px; width: 8px; height: 8px; border: 1px solid #D4AF37; border-radius: 50%; }
      .bl-ornament::after { content: ''; position: absolute; bottom: 4px; left: 4px; width: 8px; height: 8px; border: 1px solid #D4AF37; border-radius: 50%; }
      .br-ornament::after { content: ''; position: absolute; bottom: 4px; right: 4px; width: 8px; height: 8px; border: 1px solid #D4AF37; border-radius: 50%; }

      .input-dark {
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: white;
      }
      .input-dark:focus {
        border-color: #D4AF37;
        box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.2);
        outline: none;
      }
      .btn-gold-green {
        background: linear-gradient(90deg, #1ead7c 0%, #0c6690 100%);
        border: 1px solid rgba(255, 215, 0, 0.4);
        position: relative;
        overflow: hidden;
      }
      .btn-gold-green::before {
        content: '';
        position: absolute;
        top: 0; left: -100%; width: 50%; height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
        transform: skewX(-20deg);
        transition: 0.5s;
      }
      .btn-gold-green:hover::before {
        left: 150%;
      }
      
      .floating-hex {
        position: absolute;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 80px;
        opacity: 0.7;
        color: #D4AF37;
        animation: float 6s ease-in-out infinite;
      }
      .floating-hex svg {
        width: 40px; height: 40px;
        stroke: #D4AF37;
        stroke-width: 1.5;
        fill: rgba(0,0,0,0.2);
        margin-bottom: 8px;
        filter: drop-shadow(0 0 5px rgba(212,175,55,0.3));
      }
      .floating-hex span {
        font-size: 0.55rem;
        font-weight: 700;
        text-align: center;
        letter-spacing: 0.05em;
      }
      @keyframes float {
        0% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
        100% { transform: translateY(0px); }
      }
    </style>
  `;

  document.getElementById("app").innerHTML = style + `
  <div class="login-container">
    
    <!-- Floating Hexagons Background -->
    <div class="floating-hex hidden lg:flex" style="left: 10%; top: 30%;">
      <svg viewBox="0 0 24 24"><polygon points="12 2 22 7 22 17 12 22 2 17 2 7 12 2"></polygon><circle cx="9" cy="11" r="2"></circle><path d="M17 11h-4v4"></path></svg>
      <span>PBJ</span>
    </div>
    <div class="floating-hex hidden lg:flex" style="left: 15%; top: 60%; animation-delay: -2s;">
      <svg viewBox="0 0 24 24"><polygon points="12 2 22 7 22 17 12 22 2 17 2 7 12 2"></polygon><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
      <span>KONTRAK</span>
    </div>
    <div class="floating-hex hidden lg:flex" style="right: 12%; top: 25%; animation-delay: -1s;">
      <svg viewBox="0 0 24 24"><polygon points="12 2 22 7 22 17 12 22 2 17 2 7 12 2"></polygon><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M9 12l2 2 4-4"></path></svg>
      <span>AMAN &<br>TERPERCAYA</span>
    </div>
    <div class="floating-hex hidden lg:flex" style="right: 15%; top: 70%; animation-delay: -3s;">
      <svg viewBox="0 0 24 24"><polygon points="12 2 22 7 22 17 12 22 2 17 2 7 12 2"></polygon><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
      <span>TRANSPARAN</span>
    </div>

    <!-- Main Card -->
    <div class="glass-card p-10 w-full max-w-md mx-4 fade-in">
      <div class="tl-ornament corner-ornament"></div>
      <div class="tr-ornament corner-ornament"></div>
      <div class="bl-ornament corner-ornament"></div>
      <div class="br-ornament corner-ornament"></div>

      <!-- Logo + Title -->
      <div class="flex flex-col items-center mb-6">
        <img src="Logo_Papua_Barat_Daya.png" alt="Logo Papua Barat Daya" class="w-20 h-20 object-contain mb-3 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]" />
        <h1 class="text-white text-4xl font-extrabold tracking-widest drop-shadow-md">SIKON</h1>
        <p class="text-[#D4AF37] font-semibold text-sm mt-1 drop-shadow-sm text-center">Sistem Informasi Kontrak Otomatis</p>
        <p class="text-white/80 text-xs mt-1 text-center font-medium">Pengadaan Barang/Jasa Pemerintah<br>Provinsi Papua Barat Daya</p>
      </div>

      <!-- Icons Row -->
      <div class="flex justify-between items-center px-2 mb-8 border-t border-b border-[#D4AF37]/20 py-4">
        <div class="flex flex-col items-center text-[#D4AF37] gap-1">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          <span class="text-[9px] font-bold tracking-wider">KONTRAK</span>
        </div>
        <div class="w-px h-8 bg-[#D4AF37]/20"></div>
        <div class="flex flex-col items-center text-[#D4AF37] gap-1">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path></svg>
          <span class="text-[9px] font-bold tracking-wider">REGULASI</span>
        </div>
        <div class="w-px h-8 bg-[#D4AF37]/20"></div>
        <div class="flex flex-col items-center text-[#D4AF37] gap-1">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
          <span class="text-[9px] font-bold tracking-wider">PBJ</span>
        </div>
        <div class="w-px h-8 bg-[#D4AF37]/20"></div>
        <div class="flex flex-col items-center text-[#D4AF37] gap-1 text-center leading-none">
          <svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
          <span class="text-[8px] font-bold tracking-wider">AMAN &<br>TERPERCAYA</span>
        </div>
      </div>

      <!-- Form -->
      <form id="login-form" class="space-y-4">
        <div>
          <label class="block text-white text-xs font-semibold mb-1.5 uppercase tracking-wider">Username</label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg class="h-5 w-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
            </div>
            <input id="login-username" type="text" placeholder="Masukkan username"
              class="w-full rounded-lg input-dark pl-10 pr-3 py-3 text-sm transition-colors" autocomplete="username" />
          </div>
        </div>
        <div>
          <label class="block text-white text-xs font-semibold mb-1.5 uppercase tracking-wider">Password</label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg class="h-5 w-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
            </div>
            <input id="login-password" type="password" placeholder="Masukkan password"
              class="w-full rounded-lg input-dark pl-10 pr-10 py-3 text-sm transition-colors" autocomplete="current-password" />
            <div class="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-white/50 hover:text-white" onclick="const p = document.getElementById('login-password'); p.type = p.type === 'password' ? 'text' : 'password';">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
            </div>
          </div>
        </div>

        ${state.loginError ? `
          <div class="rounded-lg bg-red-500/20 border border-red-500/50 text-red-200 text-sm px-4 py-3">
            ⚠ ${state.loginError}
          </div>` : ""}

        <button type="submit" id="login-btn" class="w-full rounded-lg btn-gold-green text-white font-bold py-3 mt-4 shadow-lg transition-all flex items-center justify-center gap-2" ${state.loginLoading ? "disabled" : ""}>
          ${state.loginLoading
            ? `<span class="spinner">⟳</span> Masuk...`
            : `<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg> MASUK KE SISTEM`}
        </button>
      </form>

      <div class="border-t border-white/10 mt-8 pt-6 text-center">
        <p class="text-white/40 text-xs font-semibold">SIKON v2.0</p>
        <p class="text-white/30 text-[10px] mt-1">Pengadaan Barang/Jasa Pemerintah Provinsi Papua Barat Daya</p>
        <p class="text-white/30 text-[10px] mt-0.5">© ${new Date().getFullYear()}</p>
      </div>
    </div>
  </div>`;

  document.getElementById("login-form").onsubmit = async (e) => {
    e.preventDefault();
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value;
    if (!username || !password) { state.loginError = "Username dan password wajib diisi."; return render(); }
    state.loginLoading = true; state.loginError = ""; render();
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login gagal");
      saveAuth(data.token, data.user);
      currentView = "dashboard";
      await loadStats();
      await loadMasterData();
      render();
    } catch (err) {
      state.loginError = err.message;
      state.loginLoading = false;
      render();
    }
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   RENDER: DASHBOARD
   ═══════════════════════════════════════════════════════════════════════════ */
function renderDashboard() {
  document.body.style.background = "linear-gradient(180deg, #f4faf7 0%, #eef6f4 100%)";
  const s = state.stats || {};
  const history5 = state.history.slice(0, 6);

  const KATEGORI_LABEL = {
    konstruksi: "Konstruksi",
    konsultansi_konstruksi: "Konsultansi K.",
    barang: "Barang",
    jasa_lainnya: "Jasa Lainnya",
    konsultansi_non_konstruksi: "Konsultansi Non-K",
  };
  const KATEGORI_COLOR = {
    konstruksi: "#1ead7c",
    konsultansi_konstruksi: "#f59e0b",
    barang: "#8b5cf6",
    jasa_lainnya: "#14b8a6",
    konsultansi_non_konstruksi: "#6366f1",
  };

  // Bar chart SVG
  const perKat = s.perKategori || {};
  const katEntries = Object.entries(perKat).filter(([,v]) => v > 0);
  const maxVal = Math.max(...katEntries.map(([,v]) => v), 1);
  const barChart = katEntries.length === 0
    ? `<p class="text-sm text-slate-400 text-center py-6">Belum ada data kontrak</p>`
    : `<div class="flex items-end gap-3 h-28 mt-2">
        ${katEntries.map(([k, v]) => `
          <div class="flex flex-col items-center gap-1 flex-1">
            <span class="text-xs font-bold text-slate-600">${v}</span>
            <div class="w-full rounded-t-lg transition-all" style="height:${Math.round((v/maxVal)*96)}px;background:${KATEGORI_COLOR[k] || '#1ead7c'}"></div>
            <span class="text-[10px] text-slate-500 text-center leading-tight">${KATEGORI_LABEL[k] || k}</span>
          </div>`).join("")}
      </div>`;

  // Donut SPK vs Surat Perjanjian
  const pd = s.perDokumen || {};
  const spkCount = pd.SPK || 0;
  const spCount  = pd["Surat Perjanjian"] || 0;
  const total = spkCount + spCount || 1;
  const spkPct = Math.round((spkCount / total) * 100);

  const statCards = [
    {
      label: "Total Kontrak", value: s.totalKontrak || 0,
      icon: "📄", color: "from-brand-500 to-brand-600",
      sub: `${s.kontrakBulanIni || 0} kontrak bulan ini`,
    },
    {
      label: "Total Nilai Kontrak", value: fmtRpShort(s.totalNilai || 0),
      icon: "💰", color: "from-sea-500 to-sea-600",
      sub: "Akumulasi semua kontrak",
    },
    {
      label: "SPK", value: spkCount,
      icon: "📋", color: "from-amber-400 to-amber-500",
      sub: `${spkPct}% dari total kontrak`,
    },
    {
      label: "Surat Perjanjian", value: spCount,
      icon: "📑", color: "from-violet-500 to-violet-600",
      sub: `${100 - spkPct}% dari total kontrak`,
    },
  ];

  document.getElementById("app").innerHTML = `
  <div class="app-shell min-h-screen">

    <!-- Top Bar -->
    <div class="topbar">
      <div class="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <img src="Logo_Papua_Barat_Daya.png" alt="Logo" class="w-9 h-9 object-contain" />
          <div class="hidden sm:block">
            <p class="font-bold text-slate-900 text-sm leading-tight">SIKON</p>
            <p class="text-xs text-slate-500">Papua Barat Daya</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span class="hidden sm:block text-sm text-slate-600">
            👤 <b>${auth.user?.nama || auth.user?.username || "Pengguna"}</b>
            <span class="ml-1 text-xs px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 font-semibold">${auth.user?.role === "admin" ? "Admin" : "Operator"}</span>
          </span>
          <button id="btn-wizard" class="px-4 py-2 rounded-lg bg-gradient-to-r from-brand-600 to-sea-600 text-white text-sm font-semibold shadow hover:opacity-90 transition">
            + Buat Kontrak
          </button>
          <button id="btn-logout" class="px-3 py-2 rounded-lg border border-slate-200 text-slate-500 text-sm hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition">
            Keluar
          </button>
        </div>
      </div>
    </div>

    <!-- Main content -->
    <div class="max-w-7xl mx-auto px-4 md:px-6 py-8 fade-in">

      <!-- Welcome -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-slate-900">Selamat datang, ${auth.user?.nama || auth.user?.username}! 👋</h1>
        <p class="text-slate-500 mt-1">Berikut ringkasan aktivitas kontrak Pemerintah Provinsi Papua Barat Daya.</p>
      </div>

      <!-- Stat cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        ${statCards.map(sc => `
          <div class="stat-card">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">${sc.label}</p>
                <p class="text-2xl font-bold text-slate-900">${sc.value}</p>
                <p class="text-xs text-slate-400 mt-1">${sc.sub}</p>
              </div>
              <div class="w-10 h-10 rounded-xl bg-gradient-to-br ${sc.color} flex items-center justify-center text-xl shadow-sm">
                ${sc.icon}
              </div>
            </div>
          </div>`).join("")}
      </div>

      <div class="grid lg:grid-cols-3 gap-6 mb-8">

        <!-- Bar chart distribusi kategori -->
        <div class="card p-5 lg:col-span-2">
          <h2 class="font-semibold text-slate-800 mb-1">Distribusi per Kategori Pekerjaan</h2>
          <p class="text-xs text-slate-400 mb-3">Jumlah kontrak berdasarkan jenis pekerjaan</p>
          ${barChart}
        </div>

        <!-- SPK vs Surat Perjanjian -->
        <div class="card p-5">
          <h2 class="font-semibold text-slate-800 mb-1">Jenis Dokumen</h2>
          <p class="text-xs text-slate-400 mb-5">SPK vs Surat Perjanjian</p>
          <div class="space-y-3">
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span class="text-slate-600 font-medium">SPK</span>
                <span class="font-bold text-sea-600">${spkCount} <span class="text-xs font-normal text-slate-400">(${spkPct}%)</span></span>
              </div>
              <div class="w-full bg-slate-100 rounded-full h-2.5">
                <div class="bg-sea-500 h-2.5 rounded-full transition-all" style="width:${spkPct}%"></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span class="text-slate-600 font-medium">Surat Perjanjian</span>
                <span class="font-bold text-brand-600">${spCount} <span class="text-xs font-normal text-slate-400">(${100 - spkPct}%)</span></span>
              </div>
              <div class="w-full bg-slate-100 rounded-full h-2.5">
                <div class="bg-brand-500 h-2.5 rounded-full transition-all" style="width:${100 - spkPct}%"></div>
              </div>
            </div>
          </div>
          <div class="mt-6 pt-4 border-t border-slate-100 text-center">
            <p class="text-3xl font-bold text-slate-900">${s.totalKontrak || 0}</p>
            <p class="text-xs text-slate-400 mt-0.5">Total Kontrak</p>
          </div>
        </div>
      </div>

      <!-- Kontrak terbaru -->
      <div class="card p-5 mb-8">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="font-semibold text-slate-800">Kontrak Terbaru</h2>
            <p class="text-xs text-slate-400 mt-0.5">6 kontrak yang paling baru dibuat</p>
          </div>
          <button id="btn-wizard2" class="text-sm text-brand-600 font-semibold hover:underline">+ Buat Baru</button>
        </div>

        ${history5.length === 0
          ? `<div class="text-center py-10 text-slate-400">
               <p class="text-4xl mb-3">📄</p>
               <p class="font-medium">Belum ada kontrak</p>
               <p class="text-sm mt-1">Klik "+ Buat Kontrak" untuk mulai.</p>
             </div>`
          : `<div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-xs uppercase text-slate-400 border-b">
                    <th class="pb-2 pr-4">Nama Paket</th>
                    <th class="pb-2 pr-4">Kategori</th>
                    <th class="pb-2 pr-4">Nilai</th>
                    <th class="pb-2 pr-4">Dokumen</th>
                    <th class="pb-2 pr-4">Tanggal</th>
                    <th class="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  ${history5.map(h => {
                    const KCAT = { konsultansi_konstruksi:"Konsultansi K.", barang:"Barang", jasa_lainnya:"Jasa Lainnya", konsultansi_non_konstruksi:"Konsultansi Non-K" };
                    const KBG  = { konsultansi_konstruksi:"bg-amber-50 text-amber-700", barang:"bg-purple-50 text-purple-700", jasa_lainnya:"bg-teal-50 text-teal-700", konsultansi_non_konstruksi:"bg-indigo-50 text-indigo-700" };
                    const tgl  = h.created_at ? new Date(h.created_at).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}) : "-";
                    return `
                    <tr class="border-b last:border-0 hover:bg-slate-50 transition">
                      <td class="py-3 pr-4 font-medium max-w-[220px] truncate">${h.nama_paket}</td>
                      <td class="pr-4"><span class="text-xs px-2 py-1 rounded-full ${KBG[h.jenis_pekerjaan] || "bg-slate-100 text-slate-600"}">${KCAT[h.jenis_pekerjaan] || "Konstruksi"}</span></td>
                      <td class="pr-4 text-slate-600">${fmtRpShort(h.nilai_kontrak)}</td>
                      <td class="pr-4"><span class="text-xs px-2 py-1 rounded-full ${h.jenis_dokumen === "SPK" ? "bg-sea-50 text-sea-700" : "bg-brand-50 text-brand-700"}">${h.jenis_dokumen === "SPK" ? "SPK" : "Surat Perjanjian"}</span></td>
                      <td class="pr-4 text-slate-400 text-xs">${tgl}</td>
                      <td class="text-right"><a href="${API}/contracts/${h.id}/download" class="text-brand-600 font-semibold hover:underline text-xs">Unduh ↓</a></td>
                    </tr>`;
                  }).join("")}
                </tbody>
              </table>
            </div>`}
      </div>

    </div>
  </div>`;

  document.getElementById("btn-wizard")?.addEventListener("click", () => {
    currentView = "wizard"; state.step = 1; render();
  });
  document.getElementById("btn-wizard2")?.addEventListener("click", () => {
    currentView = "wizard"; state.step = 1; render();
  });
  document.getElementById("btn-logout")?.addEventListener("click", async () => {
    try { await fetch("/api/auth/logout", { method: "POST", headers: { "Authorization": "Bearer " + auth.token } }); } catch {}
    clearAuth();
    currentView = "login";
    render();
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   WIZARD HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */
function el(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }

function wizardTopbar() {
  return `
  <div class="topbar">
    <div class="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <img src="Logo_Papua_Barat_Daya.png" alt="Logo" class="w-9 h-9 object-contain" />
        <div class="hidden sm:block">
          <p class="font-bold text-slate-900 text-sm leading-tight">SIKON</p>
          <p class="text-xs text-slate-500">Papua Barat Daya</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button id="btn-dashboard" class="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-brand-50 hover:border-brand-300 transition">
          ← Dashboard
        </button>
        <button id="btn-logout-w" class="px-3 py-2 rounded-lg border border-slate-200 text-slate-500 text-sm hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition">
          Keluar
        </button>
      </div>
    </div>
  </div>`;
}

function stepper() {
  const steps = ["Paket Pekerjaan", "Pejabat (PPK)", "Penyedia", "Preview & Generate", "Riwayat"];
  return `
  <div class="flex items-center gap-2 mb-8 overflow-x-auto pb-1">
    ${steps.map((s, i) => {
      const n = i + 1; const active = state.step === n; const done = state.step > n;
      return `
      <button data-step="${n}" class="step-btn flex items-center gap-2 whitespace-nowrap px-3.5 py-2 rounded-full border text-sm font-medium
        ${active ? "bg-brand-600 border-brand-600 text-white shadow" : done ? "bg-brand-50 border-brand-200 text-brand-700" : "bg-white border-slate-200 text-slate-500"}">
        <span class="step-dot w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${active ? "bg-white/20" : done ? "bg-brand-600 text-white" : "bg-slate-100"}">${done ? "✓" : n}</span>
        ${s}
      </button>
      ${i < steps.length - 1 ? '<div class="w-6 h-px bg-slate-200 shrink-0"></div>' : ""}`;
    }).join("")}
  </div>`;
}

function field(label, inputHtml, hint) {
  return `<div>
    <label class="field-label block mb-1.5">${label}</label>
    ${inputHtml}
    ${hint ? `<p class="text-xs text-slate-400 mt-1">${hint}</p>` : ""}
  </div>`;
}
function input(name, value, opts = {}) {
  const attrs = opts.type === "number" ? `type="number"` : `type="${opts.type || "text"}"`;
  return `<input data-bind="${name}" ${attrs} value="${value ?? ""}" placeholder="${opts.placeholder || ""}"
    class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/>`;
}
function select(name, value, options) {
  return `<select data-bind="${name}" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white">
    ${options.map(([v, l]) => `<option value="${v}" ${v === value ? "selected" : ""}>${l}</option>`).join("")}
  </select>`;
}

/* ── Category toggle ── */
function categoryToggle(p) {
  const opts = [
    ["konstruksi", "Pekerjaan Konstruksi"],
    ["konsultansi_konstruksi", "Konsultansi Konstruksi"],
    ["barang", "Pengadaan Barang"],
    ["jasa_lainnya", "Jasa Lainnya"],
    ["konsultansi_non_konstruksi", "Konsultansi Non-Konstruksi"],
  ];
  const ambangText = {
    konstruksi: "Rp200 juta · Harga Satuan / Lumsum",
    konsultansi_konstruksi: "Rp100 juta · Lumsum / Waktu Penugasan",
    barang: "Rp200 juta · Harga Satuan / Lumsum",
    jasa_lainnya: "Rp200 juta · Harga Satuan / Lumsum",
    konsultansi_non_konstruksi: "Rp100 juta · Lumsum / Waktu Penugasan",
  };
  return `
  <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-6">
    ${opts.map(([v, l]) => `
      <button data-cat="${v}" class="cat-btn text-left rounded-xl border-2 p-4 ${p.jenis_pekerjaan === v ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white hover:border-brand-300"}">
        <p class="font-semibold text-sm">${l}</p>
        <p class="text-xs text-slate-500 mt-1">Ambang SPK: ${ambangText[v]}</p>
      </button>`).join("")}
  </div>`;
}

function checkbox(name, checked, label) {
  return `<label class="flex items-center gap-2 text-sm text-slate-600 mt-1">
    <input data-checkbox="${name}" type="checkbox" ${checked ? "checked" : ""} class="rounded border-slate-300"/>
    ${label}
  </label>`;
}

/* ── Step 1: Paket ── */
function stepPaket() {
  const p = state.paket;
  const isKonsultansi = p.jenis_pekerjaan === "konsultansi_konstruksi" || p.jenis_pekerjaan === "konsultansi_non_konstruksi";
  const isBarang = p.jenis_pekerjaan === "barang";
  const isJasaLainnya = p.jenis_pekerjaan === "jasa_lainnya";
  const isJaminanKategori = isBarang || isJasaLainnya;
  const kontrakOpts = JENIS_KONTRAK_OPTIONS[p.jenis_pekerjaan] || JENIS_KONTRAK_OPTIONS.konstruksi;

  return `
  <div class="card p-6 md:p-8">
    <h2 class="text-lg font-semibold mb-1">1. Data Paket Pekerjaan</h2>
    <p class="text-sm text-slate-500 mb-6">Pilih kategori pekerjaan, lalu isi data dasar paket. Sistem akan otomatis menentukan bentuk dokumen kontrak berdasarkan kategori & nilai kontrak.</p>

    ${categoryToggle(p)}

    <div class="grid md:grid-cols-2 gap-5">
      ${field("Nama Paket Pekerjaan", input("nama_paket", p.nama_paket, { placeholder: isBarang ? "Pengadaan Alat/Bahan …" : isJasaLainnya ? "Jasa Kebersihan/Keamanan/Sewa …" : isKonsultansi ? "Perencanaan/Pengawasan …" : "Pembangunan/Rehabilitasi …" }))}
      ${field("Sumber Dana", input("sumber_dana", p.sumber_dana))}
      ${field("Nilai Kontrak (Rp)", input("nilai_kontrak", p.nilai_kontrak, { type: "number", placeholder: "398500000" }))}
      ${field("Jenis Kontrak", select("jenis_kontrak", p.jenis_kontrak, kontrakOpts))}
      ${field("Jenis Penyedia", select("jenis_penyedia", p.jenis_penyedia, [["badan_usaha", "Badan Usaha"], ["perorangan", "Perorangan"]]))}
      ${field(isBarang ? "Jangka Waktu Penyerahan Barang (hari kalender)" : "Jangka Waktu Pelaksanaan (hari kalender)", input("jangka_waktu_hari", p.jangka_waktu_hari, { type: "number" }))}
      ${field("Tanggal Penandatanganan Kontrak", input("tanggal_kontrak", p.tanggal_kontrak, { type: "date" }).replace('type="text"', 'type="date"'))}
      ${field("Lokasi Penandatanganan", input("lokasi_ttd", p.lokasi_ttd))}
      ${field("Nomor Kontrak/SPK", input("nomor_kontrak", p.nomor_kontrak))}
      ${field("% Uang Muka", input("persentase_uang_muka", p.persentase_uang_muka, { type: "number" }))}
      ${field("No. & Tgl SPPBJ", `<div class="flex gap-2">${input("no_sppbj", p.no_sppbj, { placeholder: "Nomor" })}${input("tgl_sppbj", p.tgl_sppbj, { placeholder: "Tanggal" })}</div>`)}
      ${field("No. & Tgl Surat Penetapan Pemenang", `<div class="flex gap-2">${input("no_sp_pemenang", p.no_sp_pemenang, { placeholder: "Nomor" })}${input("tgl_sp_pemenang", p.tgl_sp_pemenang, { placeholder: "Tanggal" })}</div>`)}
      ${field((isKonsultansi || isJaminanKategori) ? "Lokasi Pekerjaan / Serah Terima (opsional)" : "Lokasi Pekerjaan (untuk SPL)", input("lokasi_pekerjaan", p.lokasi_pekerjaan, { placeholder: "Kampung …, Distrik …, Kabupaten …" }))}
      ${field("Nomor SPMK", input("nomor_spmk", p.nomor_spmk))}
      ${field("Tanggal SPMK / Mulai Kerja", input("tanggal_spmk", p.tanggal_spmk, { type: "date" }).replace('type="text"', 'type="date"'))}
      ${isKonsultansi ? field("Daftar Personil / Tenaga Ahli (opsional)", `<textarea data-bind="daftar_personil" rows="2" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Team Leader (1 OB), Tenaga Ahli Struktur (2 OB), dst.">${p.daftar_personil || ""}</textarea>`) : ""}
      ${isJaminanKategori ? field("Masa Garansi (opsional)", input("masa_garansi", p.masa_garansi, { placeholder: "12 bulan sejak BAST" })) : ""}
      ${isJaminanKategori ? field("Kas Tujuan Pencairan Jaminan Pelaksanaan (opsional)", input("kas_tujuan_jaminan", p.kas_tujuan_jaminan, { placeholder: "Kas Daerah Provinsi Papua Barat Daya" })) : ""}
    </div>
    ${(isKonsultansi || isJaminanKategori) ? `<div class="mt-3">${checkbox("butuh_serah_terima_lokasi", p.butuh_serah_terima_lokasi, isBarang ? "Barang perlu instalasi/serah terima di lokasi tertentu → terbitkan SPL" : isJasaLainnya ? "Layanan perlu serah terima/akses lokasi tertentu → terbitkan SPL" : "Layanan ini butuh akses/serah terima lokasi proyek → terbitkan SPL")}</div>` : ""}

    ${previewPanel()}

    <div class="flex justify-end mt-6">
      <button id="next1" class="px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 shadow">Lanjut ke Pejabat (PPK) →</button>
    </div>
  </div>`;
}

function previewPanel() {
  if (!state.preview) return "";
  if (state.preview.error) return `<div class="mt-6 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm p-4">${state.preview.error}</div>`;
  const d = state.preview;
  const isSPK = d.jenisDokumen === "SPK";
  const isKonsultansiKonstruksi = d.kategori === "konsultansi_konstruksi";
  const KATEGORI_LABEL = { konstruksi: "Pekerjaan Konstruksi", konsultansi_konstruksi: "Jasa Konsultansi Konstruksi", barang: "Pengadaan Barang", jasa_lainnya: "Jasa Lainnya", konsultansi_non_konstruksi: "Jasa Konsultansi Non-Konstruksi" };
  const AMBANG_TAG = { konstruksi: "(Konstruksi)", konsultansi_konstruksi: "(Konsultansi)", barang: "(Barang)", jasa_lainnya: "(Jasa Lainnya)", konsultansi_non_konstruksi: "(Konsultansi)" };
  const kategoriLabel = KATEGORI_LABEL[d.kategori] || "Pekerjaan Konstruksi";
  const ambangTag = AMBANG_TAG[d.kategori] || "";
  const fileList = isSPK ? ["SPK.docx"] : isKonsultansiKonstruksi ? ["SURAT_PERJANJIAN.docx", "SSKK.docx", "SSUK_KERANGKA_PERLU_VERIFIKASI.docx"] : ["SURAT_PERJANJIAN.docx", "SSKK.docx", "SSUK.docx (lampiran baku)"];
  fileList.push("SPMK.docx");
  if (d.perluSPL) fileList.push("SPL_Serah_Terima_Lokasi_Kerja.docx");

  return `
  <div class="mt-6 rounded-xl border ${isSPK ? "bg-sea-50 border-sea-200" : "bg-brand-50 border-brand-200"} p-5">
    <div class="flex items-start justify-between flex-wrap gap-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wide ${isSPK ? "text-sea-700" : "text-brand-700"}">Logika Sistem · ${kategoriLabel}</p>
        <p class="text-base font-bold mt-0.5">${isSPK ? "Surat Perintah Kerja (SPK)" : "Surat Perjanjian + SSUK + SSKK"}</p>
        <p class="text-sm text-slate-600 mt-1">
          Nilai kontrak ${d.ambangSPK ? `≤ ${fmtRp(d.ambangSPK)}` : ""} → dipilih <b>${isSPK ? "SPK" : "Surat Perjanjian"}</b>.
          ${isSPK ? "SSUK/SSKK tidak diperlukan sebagai dokumen terpisah." : "Wajib dilampiri SSUK dan SSKK (khusus, diisi otomatis)."}
        </p>
      </div>
      <div class="text-xs bg-white/70 rounded-lg px-3 py-2 border ${isSPK ? "border-sea-200" : "border-brand-200"}">
        Ambang batas SPK ${ambangTag}: <b>${fmtRp(d.ambangSPK)}</b>
      </div>
    </div>
    ${d.warnings?.length ? `<div class="mt-3 text-sm bg-amber-50 border border-amber-200 text-amber-700 rounded-lg p-3">⚠ ${d.warnings.join(" ")}</div>` : ""}
    ${!isSPK && isKonsultansiKonstruksi ? `<div class="mt-3 text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3">⚠ SSUK Jasa Konsultansi Konstruksi belum memiliki file baku resmi — akan dihasilkan sebagai kerangka umum yang perlu diverifikasi.</div>` : ""}
    <div class="flex gap-2 mt-3 flex-wrap">
      ${fileList.map(f => `<span class="text-xs font-mono bg-white border border-slate-200 rounded px-2 py-1">${f}</span>`).join("")}
    </div>
    <p class="text-xs text-slate-500 mt-2">SPMK selalu diterbitkan. SPL (serah terima lokasi kerja) ${d.kategori === "konstruksi" ? "selalu diterbitkan untuk pekerjaan konstruksi fisik." : "hanya diterbitkan bila dicentang di atas."}</p>
  </div>`;
}

function partyCard(title, subtitle, items, selectedId, onKey, newFormFields, isVendor) {
  return `
  <div class="card p-6 md:p-8">
    <h2 class="text-lg font-semibold mb-1">${title}</h2>
    <p class="text-sm text-slate-500 mb-6">${subtitle}</p>
    <div class="grid sm:grid-cols-2 gap-3 mb-5">
      ${items.map(it => `
        <button data-select="${onKey}" data-id="${it.id}" class="party-opt text-left rounded-xl border p-4 ${selectedId === it.id ? "border-brand-500 bg-brand-50 ring-1 ring-brand-300" : "border-slate-200 bg-white hover:border-brand-300"}">
          <p class="font-semibold text-sm">${it.nama}</p>
          <p class="text-xs text-slate-500 mt-1">${isVendor ? (it.jenis === "badan_usaha" ? "Badan Usaha" : "Perorangan") : it.satuan_kerja || ""}</p>
        </button>`).join("")}
      <button data-select="${onKey}" data-id="__new__" class="party-opt text-left rounded-xl border-2 border-dashed p-4 ${selectedId === "__new__" ? "border-brand-500 bg-brand-50" : "border-slate-300 hover:border-brand-300"}">
        <p class="font-semibold text-sm">+ Tambah Baru</p>
        <p class="text-xs text-slate-500 mt-1">Buat entri baru & simpan ke database</p>
      </button>
    </div>
    ${selectedId === "__new__" ? `<div class="grid md:grid-cols-2 gap-4 border-t pt-5">${newFormFields}</div>` : editExistingFields(isVendor, items.find(i => i.id === selectedId))}
  </div>`;
}

function editExistingFields(isVendor, item) {
  if (!item) return "";
  if (isVendor) {
    const isPerorangan = item.jenis === "perorangan";
    return `<div class="grid md:grid-cols-2 gap-4 border-t pt-5">
      ${isPerorangan ? "" : field("Nama Wakil/Direktur", input("vendor.wakil.nama", item.wakil?.nama))}
      ${isPerorangan ? "" : field("Jabatan Wakil", input("vendor.wakil.jabatan", item.wakil?.jabatan))}
      ${field("Alamat", input("vendor.alamat", item.alamat))}
      ${isPerorangan ? field("No. Kartu Identitas (KTP/SIM/Paspor)", input("vendor.nomor_identitas", item.nomor_identitas)) : field("NPWP", input("vendor.npwp", item.npwp))}
      ${isPerorangan ? "" : field("Nomor Akta Notaris", input("vendor.akta_notaris.nomor", item.akta_notaris?.nomor))}
      ${isPerorangan ? "" : field("Tanggal Akta", input("vendor.akta_notaris.tanggal", item.akta_notaris?.tanggal))}
      ${isPerorangan ? "" : field("Nama Notaris", input("vendor.akta_notaris.notaris", item.akta_notaris?.notaris))}
      ${field("Email", input("vendor.email", item.email))}
    </div>`;
  }
  return `<div class="grid md:grid-cols-2 gap-4 border-t pt-5">
    ${field("Nama Pejabat", input("official.nama", item.nama))}
    ${field("NIP", input("official.nip", item.nip))}
    ${field("Jabatan", input("official.jabatan", item.jabatan))}
    ${field("Satuan Kerja", input("official.satuan_kerja", item.satuan_kerja))}
    ${field("Alamat", input("official.alamat", item.alamat))}
    ${field("No. SK Pengangkatan", input("official.sk_pengangkatan.nomor", item.sk_pengangkatan?.nomor))}
    ${field("Tanggal SK", input("official.sk_pengangkatan.tanggal", item.sk_pengangkatan?.tanggal))}
  </div>`;
}

function stepOfficial() {
  const newFields = `
    ${field("Nama Pejabat", input("newOfficial.nama", state.newOfficial?.nama))}
    ${field("NIP", input("newOfficial.nip", state.newOfficial?.nip))}
    ${field("Jabatan", input("newOfficial.jabatan", state.newOfficial?.jabatan, { placeholder: "Pejabat Pembuat Komitmen (PPK)" }))}
    ${field("Satuan Kerja", input("newOfficial.satuan_kerja", state.newOfficial?.satuan_kerja))}
    ${field("Alamat", input("newOfficial.alamat", state.newOfficial?.alamat))}
    ${field("No. SK Pengangkatan", input("newOfficial.sk_pengangkatan.nomor", state.newOfficial?.sk_pengangkatan?.nomor))}
  `;
  return `
  ${partyCard("2. Pejabat Penandatangan Kontrak (PPK)", "Pilih pejabat yang sudah tersimpan atau tambahkan baru.", state.officials, state.officialId, "official", newFields, false)}
  <div class="flex justify-between mt-6">
    <button id="back2" class="px-5 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold">← Kembali</button>
    <button id="next2" class="px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 shadow">Lanjut ke Penyedia →</button>
  </div>`;
}

function stepVendor() {
  const nv = state.newVendor || {};
  const isPerorangan = nv.jenis === "perorangan";
  const newFields = `
    ${field("Nama Perusahaan/Penyedia", input("newVendor.nama", nv.nama))}
    ${field("Jenis", select("newVendor.jenis", nv.jenis || "badan_usaha", [["badan_usaha", "Badan Usaha"], ["perorangan", "Perorangan"]]))}
    ${isPerorangan ? "" : field("Nama Wakil/Direktur", input("newVendor.wakil.nama", nv.wakil?.nama))}
    ${isPerorangan ? "" : field("Jabatan Wakil", input("newVendor.wakil.jabatan", nv.wakil?.jabatan, { placeholder: "Direktur" }))}
    ${field("Alamat", input("newVendor.alamat", nv.alamat))}
    ${isPerorangan ? field("No. Kartu Identitas (KTP/SIM/Paspor)", input("newVendor.nomor_identitas", nv.nomor_identitas)) : field("NPWP", input("newVendor.npwp", nv.npwp))}
  `;
  return `
  ${partyCard("3. Penyedia (Vendor)", "Pilih vendor yang sudah tersimpan atau tambahkan baru.", state.vendors, state.vendorId, "vendor", newFields, true)}
  <div class="flex justify-between mt-6">
    <button id="back3" class="px-5 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold">← Kembali</button>
    <button id="next3" class="px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 shadow">Lanjut ke Preview →</button>
  </div>`;
}

function kelengkapanPanel() {
  const k = state.kelengkapan;
  if (!k) return `<div class="mt-6 text-sm text-slate-400">Memeriksa kelengkapan data…</div>`;
  if (k.error) return `<div class="mt-6 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm p-4">${k.error}</div>`;
  if (k.complete) {
    return `<div class="mt-6 rounded-xl bg-brand-50 border border-brand-200 p-4 text-sm text-brand-800 flex items-center gap-2">
      <span class="text-lg">✅</span> Semua field penting sudah terisi. Dokumen siap digenerate tanpa titik-titik kosong.
    </div>`;
  }
  const groups = {};
  k.missing.forEach(m => { (groups[m.group] = groups[m.group] || []).push(m.label); });
  return `
  <div class="mt-6 rounded-xl bg-amber-50 border border-amber-200 p-4">
    <p class="text-sm font-semibold text-amber-800 flex items-center gap-2">⚠ ${k.totalMissing} field belum diisi — akan tampil sebagai "……" di dokumen</p>
    <div class="grid sm:grid-cols-3 gap-3 mt-3">
      ${Object.entries(groups).map(([group, labels]) => `
        <div class="bg-white/70 rounded-lg border border-amber-200 p-3">
          <p class="text-xs font-semibold text-amber-700 uppercase mb-1.5">${group}</p>
          <ul class="text-xs text-amber-800 space-y-1 list-disc list-inside">
            ${labels.map(l => `<li>${l}</li>`).join("")}
          </ul>
        </div>`).join("")}
    </div>
    <p class="text-xs text-amber-700 mt-3">Anda tetap bisa generate sekarang — field kosong akan diisi placeholder "……" yang mudah dicari-ganti manual di Word.</p>
  </div>`;
}

function stepGenerate() {
  const p = state.paket;
  const vendor = state.vendorId === "__new__" ? state.newVendor : state.vendors.find(v => v.id === state.vendorId);
  const official = state.officialId === "__new__" ? state.newOfficial : state.officials.find(o => o.id === state.officialId);

  return `
  <div class="card p-6 md:p-8">
    <h2 class="text-lg font-semibold mb-1">4. Preview & Generate Kontrak</h2>
    <p class="text-sm text-slate-500 mb-6">Periksa ringkasan sebelum menghasilkan berkas .docx.</p>

    ${previewPanel()}
    ${kelengkapanPanel()}

    <div class="grid md:grid-cols-3 gap-4 mt-6 text-sm">
      <div class="rounded-xl border border-slate-200 p-4">
        <p class="text-xs font-semibold text-slate-400 uppercase mb-2">Paket</p>
        <p class="font-medium">${p.nama_paket || "-"}</p>
        <p class="text-slate-500 mt-1">${({ konsultansi_konstruksi: "Jasa Konsultansi Konstruksi", barang: "Pengadaan Barang", jasa_lainnya: "Jasa Lainnya", konsultansi_non_konstruksi: "Jasa Konsultansi Non-Konstruksi" })[p.jenis_pekerjaan] || "Pekerjaan Konstruksi"}</p>
        <p class="text-slate-500">${fmtRp(p.nilai_kontrak)} · ${({ harga_satuan: "Harga Satuan", lumsum: "Lumsum", waktu_penugasan: "Waktu Penugasan" })[p.jenis_kontrak] || p.jenis_kontrak}</p>
        <p class="text-slate-500">${p.sumber_dana}</p>
      </div>
      <div class="rounded-xl border border-slate-200 p-4">
        <p class="text-xs font-semibold text-slate-400 uppercase mb-2">Pejabat Penandatangan</p>
        <p class="font-medium">${official?.nama || "-"}</p>
        <p class="text-slate-500 mt-1">${official?.satuan_kerja || "-"}</p>
      </div>
      <div class="rounded-xl border border-slate-200 p-4">
        <p class="text-xs font-semibold text-slate-400 uppercase mb-2">Penyedia</p>
        <p class="font-medium">${vendor?.nama || "-"}</p>
        <p class="text-slate-500 mt-1">${vendor?.wakil?.nama || "-"}</p>
      </div>
    </div>

    <div class="flex justify-between mt-8">
      <button id="back4" class="px-5 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold">← Kembali</button>
      <button id="generate" class="px-6 py-2.5 rounded-lg bg-gradient-to-r from-brand-600 to-sea-600 text-white text-sm font-semibold shadow hover:opacity-95">
        ${state.loading ? `<span class="spinner">⟳</span> Memproses…` : "🡇 Generate & Unduh Kontrak (.zip)"}
      </button>
    </div>
    ${state.lastResult ? `<div class="mt-5 rounded-xl bg-brand-50 border border-brand-200 p-4 text-sm text-brand-800">✅ Kontrak berhasil dibuat dan diunduh. Lihat juga di tab <b>Riwayat</b>.</div>` : ""}
  </div>`;
}

function stepHistory() {
  return `
  <div class="card p-6 md:p-8">
    <h2 class="text-lg font-semibold mb-1">5. Riwayat Kontrak</h2>
    <p class="text-sm text-slate-500 mb-6">Semua kontrak yang pernah dihasilkan sistem.</p>
    ${state.history.length === 0 ? `<p class="text-sm text-slate-400">Belum ada kontrak yang dibuat.</p>` : `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead><tr class="text-left text-xs uppercase text-slate-400 border-b">
          <th class="py-2">Paket</th><th>Kategori</th><th>Nilai</th><th>Dokumen</th><th>Jenis Kontrak</th><th></th>
        </tr></thead>
        <tbody>
          ${state.history.map(h => `
          <tr class="border-b last:border-0">
            <td class="py-3 font-medium">${h.nama_paket}</td>
            <td><span class="text-xs px-2 py-1 rounded-full ${{ konsultansi_konstruksi: "bg-amber-50 text-amber-700", barang: "bg-purple-50 text-purple-700", jasa_lainnya: "bg-teal-50 text-teal-700", konsultansi_non_konstruksi: "bg-indigo-50 text-indigo-700" }[h.jenis_pekerjaan] || "bg-slate-100 text-slate-600"}">${({ konsultansi_konstruksi: "Konsultansi", barang: "Barang", jasa_lainnya: "Jasa Lainnya", konsultansi_non_konstruksi: "Konsultansi Non-K" })[h.jenis_pekerjaan] || "Konstruksi"}</span></td>
            <td>${fmtRp(h.nilai_kontrak)}</td>
            <td><span class="text-xs px-2 py-1 rounded-full ${h.jenis_dokumen === "SPK" ? "bg-sea-50 text-sea-700" : "bg-brand-50 text-brand-700"}">${h.jenis_dokumen === "SPK" ? "SPK" : "Surat Perjanjian"}</span></td>
            <td>${({ harga_satuan: "Harga Satuan", lumsum: "Lumsum", waktu_penugasan: "Waktu Penugasan" })[h.jenis_kontrak] || h.jenis_kontrak}</td>
            <td class="text-right"><a href="${API}/contracts/${h.id}/download" class="text-brand-600 font-semibold hover:underline">Unduh ↓</a></td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`}
  </div>`;
}

/* ─── Render wizard ─────────────────────────────────────────────────────── */
function renderWizard() {
  document.body.style.background = "linear-gradient(180deg, #f4faf7 0%, #eef6f4 100%)";
  let body = "";
  if (state.step === 1) body = stepPaket();
  else if (state.step === 2) body = stepOfficial();
  else if (state.step === 3) body = stepVendor();
  else if (state.step === 4) body = stepGenerate();
  else body = stepHistory();

  document.getElementById("app").innerHTML = `
  <div class="app-shell min-h-screen">
    ${wizardTopbar()}
    <div class="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10 fade-in">
      ${stepper()}
      ${body}
    </div>
  </div>`;

  bind();
}

/* ─── Main render dispatcher ────────────────────────────────────────────── */
function render() {
  if (currentView === "login") { renderLogin(); return; }
  if (currentView === "dashboard") { renderDashboard(); return; }
  renderWizard();
}

/* ─── Data binding (wizard) ─────────────────────────────────────────────── */
function setDeep(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] = cur[parts[i]] || {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function bind() {
  // Dashboard button (from wizard topbar)
  document.getElementById("btn-dashboard")?.addEventListener("click", async () => {
    currentView = "dashboard";
    await loadStats();
    render();
  });
  document.getElementById("btn-logout-w")?.addEventListener("click", async () => {
    try { await fetch("/api/auth/logout", { method: "POST", headers: { "Authorization": "Bearer " + auth.token } }); } catch {}
    clearAuth();
    currentView = "login";
    render();
  });

  document.querySelectorAll(".step-btn").forEach(b => b.onclick = () => {
    state.step = Number(b.dataset.step);
    render();
    if (state.step === 4) refreshKelengkapan();
  });

  document.querySelectorAll("[data-bind]").forEach(elm => {
    elm.addEventListener("input", (e) => {
      const path = elm.dataset.bind;
      if (path.startsWith("vendor.")) {
        const v = state.vendors.find(v => v.id === state.vendorId);
        if (v) setDeep(v, path.replace("vendor.", ""), e.target.value);
      } else if (path.startsWith("official.")) {
        const o = state.officials.find(o => o.id === state.officialId);
        if (o) setDeep(o, path.replace("official.", ""), e.target.value);
      } else if (path.startsWith("newVendor.")) {
        state.newVendor = state.newVendor || { jenis: "badan_usaha", wakil: {}, akta_notaris: {} };
        setDeep(state.newVendor, path.replace("newVendor.", ""), e.target.value);
      } else if (path.startsWith("newOfficial.")) {
        state.newOfficial = state.newOfficial || { sk_pengangkatan: {} };
        setDeep(state.newOfficial, path.replace("newOfficial.", ""), e.target.value);
      } else {
        setDeep(state.paket, path, e.target.value);
        if (state.step === 1) refreshPreview();
      }
      if (path === "newVendor.jenis" || path === "vendor.jenis") render();
    });
  });

  document.querySelectorAll("[data-select]").forEach(btn => {
    btn.onclick = () => {
      const key = btn.dataset.select, id = btn.dataset.id;
      if (key === "vendor") state.vendorId = id; else state.officialId = id;
      render();
    };
  });

  document.querySelectorAll(".cat-btn").forEach(btn => {
    btn.onclick = () => {
      const cat = btn.dataset.cat;
      state.paket.jenis_pekerjaan = cat;
      const opts = JENIS_KONTRAK_OPTIONS[cat];
      if (!opts.some(([v]) => v === state.paket.jenis_kontrak)) state.paket.jenis_kontrak = opts[0][0];
      refreshPreview();
    };
  });

  document.querySelectorAll("[data-checkbox]").forEach(cb => {
    cb.addEventListener("change", (e) => {
      state.paket[cb.dataset.checkbox] = e.target.checked;
      refreshPreview();
    });
  });

  const go = (id, fn) => { const b = document.getElementById(id); if (b) b.onclick = fn; };
  go("next1", async () => { await refreshPreview(); state.step = 2; render(); });
  go("back2", () => { state.step = 1; render(); });
  go("next2", async () => {
    if (state.officialId === "__new__" && state.newOfficial?.nama) {
      const saved = await api("/officials", { method: "POST", body: JSON.stringify(state.newOfficial) });
      state.officials.push(saved); state.officialId = saved.id; state.newOfficial = null;
    }
    state.step = 3; render();
  });
  go("back3", () => { state.step = 2; render(); });
  go("next3", async () => {
    if (state.vendorId === "__new__" && state.newVendor?.nama) {
      const saved = await api("/vendors", { method: "POST", body: JSON.stringify(state.newVendor) });
      state.vendors.push(saved); state.vendorId = saved.id; state.newVendor = null;
    }
    state.step = 4; render();
    refreshKelengkapan();
  });
  go("back4", () => { state.step = 3; render(); });
  go("generate", onGenerate);
}

async function onGenerate() {
  state.loading = true; render();
  try {
    const vendor = state.vendorId === "__new__" ? state.newVendor : state.vendors.find(v => v.id === state.vendorId);
    const official = state.officialId === "__new__" ? state.newOfficial : state.officials.find(o => o.id === state.officialId);
    const paket = { ...state.paket, nilai_kontrak: Number(state.paket.nilai_kontrak || 0), jangka_waktu_hari: Number(state.paket.jangka_waktu_hari || 0) };

    const result = await api("/contracts/generate", {
      method: "POST",
      body: JSON.stringify({ paket, vendor, official }),
    });
    state.lastResult = result;
    window.location.href = API + "/contracts/" + result.contract.id + "/download";
    const history = await api("/contracts");
    state.history = history.reverse();
  } catch (e) {
    alert("Gagal membuat kontrak: " + e.message);
  } finally {
    state.loading = false; render();
  }
}

/* ─── Init ──────────────────────────────────────────────────────────────── */
(async function init() {
  if (auth.token) {
    // Verifikasi token masih valid
    try {
      const res = await fetch("/api/auth/me", { headers: { "Authorization": "Bearer " + auth.token } });
      if (!res.ok) { clearAuth(); currentView = "login"; render(); return; }
      await Promise.all([loadStats(), loadMasterData()]);
      currentView = "dashboard";
    } catch {
      clearAuth(); currentView = "login";
    }
  }
  render();
})();
