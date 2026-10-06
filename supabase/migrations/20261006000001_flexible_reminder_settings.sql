-- Pengaturan reminder lintas pengguna dikelola server dan dibatasi ke admin lewat API.
create table if not exists public.system_reminder_settings (
  id boolean primary key default true check (id),
  reminder_mode text not null default 'bulk' check (reminder_mode in ('single', 'bulk')),
  start_time time not null default '08:00',
  interval_seconds integer not null default 7200 check (interval_seconds in (900, 1800, 3600, 5400, 7200, 10800, 14400)),
  cookie_warning_count integer not null default 3 check (cookie_warning_count between 1 and 20),
  cookie_warning_interval_minutes integer not null default 60 check (cookie_warning_interval_minutes between 15 and 1440),
  updated_at timestamptz not null default now()
);

insert into public.system_reminder_settings (id) values (true) on conflict (id) do nothing;
alter table public.system_reminder_settings enable row level security;

create table if not exists public.cookie_warning_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now(),
  session_updated_at timestamptz not null,
  status text not null check (status in ('sent', 'failed')),
  provider_status integer,
  provider_response text
);
create index if not exists idx_cookie_warning_logs_user_sent_at
  on public.cookie_warning_logs (user_id, sent_at desc);
alter table public.cookie_warning_logs enable row level security;
