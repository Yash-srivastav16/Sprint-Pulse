import type {
  AccessScope,
  Assignment,
  CreateProjectRequest,
  CreateProjectResponse,
  DashboardResponse,
  DashboardSummary,
  JiraConnectRequest,
  JiraConnectResponse,
  MemberPulse,
  Permission,
  Persona,
  PlanResponse,
  ProjectDetailResponse,
  ProjectDashboardResponse,
  ProjectMember,
  ProjectRole,
  ProjectSummary,
  ProjectWorkspaceResponse,
  RiskLevel,
  StandupEntry,
  StackItem,
  SprintProject,
  TeamPreviewItem
} from "@sprintpulse/shared";

export const personas: Persona[] = [
  {
    id: "priya",
    name: "Priya",
    email: "priya@sprintpulse.dev",
    initials: "PR",
    hackathonRole: "architect",
    productPersona: "product-owner",
    title: "Product Owner",
    accessScope: "team",
    focus: "Sprint goals, product confidence, and delivery risk."
  },
  {
    id: "atharv",
    name: "Atharv",
    email: "atharv@sprintpulse.dev",
    initials: "AT",
    hackathonRole: "frontend",
    productPersona: "developer",
    title: "Frontend Engineer",
    accessScope: "individual",
    focus: "Dashboard cards, risk badges, and responsive UI"
  },
  {
    id: "yanshi",
    name: "Yanshi",
    email: "yanshi@sprintpulse.dev",
    initials: "YA",
    hackathonRole: "frontend",
    productPersona: "developer",
    title: "Frontend Engineer",
    accessScope: "individual",
    focus: "Persona login, route guards, and member detail UX"
  },
  {
    id: "mahesh",
    name: "Mahesh",
    email: "mahesh@sprintpulse.dev",
    initials: "MA",
    hackathonRole: "frontend",
    productPersona: "developer",
    title: "Frontend Engineer",
    accessScope: "individual",
    focus: "Standup input modes and transcript paste flow"
  },
  {
    id: "yash",
    name: "Yash",
    email: "yash@sprintpulse.dev",
    initials: "YS",
    hackathonRole: "backend",
    productPersona: "developer",
    title: "Backend Engineer",
    accessScope: "individual",
    focus: "API contracts, scoring engine, and integration adapters"
  },
  {
    id: "vipin",
    name: "Vipin",
    email: "vipin@sprintpulse.dev",
    initials: "VP",
    hackathonRole: "architect",
    productPersona: "engineering-manager",
    title: "Lead Architect",
    accessScope: "team",
    focus: "Architecture decisions, product storyline, and team health view"
  },
  {
    id: "himanshu",
    name: "Himanshu",
    email: "himanshu@sprintpulse.dev",
    initials: "HI",
    hackathonRole: "architect",
    productPersona: "scrum-master",
    title: "Solution Architect",
    accessScope: "team",
    focus: "Data model, scoring rules, and integration replacement plan"
  },
  {
    id: "vikrant",
    name: "Vikrant",
    email: "vikrant@sprintpulse.dev",
    initials: "VI",
    hackathonRole: "qa",
    productPersona: "qa-lead",
    title: "QA Engineer",
    accessScope: "quality",
    focus: "Release validation, test risks, and edge-case coverage"
  },
  {
    id: "janice",
    name: "Janice",
    email: "janice@sprintpulse.dev",
    initials: "JA",
    hackathonRole: "qa",
    productPersona: "presenter",
    title: "QA and Presentation",
    accessScope: "presentation",
    focus: "Pitch flow, judge narrative, and final walkthrough"
  }
];

const standup = (
  id: string,
  memberId: string,
  date: string,
  yesterday: string,
  today: string,
  blockers: string,
  source: StandupEntry["source"] = "manual"
): StandupEntry => ({ id, memberId, date, yesterday, today, blockers, source });

