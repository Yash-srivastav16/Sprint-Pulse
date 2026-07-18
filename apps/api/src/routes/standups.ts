import { type Router } from "express";
import type { StandupEntry } from "@sprintpulse/shared";
import { mockFlowEnabled, realDataNotReadyMessage } from "../config/runtime.js";
import {
  addStandupEntry,
  findPersona,
  findProject,
  hasPermission,
  memberPulses,
  personas
} from "../data/seed.js";
import {
  buildSupabaseProjectStandups,
  parseSupabaseProjectTranscript,
  submitSupabaseProjectStandup,
  syncSupabaseProjectSignals
} from "../data/supabaseProjectOps.js";
import { supabaseAdmin, supabaseAdminConfigError } from "../lib/supabaseAdmin.js";
import {
  projectHasAnyActiveWebhookToken,
  validateProjectWebhookToken
} from "../data/supabaseWebhookTokens.js";

/**
 * Strip WEBVTT header, cue identifiers, timestamps, and inline tags so we're
 * left with bare "<Speaker>: <text>" lines that parseSupabaseProjectTranscript
 * already understands. If the body isn't VTT, returns it unchanged.
 */
const vttToPlainText = (raw: string): string => {
  if (!/^\s*WEBVTT/i.test(raw)) {
    return raw;
  }
  return raw
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (/^WEBVTT/i.test(trimmed)) return false;
      if (/^NOTE\b/i.test(trimmed)) return false;
      if (/^\d+$/.test(trimmed)) return false;
      if (/^\d{1,2}:\d{2}(?::\d{2})?[.,]?\d*\s*-->/.test(trimmed)) return false;
      return true;
    })
    .map((line) => line.replace(/<[^>]+>/g, "").trim())
    .join("\n");
};

const findProjectMemberPersonaIdByEmail = async (projectId: string, email: string): Promise<string | null> => {
  if (!supabaseAdmin) {
    throw new Error(supabaseAdminConfigError ?? "Supabase admin client is not configured.");
  }
  const client = supabaseAdmin;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const { data: profile } = await client
    .from("profiles")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();
  if (!profile?.id) return null;

  const { data: membership } = await client
    .from("project_members")
    .select("profile_id")
    .eq("project_id", projectId)
    .eq("profile_id", profile.id as string)
    .maybeSingle();

  return membership?.profile_id ? String(membership.profile_id) : null;
};

