import test from "node:test";
import assert from "node:assert/strict";
import { encode as toonEncode } from "@toon-format/toon";

const samplePayload = {
  members: [
    { id: "u1", name: "Yash", score: 34, flags: 3 },
    { id: "u2", name: "Atharv", score: 58, flags: 1 },
    { id: "u3", name: "Maya", score: 82, flags: 0 }
  ],
  sprint: {
    id: "sprint-1",
    name: "Sprint 1",
    daysRemaining: 6
  }
};

const approximateTokens = (value) => Math.ceil(value.length / 4);

test("TOON encoder produces a non-empty string for SprintPulse-shaped payload", () => {
  const encoded = toonEncode(samplePayload);
  assert.equal(typeof encoded, "string");
  assert.ok(encoded.length > 0, "encoder should produce output");
});

test("TOON encoding is smaller than JSON for tabular member data", () => {
  const json = JSON.stringify(samplePayload);
  const toon = toonEncode(samplePayload);
  assert.ok(toon.length < json.length, `TOON (${toon.length}) should be smaller than JSON (${json.length})`);
});

test("TOON achieves at least 20% character reduction on representative payload", () => {
  const json = JSON.stringify(samplePayload);
  const toon = toonEncode(samplePayload);
  const reduction = (json.length - toon.length) / json.length;
  assert.ok(reduction >= 0.2, `expected ≥20% reduction, got ${(reduction * 100).toFixed(1)}%`);
});

test("TOON encoding retains the same approximate-token reduction shape", () => {
  const jsonTokens = approximateTokens(JSON.stringify(samplePayload));
  const toonTokens = approximateTokens(toonEncode(samplePayload));
  assert.ok(toonTokens <= jsonTokens, "token approximation should be no larger than JSON");
});

test("TOON encoder handles deeply nested objects without throwing", () => {
  const nested = {
    project: {
      sprint: {
        members: [
          { id: "a", standups: [{ day: "Mon", text: "started" }, { day: "Tue", text: "continued" }] }
        ]
      }
    }
  };
  assert.doesNotThrow(() => toonEncode(nested));
  const encoded = toonEncode(nested);
  assert.ok(encoded.includes("started"), "encoded payload should preserve string contents");
});

test("TOON encoder handles empty arrays and objects safely", () => {
  assert.doesNotThrow(() => toonEncode({}));
  assert.doesNotThrow(() => toonEncode({ members: [] }));
  assert.doesNotThrow(() => toonEncode({ project: {}, sprint: {}, members: [] }));
});

test("TOON output contains the canonical row delimiter for tabular data", () => {
  const encoded = toonEncode(samplePayload);
  // TOON uses a header line with `[N]{cols}:` followed by comma-separated rows
  assert.match(encoded, /members\[\d+\]\{[^}]+\}/, "should emit a tabular header for members");
});
