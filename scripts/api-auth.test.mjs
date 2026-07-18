import test from "node:test";
import assert from "node:assert/strict";
import { apiAuthMiddleware } from "../apps/api/dist/middleware/apiKey.js";

const originalApiKey = process.env.SPRINTPULSE_API_KEY;

const createReq = ({ path = "/projects", method = "GET", headers = {} } = {}) => ({
  path,
  method,
  query: {},
  get: (name) => headers[name] ?? headers[name.toLowerCase()]
});

const runMiddleware = async (handler, req) => {
  let nextCalled = false;
  const response = {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };

  await handler(req, response, () => {
    nextCalled = true;
  });

  return { nextCalled, response };
};

test.after(() => {
  if (originalApiKey === undefined) {
    delete process.env.SPRINTPULSE_API_KEY;
  } else {
    process.env.SPRINTPULSE_API_KEY = originalApiKey;
  }
});

test("API auth is a no-op when SPRINTPULSE_API_KEY is unset for local demo mode", async () => {
  delete process.env.SPRINTPULSE_API_KEY;
  const result = await runMiddleware(apiAuthMiddleware(), createReq());

  assert.equal(result.nextCalled, true);
  assert.equal(result.response.statusCode, 200);
});

test("API auth allows public health checks when key auth is enabled", async () => {
  process.env.SPRINTPULSE_API_KEY = "expected-key";
  const result = await runMiddleware(apiAuthMiddleware(), createReq({ path: "/health" }));

  assert.equal(result.nextCalled, true);
  assert.equal(result.response.statusCode, 200);
});

test("API auth accepts the configured server-to-server key", async () => {
  process.env.SPRINTPULSE_API_KEY = "expected-key";
  const result = await runMiddleware(
    apiAuthMiddleware(),
    createReq({ headers: { "X-SprintPulse-API-Key": "expected-key" } })
  );

  assert.equal(result.nextCalled, true);
  assert.equal(result.response.statusCode, 200);
});

test("API auth rejects missing credentials when key auth is enabled", async () => {
  process.env.SPRINTPULSE_API_KEY = "expected-key";
  const originalWarn = console.warn;
  console.warn = () => {};
  let result;
  try {
    result = await runMiddleware(apiAuthMiddleware(), createReq());
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(result.nextCalled, false);
  assert.equal(result.response.statusCode, 401);
  assert.match(result.response.body.error, /Missing or invalid credentials/);
});
