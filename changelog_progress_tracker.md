# Project Change Log & Agent Progress Tracker

Dokumen ini mencatat seluruh perubahan struktur, skema database, dan penambahan fitur. File ini berfungsi sebagai acuan cepat (*single source of truth*) bagi AI Agent atau developer berikutnya untuk memahami kondisi kode tanpa perlu memindai seluruh direktori repositori.

---

## [Unreleased / Current Work]
- **Fixed**: Perbaikan masalah reminder yang tidak tereksekusi saat jam jadwal pengaturan pengguna tiba:
  - **Bypass Jeda Interval untuk Checkpoint Baru**: Pada `isParticipantReminderDue` (`/api/cron/reminder`), checkpoint jadwal yang baru tiba kini langsung dieksekusi tanpa tertahan oleh jeda interval pengiriman lama (misal log sebelumnya dikirim sebelum jam checkpoint tiba atau user baru saja memperbarui jam reminder). Jeda interval hanya diberlakukan untuk mencegah spam pengiriman ulang setelah checkpoint tersebut dilayani.
  - **Eliminasi Pemblokiran Bulk Interval**: Pengiriman pengingat WhatsApp (`dueReportSessions`) dan Web Push notifications tidak lagi diblokir secara sepihak oleh interval admin grup (`bulkIntervalElapsed`) ketika peserta telah mencapai jadwal reminder personal masing-masing.
  - **Pengiriman Web Push Tepat Waktu**: Web Push browser kini dikirimkan kepada seluruh peserta yang jatuh tempo (`userDueSessions`), memastikan pengguna menerima notifikasi browser secara instan pada waktu yang ditentukan.
- **Changed**: Form Pengaturan Reminder Pribadi (`ReminderSettingsForm.tsx`) disederhanakan:
  - **UI Edit Saja (Tanpa Tambah & Hapus)**: Menghapus input dan tombol "Tambah Waktu" serta tombol hapus waktu reminder. Pengguna kini hanya dapat mengubah (*edit*) waktu pengingat yang ada melalui tombol "Ubah", sesuai kebutuhan bahwa jadwal hanya bisa diedit.
- **Fixed**: Perbaikan bug jadwal reminder yang tidak tampil/terkirim sesuai waktu pengaturan masing-masing pengguna:
  - **Kesesuaian Jadwal Personal**: Pada cron pengingat WhatsApp (`/api/cron/reminder`), implementasi fungsi `isParticipantReminderDue` memastikan daftar peserta yang masuk ke pengingat (baik mode Bulk maupun Single) benar-benar telah mencapai waktu pengingat yang diatur masing-masing user (`reminder_times`), tidak sedang di-snooze, pengingat berstatus aktif, serta belum melebihi kuota harian personal (`max_reminders_per_day`). Peserta yang mengatur jam pengingat siang/sore tidak lagi keliru tercantum di pengingat pagi hari.
  - **Toleransi Panggilan Cron**: Pengecekan waktu tidak lagi menggunakan komparasi menit kaku yang rentan gagal akibat delay eksekusi cron-job.org, melainkan mendeteksi apakah waktu jadwal/checkpoint telah tiba dan interval jeda telah terpenuhi.
  - **Normalisasi Format Waktu**: Mengoreksi format `reminder_times` dari PostgreSQL `time[]` (yang mengembalikan `HH:MM:SS`) agar dinormalisasi menjadi `HH:MM` pada `reminderSettingsService.ts`, sehingga kartu jadwal di Dashboard dan form pengaturan selalu tampil bersih dan konsisten.
  - **Proteksi Kuota Foonte Admin**: Menghitung kuota admin harian berdasarkan jumlah eksekusi/pesan unik (run pengiriman), bukan menghitung jumlah baris log per peserta yang sebelumnya menyebabkan kuota admin habis prematur.
- **Changed**: Bot WhatsApp auto-submit laporan (`/api/webhook/fonnte`) diubah agar **tidak langsung submit**. Bot kini membuat draf laporan (Gemini AI), menyimpannya dengan status `waiting_approval`, dan mengirimkan pratinjau lengkap ke WhatsApp dengan instruksi persetujuan pengguna:
  - Balas `KIRIM`, `YA`, `OKE`, atau `SETUJU` untuk menyetujui dan submit ke MagangHub.
  - Balas `ULANG` atau `REGEN` untuk generate ulang draf menggunakan Gemini AI.
  - Balas `EDIT [catatan baru]` untuk merevisi kegiatan dan membuat draf baru.
  - Balas `BATAL` untuk membatalkan draf laporan aktif hari ini.