export const memberPulses: MemberPulse[] = [
  {
    id: "priya",
    personaId: "priya",
    name: "Priya",
    initials: "PR",
    title: "Product Owner",
    hackathonRole: "architect",
    productPersona: "product-owner",
    healthScore: 86,
    riskLevel: "low",
    currentFocus: "Watching whether sprint delivery still supports the product story and customer value.",
    recommendation: "Keep the product story centered on the say-do gap and ask the team to connect every risk signal to customer impact.",
    tickets: [
      { key: "SP-120", title: "Product value narrative", status: "Review", daysIdle: 0 },
      { key: "SP-121", title: "Judge-facing business impact", status: "In Progress", daysIdle: 1 }
    ],
    git: {
      commitsThisSprint: 0,
      pullRequestsOpen: 0,
      lastCommitAt: "2026-05-09T08:00:00.000Z",
      codeChurn: "low"
    },
    flags: [],
    standups: [
      standup("priya-2026-05-10", "priya", "2026-05-10", "Reviewed the product story.", "Aligning sprint goal with the product walkthrough.", "Need clear Jira connection status."),
      standup("priya-2026-05-11", "priya", "2026-05-11", "Validated the core value proposition.", "Reviewing project-level health and risk summary.", "No blocker.")
    ]
  },
  {
    id: "atharv",
    personaId: "atharv",
    name: "Atharv",
    initials: "AT",
    title: "Frontend Engineer",
    hackathonRole: "frontend",
    productPersona: "developer",
    healthScore: 78,
    riskLevel: "medium",
    currentFocus: "Building the dashboard summary and member cards.",
    recommendation: "Pair with Mahesh for shared card states so the dashboard and member detail screens stay visually consistent.",
    tickets: [
      { key: "SP-101", title: "Sprint health cards", status: "Review", daysIdle: 1, storyPoints: 5 },
      { key: "SP-108", title: "Risk badge variants", status: "In Progress", daysIdle: 2, storyPoints: 3 }
    ],
    git: {
      commitsThisSprint: 9,
      pullRequestsOpen: 1,
      lastCommitAt: "2026-05-11T14:30:00.000Z",
      oldestPullRequestDays: 2,
      reviewPressure: 46,
      codeChurn: "medium"
    },
    flags: [
      {
        id: "atharv-1",
        type: "STALE_WORK",
        severity: "medium",
        title: "Dashboard polish repeated",
        message: "The same UI polish task has appeared for two standups. Check whether a design decision is blocking progress."
      }
    ],
    standups: [
      standup("atharv-2026-05-10", "atharv", "2026-05-10", "Set up dashboard layout.", "Polishing member cards.", "Need final badge colors."),
      standup("atharv-2026-05-11", "atharv", "2026-05-11", "Added summary card states.", "Connecting API data to the dashboard.", "No blocker.")
    ]
  },
  {
    id: "yanshi",
    personaId: "yanshi",
    name: "Yanshi",
    initials: "YA",
    title: "Frontend Engineer",
    hackathonRole: "frontend",
    productPersona: "developer",
    healthScore: 82,
    riskLevel: "low",
    currentFocus: "Persona login, session storage, and route protection.",
    recommendation: "Lock the login contract early so every screen can use the same viewer context.",
    tickets: [
      { key: "SP-102", title: "Persona login", status: "Done", daysIdle: 0 },
      { key: "SP-109", title: "Member route guard", status: "In Progress", daysIdle: 1 }
    ],
    git: {
      commitsThisSprint: 11,
      pullRequestsOpen: 0,
      lastCommitAt: "2026-05-11T15:10:00.000Z",
      codeChurn: "low"
    },
    flags: [],
    standups: [
      standup("yanshi-2026-05-10", "yanshi", "2026-05-10", "Mapped login state.", "Creating guarded routes.", "No blocker."),
      standup("yanshi-2026-05-11", "yanshi", "2026-05-11", "Finished persona cards.", "Adding persistent session behavior.", "No blocker.")
    ]
  },
  {
    id: "mahesh",
    personaId: "mahesh",
    name: "Mahesh",
    initials: "MA",
    title: "Frontend Engineer",
    hackathonRole: "frontend",
    productPersona: "developer",
    healthScore: 71,
    riskLevel: "medium",
    currentFocus: "Standup form, transcript paste, and input loading states.",
    recommendation: "Ship manual standup first, then add transcript paste as the visible AI moment.",
    tickets: [
      { key: "SP-103", title: "Manual standup form", status: "In Progress", daysIdle: 1 },
      { key: "SP-110", title: "Transcript paste tab", status: "Todo", daysIdle: 3 }
    ],
    git: {
      commitsThisSprint: 6,
      pullRequestsOpen: 1,
      lastCommitAt: "2026-05-11T12:05:00.000Z",
      codeChurn: "medium"
    },
    flags: [
      {
        id: "mahesh-1",
        type: "VAGUE_UPDATE",
        severity: "medium",
        title: "Input scope needs detail",
        message: "The update says 'working on form stuff' without naming the exact state or API dependency."
      }
    ],
    standups: [
      standup("mahesh-2026-05-10", "mahesh", "2026-05-10", "Started form stuff.", "Continue form stuff.", "Need API shape."),
      standup("mahesh-2026-05-11", "mahesh", "2026-05-11", "Built manual inputs.", "Adding transcript paste tab.", "Need transcript parser contract.")
    ]
  },
  {
    id: "yash",
    personaId: "yash",
    name: "Yash",
    initials: "YS",
    title: "Backend Engineer",
    hackathonRole: "backend",
    productPersona: "developer",
    healthScore: 64,
    riskLevel: "high",
    currentFocus: "API contracts, scoring rules, and integration adapters.",
    recommendation: "Keep the backend small: stabilize /dashboard, /personas, /standups, and one parser endpoint before adding real integrations.",
    tickets: [
      { key: "SP-104", title: "Dashboard API", status: "In Progress", daysIdle: 2, storyPoints: 5 },
      { key: "SP-111", title: "GitHub signal adapter", status: "Todo", daysIdle: 4, storyPoints: 8 },
      { key: "SP-112", title: "Jira signal adapter", status: "Todo", daysIdle: 4, storyPoints: 5 }
    ],
    git: {
      commitsThisSprint: 4,
      pullRequestsOpen: 2,
      lastCommitAt: "2026-05-11T11:40:00.000Z",
      oldestPullRequestDays: 4,
      reviewPressure: 92,
      codeChurn: "high"
    },
    flags: [
      {
        id: "yash-1",
        type: "SAY_DO_GAP",
        severity: "high",
        title: "Integration promise ahead of code",
        message: "Standups mention GitHub and Jira integration, but adapter tasks have not moved for four days."
      },
      {
        id: "yash-2",
        type: "BURNOUT_SIGNAL",
        severity: "medium",
        title: "Backend is a single point of pressure",
        message: "API, scoring, and integrations are all assigned to one person. Architects should remove scope or pair quickly."
      }
    ],
    standups: [
      standup("yash-2026-05-10", "yash", "2026-05-10", "Created API plan.", "Working on scoring engine.", "Need stack decision."),
      standup("yash-2026-05-11", "yash", "2026-05-11", "Scaffolded API contracts.", "Stabilizing contracts for FE.", "Jira/GitHub credentials pending.")
    ]
  },
  {
    id: "vipin",
    personaId: "vipin",
    name: "Vipin",
    initials: "VP",
    title: "Lead Architect",
    hackathonRole: "architect",
    productPersona: "engineering-manager",
    healthScore: 88,
    riskLevel: "low",
    currentFocus: "Leading the architecture and keeping scope focused for the first release.",
    recommendation: "Decide one golden product path and protect it from late feature creep.",
    tickets: [
      { key: "SP-105", title: "Architecture decision record", status: "Review", daysIdle: 1 },
      { key: "SP-113", title: "Product path sign-off", status: "In Progress", daysIdle: 1 }
    ],
    git: {
      commitsThisSprint: 2,
      pullRequestsOpen: 0,
      lastCommitAt: "2026-05-10T18:20:00.000Z",
      codeChurn: "low"
    },
    flags: [],
    standups: [
      standup("vipin-2026-05-10", "vipin", "2026-05-10", "Reviewed AWS-heavy plan.", "Simplifying the stack for a focused release.", "Need agreement from team."),
      standup("vipin-2026-05-11", "vipin", "2026-05-11", "Aligned on local-first architecture.", "Reviewing contracts.", "No blocker.")
    ]
  },
  {
    id: "himanshu",
    personaId: "himanshu",
    name: "Himanshu",
    initials: "HI",
    title: "Solution Architect",
    hackathonRole: "architect",
    productPersona: "scrum-master",
    healthScore: 84,
    riskLevel: "low",
    currentFocus: "Data model, scoring weights, and integration path.",
    recommendation: "Document the scoring formula as a judge-friendly explanation, not just code.",
    tickets: [
      { key: "SP-106", title: "Scoring model", status: "In Progress", daysIdle: 1 },
      { key: "SP-114", title: "Data contract review", status: "Review", daysIdle: 0 }
    ],
    git: {
      commitsThisSprint: 3,
      pullRequestsOpen: 0,
      lastCommitAt: "2026-05-11T09:50:00.000Z",
      codeChurn: "low"
    },
    flags: [],
    standups: [
      standup("himanshu-2026-05-10", "himanshu", "2026-05-10", "Defined first scoring weights.", "Mapping data entities.", "No blocker."),
      standup("himanshu-2026-05-11", "himanshu", "2026-05-11", "Reviewed member pulse shape.", "Writing scoring story.", "No blocker.")
    ]
  },
  {
    id: "vikrant",
    personaId: "vikrant",
    name: "Vikrant",
    initials: "VI",
    title: "QA Engineer",
    hackathonRole: "qa",
    productPersona: "qa-lead",
    healthScore: 74,
    riskLevel: "medium",
    currentFocus: "Critical product tests and failure-mode checklist.",
    recommendation: "Create a five-case smoke suite: login, dashboard, submit standup, transcript parsing, member detail.",
    tickets: [
      { key: "SP-107", title: "Smoke checklist", status: "In Progress", daysIdle: 1 },
      { key: "SP-115", title: "Risk seed cases", status: "Todo", daysIdle: 2 }
    ],
    git: {
      commitsThisSprint: 1,
      pullRequestsOpen: 0,
      lastCommitAt: "2026-05-10T13:35:00.000Z",
      codeChurn: "low"
    },
    flags: [
      {
        id: "vikrant-1",
        type: "TEST_RISK",
        severity: "medium",
        title: "Validation checklist still forming",
        message: "The core product path needs smoke cases before the team starts adding optional features."
      }
    ],
    standups: [
      standup("vikrant-2026-05-10", "vikrant", "2026-05-10", "Drafted QA checklist.", "Adding edge cases.", "Need final product flow."),
      standup("vikrant-2026-05-11", "vikrant", "2026-05-11", "Defined first smoke pass.", "Testing persona journeys.", "No blocker.")
    ]
  },
  {
    id: "janice",
    personaId: "janice",
    name: "Janice",
    initials: "JA",
    title: "QA and Presentation",
    hackathonRole: "qa",
    productPersona: "presenter",
    healthScore: 80,
    riskLevel: "low",
    currentFocus: "Pitch story, walkthrough sequence, and judge-ready value proposition.",
    recommendation: "Anchor the pitch on the say-do gap: what people say in standup versus what Jira and Git show.",
    tickets: [
      { key: "SP-116", title: "Two-minute pitch", status: "In Progress", daysIdle: 1 },
      { key: "SP-117", title: "Product walkthrough", status: "Todo", daysIdle: 2 }
    ],
    git: {
      commitsThisSprint: 0,
      pullRequestsOpen: 0,
      lastCommitAt: "2026-05-09T10:00:00.000Z",
      codeChurn: "low"
    },
    flags: [],
    standups: [
      standup("janice-2026-05-10", "janice", "2026-05-10", "Outlined pitch.", "Drafting product narration.", "Need stable screen order."),
      standup("janice-2026-05-11", "janice", "2026-05-11", "Aligned story with problem statement.", "Preparing judge flow.", "No blocker.")
    ]
  }
];

