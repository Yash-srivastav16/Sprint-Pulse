# SprintPulse Context

## Current Goal

Polish the first product flow so Product Owners get full portfolio and project health visibility, while Scrum Masters can create or connect projects and manage delivery operations.

## Product Flow

Public homepage -> Login -> Project list -> Create/connect project if authorized -> Jira import or manual project setup -> Project workspace home -> Standup upload/paste/manual input -> Dashboard -> Member detail.

## Personas And Access

- Product Owner: can view portfolio health, project details, sprint health, team risk, and dashboards.
- Scrum Master: can manage projects/sprints, connect Jira, view team health, sync standups.
- Engineering Manager / Architect: can view cross-team/project health and manage setup.
- Individual Developer: can view assigned projects, submit standups, view own/team-limited pulse.
- QA / Presentation: can view quality and stakeholder context, then validate flows.

## Current Stack

- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Auth: Supabase email/password
- Data: API-backed product flows with SprintPulse workspace data
- Integrations: Jira/GitHub/OpenAI adapters can replace the current connector contracts later

## Current Routes

Current implemented routes:

- `/` public homepage
- `/login`
- `/setup` redirects to `/projects`
- `/projects`
- `/projects/new`
- `/projects/connect`
- `/projects/:projectId`
- `/projects/:projectId/standups`
- `/projects/:projectId/dashboard`
- `/projects/:projectId/members/:memberId`
- Legacy presenter route redirects through the normal project flow
- `/plan` redirects through the normal project flow

## API Contracts

Current implemented:

- `GET /api/personas`
- `POST /api/session` returns 410 because password sign-in is handled by Supabase Auth
- `GET /api/me?personaId=`
- `GET /api/projects?personaId=`
- `GET /api/projects/:projectId?personaId=`
- `POST /api/projects`
- `POST /api/projects/connect/jira`
- `GET /api/projects/:projectId/workspace?personaId=`
- `GET /api/projects/:projectId/dashboard?personaId=`
- `GET /api/projects/:projectId/members/:memberId?personaId=`
- `GET /api/projects/:projectId/standups?personaId=`
- `POST /api/projects/:projectId/standups`
- `POST /api/projects/:projectId/transcripts/parse`
- `POST /api/projects/:projectId/standups/sync`
- `GET /api/dashboard`
- `GET /api/members`
- `GET /api/members/:memberId`
- `POST /api/standups`
- `POST /api/transcripts/parse`

## Integration Status

- Login is now Supabase email/password and maps signed-in email addresses to SprintPulse roles.
- Jira, GitHub/GitLab, transcript parsing, AI refresh, recommendations, webhook tokens, and Supabase persistence are implemented for the hackathon deployment.
- Production credentials are event-scoped in `apps/*/.env.production` because the SemicoLabs deploy builds from the submitted repository; rotate them after judging.

## Completed Work

- Initial app scaffold.
- Persona login.
- Project setup screen.
- Dashboard polish.
- Member detail.
- Standup submission and transcript parsing.
- One master SprintPulse agent brief.
- Phase 1 product freeze in `docs/PRODUCT_FREEZE.md`.
- Phase 2 architecture freeze in `docs/ARCHITECTURE_FREEZE.md`.
- Phase 3 UX direction in `docs/UX_DIRECTION.md`.
- Phase 4 first implementation slice:
  - Shared project, sprint, permission, and project-dashboard contracts.
  - Seeded Product Owner persona and two project workspaces.
  - Role-aware projects API, manual project create, Jira connect, workspace summary, project dashboard, project member detail, project standup submit/parse/sync.
  - Public homepage, project list, add project, connect Jira, project workspace, project-aware dashboard/member/standup pages.
  - Standup page now supports manual entry, transcript paste, upload text file parsing, and sync controls.
  - `npm run typecheck` and `npm run build` pass.
- Phase 5 browser QA and hardening:
  - Started local API/web on `http://localhost:4000` and `http://localhost:5173`.
  - Browser-tested desktop homepage, login, projects, workspace, standup, dashboard, and member detail.
  - Browser-tested mobile homepage, projects, and dashboard at 390px width.
  - Fixed login redirect so authenticated users land on `/projects`, not legacy `/setup`.
  - Fixed developer sync visibility: sync controls now appear only for personas with `standup:sync`.
  - Replaced the developer workspace's dead sync tile with a useful `Your pulse` tile.
  - Tightened individual dashboard visibility so developer metrics and team list reflect only visible personal pulse data.
  - Added accessible labels for icon-only mobile actions.
  - `npm run typecheck` and `npm run build` pass after the QA fixes.
- Phase 6 presenter story and stakeholder polish:
  - Added a protected presenter guide with persona-aware headline, five-click walkthrough, proof points, and resilience notes.
  - Added presenter navigation and workspace mode signaling.
  - Redirected legacy `/setup` to `/projects`.
  - Polished Projects page copy using `productPersona` instead of title matching.
  - Browser-smoked the presenter path on desktop and 390px mobile width.
  - `npm run typecheck` and `npm run build` pass.
- Product-flow cleanup after Phase 6:
  - Replaced persona-card sign-in with Supabase email/password auth.
  - Removed hackathon scaffolding language from the active product screens and seeded user-facing copy.
  - Removed presenter/plan pages from active navigation; legacy paths redirect into the project flow.
  - Updated Jira and standup sync routes to product-facing paths.

## Open Decisions

- Whether Supabase should also store personas/projects now, or only authentication for this sprint.
- How much Jira/GitHub realism is needed for the final presentation.
- Whether to add adapter placeholder interfaces or focus next on pitch rehearsal.

## Next 3 Tasks

1. Add Supabase seed instructions: create users matching `@sprintpulse.dev` emails and confirm sign-in.
2. Browser-test Product Owner and Scrum Master journeys once Supabase env values are present.
3. Decide whether the next build slice is Supabase project tables or Jira adapter plumbing.
