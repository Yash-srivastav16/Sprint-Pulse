# SprintPulse AI

**Sprint risk intelligence that catches the gap between what your team _says_ in standup and what they _actually_ ship.**

SprintPulse continuously compares standup updates against Jira ticket movement and Git commit activity to surface delivery risk before sprint-end. An AI detection engine scores every team member, flags specific failure patterns, and translates the evidence into a role-aware decision brief for Scrum Masters, Product Owners, Engineering Managers, QA Leads, and Developers.

---

## Judge TL;DR

- **What it is:** SprintPulse is an AI sprint-risk cockpit that correlates standups, Jira, Git provider activity, PR/MR pressure, and transcript evidence.
- **Why it matters:** It finds the say-do gap before sprint review, when Scrum Masters and Engineering Managers can still unblock the work.
- **What to demo first:** Log in as Maya Chen, open the dashboard, show the P1 decision brief, click Leo/Yash in the attention queue, then run **Sync AI analysis**.
- **AI reliability:** Manual AI refreshes are persisted as dashboard snapshots, so repeat demos can load the same AI output without waiting on gateway latency.
- **Agent story:** The MCP server exposes six SprintPulse tools for Claude Code, Cursor, Codex, or any MCP host.
- **Validation commands:** `npm run typecheck`, `npm run benchmark:toon`, and `npm run check:role-demo`.

## UI Preview

### Architecture Diagram

![SprintPulse architecture diagram](docs/assets/sprintpulse-architecture.png)

### Dashboard Screenshot

![SprintPulse dashboard screenshot](docs/assets/sprintpulse-dashboard.png)

These screenshots show the deployed system architecture and the primary dashboard experience: role-aware navigation, health rings, signal breakdown, decision brief, AI refresh, and MCP access.

---

## Why This Matters — Business Value

