begin;

-- Demo profiles use the same slug-from-email id convention as the app.
insert into public.profiles (
  id,
  auth_user_id,
  email,
  name,
  initials,
  title,
  app_role,
  product_persona,
  access_scope,
  status,
  created_at,
  invited_by
) values
  (
    'maya-chen',
    null,
    'maya.chen@sprintpulse.dev',
    'Maya Chen',
    'MC',
    'Scrum Master',
    'scrum-master',
    'scrum-master',
    'team',
    'active',
    '2026-04-01 09:00:00+00',
    null
  ),
  (
    'devon-reed',
    null,
    'devon.reed@sprintpulse.dev',
    'Devon Reed',
    'DR',
    'Engineering Manager',
    'engineering-manager',
    'engineering-manager',
    'team',
    'active',
    '2026-04-01 09:05:00+00',
    null
  ),
  (
    'priya-shah',
    null,
    'priya.shah@sprintpulse.dev',
    'Priya Shah',
    'PS',
    'Product Owner',
    'product-owner',
    'product-owner',
    'team',
    'active',
    '2026-04-01 09:10:00+00',
    null
  ),
  (
    'leo-martinez',
    null,
    'leo.martinez@sprintpulse.dev',
    'Leo Martinez',
    'LM',
    'Senior Full-Stack Developer',
    'developer',
    'developer',
    'individual',
    'active',
    '2026-04-01 09:15:00+00',
    null
  ),
  (
    'aisha-okafor',
    null,
    'aisha.okafor@sprintpulse.dev',
    'Aisha Okafor',
    'AO',
    'QA Lead',
    'qa-lead',
    'qa-lead',
    'quality',
    'active',
    '2026-04-01 09:20:00+00',
    null
  )
on conflict (id) do update set
  auth_user_id = excluded.auth_user_id,
  email = excluded.email,
  name = excluded.name,
  initials = excluded.initials,
  title = excluded.title,
  app_role = excluded.app_role,
  product_persona = excluded.product_persona,
  access_scope = excluded.access_scope,
  status = excluded.status,
  created_at = excluded.created_at,
  invited_by = excluded.invited_by;

-- Two realistic demo projects.
insert into public.projects (
  id,
  key,
  name,
  source,
  jira_site,
  created_by,
  created_at,
  updated_at,
  last_sync_at
) values
  (
    '11111111-1111-4111-8111-111111111111',
    'SPM',
    'SprintPulse Metrics',
    'jira',
    'https://sprintpulse-demo.atlassian.net',
    'maya-chen',
    '2026-04-07 10:00:00+00',
    '2026-05-12 07:40:00+00',
    '2026-05-12 07:35:00+00'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'OPS',
    'Ops Command Center',
    'jira',
    'https://sprintpulse-demo.atlassian.net',
    'devon-reed',
    '2026-04-14 10:00:00+00',
    '2026-05-12 07:30:00+00',
    '2026-05-12 07:10:00+00'
  )
on conflict (id) do update set
  key = excluded.key,
  name = excluded.name,
  source = excluded.source,
  jira_site = excluded.jira_site,
  created_by = excluded.created_by,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at,
  last_sync_at = excluded.last_sync_at;

