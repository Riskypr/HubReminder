# PRD — Reminder Absensi MagangHub
**Codename:** HubReminder

## 1. Latar Belakang
Peserta magang wajib mengisi laporan harian di dashboard MagangHub Kemnaker (`monev.maganghub.kemnaker.go.id/dashboard`). Status pengisian ditampilkan lewat tombol "Isi Laporan Hari Ini" yang berubah warna: **biru** = laporan belum diisi (masih aktif/pending), **hijau** = laporan sudah diisi (selesai). Banyak peserta lupa mengisi laporan karena tidak ada reminder otomatis dari sistem asli. Dibutuhkan aplikasi pribadi yang memantau status tersebut dan mengirim push notification pengingat.

## 2. Tujuan Produk (Goals)
- Memantau status laporan harian pengguna di MagangHub secara berkala.
- Mengirim push notification saat status masih "belum lapor" (tombol biru), dengan jumlah pengulangan & jeda yang bisa diatur.
- Berhenti mengingatkan otomatis begitu status berubah jadi "selesai" (tombol hijau).
- Menyediakan dashboard mobile-first (PWA) yang menampilkan status hari ini & riwayat pengecekan.

## 3. Scope Project

### In Scope (MVP)
1. **Hubungkan Akun**: pengguna menghubungkan aplikasi ke dashboard MagangHub-nya sendiri (lihat catatan metode di `Architecture.md`).
2. **Pengecekan status berkala** (background job) yang membaca status tombol laporan (biru/hijau) dari dashboard MagangHub milik pengguna sendiri.
3. **Push Notification** pengingat saat status masih biru (belum lapor), mengikuti pengaturan reminder pengguna.
4. **Dashboard** menampilkan status hari ini (badge biru/hijau/tidak diketahui), waktu pengecekan terakhir, dan tombol pintasan buka MagangHub.
5. **Riwayat**: log histori status per hari & histori notifikasi yang terkirim.
6. **Setting Reminder**:
   - Jumlah maksimum reminder per hari.
   - Jeda/interval antar reminder (mis. tiap 30/60/90 menit).
   - Rentang jam aktif reminder boleh dikirim (mis. hanya 07.00–21.00).
   - Tombol aktif/nonaktifkan reminder sementara (snooze harian).
7. **PWA**: installable, mendukung push notification meski app tidak dibuka (via service worker).

### Out of Scope (MVP ini)
- **Auto-submit laporan harian secara otomatis** — di luar scope dan sengaja tidak dikembangkan (lihat batasan di `Rules.md`); tujuan aplikasi murni mengingatkan, bukan menggantikan tindakan pengguna mengisi laporan.
- Multi-akun dalam satu login aplikasi (MVP: 1 pengguna = 1 akun MagangHub yang dipantau).
- Analitik lintas-pengguna / leaderboard.
- Integrasi kalender eksternal (Google Calendar, dll.) — dipertimbangkan di fase berikutnya.

## 4. Business Requirement
- Aplikasi hanya memantau **akun milik pengguna sendiri** — bukan alat scraping massal/pihak lain.
- Pengguna harus memberi persetujuan eksplisit (consent) saat menghubungkan akun, dan diberi tahu cara kerja aplikasi (menyimpan sesi login untuk keperluan pengecekan berkala).
- Frekuensi pengecekan ke server MagangHub dibatasi (rate-limited) agar tidak membebani server eksternal maupun berisiko akun pengguna diblokir/dianggap aktivitas mencurigakan.
- Pengguna dapat memutus koneksi akun (disconnect) kapan saja dan menghapus seluruh data tersimpan.

## 5. Technical Requirement
- Next.js (App Router) + TailwindCSS, mobile-first, PWA (installable + push notification).
- Supabase sebagai backend: Auth (login pengguna aplikasi), Postgres (data), Edge Functions + Scheduler (pg_cron) untuk job pengecekan berkala.
- Web Push API (VAPID) untuk notifikasi, dikirim lewat service worker meski aplikasi tertutup.
- Parsing status dilakukan server-side (Edge Function) terhadap elemen tombol laporan (deteksi class `ui-primary-action--blue` vs indikasi warna hijau saat status selesai).
- Data sesi/kredensial pengguna disimpan terenkripsi (lihat `Schema.md` & `Rules.md`).

## 6. User Persona
- Peserta magang program Kemnaker yang aktif menggunakan HP sebagai perangkat utama.
- Sering lupa mengisi laporan harian karena kesibukan, ingin reminder otomatis tanpa perlu buka dashboard MagangHub berulang kali secara manual.

## 7. Detail Fitur MVP

| Fitur | Deskripsi Singkat | Prioritas |
|---|---|---|
| Hubungkan Akun MagangHub | Simpan sesi login agar sistem bisa cek status secara berkala | Must Have |
| Background Status Checker | Job berkala membaca status tombol laporan dari dashboard | Must Have |
| Push Notification Reminder | Kirim notifikasi sesuai pengaturan jumlah & interval | Must Have |
| Dashboard Status | Tampilkan status hari ini + waktu cek terakhir | Must Have |
| Setting Reminder | Atur jumlah maksimum, interval, jam aktif reminder | Must Have |
| Riwayat/Log | Histori status harian & histori notifikasi terkirim | Should Have |
| Snooze Harian | Nonaktifkan reminder untuk hari itu saja | Should Have |
| Deteksi sesi kedaluwarsa | Beri tahu pengguna & minta hubungkan ulang bila sesi login expired | Must Have |

## 8. Success Metrics
- Status "belum lapor" terdeteksi dan notifikasi pertama terkirim dalam ≤ 15 menit sejak status berubah (tergantung interval polling yang dikonfigurasi).
- Tidak ada notifikasi terkirim setelah status berubah menjadi "selesai" (0% false reminder setelah selesai lapor).
- Reminder berhenti otomatis setelah mencapai batas maksimum yang diset pengguna (tidak spam).
- Lighthouse PWA score ≥ 90; push notification berhasil diterima di ≥ 95% percobaan pengujian.
- Tidak ada insiden kebocoran data sesi pengguna selama pengujian keamanan dasar.

## 9. Risiko & Asumsi
- **Risiko:** Perubahan struktur HTML/class CSS di situs MagangHub akan membuat deteksi status gagal. Mitigasi: parsing dibuat modular/terisolasi (satu fungsi parser) agar mudah diperbarui, dan sistem menandai status "unknown" alih-alih salah tafsir jika elemen tidak ditemukan.
- **Risiko:** Sesi login (cookie) MagangHub punya masa berlaku terbatas → butuh mekanisme deteksi & notifikasi "sesi habis, harap hubungkan ulang".
- **Risiko ToS/legal:** Karena ini mengakses dashboard resmi Kemnaker secara otomatis, pengguna disarankan memastikan penggunaan wajar (hanya akun sendiri, frekuensi rendah) dan bertanggung jawab atas kepatuhan terhadap ketentuan layanan platform tersebut.
- **Asumsi:** Pengguna hanya memantau akun miliknya sendiri, aplikasi tidak dipakai untuk pihak lain.

## 10. Roadmap Non-MVP (Future)
- Auto-detect perubahan struktur situs & alert ke maintainer aplikasi.
- Statistik kedisiplinan bulanan (grafik konsistensi lapor).
- Reminder via channel lain (email/WhatsApp) sebagai fallback bila push notification gagal.
- Multi-akun per pengguna (mis. jika pindah program magang).
