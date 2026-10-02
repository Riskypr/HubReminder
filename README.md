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
Buka **SQL Editor** pada dashboard Supabase Anda, lalu eksekusi seluruh file di `supabase/migrations/` sesuai urutan nama file. Migration terbaru, `20261002000005_add_notification_channel.sql`, diperlukan agar riwayat reminder WhatsApp tidak dihitung sebagai riwayat notifikasi push.

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

Respons berisi `jobId` untuk pengiriman reminder dan `attendanceJob.jobId` untuk pemeriksaan status. Simpan masing-masing sebagai `CRON_JOB_ORG_JOB_ID` dan `CRON_JOB_ORG_ATTENDANCE_JOB_ID` di environment Vercel, lalu jalankan konfigurasi kembali. Job pemeriksaan status memanggil `/api/cron/attendance` setiap 15 menit; job reminder memanggil `/api/cron/reminder` setiap menit. Keduanya memakai header `X-Cron-Secret`. Endpoint reminder memeriksa waktu reminder, interval, kuota harian, snooze, dan cache status laporan sebelum mengirim ringkasan peserta yang memenuhi syarat ke Foonte. Hasil pengiriman grup dicatat di `reminder_logs`, sedangkan kuota WhatsApp dicatat di `notification_logs` dengan kanal `whatsapp`. Karena cron-job.org berjalan per menit, interval 15 detik tidak dapat dijamin oleh jalur ini.