-- Sprint history covers closed, active, and planned states.
insert into public.sprints (
  id,
  project_id,
  name,
  goal,
  start_date,
  end_date,
  status,
  created_at,
  updated_at
) values
  (
    '11111111-1111-4111-8111-000000000101',
    '11111111-1111-4111-8111-111111111111',
    'SPM Sprint 16 - Signal Quality',
    'Close the stale-work false positives and improve member confidence explanations.',
    '2026-04-14',
    '2026-04-25',
    'closed',
    '2026-04-10 12:00:00+00',
    '2026-04-25 18:00:00+00'
  ),
  (
    '11111111-1111-4111-8111-000000000102',
    '11111111-1111-4111-8111-111111111111',
    'SPM Sprint 17 - Risk Console',
    'Make the project dashboard actionable for blockers, say-do gaps, and quality risk.',
    '2026-04-28',
    '2026-05-09',
    'active',
    '2026-04-24 12:00:00+00',
    '2026-05-12 07:35:00+00'
  ),
  (
    '11111111-1111-4111-8111-000000000103',
    '11111111-1111-4111-8111-111111111111',
    'SPM Sprint 18 - Executive Rollup',
    'Package weekly delivery health summaries for product and engineering leadership.',
    '2026-05-12',
    '2026-05-23',
    'planned',
    '2026-05-08 12:00:00+00',
    '2026-05-08 12:00:00+00'
  ),
  (
    '22222222-2222-4222-8222-000000000201',
    '22222222-2222-4222-8222-222222222222',
    'OPS Sprint 8 - Alert Hygiene',
    'Retire noisy alert routes and document ownership for Sev2 escalation paths.',
    '2026-04-14',
    '2026-04-25',
    'closed',
    '2026-04-10 12:00:00+00',
    '2026-04-25 18:00:00+00'
  ),
  (
    '22222222-2222-4222-8222-000000000202',
    '22222222-2222-4222-8222-222222222222',
    'OPS Sprint 9 - Incident Readiness',
    'Harden release monitoring and finish the incident timeline workspace.',
    '2026-04-28',
    '2026-05-09',
    'active',
    '2026-04-24 12:00:00+00',
    '2026-05-12 07:10:00+00'
  ),
  (
    '22222222-2222-4222-8222-000000000203',
    '22222222-2222-4222-8222-222222222222',
    'OPS Sprint 10 - Runbook Automation',
    'Automate handoff checklists for deploy, rollback, and post-incident review.',
    '2026-05-12',
    '2026-05-23',
    'planned',
    '2026-05-08 12:00:00+00',
    '2026-05-08 12:00:00+00'
  )
on conflict (id) do update set
  project_id = excluded.project_id,
  name = excluded.name,
  goal = excluded.goal,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  status = excluded.status,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

-- Maya, Devon, and Leo are shared across both projects.
insert into public.project_members (
  project_id,
  profile_id,
  role,
  jira_account_id,
  github_username,
  created_at
) values
  ('11111111-1111-4111-8111-111111111111', 'maya-chen', 'scrum-master', 'jira-maya-chen', 'maya-chen-sp', '2026-04-07 10:15:00+00'),
  ('11111111-1111-4111-8111-111111111111', 'devon-reed', 'engineering-manager', 'jira-devon-reed', 'devonreed', '2026-04-07 10:16:00+00'),
  ('11111111-1111-4111-8111-111111111111', 'priya-shah', 'product-owner', 'jira-priya-shah', 'priyashah', '2026-04-07 10:17:00+00'),
  ('11111111-1111-4111-8111-111111111111', 'leo-martinez', 'developer', 'jira-leo-martinez', 'leomartinez', '2026-04-07 10:18:00+00'),
  ('11111111-1111-4111-8111-111111111111', 'aisha-okafor', 'qa', 'jira-aisha-okafor', 'aishaokafor', '2026-04-07 10:19:00+00'),
  ('22222222-2222-4222-8222-222222222222', 'devon-reed', 'engineering-manager', 'jira-devon-reed', 'devonreed', '2026-04-14 10:15:00+00'),
  ('22222222-2222-4222-8222-222222222222', 'maya-chen', 'scrum-master', 'jira-maya-chen', 'maya-chen-sp', '2026-04-14 10:16:00+00'),
  ('22222222-2222-4222-8222-222222222222', 'leo-martinez', 'architect', 'jira-leo-martinez', 'leomartinez', '2026-04-14 10:17:00+00'),
  ('22222222-2222-4222-8222-222222222222', 'aisha-okafor', 'qa', 'jira-aisha-okafor', 'aishaokafor', '2026-04-14 10:18:00+00')
on conflict (project_id, profile_id) do update set
  role = excluded.role,
  jira_account_id = excluded.jira_account_id,
  github_username = excluded.github_username,
  created_at = excluded.created_at;

