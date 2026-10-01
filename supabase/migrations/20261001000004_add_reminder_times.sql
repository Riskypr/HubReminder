-- Ganti rentang jam aktif dengan daftar waktu reminder per pengguna.
-- Nilai interval harus selaras dengan pilihan pada ReminderSettingsForm:
-- 15 detik (uji coba), 15/30 menit, serta 1/1,5/2 jam.
alter table public.reminder_settings
  add column if not exists interval_seconds integer not null default 3600
    constraint reminder_settings_interval_seconds_check
      check (interval_seconds in (15, 900, 1800, 3600, 5400, 7200)),
  add column if not exists reminder_times time[] not null default array['07:00'::time];

-- Pertahankan interval yang telah dipilih pengguna pada skema lama
-- (interval_minutes), lalu simpan dalam satuan detik yang dipakai frontend.
update public.reminder_settings
set interval_seconds = interval_minutes * 60
where interval_seconds = 3600 and interval_minutes <> 60;