- **Added**: Migration `20261012000001_add_waiting_approval_status.sql` untuk memperluas constraint status tabel `public.wa_report_sessions` agar mendukung `waiting_approval`.
- **Added**: Utilitas parsing perintah pengguna dan format pesan WA pada `lib/services/fonnteWebhookUtils.ts` (`parseUserBotAction`, `formatReportPreviewMessage`, `formatSubmitSuccessMessage`).
- **Added**: Halaman khusus baru untuk Panel Admin pada `/admin` (`app/(dashboard)/admin/page.tsx`) dengan desain modern, tata letak solid yang bersih, badge status admin, dan info callout yang elegan.
- **Changed**: Gradient brand pada tombol dan elemen UI diseragamkan ke `135deg, #0759d8, #0344b8` (tombol Panel Admin di Header, tombol navigasi di Pengaturan, icon badges). Gradient dekoratif pada latar/kartu netral diganti warna solid agar keterbacaan tetap terjaga.
- **Changed**: Memisahkan form pengaturan admin (`AdminReminderSettingsForm`) dari halaman Pengaturan Pengingat Pribadi (`/settings/reminder`), sehingga tampilan pengaturan user kembali bersih (*clean*), fokus, dan rapi.
- **Added**: Menu navigasi "Admin" khusus akun administrator pada Sidebar desktop dan Bottom Navigation mobile (`components/layout/BottomNav.tsx`) serta tombol cepat "Panel Admin" pada Header (`components/layout/Header.tsx`).
- **Added**: Unit test komprehensif pada `tests/fonnteWebhookRoute.test.ts` dan `tests/fonnteWebhookUtils.test.ts` untuk menguji alur draf persetujuan, submit dengan approval, generate ulang, dan pembatalan draf.
- **Added**: Fitur penonaktifan reminder WhatsApp khusus hari akhir pekan / libur (`weekend_reminder_enabled`, default `false` agar libur di hari Sabtu & Minggu).
- **Added**: Migration `20261011000001_add_weekend_reminder_enabled.sql` yang menambahkan kolom boolean `weekend_reminder_enabled` ke tabel `system_reminder_settings`.
- **Added**: Kartu kontrol switch instan untuk "Reminder Weekend" pada form pengaturan admin (`AdminReminderSettingsForm.tsx`) lengkap dengan ikon `CalendarOff` Lucide, badge status, dan toggle instan via endpoint `PATCH`.
- **Fixed**: Perbaikan bug nama peserta yang sudah absen namun tetap muncul di daftar "belum lapor":
  - Pada `/api/cron/reminder`, filter status `attendance_checks` kini dibatasi HANYA untuk hari ini (`isTodayInTz`), mencegah riwayat kemarin/hari lampau keliru terbawa ke reminder hari ini.
  - Implementasi *Live Attendance Verification* sebelum pesan reminder WA dikirim: peserta yang belum tercatat 'selesai' hari ini diverifikasi langsung secara real-time ke API MagangHub, sehingga peserta yang baru saja absen langsung terdeteksi 'selesai' dan otomatis dikecualikan dari list pesan WA.
  - Peningkatan parser status API MagangHub (`parseApiResponse` & edge function) agar mengenali status pengisian resmi MagangHub (`PRESENT`, `submitted`, `hadir`, `approved`) serta status libur/off-day (`off-day`, `holiday`, `libur`).
  - Koreksi komparasi tanggal `todayStr` di `maganghubService.ts` agar menggunakan timezone Asia/Jakarta (WIB) alih-alih UTC.
- **Added**: Aksi kontrol untuk mengaktifkan dan menonaktifkan **Reminder Bersama** (`reminder_together_enabled`) dan **Bot WhatsApp** (`wa_bot_enabled`) pada panel pengaturan admin reminder.
- **Added**: Migration `20261009000001_admin_reminder_and_bot_controls.sql` yang menambahkan kolom boolean `reminder_together_enabled` dan `wa_bot_enabled` ke tabel `system_reminder_settings`.
- **Added**: Dukungan method `PATCH` pada `/api/settings/reminder/admin` untuk aksi toggle cepat dan instan dengan feedback toast visual.
- **Added**: Redesign menyeluruh antarmuka Pengaturan Admin Reminder (`AdminReminderSettingsForm.tsx`) dengan koleksi ikon Lucide lengkap (`ShieldCheck`, `Bot`, `Users`, `Power`, `Layers`, `Clock3`, `Timer`, `Gauge`, `Cookie`, `Hourglass`, `Save`, `CalendarOff`), kartu switch toggle interaktif, badge status Aktif/Nonaktif, dan panduan deskripsi yang jelas.
- **Changed**: Cron reminder (`/api/cron/reminder`) kini menghentikan pengiriman pesan WA bila `wa_bot_enabled` bernilai false, atau bila hari ini Sabtu/Minggu dan `weekend_reminder_enabled` dinonaktifkan, serta menonaktifkan pengiriman laporan bulk grup bila `reminder_together_enabled` bernilai false.
- **Changed**: Webhook Fonnte (`/api/webhook/fonnte`) melewati pemrosesan perintah pesan masuk dan auto-laporan jika `wa_bot_enabled` dinonaktifkan oleh admin.
- **Added**: Unit tests untuk service pengaturan sistem reminder dan skenario penonaktifan Bot WhatsApp pada webhook Fonnte.

