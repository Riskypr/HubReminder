# Project Change Log & Agent Progress Tracker

Dokumen ini mencatat seluruh perubahan struktur, skema database, dan penambahan fitur. File ini berfungsi sebagai acuan cepat (*single source of truth*) bagi AI Agent atau developer berikutnya untuk memahami kondisi kode tanpa perlu memindai seluruh direktori repositori.

---

## [Unreleased / Current Work]
- **Fixed**: Webhook Fonnte membaca format nomor WhatsApp/JID dengan benar, memakai `member` untuk pengirim pesan grup dan `text` sebagai fallback balasan tombol; perintah `link` diparsing konsisten.
- **Changed**: Error pencarian profil dan kegagalan kirim balasan Fonnte kini dicatat lebih jelas di log server agar proses link yang gagal dapat dibedakan dari webhook yang tidak diterima.
- **Added**: Unit test untuk parsing payload Fonnte, normalisasi nomor, pesan grup, dan perintah link.
- **Fixed**: Mode Bulk kini menyertakan semua peserta dengan sesi valid dan status terbaru `belum_lapor`; snooze, kuota, dan toggle reminder personal hanya membatasi mode Single. Interval global admin tetap mencegah pengiriman Bulk berulang.
- **Fixed**: Perubahan jadwal admin mengatur ulang jeda cooldown dari log lama agar waktu mulai baru dapat berlaku; batas maksimum pengiriman harian tetap dihitung. Toleransi pemanggilan cron diperlebar untuk mengantisipasi keterlambatan kecil.
- **Changed**: Template reminder laporan WhatsApp menampilkan judul reminder, hari, tanggal, dan jam pengiriman dalam zona waktu WIB.
- **Added**: Panel admin reminder berbasis allowlist `REMINDER_ADMIN_EMAILS` untuk memilih mode Single/Bulk, jam mulai WIB, interval, jumlah pengulangan warning cookie, dan jeda warning; migration `20261006000001_flexible_reminder_settings.sql` membuat tabel konfigurasi sistem dan log warning.
- **Added**: Mode Single mengirim pesan terpisah per peserta ke target Foonte; mode Bulk mengirim daftar peserta dalam satu pesan ke target Foonte. Target tidak diinput di aplikasi.
- **Added**: Cron mengirim daftar peserta belum mengisi laporan, mendeteksi sesi berstatus expired dan access token JWT yang akan kedaluwarsa dalam tiga hari, membatasi warning per sesi, dan menyertakan tautan HubReminder HTTPS.
- **Changed**: Jadwal pengiriman WhatsApp menggunakan jam mulai dan interval global admin; pengaturan kuota harian dan snooze per pengguna tetap berlaku.
- **Changed**: Input nomor peserta dan target nomor/ID grup di UI dihapus; cron tidak membaca target dari database. Single mengirim pesan terpisah per peserta ke target environment Foonte yang sama; Bulk mengirim daftar ke target tersebut.
- **Changed**: Respons cron sekarang menyertakan alasan saat tidak ada pesan jatuh tempo, jumlah peserta dalam pesan, dan ringkasan kode kegagalan Foonte tanpa mengembalikan body provider yang dapat memuat data target/pesan.
- **Changed**: Pengiriman multi-target dibatasi lima request serentak untuk menjaga tempo pengiriman WhatsApp.
- **Notes for Next Agent**: Terapkan migration baru di Supabase dan set `REMINDER_ADMIN_EMAILS` di deployment. Target dibaca dari `FOONTE_WA_GROUP_ID`; `FOONTE_WA_TARGETS` opsional untuk beberapa nomor/ID grup. Peringatan “mau habis” hanya dapat dihitung saat access token memuat klaim JWT `exp`; sesi tanpa klaim tersebut diperingatkan setelah statusnya expired.
- **Changed**: Template reminder WhatsApp menyertakan URL dashboard Monev dalam bentuk tautan langsung yang bisa diketuk untuk mengisi absensi.
- **Fixed**: Pendaftaran Web Push sekarang memakai subscription Service Worker aktif, menyegarkan subscription lama bila kunci VAPID berubah, memvalidasi bentuk kunci, dan memberi langkah pemulihan untuk error layanan push browser.
- **Changed**: Notifikasi web menampilkan tombol **Isi absensi** dan klik notifikasi membuka dashboard Monev MagangHub.
- **Changed**: Perbaikan toggle Aktifkan Layanan Pengingat dengan ukuran konsisten, status Aktif/Nonaktif, tata letak responsif, dan dukungan fokus keyboard serta label aksesibel.
- **Removed**: Uji coba push notification dari halaman pengaturan dan endpoint khusus `/api/push/test`.
- **Changed**: Perapian UI login dengan proporsi panel dan jarak responsif yang lebih baik, ukuran logo konsisten, teks input lebih mudah dibaca, serta autocomplete untuk nama, email, dan kata sandi.
- **Changed**: Gradient brand pada tombol dan elemen UI diseragamkan ke `135deg, #0759d8, #0344b8`. Gradient dekoratif pada latar/kartu netral diganti warna solid agar keterbacaan tetap terjaga.
- **Fixed**: Sapaan dashboard dan tanggal kini mengikuti timezone profil pengguna, bukan timezone runtime server, sehingga tidak bergeser saat aplikasi dideploy pada server UTC.

