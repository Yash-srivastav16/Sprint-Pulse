import { type Router } from "express";
import type { CreateProjectRequest, JiraConnectRequest } from "@sprintpulse/shared";
import { mockFlowEnabled } from "../config/runtime.js";
import {
  buildProjectDetail,
  buildProjectsResponse,
  buildProjectWorkspace,
  connectJiraProjectData,
  createManualProject
} from "../data/seed.js";
import {
  buildSupabaseProjectDetail,
  buildSupabaseProjectWorkspace,
  buildSupabaseProjectsResponse,
  connectSupabaseJiraProject,
  createSupabaseProject
} from "../data/supabaseProjects.js";
import { buildSupabaseProjectOps } from "../data/supabaseProjectOps.js";

export function registerProjectRoutes(router: Router): void {
  router.get("/projects", async (req, res) => {
    if (!mockFlowEnabled) {
      try {
        const response = await buildSupabaseProjectsResponse(String(req.query.personaId ?? ""));
        if (!response) {
          res.status(404).json({ error: "Profile not found" });
          return;
        }
        res.json(response);
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Unable to load projects" });
      }
      return;
    }

    const response = buildProjectsResponse(String(req.query.personaId ?? ""));
    if (!response) {
      res.status(404).json({ error: "Persona not found" });
      return;
    }
    res.json(response);
  });

  router.post("/projects", async (req, res) => {
    if (!mockFlowEnabled) {
      const request = req.body as CreateProjectRequest;
      if (!request.projectName || !request.projectKey || !request.sprintName || !request.sprintGoal) {
        res.status(400).json({ error: "Project name, key, sprint name, and sprint goal are required" });
        return;
      }
      try {
        const result = await createSupabaseProject(request);
        if (!result) {
          res.status(403).json({ error: "You do not have permission to create projects" });
          return;
        }
        res.status(201).json(result);
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Project creation failed" });
      }
      return;
    }

    const request = req.body as CreateProjectRequest;
    if (!request.projectName || !request.projectKey || !request.sprintName || !request.sprintGoal) {
      res.status(400).json({ error: "Project name, key, sprint name, and sprint goal are required" });
      return;
    }

    const result = createManualProject(request);
    if (!result) {
      res.status(403).json({ error: "You do not have permission to create projects" });
      return;
    }
    res.status(201).json(result);
  });

  router.post("/projects/connect/jira", async (req, res) => {
    const request = req.body as JiraConnectRequest;
    if (!request.jiraSite || !request.projectKey) {
      res.status(400).json({ error: "Jira site and project key are required" });
      return;
    }

    if (!mockFlowEnabled) {
      try {
        const result = await connectSupabaseJiraProject(request);
        if (!result) {
          res.status(403).json({ error: "You do not have permission to connect Jira projects" });
          return;
        }
        res.status(201).json(result);
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Jira connection failed" });
      }
      return;
    }

    const result = connectJiraProjectData(request);
    if (!result) {
      res.status(403).json({ error: "You do not have permission to connect Jira projects" });
      return;
    }
    res.status(201).json(result);
  });

  router.get("/projects/:projectId", async (req, res) => {
    if (!mockFlowEnabled) {
      try {
        const response = await buildSupabaseProjectDetail(
          String(req.params.projectId ?? ""),
          String(req.query.personaId ?? "")
        );
        if (!response) {
          res.status(404).json({ error: "Project not found or not visible to this user" });
          return;
        }
        res.json(response);
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Unable to load project" });
      }
      return;
    }

    const response = buildProjectDetail(req.params.projectId, String(req.query.personaId ?? ""));
    if (!response) {
      res.status(404).json({ error: "Project not found or not visible to this user" });
      return;
    }
    res.json(response);
  });

  router.get("/projects/:projectId/workspace", async (req, res) => {
    if (!mockFlowEnabled) {
      try {
        const response = await buildSupabaseProjectWorkspace(
          String(req.params.projectId ?? ""),
          String(req.query.personaId ?? "")
        );
        if (!response) {
          res.status(404).json({ error: "Project workspace not found or not visible to this user" });
          return;
        }
        res.json(response);
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Unable to load project workspace" });
      }
      return;
    }

    const response = buildProjectWorkspace(req.params.projectId, String(req.query.personaId ?? ""));
    if (!response) {
      res.status(404).json({ error: "Project workspace not found or not visible to this user" });
      return;
    }
    res.json(response);
  });

  router.get("/projects/:projectId/ops", async (req, res) => {
    if (!mockFlowEnabled) {
      try {
        const response = await buildSupabaseProjectOps(
          String(req.params.projectId ?? ""),
          String(req.query.personaId ?? "")
        );
        if (!response) {
          res.status(404).json({ error: "Project operations not found or not visible to this user" });
          return;
        }
        res.json(response);
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Unable to load project operations" });
      }
      return;
    }

    const response = buildProjectWorkspace(req.params.projectId, String(req.query.personaId ?? ""));
    if (!response) {
      res.status(404).json({ error: "Project operations not found or not visible to this user" });
      return;
    }
    res.json({
      ...response,
      currentSprint: {
        ...response.project.sprint,
        issueCount: 0,
        standupCount: 0,
        commitCount: 0,
        blockerCount: response.summary.openBlockers,
        healthScore: response.summary.healthScore
      },
      integrations: { jira: null, git: null, recentRuns: [] }
    });
  });
}
