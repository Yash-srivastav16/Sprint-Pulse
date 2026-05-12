# SprintPulse AI

SprintPulse AI predicts sprint risk by comparing standup updates with delivery signals.

## Stack

- Frontend: React, Vite, TypeScript, React Router, lucide-react
- Backend: Node.js, Express, TypeScript
- Auth: Supabase email/password
- Data: project-scoped API contracts, ready to connect Supabase/Jira/GitHub/OpenAI adapters

## Run Locally

```bash
npm install
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
npm run dev
```

The API runs on `http://localhost:4000`.
The web app runs on `http://localhost:5173`.

## Required Environment

Set these values in `apps/web/.env`:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_URL=http://localhost:4000/api
VITE_DIRECT_SUPABASE_PROJECTS=true
VITE_PROJECT_API_TIMEOUT_MS=1200
VITE_PROJECT_MUTATION_TIMEOUT_MS=10000
VITE_INTEGRATION_API_TIMEOUT_MS=30000
```

Frontend variables must use the `VITE_` prefix. Do not put `SUPABASE_SERVICE_ROLE_KEY` in `apps/web/.env` or expose it with a `VITE_` prefix.
`VITE_DIRECT_SUPABASE_PROJECTS=true` makes the demo project screens use the signed-in browser Supabase client directly, avoiding slow backend fallback waits. Set it to `false` when the backend Supabase adapter is stable and you want every project screen to go through Express first.
`VITE_PROJECT_MUTATION_TIMEOUT_MS` is intentionally longer than the read timeout so create/sync actions do not show a false timeout after the database already saved the record.

Set these values in `apps/api/.env`:

```bash
ENABLE_MOCK_FLOW=false
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_PROFILES_TABLE=profiles
WEB_APP_URL=http://localhost:5173
JIRA_CLIENT_ID=your-atlassian-oauth-client-id
JIRA_CLIENT_SECRET=your-atlassian-oauth-client-secret
JIRA_REDIRECT_URI=http://localhost:4000/api/jira/oauth/callback
JIRA_SCOPES=read:jira-work read:jira-user offline_access
JIRA_STORY_POINTS_FIELD=customfield_10016
```

`ENABLE_MOCK_FLOW=false` keeps seeded rehearsal data off and uses Supabase database profiles, projects, sprints, and project memberships for the real demo flow. Temporarily set `ENABLE_MOCK_FLOW=true` only when you explicitly want the seeded rehearsal workspace. Dashboard scoring and standup intelligence are the next database-backed phases after project setup.
For Jira OAuth, create an Atlassian developer app, set the callback URL to `http://localhost:4000/api/jira/oauth/callback`, and copy the client ID/secret into `apps/api/.env`.

Run the SQL files in order before using `ENABLE_MOCK_FLOW=false`:

1. [database/supabase/001_profiles.sql](/Users/yash_srivastav/Documents/Semicolons/database/supabase/001_profiles.sql)
2. [database/supabase/002_projects.sql](/Users/yash_srivastav/Documents/Semicolons/database/supabase/002_projects.sql)
3. [database/supabase/003_performance_indexes.sql](/Users/yash_srivastav/Documents/Semicolons/database/supabase/003_performance_indexes.sql)
4. [database/supabase/004_project_ops.sql](/Users/yash_srivastav/Documents/Semicolons/database/supabase/004_project_ops.sql)
5. [database/supabase/005_invite_acceptance.sql](/Users/yash_srivastav/Documents/Semicolons/database/supabase/005_invite_acceptance.sql)
6. [database/supabase/006_invite_flow_cleanup.sql](/Users/yash_srivastav/Documents/Semicolons/database/supabase/006_invite_flow_cleanup.sql)
7. [database/supabase/007_sprint_management.sql](/Users/yash_srivastav/Documents/Semicolons/database/supabase/007_sprint_management.sql)
8. [database/supabase/008_project_visibility_scope.sql](/Users/yash_srivastav/Documents/Semicolons/database/supabase/008_project_visibility_scope.sql)
9. [database/supabase/009_jira_oauth_integration.sql](/Users/yash_srivastav/Documents/Semicolons/database/supabase/009_jira_oauth_integration.sql)
10. [database/supabase/010_profile_claim_and_project_create.sql](/Users/yash_srivastav/Documents/Semicolons/database/supabase/010_profile_claim_and_project_create.sql)
11. [database/supabase/011_demo_sprint_status_refresh.sql](/Users/yash_srivastav/Documents/Semicolons/database/supabase/011_demo_sprint_status_refresh.sql)

