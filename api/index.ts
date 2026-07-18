import type { VercelRequest, VercelResponse } from "@vercel/node";
import cors from "cors";
import express from "express";
import { apiRouter } from "../apps/api/src/routes/index.js";
import { apiAuthMiddleware } from "../apps/api/src/middleware/apiKey.js";

const app = express();

const configuredOrigins = process.env.CORS_ORIGIN?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
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
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use("/api", apiAuthMiddleware());
app.use("/api", apiRouter);

export default function handler(req: VercelRequest, res: VercelResponse) {
  app(req as any, res as any);
}
