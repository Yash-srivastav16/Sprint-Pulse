-- Per-project webhook tokens for the Teams transcript webhook (and future
-- inbound webhooks). Plaintext is shown once at mint time and never again;
-- only the SHA-256 hash is stored.

create extension if not exists pgcrypto;

create table if not exists public.project_webhook_tokens (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  token_hash text not null,
  token_hint text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  created_by_profile_id text references public.profiles(id) on delete set null,
  revoked_at timestamptz
);

create unique index if not exists project_webhook_tokens_hash_unique
  on public.project_webhook_tokens (token_hash);
create index if not exists project_webhook_tokens_project_idx
  on public.project_webhook_tokens (project_id, revoked_at);

-- The service-role key (used by the API) bypasses RLS. The web UI never reads
-- these rows directly — all reads go through the Express API. Even so, enable
-- RLS and add a deny-all default so a stray anon-key read can't dump tokens.
alter table public.project_webhook_tokens enable row level security;

drop policy if exists "project_webhook_tokens_no_anon_read" on public.project_webhook_tokens;
create policy "project_webhook_tokens_no_anon_read"
  on public.project_webhook_tokens
  for select
  using (false);

drop policy if exists "project_webhook_tokens_no_anon_write" on public.project_webhook_tokens;
create policy "project_webhook_tokens_no_anon_write"
  on public.project_webhook_tokens
  for all
  using (false)
  with check (false);
