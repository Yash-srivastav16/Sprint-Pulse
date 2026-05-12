# SprintPulse AI Product Freeze

Phase: 1 - Product Owner
Status: frozen for next architecture pass
Date: May 11, 2026

## Product Intent

SprintPulse AI is a predictive sprint intelligence POC. It helps agile teams detect sprint delivery risk before sprint failure becomes visible in burndown charts or late status meetings.

The POC must prove one clear thing:

> SprintPulse connects what people say in standups with what project systems show, then turns those signals into role-aware sprint health insights.

This is not an MVP. The goal is a polished, judge-ready product flow that demonstrates business value with believable seeded/mock data.

## Target Demo Narrative

1. A user lands on a polished SprintPulse homepage.
2. They log in as a real role, not by selecting a flat demo persona card.
3. SprintPulse shows projects relevant to that role.
4. Authorized users can add a project or connect an existing Jira project.
5. A mocked Jira pull populates project, sprint, and team context.
6. The project home lets the team upload, paste, manually submit, or sync standups.
7. The dashboard shows sprint health, role-aware risks, say-do gaps, blockers, and recommendations.
8. Member detail explains why one person is at risk and what action to take.

## Personas And Access

| Persona | Business Need | Project Visibility | Project Admin | Jira Connect | Standup Actions | Dashboard Access |
| --- | --- | --- | --- | --- | --- | --- |
| Product Owner | Confidence that sprint progress supports product goals | Owned product initiatives | Yes | Yes | Optional | Team/project health |
| Scrum Master | Early warning on blockers, stale work, and standup quality | Facilitated projects/sprints | Yes | Yes | Yes | Full team health |
| Engineering Manager / Architect | Delivery risk and team-level health | Managed teams/projects | Yes | Yes | Optional | Cross-team/project health |
| Individual Developer | Self-awareness and assigned sprint work | Assigned projects only | No | No | Yes | Own pulse and limited team view |
| QA / Presentation | Demo validation and quality risks | Assigned/demo projects | No by default | No by default | Optional | Quality/demo view |

## Role-Based Rules

- Product Owner, Scrum Master, and Engineering Manager / Architect are elevated users.
- Elevated users can add projects, connect projects, and fetch Jira details.
- Individual Developers can submit standups and view assigned project health, but cannot configure Jira or create shared project records.
- QA can validate demo projects and inspect quality-facing risk, but should not manage project setup by default.
- Presentation/demo users can see a guided view if needed, but should not change source data during demo.

## Frozen POC Screen Flow

```text
Public Homepage
-> Login
-> Project List
-> Add Project or Connect Existing Project (authorized users only)
-> Mock Jira Fetch or Manual Project Setup
-> Project Workspace Home
-> Standup Upload / Paste Transcript / Manual Update / Sync Placeholder
-> Sprint Health Dashboard
-> Member Detail
```

## Route Intent

These route names are product intent only. Architecture can refine the exact implementation.

| Route | Purpose | Access |
| --- | --- | --- |
| `/` | Public homepage before login | Public |
| `/login` | Email/password demo login | Public |
| `/projects` | Role-aware project list | Authenticated |
| `/projects/new` | Manual add project | Elevated users |
| `/projects/connect` | Connect existing project / Jira fetch | Elevated users |
| `/projects/:projectId` | Project workspace home | Project members |
| `/projects/:projectId/standups` | Standup upload/paste/manual/sync | Project members |
| `/projects/:projectId/dashboard` | Sprint health dashboard | Role-aware |
| `/projects/:projectId/members/:memberId` | Member pulse detail | Role-aware |

## POC Scope

### Must Have

- Polished public homepage with clear value proposition and login CTA.
- Real-looking login flow using seeded demo users.
- Role-aware project list.
- Elevated-only add/connect project actions.
- Manual project setup.
- Mock Jira fetch that populates project, sprint, and team details.
- Project workspace home with standup actions.
- Manual standup submission.
- Paste transcript parser mock.
- Sprint health dashboard with rich visual treatment.
- Member detail with risk explanation.
- Compact context documentation for continuation.

### Should Have

- Auto-sync placeholder with last-sync and next-sync status.
- Seeded multi-project data so personas feel distinct.
- Project-level team member management in manual setup.
- Role-specific dashboard recommendations.
- QA smoke checklist.

### Could Have

- Audio upload UI placeholder.
- Mock GitHub activity adapter.
- Mock OpenAI recommendation adapter.
- Demo mode toggle for presentation.
- Exportable report or slide-friendly summary.

### Won't Have For POC

- Production SSO/OAuth.
- Real Jira token storage.
- Real GitHub integration with secrets.
- Production database.
- Multi-tenant admin management.
- Full background sync infrastructure.
- Live meeting bot.

## User Stories

### Story 1 - Public Homepage

As a prospective SprintPulse user, I want to understand what the product does before logging in, so that I can see why sprint intelligence is valuable.

