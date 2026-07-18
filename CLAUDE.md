# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

SprintPulse AI is a sprint delivery intelligence platform that predicts risk by comparing standup updates with Jira/GitHub signals. It uses AI to generate role-aware insights for Scrum Masters, Product Owners, Engineering Managers, and developers.

## Commands

**Run everything:**
```bash
npm run dev          # starts API (:4000) + web (:5173) concurrently
```

**Individual workspaces:**
```bash
npm run dev:api      # API only (tsx watch, hot reload)
npm run dev:web      # Web only (Vite)
```

**Build:**
```bash
npm run build        # builds shared → api → web (order matters)
```

**Typecheck:**
```bash
npm run typecheck    # runs typecheck across all workspaces
```

No lint or test commands are configured. Type checking is the primary correctness gate.

## Architecture

**Monorepo workspaces:**
- `apps/web` — React 19 + Vite 7 SPA
- `apps/api` — Express 5 backend
- `packages/shared` — shared TypeScript types and interfaces (contracts between web and api)
- `database/supabase/` — SQL migrations (run in order 001–013 against Supabase)

**Key architectural decisions:**

1. **Mock vs. real mode**: The backend has `ENABLE_MOCK_FLOW` env flag. When `true`, it uses seeded in-memory demo data and bypasses Supabase. When `false`, it uses real Supabase auth + DB.

2. **Frontend data mode**: `VITE_DIRECT_SUPABASE_PROJECTS=true` makes the web app call Supabase directly for project reads (faster). Setting it to `false` routes everything through the Express API.

3. **AI toggle**: `ENABLE_AI_INSIGHTS` on the API and `VITE_ENABLE_AI_INSIGHTS` on the web control whether AI features activate. When disabled, fallback to rule-based scoring.

4. **Shared types are the contract**: `packages/shared/src/index.ts` defines all request/response interfaces. Changes here require rebuilding shared before api/web pick them up (`npm run build -w packages/shared`).

## Key Files

| File | Role |
|------|------|
| `apps/api/src/routes/index.ts` | Route assembler — imports 9 domain files (auth, projects, sprints, team, integrations, standups, dashboard, ai, members) |
| `apps/api/src/routes/dashboard.ts` | GET /dashboard, POST /ai/refresh, POST /ai/chat |
| `apps/api/src/routes/members.ts` | GET /members/:id/history, GET /members/:id |
| `apps/api/src/routes/ai.ts` | POST /members/:id/ai/pr-review |
| `apps/api/src/data/supabaseProjectOps.ts` | All project/sprint DB operations (~4200 lines — do not split) |
| `apps/api/src/ai/sprintpulseAi.ts` | AI prompt templates + scoring + caching (11 templates, 10-min TTL) |
| `apps/web/src/api.ts` | Frontend API client — smart base URL (relative /api in prod, localhost:4000 in dev) |
| `apps/web/src/pages/DashboardPage.tsx` | Main dashboard — health ring, attention queue, action cards, signal map, timeline |
| `apps/web/src/pages/MemberDetailPage.tsx` | Per-member risk timeline + AI PR review panel |
| `apps/web/src/pages/StandupPage.tsx` | Standup submission + transcript parsing |
| `apps/web/src/components/workspace/WorkspaceChrome.tsx` | Shared UI primitives: SectionPanel, PanelHeader, MemberAvatar, StatusPill, EmptyPanel, WorkspaceHero |
| `packages/shared/src/index.ts` | All shared types (contract between web and api) |

## Environment Setup

Copy `.env.example` in both `apps/web` and `apps/api` to `.env` and fill in:

**`apps/api/.env` required:**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` (only if `ENABLE_AI_INSIGHTS=true`)
- `JIRA_CLIENT_ID`, `JIRA_CLIENT_SECRET` (only if using Jira OAuth)

**`apps/web/.env` required:**
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL=http://localhost:4000/api`

## Data Model Highlights

Core Supabase tables: `profiles`, `projects`, `sprints`, `project_members`, `standups`, `sync_runs`, `recommendations`, `jira_oauth_data`.

RLS is enforced at the DB level — users only see projects they created or belong to. The service role key (API-side) bypasses RLS; the anon key (web-side) respects it.

**Risk flags** (`RiskFlag` enum in shared): `VAGUE_UPDATE`, `SAY_DO_GAP`, `BURNOUT_SIGNAL`, `BLOCKER_UNRESOLVED`, `SCOPE_CREEP`, `NO_UPDATE` — these drive AI notifications.

**Personas** (`ProductPersona` enum): `scrum-master`, `product-owner`, `engineering-manager`, `developer`, `qa-lead` — notifications and permissions are role-filtered.

## AI Integration

`sprintpulseAi.ts` contains 11 prompt templates. AI results are cached in-memory with a 10-minute TTL (`AI_CACHE_TTL_MINUTES`). The API falls back to rule-based scoring if OpenAI is unavailable or insights are disabled.

The OpenAI model is configured via `OPENAI_MODEL` env var (default: `gpt-5.5`).

## Dashboard UI Architecture

`DashboardPage.tsx` renders 6 major sections in order:
1. **P1 alert banner** — dismissible, shown when `topRisk` is critical/high or has blockers. Uses solid `bg-danger-600` with white text + white CTA button (inline `style` forces color to bypass CSS inheritance issues).
2. **Hero section** — left: project name H1 + AI summary + `HealthRing` SVG gauge + 3 toned stat cards. Right: sprint health progress bar + "Decision brief" (top-risk member, evidence rows, AI next action, CTA link).
3. **Recommended next actions** — 4 `article` cards (P1–P4), each with a left accent bar (danger/warning/danger/ai colors), priority pill, due date badge, owner, and optional deep-link.
4. **Attention queue** — members ordered by `healthScore asc`, each row shows priority rank badge, avatar, evidence proof (standup/jira/PR), risk level pill, and a health score + thin progress bar.
5. **Team signal map** — 14-cell heatmap per member (standup=teal, jira=blue, git=violet, review=amber), with member health score mini-gauge. Risk level shown as a colored dot on the avatar.
6. **Evidence timeline** — chronological events (standups, risk flags, git, jira, PRs) with a vertical connector line on the left. Each event has a colored dot on the line.

**`HealthRing` component** — SVG-based circular progress gauge. Props: `score` (0–100), `size` (default 88px). Colors: teal ≥80, amber ≥60, red <60. Uses `strokeDasharray` for fill with glow `drop-shadow` filter.

**Semantic colors** — use `danger-*`, `warning-*`, `primary-*`, `info-*`, `ai-*` (defined in `globals.css @theme inline`). Standard Tailwind `red-*`/`green-*` are also available from the default theme but prefer semantic names for consistency.

## Integrations

- **Jira**: OAuth 2.0 flow. Tokens stored per-member in `project_members`. Story points field: `customfield_10016` (override with `JIRA_STORY_POINTS_FIELD`).
- **GitHub**: Server-side only via `GITHUB_TOKEN`. Fetches commit history and PR metrics.

## Deployment

Single Docker container — Express serves both the API and the compiled React SPA.
- **Port**: 8000 (required by SemicoLabs pipeline, set as default in both `server.ts` and Dockerfile)
- **Build**: Dockerfile at repo root does multi-stage: builder (compiles shared→web→api) → runtime (prod deps only)
- **VITE_ vars** are baked at build time via Dockerfile `ARG` with public Supabase defaults
- **Runtime secrets** (`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `GITHUB_TOKEN`) must be injected as ECS/App Runner environment variables — never in Dockerfile
