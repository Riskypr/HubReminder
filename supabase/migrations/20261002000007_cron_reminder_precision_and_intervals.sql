-- cron-job.org checks once per minute, so seconds-level reminder times are not actionable.
update public.reminder_settings as settings
set reminder_times = (
  select array_agg(time_value order by time_value)
  from (
    select distinct make_time(
      extract(hour from scheduled_time)::integer,
      extract(minute from scheduled_time)::integer,
      0
    ) as time_value
    from unnest(settings.reminder_times) as configured_times(scheduled_time)
  ) as minute_times
);

-- Replace the old test-only 15-second interval with the minimum supported cron cadence.
alter table public.reminder_settings
  drop constraint if exists reminder_settings_interval_seconds_check;

update public.reminder_settings
set interval_seconds = 900
where interval_seconds = 15;

update public.reminder_settings
set interval_minutes = ceil(interval_seconds::numeric / 60)::integer;

alter table public.reminder_settings
  add constraint reminder_settings_interval_seconds_check
    check (interval_seconds in (900, 1800, 3600, 5400, 7200, 10800, 14400));
