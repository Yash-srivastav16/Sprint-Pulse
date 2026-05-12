import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

for (const envFile of [".env.local", ".env"]) {
  const envPath = resolve(apiRoot, envFile);
  if (existsSync(envPath)) {
    config({ path: envPath, override: false });
  }
}

if (process.env.ALLOW_INSECURE_LOCAL_TLS === "true") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}
