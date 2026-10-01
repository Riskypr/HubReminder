-- supabase/migrations/20261001000002_add_profile_maganghub_fields.sql
-- Tambah field profil dari MagangHub untuk sinkronisasi otomatis via Backend Proxy

alter table public.profiles
  add column if not exists company_name text,
  add column if not exists photo_url text,
  add column if not exists internship_period text,
  add column if not exists participant_status text,
  add column if not exists maganghub_synced_at timestamptz;
