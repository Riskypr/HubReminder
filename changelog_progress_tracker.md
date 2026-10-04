# Project Change Log & Agent Progress Tracker

Dokumen ini mencatat seluruh perubahan struktur, skema database, dan penambahan fitur. File ini berfungsi sebagai acuan cepat (*single source of truth*) bagi AI Agent atau developer berikutnya untuk memahami kondisi kode tanpa perlu memindai seluruh direktori repositori.

---

## [Unreleased / Current Work]

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