## [2026-10-04] - Redesign Total UI, Grid Mode Desktop, Notifikasi Atas, dan Dialog Konfirmasi Next.js
- **Added**:
  - Implementasi CSS Grid menyeluruh pada mode desktop untuk halaman Dashboard (`lg:grid-cols-12` bento-box grid), Riwayat (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3` plus summary stats cards 4 kolom), Pengaturan (`lg:grid-cols-12` 2 kolom seimbang), dan Login (split screen 2 kolom `lg:grid-cols-12`).
  - Penambahan ikon Lucide yang komprehensif di seluruh antarmuka (Header, Desktop Sidebar, Mobile Bottom Nav, Status Card, Profile Card, Timeline Riwayat, Form Pengaturan Reminder, Form Akun MagangHub, Banner, dan Halaman Login).
  - Komponen `components/ui/ConfirmDialog.tsx` yang ditingkatkan dengan animasi modal Next.js yang modern, varian dialog (danger, warning, info), ikon kustom, focus trap, dukungan tombol Escape, dan state loading tombol yang elegan.
  - Fitur Logout akun HubReminder dengan dialog konfirmasi modal Next.js (bukan bawaan browser) pada Header dan Sidebar.
  - Banner sapaan dinamis di Dashboard ("Selamat Pagi/Siang/Sore/Malam") dengan format tanggal bahasa Indonesia dan pill status aktif.
- **Changed**:
  - Memperbaiki tempat munculnya toast notifikasi: mengimpor CSS resmi `react-toastify/dist/ReactToastify.css`, mengatur posisi di bagian atas (`position="top-right"` pada desktop dan adaptif pada mobile dengan `top: 1rem`), serta styling modern dengan z-index tinggi (`z-[99999]`), border warna sesuai status, dan efek glassmorphism.
  - Mengganti seluruh pop-up konfirmasi bawaan browser (`window.confirm`/`window.alert`) dengan komponen modal Next.js `ConfirmDialog` (untuk memutuskan akun MagangHub dan keluar akun HubReminder).
  - Redesign total estetika UI pada `app/globals.css`: gradient latar belakang halus, radius sudut modern (`rounded-2xl` & `rounded-3xl`), drop shadow lembut, kartu dengan micro-interaction saat hover, serta navigasi desktop sidebar terpadu.
- **Deprecated/Removed**:
  - Dihilangkan seluruh potensi penggunaan pop-up dialog bawaan browser.
## [2026-10-04b] - Tampilkan Foto Profil & Posisi Magang
- **Added**:
  - Migration `20261004000009_add_profile_position.sql` — kolom `position text` pada tabel `public.profiles`.
  - Field `position`, `role`, `division`, `job_title`, `internship_position` pada interface `MagangHubUserData` (`lib/services/maganghubService.ts`) untuk menangkap posisi magang dari berbagai kemungkinan field API MagangHub.
  - Logika `positionValue` pada `syncUserProfileFromMagangHub` dan edge function `check-attendance/index.ts` yang mengambil data posisi dari field API mana pun yang tersedia.
  - Field `position` dan `role` pada TypeScript interface `Profile` (`lib/types/session.ts`).
- **Changed**:
  - `ProfileCard.tsx`: menampilkan foto profil pengguna (dengan fallback initials avatar) dan posisi magang/job role dengan ikon `Briefcase` Lucide.
- **Notes for Next Agent**:
  - **PENTING**: Migration `20261004000009` perlu dijalankan di database (`supabase db push` atau dijalankan manual). Project belum ter-link (`supabase link --project-ref <ref>` diperlukan).
  - Posisi akan bernilai fallback `'Peserta Magang'` jika belum disinkronkan atau API MagangHub tidak mengembalikan field posisi.
  - Foto profil di-render jika `profile.photo_url` tersedia; jika gagal load, otomatis fallback ke initials avatar.

