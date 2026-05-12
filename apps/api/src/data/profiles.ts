import type {
  AccessScope,
  AppRole,
  CreateUserProfileRequest,
  CreateUserProfileResponse,
  HackathonRole,
  InviteUserRequest,
  MemberPulse,
  Persona,
  ProductPersona,
  ProjectMember,
  ProjectRole,
  UserProfile
} from "@sprintpulse/shared";
import { findProject, memberPulses, personas } from "./seed.js";

const nowIso = () => new Date().toISOString();

const roleDefaults: Record<
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

const profileToPersona = (profile: UserProfile): Persona => ({
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

const profileToMemberPulse = (profile: UserProfile): MemberPulse => ({
  id: profile.id,
  personaId: profile.id,
  name: profile.name,
  initials: profile.initials,
  title: profile.title,
  hackathonRole: roleDefaults[profile.appRole].hackathonRole,
  productPersona: profile.productPersona,
  healthScore: 82,
  riskLevel: "low",
  currentFocus: "Getting set up in SprintPulse.",
  recommendation: "Invite accepted. Start with a project workspace and submit the first standup.",
  tickets: [],
  git: {
    commitsThisSprint: 0,
    pullRequestsOpen: 0,
    lastCommitAt: nowIso(),
    codeChurn: "low"
  },
  flags: [],
  standups: []
});

const upsertPersona = (persona: Persona) => {
  const existingIndex = personas.findIndex((item) => item.id === persona.id || item.email.toLowerCase() === persona.email.toLowerCase());
  if (existingIndex >= 0) {
    personas[existingIndex] = persona;
    return;
  }

  personas.push(persona);
};

const upsertMemberPulse = (profile: UserProfile) => {
  const existing = memberPulses.find((pulse) => pulse.personaId === profile.id);
  if (existing) {
    existing.name = profile.name;
    existing.initials = profile.initials;
    existing.title = profile.title;
    existing.productPersona = profile.productPersona;
    existing.hackathonRole = roleDefaults[profile.appRole].hackathonRole;
    return;
  }

  memberPulses.push(profileToMemberPulse(profile));
};

export const userProfiles: UserProfile[] = [];

export const ensureProfileInWorkspace = (profile: UserProfile) => {
  const persona = profileToPersona(profile);
  upsertPersona(persona);
  upsertMemberPulse(profile);
  return persona;
};

export const defaultAdminEmail = (process.env.DEFAULT_ADMIN_EMAIL ?? "admin@sprintpulse.dev").trim().toLowerCase();

export const ensureDefaultAdminProfile = (authUserId?: string): UserProfile => {
  const existing = userProfiles.find((profile) => profile.email === defaultAdminEmail);
  if (existing) {
    if (authUserId && !existing.authUserId) {
      existing.authUserId = authUserId;
    }
    ensureProfileInWorkspace(existing);
    return existing;
  }

  const adminName = process.env.DEFAULT_ADMIN_NAME ?? "SprintPulse Admin";
  const profile: UserProfile = {
    id: slugFromEmail(defaultAdminEmail) || "admin",
    authUserId,
    email: defaultAdminEmail,
    name: adminName,
    initials: initialsFromName(adminName),
    title: "Workspace Admin",
    appRole: "admin",
    productPersona: "product-owner",
    accessScope: "team",
    status: "active",
    createdAt: nowIso()
  };

  userProfiles.push(profile);
  ensureProfileInWorkspace(profile);
  return profile;
};

ensureDefaultAdminProfile();

export const findProfileByEmail = (email: string) =>
  userProfiles.find((profile) => profile.email === email.trim().toLowerCase());

export const findProfileByAuthUserId = (authUserId: string) =>
  userProfiles.find((profile) => profile.authUserId === authUserId);

export const findOrCreateProfileForAuthUser = (input: {
  authUserId: string;
  email: string;
  name?: string;
}): UserProfile | undefined => {
  const email = input.email.trim().toLowerCase();
  const existing = findProfileByAuthUserId(input.authUserId) ?? findProfileByEmail(email);
  if (existing) {
    existing.authUserId = input.authUserId;
    existing.status = "active";
    ensureProfileInWorkspace(existing);
    return existing;
  }

  if (email === defaultAdminEmail) {
    return ensureDefaultAdminProfile(input.authUserId);
  }

  return undefined;
};

export const canInviteUsers = (profile: UserProfile) =>
  profile.appRole === "admin" || profile.appRole === "scrum-master" || profile.appRole === "engineering-manager";

export const createInvitedProfile = (request: InviteUserRequest, inviter: UserProfile): UserProfile => {
  const email = request.email.trim().toLowerCase();
  const defaults = roleDefaults[request.appRole];
  const existing = findProfileByEmail(email);

  if (existing) {
    existing.name = request.name.trim() || existing.name;
    existing.title = request.title?.trim() || existing.title;
    existing.appRole = request.appRole;
    existing.productPersona = defaults.productPersona;
    existing.accessScope = defaults.accessScope;
    ensureProfileInWorkspace(existing);
    return existing;
  }

  const name = request.name.trim();
  const profile: UserProfile = {
    id: slugFromEmail(email) || `user-${Date.now()}`,
    email,
    name,
    initials: initialsFromName(name),
    title: request.title?.trim() || defaults.title,
    appRole: request.appRole,
    productPersona: defaults.productPersona,
    accessScope: defaults.accessScope,
    status: "invited",
    createdAt: nowIso(),
    invitedBy: inviter.id
  };

  userProfiles.push(profile);
  ensureProfileInWorkspace(profile);
  return profile;
};

export const createSelfServiceProfile = (request: CreateUserProfileRequest): CreateUserProfileResponse => {
  const email = request.email.trim().toLowerCase();
  const defaults = roleDefaults[request.appRole];
  const existing = findProfileByEmail(email);

  if (existing) {
    existing.name = request.name.trim() || existing.name;
    existing.title = request.title?.trim() || existing.title;
    existing.authUserId = request.authUserId ?? existing.authUserId;
    existing.appRole = request.appRole;
    existing.productPersona = defaults.productPersona;
    existing.accessScope = defaults.accessScope;
    existing.status = "active";
    ensureProfileInWorkspace(existing);

    return {
      profile: existing,
      persona: toPersona(existing),
      recommendedRoute: "/projects",
      warnings: []
    };
  }

  const name = request.name.trim();
  const profile: UserProfile = {
    id: slugFromEmail(email) || `user-${Date.now()}`,
    authUserId: request.authUserId,
    email,
    name,
    initials: initialsFromName(name),
    title: request.title?.trim() || defaults.title,
    appRole: request.appRole,
    productPersona: defaults.productPersona,
    accessScope: defaults.accessScope,
    status: "active",
    createdAt: nowIso()
  };

  userProfiles.push(profile);
  ensureProfileInWorkspace(profile);

  return {
    profile,
    persona: toPersona(profile),
    recommendedRoute: "/projects",
    warnings: []
  };
};

export const addProfileToProject = (profile: UserProfile, projectId?: string, projectRole?: ProjectRole) => {
  if (!projectId) {
    return;
  }

  const project = findProject(projectId);
  if (!project) {
    return;
  }

  const role = projectRole ?? roleDefaults[profile.appRole].projectRole;
  const member: ProjectMember = {
    personaId: profile.id,
    name: profile.name,
    email: profile.email,
    initials: profile.initials,
    role
  };
  const existingIndex = project.members.findIndex((item) => item.personaId === profile.id || item.email.toLowerCase() === profile.email);

  if (existingIndex >= 0) {
    project.members[existingIndex] = member;
  } else {
    project.members.push(member);
  }

  if (role === "product-owner" && !project.ownerIds.includes(profile.id)) {
    project.ownerIds.push(profile.id);
  }

  if (role === "scrum-master" && !project.scrumMasterIds.includes(profile.id)) {
    project.scrumMasterIds.push(profile.id);
  }

  project.updatedAt = nowIso();
};

export const toPersona = profileToPersona;