export const stack: StackItem[] = [
  {
    layer: "Frontend",
    choice: "React + Vite + TypeScript",
    reason: "Three frontend members can split routes and components without waiting for cloud setup."
  },
  {
    layer: "Backend",
    choice: "Node.js + Express + TypeScript",
    reason: "One backend owner can expose stable product APIs quickly."
  },
  {
    layer: "Data",
    choice: "SprintPulse workspace data",
    reason: "Stable project data today, ready to move into Supabase tables next."
  },
  {
    layer: "Authentication",
    choice: "Supabase email/password",
    reason: "Maps each signed-in user to the right SprintPulse role and visibility."
  },
  {
    layer: "Integrations",
    choice: "Jira/GitHub/LLM adapters",
    reason: "External delivery signals can be connected behind the existing project contracts."
  }
];

export const assignments: Assignment[] = [
  { owner: "Atharv", role: "frontend", workstream: "Dashboard", firstDeliverable: "Team health cards and member pulse grid" },
  { owner: "Yanshi", role: "frontend", workstream: "Login", firstDeliverable: "Supabase sign-in and session guard" },
  { owner: "Mahesh", role: "frontend", workstream: "Inputs", firstDeliverable: "Manual standup and transcript paste screens" },
  { owner: "Yash", role: "backend", workstream: "API", firstDeliverable: "Personas, dashboard, member, standup, and parser endpoints" },
  { owner: "Vipin", role: "architect", workstream: "Architecture", firstDeliverable: "Focused scope and final tech stack decision" },
  { owner: "Himanshu", role: "architect", workstream: "Scoring", firstDeliverable: "Scoring formula and data contract review" },
  { owner: "Vikrant", role: "qa", workstream: "Quality", firstDeliverable: "Smoke checklist and release-risk cases" },
  { owner: "Janice", role: "qa", workstream: "Presentation", firstDeliverable: "Two-minute pitch and product walkthrough" }
];