## [2026-10-05] - Panduan Mengambil Access Token MagangHub
- **Added**: Petunjuk langkah demi langkah di halaman Hubungkan Akun untuk membuka DevTools, memilih request `refresh` pada tab Network, mengambil nilai `access_token` dari Response, dan menempelkannya ke kolom sesi.
- **Changed**: Instruksi menegaskan bahwa token akses bersifat rahasia dan tidak boleh dibagikan; setelah diverifikasi, token tetap disimpan terenkripsi menggunakan AES-GCM.
- **Notes for Next Agent**: Parser sesi menerima JWT mentah sebagai nilai access token, sehingga salin nilainya saja tanpa tanda petik atau seluruh response JSON.

## [2026-10-05] - Perbaikan Riwayat dan Toggle Pengaturan
- **Fixed**: Riwayat sekarang mengelompokkan dan menampilkan hari serta waktu sesuai timezone profil pengguna, dan mengambil sampai 30 hari berbeda meski ada banyak pengecekan dalam sehari.
- **Changed**: Navigasi pengaturan dirapikan menjadi pilihan bergaya toggle dan switch snooze reminder diseragamkan.
- **Notes for Next Agent**: `HistoryTimeline` menerima timezone dari profil, `dateKeyInTz` dipakai untuk pengelompokan lokal, dan histori notifikasi memuat hingga 600 log (maksimal 20 per hari untuk 30 hari).

## [2026-10-05] - Kembalikan Pemilih Metode Login MagangHub
- **Changed**: Pemilih metode login Cookie Sesi / Email & Kata Sandi dikembalikan menjadi dua tombol seperti desain sebelumnya; input dan proses koneksi tetap sama.
- **Notes for Next Agent**: Tombol pilihan login bersifat saling eksklusif; switch pengaturan reminder dan snooze tetap dipakai.

## [2026-10-05] - Percepat Perpindahan Antar Pengaturan
- **Improved**: Tab pengaturan kini mem-prefetch penuh halaman tujuan yang belum aktif, termasuk data halaman dinamis, sehingga perpindahan ke Pengingat atau Akun MagangHub tidak perlu menunggu seluruh request dimulai setelah klik.
- **Notes for Next Agent**: `SettingsTabs` mematikan prefetch untuk tab aktif dan mengaktifkannya hanya untuk halaman saudara; ini sengaja membatasi render prefetch server ke satu halaman.

