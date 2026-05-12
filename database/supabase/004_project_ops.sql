create extension if not exists pgcrypto;

with ranked_active_sprints as (
  select
    id,
    row_number() over (partition by project_id order by created_at desc, id desc) as sprint_rank
  from public.sprints
  where status = 'active'
)
update public.sprints
set status = 'closed', updated_at = now()
where id in (
  select id
  from ranked_active_sprints
  where sprint_rank > 1
);

create unique index if not exists sprints_one_active_per_project_idx
  on public.sprints (project_id)
  where status = 'active';

drop policy if exists "profiles_insert_invited_by_elevated" on public.profiles;
create policy "profiles_insert_invited_by_elevated"
  on public.profiles
  for insert
  with check (
    auth_user_id is null
    and status = 'invited'
    and public.current_sprintpulse_persona() in ('product-owner', 'scrum-master', 'engineering-manager')
  );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  using (
    auth.uid() = auth_user_id
    or (
      auth_user_id is null
      and status = 'invited'
      and lower(email) = lower(auth.jwt() ->> 'email')
    )
  )
  with check (
    auth.uid() = auth_user_id
    and lower(email) = lower(auth.jwt() ->> 'email')
  );

create or replace function public.can_manage_sprintpulse_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects project
    left join public.project_members member
      on member.project_id = project.id
      and member.profile_id = public.current_sprintpulse_profile_id()
    where project.id = target_project_id
      and (
        project.created_by = public.current_sprintpulse_profile_id()
        or member.role in ('product-owner', 'scrum-master', 'engineering-manager')
      )
      and public.current_sprintpulse_persona() in ('product-owner', 'scrum-master', 'engineering-manager')
  )
$$;

grant execute on function public.can_manage_sprintpulse_project(uuid) to authenticated;

create table if not exists public.standups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  sprint_id uuid references public.sprints(id) on delete set null,
  profile_id text not null references public.profiles(id) on delete cascade,
  date date not null default current_date,
  yesterday text not null,
  today text not null,
  blockers text not null default 'No blocker.',
  source text not null default 'manual',
  source_ref text,
  parsed_confidence numeric(4, 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source text not null,
  status text not null,
  requested_by text not null references public.profiles(id) on delete restrict,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  stats jsonb not null default '{}'::jsonb,
  error_message text
);

create table if not exists public.jira_connections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  site_url text not null,
  project_key text not null,
  status text not null default 'configured',
  created_by text not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sync_at timestamptz
);

create table if not exists public.jira_issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  sprint_id uuid references public.sprints(id) on delete set null,
  issue_key text not null,
  summary text not null,
  status text not null,
  assignee_profile_id text references public.profiles(id) on delete set null,
  jira_assignee_id text,
  story_points numeric(5, 2),
  updated_at_source timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, issue_key)
);

create table if not exists public.git_connections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  provider text not null default 'github',
  repo_owner text not null,
  repo_name text not null,
  default_branch text not null default 'main',
  status text not null default 'configured',
  created_by text not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sync_at timestamptz
);

create table if not exists public.git_commits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  sprint_id uuid references public.sprints(id) on delete set null,
  sha text not null,
  author_profile_id text references public.profiles(id) on delete set null,
  author_email text not null,
  message text not null,
  committed_at timestamptz not null,
  additions integer not null default 0,
  deletions integer not null default 0,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (project_id, sha)
);

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  sprint_id uuid references public.sprints(id) on delete set null,
  profile_id text references public.profiles(id) on delete cascade,
  kind text not null,
  severity text not null,
  title text not null,
  message text not null,
  inputs jsonb not null default '{}'::jsonb,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  email text not null,
  role text not null,
  invited_by text not null references public.profiles(id) on delete restrict,
  status text not null default 'pending',
  token_hash text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (project_id, email)
);

drop policy if exists "project_members_update_project_manager" on public.project_members;
create policy "project_members_update_project_manager"
  on public.project_members
  for update
  using (public.can_manage_sprintpulse_project(project_id))
  with check (public.can_manage_sprintpulse_project(project_id));

drop policy if exists "project_members_delete_project_manager" on public.project_members;
create policy "project_members_delete_project_manager"
  on public.project_members
  for delete
  using (public.can_manage_sprintpulse_project(project_id));

drop policy if exists "projects_update_project_manager" on public.projects;
create policy "projects_update_project_manager"
  on public.projects
  for update
  using (public.can_manage_sprintpulse_project(projects.id))
  with check (public.can_manage_sprintpulse_project(projects.id));

alter table public.standups enable row level security;
alter table public.sync_runs enable row level security;
alter table public.jira_connections enable row level security;
alter table public.jira_issues enable row level security;
alter table public.git_connections enable row level security;
alter table public.git_commits enable row level security;
alter table public.recommendations enable row level security;
alter table public.project_invites enable row level security;

drop policy if exists "standups_select_visible_project" on public.standups;
create policy "standups_select_visible_project"
  on public.standups
  for select
  using (public.can_view_sprintpulse_project(project_id));

drop policy if exists "standups_insert_own_or_manager" on public.standups;
create policy "standups_insert_own_or_manager"
  on public.standups
  for insert
  with check (
    public.can_view_sprintpulse_project(project_id)
    and (
      profile_id = public.current_sprintpulse_profile_id()
      or public.can_manage_sprintpulse_project(project_id)
    )
  );

