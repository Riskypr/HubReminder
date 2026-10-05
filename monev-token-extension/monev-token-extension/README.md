# Monev Token Helper

Ekstensi Chrome / Microsoft Edge (Manifest V3) untuk mencari `monev_refresh_token` dan access token dari sesi login sendiri. Tidak membutuhkan npm atau proses build.

## Instalasi

1. Buka `chrome://extensions` atau `edge://extensions`.
2. Aktifkan **Developer mode / Mode pengembang**.
3. Klik **Load unpacked / Muat ekstensi yang belum dipaketkan**.
4. Jika mengambil dari ZIP HubReminder, pilih folder `monev-token-extension/monev-token-extension` di dalam hasil ekstrak (folder yang berisi `manifest.json`).
5. Buka https://monev.maganghub.kemnaker.go.id/dashboard dan login. Klik ikon puzzle **Extensions** lalu pilih atau pin **Monev Token Helper**.
6. Klik **Cari access token** untuk localStorage, sessionStorage, dan slot memori Nuxt `monev-access-token` yang dipakai situs Monev.
7. Jika access token belum ditemukan, klik **Cari refresh token + cookies API**, lalu izinkan akses ke situs Monev dan API Monev untuk membaca cookies termasuk HttpOnly.
8. Klik **Salin token** pada hasil access token. Nilai disalin apa adanya, tanpa awalan `Bearer`; refresh token bukan token yang ditempel pada form HubReminder.

## Cara pencarian

- Membaca tab utama yang sedang aktif, setelah tombol diklik.
- Nama yang dikenali: `monev_refresh_token`, `refresh_token`, `access_token`, `monev_access_token`, dan variasi huruf/pemisah seperti `accessToken`.
- Memeriksa objek JSON di penyimpanan sampai delapan tingkat, misalnya `auth.access_token`.
- Cookies dibaca dari cookie store tab aktif, untuk domain MagangHub yang telah diizinkan: `monev.maganghub.kemnaker.go.id` dan `monev-api.maganghub.kemnaker.go.id`. Semua path cookie ikut diperiksa, termasuk `/api/v1/auth`.
- Access token pada slot memori Nuxt dibaca dalam konteks halaman (`MAIN`), tanpa memanggil API refresh atau mengubah sesi.
- Tidak menangkap header Authorization dari trafik jaringan, IndexedDB, atau iframe domain lain. Struktur memori Nuxt bisa berubah ketika situs diperbarui.

## Setelah pembaruan ekstensi

Buka `chrome://extensions` atau `edge://extensions`, klik tombol **Reload / Muat ulang** pada Monev Token Helper. Tunggu dashboard selesai dimuat, buka popup kembali, lalu gunakan tombol pencarian yang baru. Pastikan bagian atas popup menampilkan **v1.1.1**. Versi ini memeriksa manifest yang benar-benar dimuat browser dan tetap menampilkan access token ketika izin cookies gagal.

Jika muncul `Only permissions specified in the manifest may be requested`, browser belum mengenali izin API yang baru. Reload ekstensi melalui halaman extensions (reload dashboard saja tidak cukup). Jika masalah berlanjut, hapus ekstensi dan gunakan **Load unpacked** kembali dengan folder yang sama, lalu izinkan kedua domain saat menekan tombol cookies.

## Penanganan token

Hasil hanya disimpan dalam memori popup, disamarkan sampai tombol Tampilkan diklik, dan hilang saat popup ditutup. Ekstensi tidak mengirim token ke server, tidak mencatatnya ke log, dan tidak menyimpannya ke disk. Tombol salin menaruh token pada clipboard sistem; clipboard tetap tersedia setelah popup ditutup. Izin situs untuk cookies tetap tersimpan di browser sampai dicabut melalui pengaturan ekstensi.

Referensi API: [Chrome scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting), [Chrome cookies](https://developer.chrome.com/docs/extensions/reference/api/cookies), [optional permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions).
