# SprintPulse AI UX Direction

Phase: 3 - UX/UI Designer
Status: frozen for first implementation pass
Date: May 11, 2026

## UX Goal

SprintPulse must feel like a real operational SaaS product, not a hackathon sketch. The user should immediately understand:

- What SprintPulse does.
- Which project/sprint they are working in.
- What action they should take next.
- Why a sprint or person is at risk.
- Which features are mocked for the POC and which are reliable fallback paths.

The UI should score well on clarity, visual polish, responsiveness, and demo confidence.

## Experience Principles

1. **Product-first, not pitch-first**
   - The homepage introduces the product, but the app should quickly move users into login and project work.

2. **Role-aware from the first authenticated screen**
   - Users should feel their role matters. Developers see assigned work; Scrum Masters and Product Owners see project controls.

3. **Operational density with breathing room**
   - This is an agile/productivity tool. Avoid oversized marketing sections inside the authenticated app. Use compact, scan-friendly layouts.

4. **Mocked integrations should feel honest**
   - Jira fetch and auto-sync can be mocked, but the UI should label the behavior as a POC-safe mock or preview.

5. **Every screen needs an obvious next action**
   - Users should never wonder what to do after landing on a page.

## Navigation Model

### Public

```text
Homepage -> Login
```

### Authenticated

```text
Projects
-> Project Workspace
   -> Standups
   -> Dashboard
   -> Member Detail
   -> Team/Sprint Context
```

### Primary Authenticated Navigation

Left sidebar or top-level shell:

- Projects
- Current project
- Standups
- Dashboard
- Team
- Plan or Demo Notes

Use icons for navigation. Keep labels short.

## Visual System Direction

### Tone

Professional, modern, calm, high-signal. The visual language should imply “engineering intelligence cockpit” without becoming dark, noisy, or gimmicky.

### Color

Use a balanced palette:

- Deep ink for navigation and headings.
- Teal for healthy/progress/action.
- Coral/red for risk.
- Amber for warnings/blockers.
- Blue for system/integration/Jira.
- Violet sparingly for AI/recommendation accents.

Avoid:

- One-note blue/slate screens.
- Purple-heavy gradients.
- Beige/brown themes.
- Decorative orbs or bokeh.

### Shape And Layout

- Cards: maximum `8px` radius.
- No cards inside cards.
- Page sections should be full-width layout areas, not nested decorative panels.
- Dense repeated items can be cards, rows, or tiles.
- Use stable dimensions for score tiles, project cards, buttons, and rows to avoid layout shifts.

### Typography

- Use hero-scale type only on public homepage.
- Authenticated screens should use compact headings.
- Do not scale font sizes with viewport width.
- Letter spacing should remain `0`.
- Ensure labels and long project names wrap cleanly.

## Screen Specifications

## 1. Public Homepage

### Purpose

Explain SprintPulse in under 20 seconds and route the user to login.

### Layout

First viewport:

- Top nav with SprintPulse logo/name and login button.
- Full-width hero, not a split card layout.
- Hero headline: `SprintPulse AI`
- Subheadline: predictive sprint intelligence that connects standups, Jira, and delivery signals.
- Primary CTA: `Login`
- Secondary CTA: `View demo flow` or `See sprint signals`
- Right/lower hero area can show a product-like dashboard preview, not a generic illustration.

Below fold:

- Three signal columns: Standups, Jira, Delivery.
- One “Say-do gap” explanation band.
- Small commercial/value proof section.

### Required States

- Public user.
- Already-authenticated user should see `Go to projects`.

### Avoid

- Long marketing page.
- Decorative-only hero.
- Text inside oversized cards.
- Fake pricing or unsupported claims.

## 2. Login

### Purpose

Make demo login feel real while still simple.

### Layout

- Left side: product trust copy and short explanation.
- Right side: email/password form.
- Demo helper area below form with selectable demo accounts.

### Fields

- Email.
- Password.

### Copy

- Demo password helper: `Use sprintpulse for seeded demo users.`
- Error message should explain exactly what failed.

### Required States

- Idle.
- Loading.
- Invalid email.
- Wrong password.
- Already logged in.

### Accessibility

- Inputs need visible labels.
- Error text should be associated visually with the form.
- Submit button must be keyboard reachable.

