# HubReminder — Reminder & Auto-Laporan MagangHub Kemnaker

Aplikasi web **mobile-first PWA** berbasis **Next.js** dan **Supabase** untuk peserta magang Kemnaker. HubReminder memantau status pengisian laporan harian di MagangHub (`monev.maganghub.kemnaker.go.id/dashboard`), mengirim pengingat otomatis via **Web Push Notification** dan **WhatsApp grup**, serta menyediakan **Bot WhatsApp** yang dapat men-generate dan men-submit laporan harian secara otomatis menggunakan **Gemini AI**.

---

## 📋 Daftar Isi

- [Fitur Utama](#-fitur-utama)
- [Arsitektur Sistem](#-arsitektur-sistem)
- [Tech Stack](#️-tech-stack)
- [Skema Database](#-skema-database)
- [API Routes](#-api-routes)
- [Alur Bot WhatsApp](#-alur-bot-whatsapp)
- [Pengaturan Admin](#️-pengaturan-admin)
- [Setup & Instalasi Lokal](#-setup--instalasi-lokal)
- [Environment Variables](#-environment-variables)
- [Deployment ke Vercel](#-deployment-ke-vercel)
- [Menjalankan Unit Test](#-menjalankan-unit-test)

---

## 🚀 Fitur Utama

### Untuk Peserta Magang (User)
| Fitur | Deskripsi |
|---|---|
| **Status Laporan Realtime** | Menampilkan status laporan hari ini: `Belum Lapor`, `Selesai`, atau `Sesi Habis` |
| **Web Push Notification** | Pengingat dikirim ke perangkat meski browser/aplikasi tertutup (Web Push API + Service Worker) |
| **Pengaturan Notifikasi Personal** | Atur maks. pengingat/hari (1–10), interval (15 mnt – 4 jam), jam aktif, dan fitur snooze |
| **Riwayat & Log** | Histori status harian dan riwayat notifikasi yang telah terkirim |
| **Bot WA Auto-Laporan** | Cukup balas pesan reminder di WA dengan ringkasan kegiatan, AI langsung generate & submit laporan ke MagangHub |
| **Keamanan Sesi** | Sesi login MagangHub dienkripsi AES-GCM server-side; password tidak pernah disimpan |

### Untuk Admin
| Fitur | Deskripsi |
|---|---|
| **Reminder Grup WA** | Kirim otomatis status laporan semua peserta ke grup WhatsApp via Fonnte |
| **Mode Single / Bulk** | Single: satu pesan per peserta; Bulk: satu pesan berisi daftar semua peserta yang belum lapor |
| **Mode Auto-Laporan AI** | Reminder aktif mengajak peserta balas dengan kegiatan; bot generate & submit laporan otomatis |
| **Warning Cookie Kedaluwarsa** | Deteksi token JWT yang hampir habis atau sesi expired, kirim notifikasi ke grup |
| **Kontrol Terpusat** | Aktifkan/nonaktifkan reminder, bot WA, dan reminder akhir pekan dari halaman admin |
| **Batas Kuota Harian** | Konfigurasi maks. total pesan reminder per hari untuk menjaga kuota Fonnte |

---

## 🏗️ Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────┐
│                    Browser / PWA                        │
│  Next.js App Router (SSR + Client Components)           │
│  Service Worker — Web Push API                          │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────────┐
│              Next.js API Routes (Server)                │
│                                                         │
│  /api/webhook/fonnte       <- Fonnte Webhook (WA in)    │
│  /api/cron/reminder        <- Trigger reminder WA       │
│  /api/cron/attendance      <- Cek status laporan        │
│  /api/cron/reminder/configure  <- Setup cron-job.org   │
│  /api/maganghub/login      <- SSO proxy MagangHub       │
│  /api/push/*               <- Web Push subscribe        │
│  /api/settings/*           <- User & system settings   │
└──────┬───────────────────────┬──────────────────────────┘
       │                       │
┌──────▼──────┐        ┌───────▼──────────────────────────┐
│  Supabase   │        │   External Services               │
│  Postgres   │        │                                   │
│  Auth (RLS) │        │  MagangHub API (monev-api.*)      │
│  Edge Func  │        │  Gemini AI API (auto-laporan)     │
└─────────────┘        │  Fonnte API (WhatsApp gateway)    │
                       │  cron-job.org (scheduler)         │
                       └───────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|---|---|
| **Framework** | Next.js 16 (App Router, TypeScript) |
| **UI** | Tailwind CSS, Lucide React |
| **State** | Zustand |
| **Form** | React Hook Form + Zod |
| **Database** | Supabase (PostgreSQL dengan RLS) |
| **Auth** | Supabase Auth |
| **Parsing HTML** | Cheerio (server-side) |
| **Push Notification** | Web Push API + VAPID (`web-push`) |
| **WhatsApp Gateway** | Fonnte (`api.fonnte.com`) |
| **AI Generate Laporan** | Google Gemini AI (`gemini-2.0-flash` default) |
| **Scheduler** | cron-job.org + Supabase pg_cron |
| **Enkripsi** | AES-GCM (server-side, `SESSION_ENCRYPTION_KEY`) |
| **Date/Time** | date-fns, date-fns-tz |
| **Testing** | Vitest |
| **Deployment** | Vercel (fungsi login di region `sin1`) |

---

## 🗄️ Skema Database

Database dikelola via file migrasi di `supabase/migrations/`. Jalankan sesuai urutan nama file.

### Tabel Utama

| Tabel | Deskripsi |
|---|---|
| `profiles` | Profil user (nama, timezone, perusahaan, posisi) |
| `maganghub_sessions` | Sesi login MagangHub terenkripsi (AES-GCM) + refresh token |
| `attendance_checks` | Riwayat cek status laporan harian per user |
| `reminder_settings` | Pengaturan push notification personal per user |
| `push_subscriptions` | Endpoint Web Push per perangkat |
| `notification_logs` | Log notifikasi push yang telah dikirim |
| `system_reminder_settings` | Pengaturan reminder grup & bot WA (admin global) |
| `wa_phone_mappings` | Mapping nomor WA ke `user_id` (untuk bot WA) |
| `wa_report_sessions` | Sesi percakapan WA per user per hari (status AI generate & submit) |

### Status `wa_report_sessions`

```
waiting_input → generating → waiting_approval → submitting → submitted
                    ↓                                ↓
                  failed                           failed (kembali ke waiting_approval)
```

### Daftar Migrations

| File | Perubahan |
|---|---|
| `20261001000000_initial_schema.sql` | Schema awal: profiles, sessions, attendance, reminder, push, notif logs |
| `20261001000001_cron_schedule.sql` | pg_cron schedule untuk cek attendance |
| `20261001000002_add_profile_maganghub_fields.sql` | Tambah `company_name` di profiles |
| `20261001000003_add_reminder_logs.sql` | Tabel reminder logs |
| `20261001000004_add_reminder_times.sql` | Kolom `active_start_time`, `active_end_time` |
| `20261002000005_add_notification_channel.sql` | Kolom notification channel |
| `20261002000006_default_timezone_jakarta.sql` | Default timezone Asia/Jakarta |
| `20261002000007_cron_reminder_precision_and_intervals.sql` | Presisi interval cron |
| `20261002000008_maganghub_credential_sessions.sql` | Kolom refresh token & enkripsi |
| `20261004000009_add_profile_position.sql` | Tambah `position` di profiles |
| `20261006000001_flexible_reminder_settings.sql` | Pengaturan reminder admin, nomor WA personal, warning cookie |
| `20261006000002_wa_report_sessions.sql` | Tabel `wa_phone_mappings` dan `wa_report_sessions` |
| `20261007000001_admin_daily_reminder_limit.sql` | Kolom `max_reminders_per_day` |
| `20261009000001_admin_reminder_and_bot_controls.sql` | Kolom `reminder_together_enabled`, `wa_bot_enabled` |
| `20261011000001_add_weekend_reminder_enabled.sql` | Kolom `weekend_reminder_enabled` |
| `20261012000001_add_waiting_approval_status.sql` | Status `waiting_approval` di `wa_report_sessions` |
| `20261013000001_fix_reminder_settings_dedup.sql` | Deduplikasi baris `system_reminder_settings` |

---

## 🌐 API Routes

### Webhook
| Method | Path | Deskripsi |
|---|---|---|
| `POST` | `/api/webhook/fonnte` | Menerima pesan masuk dari Fonnte (bot WA) |
| `GET` | `/api/webhook/fonnte` | Health check webhook |

### Cron Jobs
| Method | Path | Deskripsi |
|---|---|---|
| `POST` | `/api/cron/reminder` | Trigger pengiriman reminder ke grup WA (dipanggil cron-job.org, setiap menit) |
| `POST` | `/api/cron/attendance` | Cek & update status laporan semua user (setiap 15 menit) |
| `POST` | `/api/cron/reminder/configure` | Buat/update job di cron-job.org dan kembalikan `jobId` |

### MagangHub
| Method | Path | Deskripsi |
|---|---|---|
| `POST` | `/api/maganghub/login` | Proxy SSO login ke MagangHub, enkripsi & simpan token (region `sin1`) |

### Push Notification
| Method | Path | Deskripsi |
|---|---|---|
| `POST` | `/api/push/subscribe` | Daftarkan push subscription perangkat |
| `DELETE` | `/api/push/subscribe` | Hapus push subscription |
| `POST` | `/api/push/send` | Kirim push notification manual |

### Settings
| Method | Path | Deskripsi |
|---|---|---|
| `GET/POST` | `/api/settings/reminder` | Baca/simpan pengaturan reminder personal |
| `GET/POST` | `/api/settings/system` | Baca/simpan pengaturan global admin |

---

## 🤖 Alur Bot WhatsApp

Bot hanya aktif jika `wa_bot_enabled = true` di pengaturan admin.

### Registrasi Pertama (Link Nomor WA)

```
User balas: "link Budi Santoso"
    ↓
Bot cocokkan nama di tabel profiles (fuzzy match)
    ↓
Simpan mapping phone → user_id di wa_phone_mappings
    ↓
Bot balas: "✅ Nomor WA berhasil dihubungkan ke akun Budi Santoso"
```

### Alur Auto-Laporan (Pesan Pribadi / DM)

```
1. User kirim kegiatan: "hari ini belajar React, bikin komponen dashboard"
2. Bot simpan sesi status: generating
3. Bot panggil Gemini AI → generate 3 bagian laporan (activity, lesson, challenge)
4. Bot kirim preview draf ke WA user dengan pilihan:
   ✅ KIRIM / YA   → Submit ke MagangHub
   🔄 ULANG        → Generate ulang draf AI
   ✏️ EDIT [teks]  → Revisi input kegiatan & generate ulang
   ❌ BATAL        → Batalkan draf
5. User balas "KIRIM" → bot submit ke MagangHub API → kirim konfirmasi sukses
```

### Perilaku di Grup WA

Di grup, bot **hanya merespons command yang dikenali**. Obrolan bebas/random diabaikan diam-diam untuk menghindari spam.

| Pesan di Grup | Respons Bot |
|---|---|
| `link [nama]` | Proses registrasi nomor WA |
| `status` | Cek status laporan hari ini |
| `kirim` / `ya` / `oke` / `setuju` / `acc` / `deal` | Submit draf yang sedang menunggu |
| `ulang` / `regen` / `refresh` | Generate ulang draf laporan |
| `edit [teks baru]` / `revisi [teks baru]` | Revisi input & generate ulang |
| `batal` / `cancel` / `batalkan` | Batalkan draf |
| Pesan bebas / obrolan | Diabaikan diam-diam (tidak direspons) |

> **Catatan:** Di DM (bukan grup), semua pesan yang bukan command diperlakukan sebagai input kegiatan baru dan langsung memulai alur generate laporan.

---

## ⚙️ Pengaturan Admin

Halaman `/admin` hanya dapat diakses oleh email yang terdaftar di `REMINDER_ADMIN_EMAILS`.

### Pengaturan Sistem (`system_reminder_settings`)

| Pengaturan | Default | Deskripsi |
|---|---|---|
| `reminder_mode` | `bulk` | `single`: 1 pesan per peserta; `bulk`: 1 pesan daftar semua |
| `start_time` | `08:00` | Jam mulai pengiriman reminder WA (WIB) |
| `interval_seconds` | `7200` | Jeda antar pengiriman reminder (detik) |
| `cookie_warning_count` | `3` | Jumlah warning cookie expired yang dikirim per siklus |
| `cookie_warning_interval_minutes` | `60` | Interval antar warning cookie (menit) |
| `max_reminders_per_day` | `10` | Batas total pesan reminder ke grup per hari |
| `reminder_together_enabled` | `true` | Aktifkan/nonaktifkan pengiriman reminder grup |
| `wa_bot_enabled` | `true` | Aktifkan/nonaktifkan bot WA (termasuk auto-laporan AI) |
| `weekend_reminder_enabled` | `false` | Aktifkan reminder di Sabtu & Minggu |

### Mode Pengiriman Reminder

- **Single** — Cek status setiap peserta satu per satu, kirim pesan terpisah ke target Fonnte per peserta yang belum lapor.
- **Bulk** — Kumpulkan semua yang belum lapor, kirim satu pesan daftar ke grup.
- **Auto-Laporan** — Sama seperti Bulk, tapi pesan juga mengajak peserta membalas dengan kegiatan agar bot bisa generate & submit laporan otomatis via AI.

---

## 📦 Setup & Instalasi Lokal

### Prasyarat

- Node.js ≥ 18
- Akun [Supabase](https://supabase.com)
- Akun [Fonnte](https://fonnte.com) (WhatsApp gateway)
- Akun [cron-job.org](https://cron-job.org) (scheduler)
- Google Gemini API Key (untuk fitur auto-laporan)

### 1. Clone & Install Dependencies

```bash
git clone <repo-url>
cd HubReminder
npm install
```

### 2. Salin Environment Variables

```bash
cp .env.example .env.local
```

Isi semua variabel yang dibutuhkan (lihat bagian [Environment Variables](#-environment-variables) di bawah).

### 3. Jalankan Migrasi Database di Supabase

Buka **SQL Editor** di dashboard Supabase, lalu eksekusi semua file di `supabase/migrations/` **sesuai urutan nama file** (dari terlama ke terbaru).

### 4. Deploy Supabase Edge Function

```bash
supabase functions deploy check-attendance --no-verify-jwt
```

Set secrets untuk Edge Function:

```bash
supabase secrets set \
  SESSION_ENCRYPTION_KEY=... \
  NEXT_PUBLIC_VAPID_PUBLIC_KEY=... \
  VAPID_PRIVATE_KEY=...
```

### 5. Jalankan Aplikasi di Lokal

```bash
npm run dev
```

Buka `http://localhost:3000`.

### 6. Konfigurasi Cron Jobs (cron-job.org)

Setelah deploy ke Vercel, jalankan endpoint konfigurasi **satu kali** untuk membuat job di cron-job.org:

```bash
curl -X POST https://<domain>/api/cron/reminder/configure \
  -H "X-Cron-Secret: <nilai-CRON_SECRET_KEY>"
```

Respons berisi dua `jobId`:
- **`jobId`** → job pengiriman reminder (setiap menit) → simpan sebagai `CRON_JOB_ORG_JOB_ID`
- **`attendanceJob.jobId`** → job cek status (setiap 15 menit) → simpan sebagai `CRON_JOB_ORG_ATTENDANCE_JOB_ID`

Tambahkan kedua ID tersebut ke environment Vercel, lalu jalankan configure sekali lagi agar job ter-update dengan ID yang benar.

### 7. Konfigurasi Webhook Fonnte

Di dashboard Fonnte, set Webhook URL ke:

```
https://<domain>/api/webhook/fonnte
```

Webhook ini menerima semua pesan masuk dari WhatsApp (baik DM maupun grup).

---

## 🔑 Environment Variables

Salin `.env.example` ke `.env.local`. Semua variabel wajib diisi kecuali yang ditandai *(optional)*.

```env
# ─── Supabase ─────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# ─── Enkripsi Sesi MagangHub (server-only) ────────────────────────────────────
# Kunci 32 karakter acak. Generate: openssl rand -hex 16
SESSION_ENCRYPTION_KEY=your-32-character-encryption-key

# ─── MagangHub SSO (optional) ─────────────────────────────────────────────────
# Default: /auth/login — ubah hanya jika endpoint SSO berubah
MAGANGHUB_LOGIN_PATH=/auth/login

# ─── VAPID Keys (Web Push Notification) ───────────────────────────────────────
# Generate: npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:admin@yourdomain.com

# ─── Fonnte (WhatsApp Gateway) ────────────────────────────────────────────────
FOONTE_API_TOKEN=your-fonnte-token
# ID grup WA target. Format: 120363012345678901@g.us
# JANGAN gunakan link undangan (https://chat.whatsapp.com/...)
FOONTE_WA_GROUP_ID=your-group-id@g.us
# (Optional) Multiple targets, pisahkan koma. Fallback ke FOONTE_WA_GROUP_ID
# FOONTE_WA_TARGETS=6281234567890,120363012345678901@g.us

# ─── Admin ────────────────────────────────────────────────────────────────────
# Email yang boleh mengakses /admin dan mengubah pengaturan global
REMINDER_ADMIN_EMAILS=admin@yourdomain.com

# ─── cron-job.org (Scheduler) ─────────────────────────────────────────────────
CRON_SECRET_KEY=replace-with-a-long-random-secret
CRON_JOB_ORG_API_KEY=your-cron-job-org-api-key
# Isi setelah menjalankan /api/cron/reminder/configure
# CRON_JOB_ORG_JOB_ID=12345678
# CRON_JOB_ORG_ATTENDANCE_JOB_ID=12345679

# ─── App URL ──────────────────────────────────────────────────────────────────
APP_URL=https://your-domain.com
CRON_REMINDER_TIMEZONE=Asia/Jakarta

# ─── Gemini AI (Auto-Laporan) ─────────────────────────────────────────────────
GEMINI_API_KEY=your-gemini-api-key
# (Optional) Model Gemini, default: gemini-2.0-flash
# GEMINI_MODEL=gemini-2.0-flash
```

---

## 🚢 Deployment ke Vercel

1. Push ke repository Git yang terhubung ke Vercel.
2. Set semua environment variables di **Vercel Dashboard → Settings → Environment Variables**.
3. Deploy. Fungsi login MagangHub otomatis dijalankan di region **Singapore (`sin1`)** sesuai `vercel.json`.
4. Setelah deploy, jalankan konfigurasi cron (langkah 6 di atas).

> **Catatan:** Pastikan `APP_URL` diisi dengan URL produksi yang benar (tanpa trailing slash) agar link dalam notifikasi WA mengarah ke domain yang tepat.

---

## 🧪 Menjalankan Unit Test

```bash
npm test
```

Test file ada di direktori `tests/`:

| File | Deskripsi |
|---|---|
| `fonnteWebhookRoute.test.ts` | Alur lengkap webhook bot WA (link, status, approve, regen, edit, cancel, grup) |
| `fonnteWebhookUtils.test.ts` | Parsing command & format pesan WA |
| `maganghub-service.test.ts` | Proxy service MagangHub (login, cek status, submit) |
| `parser.test.ts` | Parser HTML/JSON respons MagangHub |
| `cronReminderService.test.ts` | Format pesan reminder grup WA |
| `cronJobOrgService.test.ts` | Integrasi cron-job.org API |
| `systemReminderSettings.test.ts` | Pengaturan sistem reminder admin |
| `userReminderSchedule.test.ts` | Jadwal reminder push notification per user |
| `evaluator.test.ts` | Logic evaluasi status & kondisi pengiriman |

---

## 🔒 Keamanan

- **Sesi MagangHub** dienkripsi menggunakan **AES-GCM** sebelum disimpan ke database. Kunci enkripsi hanya ada di server (`SESSION_ENCRYPTION_KEY`).
- **Password tidak pernah disimpan.** Login ke MagangHub dilakukan melalui SSO Kemnaker; yang disimpan hanya `accessToken` dan `refreshToken` hasil SSO (sudah terenkripsi).
- **RLS (Row Level Security)** aktif di semua tabel Supabase — setiap user hanya bisa membaca/mengubah data miliknya sendiri.
- **Admin endpoint** (`/api/cron/*`, `/api/settings/system`, `/admin`) dilindungi oleh `X-Cron-Secret` atau verifikasi email admin.
- **Bot WA di grup** hanya merespons command yang dikenali; pesan bebas/obrolan diabaikan diam-diam untuk menghindari spam dan penyalahgunaan.

---

## 📁 Struktur Direktori

```
HubReminder/
├── app/
│   ├── (dashboard)/          # Halaman utama (dashboard, settings, history, admin)
│   │   ├── page.tsx          # Dashboard utama — status laporan hari ini
│   │   ├── admin/            # Halaman admin pengaturan global
│   │   ├── history/          # Riwayat status & notifikasi
│   │   └── settings/         # Pengaturan akun & reminder user
│   ├── api/
│   │   ├── cron/             # Endpoint cron (reminder, attendance, configure)
│   │   ├── maganghub/        # Proxy login MagangHub
│   │   ├── push/             # Web Push subscribe/send
│   │   ├── settings/         # Settings API
│   │   └── webhook/fonnte/   # Webhook bot WhatsApp
│   ├── login/                # Halaman login Supabase Auth
│   └── globals.css
├── components/               # Komponen React (dashboard, forms, UI)
├── lib/
│   ├── attendance/           # Parser status laporan MagangHub
│   ├── services/             # Business logic (maganghub, gemini, fonnte, cron, push, dll)
│   ├── supabase/             # Supabase client (server, client, admin)
│   ├── types/                # TypeScript types
│   └── utils/                # Utility (crypto, time, dll)
├── supabase/
│   ├── functions/            # Edge Function (check-attendance)
│   └── migrations/           # SQL migration files (17 file)
├── tests/                    # Unit tests (Vitest, 9 file)
├── public/                   # Static assets + PWA icons
├── .env.example              # Template environment variables
├── vercel.json               # Konfigurasi Vercel (region login)
└── next.config.js            # Konfigurasi Next.js + PWA
```

---

## 🚀 Fitur Utama

- 🔵 **Status Realtime**: Menampilkan status pengisian laporan hari ini (Belum Lapor / Selesai / Sesi Habis) secara jelas.
- 🔔 **Pengingat Push Notification (PWA)**: Notifikasi dikirimkan ke perangkat meski browser atau aplikasi tertutup (Web Push API + Service Worker).
- ⚙️ **Pengaturan Fleksibel**:
  - Jumlah maksimum pengingat per hari (1–10x).
  - Interval antar pengingat (15/30 menit, 1/1,5/2/3/4 jam).
  - Rentang jam aktif pengingat (misal 07:00 – 21:00).
  - Fitur tunda (snooze) satu hari.
- 🕒 **Riwayat & Log**: Histori status harian dan riwayat notifikasi yang telah terkirim.
- 🔐 **Keamanan & Privasi**: Sesi login MagangHub dienkripsi menggunakan AES-GCM (server-side only) dan aplikasi tidak pernah meminta/menyimpan password pengguna.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 (App Router, TypeScript), Tailwind CSS, Zustand, React Hook Form, Zod.
- **Backend / DB**: Supabase (Postgres with RLS, Supabase Auth, pg_cron).
- **Automation**: Supabase Edge Functions (`check-attendance`).
- **Parsing**: Cheerio (Server-side HTML parsing).
- **Push Notification**: Web Push API + VAPID.

---

## 📦 Setup & Instalasi Lokal

### 1. Salin Environment Variables
Salin `.env.example` menjadi `.env.local`:
```bash
cp .env.example .env.local
```

Isi variabel berikut di `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR-PROJECT].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
SUPABASE_SERVICE_ROLE_KEY=[YOUR-SERVICE-ROLE-KEY]
SESSION_ENCRYPTION_KEY=[32-KARAKTER-KUNCI-ENKRIPSI]
NEXT_PUBLIC_VAPID_PUBLIC_KEY=[VAPID-PUBLIC-KEY]
VAPID_PRIVATE_KEY=[VAPID-PRIVATE-KEY]
VAPID_SUBJECT=mailto:admin@domain.com
REMINDER_ADMIN_EMAILS=admin@domain.com
```

> **Tip Generate VAPID Key**: Jalankan `npx web-push generate-vapid-keys` untuk menghasilkan pasangan kunci VAPID.

### 2. Jalankan Database Migrations di Supabase
Buka **SQL Editor** pada dashboard Supabase Anda, lalu eksekusi seluruh file di `supabase/migrations/` sesuai urutan nama file. Migration `20261006000001_flexible_reminder_settings.sql` menambahkan pengaturan reminder admin, nomor WhatsApp personal, dan riwayat warning cookie.

### 3. Deploy Supabase Edge Function
Jika menggunakan Supabase CLI:
```bash
supabase functions deploy check-attendance --no-verify-jwt
```
Pastikan secrets telah di-set di Supabase Edge Function:
```bash
supabase secrets set SESSION_ENCRYPTION_KEY=... NEXT_PUBLIC_VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=...
```

### 4. Menjalankan Aplikasi di Lokal
```bash
npm run dev
```
Buka browser pada `http://localhost:3000`.

### 5. Menjalankan Unit Tests
```bash
npm test
```

### 6. Menjadwalkan Reminder Grup WhatsApp
Isi `APP_URL`, `CRON_SECRET_KEY`, dan `CRON_JOB_ORG_API_KEY` pada `.env.local`/platform deployment. API key hanya dipakai di server untuk membuat atau memperbarui job. Setelah deploy, sinkronkan job sekali dengan:

```bash
curl -X POST https://<domain>/api/cron/reminder/configure \
  -H "X-Cron-Secret: <nilai-CRON_SECRET_KEY>"
```

Respons berisi `jobId` untuk pengiriman reminder dan `attendanceJob.jobId` untuk pemeriksaan status. Simpan masing-masing sebagai `CRON_JOB_ORG_JOB_ID` dan `CRON_JOB_ORG_ATTENDANCE_JOB_ID` di environment Vercel, lalu jalankan konfigurasi kembali. Job pemeriksaan status memanggil `/api/cron/attendance` setiap 15 menit; job reminder memanggil `/api/cron/reminder` setiap menit. Keduanya memakai header `X-Cron-Secret`. Isi `REMINDER_ADMIN_EMAILS` dengan email akun yang boleh mengubah pengaturan global di Pengaturan > Pengingat. Admin memilih mode Single atau Bulk, jam mulai WIB, interval, jumlah pengulangan warning cookie, dan jeda warning. Pengiriman selalu memakai target Foonte dari `FOONTE_WA_GROUP_ID`; opsional, `FOONTE_WA_TARGETS` dapat berisi beberapa nomor WhatsApp atau ID grup yang dipisahkan koma. Mode Single mengirim pesan terpisah per peserta ke target Foonte yang sama, sedangkan mode Bulk mengirim daftar dalam satu pesan. Warning mendeteksi token JWT yang memiliki klaim expiry dalam tiga hari dan sesi yang telah ditandai kedaluwarsa.
