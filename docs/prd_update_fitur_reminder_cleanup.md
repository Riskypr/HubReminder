# Product Requirement Document (PRD)

## 1. Overview
Dokumen ini mendefinisikan pembaruan sistem reminder otomatis untuk jadwal/aktivitas Maganghub dan pembersihan (refactoring) basis data serta basis kode. Pembaruan ini bertujuan untuk mengintegrasikan layanan pihak ketiga (**cron-job.org** & **Foonte**) guna mengirimkan pesan pengingat langsung ke grup WhatsApp, serta menyederhanakan arsitektur data agar tidak menyimpang dari fungsionalitas utama.

---

## 2. Goals & Objectives
1. **Otomatisasi Reminder**: Pengiriman pengingat berbasis jadwal harian/periodik menggunakan `cron-job.org` sebagai pemicu (trigger) webhook.
2. **Notifikasi WhatsApp Grup**: Mengirimkan notifikasi yang terformat rapi ke grup WhatsApp via API Foonte.
3. **Database & Code Refactoring**: Menghapus tabel, kolom, dan potongan kode legacy/tambahan yang tidak relevan dengan kebutuhan fitur saat ini.
4. **Dokumentasi Perubahan (Agent Handoff)**: Menyiapkan acuan terstruktur (`CHANGELOG.md`) untuk mempermudah AI Agent atau developer lain memahami konteks perubahan tanpa membaca keseluruhan isi direktori proyek.

---

## 3. Architecture & Integration Workflow

```
[ cron-job.org ] 
       │ (HTTP GET/POST Webhook + Secret API Key)
       ▼
[ Application API Endpoint: /api/cron/reminder ]
       │
       ├─► Validasi Request Header / Secret Token
       ├─► Fetch Data Profil & Maganghub dari DB / Service
       ├─► Format Pesan Notifikasi (Template)
       │
       ▼
[ Foonte API Endpoint: https://api.fonnte.com/send ]
       │ (POST payload: target=Group_ID, message=Text)
       ▼
[ WhatsApp Group ]
```

---

## 4. Technical Requirements & Specifications

### 4.1 Integration Specifications

#### A. Cron Job (cron-job.org)
* **Target URL**: `https://<your-domain>/api/cron/reminder`
* **Method**: `POST` atau `GET`
* **Security**: Header kustom `X-Cron-Secret: <SECRET_KEY>` untuk mencegah pemanggilan endpoint secara ilegal dari publik.
* **Frequency**: Disesuaikan (misal: Setiap hari pukul 07:00 WIB).

#### B. Foonte WhatsApp Gateway
* **Endpoint**: `https://api.fonnte.com/send`
* **Headers**: `Authorization: <FOONTE_TOKEN>`
* **Payload**:
  ```json
  {
    "target": "<WA_GROUP_ID>",
    "message": "*[REMINDER MAGANGHUB]*\n\nHallo Tim, berikut pembaruan status...",
    "countryCode": "62"
  }
  ```

---

### 4.2 Database & Code Base Refactoring
1. **Pembersihan Database**:
   * Hapus tabel atau kolom legacy yang tidak memiliki referensi aktif ke fitur Maganghub profile atau reminder.
   * Pertahankan hanya schema minimal:
     * `users` / `profile_cache` (Menyimpan data profil/sesi yang relevan)
     * `reminder_logs` (Opsional: logging status pengiriman Foonte untuk audit trail)
2. **Pembersihan Kode (Codebase Cleanup)**:
   * Hapus *file controller*, *route*, atau *helper function* yang dibuat untuk fitur uji coba yang tidak terpakai.
   * Pindahkan konfigurasi sensitif (Foonte Token, Group ID, Cron Secret) ke file `.env`.

---

## 5. Environment Variables (.env)
```env
# Foonte Configuration
FOONTE_API_TOKEN=your_foonte_token_here
# Group ID target (contoh: 120363012345678901@g.us). Bukan link undangan chat.whatsapp.com/
FOONTE_WA_GROUP_ID=your_target_group_id@g.us

# Cron Security
CRON_SECRET_KEY=your_secure_cron_secret_key
```

---

## 6. Non-Functional Requirements
* **Keamanan**: Kredensial Foonte dan Secret Token Cron tidak boleh ter-commit di repositori publik.
* **Reliabilitas**: Endpoint webhook cron harus memberikan respons HTTP `200 OK` dengan execution time < 5 detik.
* **Maintanability**: Menggunakan dokumentasi perubahan di `CHANGELOG.md` untuk mencatat setiap iterasi refactoring.