export const plan: PlanResponse = {
  stack,
  assignments,
  milestones: [
    { date: "2026-05-11", target: "Scaffold app, Supabase login, role-aware dashboard." },
    { date: "2026-05-12", target: "Manual standup submission and member detail pages." },
    { date: "2026-05-13", target: "Transcript parser and scoring rules." },
    { date: "2026-05-14", target: "GitHub/Jira adapter contracts and recommendation copy." },
    { date: "2026-05-15", target: "QA smoke pass, walkthrough rehearsal, and presentation polish." },
    { date: "2026-05-16", target: "Hackathon day one: integrate, stabilize, and add one wow feature." },
    { date: "2026-05-17", target: "Hackathon day two: final walkthrough, pitch, and contingency plan." }
  ]
};

const memberFromPersona = (persona: Persona, role: ProjectRole): ProjectMember => ({
  personaId: persona.id,
  name: persona.name,
  email: persona.email,
  initials: persona.initials,
  role,
  jiraAccountId: `jira-${persona.id}`,
  githubUsername: persona.productPersona === "developer" ? `${persona.id}-dev` : undefined
});

export const roleForPersona = (persona: Persona): ProjectRole => {
  if (persona.productPersona === "product-owner") {
    return "product-owner";
  }
  if (persona.productPersona === "scrum-master") {
    return "scrum-master";
  }
  if (persona.productPersona === "engineering-manager") {
    return "architect";
  }
  if (persona.productPersona === "qa-lead" || persona.productPersona === "presenter") {
    return "qa";
  }
  return "developer";
};

const projectMembers = (...personaIds: string[]): ProjectMember[] =>
  personaIds
    .map((id) => personas.find((persona) => persona.id === id))
    .filter((persona): persona is Persona => Boolean(persona))
    .map((persona) => memberFromPersona(persona, roleForPersona(persona)));

