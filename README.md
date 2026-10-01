# HubReminder — Pengingat Absensi MagangHub Kemnaker

Aplikasi web mobile-first (PWA) berbasis Next.js dan Supabase untuk memantau status pengisian laporan harian di dashboard MagangHub Kemnaker (`monev.maganghub.kemnaker.go.id/dashboard`) dan mengirimkan Web Push Notification secara otomatis.

---

## 🚀 Fitur Utama

- 🔵 **Status Realtime**: Menampilkan status pengisian laporan hari ini (Belum Lapor / Selesai / Sesi Habis) secara jelas.
- 🔔 **Pengingat Push Notification (PWA)**: Notifikasi dikirimkan ke perangkat meski browser atau aplikasi tertutup (Web Push API + Service Worker).
- ⚙️ **Pengaturan Fleksibel**:
  - Jumlah maksimum pengingat per hari (1–10x).
  - Interval antar pengingat (15, 30, 60, 90, 120 menit).
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
```

> **Tip Generate VAPID Key**: Jalankan `npx web-push generate-vapid-keys` untuk menghasilkan pasangan kunci VAPID.

### 2. Jalankan Database Migrations di Supabase
Buka **SQL Editor** pada dashboard Supabase Anda, lalu eksekusi isi dari:
1. `supabase/migrations/20261001000000_initial_schema.sql` (Membuat tabel, fungsi trigger, dan Row Level Security).
2. `supabase/migrations/20261001000001_cron_schedule.sql` (Konfigurasi jadwal pg_cron untuk menjalankan edge function berkala).

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
