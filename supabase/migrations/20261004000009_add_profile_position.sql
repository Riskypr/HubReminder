-- supabase/migrations/20261004000009_add_profile_position.sql
-- Tambah kolom posisi/job role magang dari MagangHub

alter table public.profiles
  add column if not exists position text;
