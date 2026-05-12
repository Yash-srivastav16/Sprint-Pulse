create index if not exists profiles_auth_user_id_idx
  on public.profiles (auth_user_id);

create index if not exists profiles_auth_persona_idx
  on public.profiles (auth_user_id, product_persona);

create index if not exists profiles_product_persona_idx
  on public.profiles (product_persona);

create index if not exists profiles_lower_email_idx
  on public.profiles (lower(email));

create index if not exists projects_created_by_idx
  on public.projects (created_by);

create index if not exists projects_created_at_idx
  on public.projects (created_at desc);

create index if not exists projects_lower_key_idx
  on public.projects (lower(key));

create index if not exists sprints_project_id_idx
  on public.sprints (project_id);

create index if not exists sprints_project_status_idx
  on public.sprints (project_id, status);

create index if not exists project_members_profile_id_idx
  on public.project_members (profile_id);

create index if not exists project_members_profile_project_idx
  on public.project_members (profile_id, project_id);

create index if not exists project_members_project_role_idx
  on public.project_members (project_id, role);

analyze public.profiles;
analyze public.projects;
analyze public.sprints;
analyze public.project_members;
