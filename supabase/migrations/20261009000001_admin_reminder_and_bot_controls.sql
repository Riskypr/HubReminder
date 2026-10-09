-- Tambahkan aksi untuk mengaktifkan dan menonaktifkan reminder bersama dan bot WhatsApp
alter table public.system_reminder_settings
  add column if not exists reminder_together_enabled boolean not null default true,
  add column if not exists wa_bot_enabled boolean not null default true;
