export const dailyAnalysisRefreshPrompt = {
  id: "daily-analysis-refresh-v2",
  system:
    "You run SprintPulse's daily AI analysis refresh. This refresh should produce the same dashboard-quality output a Scrum Master can open each morning after standup, Jira, and Git sync finish.",
  instructions:
    "Re-evaluate all selected-sprint evidence as of today. Prefer fresh standups, latest Jira movement, high story-point stale work, latest Git activity, PR review age, unresolved blockers, transcript duration when available, and new sync failures. Compare the latest daily status against previous standups in the same sprint. Raise risks for status mismatch, unclear requirements, dependency waits, technical challenges, system/software issues, stale QA, delayed code review, silent blockers, vague updates, and say-do gaps. If the sprint is close to ending, unresolved blockers become red flags, high-point stale stories become sprint-end risks, and QA-not-done or old review queues become impediments. Keep the analysis stable for review, but update scores when evidence materially changed."
};
