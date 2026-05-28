import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const DRAWING_BUCKET = "drawing-images";

function isHeaderSafeAscii(value: string) {
  return [...value].every((character) => character.charCodeAt(0) <= 255);
}

function isPlaceholderValue(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.includes("your-") ||
    normalized.includes("replace-with") ||
    normalized.includes("таны") ||
    normalized.includes("өөрийн")
  );
}

function getKeyError(keyName: string, value?: string) {
  if (!value) {
    return `${keyName} тохируулагдаагүй байна.`;
  }

  if (isPlaceholderValue(value)) {
    return `${keyName} дээр placeholder биш жинхэнэ Supabase key оруулна уу.`;
  }

  if (!isHeaderSafeAscii(value)) {
    return `${keyName} зөвхөн латин тэмдэгттэй Supabase key байх ёстой. Vercel env дээр кирилл тайлбар/placeholder орсон байна.`;
  }

  return null;
}

export function getPublicSupabaseEnvError() {
  if (!supabaseUrl) {
    return "NEXT_PUBLIC_SUPABASE_URL тохируулагдаагүй байна.";
  }

  try {
    new URL(supabaseUrl);
  } catch {
    return "NEXT_PUBLIC_SUPABASE_URL буруу байна.";
  }

  return getKeyError("NEXT_PUBLIC_SUPABASE_ANON_KEY", supabaseAnonKey);
}

export function getServerSupabaseEnvError() {
  return getPublicSupabaseEnvError() || getKeyError("SUPABASE_SERVICE_ROLE_KEY", supabaseServiceRoleKey);
}

export function hasPublicSupabaseEnv() {
  return !getPublicSupabaseEnvError();
}

export function hasServerSupabaseEnv() {
  return !getServerSupabaseEnvError();
}

export function createPublicSupabaseClient() {
  const envError = getPublicSupabaseEnvError();
  if (envError || !supabaseUrl || !supabaseAnonKey) {
    throw new Error(envError || "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export function createServiceSupabaseClient() {
  const envError = getServerSupabaseEnvError();
  if (envError || !supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(envError || "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