## 3. Project List

### Purpose

Show the user’s available project workspaces and role-specific actions.

### Layout

Header:

- `Projects`
- Supporting text based on persona:
  - Developer: “Your assigned sprint workspaces.”
  - Scrum Master: “Projects and sprints you facilitate.”
  - Product Owner: “Product initiatives connected to sprint delivery.”

Action bar:

- Elevated users: `Add project`, `Connect Jira`
- Non-elevated users: no admin buttons; show `Ask Scrum Master to connect Jira` as text or disabled explanation if needed.

Main content:

- Project cards or table rows.
- Each project item shows:
  - Project name/key.
  - Active sprint.
  - Sprint health score.
  - At-risk members.
  - Last sync.
  - User’s role in project.
  - CTA: `Open workspace`.

### Empty States

Developer:

- “No assigned projects yet. Ask your Scrum Master to add you to a SprintPulse project.”

Elevated user:

- “No projects connected yet. Add a project manually or fetch one from Jira.”

### Required States

- Loading skeleton.
- Empty.
- Has projects.
- Permission-limited action.

## 4. Add Project

### Purpose

Manual fallback when Jira is unavailable.

### Layout

Use a structured multi-section form, not a giant flat form.

Sections:

1. Project identity
   - Project name.
   - Project key.
   - Source defaults to manual.

2. Sprint details
   - Sprint name.
   - Start date.
   - End date.
   - Sprint goal.

3. People details
   - Team members.
   - Role.
   - Email.
   - Optional Jira account id.
   - Optional GitHub username.

4. Review and create
   - Summary preview.
   - CTA: `Create project workspace`.

### Interaction

- Use segmented steps or clear section bands.
- Validate required fields inline.
- Allow adding/removing team members.
- On success, navigate to project workspace.

### Required States

- Draft.
- Validation error.
- Creating.
- Success.

## 5. Connect Existing Project / Jira Fetch

### Purpose

Demonstrate fast setup from Jira while staying demo-safe.

### Layout

Header:

- `Connect Jira project`
- Clear POC note: “This demo uses a mocked Jira import. Real Jira tokens are not stored.”

Form:

- Jira site.
- Project key.
- Optional sprint selector placeholder.

Preview panel:

- What will be imported:
  - Project details.
  - Active sprint.
  - Issues.
  - Assignees/team members.
  - Status movement.

Import result:

- Imported issues count.
- Imported members count.
- Sprint name.
- Warnings.
- CTA: `Open workspace`.

### Required States

- Idle.
- Fetching.
- Success.
- Failed with fallback to manual add.
- Permission denied for non-elevated users.

## 6. Project Workspace Home

### Purpose

This is the authenticated “home” after project selection. It should tell users what is happening and what to do next.

### Layout

Top band:

- Project name/key.
- Active sprint.
- Sprint dates.
- User role.
- Health score.

Primary action strip:

- `Submit standup`
- `Paste transcript`
- `Upload audio` placeholder
- `Sync standups` placeholder

Workspace summary:

- Participation rate.
- Open blockers.
- At-risk count.
- Last sync.
- Next sync.
- Sprint day / days remaining.

Recommended next action:

- One highlighted action based on role and project health.

Secondary sections:

- Recent standups.
- Team pulse preview.
- Jira import status.
- Demo-safe warnings if mocked.

### Role Differences

Developer:

- Primary action should be `Submit standup`.
- Show own pulse and assigned tickets.

Scrum Master:

- Primary action should be `Review blockers` or `Sync standups`.
- Show team participation and risks.

Product Owner:

- Primary action should be `Review delivery confidence`.
- Show product goal and sprint health.

QA:

- Primary action should be `Run demo smoke check` or `Review quality risks`.

## 7. Standup Input

### Purpose

Collect the communication signal that powers SprintPulse.

### Layout

Use tabs or segmented control:

- Manual update.
- Paste transcript.
- Upload audio.
- Sync settings.

Manual:

- Yesterday.
- Today.
- Blockers.
- Linked ticket optional.

Transcript:

- Large text area.
- Parse CTA.
- Parsed speaker results.
- Confidence indicators.
- Save selected parsed updates.

Upload:

- File drop zone placeholder.
- Explain POC limitation if not real.

