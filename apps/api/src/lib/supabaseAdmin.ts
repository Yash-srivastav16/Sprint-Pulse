import "../config/env.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const serviceRoleKeyIsPublishable = serviceRoleKey?.startsWith("sb_publishable_") ?? false;

export const supabaseAdminConfigError =
  !supabaseUrl || !serviceRoleKey
    ? "Backend Supabase Admin is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to the API environment."
    : serviceRoleKeyIsPublishable
      ? "SUPABASE_SERVICE_ROLE_KEY is set to a publishable/anon key. Use the Supabase service_role secret key for the API."
    : null;

export const supabaseAdmin: SupabaseClient | null =
  supabaseUrl && serviceRoleKey && !serviceRoleKeyIsPublishable
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      })
    : null;

export const supabaseAdminConfigured = Boolean(supabaseAdmin);

export const getAuthUserFromToken = async (accessToken: string) => {
  if (!supabaseAdmin) {
    throw new Error(supabaseAdminConfigError ?? "Backend Supabase Admin is not configured.");
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new Error(error?.message ?? "Invalid Supabase session.");
  }

  return data.user;
};
