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
- Shared contracts for project, sprint, permission, and dashboard responses live in `packages/shared/src/index.ts`.
- Role-aware projects API: manual project create, Jira OAuth connect, workspace summary, project dashboard, member detail, standup submit/parse/sync.
- Standup page supports manual entry, transcript paste, file upload parsing, and sync controls.
- Supabase email/password auth replaces the earlier persona-card sign-in.
- Browser-smoked across desktop and mobile (390px) for homepage, login, projects, workspace, standup, dashboard, and member detail.
- Validation gates pass: `npm run typecheck`, `npm test`, `npm run benchmark:toon`; `npm run check:role-demo` verifies seeded personas when the API is running.

## Open Decisions

- Whether Supabase should also store personas/projects now, or only authentication for this sprint.
- How much Jira/GitHub realism is needed for the final presentation.
- Whether to add adapter placeholder interfaces or focus next on pitch rehearsal.

## Next 3 Tasks

1. Add Supabase seed instructions: create users matching `@sprintpulse.dev` emails and confirm sign-in.
2. Browser-test Product Owner and Scrum Master journeys once Supabase env values are present.
3. Decide whether the next build slice is Supabase project tables or Jira adapter plumbing.