drop policy if exists "sync_runs_select_visible_project" on public.sync_runs;
create policy "sync_runs_select_visible_project"
  on public.sync_runs
  for select
  using (public.can_view_sprintpulse_project(project_id));

drop policy if exists "sync_runs_insert_manager" on public.sync_runs;
create policy "sync_runs_insert_manager"
  on public.sync_runs
  for insert
  with check (public.can_manage_sprintpulse_project(project_id));

drop policy if exists "jira_connections_select_visible_project" on public.jira_connections;
create policy "jira_connections_select_visible_project"
  on public.jira_connections
  for select
  using (public.can_view_sprintpulse_project(project_id));

drop policy if exists "jira_connections_insert_manager" on public.jira_connections;
create policy "jira_connections_insert_manager"
  on public.jira_connections
  for insert
  with check (public.can_manage_sprintpulse_project(project_id));

drop policy if exists "jira_connections_update_manager" on public.jira_connections;
create policy "jira_connections_update_manager"
  on public.jira_connections
  for update
  using (public.can_manage_sprintpulse_project(project_id))
  with check (public.can_manage_sprintpulse_project(project_id));

drop policy if exists "jira_issues_select_visible_project" on public.jira_issues;
create policy "jira_issues_select_visible_project"
  on public.jira_issues
  for select
  using (public.can_view_sprintpulse_project(project_id));

drop policy if exists "jira_issues_write_manager" on public.jira_issues;
create policy "jira_issues_write_manager"
  on public.jira_issues
  for all
  using (public.can_manage_sprintpulse_project(project_id))
  with check (public.can_manage_sprintpulse_project(project_id));

drop policy if exists "git_connections_select_visible_project" on public.git_connections;
create policy "git_connections_select_visible_project"
  on public.git_connections
  for select
  using (public.can_view_sprintpulse_project(project_id));

drop policy if exists "git_connections_insert_manager" on public.git_connections;
create policy "git_connections_insert_manager"
  on public.git_connections
  for insert
  with check (public.can_manage_sprintpulse_project(project_id));

drop policy if exists "git_connections_update_manager" on public.git_connections;
create policy "git_connections_update_manager"
  on public.git_connections
  for update
  using (public.can_manage_sprintpulse_project(project_id))
  with check (public.can_manage_sprintpulse_project(project_id));

drop policy if exists "git_commits_select_visible_project" on public.git_commits;
create policy "git_commits_select_visible_project"
  on public.git_commits
  for select
  using (public.can_view_sprintpulse_project(project_id));

drop policy if exists "git_commits_write_manager" on public.git_commits;
create policy "git_commits_write_manager"
  on public.git_commits
  for all
  using (public.can_manage_sprintpulse_project(project_id))
  with check (public.can_manage_sprintpulse_project(project_id));

drop policy if exists "recommendations_select_visible_project" on public.recommendations;
create policy "recommendations_select_visible_project"
  on public.recommendations
  for select
  using (
    public.can_view_sprintpulse_project(project_id)
    and (
      public.current_sprintpulse_persona() in ('product-owner', 'scrum-master', 'engineering-manager', 'qa-lead')
      or profile_id is null
      or profile_id = public.current_sprintpulse_profile_id()
    )
  );

drop policy if exists "recommendations_write_manager" on public.recommendations;
create policy "recommendations_write_manager"
  on public.recommendations
  for all
  using (public.can_manage_sprintpulse_project(project_id))
  with check (public.can_manage_sprintpulse_project(project_id));

drop policy if exists "project_invites_select_visible_project" on public.project_invites;
create policy "project_invites_select_visible_project"
  on public.project_invites
  for select
  using (public.can_view_sprintpulse_project(project_id));

drop policy if exists "project_invites_write_manager" on public.project_invites;
create policy "project_invites_write_manager"
  on public.project_invites
  for all
  using (public.can_manage_sprintpulse_project(project_id))
  with check (public.can_manage_sprintpulse_project(project_id));

create index if not exists standups_project_sprint_date_idx
  on public.standups (project_id, sprint_id, date desc);

create index if not exists standups_profile_date_idx
  on public.standups (profile_id, date desc);

create index if not exists sync_runs_project_source_started_idx
  on public.sync_runs (project_id, source, started_at desc);

create index if not exists jira_issues_project_sprint_status_idx
  on public.jira_issues (project_id, sprint_id, status);

create index if not exists jira_issues_assignee_idx
  on public.jira_issues (assignee_profile_id);

create index if not exists git_commits_project_sprint_author_idx
  on public.git_commits (project_id, sprint_id, author_profile_id);

create index if not exists git_commits_committed_at_idx
  on public.git_commits (committed_at desc);

create index if not exists recommendations_project_sprint_profile_idx
  on public.recommendations (project_id, sprint_id, profile_id);

create index if not exists project_invites_project_status_idx
  on public.project_invites (project_id, status);

create index if not exists project_invites_lower_email_idx
  on public.project_invites (lower(email));

analyze public.standups;
analyze public.sync_runs;
analyze public.jira_connections;
analyze public.jira_issues;
analyze public.git_connections;
analyze public.git_commits;
analyze public.recommendations;
analyze public.project_invites;
