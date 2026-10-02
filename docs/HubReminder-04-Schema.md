# Schema.md — Struktur Database (Supabase / Postgres)

## 1. Ringkasan
Database menggunakan Supabase Postgres. Semua tabel diaktifkan **Row Level Security (RLS)** — pengguna hanya bisa membaca/menulis baris miliknya sendiri (`auth.uid() = user_id`). `service_role` (dipakai Edge Function) dapat mengakses lintas-user untuk keperluan job berkala.

## 2. Tabel

### 2.1 `profiles`
Perluasan dari `auth.users` bawaan Supabase.

| Field | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK, FK → `auth.users.id` |
| full_name | text | Nama tampilan |
| timezone | text | Default `'Asia/Makassar'` atau sesuai lokasi user, dipakai untuk hitung "jam aktif" |
| created_at | timestamptz | default `now()` |

### 2.2 `maganghub_sessions`
Menyimpan sesi login MagangHub milik user (terenkripsi).

| Field | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → `profiles.id`, unique (1 user = 1 sesi aktif) |
| encrypted_cookie | text | Nilai cookie sesi, dienkripsi (AES) sebelum disimpan |
| status | text | `'valid'` \| `'expired'` \| `'unverified'` |
| last_verified_at | timestamptz | Kapan terakhir kali sukses fetch dashboard |
| created_at | timestamptz | — |
| updated_at | timestamptz | — |

> **Catatan keamanan:** kolom `encrypted_cookie` **tidak pernah** diakses langsung dari client — hanya diproses lewat Edge Function (`service_role`), dan didekripsi hanya di memori saat proses fetch berjalan.

### 2.3 `attendance_checks`
Log hasil setiap kali sistem mengecek status laporan.

| Field | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → `profiles.id` |
| checked_at | timestamptz | Waktu pengecekan |
| status | text | `'belum_lapor'` \| `'selesai'` \| `'unknown'` \| `'session_expired'` |
| detected_via | text | Info debug singkat, mis. nama class yang cocok (bukan HTML mentah) |

**Index:** `(user_id, checked_at desc)` untuk query dashboard & riwayat cepat.

### 2.4 `reminder_settings`
Pengaturan reminder per user (1 baris per user).

| Field | Tipe | Keterangan |
|---|---|---|
| user_id | uuid | PK, FK → `profiles.id` |
| enabled | boolean | default `true` |
| max_reminders_per_day | int | default `5` |
| interval_seconds | int | default `3600`; valid values `900`, `1800`, `3600`, `5400`, `7200`, `10800`, `14400` |
| reminder_times | time[] | waktu pengiriman pada presisi menit dalam zona waktu pengguna, default `['07:00']`; dapat berisi lebih dari satu waktu |
| interval_minutes | int | kolom kompatibilitas lama; nilai baru diturunkan dari `interval_seconds` |
| snooze_until | date | nullable — jika diisi tanggal hari ini, reminder dilewati untuk hari itu |
| updated_at | timestamptz | — |

### 2.5 `push_subscriptions`
Subscription Web Push per device/browser.

| Field | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → `profiles.id` |
| endpoint | text | URL endpoint push service browser |
| p256dh | text | Public key subscription |
| auth | text | Auth secret subscription |
| created_at | timestamptz | — |

> Satu user bisa punya beberapa baris (multi-device).

### 2.6 `notification_logs`
Riwayat notifikasi yang dikirim (untuk hitung kuota harian & interval).

| Field | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → `profiles.id` |
| sent_at | timestamptz | Waktu kirim |
| status_at_send | text | Status attendance saat notifikasi dikirim (`'belum_lapor'` / `'session_expired'`) |
| sequence_today | int | Reminder ke berapa pada hari itu (1, 2, 3, ...) |

**Index:** `(user_id, sent_at desc)`.

## 3. Relasi Antar Tabel
```
profiles (1) ──< maganghub_sessions (1)   -- satu sesi aktif per user
profiles (1) ──< attendance_checks (N)
profiles (1) ──< reminder_settings (1)
profiles (1) ──< push_subscriptions (N)   -- multi-device
profiles (1) ──< notification_logs (N)
```

## 4. Contoh RLS Policy (ringkas)
```sql
alter table attendance_checks enable row level security;

create policy "user can read own checks"
  on attendance_checks for select
  using (auth.uid() = user_id);

-- Insert hanya dilakukan oleh Edge Function via service_role,
-- sehingga tidak perlu policy insert untuk role 'authenticated'.
```

Pola yang sama diterapkan ke seluruh tabel: `select`/`update` untuk pemilik baris (`authenticated`), sedangkan `insert` dari job berkala dilakukan lewat `service_role` yang otomatis melewati RLS.

## 5. Audit Reminder Grup Foonte
Migration `20261001000003_add_reminder_logs.sql` menambahkan tabel `reminder_logs` untuk audit pengiriman ringkasan grup WhatsApp. Kolomnya adalah `sent_at`, `status` (`sent`/`failed`), `recipient`, `member_count`, `provider_status`, dan `provider_response`. RLS aktif tanpa policy publik; hanya webhook server dengan `service_role` yang menulisnya.

## 6. Perhitungan Kuota Reminder (Logika, bukan tabel baru)
Saat Edge Function berjalan, untuk menentukan apakah boleh kirim reminder baru:
```sql
select count(*) as sent_today, max(sent_at) as last_sent
from notification_logs
where user_id = :user_id
  and sent_at::date = current_date at time zone :user_timezone;
```
Dibandingkan dengan `reminder_settings.max_reminders_per_day`, `interval_seconds`, dan salah satu nilai `reminder_times` dalam zona waktu pengguna untuk memutuskan kirim atau tidak (detail alur di `Architecture.md` §4.2).