export const projects: SprintProject[] = [
  {
    id: "sp-core",
    key: "SP",
    name: "SprintPulse AI",
    source: "jira",
    jiraSite: "semicolons.atlassian.net",
    sprint: {
      id: "sprint-semi-2026",
      name: "Semicolon Build Sprint",
      goal: "Prove say-do gap detection from standups, Jira, and delivery signals.",
      startDate: "2026-05-11",
      endDate: "2026-05-17",
      status: "active"
    },
    members: projectMembers("priya", "atharv", "yanshi", "mahesh", "yash", "vipin", "himanshu", "vikrant", "janice"),
    ownerIds: ["priya"],
    scrumMasterIds: ["himanshu"],
    createdBy: "himanshu",
    createdAt: "2026-05-11T09:00:00.000Z",
    updatedAt: "2026-05-11T15:30:00.000Z",
    lastSyncAt: "2026-05-11T15:30:00.000Z"
  },
  {
    id: "ux-readiness",
    key: "UX",
    name: "SprintPulse Experience",
    source: "manual",
    sprint: {
      id: "sprint-ux-2026",
      name: "Judge Experience Sprint",
      goal: "Make the end-to-end product journey polished, role-aware, and easy to judge.",
      startDate: "2026-05-11",
      endDate: "2026-05-15",
      status: "active"
    },
    members: projectMembers("priya", "atharv", "yanshi", "mahesh", "vipin", "janice", "vikrant"),
    ownerIds: ["priya"],
    scrumMasterIds: ["vipin"],
    createdBy: "priya",
    createdAt: "2026-05-11T10:00:00.000Z",
    updatedAt: "2026-05-11T13:00:00.000Z",
    lastSyncAt: "2026-05-11T13:00:00.000Z"
  }
];

const riskWeight: Record<RiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

export const findPersona = (personaId: string): Persona | undefined =>
  personas.find((persona) => persona.id === personaId);

export const findPulse = (memberId: string): MemberPulse | undefined =>
  memberPulses.find((pulse) => pulse.id === memberId || pulse.personaId === memberId);

export const findProject = (projectId: string): SprintProject | undefined =>
  projects.find((project) => project.id === projectId || project.key.toLowerCase() === projectId.toLowerCase());

export const isElevated = (persona: Persona): boolean =>
  persona.productPersona === "product-owner" ||
  persona.productPersona === "scrum-master" ||
  persona.productPersona === "engineering-manager";

const isProjectManager = (persona: Persona): boolean =>
  persona.productPersona === "scrum-master" || persona.productPersona === "engineering-manager";

const projectMembership = (persona: Persona, project?: SprintProject) =>
  project?.members.find((member) => member.personaId === persona.id);

const canViewPortfolio = (persona: Persona): boolean => persona.productPersona === "product-owner";

const canManageProject = (persona: Persona, project?: SprintProject): boolean => {
  if (!project) {
    return isProjectManager(persona);
  }

  const membership = projectMembership(persona, project);
  return (
    project.createdBy === persona.id ||
    Boolean(membership && ["product-owner", "scrum-master", "engineering-manager"].includes(membership.role))
  );
};

const canViewProjectTeam = (persona: Persona, project: SprintProject): boolean => {
  const membership = projectMembership(persona, project);
  return (
    canViewPortfolio(persona) ||
    project.createdBy === persona.id ||
    Boolean(membership && ["product-owner", "scrum-master", "engineering-manager", "architect", "qa"].includes(membership.role))
  );
};

export const permissionsFor = (persona: Persona, project?: SprintProject): Permission[] => {
  const projectVisible = project ? canAccessProject(persona, project) : true;

  if (!projectVisible) {
    return [];
  }

  const permissions: Permission[] = ["project:view", "standup:submit", "dashboard:viewOwn", "member:viewOwn"];

  if (project ? canViewProjectTeam(persona, project) : canViewPortfolio(persona)) {
    permissions.push("dashboard:viewTeam", "member:viewTeam");
  }

  if (canManageProject(persona, project)) {
    permissions.push("project:create", "project:connect", "project:editTeam", "standup:sync");
  }

  return [...new Set(permissions)];
};

export const hasPermission = (persona: Persona, permission: Permission, project?: SprintProject): boolean =>
  permissionsFor(persona, project).includes(permission);

export const canAccessProject = (persona: Persona, project: SprintProject): boolean =>
  canViewPortfolio(persona) ||
  project.createdBy === persona.id ||
  project.members.some((member) => member.personaId === persona.id);

export const addStandupEntry = (entry: StandupEntry): MemberPulse | undefined => {
  const pulse = findPulse(entry.memberId);
  if (!pulse) {
    return undefined;
  }

  pulse.standups = [entry, ...pulse.standups].slice(0, 8);
  return pulse;
};

export const buildSummary = (): DashboardSummary => {
  const scoreTotal = memberPulses.reduce((sum, pulse) => sum + pulse.healthScore, 0);
  const openBlockers = memberPulses.reduce(
    (sum, pulse) => sum + pulse.standups.filter((entry) => entry.blockers.toLowerCase() !== "no blocker.").length,
    0
  );
  const totalFlags = memberPulses.reduce((sum, pulse) => sum + pulse.flags.length, 0);
  const weightedFlags = memberPulses.reduce(
    (sum, pulse) => sum + pulse.flags.reduce((flagSum, flag) => flagSum + riskWeight[flag.severity], 0),
    0
  );

  return {
    sprintName: "Semicolon SprintPulse",
    sprintWindow: "May 11-17, 2026",
    teamHealthScore: Math.round(scoreTotal / memberPulses.length),
    atRiskCount: memberPulses.filter((pulse) => pulse.riskLevel === "high" || pulse.riskLevel === "critical").length,
    openBlockers,
    totalFlags,
    readinessScore: Math.max(45, 100 - weightedFlags * 3)
  };
};

