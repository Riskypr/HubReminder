# Rules.md — Coding Convention, Style Guide & Batasan AI (HubReminder)

## 1. Coding Convention

### 1.1 Bahasa & Struktur
- TypeScript wajib (`strict: true`). Hindari `any`.
- Next.js App Router — server component default, `"use client"` hanya untuk komponen interaktif (form, status card yang subscribe realtime, dsb).
- Edge Function (`supabase/functions/check-attendance`) ditulis modular: pisahkan fungsi `fetchDashboard()`, `parseStatus(html)`, `evaluateReminder()`, `sendPush()` — jangan digabung jadi satu fungsi besar, agar mudah di-unit test dan diperbarui saat struktur HTML MagangHub berubah.
- Satu komponen = satu file. `PascalCase.tsx` untuk komponen, `camelCase.ts` untuk service/util.

### 1.2 Penamaan
- Variabel/fungsi: `camelCase`. Komponen & Tipe: `PascalCase`. Konstanta global: `UPPER_SNAKE_CASE`.
- Status attendance memakai enum string konsisten di seluruh layer: `'belum_lapor' | 'selesai' | 'unknown' | 'session_expired'` — didefinisikan satu kali di `lib/types/attendance.ts`, di-import di mana pun, jangan tulis ulang string literal secara manual.
- Service diakhiri `Service` (`accountService.ts`), store Zustand diakhiri `Store`.

### 1.3 Komponen & Styling
- Tailwind utility classes, warna wajib mengambil dari token di `Design.md` (jangan hardcode hex baru).
- Status badge (biru/hijau/abu) **wajib** selalu disertai label teks & ikon, tidak boleh hanya mengandalkan warna (aksesibilitas).
- Komponen dasar hanya didefinisikan di `components/ui/`.

### 1.4 Data & Keamanan (Kritis)
- Access dan refresh token MagangHub **wajib dienkripsi** sebelum disimpan ke Postgres (`lib/utils/crypto.ts` atau Supabase Vault) — dilarang menyimpan kata sandi atau mengembalikan material autentikasi ke client.
- **Dilarang keras** melakukan `console.log`, logging, atau tracing yang mencetak isi sesi/token mentah, baik di server maupun Edge Function.
- Semua akses ke tabel `maganghub_sessions` dari sisi aplikasi (bukan Edge Function) hanya boleh lewat service layer yang tidak pernah mengembalikan token terenkripsi atau plaintext ke response API/client.
- Frekuensi pengecekan (`pg_cron`) tidak boleh lebih sering dari interval minimum yang disepakati (mis. tidak kurang dari 5–10 menit) untuk menghindari beban berlebih ke server MagangHub dan risiko akun dianggap aktivitas mencurigakan.
- Setiap fetch ke domain eksternal (`monev.maganghub.kemnaker.go.id`) wajib menyertakan timeout & error handling — jangan biarkan Edge Function menggantung jika situs eksternal lambat/down.

### 1.5 Commit & Git
- Format: `type(scope): deskripsi singkat` — contoh: `feat(reminder): tambah setting jam aktif`, `fix(checker): perbaiki deteksi status hijau`.
- Tipe: `feat`, `fix`, `refactor`, `style`, `docs`, `test`, `chore`.
- Dilarang commit file `.env*`, kunci VAPID privat, atau contoh nilai cookie asli (termasuk di file testing/fixture — gunakan data dummy).

### 1.6 Testing
- `parseStatus(html)` wajib punya unit test dengan beberapa contoh potongan HTML (mock, bukan data pengguna asli): kondisi biru, hijau, dan struktur tak dikenali (harus fallback ke `unknown`, bukan error/crash).
- `evaluateReminder()` (logika kuota & interval) wajib diuji dengan berbagai kombinasi waktu & setting untuk memastikan tidak ada reminder spam melebihi batas.

## 2. Style Guide Tambahan
- Bahasa UI: Bahasa Indonesia.
- Format waktu: 24 jam (`HH:mm`), periode magang `d MMMM yyyy`, timezone mengikuti `profiles.timezone` (default `Asia/Jakarta`).
- Pesan notifikasi push singkat & actionable, contoh: **"Laporan hari ini belum diisi — tap untuk isi sekarang."** (bukan pesan generik seperti "Ada pembaruan").
- Semua pesan error harus menjelaskan tindakan lanjutan (mis. "Sesi kedaluwarsa, silakan hubungkan ulang di menu Setting").

## 3. Batasan AI (AI Boundaries)

1. **Dilarang mengimplementasikan fitur auto-submit/auto-isi laporan harian secara otomatis atas nama pengguna.** Aplikasi ini murni alat pengingat (reminder), bukan alat pengisian otomatis — batasan ini permanen kecuali pemilik project mengubah scope secara eksplisit di `PRD.md`.
2. **Dilarang menyimpan username/password MagangHub.** Kredensial hanya boleh dikirim sementara dari backend proxy ke endpoint login MagangHub; token hasilnya harus dienkripsi sebelum disimpan.
3. **Dilarang menambah scraping ke akun/data milik pengguna lain** — sistem didesain single-account-per-user, AI tidak boleh menambahkan fitur yang memungkinkan satu instance memantau akun orang lain tanpa consent eksplisit terpisah.
4. **Dilarang menurunkan frekuensi minimum polling** (interval pengecekan) di bawah ambang yang sudah disepakati di `Rules.md` §1.4 tanpa persetujuan eksplisit — untuk menjaga kewajaran beban ke server eksternal.
5. **Dilarang mengubah skema enkripsi/penyimpanan sesi** (`Schema.md` §2.2) tanpa menyertakan penjelasan dampak keamanan pada ringkasan perubahan.
6. **Dilarang menambahkan pemanggilan API/analytics pihak ketiga** yang mengirim data pengguna (termasuk kredensial, token sesi, atau HTML dashboard) ke luar endpoint resmi MagangHub dan infrastruktur Supabase project ini.
7. **Wajib memperbarui dokumen terkait** (`Architecture.md`, `Schema.md`, `Design.md`) bila ada perubahan struktur folder, skema data, atau alur inti (job checker, push notification).
8. AI boleh mengusulkan penyesuaian selector/parser (`parseStatus`) bila struktur HTML MagangHub berubah, namun **wajib disertai catatan versi/tanggal perubahan** agar mudah dilacak bila situs berubah lagi.
9. **Perubahan besar** (menyentuh Edge Function inti atau skema keamanan) wajib disertai ringkasan: apa yang berubah, kenapa, dan dampaknya — **tidak boleh dieksekusi langsung tanpa konfirmasi** pemilik project.
10. AI mengingatkan pemilik project bahwa **kepatuhan terhadap Ketentuan Layanan situs MagangHub** adalah tanggung jawab pengguna aplikasi ini; AI tidak memberikan jaminan hukum atas penggunaan tools ini terhadap platform pihak ketiga.
