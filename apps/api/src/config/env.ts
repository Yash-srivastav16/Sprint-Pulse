import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// Load order (first-write wins because override:false):
//   1. .env.local             - developer's local overrides (gitignored / dockerignored)
//   2. .env.production        - prod-only config, loaded only when NODE_ENV=production
//   3. .env                   - baseline defaults
//
// In a deployed container, .env.local is absent so .env.production drives
// the prod config. Platform-injected env vars (set before Node starts) still
// take precedence over any file because dotenv won't overwrite an already-set
// process.env entry under override:false.
const envFiles: string[] = [".env.local"];
if (process.env.NODE_ENV === "production") {
  envFiles.push(".env.production");
}
envFiles.push(".env");

for (const envFile of envFiles) {
  const envPath = resolve(apiRoot, envFile);
  if (existsSync(envPath)) {
    config({ path: envPath, override: false });
  }
}

if (process.env.ALLOW_INSECURE_LOCAL_TLS === "true") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}
