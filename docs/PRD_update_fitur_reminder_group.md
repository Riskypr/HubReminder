# Product Requirement Document (PRD)

## 1. Ringkasan Produk (Product Summary)
* **Nama Fitur**: Flexible Bulk Reminder & Session Cookie Warning
* **Modul**: Notification System / Automated Reminder Service
* **Status**: Draft / Proposed Update
* **Target Pengguna**: Admin Platform / System Operator (berdasarkan Akun Email Terdaftar)

---

## 2. Latar Belakang & Tujuan (Background & Objectives)

### Latar Belakang
Saat ini, sistem reminder pengisian laporan dikirimkan secara individual atau melalui metode sebelumnya. Terdapat kebutuhan untuk mempermudah pemantauan dengan memberikan opsi **Bulk Reminder** (reminder sekaligus dalam bentuk list peserta), tanpa menghapus fitur reminder yang lama. Selain itu, diperlukan sistem **Warning Session Cookie** yang dapat dikonfigurasi langsung dari akun admin untuk memberikan penandanya bila cookie peserta/sistem mulai expired atau sudah habis.

### Tujuan
1. Memberikan fleksibilitas bagi pengguna untuk memilih mode reminder (Individual vs. Bulk Reminder).
2. Memfasilitasi konfigurasi jadwal pengiriman reminder otomatis (Waktu Mulai, Interval, Maksimum Pengulangan).
3. Mengurangi angka kelalaian pengisian laporan bulanan/harian peserta melalui notifikasi WhatsApp.
4. Memberikan peringatan dini (*warning*) terkait masa berlaku *session cookie* peserta agar akses monitoring tetap berjalan lancar.

---

## 3. Detail Fitur & Spesifikasi (Feature Specifications)

### 3.1. Fitur Mode Reminder (Bulk vs Single)
* **Pilihan Mode Reminder**: User dapat memilih mode yang diinginkan melalui antarmuka settings/dashboard:
  * **Mode Existing (Single / Individual Reminder)**: Mengirimkan notifikasi personal ke masing-masing peserta.
  * **Mode Baru (Bulk / Group List Reminder)**: Mengirimkan daftar (*list*) nama peserta yang belum mengisi laporan dalam satu pesan bersama via WhatsApp.
* **Format Pesan WhatsApp (Bulk Mode)**:
  ```text
  [Nama Peserta A] - belum mengisi laporan
  [Nama Peserta B] - belum mengisi laporan
  [Nama Peserta C] - belum mengisi laporan

  Silahkan mengisi laporan anda sekarang di link monev maganghub:
  https://[link-monev-maganghub]
  ```

---

### 3.2. Konfigurasi Jadwal Reminder Peserta (Bulk Setting)
* **Aksesibilitas**: Fitur konfigurasi hanya dapat diatur melalui akun Admin spesifik berdasarkan **Email terdaftar**.
* **Parameter Pengaturan**:
  1. **Jam Mulai (Start Time)**: Menentukan waktu jam dimulainya trigger pengiriman notifikasi (contoh: `08:00 WIB`).
  2. **Interval / Jarak Reminder**: Jarak waktu pengulangan antar reminder (contoh: setiap `2 jam`, `4 jam`, atau `1 hari`).
  3. **Target Receiver**: Daftar nomor WhatsApp / grup pengawas yang dituju.

---

### 3.3. Fitur Warning Session Cookie Peserta
* **Fungsi**: Memantau masa aktif *session cookie* peserta dan memberikan notifikasi peringatan jika cookie akan habis atau sudah habis.
* **Konfigurasi Akun Admin**:
  1. **Jumlah Pengulangan (Reminder Count)**: Menentukan berapa kali notifikasi peringatan cookie dikirimkan.
  2. **Interval / Jarak Warning**: Pengaturan durasi antar notifikasi warning cookie.
* **Format Pesan WhatsApp (Cookie Warning List)**:
  ```text
  Daftar peserta yang masa aktif cookie-nya sudah habis / mau habis:
  - [Nama Peserta A] - session cookie sudah habis, silahkan perbarui cookie
  - [Nama Peserta B] - session cookie mau habis, silahkan perbarui cookie

  Silahkan perbarui cookie anda melalui link berikut:
  https://[link-hub-reminder]
  ```

---

## 4. Diagram Alir / Workflow Sederhana

1. **Trigger Pengisian Laporan**:
   * System mengecek database pengisian laporan berdasarkan *Jam Mulai* & *Interval*.
   * Admin memilih mode: **Single** atau **Bulk**.
   * Jika **Bulk**: System membentuk pesan tunggal berisi daftar peserta yang belum isi laporan -> Kirim notifikasi WhatsApp.

2. **Trigger Warning Cookie**:
   * System melakukan validasi status *Session Cookie* peserta secara periodik.
   * Jika ada cookie *expired* / *expiring soon*: System mengecek *Batas Pengulangan* & *Interval*.
   * Mengirimkan notifikasi list cookie warning ke WhatsApp dengan tautan pengarah ke **Hub Reminder**.

---

## 5. Persyaratan Non-Fungsional (Non-Functional Requirements)

* **Keamanan & Autentikasi**:
  * Pengaturan jadwal dan parameter hanya disajikan untuk akun email terotorisasi (Admin Level).
  * Link menuju hub reminder dan monev maganghub harus menggunakan protokol HTTPS aman.
* **Performa & Keandalan**:
  * Integrasi API WhatsApp Gateway harus mendukung penanganan *batch message* tanpa terkena rate-limiting/spam block.
* **User Interface / User Experience (UI/UX)**:
  * Terdapat dropdown atau radio button pilihan mode reminder pada panel settings dashboard.

---

## 6. Kriteria Penerimaan (Acceptance Criteria)

- [ ] User dapat memilih antara mode reminder lama (Single) dan mode reminder baru (Bulk).
- [ ] Pengaturan jam mulai dan interval reminder laporan tersimpan dan berjalan sesuai jadwal akun email Admin.
- [ ] Pesan notifikasi bulk WhatsApp berhasil memuat daftar nama peserta yang belum mengisi laporan beserta link Monev Maganghub.
- [ ] Admin dapat menentukan jumlah batas pengulangan dan interval untuk Warning Session Cookie.
- [ ] Pesan warning cookie terkirim sesuai kriteria peserta yang cookie-nya kedaluwarsa/mau kedaluwarsa beserta link pengarah ke Hub Reminder.