Acceptance criteria:

- Given I open the app without being logged in, when the page loads, then I see a polished homepage with product name, value proposition, and login CTA.
- Given I am on the homepage, when I choose the login CTA, then I am taken to the login screen.
- Given I am on a mobile viewport, when I view the homepage, then the content remains readable and actions do not overlap.

### Story 2 - Role-Based Login

As a demo user, I want to log in with an email and password, so that the app can show the correct project and dashboard permissions for my role.

Acceptance criteria:

- Given I enter a seeded team email and the demo password, when I submit login, then I am authenticated.
- Given I enter an unknown email, when I submit login, then I see a clear error message.
- Given I enter a wrong password, when I submit login, then I see a clear error message.
- Given I refresh after login, when my session exists, then my role-aware workspace remains available.

### Story 3 - Project List

As an authenticated user, I want to see the projects relevant to my role, so that I can choose the sprint workspace I need.

Acceptance criteria:

- Given I am a developer, when I open projects, then I only see assigned projects.
- Given I am a Scrum Master, Product Owner, or Manager/Architect, when I open projects, then I see the projects I manage or facilitate.
- Given no projects are available, when I open projects, then I see a useful empty state.
- Given a project is selected, when I open it, then I land on the project workspace home.

### Story 4 - Add Project

As an elevated user, I want to manually add project and sprint details, so that SprintPulse can score a sprint even without Jira access.

Acceptance criteria:

- Given I am an elevated user, when I open project actions, then I can choose add project.
- Given I am a developer, when I open project actions, then add project is not available.
- Given I submit project name, key, sprint name, sprint dates, sprint goal, and people details, then the project workspace is created.
- Given required fields are missing, when I submit, then I see validation errors.

### Story 5 - Connect Jira Project

As an elevated user, I want to fetch an existing project from Jira, so that SprintPulse can quickly create sprint context.

Acceptance criteria:

- Given I am an elevated user, when I choose connect existing project, then I can enter Jira site/project key.
- Given I trigger the POC Jira fetch, when the mocked fetch succeeds, then project, sprint, and team details are populated.
- Given the Jira fetch fails, when I need to continue the demo, then I can fall back to manual setup.
- Given I am not elevated, when I view the project screen, then Jira connect actions are hidden or disabled.

### Story 6 - Project Workspace Home

As a project member, I want one workspace home for sprint actions, so that I can quickly submit or sync standups and review current health.

Acceptance criteria:

- Given I open a project, when the workspace loads, then I see sprint goal, dates, team participation, sync status, and next recommended action.
- Given I need to add standup data, when I choose an input action, then I can upload, paste, manually submit, or view sync options.
- Given auto-sync is not real yet, when I view sync settings, then the UI clearly presents it as a POC placeholder.

### Story 7 - Standup Input

As a project member, I want to submit standup data, so that SprintPulse can calculate risk signals.

Acceptance criteria:

- Given I submit manual yesterday/today/blockers data, when validation passes, then the standup is added to the current project context.
- Given I paste a transcript, when I run parse, then SprintPulse shows speaker-level parsed updates.
- Given parsing is mocked, when I show it in demo, then the UI still clearly communicates the intended AI behavior.
- Given required data is missing, when I submit, then errors are clear and recoverable.

### Story 8 - Sprint Dashboard

As a Scrum Master or manager, I want a sprint dashboard, so that I can detect delivery risk and decide next action.

Acceptance criteria:

- Given I open the dashboard, when data loads, then I see sprint health score, at-risk count, blockers, risk flags, and recommendations.
- Given a person is high risk, when I inspect their signals, then I can see why they are at risk.
- Given I am a developer, when I view the dashboard, then I see an individual or limited team view appropriate to my role.
- Given data is loading or unavailable, then I see polished loading/error states.

### Story 9 - Member Detail

As a team lead or team member, I want a member pulse detail page, so that I can understand the reason behind a health score.

Acceptance criteria:

- Given I open a member detail page, then I see standup history, tickets, Git signal placeholders, risk flags, and recommendation.
- Given I do not have permission to view full member data, then the UI limits or redirects the view.
- Given there are no flags, then the page shows a positive empty state.

## Demo Success Criteria

- Judges can understand the product in the first 20 seconds of the homepage.
- Login feels like a real application.
- Role permissions are visible and believable.
- Jira connection is clearly shown as a POC-safe mock.
- The dashboard feels polished enough for UX scoring.
- The app demonstrates the unique value: connecting standup claims with project delivery signals.
- The team has a fallback path if sync/parser/Jira features are not ready.

## Out Of Scope Clarifications

- SprintPulse is not a people-surveillance tool. Copy should frame insights as team support and early warning, not individual punishment.
- Mocked integrations are acceptable for the POC if the replacement path is clear.
- The UX should prioritize a strong demo path over exhaustive admin settings.