## [2026-10-05] - Google Sans Flex dan Dropdown Maksimum Pengingat
- **Changed**: Google Sans Flex variable dipakai sebagai font global melalui `next/font/google` dan `font-sans` Tailwind.
- **Changed**: Kontrol maksimum pengingat per hari diganti dari slider menjadi dropdown pilihan 1–20 agar sesuai validasi API.
- **Notes for Next Agent**: Next.js men-download Google Font saat build lalu menyajikannya dari aset aplikasi sendiri.

## [2026-10-05] - Penanganan Batas Email Pendaftaran
- **Fixed**: Form pendaftaran mencegah submit ganda, menghentikan pengiriman ulang setelah email verifikasi sukses atau terkena rate limit, dan menampilkan instruksi yang jelas saat email dibatasi.
- **Notes for Next Agent**: Kuota pengiriman email ditentukan oleh Supabase Auth/SMTP. SMTP bawaan memiliki batas rendah; untuk pendaftaran ke pengguna umum, konfigurasi SMTP khusus pada proyek Supabase tetap diperlukan.

## [2026-10-05] - Integrasi Panduan Monev Token Helper
- **Changed**: Bagian koneksi akun kini memandu pengguna mengunduh, memasang, dan menjalankan extension `Monev Token Helper`, lalu menyalin access token ke form. Panduan README extension diselaraskan dengan struktur folder dan membedakan access token dari refresh token.
- **Notes for Next Agent**: Folder extension yang dimuat browser adalah `monev-token-extension/monev-token-extension`, tempat `manifest.json` berada. Extension hanya meminta izin cookies untuk domain Monev dan API Monev setelah pengguna memilih pencarian cookies.

## [2026-10-05] - Unduhan Monev Token Helper Saja
- **Changed**: Halaman koneksi akun dan README kini mengarahkan pengguna ke ZIP khusus yang hanya berisi file extension, bukan arsip seluruh repository. Langkah instalasi meminta pengguna memuat folder hasil ekstrak yang langsung berisi `manifest.json`.
- **Notes for Next Agent**: Arsip `monev-token-extension/Monev-Token-Helper.zip` harus dibuat ulang jika isi extension berubah.

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
  - Penayangan foto profil eksternal pada kartu profil ditiadakan dan digantikan oleh ikon lencana avatar kustom.
- **Notes for Next Agent**:
  - Posisi toast diatur via `ToastProvider.tsx` dan class override `.hub-toast-container` di `app/globals.css`. Dialog modal terpusat di `components/ui/ConfirmDialog.tsx` dan dapat dipanggil dengan props `open`, `title`, `description`, `confirmLabel`, `variant`, dan event `onConfirm`/`onCancel`. Foto profil sengaja tidak ditampilkan di `ProfileCard.tsx` sesuai preferensi UI.

## [2026-10-04] - Redesign UI, Navigasi Desktop, dan Dialog Konfirmasi
- **Added**: Sistem tampilan responsif dengan ikon Lucide pada halaman login, dashboard, riwayat, pengaturan, serta navigasi sidebar desktop; konten utama memakai grid pada desktop. Komponen dialog konfirmasi aplikasi menggantikan `window.confirm` saat memutuskan akun.
- **Changed**: Toast notifikasi berpindah ke bagian atas layar; header dan navigasi berubah menjadi sidebar di desktop sementara navigasi bawah tetap dipakai di mobile. Dashboard, kartu profil/status, riwayat, login, dan pengaturan memperoleh tata letak serta hierarki visual yang diperbarui.
- **Deprecated/Removed**: Dialog konfirmasi bawaan browser untuk memutuskan akun.
- **Notes for Next Agent**: Dialog memakai komponen `components/ui/ConfirmDialog.tsx`; pertahankan focus handling dan Escape key jika dialog diubah. Tidak ada perubahan API atau schema database.

