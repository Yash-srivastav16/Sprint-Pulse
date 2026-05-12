# SprintPulse Coworker Agent Context

Last updated: 2026-05-12

Use this file as the shared context handoff for teammates or Codex agents working on SprintPulse. It captures the current product direction, repo state, implemented flows, ownership guidance, and ready-to-paste agent prompts.

## Copy-Paste Starter Prompt For Any Agent

```text
You are working in /Users/yash_srivastav/Documents/Semicolons on SprintPulse, a Semicolon hackathon POC for May 16-17, 2026.

First read docs/COWORKER_AGENT_CONTEXT.md, docs/SPRINTPULSE_CONTEXT.md, docs/PRODUCT_FREEZE.md, docs/ARCHITECTURE_FREEZE.md, docs/UX_DIRECTION.md, and the relevant files for your assigned flow. Do not revert existing dirty worktree changes. Keep edits scoped to your assigned files. Do not start the dev server unless explicitly asked. Run typecheck/build for the touched workspace when done and report changed files.

Your assigned flow is:
<replace with flow name and exact ownership>
```

## Product Summary

SprintPulse is a hackathon POC, not an MVP. The demo should feel like a real SaaS product that turns standups, Jira signals, Git activity, and sprint/team context into a clean operational dashboard.

Primary judge-facing promise:

- Scrum Masters can create/connect a project, configure demo-safe Jira/Git sync, manage team members, and keep sprint operations visible.
- Product Owners can open projects and understand delivery health, risks, blockers, recommendations, and member pulse.
- Developers can log in, see assigned projects, submit standups, and inspect their own delivery context.
- The UI must be polished, modern, interactive, and easy to explain in seconds.

## Team And Personas

Hackathon team:

- FE: Atharv, Yanshi, Mahesh
- BE: Yash
- Architects: Vipin, Himanshu
- QA: Vikrant, Janice

Product personas in the app:

- Product Owner: portfolio/project health, team risk, full project visibility.
- Scrum Master: create/connect projects, configure integrations, manage team, sync standups, run sprint operations.
- Engineering Manager / Architect: cross-team/project health and technical visibility.
- Developer: assigned projects, own standup, own/member-limited pulse.
- QA / Presentation: quality and stakeholder/demo context.

## Current Stack

- Monorepo with npm workspaces.
- Frontend: React 19, Vite, TypeScript, React Router, Tailwind 4 setup, custom CSS, lucide-react, framer-motion, recharts.
- Backend: Node.js, Express 5, TypeScript.
- Shared contracts: `packages/shared/src/index.ts`.
- Auth: Supabase email/password.
- Database: Supabase Postgres with SQL migrations in `database/supabase`.
- API docs: OpenAPI file at `docs/api/openapi.yaml`; local Swagger UI helper at `docs/api/index.html`.
- Demo integrations: Jira/Git sync are demo-safe, tokenless, real-shaped data imports.

## Environment

Do not commit real secrets.

