# Project Change Log & Agent Progress Tracker

Dokumen ini mencatat seluruh perubahan struktur, skema database, dan penambahan fitur. File ini berfungsi sebagai acuan cepat (*single source of truth*) bagi AI Agent atau developer berikutnya untuk memahami kondisi kode tanpa perlu memindai seluruh direktori repositori.

---

## [Unreleased / Current Work]

## [2026-10-02] - Polling Reminder melalui cron-job.org
- **Added**: Pemeriksaan kelayakan reminder WhatsApp per peserta pada setiap pemanggilan cron.
- **Changed**: Job cron-job.org berjalan setiap menit; endpoint hanya menyertakan peserta dengan status `belum_lapor` yang memenuhi jadwal, interval, kuota harian, dan aturan snooze. Pengiriman yang berhasil juga masuk ke `notification_logs` agar kuota dan interval dipakai bersama jalur reminder lainnya. Dokumentasi setup diperbarui.
- **Deprecated/Removed**: Pengaturan jadwal statis `CRON_REMINDER_HOUR` dan `CRON_REMINDER_MINUTE` tidak lagi digunakan.
- **Notes for Next Agent**: cron-job.org memiliki resolusi satu menit, sehingga interval uji coba 15 detik tidak terjamin. Terapkan migration `20261001000003` dan `20261001000004`; job wajib disinkronkan ulang melalui `/api/cron/reminder/configure` setelah deploy.

## [2026-10-01] - Jadwal Reminder Multi-Waktu
- **Added**: Kolom `interval_seconds` dan `reminder_times` melalui migration `20261001000004`, serta pilihan interval 15 detik untuk uji coba.
- **Changed**: Form tidak lagi memakai rentang mulai–selesai; pengguna dapat menambah, melihat, dan menghapus beberapa waktu reminder hingga presisi detik.
- **Deprecated/Removed**: `active_start_time` dan `active_end_time` tidak lagi digunakan oleh alur penjadwalan baru; kolom lama dipertahankan agar data lama aman.
- **Notes for Next Agent**: Interval 15 detik baru efektif jika pemanggil Edge Function dijalankan setidaknya setiap 15 detik; cron standar per menit tidak cukup rapat.

### 🚀 Fitur Baru
* **Integrasi Cron Job (`cron-job.org`)**:
  * Menambahkan endpoint `/api/cron/reminder` untuk memicu otomatisasi pengiriman pesan.
  * Menambahkan validasi header `X-Cron-Secret` pada endpoint webhook.
* **Integrasi Foonte WA Gateway**:
  * Menambahkan helper/service `FoonteService` untuk mengirimkan payload pesan ke WhatsApp Group ID.
  * Ringkasan memakai status cache dari checker berkala; cookie sesi tidak pernah dikirim ke Foonte.

### 🧹 Refactoring & Pembersihan Kode
* **Pembersihan Database**:
  * Menambahkan `reminder_logs` sebagai audit trail Foonte. Tabel lama tidak dihapus karena masih direferensikan dashboard, riwayat, dan Web Push aktif.
* **Pembersihan File**:
  * Tidak ada penghapusan file: audit menemukan route/service yang ada masih memiliki referensi aktif.

### 🔐 Konfigurasi Environment
* Menambahkan variabel `.env` baru:
  * `FOONTE_API_TOKEN`
  * `FOONTE_WA_GROUP_ID`
  * `CRON_SECRET_KEY`

---

## [Format Catatan Perubahan Selanjutnya]

## [2026-10-01] - Reminder Grup Foonte via Cron Webhook
- **Added**: `/api/cron/reminder`, `FoonteService`, formatter pesan, `reminder_logs`, migration `20261001000003`, dan unit test payload/format.
- **Changed**: `.env.example` kini hanya berisi placeholder dan mencantumkan konfigurasi Foonte + cron.
- **Deprecated/Removed**: Tidak ada; jalur Web Push dan tabel pendukungnya masih aktif.
- **Notes for Next Agent**: Konfigurasikan job `POST` cron-job.org dengan header `X-Cron-Secret`. Terapkan migration sebelum endpoint dipanggil. Respons Foonte direkam maksimal 1.000 karakter dan tidak boleh berisi token.

Setiap agen/developer yang melakukan pembaruan wajib memperbarui bagian di bawah ini sesuai tanggal penanganan:

```markdown
## [YYYY-MM-DD] - <Judul Singkat Perubahan>
- **Added**: File/fitur baru yang ditambahkan.
- **Changed**: Perubahan pada logika atau struktur data.
- **Deprecated/Removed**: Kode, fungsi, atau tabel DB yang dihapus.
- **Notes for Next Agent**: Catatan khusus atau hal penting yang perlu diperhatikan oleh agen selanjutnya.
```