export function registerStandupRoutes(router: Router): void {
  router.get("/projects/:projectId/standups", async (req, res) => {
    if (!mockFlowEnabled) {
      try {
        const response = await buildSupabaseProjectStandups(
          String(req.params.projectId ?? ""),
          String(req.query.personaId ?? ""),
          req.query.sprintId ? String(req.query.sprintId) : undefined
        );
        if (!response) {
          res.status(404).json({ error: "Standups not found or not visible to this user" });
          return;
        }
        res.json(response);
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Unable to load standups" });
      }
      return;
    }

    const personaId = String(req.query.personaId ?? "");
    const project = findProject(String(req.params.projectId ?? ""));
    const persona = findPersona(personaId);

    if (!project || !persona || !hasPermission(persona, "project:view", project)) {
      res.status(404).json({ error: "Standups not found or not visible to this user" });
      return;
    }

    const memberIds = new Set(project.members.map((member) => member.personaId));
    const standups = memberPulses
      .filter((pulse) => memberIds.has(pulse.personaId))
      .flatMap((pulse) => pulse.standups.map((entry) => ({ ...entry, projectId: project.id })));

    res.json({ project, standups });
  });

  router.post("/projects/:projectId/standups", async (req, res) => {
    if (!mockFlowEnabled) {
      try {
        res.status(201).json(await submitSupabaseProjectStandup(String(req.params.projectId ?? ""), req.body));
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Unable to submit standup" });
      }
      return;
    }

    const personaId = String(req.body?.personaId ?? "");
    const project = findProject(String(req.params.projectId ?? ""));
    const persona = findPersona(personaId);
    const yesterday = String(req.body?.yesterday ?? "").trim();
    const today = String(req.body?.today ?? "").trim();
    const blockers = String(req.body?.blockers ?? "No blocker.").trim();

    if (!project || !persona || !hasPermission(persona, "standup:submit", project)) {
      res.status(403).json({ error: "You do not have permission to submit standups for this project" });
      return;
    }

    if (!yesterday || !today) {
      res.status(400).json({ error: "Yesterday and today fields are required" });
      return;
    }

    const entry: StandupEntry = {
      id: `${project.id}-${personaId}-${Date.now()}`,
      projectId: project.id,
      memberId: personaId,
      date: new Date().toISOString().slice(0, 10),
      yesterday,
      today,
      blockers: blockers || "No blocker.",
      source: "manual"
    };

    const member = addStandupEntry(entry);
    res.status(201).json({ entry, member, project });
  });

  router.post("/projects/:projectId/transcripts/parse", async (req, res) => {
    if (!mockFlowEnabled) {
      try {
        const transcript = String(req.body?.transcript ?? "").trim();
        if (!transcript) {
          res.status(400).json({ error: "Transcript text is required" });
          return;
        }
        res.json(
          await parseSupabaseProjectTranscript(
            String(req.params.projectId ?? ""),
            String(req.body?.personaId ?? ""),
            transcript
          )
        );
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Transcript parse failed" });
      }
      return;
    }

    const project = findProject(String(req.params.projectId ?? ""));
    const transcript = String(req.body?.transcript ?? "").trim();

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    if (!transcript) {
      res.status(400).json({ error: "Transcript text is required" });
      return;
    }

    // Mock parser: extract per-speaker entries by matching transcript lines to project members.
    // Lines starting with a known member name (case-insensitive) are attributed to that member.
    const lines = transcript.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const memberMap = new Map(project.members.map((m) => [m.name.toLowerCase(), m]));

    const speakerBlocks = new Map<string, string[]>();
    let currentSpeaker: string | null = null;
    for (const line of lines) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const candidate = line.slice(0, colonIdx).trim().toLowerCase();
        if (memberMap.has(candidate)) {
          currentSpeaker = candidate;
          const rest = line.slice(colonIdx + 1).trim();
          if (rest) speakerBlocks.set(currentSpeaker, [...(speakerBlocks.get(currentSpeaker) ?? []), rest]);
          continue;
        }
      }
      if (currentSpeaker) {
        speakerBlocks.set(currentSpeaker, [...(speakerBlocks.get(currentSpeaker) ?? []), line]);
      }
    }

    // Fall back to assigning lines round-robin across members if no speaker markers found
    const matchedMembers = speakerBlocks.size > 0
      ? [...speakerBlocks.keys()].map((k) => memberMap.get(k)!).filter(Boolean)
      : project.members.slice(0, 4);

    const parsed = (speakerBlocks.size > 0 ? matchedMembers : project.members.slice(0, 4)).map((member, index) => {
      const speakerLines = speakerBlocks.get(member.name.toLowerCase()) ?? [];
      const text = speakerLines.join(" ").trim();
      const parts = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
      return {
        memberId: member.personaId,
        name: member.name,
        yesterday: parts[0] ?? "Worked on assigned sprint tasks.",
        today: parts[1] ?? "Continuing current work items.",
        blockers: parts[2] ?? (index === 2 ? "Waiting on a dependency." : "No blocker."),
        confidence: speakerBlocks.has(member.name.toLowerCase()) ? 0.88 - index * 0.03 : 0.55
      };
    });

    res.json({ mode: "transcript-parser", note: "Transcript entries were structured for sprint analysis.", project, parsed });
  });

  router.post("/projects/:projectId/standups/sync", async (req, res) => {
    if (!mockFlowEnabled) {
      try {
        res.json(await syncSupabaseProjectSignals(String(req.params.projectId ?? ""), String(req.body?.personaId ?? ""), "standup"));
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Unable to sync standups" });
      }
      return;
    }

    const personaId = String(req.body?.personaId ?? "");
    const project = findProject(String(req.params.projectId ?? ""));
    const persona = findPersona(personaId);

    if (!project || !persona || !hasPermission(persona, "standup:sync", project)) {
      res.status(403).json({ error: "You do not have permission to sync standups for this project" });
      return;
    }

    project.lastSyncAt = new Date().toISOString();
    project.updatedAt = project.lastSyncAt;

    res.json({
      project,
      syncedAt: project.lastSyncAt,
      importedStandups: 6,
      warnings: ["Connected delivery updates were refreshed for the selected sprint."]
    });
  });

  // Legacy global transcript parse (mock mode only)
  router.post("/transcripts/parse", (req, res) => {
    if (!mockFlowEnabled) {
      res.status(501).json({ error: realDataNotReadyMessage });
      return;
    }

    const transcript = String(req.body?.transcript ?? "").trim();
    if (!transcript) {
      res.status(400).json({ error: "Transcript text is required" });
      return;
    }

    const parsed = personas.slice(0, 4).map((persona, index) => ({
      memberId: persona.id,
      name: persona.name,
      yesterday: index === 3 ? "Stabilised the dashboard API and improved caching." : "Continued work on assigned sprint screens.",
      today: index === 3 ? "Connecting AI scoring results to dashboard data layer." : "Finishing UI implementation and component polish.",
      blockers: index === 2 ? "Blocked on final transcript parser contract." : "No blocker.",
      confidence: 0.78 - index * 0.04
    }));

    res.json({ mode: "transcript-parser", note: "Transcript entries were structured for sprint analysis.", parsed });
  });

  // Power Automate / Teams transcript webhook.
  // Body shape sent by Power Automate's HTTP action:
  //   { transcript: string, organizerEmail: string, meetingSubject?: string, meetingId?: string }
  // `transcript` may be VTT or plain text; we normalise to plain text and reuse
  // the same parser used by the manual paste flow.
  //
  // Auth (any of the following accepted, in order):
  //   1. X-SprintPulse-Webhook-Token matches an active per-project DB token
  //      (minted via the Integrations UI; revokable). Validates AFTER the
  //      project ID is known so each token is scoped to one project.
  //   2. X-SprintPulse-Webhook-Token matches the env TEAMS_WEBHOOK_TOKEN
  //      (single deployment-wide secret; legacy path).
  //   3. If neither env nor any active DB token exists, the route stays open
  //      (organizerEmail-must-be-a-project-member is still enforced below).
  router.post("/projects/:projectId/transcripts/teams-webhook", async (req, res) => {
    if (mockFlowEnabled) {
      res.status(501).json({ error: "Teams webhook is only available in real-data mode." });
      return;
    }

    try {
      const projectId = String(req.params.projectId ?? "");
      const providedToken = req.get("X-SprintPulse-Webhook-Token") ?? "";
      const envToken = process.env.TEAMS_WEBHOOK_TOKEN ?? "";

      let dbTokenValid = false;
      if (providedToken) {
        dbTokenValid = await validateProjectWebhookToken(projectId, providedToken);
      }
      const envTokenMatches = Boolean(envToken && providedToken === envToken);

      // Auth required when either an env token is configured or any active DB
      // token exists for this project. The latter check happens via the
      // validateProjectWebhookToken call — when the project has no tokens, the
      // call returns false but we don't know whether that means "no tokens
      // configured" vs "token mismatch". Decide once here.
      if (envToken && !envTokenMatches && !dbTokenValid) {
        res.status(401).json({ error: "Invalid or missing X-SprintPulse-Webhook-Token header." });
        return;
      }
      if (!envToken && providedToken && !dbTokenValid) {
        // Caller went to the trouble of sending a token; reject if it doesn't
        // match any DB token. (Falling through silently would mask typos.)
        const projectHasTokens = await projectHasAnyActiveWebhookToken(projectId);
        if (projectHasTokens) {
          res.status(401).json({ error: "Invalid X-SprintPulse-Webhook-Token for this project." });
          return;
        }
      }
      // No-credentials case (envToken unset AND no DB tokens) falls through.
      const organizerEmail = String(req.body?.organizerEmail ?? "").trim();
      const rawTranscript = String(req.body?.transcript ?? "").trim();
      const meetingSubject = String(req.body?.meetingSubject ?? "").trim();
      const meetingId = String(req.body?.meetingId ?? "").trim();

      if (!rawTranscript) {
        res.status(400).json({ error: "transcript is required" });
        return;
      }
      if (!organizerEmail) {
        res.status(400).json({ error: "organizerEmail is required" });
        return;
      }

      const personaId = await findProjectMemberPersonaIdByEmail(projectId, organizerEmail);
      if (!personaId) {
        res.status(404).json({
          error: `No project member matches organizer ${organizerEmail}. The meeting organizer must be a member of this project.`
        });
        return;
      }

      const plainText = vttToPlainText(rawTranscript);
      const result = await parseSupabaseProjectTranscript(projectId, personaId, plainText);

      res.status(201).json({
        ...result,
        source: "teams-webhook",
        meetingSubject: meetingSubject || undefined,
        meetingId: meetingId || undefined,
        organizerEmail
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Teams webhook handler failed" });
    }
  });
}
