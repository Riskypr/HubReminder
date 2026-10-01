-- supabase/migrations/20261001000001_cron_schedule.sql
-- Setup pg_cron untuk menjalankan Edge Function check-attendance secara berkala (misal: setiap 15 menit)

-- Note: Membutuhkan ekstensi pg_net dan pg_cron yang aktif di Supabase Dashboard
create extension if not exists "pg_net";
create extension if not exists "pg_cron";

-- Schedule job setiap 15 menit (sesuai Rules.md batasan beban polling wajar)
-- Ganti YOUR_SUPABASE_PROJECT_REF dan YOUR_ANON_OR_SERVICE_ROLE_KEY di Supabase SQL Editor
/*
select cron.schedule(
  'check-maganghub-attendance-every-15m',
  '0/15 * * * *',
  $$
  select
    net.http_post(
      url:='https://YOUR_SUPABASE_PROJECT_REF.supabase.co/functions/v1/check-attendance',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
      ),
      body:=jsonb_build_object('source', 'pg_cron')
    ) as request_id;
  $$
);
*/
