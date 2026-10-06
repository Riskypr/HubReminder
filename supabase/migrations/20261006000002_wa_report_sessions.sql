-- Tracking sesi percakapan WA untuk auto-fill laporan via Gemini AI.
-- Mapping nomor WA ke user_id dilakukan otomatis saat user pertama kali
-- membalas pesan reminder di grup.

-- 1. Mapping nomor WA ke user_id
create table if not exists public.wa_phone_mappings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_number text not null,
  linked_at timestamptz not null default now(),
  unique (phone_number)
);
create index if not exists idx_wa_phone_mappings_phone
  on public.wa_phone_mappings (phone_number);
create index if not exists idx_wa_phone_mappings_user
  on public.wa_phone_mappings (user_id);
alter table public.wa_phone_mappings enable row level security;

-- 2. Sesi laporan WA (satu per user per hari)
create table if not exists public.wa_report_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wa_number text not null,
  report_date date not null default current_date,
  user_input text,
  generated_report jsonb,
  status text not null default 'waiting_input'
    check (status in ('waiting_input', 'generating', 'submitting', 'submitted', 'failed')),
  error_message text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, report_date)
);
create index if not exists idx_wa_report_sessions_user_date
  on public.wa_report_sessions (user_id, report_date desc);
create index if not exists idx_wa_report_sessions_wa_number
  on public.wa_report_sessions (wa_number, report_date desc);
alter table public.wa_report_sessions enable row level security;
