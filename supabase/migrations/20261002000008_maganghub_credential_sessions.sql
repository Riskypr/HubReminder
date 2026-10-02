-- Replace encrypted browser-cookie storage with separately encrypted auth tokens.
alter table public.maganghub_sessions
  rename column encrypted_cookie to encrypted_session;

alter table public.maganghub_sessions
  add column encrypted_refresh_token text;

comment on column public.maganghub_sessions.encrypted_session is
  'Encrypted MagangHub access token/session; plaintext is server-only.';
comment on column public.maganghub_sessions.encrypted_refresh_token is
  'Encrypted MagangHub refresh token; plaintext is server-only.';
