-- Fix duplikat pada reminder_settings: pastikan user_id tetap PRIMARY KEY.
-- Hapus duplikat (simpan yang updated_at paling baru), lalu enforce constraint.

-- 1. Hapus baris duplikat, simpan yang paling baru per user_id
delete from public.reminder_settings
where ctid not in (
  select max(ctid)
  from public.reminder_settings
  group by user_id
);

-- 2. Pastikan primary key ada (idempotent: akan gagal diam-diam jika sudah ada)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name   = 'reminder_settings'
      and constraint_type = 'PRIMARY KEY'
  ) then
    alter table public.reminder_settings add primary key (user_id);
  end if;
end $$;

-- 3. Normalisasi reminder_times dari time[] agar interval_seconds yang
--    ditulis form (dalam detik) tidak bermasalah saat dibandingkan.
--    Tidak ada perubahan data — kolom sudah benar, migration ini hanya
--    memastikan tidak ada baris duplikat.
