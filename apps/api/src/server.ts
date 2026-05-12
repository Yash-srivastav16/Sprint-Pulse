import cors from "cors";
import express from "express";
import { apiRouter } from "./routes/index.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const configuredOrigins = process.env.CORS_ORIGIN?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "https://app.swaggerhub.com",
  "https://editor.swagger.io"
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

app.use("/api", apiRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(port, () => {
  console.log(`SprintPulse API running on http://localhost:${port}`);
});