-- Integration connections.
insert into public.jira_connections (
  id,
  project_id,
  site_url,
  project_key,
  status,
  created_by,
  created_at,
  updated_at,
  last_sync_at
) values
  (
    '11111111-1111-4111-8111-000000000301',
    '11111111-1111-4111-8111-111111111111',
    'https://sprintpulse-demo.atlassian.net',
    'SPM',
    'synced',
    'maya-chen',
    '2026-04-07 11:00:00+00',
    '2026-05-12 07:35:00+00',
    '2026-05-12 07:35:00+00'
  ),
  (
    '22222222-2222-4222-8222-000000000302',
    '22222222-2222-4222-8222-222222222222',
    'https://sprintpulse-demo.atlassian.net',
    'OPS',
    'synced',
    'devon-reed',
    '2026-04-14 11:00:00+00',
    '2026-05-12 07:10:00+00',
    '2026-05-12 07:10:00+00'
  )
on conflict (project_id) do update set
  site_url = excluded.site_url,
  project_key = excluded.project_key,
  status = excluded.status,
  created_by = excluded.created_by,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at,
  last_sync_at = excluded.last_sync_at;

insert into public.git_connections (
  id,
  project_id,
  provider,
  repo_owner,
  repo_name,
  default_branch,
  status,
  created_by,
  created_at,
  updated_at,
  last_sync_at
) values
  (
    '11111111-1111-4111-8111-000000000401',
    '11111111-1111-4111-8111-111111111111',
    'github',
    'sprintpulse',
    'metrics-service',
    'main',
    'synced',
    'maya-chen',
    '2026-04-07 11:05:00+00',
    '2026-05-12 07:25:00+00',
    '2026-05-12 07:25:00+00'
  ),
  (
    '22222222-2222-4222-8222-000000000402',
    '22222222-2222-4222-8222-222222222222',
    'github',
    'sprintpulse',
    'ops-command-center',
    'main',
    'synced',
    'devon-reed',
    '2026-04-14 11:05:00+00',
    '2026-05-12 07:05:00+00',
    '2026-05-12 07:05:00+00'
  )
on conflict (project_id) do update set
  provider = excluded.provider,
  repo_owner = excluded.repo_owner,
  repo_name = excluded.repo_name,
  default_branch = excluded.default_branch,
  status = excluded.status,
  created_by = excluded.created_by,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at,
  last_sync_at = excluded.last_sync_at;

