#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const envFiles = ["apps/api/.env.production", "apps/api/.env", "apps/api/.env.local"];
const expectedPersonas = [
  { id: "maya-chen", role: "scrum-master", label: "Scrum Master" },
  { id: "priya-shah", role: "product-owner", label: "Product Owner" },
  { id: "devon-reed", role: "engineering-manager", label: "Engineering Manager" },
  { id: "leo-martinez", role: "developer", label: "Developer" },
  { id: "aisha-okafor", role: "qa-lead", label: "QA Lead" }
];

const readEnvFiles = async () => {
  const result = {};
  for (const file of envFiles) {
    try {
      const text = await readFile(file, "utf8");
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const separator = trimmed.indexOf("=");
        if (separator === -1) continue;
        const key = trimmed.slice(0, separator).trim();
        const rawValue = trimmed.slice(separator + 1).trim();
        result[key] = rawValue.replace(/^["']|["']$/g, "");
      }
    } catch {
      // Missing env files are fine; process.env can still provide values.
    }
  }
  return result;
};

const env = { ...(await readEnvFiles()), ...process.env };
const apiBase = (env.SPRINTPULSE_API_BASE ?? "http://127.0.0.1:4000/api").replace(/\/+$/, "");
const apiKey = env.SPRINTPULSE_API_KEY;

const requestJson = async (path) => {
  const response = await fetch(`${apiBase}${path}`, {
    headers: apiKey ? { "X-SprintPulse-API-Key": apiKey } : {}
  });
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
  return response.json();
};

try {
  const personasResponse = await requestJson("/personas");
  const personas = Array.isArray(personasResponse.personas) ? personasResponse.personas : [];
  const byId = new Map(personas.map((persona) => [persona.id, persona]));
  let failures = 0;

  console.log("Role-switch demo check");
  for (const expected of expectedPersonas) {
    const persona = byId.get(expected.id);
    if (!persona) {
      console.log(`FAIL ${expected.id}: missing ${expected.label} persona`);
      failures += 1;
      continue;
    }
    if (persona.productPersona !== expected.role && persona.role !== expected.role) {
      console.log(`FAIL ${expected.id}: expected ${expected.role}, got ${persona.productPersona ?? persona.role ?? "unknown"}`);
      failures += 1;
      continue;
    }

    const projectsResponse = await requestJson(`/projects?personaId=${encodeURIComponent(expected.id)}`);
    const projects = Array.isArray(projectsResponse.projects) ? projectsResponse.projects : [];
    if (!projects.length) {
      console.log(`FAIL ${expected.id}: no visible projects`);
      failures += 1;
      continue;
    }
    console.log(`PASS ${expected.id}: ${expected.label}, ${projects.length} visible project(s)`);
  }

  if (failures > 0) {
    process.exitCode = 1;
  } else {
    console.log("All pre-configured role-switch personas are ready.");
  }
} catch (error) {
  console.error(`Role-switch demo check failed: ${error instanceof Error ? error.message : String(error)}`);
  console.error("Start the API first with `npm run dev:api` and confirm the Supabase seed data is loaded.");
  process.exitCode = 1;
}
