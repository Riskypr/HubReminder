-- Audit trail pengiriman reminder grup WhatsApp melalui Foonte.
create table if not exists public.reminder_logs (
  id uuid primary key default gen_random_uuid(),
  sent_at timestamptz not null default now(),
  status text not null check (status in ('sent', 'failed')),
  recipient text not null,
  member_count integer not null default 0 check (member_count >= 0),
  provider_status integer,
  provider_response text
);

create index if not exists idx_reminder_logs_sent_at on public.reminder_logs (sent_at desc);
alter table public.reminder_logs enable row level security;
