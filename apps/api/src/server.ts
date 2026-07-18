import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { apiRouter } from "./routes/index.js";
import { apiAuthMiddleware } from "./middleware/apiKey.js";

const app = express();
const port = Number(process.env.PORT ?? 8000);
const configuredOrigins = process.env.CORS_ORIGIN?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173"
];
const allowedOrigins = new Set(configuredOrigins?.length ? configuredOrigins : defaultOrigins);
const localOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin === "null" || allowedOrigins.has(origin) || localOriginPattern.test(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));

// Auth gate runs before the api router. If SPRINTPULSE_API_KEY env is unset
// the middleware is a no-op so dev/local flows are untouched. When set, every
// /api/* request needs either the matching header or a valid Supabase JWT.
// /api/health is exempted from inside the middleware so container probes work.
app.use("/api", apiAuthMiddleware());
app.use("/api", apiRouter);

if (process.env.NODE_ENV === "production") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const webDistPath = process.env.WEB_DIST_PATH ?? path.join(__dirname, "../../../apps/web/dist");

  app.use(express.static(webDistPath));

  // Express 5 requires named wildcard — bare * is not valid in path-to-regexp v8
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(webDistPath, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`SprintPulse API running on http://localhost:${port}`);
});
