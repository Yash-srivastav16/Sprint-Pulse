import type {
  AccessScope,
  AppRole,
  CreateUserProfileRequest,
  CreateUserProfileResponse,
  HackathonRole,
  Persona,
  ProductPersona,
  ProjectRole,
  UserProfile
} from "@sprintpulse/shared";
import { supabaseAdmin, supabaseAdminConfigError } from "../lib/supabaseAdmin.js";

export type ProfileRow = {
  id: string;
  auth_user_id?: string | null;
  email: string;
  name: string;
  initials: string;
  title: string;
  app_role: AppRole;
  product_persona: ProductPersona;
  access_scope: AccessScope;
  status: "active" | "invited";
  created_at: string;
  invited_by?: string | null;
};

export const profilesTable = process.env.SUPABASE_PROFILES_TABLE ?? "profiles";

export const roleDefaults: Record<
  AppRole,
  {
    productPersona: ProductPersona;
    accessScope: AccessScope;
    hackathonRole: HackathonRole;
    title: string;
    projectRole: ProjectRole;
  }
> = {
  admin: {
    productPersona: "product-owner",
    accessScope: "team",
    hackathonRole: "architect",
    title: "Workspace Admin",
    projectRole: "product-owner"
  },
  "product-owner": {
    productPersona: "product-owner",
    accessScope: "team",
    hackathonRole: "architect",
    title: "Product Owner",
    projectRole: "product-owner"
  },
  "engineering-manager": {
    productPersona: "engineering-manager",
    accessScope: "team",
    hackathonRole: "architect",
    title: "Engineering Manager",
    projectRole: "engineering-manager"
  },
  "scrum-master": {
    productPersona: "scrum-master",
    accessScope: "team",
    hackathonRole: "architect",
    title: "Scrum Master",
    projectRole: "scrum-master"
  },
  developer: {
    productPersona: "developer",
    accessScope: "individual",
    hackathonRole: "frontend",
    title: "Developer",
    projectRole: "developer"
  },
  "qa-lead": {
    productPersona: "qa-lead",
    accessScope: "quality",
    hackathonRole: "qa",
    title: "QA Lead",
    projectRole: "qa"
  }
};

const nowIso = () => new Date().toISOString();

const slugFromEmail = (email: string) =>
  email
    .trim()
    .toLowerCase()
    .split("@")[0]
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const initialsFromName = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "SP";

const inviteTablesMissing = (message: string) =>
  message.includes("project_invites") || message.includes("project_members");

const requireSupabaseAdmin = () => {
  if (!supabaseAdmin) {
    throw new Error(supabaseAdminConfigError ?? "Backend Supabase Admin is not configured.");
  }

  return supabaseAdmin;
};

export const toProfile = (row: ProfileRow): UserProfile => ({
  id: row.id,
  authUserId: row.auth_user_id ?? undefined,
  email: row.email,
  name: row.name,
  initials: row.initials,
  title: row.title,
  appRole: row.app_role,
  productPersona: row.product_persona,
  accessScope: row.access_scope,
  status: row.status,
  createdAt: row.created_at,
  invitedBy: row.invited_by ?? undefined
});

export const toPersonaFromProfile = (profile: UserProfile): Persona => ({
  id: profile.id,
  name: profile.name,
  email: profile.email,
  initials: profile.initials,
  hackathonRole: roleDefaults[profile.appRole].hackathonRole,
  productPersona: profile.productPersona,
  title: profile.title,
  accessScope: profile.accessScope,
  focus:
    profile.appRole === "admin"
      ? "Workspace administration, team access, and delivery visibility."
      : "SprintPulse workspace access and delivery collaboration."
});

export const listSupabasePersonas = async (): Promise<Persona[]> => {
  const client = requireSupabaseAdmin();
  const { data, error } = await client.from(profilesTable).select("*").order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ProfileRow[]).map(toProfile).map(toPersonaFromProfile);
};

export const findSupabasePersonaById = async (personaId: string): Promise<Persona | undefined> => {
  const client = requireSupabaseAdmin();
  const { data, error } = await client.from(profilesTable).select("*").eq("id", personaId).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? toPersonaFromProfile(toProfile(data as ProfileRow)) : undefined;
};

export const findSupabaseProfileById = async (profileId: string): Promise<UserProfile | undefined> => {
  const client = requireSupabaseAdmin();
  const { data, error } = await client.from(profilesTable).select("*").eq("id", profileId).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? toProfile(data as ProfileRow) : undefined;
};

