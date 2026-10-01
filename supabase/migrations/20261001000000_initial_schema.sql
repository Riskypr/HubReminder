-- supabase/migrations/20261001000000_initial_schema.sql
-- HubReminder Initial Schema Migration

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 1. Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  timezone text not null default 'Asia/Makassar',
  created_at timestamptz not null default now()
);

-- 2. MagangHub Sessions (Encrypted session cookie)
create table if not exists public.maganghub_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  encrypted_cookie text not null,
  status text not null default 'unverified' check (status in ('valid', 'expired', 'unverified')),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Attendance Checks
create table if not exists public.attendance_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  checked_at timestamptz not null default now(),
  status text not null check (status in ('belum_lapor', 'selesai', 'unknown', 'session_expired')),
  detected_via text
);

create index if not exists idx_attendance_checks_user_checked_at
  on public.attendance_checks (user_id, checked_at desc);

-- 4. Reminder Settings
create table if not exists public.reminder_settings (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  enabled boolean not null default true,
  max_reminders_per_day int not null default 5,
  interval_minutes int not null default 60,
  active_start_time time not null default '07:00',
  active_end_time time not null default '21:00',
  snooze_until date,
  updated_at timestamptz not null default now()
);

-- 5. Push Subscriptions
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subs_user on public.push_subscriptions (user_id);

-- 6. Notification Logs
create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  sent_at timestamptz not null default now(),
  status_at_send text not null check (status_at_send in ('belum_lapor', 'session_expired')),
  sequence_today int not null default 1
);

create index if not exists idx_notification_logs_user_sent_at
  on public.notification_logs (user_id, sent_at desc);

-- Automatic Profile and Default Reminder Settings on Signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');

  insert into public.reminder_settings (user_id)
  values (new.id);

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enable Row Level Security (RLS) on all tables
alter table public.profiles enable row level security;
alter table public.maganghub_sessions enable row level security;
alter table public.attendance_checks enable row level security;
alter table public.reminder_settings enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_logs enable row level security;

-- RLS Policies

-- Profiles
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- MagangHub Sessions
create policy "Users can view own session status"
  on public.maganghub_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own session"
  on public.maganghub_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own session"
  on public.maganghub_sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete own session"
  on public.maganghub_sessions for delete
  using (auth.uid() = user_id);

-- Attendance Checks (Read-only for authenticated user, insert by service_role)
create policy "Users can read own attendance checks"
  on public.attendance_checks for select
  using (auth.uid() = user_id);

-- Reminder Settings
create policy "Users can read own reminder settings"
  on public.reminder_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert own reminder settings"
  on public.reminder_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own reminder settings"
  on public.reminder_settings for update
  using (auth.uid() = user_id);

-- Push Subscriptions
create policy "Users can read own push subscriptions"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can insert own push subscriptions"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own push subscriptions"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

-- Notification Logs (Read-only for user)
create policy "Users can read own notification logs"
  on public.notification_logs for select
  using (auth.uid() = user_id);
