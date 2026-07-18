# @sprintpulse/mcp-server

Model Context Protocol server exposing SprintPulse's API as agent-callable tools.

Any MCP-capable agent (Claude Code, Cursor, Continue, custom OpenAI agents via an MCP bridge) can discover and invoke these tools without writing a connector. Same backend, multiple agent hosts, zero glue code per host.

## Tools

| Tool | Purpose |
|---|---|
| `get_project_risk` | Current team health, top risks, P1 state, next actions |
| `get_member_health` | Single member's pulse — flags, standups, evidence |
| `submit_standup` | Create a structured standup entry |
| `parse_transcript` | VTT/plain transcript → per-speaker standups + AI risk update |
| `run_member_pr_review` | AI review of a member's recent PRs |
| `send_app_notification` | Create an in-app follow-up/action item for a project member |

Every tool is a thin HTTP wrapper over an existing SprintPulse REST route — no business logic in this package, just protocol translation.

## Install

From the monorepo root:

```bash
npm install --workspaces
npm run build -w packages/mcp-server
```

## Wire into an MCP host

### Claude Code (`~/.claude/mcp_settings.json` or `claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "sprintpulse": {
      "command": "node",
      "args": ["/absolute/path/to/Semicolons/packages/mcp-server/dist/index.js"],
      "env": {
        "SPRINTPULSE_API_BASE": "http://localhost:4000/api",
        "SPRINTPULSE_API_KEY": ""
      }
    }
  }
}
```

### Cursor (`~/.cursor/mcp.json`)

Same shape as above. Restart the client after editing.

MCP hosts discover the tool catalog when the server starts. After rebuilding this package or adding a tool, restart or reload Claude Code, Cursor, Codex, or any other MCP host before expecting the new tool to appear.

### Local dev (no host)

```bash
SPRINTPULSE_API_BASE=http://localhost:4000/api npm run dev -w packages/mcp-server
```

The server speaks MCP over stdio so it's not useful without a client driving the protocol — but `dev` is handy for catching startup errors.

## Environment

| Var | Required | Default |
|---|---|---|
| `SPRINTPULSE_API_BASE` | no | `http://localhost:4000/api` |
| `SPRINTPULSE_API_KEY` | when API enforces auth | empty |

`SPRINTPULSE_API_KEY` is sent as `X-SprintPulse-API-Key` on every outbound request. The SprintPulse API gates `/api/*` on this header (or a valid Supabase JWT) when its own `SPRINTPULSE_API_KEY` env var is set — both sides must use the same value. `/api/health` stays public so container probes work.

When the API runs without `SPRINTPULSE_API_KEY` set (the default dev/local case), this MCP-side variable is optional too: the header is sent if you provide a value, and ignored if you don't.

If the deployment needs a routing query, include it in `SPRINTPULSE_API_BASE`; for example, `https://solution1.demopersistent.com/api?app=<app-id>`. Query params from the base URL are carried into every MCP API call.

**Threat-model note:** This shared secret authenticates the MCP server *as a whole* to the API. It does not authenticate which user the agent is acting on behalf of — the `personaId` parameter on each tool call is still trusted. An adversarial prompt can ask the agent to act "as" any persona it can name. The next layer (per-user Personal Access Tokens) is on the roadmap; until then, treat the MCP server as a privileged caller and only run it in trusted contexts.

## Example agent prompts

Once the server is wired into Claude Code or Cursor, the agent can do things like:

> "Look up risk on project bda0e205-… as persona yash. If team health is below 70, pull each member's pulse and propose one mitigation per flag."

> "Here's the transcript from today's standup [pasted]. Parse it for project SCRUM as persona yash and report which members didn't have a clear today/yesterday."

> "Run the PR review tool on every developer in the SCRUM project. Summarise the top 3 review-pressure risks."

> "Notify Maya Chen in the app to clarify the OPS blocker and ask who owns the next action."

The agent discovers each tool through MCP's `tools/list` and calls them autonomously based on the prompt.

## Adding a new tool

Edit `src/tools.ts`, append a `ToolDef` to the `TOOLS` array. No other code changes needed — the request dispatch in `index.ts` reflects the registry automatically.