export const findSupabaseProfilesByIds = async (profileIds: string[]): Promise<UserProfile[]> => {
  if (!profileIds.length) {
    return [];
  }

  const client = requireSupabaseAdmin();
  const { data, error } = await client.from(profilesTable).select("*").in("id", profileIds);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ProfileRow[]).map(toProfile);
};

const acceptPendingProjectInvites = async (email: string, profileId: string, warnings: string[]) => {
  const client = requireSupabaseAdmin();
  const normalizedEmail = email.trim().toLowerCase();
  const now = nowIso();

  const invites = await client
    .from("project_invites")
    .select("project_id, role")
    .eq("status", "pending")
    .ilike("email", normalizedEmail);

  if (invites.error) {
    if (inviteTablesMissing(invites.error.message)) {
      warnings.push("Project invite acceptance tables are not installed yet.");
      return;
    }

    throw new Error(invites.error.message);
  }

  const inviteRows = (invites.data ?? []) as Array<{ project_id: string; role: ProjectRole }>;
  if (!inviteRows.length) {
    return;
  }

  const memberRows = inviteRows.map((invite) => ({
    project_id: invite.project_id,
    profile_id: profileId,
    role: invite.role
  }));
  const memberWrite = await client.from("project_members").upsert(memberRows);

  if (memberWrite.error) {
    if (inviteTablesMissing(memberWrite.error.message)) {
      warnings.push("Project membership tables are not installed yet.");
      return;
    }

    throw new Error(memberWrite.error.message);
  }

  const inviteWrite = await client
    .from("project_invites")
    .update({
      status: "accepted",
      accepted_at: now
    })
    .eq("status", "pending")
    .ilike("email", normalizedEmail);

  if (inviteWrite.error) {
    throw new Error(inviteWrite.error.message);
  }
};

const autoLinkGitSignalsByEmail = async (email: string, profile: ProfileRow, warnings: string[]) => {
  const client = requireSupabaseAdmin();
  const normalizedEmail = email.trim().toLowerCase();
  const commits = await client
    .from("git_commits")
    .select("project_id")
    .ilike("author_email", normalizedEmail);

  if (commits.error) {
    if (inviteTablesMissing(commits.error.message)) {
      return;
    }

    warnings.push(`GitHub email auto-link skipped: ${commits.error.message}`);
    return;
  }

  const projectIds = [...new Set(((commits.data ?? []) as Array<{ project_id: string }>).map((commit) => commit.project_id))];
  if (!projectIds.length) {
    return;
  }

  const memberWrite = await client.from("project_members").upsert(
    projectIds.map((projectId) => ({
      project_id: projectId,
      profile_id: profile.id,
      role: roleDefaults[profile.app_role].projectRole
    })),
    { onConflict: "project_id,profile_id" }
  );

  if (memberWrite.error) {
    warnings.push(`GitHub project membership auto-link skipped: ${memberWrite.error.message}`);
    return;
  }

  const commitWrite = await client
    .from("git_commits")
    .update({ author_profile_id: profile.id })
    .ilike("author_email", normalizedEmail);

  if (commitWrite.error) {
    warnings.push(`GitHub commit auto-link skipped: ${commitWrite.error.message}`);
  }
};

export const createSupabaseUserProfile = async (
  request: CreateUserProfileRequest
): Promise<CreateUserProfileResponse> => {
  const client = requireSupabaseAdmin();
  const email = request.email.trim().toLowerCase();
  const name = request.name.trim();
  const defaults = roleDefaults[request.appRole];
  const existing = await client.from(profilesTable).select("*").eq("email", email).maybeSingle();

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  const existingProfile = (existing.data as ProfileRow | null) ?? null;
  const row: ProfileRow = {
    id: existingProfile?.id ?? (slugFromEmail(email) || `user-${Date.now()}`),
    auth_user_id: request.authUserId,
    email,
    name,
    initials: initialsFromName(name),
    title: request.title?.trim() || defaults.title,
    app_role: request.appRole,
    product_persona: defaults.productPersona,
    access_scope: defaults.accessScope,
    status: "active",
    created_at: existingProfile?.created_at ?? nowIso(),
    invited_by: existingProfile?.invited_by
  };

  const { data, error } = await client
    .from(profilesTable)
    .upsert(row, { onConflict: "email" })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const profile = toProfile(data as ProfileRow);
  const warnings: string[] = [];
  await acceptPendingProjectInvites(email, profile.id, warnings);
  await autoLinkGitSignalsByEmail(email, data as ProfileRow, warnings);

  return {
    profile,
    persona: toPersonaFromProfile(profile),
    recommendedRoute: "/projects",
    warnings
  };
};
