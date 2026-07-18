import { type Router, type Request, type Response } from "express";
import type { InviteProjectMemberRequest, LinkProjectMemberRequest, UpdateProjectMemberRequest } from "@sprintpulse/shared";
import { mockFlowEnabled, realDataNotReadyMessage } from "../config/runtime.js";
import { buildProjectDetail } from "../data/seed.js";
import {
  buildSupabaseTeam,
  inviteSupabaseProjectMember,
  linkSupabaseProjectMember,
  updateSupabaseProjectMember
} from "../data/supabaseProjectOps.js";

export function registerTeamRoutes(router: Router): void {
  router.get("/projects/:projectId/team", async (req, res) => {
    if (!mockFlowEnabled) {
      try {
        const response = await buildSupabaseTeam(
          String(req.params.projectId ?? ""),
          String(req.query.personaId ?? "")
        );
        if (!response) {
          res.status(404).json({ error: "Team not found or not visible to this user" });
          return;
        }
        res.json(response);
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Unable to load team" });
      }
      return;
    }

    const detail = buildProjectDetail(req.params.projectId, String(req.query.personaId ?? ""));
    if (!detail) {
      res.status(404).json({ error: "Team not found or not visible to this user" });
      return;
    }
    res.json({ ...detail, members: detail.project.members, availableUsers: [], invites: [], canEditTeam: detail.permissions.includes("project:editTeam") });
  });

  const addProjectMember = async (req: Request, res: Response) => {
    if (!mockFlowEnabled) {
      try {
        const result = await inviteSupabaseProjectMember(
          String(req.params.projectId ?? ""),
          req.body as InviteProjectMemberRequest
        );
        res.status(201).json(result);
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Unable to add project member" });
      }
      return;
    }
    res.status(501).json({ error: realDataNotReadyMessage });
  };

  router.post("/projects/:projectId/invites", addProjectMember);
  router.post("/projects/:projectId/team", addProjectMember);

  router.patch("/projects/:projectId/team/:profileId", async (req, res) => {
    if (!mockFlowEnabled) {
      try {
        const response = await updateSupabaseProjectMember(
          String(req.params.projectId ?? ""),
          String(req.params.profileId ?? ""),
          req.body as UpdateProjectMemberRequest
        );
        if (!response) {
          res.status(404).json({ error: "Team member not found or not visible to this user" });
          return;
        }
        res.json(response);
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Unable to update team member" });
      }
      return;
    }
    res.status(501).json({ error: realDataNotReadyMessage });
  });

  router.post("/projects/:projectId/team/:profileId/link", async (req, res) => {
    if (!mockFlowEnabled) {
      try {
        const response = await linkSupabaseProjectMember(
          String(req.params.projectId ?? ""),
          String(req.params.profileId ?? ""),
          req.body as LinkProjectMemberRequest
        );
        if (!response) {
          res.status(404).json({ error: "Team member or SprintPulse user was not found" });
          return;
        }
        res.json(response);
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Unable to link SprintPulse user" });
      }
      return;
    }
    res.status(501).json({ error: realDataNotReadyMessage });
  });
}
