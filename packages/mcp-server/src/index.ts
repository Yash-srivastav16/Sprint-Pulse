#!/usr/bin/env node
/**
 * SprintPulse MCP server
 *
 * Exposes the SprintPulse REST API as a set of Model Context Protocol tools so
 * any MCP-capable agent (Claude Code, Cursor, custom OpenAI agents via an MCP
 * bridge) can discover and invoke them without bespoke connectors.
 *
 * Transport: stdio. Start the binary in your MCP host's config like:
 *
 *   {
 *     "mcpServers": {
 *       "sprintpulse": {
 *         "command": "node",
 *         "args": ["./packages/mcp-server/dist/index.js"],
 *         "env": {
 *           "SPRINTPULSE_API_BASE": "http://localhost:4000/api",
 *           "SPRINTPULSE_API_KEY": "<optional-token-matching-API_KEY>"
 *         }
 *       }
 *     }
 *   }
 *
 * Tools live in `./tools.ts`. Each is a thin HTTP wrapper over an existing
 * SprintPulse route, so the server has no business logic — it just translates
 * MCP tool calls into HTTP calls.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { TOOLS, callTool } from "./tools.js";

const server = new Server(
  {
    name: "sprintpulse-mcp",
    version: "0.1.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema
  }))
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await callTool(name, args ?? {});
    return {
      content: [
        {
          type: "text",
          text: typeof result === "string" ? result : JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tool invocation failed";
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${message}` }]
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // No stdout chatter — MCP clients parse this stream. Use stderr for logs.
  process.stderr.write(`sprintpulse-mcp started (api: ${process.env.SPRINTPULSE_API_BASE ?? "http://localhost:4000/api"})\n`);
}

main().catch((err) => {
  process.stderr.write(`sprintpulse-mcp fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
