# SprintPulse AI Master Agent

Status: dormant. Do not run unless explicitly invoked.

This is the single orchestration agent for building SprintPulse AI using the role skills in `Codex/skills`.

## Mission

Build SprintPulse AI as a hackathon POC, not an MVP. The agent must drive the work from product flow to architecture, UX, implementation, QA, and demo preparation while keeping the experience polished enough for UX scoring.

The goal is a working, judge-ready POC for Semicolon on May 16-17, 2026.

## Core Product Flow

The app must feel like a real SaaS product, not a raw prototype.

1. **Public Home Page**
   - Premium, polished SprintPulse landing/home experience.
   - Clear product positioning: predictive sprint intelligence.
   - Primary CTA: login.
   - Should visually communicate standups + Jira + delivery signals + sprint health.
   - No basic/plain UI. No generic template feel.

2. **Login**
   - Real login screen, not a persona picker.
   - Demo users should map to realistic personas:
     - Product Owner
     - Scrum Master
     - Engineering Manager / Architect
     - Individual Developer
     - QA / Presentation
   - Each persona should see only the project/actions appropriate to their role.

3. **Project Screen**
   - Show running projects assigned to the logged-in user.
   - Developer sees projects/sprints they are assigned to.
   - Scrum Master sees projects/sprints they facilitate.
   - Product Owner sees owned product initiatives.
   - Architect/Manager sees team-level/project-level health.
   - QA sees validation/demo quality context.

4. **Project Actions**
   - Users with Scrum Master or higher access can:
     - Add a new project.
     - Connect an existing project.
     - Pull project details from Jira.
   - Individual developers should not get admin-level project setup actions unless explicitly allowed.

5. **Add / Connect Project**
   - Manual add project:
     - Project name
     - Project key
     - Sprint name
     - Sprint dates
     - Sprint goal
     - Team members
     - Roles
     - Jira/GitHub mapping placeholders
   - Connect existing:
     - Mock Jira connection first.
     - Later real Jira REST API adapter.
   - No committed secrets or real tokens.

6. **Project Home**
   - Once inside a project, show a project workspace home.
   - Primary actions:
     - Upload standup
     - Paste transcript
     - Manual standup update
     - Sync standups
     - Auto-sync settings placeholder
   - Show recent sync status, team participation, unresolved blockers, and next recommended action.

7. **Dashboard**
   - Premium sprint intelligence dashboard.
   - Include:
     - Sprint health score
     - Demo/UX readiness score if useful for hackathon presentation
     - At-risk members
     - Standup quality
     - Say-do gap
     - Jira movement
     - Git activity placeholder
     - Blockers
     - Burnout/stale work flags
     - Recommendations
   - Must be visually appealing, scannable, and operationally credible.

8. **Member Detail**
   - Individual pulse.
   - Standup history.
   - Jira tickets.
   - Git signals.
   - Risk flags.
   - Recommendation.

9. **QA + Demo**
   - Manual smoke tests.
   - Demo script.
   - Fallback plan if Jira/API sync is unavailable.

## Required Role Skills

Use these skills as internal modes. Load the relevant file before acting in that role.

| Work Mode | Skill File | When To Use |
| --- | --- | --- |
| Product Owner | `Codex/skills/01_Product_Owner_skills.md` | Scope, user stories, persona access, acceptance criteria |
| Solutions Architect | `Codex/skills/04_Solutions_Architect_skills.md` | Architecture, API contracts, mock-vs-real decisions |
| UX/UI Designer | `Codex/skills/05_UXUI_Designer_skills.md` | Screen flow, information hierarchy, UX scoring polish |
| Frontend Developer | `Codex/skills/07_Frontend_Developer_skills.md` | React/Vite screens, routing, UI implementation |
| Backend Developer | `Codex/skills/08_Backend_Developer_skills.md` | Express APIs, data contracts, mock adapters |
| QA Engineer | `Codex/skills/10_QA_Engineer_skills.md` | Smoke tests, defect risk, edge cases |
| Code Reviewer | `Codex/skills/21_Code_Reviewer_skills.md` | Review bugs, regressions, missing tests |
| Technical Writer | `Codex/skills/17_Technical_Writer_skills.md` | Demo script, README, presentation notes |
| Business Sponsor | `Codex/skills/19_Stakeholder_Business_Sponsor_skills.md` | Business value, commercialization, judge framing |

## Execution Strategy

Do not code randomly. Use this sequence.

### Phase 1: Product Freeze

Use Product Owner mode.

Outputs:
- POC scope.
- Persona and access matrix.
- Screen flow.
- Must-have vs nice-to-have.
- Acceptance criteria.

Do this before major code changes.

### Phase 2: Architecture Freeze

Use Solutions Architect mode.

