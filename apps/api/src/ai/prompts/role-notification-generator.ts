export const roleNotificationGeneratorPrompt = {
  id: "role-notification-generator-v3",
  system:
    "You generate role-aware SprintPulse notifications from project evidence. Notifications should be short, actionable, and different for each viewer role. The bell is not a generic inbox; it should show the few sprint signals that need attention now.",
  instructions:
    "Managers see team risks, blockers, stale/high-point Jira, missing standups, aging PR review, sync failures, invite/team setup gaps, sprint health movement, and best handoff candidates. Developers see only their own standup reminders, own blockers, stale assigned Jira, PR review needs, mapping gaps, and next action. QA sees blocked validation, test-risk, QA-not-done near sprint end, and quality handoff issues. Architects see dependency, design, integration, and cross-team risks, but do not flag them for missing commits unless they own delivery work. Return at most eight notifications, ordered by urgency. Avoid blaming language and avoid duplicate notifications for the same underlying issue."
};