-- Jira issues for the active sprint in each project.
insert into public.jira_issues (
  id,
  project_id,
  sprint_id,
  issue_key,
  summary,
  status,
  assignee_profile_id,
  jira_assignee_id,
  story_points,
  updated_at_source,
  raw,
  created_at,
  updated_at
) values
  (
    '11111111-1111-4111-8111-000000000501',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-000000000102',
    'SPM-124',
    'Explain stale-work confidence on member pulse cards',
    'Review',
    'leo-martinez',
    'jira-leo-martinez',
    5,
    '2026-05-12 06:55:00+00',
    '{"priority":"High","labels":["risk-console","pulse"]}'::jsonb,
    '2026-04-28 09:20:00+00',
    '2026-05-12 06:55:00+00'
  ),
  (
    '11111111-1111-4111-8111-000000000502',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-000000000102',
    'SPM-127',
    'Backfill Jira sync warnings into project ops timeline',
    'In Progress',
    'devon-reed',
    'jira-devon-reed',
    3,
    '2026-05-11 16:20:00+00',
    '{"priority":"Medium","labels":["jira","sync"]}'::jsonb,
    '2026-04-29 09:20:00+00',
    '2026-05-11 16:20:00+00'
  ),
  (
    '11111111-1111-4111-8111-000000000503',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-000000000102',
    'SPM-131',
    'Validate dashboard empty states for product owners',
    'Blocked',
    'aisha-okafor',
    'jira-aisha-okafor',
    2,
    '2026-05-08 14:10:00+00',
    '{"priority":"High","labels":["qa","dashboard"],"blockedBy":"Fixture mismatch"}'::jsonb,
    '2026-05-02 09:20:00+00',
    '2026-05-08 14:10:00+00'
  ),
  (
    '11111111-1111-4111-8111-000000000504',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-000000000102',
    'SPM-136',
    'Ship role-aware recommendation grouping',
    'Done',
    'priya-shah',
    'jira-priya-shah',
    3,
    '2026-05-10 18:45:00+00',
    '{"priority":"Medium","labels":["recommendations"]}'::jsonb,
    '2026-05-03 09:20:00+00',
    '2026-05-10 18:45:00+00'
  ),
  (
    '22222222-2222-4222-8222-000000000505',
    '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-000000000202',
    'OPS-82',
    'Capture deploy rollback checklist status in incident timeline',
    'In Progress',
    'leo-martinez',
    'jira-leo-martinez',
    8,
    '2026-05-12 06:05:00+00',
    '{"priority":"Critical","labels":["incident-readiness"]}'::jsonb,
    '2026-04-28 10:20:00+00',
    '2026-05-12 06:05:00+00'
  ),
  (
    '22222222-2222-4222-8222-000000000506',
    '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-000000000202',
    'OPS-86',
    'Retest notification fanout after alert routing change',
    'Review',
    'aisha-okafor',
    'jira-aisha-okafor',
    3,
    '2026-05-11 15:30:00+00',
    '{"priority":"High","labels":["qa","alerts"]}'::jsonb,
    '2026-04-30 10:20:00+00',
    '2026-05-11 15:30:00+00'
  ),
  (
    '22222222-2222-4222-8222-000000000507',
    '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-000000000202',
    'OPS-91',
    'Publish on-call ownership matrix to workspace',
    'Todo',
    'maya-chen',
    'jira-maya-chen',
    2,
    '2026-05-09 11:50:00+00',
    '{"priority":"Medium","labels":["runbook"]}'::jsonb,
    '2026-05-01 10:20:00+00',
    '2026-05-09 11:50:00+00'
  )
on conflict (project_id, issue_key) do update set
  id = excluded.id,
  sprint_id = excluded.sprint_id,
  summary = excluded.summary,
  status = excluded.status,
  assignee_profile_id = excluded.assignee_profile_id,
  jira_assignee_id = excluded.jira_assignee_id,
  story_points = excluded.story_points,
  updated_at_source = excluded.updated_at_source,
  raw = excluded.raw,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

-- Standups include blockers, parsed transcript entries, and clean check-ins.
insert into public.standups (
  id,
  project_id,
  sprint_id,
  profile_id,
  date,
  yesterday,
  today,
  blockers,
  source,
  source_ref,
  parsed_confidence,
  created_at,
  updated_at
) values
  (
    '11111111-1111-4111-8111-000000000601',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-000000000102',
    'maya-chen',
    '2026-05-12',
    'Reviewed say-do gap flags with Devon and cleaned stale recommendation copy.',
    'Unblock fixture mismatch and prepare sprint closeout notes.',
    'Waiting on final QA fixture export for dashboard empty states.',
    'manual',
    'standup-spm-2026-05-12-maya',
    0.982,
    '2026-05-12 04:05:00+00',
    '2026-05-12 04:05:00+00'
  ),
  (
    '11111111-1111-4111-8111-000000000602',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-000000000102',
    'leo-martinez',
    '2026-05-12',
    'Moved confidence explanation component behind the project dashboard flag.',
    'Finish accessibility pass and connect review data to member history.',
    'No blocker.',
    'transcript',
    'gmeet-spm-risk-console-2026-05-12',
    0.941,
    '2026-05-12 04:07:00+00',
    '2026-05-12 04:07:00+00'
  ),
  (
    '11111111-1111-4111-8111-000000000603',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-000000000102',
    'aisha-okafor',
    '2026-05-12',
    'Found one mismatch between mocked Jira status and QA blocked state.',
    'Retest blocker display and update acceptance notes.',
    'Need stable staging fixture for SPM-131.',
    'manual',
    'standup-spm-2026-05-12-aisha',
    0.976,
    '2026-05-12 04:09:00+00',
    '2026-05-12 04:09:00+00'
  ),
  (
    '22222222-2222-4222-8222-000000000604',
    '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-000000000202',
    'devon-reed',
    '2026-05-12',
    'Reviewed incident readiness scope and pulled rollback checklist into sprint review.',
    'Pair with Leo on deployment timeline instrumentation.',
    'No blocker.',
    'manual',
    'standup-ops-2026-05-12-devon',
    0.989,
    '2026-05-12 04:15:00+00',
    '2026-05-12 04:15:00+00'
  ),
  (
    '22222222-2222-4222-8222-000000000605',
    '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-000000000202',
    'leo-martinez',
    '2026-05-12',
    'Added deploy event capture and mapped the rollback checklist schema.',
    'Wire runbook status into the incident timeline card.',
    'Need API token rotation approved before production dry run.',
    'transcript',
    'gmeet-ops-readiness-2026-05-12',
    0.927,
    '2026-05-12 04:17:00+00',
    '2026-05-12 04:17:00+00'
  ),
  (
    '22222222-2222-4222-8222-000000000606',
    '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-000000000202',
    'aisha-okafor',
    '2026-05-12',
    'Completed alert fanout regression and flagged two flaky PagerDuty cases.',
    'Retest after routing patch lands and publish QA notes.',
    'No blocker.',
    'manual',
    'standup-ops-2026-05-12-aisha',
    0.981,
    '2026-05-12 04:19:00+00',
    '2026-05-12 04:19:00+00'
  )
