-- Tambahkan pengaturan untuk menonaktifkan reminder WhatsApp pada akhir pekan (Sabtu & Minggu)
alter table public.system_reminder_settings
  add column if not exists weekend_reminder_enabled boolean not null default false;
