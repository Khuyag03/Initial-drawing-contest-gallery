"use client";

import { createClient } from "@supabase/supabase-js";

function isHeaderSafeAscii(value: string) {
  return [...value].every((character) => character.charCodeAt(0) <= 255);
}

export function createBrowserSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase public тохиргоо дутуу байна.");
  }

  if (!isHeaderSafeAscii(supabaseAnonKey)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY буруу байна. Vercel env дээр жинхэнэ Supabase anon key оруулна уу.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
