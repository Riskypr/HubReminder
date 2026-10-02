# Design.md — UI/UX & Design System (HubReminder)

## 1. Prinsip Desain
- **Mobile-first & at-a-glance**: informasi terpenting (status hari ini) harus terlihat dalam 1 detik begitu app dibuka, tanpa scroll.
- **Semantik warna konsisten dengan MagangHub asli**: biru = belum lapor/aktif, hijau = selesai — supaya pengguna langsung familiar, tidak perlu belajar sistem warna baru.
- **Minim setup, maksimal kontrol**: pengaturan reminder harus sederhana (bukan formulir teknis) tapi tetap fleksibel (jumlah, jeda, jam aktif).
- **Transparansi status koneksi**: pengguna harus selalu tahu apakah sesi akun masih terhubung atau butuh tindakan (reconnect).

## 2. Design Tokens

### 2.1 Warna
```css
:root {
  /* Status semantik — meniru warna asli MagangHub */
  --color-status-pending: #2F6FED;   /* biru — belum lapor */
  --color-status-pending-bg: #E8F0FE;
  --color-status-done: #2E9E5B;      /* hijau — selesai */
  --color-status-done-bg: #E6F6EC;
  --color-status-unknown: #8A8F98;   /* abu — tidak diketahui/gagal cek */
  --color-status-unknown-bg: #EEF0F2;

  /* Warna dasar aplikasi */
  --color-bg: #F7F8FA;
  --color-surface: #FFFFFF;
  --color-border: #E4E7EB;
  --color-text-primary: #1A1D23;
  --color-text-secondary: #5B6270;
  --color-text-muted: #9AA1AC;

  /* Aksen utama (tombol, link) */
  --color-primary: #2F6FED;
  --color-primary-dark: #1E4FBB;

  /* Warning (sesi expired) */
  --color-warning: #E0A100;
  --color-warning-bg: #FFF4DC;
}
```

### 2.2 Tipografi
- Font: sistem default (`Inter`/`system-ui`) — fokus pada keterbacaan angka status & waktu, bukan ornamen visual.
- Skala (mobile):
  - Status besar (badge utama): 22px / bold
  - H1: 20px / semibold
  - H2 (judul card): 16px / semibold
  - Body: 14px / regular
  - Caption (waktu, meta info): 12px / medium, warna `--color-text-muted`

### 2.3 Spacing & Radius
- Spacing scale (4px base): 4, 8, 12, 16, 24.
- Radius: card `rounded-2xl`, badge status `rounded-full`, button `rounded-xl`.
- Shadow lembut untuk card status utama agar menonjol dari background.

## 3. Komponen Utama

| Komponen | Deskripsi | Varian |
|---|---|---|
| `StatusCard` | Card besar di top dashboard, badge warna sesuai status + label teks ("Belum Lapor" / "Sudah Lapor" / "Tidak Diketahui") | pending / done / unknown |
| `LastCheckedInfo` | Teks kecil "Terakhir dicek 5 menit lalu" | — |
| `ConnectAccountForm` | Form input cookie sesi + instruksi cara mengambilnya, indikator status koneksi | connected / disconnected / expired |
| `ReminderSettingsForm` | Slider/stepper jumlah maksimum reminder, dropdown interval, daftar waktu yang dapat ditambah/hapus, toggle aktif/nonaktif | — |
| `HistoryTimeline` | List riwayat status per hari (tanggal, badge status, jumlah reminder terkirim) | — |
| `NotificationLogItem` | Baris log notifikasi: waktu kirim, status saat dikirim | — |
| `SessionExpiredBanner` | Banner peringatan di atas dashboard saat sesi MagangHub perlu dihubungkan ulang | — |
| `BottomNav` | Navigasi utama mobile (Dashboard, Riwayat, Setting) | 3 item |
| `Toast` | Notifikasi sukses/gagal aksi (simpan setting, hubungkan akun) | success/error/info |
| `PermissionPrompt` | Kartu ajakan mengaktifkan izin notifikasi browser saat pertama kali pakai | — |

## 4. Struktur Navigasi (Mobile-first)

**Bottom Navigation (3 slot):**
1. 🏠 Dashboard (status hari ini)
2. 🕒 Riwayat (histori status & notifikasi)
3. ⚙️ Setting (reminder & akun)

## 5. Alur Pengguna Utama (User Flow)

### 5.1 Flow: Onboarding & Hubungkan Akun
```
Buka app pertama kali → Login (Supabase Auth: email/Google)
  → Layar "Hubungkan Akun MagangHub" + panduan cara ambil cookie sesi (step-by-step dengan screenshot)
    → Paste cookie → Simpan → Sistem verifikasi (fetch test)
      → Sukses: tampil StatusCard sesuai status asli
      → Gagal: tampil pesan error + link bantuan ulangi
  → Prompt izinkan notifikasi push
```

### 5.2 Flow: Cek Dashboard Harian
```
Buka app → Dashboard
  → StatusCard (biru/hijau/abu) + LastCheckedInfo
  → Tombol "Buka MagangHub" (shortcut langsung isi laporan)
```

### 5.3 Flow: Atur Reminder
```
Setting → Reminder
  → Atur: jumlah maksimum per hari (mis. 1–10x)
  → Atur: interval antar reminder (15/30 menit, 1/1,5/2/3/4 jam)
  → Tambahkan satu atau beberapa waktu reminder (format HH:MM; cron memeriksa setiap menit), atau hapus waktu yang tidak lagi diperlukan
  → Simpan → Toast sukses
```

### 5.4 Flow: Sesi Kedaluwarsa
```
Edge Function deteksi sesi expired
  → Push notification: "Sesi MagangHub kamu perlu dihubungkan ulang"
  → Buka app → SessionExpiredBanner tampil di atas Dashboard
    → Tap banner → ke halaman ConnectAccountForm untuk update cookie baru
```

## 6. Layout Dashboard (Wireframe Deskriptif — Mobile)
```
┌─────────────────────────────┐
│ Header: HubReminder           │
├─────────────────────────────┤
│ [Banner sesi expired] (jika ada)│
├─────────────────────────────┤
│  ┌───────────────────────┐   │
│  │   STATUS BESAR         │   │
│  │  🔵 Belum Lapor Hari Ini│   │
│  │  Terakhir dicek 5m lalu│   │
│  └───────────────────────┘   │
├─────────────────────────────┤
│  Tombol: Buka MagangHub →     │
├─────────────────────────────┤
│  Ringkasan reminder hari ini: │
│  2 dari maks 5 terkirim       │
├─────────────────────────────┤
│  BottomNav                    │
└─────────────────────────────┘
```

## 7. Aksesibilitas & Responsif
- Status tidak hanya dibedakan lewat warna, tapi juga ikon + label teks (mendukung colorblind).
- Target tap minimal 44x44px.
- Breakpoint mobile-first: `<640px` default → `md:` tampilan 2 kolom (dashboard kiri, riwayat/log kanan) untuk desktop.