Sync:

- Auto-sync preview.
- Last sync.
- Next sync.
- Source: Jira/Slack/Teams placeholder.

### Required States

- Empty.
- Draft.
- Submitting.
- Submitted.
- Parser loading.
- Parser result.
- Parser error.

## 8. Dashboard

### Purpose

Make sprint risk obvious and explainable.

### Layout

Top:

- Project/sprint context.
- Sprint health score.
- Risk trend.
- Demo/readiness score optional.

Metrics:

- At-risk members.
- Open blockers.
- Standup quality.
- Say-do gap count.
- Jira stale items.
- Git activity placeholder.

Main panels:

- Team risk order.
- Active flags.
- Recommendations.
- Standup quality over time placeholder.

### Data Explanation

Every risk flag needs:

- Type.
- Severity.
- Affected person.
- Evidence sentence.
- Recommended action.

### Required States

- Loading.
- No data yet.
- Healthy sprint.
- At-risk sprint.
- Permission-limited view.

## 9. Member Detail

### Purpose

Explain the why behind a person’s score.

### Layout

Header:

- Member identity.
- Role.
- Health score.
- Risk badge.

Evidence sections:

- Standup history.
- Jira tickets.
- Git signals.
- Risk flags.
- Recommendation.

### Role-Gating

- Developer can view own detail and maybe limited teammate summary.
- Scrum Master/Manager can view full team detail.
- QA can view quality/demo-sensitive detail.

### Required States

- Full access.
- Limited access.
- No flags.
- Member not found.

## Interaction Specifications

### Buttons

- Use icon + label for primary operational actions.
- Use icon-only only for obvious actions with tooltip/title.
- Primary CTAs should be visually consistent.
- Destructive actions are not needed for the POC.

### Navigation

- Breadcrumbs or project context should be visible inside project-scoped pages.
- Sidebar should show current project once selected.
- Avoid hiding core demo navigation behind menus on desktop.

### Loading

- Use skeleton rows/cards where possible.
- Loading copy should be short:
  - `Loading projects`
  - `Importing Jira project`
  - `Parsing transcript`

### Error Recovery

Every failed integration-like action must offer a fallback:

- Jira fetch failed -> manual project setup.
- Transcript parse failed -> manual standup.
- Sync unavailable -> paste transcript/manual update.

## Accessibility Requirements

- All forms have visible labels.
- All icon buttons have accessible names.
- Color is never the only risk indicator; include text labels.
- Focus states must be visible.
- Keyboard users can complete login, project creation, Jira fetch, and standup submission.
- Risk lists should use semantic list or table-like structure.
- Heading order should be logical: one `h1` per page, sections as `h2`.

## Responsive Behavior

Desktop:

- Sidebar + wide content grid.
- Project list can use 2-column cards or dense rows.
- Dashboard can use multi-column panels.

Tablet:

- Collapse grids to 1-2 columns.
- Keep action buttons visible.

Mobile:

- Single-column layout.
- Project cards become stacked rows.
- Hide secondary metadata only if still accessible inside detail.
- Do not truncate critical risk copy beyond recognition.

## UX Scoring Checklist

Use this before implementation is called complete.

- Homepage explains value in under 20 seconds.
- Login feels real, not toy-like.
- Role permissions are visible and believable.
- Project list clearly differs by persona.
- Elevated-only actions are obvious.
- Jira mock is transparent but still compelling.
- Project workspace gives a clear next action.
- Dashboard is visually polished and scannable.
- Every risk signal explains evidence and action.
- Fallback paths are visible.
- No text overlap on mobile.
- No nested cards.
- No decorative visual clutter.
- All critical actions are keyboard accessible.

## Implementation Priority From UX

1. Public homepage.
2. Project list with role-aware actions.
3. Project workspace home.
4. Add project and connect Jira split.
5. Project-scoped dashboard route.
6. Project-scoped standup route.
7. Project-scoped member detail route.

## Recommended First Implementation Slice

Build the smallest complete role-aware loop:

```text
Homepage
-> Login as Scrum Master
-> Projects
-> Connect Jira mock
-> Project workspace
-> Dashboard
```

Then add:

```text
Login as Developer
-> Projects
-> Project workspace
-> Submit standup
-> Member detail
```

