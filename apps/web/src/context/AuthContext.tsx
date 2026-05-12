import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { AccessScope, AppRole, HackathonRole, Persona, ProductPersona } from "@sprintpulse/shared";
import { api } from "../api";
import { supabase, supabaseConfigError } from "../lib/supabase";

type ProfileRow = {
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
};

const roleDefaults: Record<
  AppRole,
  {
    productPersona: ProductPersona;
    accessScope: AccessScope;
    hackathonRole: HackathonRole;
    title: string;
  }
> = {
  admin: {
    productPersona: "product-owner",
    accessScope: "team",
    hackathonRole: "architect",
    title: "Workspace Admin"
  },
  "product-owner": {
    productPersona: "product-owner",
    accessScope: "team",
    hackathonRole: "architect",
    title: "Product Owner"
  },
  "engineering-manager": {
    productPersona: "engineering-manager",
    accessScope: "team",
    hackathonRole: "architect",
    title: "Engineering Manager"
  },
  "scrum-master": {
    productPersona: "scrum-master",
    accessScope: "team",
    hackathonRole: "architect",
    title: "Scrum Master"
  },
  developer: {
    productPersona: "developer",
    accessScope: "individual",
    hackathonRole: "frontend",
    title: "Developer"
  },
  "qa-lead": {
    productPersona: "qa-lead",
    accessScope: "quality",
    hackathonRole: "qa",
    title: "QA Lead"
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

const profileToPersona = (profile: ProfileRow): Persona => ({
  id: profile.id,
  name: profile.name,
  email: profile.email,
  initials: profile.initials,
  hackathonRole: roleDefaults[profile.app_role].hackathonRole,
  productPersona: profile.product_persona,
  title: profile.title,
  accessScope: profile.access_scope,
  focus:
    profile.app_role === "admin"
      ? "Workspace administration, team access, and delivery visibility."
      : "SprintPulse workspace access and delivery collaboration."
});

interface AuthContextValue {
  persona: Persona | null;
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  configurationError: string | null;
  signInWithPassword: (input: { email: string; password: string }) => Promise<{ recommendedRoute: string }>;
  signUpWithPassword: (input: {
    name: string;
    email: string;
    password: string;
    appRole: AppRole;
  }) => Promise<{ recommendedRoute?: string; message: string }>;
  setPersona: (persona: Persona) => void;
  signOut: () => Promise<void>;
  logout: () => void;
}

const STORAGE_KEY = "sprintpulse.persona";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const readStoredPersona = (): Persona | null => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as Persona;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [persona, setPersonaState] = useState<Persona | null>(readStoredPersona);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(supabase));

  const clearPersona = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setPersonaState(null);
  };

  const persistPersona = (nextPersona: Persona) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPersona));
    setPersonaState(nextPersona);
  };

  const getPersonaFromSupabaseProfile = async (email: string) => {
    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("No SprintPulse profile is linked to this email.");
    }

    return profileToPersona(data as ProfileRow);
  };

  const upsertSupabaseProfile = async (input: {
    authUserId: string;
    email: string;
    name: string;
    appRole: AppRole;
  }) => {
    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }

    const defaults = roleDefaults[input.appRole];
    const row: ProfileRow = {
      id: slugFromEmail(input.email) || `user-${Date.now()}`,
      auth_user_id: input.authUserId,
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      initials: initialsFromName(input.name),
      title: defaults.title,
      app_role: input.appRole,
      product_persona: defaults.productPersona,
      access_scope: defaults.accessScope,
      status: "active",
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("profiles")
      .upsert(row, { onConflict: "email" })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return profileToPersona(data as ProfileRow);
  };

  const applySession = async (nextSession: Session | null) => {
    const email = nextSession?.user.email;
    if (!email) {
      setSession(null);
      setUser(null);
      clearPersona();
      return;
    }

    let nextPersona: Persona;
    try {
      nextPersona = await api.getPersonaByEmail(email);
    } catch {
      nextPersona = await getPersonaFromSupabaseProfile(email);
    }

    setSession(nextSession);
    setUser(nextSession.user);
    persistPersona(nextPersona);
  };

  useEffect(() => {
    if (!supabase) {
      clearPersona();
      setIsLoading(false);
      return;
    }

    let active = true;

    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (!active) {
          return;
        }

        if (error) {
          setSession(null);
          setUser(null);
          clearPersona();
          return;
        }

        await applySession(data.session);
      })
      .catch(() => {
        setSession(null);
        setUser(null);
        clearPersona();
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setIsLoading(true);
      applySession(nextSession)
        .catch(() => {
          setSession(null);
          setUser(null);
          clearPersona();
        })
        .finally(() => setIsLoading(false));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    setSession(null);
    setUser(null);
    clearPersona();

    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      persona,
      session,
      user,
      isAuthenticated: Boolean(persona) && !supabaseConfigError && (isLoading || Boolean(session)),
      isLoading,
      configurationError: supabaseConfigError,
      signInWithPassword: async ({ email, password }) => {
        if (!supabase) {
          throw new Error(supabaseConfigError ?? "Supabase is not configured.");
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });

        if (error) {
          throw new Error(error.message);
        }

        try {
          await applySession(data.session);
        } catch (err) {
          await supabase.auth.signOut();
          throw err;
        }

        return { recommendedRoute: "/projects" };
      },
      signUpWithPassword: async ({ name, email, password, appRole }) => {
        if (!supabase) {
          throw new Error(supabaseConfigError ?? "Supabase is not configured.");
        }

        const normalizedEmail = email.trim().toLowerCase();
        const fullName = name.trim();
        const signup = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              full_name: fullName,
              sprintpulse_role: appRole
            }
          }
        });
        let activeSession = signup.data.session;
        let authUserId = signup.data.user?.id;

        if (signup.error) {
          const canBackfillProfile = signup.error.message.toLowerCase().includes("registered");
          if (!canBackfillProfile) {
            throw new Error(signup.error.message);
          }

          const { data: existingAuth, error: signInError } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password
          });

          if (signInError) {
            throw new Error(signInError.message);
          }

          activeSession = existingAuth.session;
          authUserId = existingAuth.user?.id;
        }

        if (!activeSession) {
          const { data: signedIn, error: signInError } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password
          });

          if (signInError) {
            throw new Error(signInError.message);
          }

          activeSession = signedIn.session;
          authUserId = signedIn.user?.id ?? authUserId;
        }

        if (!activeSession) {
          throw new Error("Supabase blocked direct sign-in. Turn off signup verification in Supabase Auth settings for this hackathon flow.");
        }

        try {
          await api.createUserProfile({
            authUserId,
            email: normalizedEmail,
            name: fullName,
            appRole
          });
        } catch (apiError) {
          if (!authUserId) {
            await supabase.auth.signOut();
            throw new Error(
              apiError instanceof Error
                ? `Supabase Auth account exists, but SprintPulse profile was not saved. ${apiError.message}`
                : "Supabase Auth account exists, but SprintPulse profile was not saved."
            );
          }

          try {
            await upsertSupabaseProfile({
              authUserId,
              email: normalizedEmail,
              name: fullName,
              appRole
            });
          } catch (profileError) {
            await supabase.auth.signOut();
            throw new Error(
              profileError instanceof Error
                ? `Supabase Auth account exists, but SprintPulse profile was not saved. ${profileError.message}`
                : "Supabase Auth account exists, but SprintPulse profile was not saved."
            );
          }
        }

        try {
          await applySession(activeSession);
          return {
            recommendedRoute: "/projects",
            message: "Account created. Opening your SprintPulse workspace."
          };
        } catch (err) {
          await supabase.auth.signOut();
          throw err;
        }
      },
      setPersona: persistPersona,
      signOut,
      logout: () => {
        void signOut();
      }
    }),
    [isLoading, persona, session, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