## [2026-10-04] - Ubah Waktu Reminder dan Grid Desktop
- **Changed**: Kontrol tambah/hapus waktu reminder diganti editor per waktu dengan aksi Ubah, Simpan, dan Batal; validasi mencegah format salah dan waktu duplikat.
- **Added**: Ikon untuk bagian pengaturan dan item waktu, serta layout grid dua kolom pada desktop dan grid responsif untuk daftar waktu.
- **Deprecated/Removed**: Aksi Tambah dan Hapus waktu reminder dihapus dari UI.
- **Notes for Next Agent**: Jumlah waktu yang sudah tersimpan tidak berubah; pengguna dapat mengubah waktu yang ada lalu menekan Simpan Pengaturan. Tidak ada perubahan schema/API.

## [2026-10-04] - Login MagangHub Menggunakan Cookie Sesi
- **Added**: Opsi login dengan cookie access MagangHub pada form Hubungkan Akun; endpoint memvalidasi cookie lewat profil `/users/me` lalu menyimpan access/refresh token terenkripsi.
- **Changed**: Parser menerima pasangan cookie bernama atau nilai JWT saja, hanya memproses token MagangHub yang dikenal (`monev-access-token`, `monev_access_token`, `access_token` beserta refresh token), serta mengabaikan cookie SIAPKerja, CSRF, dan cookie lain. Input cookie dibersihkan setelah login berhasil dan tidak dicatat ke log.
- **Deprecated/Removed**: Tidak ada; login dengan email dan kata sandi tetap tersedia.
- **Notes for Next Agent**: Pengguna perlu menyalin cookie access dari `monev.maganghub.kemnaker.go.id`, bukan `laravel_session`, `XSRF-TOKEN`, atau cookie `account.kemnaker.go.id`. API MagangHub dari Vercel tetap harus menerima sesi tersebut; jika API upstream juga memblokir request, cookie login tidak akan mengatasi blokir tersebut.

## [2026-10-02] - Hardening Login SIAPKerja terhadap Proteksi Upstream
- **Added**: Header request konsisten untuk halaman login dan XHR SIAPKerja, serta pesan diagnostik khusus saat halaman atau submit login ditolak HTTP 403.
- **Changed**: Parser `Set-Cookie` fallback kini memisahkan beberapa cookie dengan aman, sehingga cookie sesi Laravel dan cookie proteksi upstream sama-sama diteruskan ke request login.
- **Deprecated/Removed**: Tidak ada.
- **Notes for Next Agent**: Jika 403 tetap berulang setelah deploy, upstream kemungkinan memblokir autentikasi server-to-server; HubReminder memerlukan endpoint integrasi resmi atau mekanisme otorisasi yang disediakan Kemnaker, bukan endpoint API lama `/api/v1/auth/login` (saat ini 404).

## [2026-10-02] - Redesign UI dan Login Kredensial MagangHub
- **Added**: Endpoint proxy `POST /api/maganghub/login`, penyimpanan access/refresh token terenkripsi, migration `20261002000008_maganghub_credential_sessions.sql`, `ToastProvider`, ikon Lucide, dan formatter periode magang Indonesia.
- **Changed**: Form penghubung akun tidak lagi menerima cookie manual; checker Edge Function menggunakan dan memperbarui token hasil refresh. Tampilan login, dashboard, navigasi, riwayat, dan pengaturan memakai layout mobile-first dengan feedback Toastify. Untuk SIAPKerja, proxy kini mengambil CSRF dan cookie awal, mengirim `{ username, password }`, lalu mengikuti redirect SSO. Resolver login menerima URL penuh atau path; pesan HTTP membedakan endpoint/format yang salah dari kredensial yang ditolak.
- **Deprecated/Removed**: Endpoint input cookie `/api/account/connect` dan pemeriksaan cookie `/api/account/check-cookie` dihapus.
- **Notes for Next Agent**: Terapkan migration `20261002000008` sebelum deploy. `MAGANGHUB_LOGIN_PATH` menerima path relatif atau URL HTTPS pada domain Kemnaker; default `/auth/login` belum dapat dikonfirmasi dari sumber resmi saat implementasi. Sesi lama tetap terbaca karena migration hanya mengganti nama kolom, lalu pengguna dapat login kembali untuk menyimpan token/refresh token baru.