on conflict (id) do update set
  project_id = excluded.project_id,
  sprint_id = excluded.sprint_id,
  profile_id = excluded.profile_id,
  date = excluded.date,
  yesterday = excluded.yesterday,
  today = excluded.today,
  blockers = excluded.blockers,
  source = excluded.source,
  source_ref = excluded.source_ref,
  parsed_confidence = excluded.parsed_confidence,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

-- Git commits are tied to active sprint work.
insert into public.git_commits (
  id,
  project_id,
  sprint_id,
  sha,
  author_profile_id,
  author_email,
  message,
  committed_at,
  additions,
  deletions,
  raw,
  created_at
) values
  (
    '11111111-1111-4111-8111-000000000701',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-000000000102',
    '8f2c7d1a6b4e9c0d3a5f1b2c7e9d0a1b2c3d4e5f',
    'leo-martinez',
    'leo.martinez@sprintpulse.dev',
    'Add confidence copy to stale work signal cards',
    '2026-05-11 19:18:00+00',
    148,
    32,
    '{"branch":"feature/risk-console","pullRequest":184}'::jsonb,
    '2026-05-11 19:18:10+00'
  ),
  (
    '11111111-1111-4111-8111-000000000702',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-000000000102',
    'b4e9c0d3a5f1b2c7e9d0a1b2c3d4e5f8f2c7d1a6',
    'devon-reed',
    'devon.reed@sprintpulse.dev',
    'Persist Jira sync warnings in ops timeline',
    '2026-05-11 16:38:00+00',
    96,
    18,
    '{"branch":"integration/jira-sync","pullRequest":181}'::jsonb,
    '2026-05-11 16:38:10+00'
  ),
  (
    '11111111-1111-4111-8111-000000000703',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-000000000102',
    'd3a5f1b2c7e9d0a1b2c3d4e5f8f2c7d1a6b4e9c0',
    'priya-shah',
    'priya.shah@sprintpulse.dev',
    'Tune role-aware recommendation labels',
    '2026-05-10 18:30:00+00',
    42,
    11,
    '{"branch":"ux/recommendation-labels","pullRequest":177}'::jsonb,
    '2026-05-10 18:30:10+00'
  ),
  (
    '22222222-2222-4222-8222-000000000704',
    '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-000000000202',
    '0a9f4b2d7c6e1a3b5d8f0c2e4a6b8d1f3c5e7a9b',
    'leo-martinez',
    'leo.martinez@sprintpulse.dev',
    'Capture rollback checklist state in incident timeline',
    '2026-05-12 06:02:00+00',
    214,
    47,
    '{"branch":"feature/incident-timeline","pullRequest":96}'::jsonb,
    '2026-05-12 06:02:10+00'
  ),
  (
    '22222222-2222-4222-8222-000000000705',
    '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-000000000202',
    '7c6e1a3b5d8f0c2e4a6b8d1f3c5e7a9b0a9f4b2d',
    'aisha-okafor',
    'aisha.okafor@sprintpulse.dev',
    'Add fanout regression coverage for routing patch',
    '2026-05-11 15:26:00+00',
    83,
    9,
    '{"branch":"qa/alert-fanout","pullRequest":94}'::jsonb,
    '2026-05-11 15:26:10+00'
  ),
  (
    '22222222-2222-4222-8222-000000000706',
    '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-000000000202',
    '5d8f0c2e4a6b8d1f3c5e7a9b0a9f4b2d7c6e1a3b',
    'devon-reed',
    'devon.reed@sprintpulse.dev',
    'Document deploy ownership matrix handoff',
    '2026-05-09 11:42:00+00',
    36,
    4,
    '{"branch":"docs/on-call-matrix","pullRequest":91}'::jsonb,
    '2026-05-09 11:42:10+00'
  )
