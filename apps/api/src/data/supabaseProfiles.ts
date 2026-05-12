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

export const createSupabaseUserProfile = async (
  request: CreateUserProfileRequest
): Promise<CreateUserProfileResponse> => {
  const client = requireSupabaseAdmin();
  const email = request.email.trim().toLowerCase();
  const name = request.name.trim();
  const defaults = roleDefaults[request.appRole];
  const row: ProfileRow = {
    id: slugFromEmail(email) || `user-${Date.now()}`,
    auth_user_id: request.authUserId,
    email,
    name,
    initials: initialsFromName(name),
    title: request.title?.trim() || defaults.title,
    app_role: request.appRole,
    product_persona: defaults.productPersona,
    access_scope: defaults.accessScope,
    status: "active",
    created_at: nowIso()
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

  return {
    profile,
    persona: toPersonaFromProfile(profile),
    recommendedRoute: "/projects",
    warnings: []
  };
};