## [2026-10-02] - Selaraskan Pengaturan Reminder dengan Cron
- **Changed**: Input waktu reminder memakai presisi menit (HH:MM) dan nilai lama dengan detik dinormalisasi saat ditampilkan/disimpan.
- **Changed**: Interval 15 detik dihapus; pilihan baru mencakup 3 dan 4 jam, dengan validasi API dan constraint database yang sejalan.
- **Added**: Migration `20261002000007_cron_reminder_precision_and_intervals.sql` menormalkan data waktu lama dan mengganti nilai 15 detik menjadi 15 menit.
- **Notes for Next Agent**: Terapkan migration baru di Supabase sebelum memilih interval 3 atau 4 jam.

## [2026-10-02] - Diagnostik Checker Attendance
- **Added**: Respons endpoint checker membedakan Edge Function yang belum ditemukan (HTTP 404) dari kegagalan pemeriksaan lain.
- **Changed**: Kegagalan upstream kini mengembalikan kode HTTP checker agar riwayat cron lebih mudah didiagnosis.
- **Deprecated/Removed**: Tidak ada.
- **Notes for Next Agent**: Live check menemukan `/functions/v1/check-attendance` membalas 404; deploy Edge Function ke proyek Supabase yang sama dengan Vercel sebelum mengaktifkan job checker.

## [2026-10-02] - Jadwalkan Checker Status melalui cron-job.org
- **Added**: Endpoint `/api/cron/attendance` untuk memanggil Edge Function `check-attendance` dan job cron-job.org kedua dengan jadwal setiap 15 menit.
- **Changed**: `/api/cron/reminder/configure` kini menyinkronkan job pemeriksaan status dan job pengiriman WA; respons checker diringkas agar data peserta tidak terekspos di riwayat cron-job.org.
- **Deprecated/Removed**: Tidak ada.
- **Notes for Next Agent**: Setelah deploy, panggil endpoint configure lagi lalu simpan kedua ID job sebagai `CRON_JOB_ORG_JOB_ID` dan `CRON_JOB_ORG_ATTENDANCE_JOB_ID` di Vercel. Pastikan Edge Function `check-attendance` sudah dideploy dan secrets-nya tersedia.

## [2026-10-02] - Hilangkan Ketergantungan Jam Aktif Lama
- **Added**: Ringkasan dashboard menampilkan waktu reminder yang dipilih pengguna.
- **Changed**: Evaluator reminder mengikuti `reminder_times` dan `interval_seconds`; `active_start_time`/`active_end_time` lama tidak lagi menyaring jadwal.
- **Deprecated/Removed**: Tidak ada kolom lama yang dihapus dari database.
- **Notes for Next Agent**: Jalur cron WA memeriksa `reminder_times`. Terapkan migration kanal notification di bawah ini dan deploy agar log push tidak menahan reminder WA.

## [2026-10-02] - Pisahkan Kuota Reminder WhatsApp dan Push
- **Added**: Kolom `channel` pada `notification_logs` melalui migration `20261002000005_add_notification_channel.sql`, dengan indeks untuk riwayat per kanal dan pengguna.
- **Changed**: Evaluasi reminder WA kini hanya menghitung log kanal `whatsapp`; pengiriman WA juga ditulis dengan kanal tersebut. Endpoint membaca timezone peserta dari profil.
- **Deprecated/Removed**: Tidak ada.
- **Notes for Next Agent**: Terapkan migration `20261002000005` di Supabase dan deploy ulang. Sebelum migration aktif, query endpoint WA akan gagal karena kolom `channel` belum ada.

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
