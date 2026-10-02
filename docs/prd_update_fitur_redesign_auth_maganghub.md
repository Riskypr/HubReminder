# Product Requirement Document (PRD)

## 1. Overview
Dokumen ini menetapkan spesifikasi kebutuhan produk untuk pembaruan **HubReminder**. Pembaruan difokuskan pada perombakan total antarmuka (Redesign UI) dengan prinsip **Mobile-First**, peningkatan estetika UI visual agar lebih interaktif dan "hidup", integrasi *icon library* standar React, penggunaan **React Toastify** untuk notifikasi, standarisasi format tanggal magang Indonesia (`d MMMM yyyy`), serta penggantian mekanisme penarikan data dari *cookie-based* manual menjadi **Credential-based Login Maganghub** demi menjaga persistensi data.

---

## 2. Goals & Objectives
1. **Mobile-First & Interactive UI Redesign**:
   * Merancang ulang seluruh halaman (Halaman Login, Dashboard, & Detail/Management) dengan pendekatan *Mobile-First Design*.
   * Menghadirkan tampilan UI yang lebih hidup, modern, responsif, dan dinamis menggunakan animasi micro-interactions, gradient palette, serta feedback visual yang jelas.
2. **Standardized Icons & Notifications**:
   * Mengganti seluruh ikon manual/SVG dengan paket ikon resmi React (`lucide-react` / `react-icons`).
   * Mengintegrasikan **React Toastify** sebagai pemroses notifikasi alert yang responsif.
3. **Indonesian Date Formatting Standard**:
   * Mengubah tampilan durasi magang menjadi format resmi berbahasa Indonesia: `[Tanggal] [Nama Bulan] [Tahun]` (Contoh: `10 Agustus 2026 - 2 Februari 2027`).
4. **Persistent Maganghub Authentication**:
   * Mengganti input cookie manual yang mudah *expired* dengan fitur **Login Akun Maganghub** otomatis untuk penarikan data profil/magang secara aman dan persistent.
5. **Agent Progress Tracking**:
   * Menggunakan `changelog_progress_tracker.md` sebagai *single source of truth* untuk memantau kemajuan pengembangan.

---

## 3. UI/UX Specifications

### 3.1 Principles & Layout Strategy
* **Approach**: Mobile-First (Desain dioptimalkan untuk layar ponsel $\le 430\text{px}$ terlebih dahulu, kemudian beradaptasi secara responsif ke tablet dan desktop).
* **Visual Elements**:
  * **Color Palette**: Kombinasi warna cerah dengan sentuhan gradient lembut (misal: Indigo-Violet atau Ocean Blue) untuk memberikan kesan modern dan hidup.
  * **Interactive Components**: Hover/Tap efek halus pada tombol, card interaktif, serta loading skeleton untuk feedback visual saat *fetching* data.
* **Component Libraries**:
  * **Icons**: `lucide-react` (atau `react-icons`) untuk konsistensi seluruh UI (misal: icon email, password, calendar, check, alert, logout).
  * **Notifications**: `react-toastify` untuk alert feedback (Success, Error, Info, Warning).

### 3.2 Date Display Rules
* **Format**: `d MMMM yyyy` (Indonesian Locale `id-ID`).
* **Example Output**: `10 Agustus 2026 - 2 Februari 2027`
* **Coverage**: Diterapkan pada seluruh widget/tabel yang menampilkan rentang tanggal pelaksanaan magang.

---

## 4. Technical Specifications & Maganghub Integration

### 4.1 Maganghub Auth Flow (Credential-Based)

```
[ User Input Email & Password Maganghub di UI Login ]
                          │
                          ▼
[ API Proxy Next.js (/api/maganghub/login) ]
                          │
                          ├─► Authenticaton Request ke Server Maganghub
                          ├─► Extract Session / Auth Token
                          ├─► Encrypt & Store Token/Credential di Database
                          │
                          ▼
[ Background Cron Service / Data Fetcher ]
                          │
                          ├─► Fetch Data Profil Maganghub via Stored Session
                          └─► Auto-refresh Session jika expired (tanpa repot copy cookie)
```

1. **User Authentication**:
   * Form login menyediakan opsi otentikasi akun Maganghub.
   * Kredensial diproses secara aman melalui backend proxy untuk mendapatkan token/sesi yang sah.
2. **Persistence**:
   * Sesi disimpan secara terenkripsi di database sehingga aplikasi dapat melakukan sinkronisasi data secara otomatis tanpa meminta user menyalin cookie ulang dari browser DevTools.

---

## 5. Scope & Database Refactoring
* **Cleanup Strategy**:
  * Menghapus tabel/kolom *legacy* yang digunakan untuk menyimpan string cookie manual secara mentah.
  * Menghapus fungsi utility parsing cookie yang sudah tidak terpakai.
* **New Database Entities**:
  * Menambahkan kolom `maganghub_session` / `refresh_token` terenkripsi pada tabel akun/profil.

---
