drop policy if exists "sprints_update_project_manager" on public.sprints;
create policy "sprints_update_project_manager"
  on public.sprints
  for update
  using (public.can_manage_sprintpulse_project(project_id))
  with check (public.can_manage_sprintpulse_project(project_id));

create index if not exists sprints_project_status_dates_idx
  on public.sprints (project_id, status, start_date, end_date);
