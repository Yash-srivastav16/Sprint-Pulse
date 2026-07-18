import test from "node:test";
import assert from "node:assert/strict";
import { TOOLS, callTool } from "../packages/mcp-server/dist/tools.js";

const expectedTools = [
  "get_project_risk",
  "get_member_health",
  "submit_standup",
  "parse_transcript",
  "run_member_pr_review",
  "send_app_notification"
];

test("MCP exposes the shipped SprintPulse tool catalog", () => {
  assert.deepEqual(
    TOOLS.map((tool) => tool.name),
    expectedTools
  );
});

test("MCP tools declare object schemas with required arguments", () => {
  for (const tool of TOOLS) {
    assert.equal(tool.inputSchema.type, "object", tool.name);
    assert.ok(Object.keys(tool.inputSchema.properties).length > 0, tool.name);
    assert.ok(Array.isArray(tool.inputSchema.required), tool.name);
    assert.ok(tool.inputSchema.required.length > 0, tool.name);
    assert.equal(typeof tool.description, "string", tool.name);
    assert.ok(tool.description.length > 30, tool.name);
  }
});

test("MCP rejects unknown tool calls before making an HTTP request", async () => {
  await assert.rejects(() => callTool("unknown_tool", {}), /Unknown tool: unknown_tool/);
});
