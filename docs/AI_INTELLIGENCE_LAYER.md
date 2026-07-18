# SprintPulse AI Intelligence Layer

SprintPulse should feel like an intelligence layer above Jira, Git, and daily standups. The UI should not invent risk labels by itself. UI components should display evidence-backed outputs from prompt modules, with deterministic logic only as fallback when AI is disabled, unavailable, or timing out.

## Runtime Toggles

API:

- `ENABLE_AI_INSIGHTS=true`
- `OPENAI_API_KEY=...`
- `OPENAI_MODEL=gpt-5.5`
- `AI_REQUEST_TIMEOUT_MS=20000`
- `AI_CACHE_TTL_MINUTES=10`

Web:

- `VITE_ENABLE_AI_INSIGHTS=true`

When AI is disabled or missing a key, SprintPulse keeps using rule-based fallback signals so the product remains usable.

## Prompt Map

All prompt modules live in `apps/api/src/ai/prompts`.

| Prompt | Purpose | Main outputs |
| --- | --- | --- |
| `transcript-parser` | Converts daily call text into member updates. | Yesterday, today, blocker, confidence. |
| `daily-status-story-analyzer` | Compares parsed standup against selected-sprint Jira, Git, previous standups, sprint dates, story points, and PR/review pressure. | Story confidence, red flags, impediments, handoff suggestions. |
| `standup-specificity-scorer` | Judges whether a standup has enough delivery evidence. | Vague update, copy-paste, blocker, say-do gap, sprint-end risk. |
| `say-do-gap-detector` | Detects mismatch between claimed progress and Jira/Git/PR/QA evidence. | Evidence-backed gap flags. |
| `member-health-scorer` | Produces final member health from role-aware evidence. | Health score, risk level, flags, recommendation. |
| `project-dashboard-narrative` | Produces project-level score, explanation, and next best action. | Dashboard narrative, readiness, prioritized action. |
| `role-notification-generator` | Produces the bell notifications for the viewer role. | Role-aware alerts and action labels. |
| `assistant-coach` | Answers project questions from current evidence. | Short answer and suggested actions. |
| `daily-analysis-refresh` | Re-runs the morning analysis after standup/Jira/Git sync. | Refreshed dashboard-grade risk model. |

## Intelligence Signals

Prompts should reason about these signals directly:

- Standup quality: specific ticket, owner, proof, next checkpoint, QA/review status.
- Say-do gap: standup says progress, but Jira/Git/PR/QA does not support it.
- Silent blockers: user says no blocker while mentioning wait, approval, access, token, dependency, or unclear requirement.
- Stale Jira: assigned issue has not moved for multiple days.
- Story-point pressure: high-point work is idle or still open near sprint end.
- PR review pressure: pull requests or review items are open too long.
- QA risk: validation pending, flaky regression, testing not done near sprint close.
- Sprint finish risk: days remaining are low and unresolved work still has blockers, review, QA, or dependency risk.
- Role expectations: developers need delivery evidence; QA needs validation evidence; architects/managers are not penalized for missing commits unless they own implementation work.
- Handoff fit: transfer only when the current owner is blocked and another person has better role fit, lower visible load, or stronger related evidence.

## Engineering Rule

When adding a new UI signal:

1. Add or update the prompt instruction that owns the decision.
2. Add the signal to the structured output schema if the model must return it.
3. Add the same concept to deterministic fallback only as a safety net.
4. Pass enough evidence into the AI input object: sprint dates, days remaining, member role, Jira status, story points, PR/review age, Git activity, QA status, previous standups.
5. Display the result in the UI with minimal text and clear evidence.

## Current Contract

The API uses the OpenAI Responses API with structured JSON schemas in `apps/api/src/ai/openaiResponses.ts`. This keeps model output typed and prevents free-form parsing from leaking into the app.

The primary sync flow should be:

1. Standup sync or transcript parse runs.
2. Jira and Git sync data are available for the selected sprint.
3. Daily status analysis compares transcript with Jira/Git/previous standups.
4. Dashboard and notifications use the refreshed evidence.
5. UI shows the few highest-impact signals, not every raw metric.