export const buildTeamPreview = (): TeamPreviewItem[] =>
  memberPulses.map((pulse) => ({
    id: pulse.id,
    name: pulse.name,
    initials: pulse.initials,
    role: pulse.hackathonRole,
    score: pulse.healthScore,
    riskLevel: pulse.riskLevel
  }));

const projectPulses = (project: SprintProject): MemberPulse[] => {
  const memberIds = new Set(project.members.map((member) => member.personaId));
  return memberPulses.filter((pulse) => memberIds.has(pulse.personaId));
};

const projectHealthScore = (project: SprintProject): number => {
  const pulses = projectPulses(project);
  if (!pulses.length) {
    return 72;
  }
  return Math.round(pulses.reduce((sum, pulse) => sum + pulse.healthScore, 0) / pulses.length);
};

const projectAtRiskCount = (project: SprintProject): number =>
  projectPulses(project).filter((pulse) => pulse.riskLevel === "high" || pulse.riskLevel === "critical").length;

const projectOpenBlockers = (project: SprintProject): number =>
  projectPulses(project).reduce(
    (sum, pulse) => sum + pulse.standups.filter((entry) => entry.blockers.toLowerCase() !== "no blocker.").length,
    0
  );

const projectTotalFlags = (project: SprintProject): number =>
  projectPulses(project).reduce((sum, pulse) => sum + pulse.flags.length, 0);

const projectWeightedFlags = (project: SprintProject): number =>
  projectPulses(project).reduce(
    (sum, pulse) => sum + pulse.flags.reduce((flagSum, flag) => flagSum + riskWeight[flag.severity], 0),
    0
  );

const sprintWindowLabel = (project: SprintProject): string => `${project.sprint.startDate} to ${project.sprint.endDate}`;

const currentUserRole = (project: SprintProject, viewer: Persona): ProjectRole => {
  const membership = project.members.find((member) => member.personaId === viewer.id);
  return membership?.role ?? roleForPersona(viewer);
};

export const buildProjectSummary = (project: SprintProject, viewer: Persona): ProjectSummary => ({
  id: project.id,
  key: project.key,
  name: project.name,
  source: project.source,
  sprintName: project.sprint.name,
  sprintGoal: project.sprint.goal,
  memberCount: project.members.length,
  healthScore: projectHealthScore(project),
  atRiskCount: projectAtRiskCount(project),
  currentUserRole: currentUserRole(project, viewer),
  permissions: permissionsFor(viewer, project),
  lastSyncAt: project.lastSyncAt
});

export const buildProjectsResponse = (personaId: string) => {
  const viewer = findPersona(personaId);
  if (!viewer) {
    return undefined;
  }

  const visibleProjects = projects.filter((project) => canAccessProject(viewer, project));
  const uniqueMemberCount = new Set(
    visibleProjects.flatMap((project) => project.members.map((member) => member.personaId))
  ).size;
  return {
    viewer,
    projects: visibleProjects.map((project) => buildProjectSummary(project, viewer)),
    uniqueMemberCount,
    canCreateProject: hasPermission(viewer, "project:create"),
    canConnectProject: hasPermission(viewer, "project:connect"),
    recommendedProjectId: visibleProjects[0]?.id
  };
};

export const buildProjectDetail = (projectId: string, personaId: string): ProjectDetailResponse | undefined => {
  const viewer = findPersona(personaId);
  const project = findProject(projectId);
  if (!viewer || !project || !canAccessProject(viewer, project)) {
    return undefined;
  }

  return {
    viewer,
    project,
    permissions: permissionsFor(viewer, project)
  };
};

