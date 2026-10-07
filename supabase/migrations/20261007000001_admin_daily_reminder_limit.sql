-- Tambahkan batas kirim reminder harian untuk admin (proteksi kuota Foonte)
-- dan perbaiki tabrakan jadwal antara pengaturan user vs admin.

alter table public.system_reminder_settings
  add column if not exists max_reminders_per_day integer not null default 10
    check (max_reminders_per_day between 1 and 50);
