-- Pisahkan kuota reminder push dari pengiriman reminder grup WhatsApp.
alter table public.notification_logs
  add column if not exists channel text not null default 'push'
    constraint notification_logs_channel_check
      check (channel in ('push', 'whatsapp'));

create index if not exists idx_notification_logs_channel_user_sent_at
  on public.notification_logs (channel, user_id, sent_at desc);