Outputs:
- App routes.
- API contracts.
- Data model.
- Mock vs real integration plan.
- Jira/GitHub/OpenAI replacement path.
- Risks and fallback plan.

### Phase 3: UX Direction

Use UX/UI Designer mode.

Outputs:
- Screen-by-screen layout.
- Interaction states.
- Empty/loading/error states.
- Visual quality checklist.
- UX scoring improvements.

### Phase 4: Implementation

Use Backend Developer and Frontend Developer modes.

Sequential work:
- Shared contracts must be updated before frontend consumes new data.
- Auth/project access rules must be implemented before UI depends on role gating.
- Project setup APIs must exist before frontend Jira/project flows are wired.

Parallel work:
- Dashboard UI polish can happen while backend seed data is refined.
- Standup input UI can happen while transcript parser mock is refined.
- QA checklist can be drafted while implementation continues.
- Presentation draft can start after core flow is stable.

### Phase 5: QA

Use QA Engineer and Code Reviewer modes.

Outputs:
- Smoke test matrix.
- Critical demo risks.
- Regression checks.
- Missing tests or fallback notes.

### Phase 6: Demo Package

Use Technical Writer and Business Sponsor modes.

Outputs:
- Two-minute pitch.
- Five-minute demo script.
- Judge-facing value proposition.
- Fallback narration.

## Context Compaction Protocol

Maintain a compact context file as work progresses.

Create or update:

`docs/SPRINTPULSE_CONTEXT.md`

Keep it short and current:

```md
# SprintPulse Context

## Current Goal

## Product Flow

## Personas And Access

## Current Stack

## Current Routes

## API Contracts

## Mocked Integrations

## Completed Work

## Open Decisions

## Next 3 Tasks
```

Rules:
- Update this file after each meaningful phase.
- Keep it concise enough that a new Codex session can resume quickly.
- Prefer summaries over long logs.
- Do not paste huge code blocks into the context file.

## Current Technical Stack

- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Data: seeded/mock data first
- Integrations: mock Jira first, real Jira later
- Auth: demo login with role/persona access
- Goal: working POC, not production MVP

## Current Repository Areas

- Frontend: `apps/web/**`
- Backend: `apps/api/**`
- Shared contracts: `packages/shared/**`
- Docs: `docs/**`
- Role skills: `Codex/skills/**`

## Implementation Guardrails

- Do not commit real secrets.
- Do not implement production OAuth unless explicitly requested.
- Do not overbuild cloud infrastructure before the local POC is stable.
- Do not turn the homepage into only marketing; it must quickly lead to the product flow.
- Keep UI polished and professional.
- Follow frontend design guidelines:
  - Sophisticated operational SaaS UI.
  - Clear hierarchy.
  - Stable dimensions.
  - Responsive layouts.
  - No text overflow.
  - No card-inside-card nesting.
  - No decorative gradient orbs.
  - No one-note palette.
  - Use icons where useful.
  - Use real product UI, not a plain demo page.

## Role-Based Access Direction

Suggested access model:

| Persona | Can View Projects | Can Add Project | Can Connect Jira | Can Submit Standup | Can View Team Dashboard |
| --- | --- | --- | --- | --- | --- |
| Product Owner | Yes | Yes | Yes | Optional | Yes |
| Scrum Master | Yes | Yes | Yes | Yes | Yes |
| Engineering Manager / Architect | Yes | Yes | Yes | Optional | Yes |
| Individual Developer | Assigned only | No | No | Yes | Own/team limited |
| QA | Assigned/demo projects | No by default | No by default | Optional | Quality/demo view |

## First Build Target

The first complete usable flow should be:

```text
Homepage
-> Login
-> Project list
-> Add/connect project if authorized
-> Mock Jira fetch or manual project setup
-> Project workspace home
-> Upload/paste/manual standup
-> Dashboard
-> Member detail
```

## Definition Of Done

The POC is ready when:

- A user can login.
- Persona role changes available actions.
- Project list is visible.
- Authorized users can add/connect a project.
- Mock Jira fetch populates project/sprint/team details.
- A user can submit or paste a standup.
- Dashboard shows sprint health and risks.
- Member detail explains why a person is at risk.
- QA smoke checklist passes.
- Demo script exists.

## How To Invoke This Agent

Use:

```text
@Codex/agents/00_sprintpulse_master_agent.md

Run Phase 1 only. Do not code yet.
```

or:

```text
@Codex/agents/00_sprintpulse_master_agent.md

Continue from docs/SPRINTPULSE_CONTEXT.md and implement the next safest phase. Do not start dev server.
```

or:

```text
@Codex/agents/00_sprintpulse_master_agent.md

Implement the full first build target. Use sequential or parallel work where safe. Keep updating docs/SPRINTPULSE_CONTEXT.md.
```

