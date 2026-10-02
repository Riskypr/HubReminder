-- Use the app's WIB default for profiles created after this migration.
alter table public.profiles
  alter column timezone set default 'Asia/Jakarta';