Re-run the files after updates; they also install the RLS policies that let signed-in users save profiles, claim invited profiles, create projects as Scrum Master or Engineering Manager, manage team/integrations, and fetch visible project workspaces.

If project creation fails with `new row violates row-level security policy for table "projects"`, run [database/supabase/010_profile_claim_and_project_create.sql](/Users/yash_srivastav/Documents/Semicolons/database/supabase/010_profile_claim_and_project_create.sql). Demo seed profiles can start with `auth_user_id = null`; this migration lets the signed-in user claim the matching profile by email and then satisfy project creation RLS.

If signup creates a Supabase Auth account but no `profiles` row appears, check `http://localhost:4000/api/health`. It should report `supabase.adminConfigured: true`. If it is false, create `apps/api/.env` from `apps/api/.env.example`, add the service role key, and restart the API.

Supabase users should use the same email addresses as SprintPulse team profiles so the app can map authentication to Product Owner, Scrum Master, developer, QA, and presenter roles.

New users can use `/signup` to create a Supabase Auth account and a SprintPulse role profile in the local API workspace. Product Owner, Scrum Master, Engineering Manager, Developer, and QA Lead roles are supported in the account creation flow.

## QA Notes - Maya Chen Walkthrough (May 12, 2026)

Test context: Maya Chen Scrum Master account, web on `http://localhost:5174` because `5173` was already in use, API on `http://localhost:4000`. This was an exploratory Browser QA pass followed by a fix pass.

Confirmed working:

- Maya opens the authenticated project area and the sidebar footer shows the correct user and Scrum Master role.
- Logout redirects back to `/login` and clears the app session.
- Scrum Master project actions are visible: create project, connect existing project, open workspace, team, sprints, standups, dashboard, and integrations.
- Team page loads project members, available existing users, invite history, Jira mapping, and GitHub mapping.
- Integrations page shows configured Jira and GitHub connection details plus synced issue and commit previews.
- Sprint selection updates the project context across project pages after data finishes loading.

Fixed after walkthrough:

- Added `011_demo_sprint_status_refresh.sql` and updated the demo seed so May 12 current sprints are marked active and old sprint signal rows move to the current sprint.
- Replaced planned-sprint confusion with selected-sprint language across dashboard, standups, transcript sync, and sprint history.
- Removed impossible Git recency by treating empty commit state as `Waiting for signal` instead of rendering an epoch date.
- Added role-aware scoring expectations: Scrum Masters/Product Owners/Architects are not flagged for missing Git commits, and Jira/Git checks only apply to roles expected to own those signals.
- Added Team-page signal profile copy per project role so the demo can explain why each role is scored differently.
- Stopped setup routes from leaking stale project context into `/projects`, `/projects/new`, and `/projects/connect`.
- Made empty/planned sprint ranking deterministic with health, flags, blocker pressure, activity, and name tie-breakers.
- Fixed `QA`/`QA Lead` casing in team controls and member cards.
- Made zero pending invites render as a true empty progress state.
- Added visible sync-run failure details on Integrations instead of only showing `5/6`.
- Replaced blank-feeling page loads with a reusable workspace skeleton.
- Disabled create/connect actions until required fields are valid and added guard validation in submit handlers.

UX polish backlog:

- Project list still repeats open-workspace actions in the focus card and individual project cards. Consider making the focus card a read-only overview and keeping navigation actions on project cards only.
- The dashboard right-side “Needs attention first” card is clearer now, but still needs a quick visual QA pass at `1280x720` and `1440x900`.
- Manual login should still be checked in a normal browser after applying fresh SQL and seed data.
- Future role scoring should support per-person overrides when a Scrum Master also codes or an Architect owns implementation tickets.

QA tooling note:

- Codex Browser automation could not type into the email input because the page uses `type="email"`, and the automation layer hit a browser input-selection limitation. Manual login should still be checked in a normal browser; this pass used an authenticated Maya session to inspect the application flow.
