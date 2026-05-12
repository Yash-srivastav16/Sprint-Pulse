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
```

Frontend variables must use the `VITE_` prefix. Do not put `SUPABASE_SERVICE_ROLE_KEY` in `apps/web/.env` or expose it with a `VITE_` prefix.
`VITE_DIRECT_SUPABASE_PROJECTS=true` makes the demo project screens use the signed-in browser Supabase client directly, avoiding slow backend fallback waits. Set it to `false` when the backend Supabase adapter is stable and you want every project screen to go through Express first.

Set these values in `apps/api/.env`:

```bash
ENABLE_MOCK_FLOW=false
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_PROFILES_TABLE=profiles
```

`ENABLE_MOCK_FLOW=false` keeps seeded rehearsal data off and uses Supabase database profiles, projects, sprints, and project memberships for the real demo flow. Temporarily set `ENABLE_MOCK_FLOW=true` only when you explicitly want the seeded rehearsal workspace. Dashboard scoring and standup intelligence are the next database-backed phases after project setup.

Run the SQL files in order before using `ENABLE_MOCK_FLOW=false`:

1. [database/supabase/001_profiles.sql](/Users/yash_srivastav/Documents/Semicolons/database/supabase/001_profiles.sql)
2. [database/supabase/002_projects.sql](/Users/yash_srivastav/Documents/Semicolons/database/supabase/002_projects.sql)
3. [database/supabase/003_performance_indexes.sql](/Users/yash_srivastav/Documents/Semicolons/database/supabase/003_performance_indexes.sql)
4. [database/supabase/004_project_ops.sql](/Users/yash_srivastav/Documents/Semicolons/database/supabase/004_project_ops.sql)

Re-run the files after updates; they also install the RLS policies that let signed-in users save profiles, claim invited profiles, create projects as Scrum Master or Engineering Manager, manage team/integrations, and fetch visible project workspaces.

If signup creates a Supabase Auth account but no `profiles` row appears, check `http://localhost:4000/api/health`. It should report `supabase.adminConfigured: true`. If it is false, create `apps/api/.env` from `apps/api/.env.example`, add the service role key, and restart the API.

Supabase users should use the same email addresses as SprintPulse team profiles so the app can map authentication to Product Owner, Scrum Master, developer, QA, and presenter roles.

New users can use `/signup` to create a Supabase Auth account and a SprintPulse role profile in the local API workspace. Product Owner, Scrum Master, Engineering Manager, Developer, and QA Lead roles are supported in the account creation flow.
