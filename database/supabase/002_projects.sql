create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  source text not null default 'manual',
  jira_site text,
  created_by text not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sync_at timestamptz
);

create table if not exists public.sprints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  goal text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  profile_id text not null references public.profiles(id) on delete cascade,
  role text not null,
  jira_account_id text,
  github_username text,
  created_at timestamptz not null default now(),
  primary key (project_id, profile_id)
);

alter table public.projects enable row level security;
alter table public.sprints enable row level security;
alter table public.project_members enable row level security;

create or replace function public.can_create_sprintpulse_project(creator_profile_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = creator_profile_id
      and profile.auth_user_id = auth.uid()
      and profile.product_persona in ('scrum-master', 'engineering-manager')
  )
$$;

grant execute on function public.can_create_sprintpulse_project(text) to authenticated;

create or replace function public.can_view_sprintpulse_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_sprintpulse_persona() in ('product-owner', 'scrum-master', 'engineering-manager', 'qa-lead')
    or exists (
      select 1
      from public.project_members member
      join public.profiles profile on profile.id = member.profile_id
      where member.project_id = target_project_id
        and profile.auth_user_id = auth.uid()
    )
$$;

grant execute on function public.can_view_sprintpulse_project(uuid) to authenticated;

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
    join public.profiles profile on profile.id = project.created_by
    where project.id = target_project_id
      and profile.auth_user_id = auth.uid()
      and profile.product_persona in ('scrum-master', 'engineering-manager')
  )
$$;

grant execute on function public.can_manage_sprintpulse_project(uuid) to authenticated;

drop policy if exists "projects_select_member_or_elevated" on public.projects;
create policy "projects_select_member_or_elevated"
  on public.projects
  for select
  using (public.can_view_sprintpulse_project(projects.id));

drop policy if exists "projects_insert_scrum_or_manager" on public.projects;
create policy "projects_insert_scrum_or_manager"
  on public.projects
  for insert
  with check (public.can_create_sprintpulse_project(created_by));

drop policy if exists "sprints_select_visible_project" on public.sprints;
create policy "sprints_select_visible_project"
  on public.sprints
  for select
  using (public.can_view_sprintpulse_project(sprints.project_id));

drop policy if exists "sprints_insert_project_creator" on public.sprints;
create policy "sprints_insert_project_creator"
  on public.sprints
  for insert
  with check (public.can_manage_sprintpulse_project(sprints.project_id));

drop policy if exists "project_members_select_visible_project" on public.project_members;
create policy "project_members_select_visible_project"
  on public.project_members
  for select
  using (public.can_view_sprintpulse_project(project_members.project_id));

drop policy if exists "project_members_insert_project_creator" on public.project_members;
create policy "project_members_insert_project_creator"
  on public.project_members
  for insert
  with check (public.can_manage_sprintpulse_project(project_members.project_id));

insert into public.project_members (project_id, profile_id, role)
select
  project.id,
  project.created_by,
  case profile.product_persona
    when 'product-owner' then 'product-owner'
    when 'scrum-master' then 'scrum-master'
    when 'engineering-manager' then 'engineering-manager'
    when 'qa-lead' then 'qa'
    else 'developer'
  end
from public.projects project
join public.profiles profile on profile.id = project.created_by
where not exists (
  select 1
  from public.project_members member
  where member.project_id = project.id
    and member.profile_id = project.created_by
);