on conflict (project_id, sha) do update set
  id = excluded.id,
  sprint_id = excluded.sprint_id,
  author_profile_id = excluded.author_profile_id,
  author_email = excluded.author_email,
  message = excluded.message,
  committed_at = excluded.committed_at,
  additions = excluded.additions,
  deletions = excluded.deletions,
  raw = excluded.raw,
  created_at = excluded.created_at;

-- Recommendations reflect realistic project ops risk.
insert into public.recommendations (
  id,
  project_id,
  sprint_id,
  profile_id,
  kind,
  severity,
  title,
  message,
  inputs,
  status,
  created_at,
  updated_at
) values
  (
    '11111111-1111-4111-8111-000000000801',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-000000000102',
    'aisha-okafor',
    'delivery',
    'high',
    'Resolve blocked QA fixture today',
    'SPM-131 has been blocked for four days and is holding dashboard acceptance. Pair QA and engineering on a stable fixture before sprint close.',
    '{"issueKeys":["SPM-131"],"blockerDays":4,"standupIds":["11111111-1111-4111-8111-000000000603"]}'::jsonb,
    'open',
    '2026-05-12 07:20:00+00',
    '2026-05-12 07:20:00+00'
  ),
  (
    '11111111-1111-4111-8111-000000000802',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-000000000102',
    'leo-martinez',
    'git',
    'medium',
    'Keep review size small',
    'The confidence-copy branch is carrying over 140 additions. Split follow-up accessibility tweaks if review does not land by end of day.',
    '{"commitShas":["8f2c7d1a6b4e9c0d3a5f1b2c7e9d0a1b2c3d4e5f"],"additions":148}'::jsonb,
    'acknowledged',
    '2026-05-12 07:22:00+00',
    '2026-05-12 07:22:00+00'
  ),
  (
    '11111111-1111-4111-8111-000000000803',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-000000000102',
    null,
    'team',
    'medium',
    'Tighten sprint-close narrative',
    'Three active signals mention fixture or sync risk. Use the closeout to separate product-visible impact from internal cleanup.',
    '{"openBlockers":2,"issueKeys":["SPM-127","SPM-131"]}'::jsonb,
    'open',
    '2026-05-12 07:24:00+00',
    '2026-05-12 07:24:00+00'
  ),
  (
    '22222222-2222-4222-8222-000000000804',
    '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-000000000202',
    'leo-martinez',
    'delivery',
    'critical',
    'Approve API token rotation before dry run',
    'OPS-82 is on the critical path and standup notes call out token approval. Schedule approval before the production dry run window.',
    '{"issueKeys":["OPS-82"],"blocker":"API token rotation approval"}'::jsonb,
    'open',
    '2026-05-12 07:00:00+00',
    '2026-05-12 07:00:00+00'
  ),
  (
    '22222222-2222-4222-8222-000000000805',
    '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-000000000202',
    'aisha-okafor',
    'jira',
    'medium',
    'Recheck alert fanout flakiness',
    'QA has two flaky PagerDuty cases after the routing patch. Keep OPS-86 in review until the follow-up regression passes.',
    '{"issueKeys":["OPS-86"],"testArea":"PagerDuty fanout"}'::jsonb,
    'open',
    '2026-05-12 07:02:00+00',
    '2026-05-12 07:02:00+00'
  ),
  (
    '22222222-2222-4222-8222-000000000806',
    '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-000000000202',
    null,
    'team',
    'low',
    'Runbook ownership is nearly ready',
    'The ownership matrix is drafted and sprint risk is concentrated in deploy dry-run approval. Keep the next update focused on the approval path.',
    '{"completedCommits":2,"pendingIssueKeys":["OPS-91"]}'::jsonb,
    'acknowledged',
    '2026-05-12 07:04:00+00',
    '2026-05-12 07:04:00+00'
  )