Web env expected in `apps/web/.env` or `apps/web/.env.local`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_URL=http://localhost:4000/api
VITE_DIRECT_SUPABASE_PROJECTS=true
VITE_PROJECT_API_TIMEOUT_MS=1200
VITE_INTEGRATION_API_TIMEOUT_MS=30000
```

API env expected in `apps/api/.env`:

```env
PORT=4000
CORS_ORIGIN=http://localhost:5173
WEB_APP_URL=http://localhost:5173
ENABLE_MOCK_FLOW=false
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_PROFILES_TABLE=profiles
ALLOW_INSECURE_LOCAL_TLS=false
JIRA_CLIENT_ID=your-atlassian-oauth-client-id
JIRA_CLIENT_SECRET=your-atlassian-oauth-client-secret
JIRA_REDIRECT_URI=http://localhost:4000/api/jira/oauth/callback
JIRA_SCOPES=read:jira-work read:jira-user offline_access
JIRA_STORY_POINTS_FIELD=customfield_10016
```

Important behavior:

- `ENABLE_MOCK_FLOW=false` means API should use Supabase-backed flows.
- `VITE_DIRECT_SUPABASE_PROJECTS=true` means the web app calls Supabase helper functions directly for fast demo project screens and falls back through API when configured otherwise.
- Supabase Auth email confirmation should be disabled for the hackathon direct sign-in flow.

## Database Migrations

Current SQL files:

- `database/supabase/001_profiles.sql`: profiles/users.
- `database/supabase/002_projects.sql`: projects, sprints, project members.
- `database/supabase/003_performance_indexes.sql`: indexes/performance improvements.
- `database/supabase/004_project_ops.sql`: project ops tables such as standups, sync runs, Jira/Git connections, issues, commits, recommendations, invites.
- `database/supabase/005_invite_acceptance.sql`: invite acceptance RPC for users who sign up with invited emails.
- `database/supabase/006_invite_flow_cleanup.sql`: cleanup for old pending invite rows that were accidentally added as members before signup; reruns the invite acceptance RPC.
- `database/supabase/007_sprint_management.sql`: sprint update policy and sprint status/date index for add/continue sprint flows.
- `database/supabase/008_project_visibility_scope.sql`: project visibility scope and related project member access policy updates.
- `database/supabase/009_jira_oauth_integration.sql`: Jira OAuth metadata, private token/state tables, and imported issue metadata fields.

Known RLS note:

- Earlier an infinite recursion policy issue on `project_members` was fixed in SQL work. If a teammate touches policies, verify project create, team list, and project switcher again.

## Current App Routes

Public:

- `/`
- `/login`
- `/signup`

Protected:

- `/projects`
- `/projects/new`
- `/projects/connect`
- `/projects/:projectId`
- `/projects/:projectId/standups`
- `/projects/:projectId/dashboard`
- `/projects/:projectId/team`
- `/projects/:projectId/sprints`
- `/projects/:projectId/integrations`
- `/projects/:projectId/members/:memberId`

Legacy redirects:

- `/setup` -> `/projects`
- `/plan` -> `/projects`
- `/standup` -> `/projects`
- `/members/:memberId` -> `/projects`

## Current API Surface

Shared frontend API wrapper: `apps/web/src/api.ts`

Backend route file: `apps/api/src/routes/index.ts`

Important endpoints:

- `GET /api/personas`
- `POST /api/users`
- `GET /api/projects?personaId=`
- `GET /api/projects/:projectId?personaId=`
- `POST /api/projects`
- `GET /api/projects/:projectId/workspace?personaId=`
- `GET /api/projects/:projectId/ops?personaId=`
- `GET /api/projects/:projectId/sprints?personaId=`
- `GET /api/projects/:projectId/team?personaId=`
- `POST /api/projects/:projectId/invites`
- `POST /api/projects/:projectId/team`
- `PATCH /api/projects/:projectId/team/:profileId`
- `GET /api/projects/:projectId/integrations?personaId=`
- `POST /api/projects/:projectId/jira/configure`
- `POST /api/projects/:projectId/jira/sync`
- `POST /api/projects/:projectId/git/configure`
- `POST /api/projects/:projectId/git/sync`
- `GET /api/projects/:projectId/standups?personaId=&sprintId=`
- `POST /api/projects/:projectId/standups`
- `POST /api/projects/:projectId/transcripts/parse`
- `POST /api/projects/:projectId/standups/sync`
- `GET /api/projects/:projectId/dashboard?personaId=&sprintId=`
- `GET /api/projects/:projectId/members/:memberId?personaId=&sprintId=`
- `GET /api/projects/:projectId/members/:memberId/history?personaId=&sprintId=`

OpenAPI:

- Main file: `docs/api/openapi.yaml`
- Local static viewer: `docs/api/index.html`
- If using Swagger UI tools, make sure the YAML starts with a valid `openapi: 3.0.0` style field.

## Current Frontend Architecture

Shell/layout:

- `apps/web/src/components/layout/EnhancedShell.tsx`
- `apps/web/src/components/layout/AppShell.tsx`
- `apps/web/src/components/layout/Sidebar.tsx`
- `apps/web/src/components/layout/TopBar.tsx`

Contexts:

- `apps/web/src/context/AuthContext.tsx`
- `apps/web/src/context/ProjectContext.tsx`

Pages:

- `HomePage.tsx`: public product page.
- `LoginPage.tsx`: Supabase sign in/create account.
- `ProjectsPage.tsx`: accessible project list, focus project, create/connect actions.
- `AddProjectPage.tsx`: manual project creation.
- `ConnectProjectPage.tsx`: Jira-shaped project connection.
- `ProjectWorkspacePage.tsx`: project operations home.
- `ProjectTeamPage.tsx`: members, available users, invites, role/mapping management.
- `ProjectSprintsPage.tsx`: active/old sprint history and sprint selection.
- `ProjectIntegrationsPage.tsx`: Jira/Git config and demo sync.
- `StandupPage.tsx`: manual/transcript/upload/sync standups.
- `DashboardPage.tsx`: team/individual health, charts, risks, recommendations.
- `MemberDetailPage.tsx`: per-member pulse, tickets, commits, recommendations, standups.

Styling:

- `apps/web/src/styles/global.css`: broad app/page styles.
- `apps/web/src/styles/home.css`: public homepage styles.
- `apps/web/src/styles/project-flow.css`: project/workspace flow styles.
- `apps/web/src/styles/projects.css`: modern Projects page-specific styles.
- `apps/web/src/styles/globals.css`: Tailwind token entry.
- Tailwind config: `apps/web/tailwind.config.ts`.

## Current Data Layer

Supabase direct web helpers:

- `apps/web/src/lib/supabase.ts`
- `apps/web/src/lib/supabaseProjects.ts`
- `apps/web/src/lib/supabaseProjectOps.ts`

API Supabase helpers:

- `apps/api/src/lib/supabaseAdmin.ts`
- `apps/api/src/data/supabaseProfiles.ts`
- `apps/api/src/data/supabaseProjects.ts`
- `apps/api/src/data/supabaseProjectOps.ts`

Shared types:

- `packages/shared/src/index.ts`

## Recent Work Completed

Recent major slices already implemented:

- Supabase email/password login and account creation.
- Profile creation/upsert and invite acceptance for signed-up users.
- Real Supabase-backed project creation and project data loading.
- SQL migrations moved into `database/supabase`.
- Project Ops expansion:
  - standups
  - sync runs
  - Jira connections/issues
  - Git connections/commits
  - recommendations
  - project invites
  - active sprint uniqueness and sprint history
- Demo-safe Jira/Git sync without storing real tokens.
- Team management with available users and invitation links.
- Swagger/OpenAPI document for the API.
- UI transformation:
  - modern shell/sidebar/topbar
  - dashboard components and charts
  - homepage redesign
  - login/create-account polish
  - Projects page modernization
- Latest sidebar work:
  - fixed multiple active nav items by removing fake `/projects` fallback links
  - added project switcher
  - added sprint switcher
  - added selected sprint persistence
  - Dashboard, Standups, and Member Detail now respect selected `sprintId`
  - Sprint page cards can select active/old sprint

Latest verification:

- `npm run typecheck -w apps/web` passed.
- `npm run build -w apps/web` passed.
- Build warning still exists: Vite chunk larger than 500 kB.

## Current UX Direction

Desired UI:

- Desktop-first for the hackathon demo.
- Dark-first premium SaaS feel, but theme toggle exists.
- Clean, modern, vibrant, not a plain CRUD dashboard.
- Use compact panels, status chips, segmented controls, tabs, charts, subtle animations, and clear empty/loading/error states.
- Avoid stuffing every action on the workspace home. Use sidebar pages for detail.
- Avoid text that says "mock", "demo data", or makes the product feel fake.
- Avoid generic step copy on the public page. Show product value through charts, signals, and clear product framing.
- Product screens must feel operationally real: project, sprint, team, standups, Jira, Git, risk, recommendations.

## Dirty Worktree Warning

The worktree is intentionally dirty with many active changes. Do not run destructive git commands. Do not revert files unless Yash explicitly asks.

Current notable dirty areas include:

- API Supabase data/routes.
- Web shell/layout/pages/styles.
- Shared contracts.
- SQL migrations `005_invite_acceptance.sql`, `006_invite_flow_cleanup.sql`, and `007_sprint_management.sql`.
- New UI component folders under `apps/web/src/components`.
- Deleted legacy files: `apps/web/src/components/Shell.tsx`, `apps/web/src/styles/dashboard.css`.

Before editing, run:

```bash
git status --short
```

If your assigned file already has unrelated changes, work with them and keep your patch scoped.

## Verification Commands

Fast checks:

```bash
npm run typecheck -w apps/web
npm run build -w apps/web
```

Full checks:

```bash
npm run typecheck
npm run build
```

Run dev servers only when asked:

```bash
npm run dev
```

Or separately:

```bash
npm run dev:api
npm run dev:web
```

If a dev server is started for QA, stop it before finishing unless the user explicitly wants it left running.

## Agent Collaboration Rules

Use these rules when spinning teammate agents:

- Give each agent a clear ownership area and file set.
- Tell agents they are not alone in the codebase and must not revert others' work.
- Avoid two agents editing the same file unless one is read-only/review.
- For UI agents, ask for actual implementation, not only suggestions.
- For backend/data agents, require shared contract updates first.
- For QA agents, ask for findings, screenshots/steps if possible, and exact routes tested.
- Do not expose Supabase keys or secrets in prompts.
- Do not let agents start long-running servers unless that is their explicit task.

## Suggested Work Split

### 1. Dashboard UX Agent

Ownership:

- `apps/web/src/pages/DashboardPage.tsx`
- `apps/web/src/components/dashboard/*`
- `apps/web/src/components/charts/*`
- related dashboard CSS in `apps/web/src/styles/global.css`

Prompt:

```text
Read docs/COWORKER_AGENT_CONTEXT.md. Improve the project dashboard desktop UX so it feels like a premium sprint intelligence product. Keep data/API behavior unchanged. Make the dashboard self-explanatory through layout, charts, labels, health scoring, risk explanation, and recommendations. Do not edit auth, sidebar, project context, backend, or migrations. Run npm run typecheck -w apps/web and npm run build -w apps/web.
```

### 2. Team And Invite Flow Agent

Ownership:

- `apps/web/src/pages/ProjectTeamPage.tsx`
- `apps/web/src/context/AuthContext.tsx` only if invite acceptance needs minor wiring
- `apps/api/src/data/supabaseProfiles.ts`
- `database/supabase/005_invite_acceptance.sql`
- `database/supabase/006_invite_flow_cleanup.sql`
- `database/supabase/007_sprint_management.sql`

Prompt:

```text
Read docs/COWORKER_AGENT_CONTEXT.md. Audit and improve the team management and invite flow. The expected demo: Scrum Master adds an existing signed-up user or invites by email, user signs up/logs in with their own password, invite is accepted automatically, and the assigned project appears. Do not make fake passwords or mock-user copy. Keep changes scoped and verify typecheck/build.
```

### 3. Integrations Agent

Ownership:

- `apps/web/src/pages/ProjectIntegrationsPage.tsx`
- `apps/web/src/lib/supabaseProjectOps.ts`
- `apps/api/src/data/supabaseProjectOps.ts`
- `apps/api/src/routes/index.ts`
- `docs/api/openapi.yaml`

Prompt:

```text
Read docs/COWORKER_AGENT_CONTEXT.md. Improve Jira/Git configuration and demo-safe sync so it looks credible for the hackathon: clear config state, sync run history, imported Jira issues, imported commits, member mapping, warnings, and empty states. No real external tokens. Keep API docs updated. Verify typecheck/build.
```

### 4. Standups Agent

Ownership:

- `apps/web/src/pages/StandupPage.tsx`
- standup helpers in `apps/web/src/lib/supabaseProjectOps.ts`
- matching API helpers if needed

Prompt:

```text
Read docs/COWORKER_AGENT_CONTEXT.md. Make standup capture project/sprint scoped and demo-ready. Manual, transcript, upload, recent history, and sync must clearly attach to the selected project and selected sprint. Developers should only submit allowed standups; Scrum Masters can sync/review. Keep UI modern and verify typecheck/build.
```

### 5. Projects And Navigation Agent

Ownership:

- `apps/web/src/pages/ProjectsPage.tsx`
- `apps/web/src/styles/projects.css`
- read-only review of `Sidebar.tsx` and `ProjectContext.tsx`

Prompt:

```text
Read docs/COWORKER_AGENT_CONTEXT.md. Review and polish the Projects page and project selection UX. Do not change backend behavior. Ensure Scrum Master create/connect actions are clear, Product Owner sees project details not setup actions, and Developers see only assigned projects. Avoid editing Sidebar unless you find a blocking bug.
```

### 6. Backend/Data Agent

Ownership:

- `packages/shared/src/index.ts`
- `apps/api/src/routes/index.ts`
- `apps/api/src/data/supabaseProjectOps.ts`
- `apps/api/src/data/supabaseProjects.ts`
- `database/supabase/*.sql`
- `docs/api/openapi.yaml`

Prompt:

```text
Read docs/COWORKER_AGENT_CONTEXT.md. Audit the Supabase-backed API/data path for project ops. Focus on correctness, RLS-safe behavior, performance, indexes, and API docs. Do not touch frontend UI except shared types if required. Verify full typecheck for shared/api.
```

### 7. QA/Demo Agent

Ownership:

- no code changes by default
- may update `TESTING_CHECKLIST.md` or create a demo notes doc if asked

Prompt:

```text
Read docs/COWORKER_AGENT_CONTEXT.md. Perform a QA/demo-readiness review. Do not change code. Produce a route-by-route smoke test matrix for Product Owner, Scrum Master, and Developer. Include blockers, visual polish issues, data risks, fallback demo narration, and exact commands to verify.
```

## Recommended Next Backlog

High-impact next work:

1. Run a real browser pass while logged in as Scrum Master and Product Owner.
2. Polish dashboard page further around explanations and charts.
3. Strengthen team invite/add-user flow with a clearer "existing user vs invite new user" UX.
4. Make Integrations page more compelling with sync run timeline and imported issue/commit preview.
5. Make Standups page use selected sprint visually and clearly.
6. Add seed/demo guide for creating Supabase test accounts.
7. Update `docs/api/openapi.yaml` after any API changes.
8. Add lightweight code splitting later if the Vite chunk warning becomes a concern.

## Known Risks

- Supabase Auth requires project config to allow direct sign-in after signup. If email confirmation is on, the flow will not feel direct.
- `VITE_DIRECT_SUPABASE_PROJECTS=true` means frontend project screens can bypass API for speed. If changing this, test CORS and API env carefully.
- Browser verification may depend on an available in-app browser pane or existing logged-in session.
- Vite has a large chunk warning because many UI/chart libraries are bundled together.
- The repo is dirty; coordination matters more than perfect git cleanliness until the team decides to checkpoint.

## How To Keep This File Useful

Update this file after meaningful changes to:

- routes
- data model
- SQL migrations
- env variables
- major UI flows
- API contracts
- verification status
- current blockers

Keep it high signal. Do not paste huge code blocks or secret values.
