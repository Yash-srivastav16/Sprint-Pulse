import { type Router } from "express";
import { mockFlowEnabled } from "../config/runtime.js";
import { findPersona, findProject, findPulse, hasPermission } from "../data/seed.js";
import { buildSupabaseProjectMemberHistory } from "../data/supabaseProjectOps.js";

export function registerMemberRoutes(router: Router): void {
  router.get("/projects/:projectId/members/:memberId/history", async (req, res) => {
    if (!mockFlowEnabled) {
      try {
        const response = await buildSupabaseProjectMemberHistory(
          String(req.params.projectId ?? ""),
          String(req.params.memberId ?? ""),
          String(req.query.personaId ?? ""),
          req.query.sprintId ? String(req.query.sprintId) : undefined
        );
        if (!response) {
          res.status(404).json({ error: "Member not found or not visible to this user" });
          return;
        }
        res.json(response);
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Unable to load member history" });
      }
      return;
    }

    const personaId = String(req.query.personaId ?? "");
    const project = findProject(String(req.params.projectId ?? ""));
    const persona = findPersona(personaId);
    const member = findPulse(req.params.memberId);

    if (!project || !persona || !member || !hasPermission(persona, "member:viewOwn", project)) {
      res.status(404).json({ error: "Member not found or not visible to this user" });
      return;
    }

    const canViewTeamPulse = hasPermission(persona, "member:viewTeam", project);
    if (!canViewTeamPulse && member.personaId !== persona.id) {
      res.status(403).json({ error: "This role can only view its own member pulse" });
      return;
    }

    const issues = (member.tickets ?? []).map((t, i) => ({
      id: `${member.id}-issue-${i}`,
      projectId: project.id,
      issueKey: t.key,
      summary: t.title,
      status: t.status as "Todo" | "In Progress" | "Review" | "Blocked" | "Done",
      assigneeProfileId: member.personaId,
      storyPoints: t.storyPoints,
      daysIdle: t.daysIdle,
      priority: "Medium"
    }));

    const recommendations = [];
    if (member.recommendation) {
      recommendations.push({
        id: `${member.id}-rec-0`,
        projectId: project.id,
        profileId: member.personaId,
        kind: "delivery" as const,
        severity: member.riskLevel as "low" | "medium" | "high" | "critical",
        title: "AI Recommendation",
        message: member.recommendation,
        status: "open" as const,
        createdAt: new Date().toISOString()
      });
    }
    for (const flag of member.flags ?? []) {
      recommendations.push({
        id: flag.id,
        projectId: project.id,
        profileId: member.personaId,
        kind: "standup" as const,
        severity: flag.severity as "low" | "medium" | "high" | "critical",
        title: flag.title,
        message: flag.message,
        status: "open" as const,
        createdAt: new Date().toISOString()
      });
    }

    res.json({ viewer: persona, member, project, issues, commits: [], recommendations, standups: member.standups });
  });

  router.get("/projects/:projectId/members/:memberId", async (req, res) => {
    if (!mockFlowEnabled) {
      try {
        const response = await buildSupabaseProjectMemberHistory(
          String(req.params.projectId ?? ""),
          String(req.params.memberId ?? ""),
          String(req.query.personaId ?? ""),
          req.query.sprintId ? String(req.query.sprintId) : undefined
        );
        if (!response) {
          res.status(404).json({ error: "Member not found or not visible to this user" });
          return;
        }
        res.json({ member: response.member, project: response.project });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Unable to load member pulse" });
      }
      return;
    }

    const personaId = String(req.query.personaId ?? "");
    const project = findProject(String(req.params.projectId ?? ""));
    const persona = findPersona(personaId);
    const member = findPulse(req.params.memberId);

    if (!project || !persona || !member || !hasPermission(persona, "member:viewOwn", project)) {
      res.status(404).json({ error: "Member not found or not visible to this user" });
      return;
    }

    const canViewTeam = hasPermission(persona, "member:viewTeam", project);
    if (!canViewTeam && member.personaId !== persona.id) {
      res.status(403).json({ error: "This role can only view its own member pulse" });
      return;
    }

    res.json({ member, project });
  });
}