export const buildProjectWorkspace = (projectId: string, personaId: string): ProjectWorkspaceResponse | undefined => {
  const detail = buildProjectDetail(projectId, personaId);
  if (!detail) {
    return undefined;
  }

  const { viewer, project, permissions } = detail;
  const pulses = projectPulses(project);
  const totalStandups = pulses.reduce((sum, pulse) => sum + pulse.standups.length, 0);
  const openBlockers = projectOpenBlockers(project);
  const sprintStart = new Date(`${project.sprint.startDate}T00:00:00.000Z`);
  const sprintEnd = new Date(`${project.sprint.endDate}T00:00:00.000Z`);
  const today = new Date("2026-05-11T00:00:00.000Z");
  const dayMs = 24 * 60 * 60 * 1000;
  const sprintDay = Math.max(1, Math.floor((today.getTime() - sprintStart.getTime()) / dayMs) + 1);
  const daysRemaining = Math.max(0, Math.ceil((sprintEnd.getTime() - today.getTime()) / dayMs));

  const primaryAction = hasPermission(viewer, "standup:submit", project)
    ? {
        id: "submit-standup",
        label: viewer.productPersona === "developer" ? "Submit your standup" : "Review standup inputs",
        description:
          viewer.productPersona === "developer"
            ? "Add a concrete update so SprintPulse can compare communication with delivery signals."
            : "Check whether the team has enough fresh standup signal for today.",
        route: `/projects/${project.id}/standups`,
        requiredPermission: "standup:submit" as Permission
      }
    : {
        id: "open-dashboard",
        label: "Open sprint dashboard",
        description: "Review health score, blockers, and delivery-risk signals for this project.",
        route: `/projects/${project.id}/dashboard`,
        requiredPermission: "dashboard:viewOwn" as Permission
      };

  return {
    viewer,
    project,
    permissions,
    sync: {
      mode: project.source === "jira" ? "jira" : "manual",
      lastSyncAt: project.lastSyncAt,
      nextSyncAt: project.source === "jira" ? "2026-05-12T09:00:00.000Z" : undefined,
      status: project.source === "jira" ? "synced" : "idle"
    },
    summary: {
      sprintDay,
      daysRemaining,
      participationRate: Math.min(100, Math.round((totalStandups / Math.max(project.members.length * 2, 1)) * 100)),
      openBlockers,
      atRiskCount: projectAtRiskCount(project),
      healthScore: projectHealthScore(project)
    },
    nextActions: [
      primaryAction,
      {
        id: "dashboard",
        label: "Open dashboard",
        description: "Inspect sprint health, say-do gaps, and recommendations.",
        route: `/projects/${project.id}/dashboard`,
        requiredPermission: "dashboard:viewOwn"
      },
      ...(hasPermission(viewer, "project:connect", project)
        ? [
            {
              id: "sync",
              label: "Sync standups",
              description: "Preview how SprintPulse will keep standup and Jira signals current.",
              route: `/projects/${project.id}/standups`,
              requiredPermission: "standup:sync" as Permission
            }
          ]
        : [])
    ]
  };
};

export const visiblePulsesFor = (scope: AccessScope, viewerId: string): MemberPulse[] => {
  if (scope === "team" || scope === "quality" || scope === "presentation") {
    return memberPulses;
  }

  return memberPulses.filter((pulse) => pulse.personaId === viewerId);
};

export const buildRecommendations = (viewer: Persona, viewerPulse: MemberPulse): string[] => {
  if (viewer.accessScope === "team") {
    return [
      "Protect the core product path: login, project workspace, standup submission, dashboard, member detail.",
      "Keep external integrations scoped until the workspace flow is working end to end.",
      "Pair Yash with one architect on scoring so backend scope does not become the bottleneck."
    ];
  }

  if (viewer.accessScope === "quality") {
    return [
      "Run smoke tests for all eight persona logins.",
      "Verify one high-risk and one low-risk member detail page before the walkthrough.",
      "Prepare backup screenshots in case the live parser endpoint fails."
    ];
  }

  if (viewer.accessScope === "presentation") {
    return [
      "Open with the say-do gap: standup confidence can disagree with Git and Jira reality.",
      "Show Yash as the high-risk backend member, then Vipin as the team-level view.",
      "Close on commercialization: standup tools collect data, SprintPulse interprets it."
    ];
  }

  return [
    viewerPulse.recommendation,
    "Submit one concrete standup today so the dashboard has fresh data.",
    "Name blockers explicitly. SprintPulse treats vague or missing blockers as a risk signal."
  ];
};

export const buildDashboard = (personaId: string): DashboardResponse | undefined => {
  const viewer = findPersona(personaId);
  const viewerPulse = findPulse(personaId);

  if (!viewer || !viewerPulse) {
    return undefined;
  }

  return {
    viewer,
    scope: viewer.accessScope,
    summary: buildSummary(),
    viewerPulse,
    memberPulses: visiblePulsesFor(viewer.accessScope, viewer.id),
    teamPreview: buildTeamPreview(),
    recommendations: buildRecommendations(viewer, viewerPulse)
  };
};