on conflict (id) do update set
  project_id = excluded.project_id,
  sprint_id = excluded.sprint_id,
  profile_id = excluded.profile_id,
  kind = excluded.kind,
  severity = excluded.severity,
  title = excluded.title,
  message = excluded.message,
  inputs = excluded.inputs,
  status = excluded.status,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

-- Recent sync runs for Jira, Git, standups, and recommendation refreshes.
insert into public.sync_runs (
  id,
  project_id,
  source,
  status,
  requested_by,
  started_at,
  finished_at,
  stats,
  error_message
) values
  (
    '11111111-1111-4111-8111-000000000901',
    '11111111-1111-4111-8111-111111111111',
    'jira',
    'succeeded',
    'maya-chen',
    '2026-05-12 07:33:00+00',
    '2026-05-12 07:35:00+00',
    '{"importedIssues":4,"updatedIssues":3,"warnings":1}'::jsonb,
    null
  ),
  (
    '11111111-1111-4111-8111-000000000902',
    '11111111-1111-4111-8111-111111111111',
    'git',
    'succeeded',
    'devon-reed',
    '2026-05-12 07:23:00+00',
    '2026-05-12 07:25:00+00',
    '{"importedCommits":3,"branchesScanned":4}'::jsonb,
    null
  ),
  (
    '11111111-1111-4111-8111-000000000903',
    '11111111-1111-4111-8111-111111111111',
    'recommendation',
    'succeeded',
    'maya-chen',
    '2026-05-12 07:19:00+00',
    '2026-05-12 07:24:00+00',
    '{"createdRecommendations":2,"updatedRecommendations":1,"openBlockers":2}'::jsonb,
    null
  ),
  (
    '22222222-2222-4222-8222-000000000904',
    '22222222-2222-4222-8222-222222222222',
    'jira',
    'succeeded',
    'devon-reed',
    '2026-05-12 07:08:00+00',
    '2026-05-12 07:10:00+00',
    '{"importedIssues":3,"updatedIssues":2,"warnings":0}'::jsonb,
    null
  ),
  (
    '22222222-2222-4222-8222-000000000905',
    '22222222-2222-4222-8222-222222222222',
    'git',
    'succeeded',
    'devon-reed',
    '2026-05-12 07:03:00+00',
    '2026-05-12 07:05:00+00',
    '{"importedCommits":3,"branchesScanned":3}'::jsonb,
    null
  ),
  (
    '22222222-2222-4222-8222-000000000906',
    '22222222-2222-4222-8222-222222222222',
    'standup',
    'failed',
    'maya-chen',
    '2026-05-11 04:00:00+00',
    '2026-05-11 04:02:00+00',
    '{"parsedEntries":2,"failedEntries":1}'::jsonb,
    'Transcript contained one speaker without a mapped project member.'
  )
on conflict (id) do update set
  project_id = excluded.project_id,
  source = excluded.source,
  status = excluded.status,
  requested_by = excluded.requested_by,
  started_at = excluded.started_at,
  finished_at = excluded.finished_at,
  stats = excluded.stats,
  error_message = excluded.error_message;

commit;
