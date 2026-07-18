create extension if not exists pgcrypto;

alter table public.jira_connections
  add column if not exists cloud_id text,
  add column if not exists display_name text,
  add column if not exists account_id text,
  add column if not exists board_id integer,
  add column if not exists active_sprint_id text,
  add column if not exists active_sprint_name text,
  add column if not exists auth_type text not null default 'manual',
  add column if not exists last_error text;

alter table public.jira_issues
  add column if not exists jira_issue_id text,
  add column if not exists issue_type text,
  add column if not exists priority text,
  add column if not exists url text,
  add column if not exists parent_key text;

create table if not exists public.jira_oauth_tokens (
  connection_id uuid primary key references public.jira_connections(id) on delete cascade,
  access_token text not null,
  refresh_token text,
  token_type text not null default 'Bearer',
  scopes text[] not null default '{}'::text[],
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jira_oauth_states (
  state text primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  persona_id text not null references public.profiles(id) on delete cascade,
  jira_site text,
  project_key text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.jira_oauth_tokens enable row level security;
alter table public.jira_oauth_states enable row level security;

create index if not exists jira_connections_cloud_idx
  on public.jira_connections (cloud_id);

create index if not exists jira_connections_board_idx
  on public.jira_connections (board_id);

create index if not exists jira_issues_project_jira_issue_id_idx
  on public.jira_issues (project_id, jira_issue_id);

create index if not exists jira_issues_jira_assignee_idx
  on public.jira_issues (jira_assignee_id);

create index if not exists jira_oauth_states_expires_idx
  on public.jira_oauth_states (expires_at);

analyze public.jira_connections;
analyze public.jira_issues;
analyze public.jira_oauth_tokens;
analyze public.jira_oauth_states;
