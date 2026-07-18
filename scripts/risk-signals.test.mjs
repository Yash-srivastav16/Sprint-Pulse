import test from "node:test";
import assert from "node:assert/strict";
import { analyzeDailyStatusSignals } from "../packages/shared/dist/index.js";

const sprint = {
  id: "sprint-1",
  name: "Sprint 1",
  goal: "Ship delivery intelligence",
  startDate: "2026-05-16",
  endDate: "2026-05-29",
  status: "active"
};

const project = {
  id: "project-1",
  key: "SPM",
  name: "SprintPulse Metrics",
  source: "manual",
  sprint,
  members: [
    { personaId: "dev-1", name: "Yash Srivastav", role: "developer" },
    { personaId: "qa-1", name: "Aisha Okafor", role: "qa" },
    { personaId: "sm-1", name: "Maya Chen", role: "scrum-master" }
  ],
  ownerIds: [],
  scrumMasterIds: ["sm-1"],
  createdBy: "sm-1",
  createdAt: "2026-05-16T00:00:00.000Z",
  updatedAt: "2026-05-16T00:00:00.000Z"
};

const issue = (overrides) => ({
  id: overrides.issueKey,
  projectId: project.id,
  sprintId: sprint.id,
  issueKey: overrides.issueKey,
  summary: overrides.summary ?? "Sprint story",
  status: overrides.status ?? "In Progress",
  assigneeProfileId: overrides.assigneeProfileId ?? "dev-1",
  daysIdle: overrides.daysIdle ?? 0
});

const entry = (overrides) => ({
  memberId: overrides.memberId ?? "dev-1",
  name: overrides.name ?? "Yash Srivastav",
  yesterday: overrides.yesterday ?? "Worked on selected sprint story.",
  today: overrides.today,
  blockers: overrides.blockers ?? "No blocker.",
  confidence: 0.9
});

const analyze = ({ parsed, issues, commits = [], generatedAt = "2026-05-20T09:00:00.000Z" }) =>
  analyzeDailyStatusSignals({
    project,
    sprint,
    parsed,
    previousStandups: [],
    issues,
    commits,
    generatedAt
  });

test("flags dependency wait when a standup names a blocker", () => {
  const result = analyze({
    parsed: [
      entry({
        today: "Continuing SPM-101 deployment dry run.",
        blockers: "Blocked by platform access token approval."
      })
    ],
    issues: [issue({ issueKey: "SPM-101", status: "In Progress", daysIdle: 2 })]
  });

  assert.equal(result.stories[0].storyKey, "SPM-101");
  assert.equal(result.stories[0].standupStatus, "blocked");
  assert.equal(result.stories[0].canFinishInSprint, false);
  assert.ok(result.risks.some((risk) => risk.type === "DEPENDENCY_WAIT" && risk.storyKey === "SPM-101"));
});

test("flags status mismatch when standup says done but Jira is still open", () => {
  const result = analyze({
    parsed: [
      entry({
        today: "Resolved SPM-102 and deployed the dashboard empty state.",
        blockers: "No blocker."
      })
    ],
    issues: [issue({ issueKey: "SPM-102", status: "Todo", daysIdle: 1 })]
  });

  const story = result.stories.find((candidate) => candidate.storyKey === "SPM-102");
  assert.equal(story?.standupStatus, "done");
  assert.ok(story?.riskTypes.includes("STATUS_MISMATCH"));
  assert.ok(result.risks.some((risk) => risk.type === "STATUS_MISMATCH" && risk.storyKey === "SPM-102"));
});

test("escalates QA and review risk near sprint end", () => {
  const result = analyze({
    generatedAt: "2026-05-28T09:00:00.000Z",
    parsed: [
      entry({
        memberId: "qa-1",
        name: "Aisha Okafor",
        today: "SPM-103 is still in QA with validation pending and review pending.",
        blockers: "No blocker."
      })
    ],
    issues: [issue({ issueKey: "SPM-103", status: "Review", assigneeProfileId: "qa-1", daysIdle: 3 })]
  });

  const types = new Set(result.risks.map((risk) => risk.type));
  assert.equal(result.isSprintEndingSoon, true);
  assert.equal(result.summary.canCompleteSprint, false);
  assert.ok(types.has("QA_NOT_DONE"));
  assert.ok(types.has("CODE_REVIEW_PENDING"));
  assert.ok(types.has("SPRINT_END_RISK"));
});

test("commit proof raises confidence for active implementation work", () => {
  const result = analyze({
    parsed: [
      entry({
        today: "I will implement SPM-104 routing cleanup.",
        blockers: "No blocker."
      })
    ],
    issues: [issue({ issueKey: "SPM-104", status: "In Progress", daysIdle: 0 })],
    commits: [
      {
        id: "commit-1",
        projectId: project.id,
        sprintId: sprint.id,
        sha: "abc123",
        authorProfileId: "dev-1",
        authorEmail: "yash@example.com",
        message: "SPM-104 add routed asset handling",
        committedAt: "2026-05-20T08:00:00.000Z",
        additions: 24,
        deletions: 3
      }
    ]
  });

  const story = result.stories.find((candidate) => candidate.storyKey === "SPM-104");
  assert.equal(story?.canFinishInSprint, true);
  assert.ok((story?.confidenceScore ?? 0) >= 70);
});
