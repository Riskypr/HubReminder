# Architecture.md — HubReminder (Reminder Absensi MagangHub)

## 1. Tech Stack

| Layer | Teknologi | Alasan |
|---|---|---|
| Framework | Next.js 14+ (App Router, TypeScript) | Frontend + API routes ringan, mendukung PWA |
| Styling | Tailwind CSS | Utility-first, mobile-first |
| Backend/DB | **Supabase** (Postgres, Auth, Edge Functions, Storage) | Sesuai preferensi user; sudah termasuk Auth & scheduler |
| Scheduler | Supabase **pg_cron** + Edge Function | Menjalankan job pengecekan status berkala |
| HTML Parsing | Cheerio (dijalankan di Edge Function/Node runtime) | Parsing elemen tombol laporan dari HTML dashboard MagangHub |
| Push Notification | Web Push API + `web-push` (VAPID keys) | Standar notifikasi PWA lintas browser |
| State Management | Zustand | State ringan untuk UI (status, setting form) |
| Form & Validasi | React Hook Form + Zod | Validasi form setting reminder & input sesi akun |
| PWA | `next-pwa` (Workbox) + manifest.json + custom service worker (push handler) | Installable + terima push saat app tertutup |
| Date/Time | date-fns + date-fns-tz | Perhitungan jeda reminder & jam aktif (timezone WIB) |

> **Catatan arsitektur penting:** Karena butuh proses berjalan otomatis di background (bukan saat user membuka app), sebagian besar logika inti (cek status, kirim notifikasi) **wajib berjalan di server (Supabase Edge Function terjadwal)**, bukan di client. Frontend Next.js berfungsi sebagai dashboard, halaman setting, dan penerima push notification.

## 2. Metode Pengambilan Data dari MagangHub

Karena dashboard MagangHub berada di balik login, ada dua opsi — MVP memilih **Opsi A**:

- **Opsi A (MVP): Sesi/cookie manual.** Pengguna login manual satu kali di browser mereka, lalu menyalin nilai cookie sesi ke form "Hubungkan Akun" di HubReminder. Server menggunakan cookie ini untuk mengambil (fetch) halaman dashboard secara berkala atas nama pengguna. Lebih aman karena aplikasi **tidak pernah menyimpan username/password**.
- **Opsi B (Future, tidak untuk MVP):** Otomasi login penuh (submit form username/password oleh sistem). Ditunda karena risiko keamanan lebih tinggi (perlu menyimpan kredensial asli) dan lebih rentan terhadap perubahan mekanisme login/captcha di situs.

Sesi memiliki masa berlaku terbatas; sistem mendeteksi bila fetch dashboard mengembalikan halaman login (bukan dashboard) → status ditandai `session_expired` → notifikasi khusus dikirim ke pengguna untuk menghubungkan ulang.

## 3. Struktur Folder

```
├── app/
│   ├── (dashboard)/
│   │   ├── page.tsx                     # Dashboard status hari ini
│   │   ├── history/page.tsx             # Riwayat status & notifikasi
│   │   ├── settings/
│   │   │   ├── reminder/page.tsx        # Setting jumlah & interval reminder
│   │   │   └── account/page.tsx         # Hubungkan/putuskan akun MagangHub
│   ├── api/
│   │   ├── push/subscribe/route.ts      # Simpan push subscription browser
│   │   └── account/connect/route.ts     # Simpan sesi (cookie) terenkripsi
│   ├── layout.tsx
│   ├── manifest.ts
│   └── sw-push.ts                        # Custom service worker push handler
├── components/
│   ├── ui/                               # Button, Card, Input, Modal, Badge, dsb
│   ├── dashboard/
│   │   ├── StatusCard.tsx                # Badge biru/hijau/unknown
│   │   └── LastCheckedInfo.tsx
│   ├── settings/
│   │   ├── ReminderSettingsForm.tsx
│   │   └── ConnectAccountForm.tsx
│   ├── history/
│   │   └── HistoryTimeline.tsx
│   └── layout/
│       ├── BottomNav.tsx
│       └── Header.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts                     # Supabase client (browser)
│   │   └── server.ts                     # Supabase client (server/edge)
│   ├── services/
│   │   ├── accountService.ts             # CRUD sesi akun (enkripsi/dekripsi)
│   │   ├── reminderSettingsService.ts
│   │   ├── pushService.ts                # Subscribe/unsubscribe push
│   │   └── historyService.ts
│   └── utils/
│       ├── crypto.ts                     # Enkripsi/dekripsi cookie sesi
│       └── time.ts
├── supabase/
│   ├── functions/
│   │   └── check-attendance/
│   │       └── index.ts                  # Edge Function: fetch + parse + notify
│   └── migrations/                       # SQL migration (lihat Schema.md)
├── public/
│   └── icons/
├── tailwind.config.ts
└── next.config.js
```

