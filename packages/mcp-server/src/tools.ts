/**
 * Tool catalog for the SprintPulse MCP server.
 *
 * Each tool is a thin HTTP wrapper over an existing SprintPulse REST route.
 * The MCP host calls the tool by name with an args object matching `inputSchema`;
 * we translate that into the corresponding HTTP request and stream the JSON
 * response back.
 */

const API_BASE = (process.env.SPRINTPULSE_API_BASE ?? "http://localhost:4000/api").replace(/\/$/, "");
const API_KEY = process.env.SPRINTPULSE_API_KEY ?? "";

interface ToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  invoke: (args: Record<string, unknown>) => Promise<unknown>;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) ?? {})
  };
  if (API_KEY) {
    headers["X-SprintPulse-API-Key"] = API_KEY;
  }
  const baseUrl = new URL(API_BASE);
  const baseSearch = new URLSearchParams(baseUrl.search);
  baseUrl.search = "";
  if (!baseUrl.pathname.endsWith("/")) {
    baseUrl.pathname = `${baseUrl.pathname}/`;
  }

  const url = new URL(path.replace(/^\//, ""), baseUrl);
  baseSearch.forEach((value, key) => {
    if (!url.searchParams.has(key)) {
      url.searchParams.set(key, value);
    }
  });

  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    let detail: string;
    try {
      const body = (await res.json()) as { error?: string };
      detail = body.error ?? `HTTP ${res.status}`;
    } catch {
      detail = `HTTP ${res.status}`;
    }
    throw new Error(`SprintPulse ${path}: ${detail}`);
  }
  return (await res.json()) as T;
}

const str = (value: unknown): string => (typeof value === "string" ? value : "");

export const TOOLS: ToolDef[] = [
  {
    name: "get_project_risk",
    description:
      "Get the current risk picture for a SprintPulse project: team health score, top risks, P1 alert state, and recommended next actions. Use this when an agent needs to decide if a project needs intervention.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "SprintPulse project UUID" },
        personaId: { type: "string", description: "Persona ID of the acting user (for permission scoping)" },
        sprintId: { type: "string", description: "Optional sprint ID; defaults to the active sprint" }
      },
      required: ["projectId", "personaId"]
    },
    invoke: async (args) => {
      const projectId = str(args.projectId);
      const personaId = str(args.personaId);
      const sprintId = str(args.sprintId);
      const q = new URLSearchParams({ personaId });
      if (sprintId) q.set("sprintId", sprintId);
      return request(`/projects/${encodeURIComponent(projectId)}/dashboard?${q.toString()}`);
    }
  },
  {
    name: "get_member_health",
    description:
      "Get a single team member's pulse: health score, risk flags (BURNOUT_SIGNAL, BLOCKER_UNRESOLVED, etc.), recent standups, and supporting evidence. Use this to drill into why a project's risk score is what it is.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        memberId: { type: "string", description: "Persona ID of the team member" },
        personaId: { type: "string", description: "Persona ID of the acting user" },
        sprintId: { type: "string" }
      },
      required: ["projectId", "memberId", "personaId"]
    },
    invoke: async (args) => {
      const projectId = str(args.projectId);
      const memberId = str(args.memberId);
      const personaId = str(args.personaId);
      const sprintId = str(args.sprintId);
      const q = new URLSearchParams({ personaId });
      if (sprintId) q.set("sprintId", sprintId);
      return request(`/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}/history?${q.toString()}`);
    }
  },
  {
    name: "submit_standup",
    description:
      "Submit a structured standup entry (yesterday/today/blockers) on behalf of a team member. Use this when an agent has observed or generated a standup update and wants it captured in SprintPulse.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        personaId: { type: "string", description: "Persona ID of the member whose standup this is" },
        yesterday: { type: "string" },
        today: { type: "string" },
        blockers: { type: "string", description: "Use 'No blocker.' when none" }
      },
      required: ["projectId", "personaId", "yesterday", "today"]
    },
    invoke: async (args) => {
      const projectId = str(args.projectId);
      return request(`/projects/${encodeURIComponent(projectId)}/standups`, {
        method: "POST",
        body: JSON.stringify({
          personaId: str(args.personaId),
          yesterday: str(args.yesterday),
          today: str(args.today),
          blockers: str(args.blockers) || "No blocker."
        })
      });
    }
  },
  {
    name: "parse_transcript",
    description:
      "Parse a meeting transcript (WebVTT or plain Speaker: text) into structured per-speaker standups and persist them. Returns the parsed entries plus AI-derived risk analysis for the sprint. Use this when an agent has captured a meeting and wants to land standups + risk update in one call.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        personaId: { type: "string", description: "Persona ID of the acting user (Scrum Master typically)" },
        transcript: { type: "string", description: "WebVTT body or plain text with Speaker: markers" }
      },
      required: ["projectId", "personaId", "transcript"]
    },
    invoke: async (args) => {
      const projectId = str(args.projectId);
      return request(`/projects/${encodeURIComponent(projectId)}/transcripts/parse`, {
        method: "POST",
        body: JSON.stringify({
          personaId: str(args.personaId),
          transcript: str(args.transcript)
        })
      });
    }
  },
  {
    name: "run_member_pr_review",
    description:
      "Run SprintPulse's AI PR review on a member's recent commits/PRs. Returns review notes, complexity flags, and recommended follow-ups. Use this when an agent is helping triage code-review pressure across the team.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        memberId: { type: "string" },
        personaId: { type: "string" },
        sprintId: { type: "string" }
      },
      required: ["projectId", "memberId", "personaId"]
    },
    invoke: async (args) => {
      const projectId = str(args.projectId);
      const memberId = str(args.memberId);
      return request(`/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}/ai/pr-review`, {
        method: "POST",
        body: JSON.stringify({
          personaId: str(args.personaId),
          sprintId: str(args.sprintId) || null
        })
      });
    }
  },
  {
    name: "send_app_notification",
    description:
      "Create an in-app SprintPulse notification/action item for a project member. Use this when an agent has identified a follow-up and needs it to appear inside SprintPulse instead of sending email or chat.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        personaId: { type: "string", description: "Persona ID of the acting user creating the notification" },
        targetPersonaId: { type: "string", description: "Persona ID of the member who should receive or own the follow-up" },
        title: { type: "string" },
        message: { type: "string" },
        severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
        kind: { type: "string", enum: ["standup", "jira", "git", "delivery", "team"] },
        sprintId: { type: "string" },
        issueKeys: {
          type: "array",
          items: { type: "string" },
          description: "Optional Jira issue keys connected to this follow-up"
        }
      },
      required: ["projectId", "personaId", "targetPersonaId", "title", "message"]
    },
    invoke: async (args) => {
      const projectId = str(args.projectId);
      return request(`/projects/${encodeURIComponent(projectId)}/notifications`, {
        method: "POST",
        body: JSON.stringify({
          personaId: str(args.personaId),
          targetPersonaId: str(args.targetPersonaId),
          title: str(args.title),
          message: str(args.message),
          severity: str(args.severity) || "medium",
          kind: str(args.kind) || "team",
          sprintId: str(args.sprintId) || undefined,
          issueKeys: Array.isArray(args.issueKeys) ? args.issueKeys.map(str).filter(Boolean) : undefined
        })
      });
    }
  }
];

export async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return tool.invoke(args);
}
