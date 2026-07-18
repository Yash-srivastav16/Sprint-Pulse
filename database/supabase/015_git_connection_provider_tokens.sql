alter table public.git_connections
  add column if not exists base_url text,
  add column if not exists token_ciphertext text,
  add column if not exists token_nonce text,
  add column if not exists token_tag text,
  add column if not exists token_status text not null default 'unchecked',
  add column if not exists last_verified_at timestamptz,
  add column if not exists last_error text;

do $$
begin
  alter table public.git_connections
    add constraint git_connections_provider_check check (provider in ('github', 'gitlab'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.git_connections
    add constraint git_connections_token_status_check check (token_status in ('valid', 'invalid', 'revoked', 'unchecked'));
exception
  when duplicate_object then null;
end $$;
