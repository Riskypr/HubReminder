-- Migration: Add 'waiting_approval' to wa_report_sessions status check constraint
-- Memungkinkan status draf laporan yang menunggu persetujuan (approval) sebelum submit ke MagangHub

alter table public.wa_report_sessions drop constraint if exists wa_report_sessions_status_check;
alter table public.wa_report_sessions add constraint wa_report_sessions_status_check
  check (status in ('waiting_input', 'generating', 'waiting_approval', 'submitting', 'submitted', 'failed'));