export const buildProjectDashboard = (projectId: string, personaId: string): ProjectDashboardResponse | undefined => {
  const detail = buildProjectDetail(projectId, personaId);
  const viewerPulse = findPulse(personaId);

  if (!detail || !viewerPulse || !hasPermission(detail.viewer, "dashboard:viewOwn", detail.project)) {
    return undefined;
  }

  const { viewer, project } = detail;
  const pulses = projectPulses(project);
  const canViewTeam = hasPermission(viewer, "dashboard:viewTeam", project);
  const visiblePulses = canViewTeam ? pulses : pulses.filter((pulse) => pulse.personaId === viewer.id);
  const projectViewerPulse = pulses.find((pulse) => pulse.personaId === viewer.id) ?? viewerPulse;
  const summaryPulses = visiblePulses.length ? visiblePulses : [projectViewerPulse];
  const visibleScore = Math.round(
    summaryPulses.reduce((sum, pulse) => sum + pulse.healthScore, 0) / summaryPulses.length
  );
  const visibleOpenBlockers = summaryPulses.reduce(
    (sum, pulse) => sum + pulse.standups.filter((entry) => entry.blockers.toLowerCase() !== "no blocker.").length,
    0
  );
  const visibleTotalFlags = summaryPulses.reduce((sum, pulse) => sum + pulse.flags.length, 0);
  const visibleWeightedFlags = summaryPulses.reduce(
    (sum, pulse) => sum + pulse.flags.reduce((flagSum, flag) => flagSum + riskWeight[flag.severity], 0),
    0
  );

  return {
    project,
    viewer,
    scope: viewer.accessScope,
    summary: {
      sprintName: project.sprint.name,
      sprintWindow: sprintWindowLabel(project),
      teamHealthScore: canViewTeam ? projectHealthScore(project) : visibleScore,
      atRiskCount: summaryPulses.filter((pulse) => pulse.riskLevel === "high" || pulse.riskLevel === "critical").length,
      openBlockers: canViewTeam ? projectOpenBlockers(project) : visibleOpenBlockers,
      totalFlags: canViewTeam ? projectTotalFlags(project) : visibleTotalFlags,
      readinessScore: Math.max(45, 100 - (canViewTeam ? projectWeightedFlags(project) : visibleWeightedFlags) * 3)
    },
    viewerPulse: projectViewerPulse,
    memberPulses: visiblePulses,
    teamPreview: visiblePulses.map((pulse) => ({
      id: pulse.id,
      name: pulse.name,
      initials: pulse.initials,
      role: pulse.hackathonRole,
      score: pulse.healthScore,
      riskLevel: pulse.riskLevel
    })),
    recommendations: buildRecommendations(viewer, projectViewerPulse)
  };
};

export const createManualProject = (request: CreateProjectRequest): CreateProjectResponse | undefined => {
  const viewer = findPersona(request.personaId);
  if (!viewer || !hasPermission(viewer, "project:create")) {
    return undefined;
  }

  const now = new Date().toISOString();
  const requestMembers = request.members ?? [];
  const project: SprintProject = {
    id: `manual-${request.projectKey.toLowerCase()}-${Date.now()}`,
    key: request.projectKey.toUpperCase(),
    name: request.projectName,
    source: "manual",
    sprint: {
      id: `sprint-${request.projectKey.toLowerCase()}-${Date.now()}`,
      name: request.sprintName,
      goal: request.sprintGoal,
      startDate: request.startDate,
      endDate: request.endDate,
      status: "active"
    },
    members: requestMembers.length ? requestMembers : [memberFromPersona(viewer, roleForPersona(viewer))],
    ownerIds: requestMembers.filter((member) => member.role === "product-owner").map((member) => member.personaId),
    scrumMasterIds: requestMembers.filter((member) => member.role === "scrum-master").map((member) => member.personaId),
    createdBy: viewer.id,
    createdAt: now,
    updatedAt: now
  };

  projects.unshift(project);
  return {
    project,
    warnings: ["Project created in the active SprintPulse workspace."]
  };
};

export const connectJiraProjectData = (request: JiraConnectRequest): JiraConnectResponse | undefined => {
  const viewer = findPersona(request.personaId);
  if (!viewer || !hasPermission(viewer, "project:connect")) {
    return undefined;
  }

  const importedAt = new Date().toISOString();
  const key = request.projectKey.trim().toUpperCase() || "SP";
  const existing = projects.find((project) => project.key === key);
  const project: SprintProject = {
    id: existing?.id ?? `jira-${key.toLowerCase()}`,
    key,
    name: key === "UX" ? "SprintPulse Experience" : "SprintPulse AI",
    source: "jira",
    jiraSite: request.jiraSite.trim() || "workspace.atlassian.net",
    sprint: {
      id: `jira-sprint-${key.toLowerCase()}`,
      name: key === "UX" ? "Judge Experience Sprint" : "Semicolon Build Sprint",
      goal:
        key === "UX"
          ? "Make the product journey visually polished and easy to evaluate."
          : "Prove say-do gap detection from standups, Jira, and delivery signals.",
      startDate: "2026-05-11",
      endDate: "2026-05-17",
      status: "active"
    },
    members:
      existing?.members ??
      projectMembers("priya", "atharv", "yanshi", "mahesh", "yash", "vipin", "himanshu", "vikrant", "janice"),
    ownerIds: existing?.ownerIds ?? ["priya"],
    scrumMasterIds: existing?.scrumMasterIds ?? ["himanshu"],
    createdBy: existing?.createdBy ?? viewer.id,
    createdAt: existing?.createdAt ?? importedAt,
    updatedAt: importedAt,
    lastSyncAt: importedAt
  };

  if (existing) {
    Object.assign(existing, project);
  } else {
    projects.unshift(project);
  }

  return {
    project,
    importedIssues: key === "UX" ? 11 : 24,
    importedMembers: project.members.length,
    importedAt,
    warnings: ["Jira project details imported into the active SprintPulse workspace."]
  };
};
