import cors from "cors";
import express from "express";
import fs from "fs";
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
  const indexHtmlPath = path.join(webDistPath, "index.html");
  const indexHtml = fs.readFileSync(indexHtmlPath, "utf8");

  const appendAppParam = (url: string, appId: string) => {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}app=${encodeURIComponent(appId)}`;
  };

  const renderIndexHtml = (appId?: string) => {
    if (!appId) {
      return indexHtml;
    }

    const htmlWithRoutedAssets = indexHtml.replace(/\b(src|href)="([^"]+)"/g, (match, attr: string, url: string) => {
      if (url.startsWith("/assets/") || url === "/favicon.ico") {
        return `${attr}="${appendAppParam(url, appId)}"`;
      }
      return match;
    });

    if (/\brel=["'](?:shortcut icon|icon)["']/.test(htmlWithRoutedAssets)) {
      return htmlWithRoutedAssets;
    }

    return htmlWithRoutedAssets.replace("</head>", `    <link rel="icon" href="${appendAppParam("/favicon.ico", appId)}" />\n  </head>`);
  };

  app.get("/favicon.ico", (_req, res) => {
    res.status(204).end();
  });

  app.use(express.static(webDistPath, { index: false }));

  const defaultAppId = process.env.DEFAULT_APP_ID?.trim() || undefined;

  // Express 5 requires named wildcard — bare * is not valid in path-to-regexp v8
  app.get("/{*splat}", (req, res) => {
    const appId = typeof req.query.app === "string" ? req.query.app : undefined;

    // SemicoLabs edge proxy routes to this container by the `?app=` query param.
    // On deep-link refresh (e.g. /projects/:id/dashboard) the browser drops the
    // param, which makes the proxy 503 before the request reaches Express. If a
    // DEFAULT_APP_ID is configured, redirect any non-API GET that lacks `app=`
    // back to itself with the param appended so the proxy can route it.
    if (!appId && defaultAppId) {
      res.redirect(302, appendAppParam(req.originalUrl, defaultAppId));
      return;
    }

    res.type("html").send(renderIndexHtml(appId ?? defaultAppId));
  });
}

app.listen(port, () => {
  console.log(`SprintPulse API running on http://localhost:${port}`);
});