## 4. Flow Data Antar Service

### 4.1 Flow: Hubungkan Akun
```
[ConnectAccountForm] → POST /api/account/connect
   → accountService.saveSession(userId, cookieValue)
       → crypto.encrypt(cookieValue) → simpan ke tabel maganghub_sessions
   → Edge Function langsung trigger 1x verifikasi (fetch dashboard test)
       → jika berhasil parse tombol → status "connected"
       → jika dapat halaman login → status "invalid_session" (minta ulang)
```

### 4.2 Flow: Pengecekan Berkala (Inti Sistem)
```
[pg_cron] ── setiap N menit ──▶ [Edge Function: check-attendance]
   1. Ambil semua user dengan sesi aktif (maganghub_sessions.status = 'valid')
   2. Untuk tiap user:
      a. Dekripsi cookie sesi
      b. Fetch HTML dashboard MagangHub dengan cookie tsb
      c. Jika response = halaman login → tandai sesi 'expired', kirim 1x notifikasi "sesi habis"
      d. Jika response = dashboard → parse elemen tombol laporan:
         - class mengandung indikator biru → status = 'belum_lapor'
         - class/indikator hijau → status = 'selesai'
      e. Simpan hasil ke tabel attendance_checks
      f. Jika status = 'belum_lapor':
         - Baca reminder_settings user (max_per_hari, interval_menit, jam_aktif)
         - Cek notification_logs hari ini: sudah berapa kali kirim & kapan terakhir
         - Jika (jumlah terkirim < max) DAN (waktu sekarang - terakhir kirim ≥ interval) DAN (dalam jam aktif):
             → kirim Web Push via pushService
             → catat ke notification_logs
      g. Jika status = 'selesai' → tidak ada reminder baru dikirim untuk hari itu
```

### 4.3 Flow: Terima Push Notification (Client)
```
Service Worker (sw-push.ts) menerima event 'push'
   → tampilkan notifikasi native (judul, body, ikon)
   → jika user tap notifikasi → buka halaman dashboard HubReminder (atau langsung link ke MagangHub)
```

### 4.4 Flow: Ubah Setting Reminder
```
[ReminderSettingsForm] → reminderSettingsService.update(userId, settings)
   → simpan ke tabel reminder_settings (upsert)
   → Edge Function otomatis membaca setting terbaru di eksekusi berikutnya (tanpa perlu restart job)
```

## 5. Keamanan Data Sesi (Ringkasan — detail di `Rules.md`)
- Cookie sesi dienkripsi sebelum disimpan (mis. via Supabase Vault/pgsodium atau `crypto.ts` dengan key server-only).
- Row Level Security (RLS) aktif di semua tabel — user hanya bisa akses baris miliknya sendiri.
- Tidak ada logging nilai cookie mentah di log server manapun.

## 6. PWA & Push Notification Setup
- `manifest.ts`: nama app, ikon, `display: standalone`, `theme_color`.
- Service worker mendaftarkan `pushManager.subscribe()` dengan VAPID public key saat user mengizinkan notifikasi.
- Endpoint `POST /api/push/subscribe` menyimpan `endpoint`, `keys.p256dh`, `keys.auth` ke tabel `push_subscriptions`.
- Edge Function memakai VAPID private key (disimpan sebagai secret Supabase) untuk mengirim push lewat `web-push`.
