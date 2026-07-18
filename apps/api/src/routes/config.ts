import { Router } from "express";

const router = Router();

/**
 * GET /api/config
 * Returns public-facing deployment config for the frontend.
 * Protected by the existing auth middleware (Supabase JWT or API key).
 */
router.get("/", (_req, res) => {
  res.json({
    sprintpulseApiKey: process.env.SPRINTPULSE_API_KEY ?? "",
  });
});

export { router as configRouter };