**The problem we sell against.** Engineering teams already have Jira (truth about tickets), Git providers (truth about code), and standups (the team's narrative of work). What no one has is the **delta between those three sources**. That delta is where sprint failure lives. Industry data consistently shows ~70% of software projects miss original timelines (Standish Group CHAOS) and ~25% of sprints fail to deliver on commitment (Scrum.org research). The cost of a missed sprint isn't the delay alone — it's the cascade: rework, scope cuts, missed releases, and the burnout that compounds across quarters.

**Where today's tools stop.** Jira dashboards report activity volume. Git analytics report commit velocity. Manual standup notes are unstructured prose nobody re-reads. None of these surface the *say–do gap*: a developer telling the team they're "continuing on the API task" while Git shows zero commits and Jira shows zero status transitions for three days running. That gap is the canonical early warning of a sprint in trouble, and it gets lost between three siloed tools.

**What SprintPulse delivers, in cost terms:**

| Today (without SprintPulse) | With SprintPulse |
|---|---|
| Sprint failure detected at sprint review — too late to course-correct | Risk flagged in days 2–4 of a 14-day sprint, with named-member specificity |
| Scrum Master spends ~5 hours/sprint correlating standups, Jira boards, and PR queues by hand | Continuous AI correlation; SM sees one ranked attention queue |
| 30+ minute daily standup conversations produce zero structured artifact | Every meeting transcript auto-parses into per-member entries + risk update |
| Engineering manager learns about burnout signals from skip-level 1:1s, not data | `BURNOUT_SIGNAL` flag fires from commit-time + standup-tone divergence |
| Cross-team agents have no machine-readable view of sprint state | MCP server exposes 6 tools so MCP-capable hosts such as Claude Code and Cursor can read SprintPulse like a database |

**Pricing assumptions for the ROI conversation.** A typical 10-person scrum team running 2-week sprints loses ~$80K when a sprint slips a week (10 engineers × 40 hours × $200 loaded cost). Detecting one slip-able sprint per quarter recoups the cost of a year-long SprintPulse subscription priced at standard SaaS per-seat economics. The win isn't a 5% optimization — it's catching the one sprint per quarter that would have failed silently.

**Who pays for this.** Engineering managers, VP-engineering, and CTOs with delivery-predictability problems. The buyer cares about sprint reliability across teams, not about another dashboard. SprintPulse is positioned as **the layer that interprets** existing tools' raw signals, not yet another tool generating new ones.

---

## What Makes This Different

Most sprint analytics products are dashboard wrappers around the same data the source tools already display. Three architectural choices set SprintPulse apart:

1. **TOON-encoded AI prompts** — Tabular sprint data is encoded in TOON (Token-Oriented Output Notation) instead of JSON before being sent to the language model. The encoding reduces token usage by ~40% on the structured payloads our prompts use, which makes per-member-per-sprint AI scoring economically viable. Cheaper inference per evaluation means richer evaluation cadence without burning budget.

2. **Source-agnostic transcript ingestion** — One webhook URL accepts WebVTT (Teams) and plain `Speaker:` text. The same parser powers the standup page file upload and the webhook path, so SprintPulse can ingest transcripts from any source that can provide VTT or speaker-labelled text.

3. **MCP-native — agents call SprintPulse, not just humans** — A built-in Model Context Protocol server exposes six tools (`get_project_risk`, `get_member_health`, `submit_standup`, `parse_transcript`, `run_member_pr_review`, `send_app_notification`) over stdio. Claude Code, Cursor, Continue, and other MCP-capable hosts can read SprintPulse and create in-app follow-ups without per-host connector code.

The supporting differentiators — `withAppRoute()` for SemicoLabs proxy routing, per-project webhook tokens minted from the UI, dual-credential API auth (shared key OR Supabase JWT), Docker-from-git-URL deploy — are the operational craftsmanship that proves the team can ship production-grade infrastructure under hackathon time pressure.

---

## The Idea

Most sprint dashboards report _activity_. SprintPulse reports _truth_. The product's core hypothesis is that the most reliable signal of sprint risk is the **divergence between standup language and delivery evidence**. A developer who says "continuing on the API task" every day while Git shows zero commits and Jira shows zero status transitions is the canonical case SprintPulse exists to surface.

---

## The 5 Detection Types

Each detection runs server-side and produces a `RiskFlag` with `type`, `severity`, `title`, and `message`.

| Code | Detects | Example evidence |
|------|---------|------------------|
| `VAGUE_UPDATE` | Non-specific standup language ("working on stuff", "making progress") | AI vagueness score ≥ 0.6 |
| `STALE_WORK` | Same task reported across many days with no movement | Same Jira key in standup ≥ 8 days, no transitions |
| `COPY_PASTE` | Repeated/duplicated standup text | Cosine similarity ≥ 0.85 vs prior days |
| `SAY_DO_GAP` | Standup claims work done but Git/Jira disagree | "Shipped X" + 0 commits + ticket unmoved |
| `BLOCKER_ANOMALY` | Blocker mentioned but never resolved or escalated | "Blocked on Y" persists ≥ 3 days, no Jira link |

Additional contextual flags: `BURNOUT_SIGNAL`, `TEST_RISK`, `SPRINT_END_RISK`.

---

## Dashboard Tour

| Section | What it shows |
|---------|---------------|
| **P1 Alert Banner** | Appears at top when the highest-risk member is critical/high or has unresolved blockers. Dismissible. |
| **Hero** | Project name + AI summary + `HealthRing` SVG gauge (120 px) + 4 flat stats (health score / at-risk / blockers / readiness). Right panel: Decision Brief — top-risk member, flag evidence, AI next action. |
| **01 / Recommended actions** | 4 prioritized cards (P1–P4) — each with AI verdict, owner, due window, and deep-link. |
| **02 / Attention queue** | Members ordered by `healthScore asc`. Each row shows flag chips (VAGUE, SAY-DO GAP, STALE, etc.), evidence from standup/Jira/Git, and a mini `HealthRing` gauge. |
| **03 / Delivery pressure** | PR aging and stale story-point risks ranked by pressure. |
| **04 / Team activity** | 14-cell sprint signal heatmap per member — standup (teal), Jira (blue), Git (violet), PR review (amber). Risk dot on avatar + mini health gauge. |
| **05 / Evidence trail** | Chronological audit log: standups, Jira idle events, Git commits, PR review waits, AI flags — connected by a vertical timeline. |

---

## Architecture

```
┌──────────────────────────┐         ┌──────────────────────────┐
│  React 19 / Vite 7 SPA   │ ◀────▶  │  Express 5 API (Node 22) │
│  apps/web                │         │  apps/api                │
└──────────────────────────┘         └──────────────────────────┘
            │                                     │
            ▼                                     ▼
   Supabase (anon key,                 Supabase (service role)
   direct read optional)               Jira REST · Git provider REST
                                       GenAI Hub → gpt-4.1
                                       (TOON-encoded prompts)
```

### Workspaces

- **`apps/web`** — React 19 + Vite 7 SPA, Tailwind CSS v4, Framer Motion, lucide-react.
- **`apps/api`** — Express 5, TypeScript, hot-reloaded with `tsx watch`. Serves `/api/*` plus the compiled web bundle in production.
- **`packages/shared`** — TypeScript types and interface contracts between web and API. Source-of-truth for `MemberPulse`, `RiskFlag`, `FlagType`, `DashboardResponse`, etc.
- **`database/supabase/`** — SQL migrations 001–013 (run in order). Defines `profiles`, `projects`, `sprints`, `project_members`, `standups`, `recommendations`, `sync_runs`, `jira_oauth_data` plus RLS policies.

### Key Files

| File | Role |
|------|------|
| `apps/api/src/routes/index.ts` | Route assembler — imports 9 domain route files |
| `apps/api/src/routes/dashboard.ts` | `GET /dashboard`, `POST /ai/refresh`, `POST /ai/chat` |
| `apps/api/src/routes/members.ts` | Per-member detail + history |
| `apps/api/src/routes/ai.ts` | AI PR review endpoint |
| `apps/api/src/data/supabaseProjectOps.ts` | Project/sprint orchestration and signal sync flows |
| `apps/api/src/data/supabaseAiSnapshots.ts` | Persists AI dashboard snapshots and recommendation runs |
| `apps/api/src/data/supabaseSyncRuns.ts` | Shared sync-run insert/mapper utilities |
| `apps/api/src/ai/sprintpulseAi.ts` | 10 AI prompt templates + scoring + signature-based cache |
| `apps/api/src/ai/openaiResponses.ts` | Chat Completions API calls — TOON-encoded input, `json_schema` structured output |
| `apps/api/src/ai/prompts/` | 10 individual prompt files (one per concern) |
| `apps/api/src/config/ai.ts` | AI feature flags, model, base URL, timeouts, input format |
| `apps/web/src/pages/DashboardPage.tsx` | Main dashboard — all 5 numbered sections |
| `apps/web/src/pages/MemberDetailPage.tsx` | Per-member risk timeline + AI PR review |
| `apps/web/src/pages/StandupPage.tsx` | Standup submission + transcript parser |
| `apps/web/src/components/workspace/WorkspaceChrome.tsx` | Shared UI primitives: `SectionPanel`, `PanelHeader`, `MemberAvatar`, `StatusPill`, `WorkspaceHero` |
| `packages/shared/src/index.ts` | All shared types — the contract between web and API |
| `scripts/benchmark-toon.mjs` | Measures JSON vs TOON payload reduction with SprintPulse-shaped data |
| `scripts/check-role-switch-demo.mjs` | Confirms seeded judge personas can switch roles and see projects |

---

## System Architecture

```mermaid
flowchart TB
    %% ── External sources ──────────────────────────────────────────
    subgraph EXT ["  External Sources  "]
        direction LR
        JIRA["🔗 Jira REST API\nOAuth 2.0"]
        GH["Git provider REST API\nPer-project token"]
        USER["🧑 Team Members\nStandup submission\nTranscript paste"]
    end

    %% ── Supabase storage ──────────────────────────────────────────
    subgraph DB ["  Supabase  "]
        direction TB
        T1[("standups")]
        T2[("jira_issues")]
        T3[("git_commits")]
        T4[("project_members")]
        T5[("recommendations")]
        T6[("sync_runs")]
    end

    %% ── Express API ───────────────────────────────────────────────
    subgraph API ["  Express API — apps/api  "]
        direction TB
        SYNC["Sync Engine\n/api/integrations/jira/sync\n/api/integrations/git/sync"]
        FETCH["fetchSignals()\nLoads all sprint signals\nfrom Supabase"]
        BUILD["buildDashboard()\nRule-based scoring\nRisk flag detection"]
    end

    %% ── Intelligence layer ────────────────────────────────────────
    subgraph AI ["  Intelligence Layer  "]
        direction TB
        TOON["TOON Encoder\n~40% fewer input tokens"]

        subgraph PROMPTS ["10 Prompt Templates"]
            direction LR
            PA["Dashboard\nNarrative"]
            PB["Member\nHealth Scorer"]
            PC["Say-Do Gap\nDetector"]
            PD["Standup\nSpecificity"]
            PE["Transcript\nParser"]
            PF["PR Reviewer"]
            PG["Notification\nGenerator"]
            PH["Daily Status\nAnalyzer"]
        end

        CACHE["Signature Cache\nSame data → skip API call\nTTL: 10 min"]
        GATEWAY["GenAI Hub Gateway\ngpt-5.1-CIO\n/v1/chat/completions\njson_schema structured output"]
    end

    %% ── React SPA ─────────────────────────────────────────────────
    subgraph WEB ["  React SPA — apps/web  "]
        direction LR
        HERO["Hero\nHealthRing + Decision Brief"]
        QUEUE["Attention Queue\nFlag chips · evidence"]
        HEAT["Signal Heatmap\n14-day × N-member grid"]
        TRAIL["Evidence Trail\nChronological audit log"]
        PERSONA["Role Filter\nScrum Master · PO · EM\nDev · QA Lead"]
    end

    %% ── Data flow ─────────────────────────────────────────────────
    JIRA -->|"issues, story points\nstatus transitions"| SYNC
    GH -->|"commits, PRs\nreview age"| SYNC
    USER -->|"standup text\nZoom transcript"| API

    SYNC -->|"upsert rows"| T2
    SYNC -->|"upsert rows"| T3
    SYNC -->|"log run"| T6
    USER -->|"insert row"| T1

    T1 & T2 & T3 & T4 --> FETCH
    FETCH --> BUILD
    BUILD -->|"baseline\nMemberPulse[]"| TOON

    TOON --> PROMPTS
    PROMPTS --> CACHE
    CACHE -->|"cache miss"| GATEWAY
    GATEWAY -->|"JSON schema\nvalidated response"| CACHE
    CACHE -->|"AI overlay\nscores · narrative\nrecommendations"| T5

    T5 -->|"persist once/day"| DB

    BUILD -->|"AI-enhanced\nDashboardResponse"| WEB
    PERSONA -.->|"filters notifications\nand scoring"| QUEUE
```

---

## AI Pipeline

### Model

SprintPulse uses the GenAI Hub gateway (`/v1/chat/completions`, OpenAI-compatible format). The model is configurable via `OPENAI_MODEL`:

| Scenario | Model |
|----------|-------|
| Development / testing | `gpt-4.1-nano` — 20× cheaper, fast |
| Demo / judging | `gpt-5.1-CIO` — GPT-5.1 premium deployment, best output quality |
| Fallback | `gpt-4.1` — balanced cost and quality |

### 10 Prompt Templates

| Prompt | Purpose |
|--------|---------|
| `project-dashboard-narrative` | Sprint health score, readiness score, headline, next best action |
| `member-health-scorer` | Per-member health score, risk level, risk flags |
| `standup-specificity-scorer` | Detects vague standup language |
| `say-do-gap-detector` | Compares standup claims vs Jira/Git evidence |
| `daily-analysis-refresh` | Daily signal refresh across the sprint |
| `daily-status-story-analyzer` | Per-standup story analysis with Jira cross-reference |
| `role-notification-generator` | Role-aware notifications per persona |
| `transcript-parser` | Parses Zoom/Meet transcripts into per-speaker standups |
| `pr-reviewer` | Code review risk scoring per PR |
| `assistant-coach` | AI chat assistant for sprint coaching |

### Caching

AI results are cached in-memory with a **signature-based cache** — same sprint data = same signature = no API call, regardless of time elapsed. TTL is 10 minutes by default (`AI_CACHE_TTL_MINUTES`). Results are also persisted to the `recommendations` Supabase table once per day per project.

Manual **Sync AI analysis** runs also write a resolved dashboard snapshot to Supabase. Subsequent dashboard loads for the same project, sprint, and persona read that snapshot before calling the gateway, keeping judge demos fast even when the AI gateway is slow.

### TOON-Encoded Prompts

Every prompt payload is encoded in **TOON (Token-Oriented Object Notation)** — a JSON-equivalent format using indentation and tabular rows instead of braces. On tabular shapes (member rows, Jira tickets, commits, standups), TOON reduces input tokens by **~30–60%** versus `JSON.stringify`.

```
JSON:                              TOON:
{ "members": [                     members[2]{id,name,score,flags}:
  { "id": "u1",                      u1,Yash,34,3
    "name": "Yash",                  u2,Atharv,58,1
    "score": 34,
    "flags": 3 },
  { "id": "u2",
    "name": "Atharv",
    "score": 58,
    "flags": 1 }
] }
```

Toggle off with `AI_INPUT_FORMAT=json` for debugging. TOON fallback is `JSON.stringify` on any encoding failure.

Run `npm run benchmark:toon` to measure JSON versus TOON size on the bundled SprintPulse sample payload:

| Payload | JSON | TOON | Reduction |
|---------|------|------|-----------|
| `scripts/fixtures/toon-sprint-sample.json` | ~1,425 tokens | ~757 tokens | **46.9% fewer approximate tokens** |

Use `npm run benchmark:toon -- --json` when a machine-readable result is useful for slides or CI logs.

---

## Roles and Personas

`ProductPersona` enum: `scrum-master`, `product-owner`, `engineering-manager`, `developer`, `qa-lead`.

Scoring and notifications are role-filtered — a Scrum Master is never flagged for missing Git commits. Jira/Git evidence checks only apply to roles expected to own those signals.

---

## Run Locally

```bash
npm install
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
# fill in credentials in both .env files
npm run dev
```

- API: `http://localhost:4000`
- Web: `http://localhost:5173`

### Commands

```bash
npm run dev            # Start API + web concurrently
npm run dev:api        # API only (tsx watch)
npm run dev:web        # Web only (Vite)
npm run build          # Build shared → api → web (order matters)
npm run typecheck      # Typecheck all workspaces
npm run benchmark:toon # Compare JSON vs TOON size on SprintPulse-shaped data
npm run check:role-demo # Verify pre-configured role-switch personas can load projects
```

---

## Environment Variables

### `apps/web/.env`

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_URL=http://localhost:4000/api
VITE_DIRECT_SUPABASE_PROJECTS=true
VITE_ENABLE_AI_INSIGHTS=false
VITE_PROJECT_API_TIMEOUT_MS=8000
VITE_PROJECT_MUTATION_TIMEOUT_MS=10000
VITE_INTEGRATION_API_TIMEOUT_MS=30000
VITE_AI_API_TIMEOUT_MS=30000
```

### `apps/api/.env`

```bash
PORT=4000
ENABLE_MOCK_FLOW=false
ENABLE_AI_INSIGHTS=false

# GenAI Hub gateway
OPENAI_BASE_URL=https://hub-proxy-service.thankfulfield-16b4d5d6.eastus.azurecontainerapps.io
OPENAI_API_KEY=your-gateway-api-key
OPENAI_MODEL=gpt-5.1-CIO              # gpt-4.1-nano for testing, gpt-5.1-CIO for demo
AI_REQUEST_TIMEOUT_MS=20000
AI_CACHE_TTL_MINUTES=10               # set to 60 for demo
AI_INPUT_FORMAT=toon                  # toon (default) | json

SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

GIT_TOKEN_ENCRYPTION_KEY=replace-with-a-random-32-byte-secret
GITHUB_TOKEN=your-github-token            # optional legacy fallback
GITLAB_TOKEN=your-gitlab-token            # optional legacy fallback
GITLAB_API_BASE_URL=https://gitlab.com/api/v4
JIRA_CLIENT_ID=your-atlassian-oauth-client-id
JIRA_CLIENT_SECRET=your-atlassian-oauth-client-secret
JIRA_REDIRECT_URI=http://localhost:4000/api/jira/oauth/callback
```

Key flags:
- `ENABLE_MOCK_FLOW=true` — uses seeded in-memory demo data, no Supabase needed
- `ENABLE_AI_INSIGHTS=true` — enables AI scoring, recommendations, chat, notifications. Falls back to rule-based scoring when disabled or key is missing.
- `AI_CACHE_TTL_MINUTES=60` — recommended for demo to avoid redundant API calls

---

## Supabase Migrations

Run in order before setting `ENABLE_MOCK_FLOW=false`:

```
001_profiles.sql
002_projects.sql
003_performance_indexes.sql
004_project_ops.sql
005_invite_acceptance.sql
006_invite_flow_cleanup.sql
007_sprint_management.sql
008_project_visibility_scope.sql
009_jira_oauth_integration.sql
010_profile_claim_and_project_create.sql
011_demo_sprint_status_refresh.sql
012_standup_rls_manager_fix.sql
013_sync_runs_stats_column.sql
```

RLS is enforced at the DB level. The service role key (API-side) bypasses RLS. The anon key (web-side) respects it.

**Common RLS fixes:**
- `new row violates RLS policy for table "projects"` → re-run `010_profile_claim_and_project_create.sql`
- `new row violates RLS policy for table "standups"` → re-run `012_standup_rls_manager_fix.sql`

---

## Deployment

A single Docker container serves both the API and the compiled React SPA.

- **Port:** `8000` — Express serves **both** the React SPA (`/`) and the API (`/api/*`) from the same port in a single container. No separate web server needed.
- **Build:** Multi-stage Dockerfile — builder compiles `shared → web → api`, runtime stage installs prod-only deps and copies dist outputs.
- **VITE_ vars** are baked at build time via Dockerfile `ARG` (Supabase URL/anon key are safe public defaults).
- **Runtime secrets** — inject as environment variables on the platform (ECS / App Runner). Never bake into the image:
  - `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `GITHUB_TOKEN`, Jira OAuth credentials

```bash
# Build
docker build -t sprintpulse .

# Run
docker run -p 8000:8000 \
  -e SUPABASE_URL=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e OPENAI_BASE_URL=https://hub-proxy-service.thankfulfield-16b4d5d6.eastus.azurecontainerapps.io \
  -e OPENAI_API_KEY=... \
  -e OPENAI_MODEL=gpt-5.1-CIO \
  -e ENABLE_AI_INSIGHTS=true \
  sprintpulse
```

- React app: `http://localhost:8000`
- API: `http://localhost:8000/api`
- Health check: `http://localhost:8000/api/health`

---

## Demo Credentials & Test Scenarios

### Login

| Account | Email | Password | Role |
|---------|-------|----------|------|
| Maya Chen | `maya.chen@sprintpulse.dev` | `12345678` | Scrum Master |

Log in as Maya Chen to get the full Scrum Master view — all team members, full attention queue, all AI recommendations, and sync controls.

Seeded role-switch personas used by the API and MCP demos:

| Persona ID | Role | Demo expectation |
|------------|------|------------------|
| `maya-chen` | Scrum Master | Full team view, sync controls, AI refresh |
| `priya-shah` | Product Owner | Delivery risk and portfolio-focused summaries |
| `devon-reed` | Engineering Manager | Team health, workload, PR pressure |
| `leo-martinez` | Developer | Individual pulse and personal recommendations |
| `aisha-okafor` | QA Lead | Quality and test-risk signals |

Run `npm run check:role-demo` while the API is running to verify these personas exist and can load at least one project. For browser sign-in, create or confirm matching Supabase Auth users before the judge walkthrough.

---

### What You'll See on the Dashboard

The demo sprint has 8 team members with deliberately varied risk signals to showcase every detection type:

| Member | Health | Risk Level | Detection |
|--------|--------|------------|-----------|
| Yash | 64 | **High** | `SAY_DO_GAP` — "Working on scoring engine" with no commits. `BLOCKER_ANOMALY` — Jira/Git credentials blocker unresolved. |
| Mahesh | 71 | **Medium** | `VAGUE_UPDATE` — Standups say "form stuff", "continue form stuff" — no specifics. |
| Atharv | 78 | **Medium** | `STALE_WORK` — Same UI polish task across multiple standups, no Jira movement. |
| Vikrant | 74 | **Medium** | `TEST_RISK` — Smoke suite not started, validation checklist still forming. |
| Yanshi | 82 | Low | Clean — login flow progressing with evidence. |
| Janice | 80 | Low | Clean — pitch/walkthrough in progress. |
| Vipin | 88 | Low | Clean — architecture aligned, no blockers. |
| Priya | 86 | Low | Clean — product story on track. |

---

### Scenarios to Test

**1. AI Risk Detection (Dashboard)**
- Open the dashboard as Maya Chen
- Observe the P1 alert banner for Yash (high risk, unresolved blocker)
- Check **02 / Attention queue** — Yash and Mahesh appear at the top with flag chips (`SAY-DO GAP`, `VAGUE`)
- Hover signal heatmap cells to see day-level tooltips

**2. Member Deep-Dive**
- Click Yash in the attention queue
- Evidence timeline shows: standup claim vs zero commits vs Jira idle ticket
- `SAY_DO_GAP` and `BLOCKER_ANOMALY` flags with full explanations

**3. AI Refresh**
- Press **Sync AI analysis** on the dashboard
- Scores, narrative, and recommendations rewrite via `gpt-5.1-CIO`
- Role-aware notifications generate for Maya's Scrum Master view

**4. Transcript Parser**
- Go to **Standups → Parse Transcript**
- Paste any Zoom/Meet transcript with multiple speakers
- AI parses it into per-speaker structured standups with yesterday/today/blockers

**5. AI Chat Assistant**
- Use the floating assistant on the dashboard
- Ask: *"Who is most at risk of missing the sprint goal?"*
- Ask: *"What should I do about Yash's blocker?"*

**6. Role Switch**
- Scrum Master (Maya) — sees full team, all flags, sync controls
- Product Owner — sees delivery risk, no Git-level detail
- Engineering Manager — sees workload distribution and PR pressure
- Developer — sees only their own scores and recommendations
- Validation: `npm run check:role-demo`

---

## Demo Flow

1. Open dashboard — team health score, 4 flat stats, 5-detection breakdown.
2. Observe the P1 alert banner if any member is critical or has unresolved blockers.
3. Hover members in **02 / Attention queue** — flag chips name the exact detection (`STALE`, `SAY-DO GAP`, etc.).
4. Click a member — full evidence timeline + AI PR review panel.
5. Go to **Standups** — paste a Zoom/Meet transcript → AI parses per-speaker structured standups.
6. Press **Sync AI analysis** on the dashboard — runs the full prompt pipeline (TOON-encoded) and rewrites health/readiness scores + role-aware notifications.
7. Return to dashboard — scores update, trend delta pills (↑/↓) appear, P1 banner triggers if a member crossed the threshold.

---

## Transcript Integration

**Universal webhook endpoint** — `POST /api/projects/:projectId/transcripts/teams-webhook` accepts WebVTT (the default Teams export format) or plain `Speaker:` text. The organizer's email is the implicit authorization: it must match a profile in the target project, otherwise the route returns 404. The body flows through the same parser as the manual paste UI, runs AI-assisted speaker mapping, and inserts one standup entry per matched member into the active sprint. Full schema is documented in `docs/api/openapi.yaml` (`ingestTeamsTranscript`) and the end-to-end setup notes are in `docs/TEAMS_TRANSCRIPT_WEBHOOK.md`.

**VTT/TXT/MD/CSV file upload** — the existing transcript page (`StandupPage.tsx`) now also accepts `.vtt` files. After any Teams meeting with transcription enabled, the organizer clicks **Transcript → Download → VTT**, drops the file into SprintPulse, and standups land for every speaker the parser matches to a project member.

Both paths are source-agnostic: Teams, Zoom, Meet, or third-party transcript tools only need to provide WebVTT or speaker-labelled text. The reliable judge demo path is manual upload; the webhook path is ready for systems that can POST transcript JSON.

---

## MCP Server — SprintPulse as an Agent Tool

`packages/mcp-server` exposes the SprintPulse REST API as a [Model Context Protocol](https://modelcontextprotocol.io/) server so MCP-capable agent hosts such as Claude Code, Cursor, and Continue can discover and invoke SprintPulse capabilities without writing a per-host connector. One server, multiple agent runtimes, same backend.

### Tools shipped

| Tool | Purpose |
|---|---|
| `get_project_risk` | Current team health, top risks, P1 alert state, recommended next actions |
| `get_member_health` | Single member's pulse — flags, recent standups, supporting evidence |
| `submit_standup` | Create a structured standup entry on behalf of a member |
| `parse_transcript` | Turn a Teams/Zoom/Meet transcript into per-speaker standups + AI risk update |
| `run_member_pr_review` | AI review of a member's recent commits/PRs |
| `send_app_notification` | Create an in-app follow-up/action item for a project member |

Every tool is a thin HTTP wrapper over an existing `/api` route — no business logic in the MCP package, just protocol translation. App notifications are stored as open `recommendations` rows and appear in the notification panel and member history.

### Wiring into an agent host

```bash
# Build the server
npm run build -w packages/mcp-server
```

Then add it to your MCP host config. For **Claude Code** (`~/.claude/mcp_settings.json`):

```jsonc
{
  "mcpServers": {
    "sprintpulse": {
      "command": "node",
      "args": ["/absolute/path/to/Semicolons/packages/mcp-server/dist/index.js"],
      "env": {
        "SPRINTPULSE_API_BASE": "http://localhost:4000/api",
        "SPRINTPULSE_API_KEY": ""
      }
    }
  }
}
```

For **Cursor**: same shape in `~/.cursor/mcp.json`. Restart the client after editing. Existing Codex/agent sessions only discover the tool list at MCP startup, so restart/reload the host after adding new tools or rebuilding `packages/mcp-server`.

`SPRINTPULSE_API_KEY` is the shared secret between this MCP server and the SprintPulse API. When the API has `SPRINTPULSE_API_KEY` set in its own env (see `apps/api/.env.example`), every `/api/*` request must include the matching `X-SprintPulse-API-Key` header — or a valid Supabase JWT from a logged-in user — to pass the auth middleware. `/api/health` stays public for container probes. When neither side sets the var, the middleware is a no-op so local/dev flows are untouched.

If the API sits behind the SemicoLabs `?app=` router, include that query in `SPRINTPULSE_API_BASE`, for example `https://solution1.demopersistent.com/api?app=<app-id>`. The MCP server carries base query parameters into every tool request.

The web UI authenticates differently: `apps/web/src/api.ts` attaches `Authorization: Bearer <supabase-session-jwt>` to every API call, so the same middleware accepts logged-in users without sharing the MCP key with browsers.

### What an agent can actually do

Once wired, the agent discovers each tool's name + input schema through MCP's `tools/list`. Sample prompts that "just work":

> "Look up risk on project `bda0e205-…` as persona `yash`. If team health is below 70, pull each member's pulse and propose one mitigation per flag."

> "Here's the transcript from today's standup [pasted]. Parse it for project SCRUM as persona `yash` and report which members didn't have a clear today/yesterday."

> "Run the PR review tool on every developer in the SCRUM project. Summarise the top 3 review-pressure risks."

> "Notify Maya Chen in the app to clarify the OPS blocker and ask who owns the next action."

The agent decides which tools to call and in what order based on the prompt — SprintPulse just answers each question. Same backend as the UI, now callable from agent workflows.

### Why MCP over a custom plugin per host

Every agent host has its own connector format. MCP gives SprintPulse one shipped server that Claude Code, Cursor, Continue, and other MCP-capable hosts can discover through the same tool protocol.

The architecture position: **SprintPulse is the risk-and-readiness layer that agents call when they need to understand sprint state.** The MCP server and REST API expose the same backend capabilities, so UI users and agent users see the same project data.

Full setup and a template for adding new tools: `packages/mcp-server/README.md`.
