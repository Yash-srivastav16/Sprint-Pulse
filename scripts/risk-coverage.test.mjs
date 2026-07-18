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

const analyze = (overrides) =>
  analyzeDailyStatusSignals({
    project,
    sprint,
    parsed: overrides.parsed ?? [],
    previousStandups: overrides.previousStandups ?? [],
    issues: overrides.issues ?? [],
    commits: overrides.commits ?? [],
    generatedAt: overrides.generatedAt ?? "2026-05-20T09:00:00.000Z"
  });

test("flags UNCLEAR_REQUIREMENT when standup mentions ambiguous scope", () => {
  const result = analyze({
    parsed: [
      entry({
        today: "SPM-201 acceptance criteria are unclear and the scope keeps shifting.",
        blockers: "Need details from product."
      })
    ],
    issues: [issue({ issueKey: "SPM-201", status: "In Progress" })]
  });

  const types = new Set(result.risks.map((risk) => risk.type));
  assert.ok(types.has("UNCLEAR_REQUIREMENT"), "should detect ambiguous requirement language");
});

test("flags TECHNICAL_CHALLENGE for complex implementation language", () => {
  const result = analyze({
    parsed: [
      entry({
        today: "Debugging a complex merge conflict in the migration schema.",
        blockers: "No blocker."
      })
    ],
    issues: [issue({ issueKey: "SPM-202", status: "In Progress" })]
  });

  const types = new Set(result.risks.map((risk) => risk.type));
  assert.ok(types.has("TECHNICAL_CHALLENGE"), "should detect technical-challenge keywords");
});

test("flags SYSTEM_ISSUE for infra/deployment trouble", () => {
  const result = analyze({
    parsed: [
      entry({
        today: "Pipeline deploy keeps failing on the staging environment build.",
        blockers: "Infra access is intermittent."
      })
    ],
    issues: [issue({ issueKey: "SPM-203", status: "In Progress" })]
  });

  const types = new Set(result.risks.map((risk) => risk.type));
  assert.ok(types.has("SYSTEM_ISSUE"), "should detect infrastructure/environment failure language");
});

test("flags SOFTWARE_ISSUE when standup names bugs or regressions", () => {
  const result = analyze({
    parsed: [
      entry({
        today: "Found a regression in the dashboard refresh that crashes on empty sprints.",
        blockers: "No blocker."
      })
    ],
    issues: [issue({ issueKey: "SPM-204", status: "In Progress" })]
  });

  const types = new Set(result.risks.map((risk) => risk.type));
  assert.ok(types.has("SOFTWARE_ISSUE"), "should detect defect/regression keywords");
});

test("healthy standup produces no risks", () => {
  const result = analyze({
    parsed: [
      entry({
        memberId: "dev-1",
        today: "Continuing implementation on SPM-205 with steady progress.",
        blockers: "No blocker."
      })
    ],
    issues: [issue({ issueKey: "SPM-205", status: "In Progress", daysIdle: 0 })],
    commits: [
      {
        id: "commit-h",
        projectId: project.id,
        sprintId: sprint.id,
        sha: "feedbeef",
        authorProfileId: "dev-1",
        authorEmail: "yash@example.com",
        message: "SPM-205 add steady progress",
        committedAt: "2026-05-20T07:30:00.000Z",
        additions: 18,
        deletions: 4
      }
    ]
  });

  assert.equal(result.risks.length, 0, "no risks should fire for a clean standup with matching commits");
});

test("empty input is safe and returns zero stories and risks", () => {
  const result = analyze({ parsed: [], issues: [], commits: [] });
  assert.equal(result.risks.length, 0);
  assert.equal(result.stories.length, 0);
});

test("near sprint end, technical challenge escalates to red-flag severity", () => {
  const result = analyze({
    generatedAt: "2026-05-28T09:00:00.000Z",
    parsed: [
      entry({
        today: "Debugging a complex performance issue blocking SPM-206 completion.",
        blockers: "No blocker."
      })
    ],
    issues: [issue({ issueKey: "SPM-206", status: "In Progress" })]
  });

  const technicalRisk = result.risks.find((risk) => risk.type === "TECHNICAL_CHALLENGE");
  assert.ok(technicalRisk, "technical challenge should fire");
  assert.equal(technicalRisk.severity, "red-flag", "severity should escalate when sprint is ending soon");
});
